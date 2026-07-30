/**
 * final-pack-loader.ts
 * ────────────────────
 * FPS-012 — The single most important function in the entire build.
 *
 * Reads tender data from commercial_tickets (READ ONLY — never writes).
 * Maps tender content to document blocks using explicit block_key mapping.
 * Computes source_hash for drift detection.
 *
 * Source-truth safety:
 * - READS commercial_tickets.type_details (never updates)
 * - READS doc_block_library, doc_templates, doc_template_versions, clause_library
 * - NEVER calls .update() / .upsert() / .delete() on commercial_tickets
 */

import { supabase } from "./supabase";
import { stableJsonStringify } from "./stable-json";
import type { BlockProvenance } from "./document-source";
import { makeBlockProvenance } from "./final-pack-snapshot-contract";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

/** The 5 supported pack types — matches doc_instances.pack_type */
export type PackType =
  | "combined_proposal"
  | "quotation"
  | "sla"
  | "msa"
  | "bilingual_quotation";

/** Pack type → template ID mapping (matches seed data) */
const PACK_TEMPLATE_MAP: Record<PackType, string> = {
  combined_proposal: "tpl-002",
  quotation: "tpl-001",
  sla: "tpl-003",
  msa: "tpl-005",
  bilingual_quotation: "tpl-004",
};

/** A single block in the output snapshot */
export interface OutputBlock {
  /** Unique block instance ID (e.g., "cover.hero-1") */
  id: string;
  /** Block key from doc_block_library (e.g., "cover.hero") */
  block_key: string;
  /** Render key from doc_block_library (e.g., "cover_hero") */
  render_key: string;
  /** Display name from doc_block_library */
  display_name: string;
  /** Block family: commercial, data_bound, legal, annexure, asset */
  family: string;
  /** Editor mode: form, wysiwyg, clause, readonly */
  editor_mode: string;
  /** Whether this block is visible in the output */
  visible: boolean;
  /** Order position in the document */
  order: number;
  /** Whether this block is required by the template */
  required: boolean;
  /** The resolved content for this block */
  content: BlockContent;
  /** Default content from block library (for reset) */
  default_content: string;
  /** Schema config from block library */
  schema_config: Record<string, unknown>;
  /** Permissions from block library */
  permissions: Record<string, unknown>;
  /**
   * Block provenance (FPS-002) — traceability label only, never a lock.
   * Optional so existing blocks/callers keep compiling; missing provenance
   * is treated as unknown_legacy at read time without rewriting the row.
   */
  provenance?: BlockProvenance;
}

/** Content varies by render_key */
export interface BlockContent {
  /** Resolved HTML content (for wysiwyg/clause blocks) */
  html?: string;
  /** Resolved variable values (for form blocks) */
  variables?: Record<string, string>;
  /** Pricing rows (for pricing blocks) */
  pricing_rows?: PricingOutputRow[];
  /** SLA rows (for SLA blocks) */
  sla_rows?: SlaOutputRow[];
  /** Clause entries (for legal clause blocks) */
  clauses?: ClauseEntry[];
  /** TOC entries (for auto-TOC — computed at render time) */
  toc_entries?: TocEntry[];
  /** Cover design overrides (FPS-009) — per-document, additive, advisory. */
  cover_config?: CoverConfig;
  /** Source status — where did this data come from? */
  source_status: "populated" | "not_captured" | "default";
}

/**
 * FPS-009 — Per-document cover overrides, stored on the cover block's content.
 * All fields optional; missing → fall back to the template layout default and
 * the current cover look. Never a gate — invalid values degrade safely.
 */
export interface CoverConfig {
  /** Override the template layout.cover_style for THIS document. */
  cover_style?: string;
  show_logo?: boolean;
  show_subtitle?: boolean;
  show_meta?: boolean;
  show_hero?: boolean;
  show_watermark?: boolean;
  /** Explicit selected hero image URL (from branding cover_hero_urls). */
  hero_url?: string;
  /** Or an index into branding.cover_hero_urls. */
  hero_index?: number;
  align?: "left" | "center" | "right";

