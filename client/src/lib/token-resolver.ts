/**
 * token-resolver.ts
 * ─────────────────
 * Async token resolver that reads variable definitions and overrides
 * from Supabase (via supabase-variables.ts) and resolves {{tokens}}
 * with deterministic precedence:
 *
 *   1. Doc-level override  (doc_variable_overrides)
 *   2. Workspace binding   (entity data passed in context)
 *   3. Global default      (variable_definition.default_value_json)
 *   4. Fallback mode       (empty / warning / block_compile)
 *
 * This module wraps the synchronous resolveTokens() from semantic-variables.ts
 * but pre-loads data from Supabase to build the ResolutionContext.
 */

import type {
  ResolutionContext,
  TokenResolutionResult,
  MissingToken,
  VariableDefinition,
  FallbackMode,
} from './semantic-variables';
import {
  extractTokenKeys,
  resolveTokens,
  checkCompileReadiness,
} from './semantic-variables';
import {
  fetchVariableDefinitions,
  fetchDocVariableOverrides,
  fetchVariableSetByDocType,
  fetchVariableSetItems,
} from './supabase-variables';

// ─── Types ───────────────────────────────────────────────────

export interface AsyncResolutionInput {
  /** The document instance ID (for fetching overrides) */
  docInstanceId: string;
  /** Document type: quote | proposal | sla | contract */
  docType: string;
  /** Customer/entity data from workspace (key→value map) */
  entityData?: Record<string, unknown>;
  /** Pricing snapshot from workspace */
  pricingSnapshot?: Record<string, unknown>;
  /** Current user info */
  user?: { name: string; email: string; role: string };
  /** Document title (from doc_instances.title) — used for {{title}} token */
  docTitle?: string;
  /** Customer name (from doc_instances.customer_name) — used for {{customer_name}} token */
  customerName?: string;
}

export interface AsyncResolutionOutput {
  context: ResolutionContext;
  definitions: VariableDefinition[];
}

// ─── Build Resolution Context (async) ────────────────────────

export async function buildAsyncResolutionContext(
  input: AsyncResolutionInput
): Promise<AsyncResolutionOutput> {
  // Fetch all data in parallel
  const [definitions, overrides] = await Promise.all([
    fetchVariableDefinitions(),
    fetchDocVariableOverrides(input.docInstanceId),
  ]);

  // Build entity bindings from customer data + pricing
  const entityBindings: Record<string, unknown> = {};

  // Map customer fields
  if (input.entityData) {
    for (const [k, v] of Object.entries(input.entityData)) {
      entityBindings[`customer.${k}`] = v;
    }
  }

  // Map pricing fields
  if (input.pricingSnapshot) {
    for (const [k, v] of Object.entries(input.pricingSnapshot)) {
      entityBindings[`pricing.${k}`] = v;
      // Also map quote-specific pricing
      entityBindings[`quote.${k}`] = v;
    }
  }

  // Map user fields
  if (input.user) {
    entityBindings['doc.author'] = input.user.name;
    entityBindings['user.name'] = input.user.name;
    entityBindings['user.email'] = input.user.email;
  }

  // ── Short-key aliases for template block tokens ──────────────
  // Block templates (cover.hero, confidentiality) use short keys like
  // {{title}}, {{customer_name}} etc. Map them from available data.

  // {{title}} — document title from doc_instances or doc_type label
  if (input.docTitle) {
    entityBindings['title'] = input.docTitle;
  } else {
    const typeLabels: Record<string, string> = {
      quote: 'Standard Quotation',
      proposal: 'Commercial Proposal',
      sla: 'Service Level Agreement',
      contract: 'Contract',
    };
    entityBindings['title'] = typeLabels[input.docType] || 'Document';
  }

  // {{subtitle}} — static default
  entityBindings['subtitle'] = 'Supply Chain Services';

  // {{customer_name}} — from explicit prop or entity data
  if (input.customerName) {
    entityBindings['customer_name'] = input.customerName;
  } else if (input.entityData?.name) {
    entityBindings['customer_name'] = input.entityData.name;
  }

  // {{ref_number}} — auto-generate from doc type + instance ID
  const refPrefix: Record<string, string> = {
    quote: 'HCS-QT',
    proposal: 'HCS-PR',
    sla: 'HCS-SLA',
    contract: 'HCS-CT',
  };
  const prefix = refPrefix[input.docType] || 'HCS';
  const year = new Date().getFullYear();
  const shortId = input.docInstanceId.replace(/\D/g, '').slice(-4).padStart(4, '0');
  entityBindings['ref_number'] = `${prefix}-${year}-${shortId}`;

  // {{date}} — today's date
  entityBindings['date'] = new Date().toISOString().split('T')[0];

  // {{recipient_name}} — customer contact or customer name
  if (input.entityData?.contactName) {
    entityBindings['recipient_name'] = input.entityData.contactName;
  } else if (input.customerName) {
    entityBindings['recipient_name'] = input.customerName;
  } else if (input.entityData?.name) {
    entityBindings['recipient_name'] = input.entityData.name;
  }

  // Build template defaults from variable definitions with default_value_json
  const templateDefaults: Record<string, unknown> = {};
  for (const def of definitions) {
    if (def.default_value_json != null) {
      templateDefaults[def.key] = def.default_value_json;
    }
  }

  // Build global defaults (same as template defaults for static/global scope)
  const globalDefaults: Record<string, unknown> = { ...templateDefaults };

  // Build doc overrides map (highest precedence)
  const docOverrides: Record<string, unknown> = {};
  for (const ov of overrides) {
    docOverrides[ov.key] = ov.value_json;
  }

  // Merge into entity bindings with precedence:
  // doc override > entity binding > template default > global default
  // The ResolutionContext resolveTokenValue checks:
  //   1. docOverrides first
  //   2. entityBindings second
  //   3. templateDefaults third
  //   4. globalDefaults fourth

  const context: ResolutionContext = {
    recordOverrides: docOverrides,
    entityBindings,
    templateDefaults,
    globalDefaults,
  };

  return { context, definitions };
}