  /**
   * FPS-013 — Cover mode. Default (absent) = the native designed cover.
   * - "native"        → designed cover (style/toggles above).
   * - "image"         → the uploaded image cover (hero_url path, FPS-009-2C).
   * - "imported_pdf"  → a user-supplied PDF used STATICALLY as page 1 of the
   *                     exported pack. Never converted to editable content.
   */
  cover_mode?: "native" | "image" | "imported_pdf";
  /** FPS-013 — private-storage path of the imported PDF (no binary in JSON). */
  imported_pdf_path?: string;
  /** FPS-013 — original file name (display only). */
  imported_pdf_file_name?: string;
  /** FPS-013 — which page of the imported PDF to use as the cover (1-based). */
  imported_pdf_page?: number;
  /** FPS-013 — always true; the imported PDF is static, never editable. */
  imported_pdf_static?: boolean;
}

export interface PricingOutputRow {
  id: string;
  scenario_name: string;
  scenario_type: string;
  revenue: string;
  cost: string;
  gp_percent: string;
  recommended: string;
  notes: string;
}

export interface SlaOutputRow {
  kpi: string;
  target: string;
  measurement: string;
  penalty: string;
}

export interface ClauseEntry {
  id: string;
  name: string;
  category: string;
  content_en: string;
  content_ar: string;
}

export interface TocEntry {
  block_key: string;
  display_name: string;
  order: number;
}

/** The full snapshot returned by loadTenderPack */
export interface BlockSnapshot {
  /** Ordered array of output blocks */
  blocks: OutputBlock[];
  /** Tender metadata */
  tender_id: string;
  tender_title: string;
  customer_name: string;
  /** Pack type selected */
  pack_type: PackType;
  /** Template used */
  template_id: string;
  template_name: string;
  /** Source hash for drift detection (SHA-256 of stable-stringified source data) */
  source_hash: string;
  /** Pricing scenario used (if applicable) */
  pricing_scenario_id: string | null;
  /** Snapshot timestamp */
  snapshot_at: string;
  /** The raw source data that was hashed (for drift comparison) */
  source_data: Record<string, unknown>;
  /** Any warnings (non-blocking) */
  warnings: string[];
  /** Error (if load failed) */
  error?: string;

  // ── Snapshot Contract (FPS-001, truthpack v1.2 §"Snapshot Contract") ──
  // Optional source-mode metadata. Optional so the existing connected loader
  // and all current callers keep compiling unchanged. Every adapter populates
  // these; createInstance persists them as real columns AND mirrors them into
  // source_snapshot. These are traceability labels only — never gates/locks.
  /** connected | standalone */
  source_mode?: "connected" | "standalone";
  /** Where the data came from (origin only) */
  source_kind?: string;
  /** How the instance was started */
  creation_method?: string;
  /** What (if anything) the instance links to: tender | standalone | custom_document */
  linked_entity_type?: string;
  /** Linked source id (null for standalone/blank) */
  linked_entity_id?: string | null;
  /** Actual template version id (doc_template_versions.id) where known */
  template_version_id?: string | null;
  /** Template layout config (doc_template_versions.layout) where known — FPS-004 */
  layout?: Record<string, unknown> | null;
  /** Template volume config rows (doc_template_volumes) where known — FPS-006 */
  volumes?: unknown[];
}

// ═══════════════════════════════════════════════════════════
// Internal types
// ═══════════════════════════════════════════════════════════

interface RecipeEntry {
  block_key: string;
  order: number;
  required: boolean;
  default_content_override: string | null;
  config_override: Record<string, unknown>;
}

interface BlockLibraryRow {
  id: string;
  block_key: string;
  family: string;
  display_name: string;
  editor_mode: string;
  permissions: Record<string, unknown>;
  schema_config: Record<string, unknown>;
  render_key: string;
  default_content: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════
// Main loader
// ═══════════════════════════════════════════════════════════

/**
 * Load a tender's content and map it to document blocks for a specific pack type.
 *
 * This function:
 * 1. Fetches the tender from commercial_tickets (READ ONLY)
 * 2. Fetches the template recipe for the selected pack type
 * 3. Fetches block definitions from doc_block_library
 * 4. Fetches clauses from clause_library (if needed)
 * 5. Maps tender data to blocks using explicit block_key mapping
 * 6. Computes source_hash for drift detection
 *
 * @param tenderId - UUID of the tender in commercial_tickets
 * @param packType - Which pack type to build
 * @param scenarioId - Optional pricing scenario ID to use
 * @returns BlockSnapshot with all blocks, hash, and metadata
 */
export async function loadTenderPack(
  tenderId: string,
  packType: PackType,
  scenarioId?: string,
): Promise<BlockSnapshot> {
  const warnings: string[] = [];
  const templateId = PACK_TEMPLATE_MAP[packType];

  // ── 1. Fetch tender (READ ONLY) ────────────────────────
  const { data: tender, error: tenderErr } = await supabase
    .from("commercial_tickets")
    .select("id, ticket_title, customer_name, estimated_value, target_gp_percent, target_date, internal_stage, type_details, created_at, updated_at")
    .eq("id", tenderId)
    .maybeSingle();

  if (tenderErr) {
    return errorSnapshot(tenderId, packType, templateId, `Supabase error: ${tenderErr.message}`);
  }
  if (!tender) {
    return errorSnapshot(tenderId, packType, templateId, `Tender ${tenderId} not found in commercial_tickets`);
  }

  const td = safeObject(tender.type_details);
  const tenderTitle = tender.ticket_title || safeString(td.tender?.title) || "Not available";
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";

  // ── 2. Fetch template recipe ───────────────────────────
  const { data: templateVersion, error: tvErr } = await supabase
    .from("doc_template_versions")
    .select("id, template_id, recipe, layout")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tvErr || !templateVersion) {
    return errorSnapshot(tenderId, packType, templateId,
      `Template version not found for ${templateId}: ${tvErr?.message || "no rows"}`);
  }

  const recipe: RecipeEntry[] = Array.isArray(templateVersion.recipe)
    ? templateVersion.recipe
    : [];

  if (recipe.length === 0) {
    return errorSnapshot(tenderId, packType, templateId, "Template recipe is empty");
  }

  // FPS-006: load any configured volumes for this template version (advisory;
  // empty if none). Never blocks the pack if this read fails.
  const { data: volumeRows } = await supabase
    .from("doc_template_volumes")
    .select("volume_key, volume_name, block_keys, sort_order, description")
    .eq("template_version_id", templateVersion.id)
    .order("sort_order", { ascending: true });

  // ── 3. Fetch block library definitions ─────────────────
  const blockKeys = recipe.map((r) => r.block_key);
  const { data: blockDefs, error: blErr } = await supabase
    .from("doc_block_library")
    .select("*")
    .in("block_key", blockKeys);

  if (blErr) {
    return errorSnapshot(tenderId, packType, templateId, `Block library error: ${blErr.message}`);
  }

  const blockMap = new Map<string, BlockLibraryRow>();
  for (const def of (blockDefs ?? [])) {
    blockMap.set(def.block_key, def as BlockLibraryRow);
  }

  // ── 4. Fetch clauses (if recipe needs them) ────────────
  let clauses: ClauseEntry[] = [];
  const needsClauses = blockKeys.some((k) =>
    k === "legal.clauses.locked" || k === "terms.standard"
  );
  if (needsClauses) {
    const { data: clauseRows } = await supabase
      .from("clause_library")
      .select("id, name, category, content_en, content_ar")
      .eq("status", "published")
      .order("category");
    clauses = (clauseRows ?? []) as ClauseEntry[];
  }

  // ── 5. Fetch template name ─────────────────────────────
  const { data: templateRow } = await supabase
    .from("doc_templates")
    .select("name")
    .eq("id", templateId)
    .maybeSingle();

  const templateName = templateRow?.name || templateId;

  // ── 6. Build source data for hashing ───────────────────
  // Only include the type_details sections that matter for content
  const sourceData: Record<string, unknown> = {
    tender_id: tender.id,
    tender_title: tenderTitle,
    customer_name: customerName,
    estimated_value: tender.estimated_value,
    target_gp_percent: tender.target_gp_percent,
    target_date: tender.target_date,
    pricing: td.pricing ?? null,
    tender_drafting: td.tender_drafting ?? null,
    solution_design_data: td.solution_design_data ?? null,
    sow_data: td.sow_data ?? null,
    tender_metadata: td.tender ?? null,
  };