// ─── Resolve Document Tokens (async) ─────────────────────────

export async function resolveDocumentTokensAsync(
  blocks: Array<{ content: string; block_key: string }>,
  input: AsyncResolutionInput
): Promise<{
  results: Array<{ block_key: string; result: TokenResolutionResult }>;
  context: ResolutionContext;
}> {
  const { context } = await buildAsyncResolutionContext(input);

  const results = blocks.map(block => ({
    block_key: block.block_key,
    result: resolveTokens(block.content, context, input.docType),
  }));

  return { results, context };
}

// ─── Check Compile Readiness (async) ─────────────────────────

export async function checkCompileReadinessAsync(
  blocks: Array<{ content: string; block_key: string }>,
  input: AsyncResolutionInput
): Promise<{
  ready: boolean;
  blockingTokens: MissingToken[];
  warningTokens: MissingToken[];
}> {
  const { context } = await buildAsyncResolutionContext(input);
  return checkCompileReadiness(blocks, context, input.docType);
}

// ─── Token Health Summary ────────────────────────────────────

export interface TokenHealthSummary {
  totalTokens: number;
  resolvedCount: number;
  missingCount: number;
  blockingCount: number;
  warningCount: number;
  emptyCount: number;
  healthPercent: number;
  canCompile: boolean;
  missingTokens: MissingToken[];
}

export async function getTokenHealthSummary(
  blocks: Array<{ content: string; block_key: string }>,
  input: AsyncResolutionInput
): Promise<TokenHealthSummary> {
  const { context } = await buildAsyncResolutionContext(input);

  // Collect all token keys from all blocks
  const allKeys = new Set<string>();
  for (const block of blocks) {
    for (const key of extractTokenKeys(block.content)) {
      allKeys.add(key);
    }
  }

  const readiness = checkCompileReadiness(blocks, context, input.docType);
  const totalTokens = allKeys.size;
  const missingCount = readiness.blockingTokens.length + readiness.warningTokens.length;
  const resolvedCount = totalTokens - missingCount;

  return {
    totalTokens,
    resolvedCount,
    missingCount,
    blockingCount: readiness.blockingTokens.length,
    warningCount: readiness.warningTokens.length,
    emptyCount: readiness.warningTokens.filter(t => t.fallback_mode === 'empty').length,
    healthPercent: totalTokens > 0 ? Math.round((resolvedCount / totalTokens) * 100) : 100,
    canCompile: readiness.ready,
    missingTokens: [...readiness.blockingTokens, ...readiness.warningTokens],
  };
}