  const sourceHash = await computeSourceHash(sourceData);

  // ── 7. Map recipe to output blocks ─────────────────────
  const blocks: OutputBlock[] = [];

  for (const entry of recipe) {
    const def = blockMap.get(entry.block_key);
    if (!def) {
      warnings.push(`Block definition not found for key: ${entry.block_key}`);
      continue;
    }

    const content = resolveBlockContent(
      entry.block_key,
      def,
      td,
      tender,
      clauses,
      scenarioId,
      warnings,
    );

    blocks.push({
      id: `${entry.block_key}-${entry.order}`,
      block_key: entry.block_key,
      render_key: def.render_key,
      display_name: def.display_name,
      family: def.family,
      editor_mode: def.editor_mode,
      visible: true,
      order: entry.order,
      required: entry.required,
      content,
      default_content: entry.default_content_override || def.default_content,
      schema_config: safeObject(def.schema_config),
      permissions: safeObject(def.permissions),
      provenance: makeBlockProvenance("commercial_ticket", {
        origin_ref: {
          source_id: tender.id,
          template_id: templateId,
          template_version_id: templateVersion.id,
          block_library_id: def.id,
        },
        source_mode: "connected",
        source_kind: "commercial_ticket",
        creation_method: "connected_source",
      }),
    });
  }

  return {
    blocks,
    tender_id: tender.id,
    tender_title: tenderTitle,
    customer_name: customerName,
    pack_type: packType,
    template_id: templateId,
    template_name: templateName,
    source_hash: sourceHash,
    pricing_scenario_id: scenarioId ?? null,
    snapshot_at: new Date().toISOString(),
    source_data: sourceData,
    warnings,
    // FPS-002-03: store the ACTUAL template version id (not the template id).
    template_version_id: templateVersion.id,
    // FPS-004: carry the template layout config into the snapshot.
    layout: (templateVersion.layout as Record<string, unknown>) ?? null,
    // FPS-006: carry configured volumes (empty if none).
    volumes: volumeRows ?? [],
  };
}

// ═══════════════════════════════════════════════════════════
// Block content resolution (explicit block_key mapping)
// ═══════════════════════════════════════════════════════════

/**
 * Resolves content for a single block based on its block_key.
 * Uses explicit mapping — NO title heuristics.
 */
function resolveBlockContent(
  blockKey: string,
  def: BlockLibraryRow,
  td: Record<string, any>,
  tender: Record<string, any>,
  clauses: ClauseEntry[],
  scenarioId: string | undefined,
  warnings: string[],
): BlockContent {
  switch (blockKey) {
    // ── Cover page ──────────────────────────────────────
    case "cover.hero":
      return resolveCover(td, tender);

    // ── Confidentiality ─────────────────────────────────
    case "confidentiality.locked":
      return resolveConfidentiality(td, tender);

    // ── Narrative / Introduction ─────────────────────────
    case "intro.narrative":
      return resolveNarrative(td, "introduction");

    // ── Scope of services ───────────────────────────────
    case "scope.list":
      return resolveNarrative(td, "scope");

    // ── Scope table (data-bound) ────────────────────────
    case "scope.table":
      return resolveScopeTable(td);

    // ── Facility gallery ────────────────────────────────
    case "facility.gallery":
      return resolveFacilityGallery(td, tender);

    // ── Pricing — single option ─────────────────────────
    case "pricing.table.single":
      return resolvePricing(td, scenarioId, "single", warnings);

    // ── Pricing — multi option ──────────────────────────
    case "pricing.table.multi_option":
      return resolvePricing(td, scenarioId, "multi", warnings);

    // ── Pricing — bilingual with VAT ────────────────────
    case "quote.pricing.vat_bilingual":
      return resolvePricing(td, scenarioId, "bilingual_vat", warnings);

    // ── Totals in words ─────────────────────────────────
    case "totals.number_to_words":
      return resolveTotals(td, scenarioId);

    // ── Terms & conditions ──────────────────────────────
    case "terms.standard":
      return resolveClauses(clauses);

    // ── Closing note ────────────────────────────────────
    case "closing.note":
      return resolveNarrative(td, "closing");

    // ── Signature block ─────────────────────────────────
    case "signature.dual":
      return resolveSignature(td, tender);

    // ── Legal — party details ───────────────────────────
    case "legal.party_details":
      return resolvePartyDetails(td, tender);

    // ── Legal — TOC (auto) ──────────────────────────────
    case "legal.toc.auto":
      return { source_status: "default", toc_entries: [] };

    // ── Legal — clauses ─────────────────────────────────
    case "legal.clauses.locked":
      return resolveClauses(clauses);

    // ── Annexure A — config ─────────────────────────────
    case "annexure.a.config":
      return resolveNarrative(td, "annexure_config");

    // ── Annexure B — SLA matrix ─────────────────────────
    case "annexure.b.sla_matrix":
      return resolveSlaMatrix(td, warnings);

    // ── Annexure C — rate card ──────────────────────────
    case "annexure.c.rate_card":
      return resolvePricing(td, scenarioId, "rate_card", warnings);

    // ── Annexure D — communication matrix ───────────────
    case "annexure.d.communication_matrix":
      return resolveNarrative(td, "communication_matrix");

    default:
      warnings.push(`No content resolver for block_key: ${blockKey}`);
      return {
        html: def.default_content,
        source_status: "default",
      };
  }
}

// ═══════════════════════════════════════════════════════════
// Individual block resolvers
// ═══════════════════════════════════════════════════════════

function resolveCover(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const tenderMeta = safeObject(td.tender);
  const title = tender.ticket_title || safeString(tenderMeta.title) || "Not available";
  const customerName = tender.customer_name || safeString(tenderMeta.customerName) || "Not available";
  const tenderRef = safeString(tenderMeta.tenderRef) || (tender.id ? String(tender.id).slice(0, 8) : "—");
  const date = tender.target_date || safeString(tenderMeta.submissionDeadline) || new Date().toLocaleDateString("en-GB");

  return {
    variables: {
      title,
      subtitle: `Ref: ${tenderRef}`,
      customer_name: customerName,
      ref_number: tenderRef,
      date,
    },
    source_status: "populated",
  };
}

function resolveConfidentiality(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      company_name: "Hala Supply Chain Services",
      recipient_name: customerName,
    },
    source_status: "populated",
  };
}

function resolveNarrative(
  td: Record<string, any>,
  section: string,
): BlockContent {
  const drafting = safeObject(td.tender_drafting);
  const proposalBlocks: any[] = Array.isArray(drafting.proposal_blocks)
    ? drafting.proposal_blocks
    : [];

  // Match proposal blocks by section type using explicit block_key patterns
  const sectionMatchers: Record<string, (block: any) => boolean> = {
    introduction: (b) => {
      const key = safeString(b.block_key || b.section_key).toLowerCase();
      const title = safeString(b.title).toLowerCase();
      return key === "introduction" || key === "intro" ||
        title.includes("introduction") || title.includes("executive summary");
    },
    scope: (b) => {
      const key = safeString(b.block_key || b.section_key).toLowerCase();
      const title = safeString(b.title).toLowerCase();
      return key === "scope" || key === "scope_of_services" ||
        title.includes("scope of service") || title.includes("scope of work");
    },
    closing: (b) => {
      const key = safeString(b.block_key || b.section_key).toLowerCase();
      const title = safeString(b.title).toLowerCase();
      return key === "closing" || key === "closing_note" || key === "conclusion" ||
        title.includes("closing") || title.includes("next steps") || title.includes("conclusion");
    },
    annexure_config: (b) => {
      const key = safeString(b.block_key || b.section_key).toLowerCase();
      const title = safeString(b.title).toLowerCase();
      return key.includes("annexure") || key.includes("config") ||
        title.includes("service configuration") || title.includes("annexure a");
    },
    communication_matrix: (b) => {
      const key = safeString(b.block_key || b.section_key).toLowerCase();
      const title = safeString(b.title).toLowerCase();
      return key.includes("communication") || key.includes("escalation") ||
        title.includes("communication matrix") || title.includes("escalation");
    },
  };

  const matcher = sectionMatchers[section];
  if (!matcher) {
    return { html: undefined, source_status: "not_captured" };
  }

  const matched = proposalBlocks.find(matcher);
  if (!matched) {
    return { html: undefined, source_status: "not_captured" };
  }

  const html = extractProposalContent(matched);
  if (!html) {
    return { html: undefined, source_status: "not_captured" };
  }

  return { html, source_status: "populated" };
}

function resolveScopeTable(td: Record<string, any>): BlockContent {
  const sowData = safeObject(td.sow_data);
  const scopeItems = sowData.scope_items || sowData.deliverables || [];

  if (!Array.isArray(scopeItems) || scopeItems.length === 0) {
    return { html: undefined, source_status: "not_captured" };
  }

  // Build an HTML table from scope items
  let html = "<table><thead><tr><th>Item</th><th>Description</th><th>Deliverable</th></tr></thead><tbody>";
  for (const item of scopeItems) {
    const name = safeString(item.name || item.item);
    const desc = safeString(item.description);
    const deliverable = safeString(item.deliverable || item.output);
    html += `<tr><td>${name || "Not captured yet"}</td><td>${desc || "Not captured yet"}</td><td>${deliverable || "Not captured yet"}</td></tr>`;
  }
  html += "</tbody></table>";

  return { html, source_status: "populated" };
}

function resolveFacilityGallery(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      facility_name: "Hala Supply Chain Services",
      location: "Kingdom of Saudi Arabia",
      customer_name: customerName,
    },
    source_status: "default",
  };
}

function resolvePricing(
  td: Record<string, any>,
  scenarioId: string | undefined,
  format: "single" | "multi" | "bilingual_vat" | "rate_card",
  warnings: string[],
): BlockContent {
  const pricingData = safeObject(td.pricing);
  const scenarios = safeObject(pricingData.scenarios);
  const rows: any[] = Array.isArray(scenarios.rows) ? scenarios.rows : [];

  if (rows.length === 0) {
    warnings.push("No pricing scenarios found in tender data");
    return { pricing_rows: [], source_status: "not_captured" };
  }

  let selectedRows: any[];

  if (format === "single" && scenarioId) {
    // Use the specified scenario
    const match = rows.find((r: any) => r.id === scenarioId);
    selectedRows = match ? [match] : rows.slice(0, 1);
    if (!match) {
      warnings.push(`Pricing scenario ${scenarioId} not found, using first available`);
    }
  } else if (format === "single") {
    // Use selected scenario or first
    const selectedId = scenarios.selected_scenario?.selected_scenario_id;
    const match = selectedId ? rows.find((r: any) => r.id === selectedId) : null;
    selectedRows = match ? [match] : rows.slice(0, 1);
  } else {
    // Multi / bilingual / rate card — show all scenarios
    selectedRows = rows;
  }

  const pricingRows: PricingOutputRow[] = selectedRows.map((r: any) => ({
    id: safeString(r.id),
    scenario_name: safeString(r.scenario_name) || "Not captured yet",
    scenario_type: safeString(r.scenario_type) || "Not captured yet",
    revenue: safeString(r.revenue) || "Not captured yet",
    cost: safeString(r.cost) || "Not captured yet",
    gp_percent: safeString(r.gp_percent) || "Not captured yet",
    recommended: safeString(r.recommended) || "Not Assessed",
    notes: safeString(r.notes) || "",
  }));

  return { pricing_rows: pricingRows, source_status: "populated" };
}

function resolveTotals(
  td: Record<string, any>,
  scenarioId: string | undefined,
): BlockContent {
  const pricingData = safeObject(td.pricing);
  const scenarios = safeObject(pricingData.scenarios);
  const rows: any[] = Array.isArray(scenarios.rows) ? scenarios.rows : [];

  if (rows.length === 0) {
    return {
      variables: {
        total_amount: "Not captured yet",
        total_in_words: "Not captured yet",
        currency: "SAR",
      },
      source_status: "not_captured",
    };
  }

  // Find the relevant scenario
  let scenario: any;
  if (scenarioId) {
    scenario = rows.find((r: any) => r.id === scenarioId) || rows[0];
  } else {
    const selectedId = scenarios.selected_scenario?.selected_scenario_id;
    scenario = selectedId ? rows.find((r: any) => r.id === selectedId) || rows[0] : rows[0];
  }

  const revenue = safeString(scenario.revenue);
  const amount = parseFloat(revenue) || 0;

  return {
    variables: {
      total_amount: amount > 0 ? formatSAR(amount) : "Not captured yet",
      total_in_words: amount > 0 ? numberToWords(amount) + " Saudi Riyals" : "Not captured yet",
      currency: "SAR",
    },
    source_status: amount > 0 ? "populated" : "not_captured",
  };
}

function resolveClauses(clauses: ClauseEntry[]): BlockContent {
  if (clauses.length === 0) {
    return { clauses: [], source_status: "not_captured" };
  }
  return { clauses, source_status: "populated" };
}

function resolveSignature(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      hala_signatory: "",
      hala_title: "",
      client_signatory: "",
      client_title: "",
      hala_company: "Hala Supply Chain Services",
      client_company: customerName,
    },
    source_status: "populated",
  };
}

function resolvePartyDetails(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      first_party_name: "Hala Supply Chain Services Company",
      first_party_cr: "",
      first_party_address: "Kingdom of Saudi Arabia",
      second_party_name: customerName,
      second_party_cr: "",
      second_party_address: "",
    },
    source_status: "populated",
  };
}

function resolveSlaMatrix(
  td: Record<string, any>,
  warnings: string[],
): BlockContent {
  const solutionDesign = safeObject(td.solution_design_data);
  const slaData = safeObject(solutionDesign.sla_kpi);
  const kpis: any[] = Array.isArray(slaData.rows)
    ? slaData.rows
    : Array.isArray(slaData.kpis)
      ? slaData.kpis
      : [];

  if (kpis.length === 0) {
    warnings.push("No SLA/KPI data found in tender solution design");
    return { sla_rows: [], source_status: "not_captured" };
  }

  const slaRows: SlaOutputRow[] = kpis.map((kpi: any) => ({
    kpi: safeString(kpi.kpi || kpi.name) || "Not captured yet",
    target: safeString(kpi.target) || "Not captured yet",
    measurement: safeString(kpi.measurement) || "Not captured yet",
    penalty: safeString(kpi.penalty) || "Not captured yet",
  }));

  return { sla_rows: slaRows, source_status: "populated" };
}

// ═══════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════

/** Extract content from a proposal block using priority chain */
function extractProposalContent(block: any): string | undefined {
  const content =
    block.content_html ||
    block.editor_content ||
    block.draft_content ||
    block.content_text;

  if (!content || typeof content !== "string") return undefined;
  return content;
}

/** Compute SHA-256 hash of stable-stringified data */
async function computeSourceHash(data: Record<string, unknown>): Promise<string> {
  const stableJson = stableJsonStringify(data);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(stableJson));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Safe object accessor */
function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/** Safe string accessor */
function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

/** Format number as SAR currency */
function formatSAR(amount: number): string {
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Basic number-to-words for SAR amounts (English) */
function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + convert(n % 1000000) : "");
    return convert(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 ? " " + convert(n % 1000000000) : "");
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let result = convert(intPart);
  if (decPart > 0) {
    result += ` and ${convert(decPart)} Halalas`;
  }
  return result;
}

/** Create error snapshot */
function errorSnapshot(
  tenderId: string,
  packType: PackType,
  templateId: string,
  error: string,
): BlockSnapshot {
  return {
    blocks: [],
    tender_id: tenderId,
    tender_title: "Not available",
    customer_name: "Not available",
    pack_type: packType,
    template_id: templateId,
    template_name: "",
    source_hash: "",
    pricing_scenario_id: null,
    snapshot_at: new Date().toISOString(),
    source_data: {},
    warnings: [],
    error,
  };
}
