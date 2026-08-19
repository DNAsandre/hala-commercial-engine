/**
 * AI Runs — Persistence layer for AI generation traceability
 * Sprint 10: Editor AI Pop-up + Bot Selector + Transcript Document Bots
 *
 * All bots are governed through the Admin Panel:
 *  - editor_bots (Supabase table) — managed via EditorBotBuilder admin page
 *  - ai_bots + ai_bot_versions — managed via Bot Builder (new governed system)
 *
 * GOVERNANCE RULE: No hardcoded bots. No in-memory fallback arrays.
 * If a bot is not in Supabase, it does not exist. Period.
 *
 * SC-01 CLEAN BUILD: AI execution and AI-run recording are EXCLUDED
 * (SX-001/SX-011). This module provides bot-metadata reads and historical
 * run display only; generation and run mutations refuse with explicit errors.
 */

import { supabase } from "@/lib/supabase";

interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  collection_name: string;
  chunk_index: number;
  content: string;
  relevance_score: number;
}

// SC-01 WAVE 02 BOUNDARY (SX-001 / SX-011): AI execution and AI-run recording
// are excluded from this build. This module keeps bot METADATA reads (display
// of governed bot records) and refuses generation and run-lifecycle mutation
// with explicit errors. No ai-client import, no local run mirror, no audit
// entries claiming actions that did not happen.

const AI_UNAVAILABLE =
  "AI generation is not available in this build (deferred to Sprint X — SX-001/SX-011).";
const AI_RUN_UNAVAILABLE =
  "AI-run recording is not available in this build (deferred to Sprint X — SX-011).";

/** Display-only lookup: provider_id → provider name from the established ai_providers table. */
async function resolveProviderName(providerId: string | null | undefined): Promise<"openai" | "google"> {
  if (!providerId) return "openai";
  try {
    const { data } = await supabase.from("ai_providers").select("id,name").eq("id", providerId).limit(1);
    const name = data?.[0]?.name;
    return name === "google" ? "google" : "openai";
  } catch {
    return "openai";
  }
}

// ============================================================
// TYPES
// ============================================================

export type AIRunStatus = "draft" | "applied" | "discarded";
export type AIRunScope = "block" | "document";
export type EditorBotType = "block" | "document";
export type DocumentRunMode = "fill_missing" | "rewrite_all" | "legal_review" | "spellcheck";

export interface AIRun {
  id: string;
  doc_instance_id: string;
  workspace_id: string | null;
  bot_id: string;
  bot_name: string;
  bot_type: EditorBotType;
  target_scope: AIRunScope;
  target_block_ids: string[];
  input_prompt: string;
  input_transcript_ref: string | null;
  output_text: string; // plain text for block, JSON string for document multi-block
  status: AIRunStatus;
  provider: string;
  model: string;
  run_mode: DocumentRunMode | null;
  created_by: string;
  created_at: string;
  applied_at: string | null;
}

export interface EditorBot {
  id: string;
  name: string;
  bot_type: EditorBotType;
  provider: "openai" | "google";
  model: string;
  system_prompt: string;
  knowledge_base_refs: string[];
  allowed_doc_types: string[]; // quote, proposal, sla, msa, etc.
  allowed_block_types: string[] | null; // null = all block types
  enabled: boolean;
  description: string;
  icon: string; // lucide icon name
}

export interface DocumentBlockSuggestion {
  block_id: string;
  block_key: string;
  block_name: string;
  original_text: string;
  suggested_text: string;
  selected: boolean;
  citations?: { source: string; chunkIndex: number; snippet: string }[];
}

export interface BlockGenerateResult {
  content: string;
  tokens_input: number;
  tokens_output: number;
  retrieved_chunks: RetrievedChunk[];
  citations: { source: string; chunkIndex: number; snippet: string }[];
}

// ============================================================
// SUPABASE-BACKED STORE — All bots come from the database.
// Admin Panel (EditorBotBuilder) manages editor_bots.
// Bot Builder manages ai_bots + ai_bot_versions.
// GOVERNANCE: No hardcoded bots. No in-memory bot arrays.
// ============================================================

import { fetchEditorBots, fetchAIRuns as dbFetchAIRuns } from "./supabase-data";

// Local cache for bots (refreshed on first access)
let _botCache: EditorBot[] | null = null;
let _botCacheTime = 0;
const BOT_CACHE_TTL = 30_000; // 30 seconds

async function loadBots(): Promise<EditorBot[]> {
  if (_botCache !== null && Date.now() - _botCacheTime < BOT_CACHE_TTL) return _botCache;
  try {
    const live = await fetchEditorBots();
    // Empty is a valid state — admin has no bots configured yet
    _botCache = live;
    _botCacheTime = Date.now();
    return live;
  } catch (err) {
    console.error('[ai-runs] loadBots: Supabase unavailable. Returning empty — bots must be configured in Admin Panel.', err);
    // Return stale cache if available; otherwise empty. NO hardcoded fallback.
    return _botCache ?? [];
  }
}

/** Force-refresh the bot cache (call after CRUD on editor_bots) */
export function invalidateBotCache(): void {
  _botCache = null;
  _botCacheTime = 0;
}

// ============================================================
// CRUD OPERATIONS (Supabase-backed with local mirror)
// ============================================================

export function createAIRun(params: Omit<AIRun, "id" | "created_at" | "applied_at" | "status">): AIRun {
  // SX-011: no run construction, no local mirror, no audit entry, no write.
  void params;
  throw new Error(AI_RUN_UNAVAILABLE);
}

export function applyAIRun(runId: string): void {
  // SX-011: no local status change, no write, no audit entry.
  void runId;
  throw new Error(AI_RUN_UNAVAILABLE);
}

export function discardAIRun(runId: string): void {
  // SX-011: no local status change, no write, no audit entry.
  void runId;
  throw new Error(AI_RUN_UNAVAILABLE);
}

export async function getAIRunsForDocument(docInstanceId: string): Promise<AIRun[]> {
  // Read-only display of historical run records; errors surface to the caller.
  const dbRuns = await dbFetchAIRuns(docInstanceId);
  return [...dbRuns].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getAIRunById(runId: string): AIRun | null {
  // No local run store exists in this build (SX-011); nothing to resolve.
  void runId;
  return null;
}

// ============================================================
// BOT QUERY HELPERS (async — reads from DB with fallback)
// ============================================================

// Governed domains — these read from ai_bots (Bot Builder) instead of editor_bots
const GOVERNED_DOMAINS = ["tenders", "proposals", "documents"];

/**
 * Load a governed bot from ai_bots by display_name.
 * ONE SOURCE OF TRUTH: all bots come from Bot Builder (ai_bots table).
 * Returns the bot with its latest version's system prompt resolved.
 * Works for both 'action' and 'monitor' bot types.
 *
 * IMPORTANT: Returns null (with console error) if:
 * - Bot not found by name
 * - Bot has no published version
 * - Bot version has an empty system prompt
 */
export async function loadGovernedBotByName(
  botName: string,
): Promise<{ id: string; name: string; provider: "openai" | "google"; model: string; system_prompt: string } | null> {
  try {
    // Query by display_name first, then fallback to name
    // NOTE: cannot use .or() with ilike because & in bot names breaks PostgREST filter parsing
    let { data: bots, error } = await supabase
      .from("ai_bots")
      .select("*, ai_bot_versions(*)")
      .eq("display_name", botName)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[ai-runs] loadGovernedBotByName query error:", error.message);
      return null;
    }

    // Fallback: try by name column if display_name didn't match
    if (!bots?.length) {
      const fallback = await supabase
        .from("ai_bots")
        .select("*, ai_bot_versions(*)")
        .eq("name", botName)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (fallback.error) {
        console.error("[ai-runs] loadGovernedBotByName fallback query error:", fallback.error.message);
        return null;
      }
      bots = fallback.data;
    }

    if (!bots?.length) {
      console.error(`[ai-runs] loadGovernedBotByName: NO BOT FOUND with name "${botName}". Check Bot Builder.`);
      return null;
    }

    const bot = bots[0];
    console.info(`[ai-runs] loadGovernedBotByName: Found bot "${bot.display_name || bot.name}" (id: ${bot.id}, status: ${bot.status})`);

    const versions = Array.isArray(bot.ai_bot_versions)
      ? [...bot.ai_bot_versions].sort((a: any, b: any) => (b.version || 0) - (a.version || 0))
      : [];

    console.info(`[ai-runs] loadGovernedBotByName: Bot has ${versions.length} version(s)`);

    if (versions.length === 0) {
      console.error(`[ai-runs] loadGovernedBotByName: Bot "${bot.display_name}" has NO PUBLISHED VERSIONS. Save the bot in Bot Builder to create a version.`);
      return null;
    }

    const latestVersion = versions[0] as any;

    // Resolve provider
    let providerName: "openai" | "google" = "openai";
    providerName = await resolveProviderName(latestVersion?.provider_id || bot.provider_id);

    // Build system prompt from version
    const systemParts = [
      latestVersion?.system_instruction,
      latestVersion?.custom_instruction,
      latestVersion?.knowledge_base_text
        ? `Knowledge Base:\n${latestVersion.knowledge_base_text}`
        : null,
    ].filter(Boolean);
    const systemPrompt = systemParts.join("\n\n") || "";

    console.info(`[ai-runs] loadGovernedBotByName: system_instruction length: ${(latestVersion?.system_instruction || "").length}, custom_instruction length: ${(latestVersion?.custom_instruction || "").length}, combined prompt length: ${systemPrompt.length}`);

    if (systemPrompt.length < 50) {
      console.error(`[ai-runs] loadGovernedBotByName: Bot "${bot.display_name}" has EMPTY or very short system prompt (${systemPrompt.length} chars). The bot will not produce useful results. Update Custom Instruction in Bot Builder.`);
      // Don't return null — let it fail visibly so the user knows
    }

    return {
      id: bot.id,
      name: bot.display_name || bot.name,
      provider: providerName,
      model: latestVersion?.model || bot.model || "gpt-4o",
      system_prompt: systemPrompt,
    };
  } catch (err) {
    console.error("[ai-runs] loadGovernedBotByName exception:", err);
    return null;
  }
}

/**
 * Load a governed bot from ai_bots + ai_bot_versions (Bot Builder system).
 * This is the ONLY path for tender AI generation.
 * Returns null if no active bot found for the domain.
 */
async function loadGovernedBot(domain: string): Promise<EditorBot | null> {
  try {
    const { data: bots, error } = await supabase
      .from("ai_bots")
      .select("*, ai_bot_versions(*)")
      .eq("status", "active")
      .eq("type", "action")
      .contains("domains_allowed", [domain])
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[ai-runs] loadGovernedBot query error:", error.message);
      return null;
    }
    if (!bots?.length) return null;

    // Pick first active bot, get its latest version
    const bot = bots[0];
    const versions = Array.isArray(bot.ai_bot_versions)
      ? [...bot.ai_bot_versions].sort((a: any, b: any) => (b.version || 0) - (a.version || 0))
      : [];
    const latestVersion = versions[0] as any;

    // Resolve provider name from provider_id
    let providerName: "openai" | "google" = "openai";
    providerName = await resolveProviderName(latestVersion?.provider_id || bot.provider_id);

    // Build system prompt: system_instruction + custom_instruction from the version
    const systemParts = [
      latestVersion?.system_instruction,
      latestVersion?.custom_instruction,
      latestVersion?.knowledge_base_text
        ? `Knowledge Base:\n${latestVersion.knowledge_base_text}`
        : null,
    ].filter(Boolean);
    const systemPrompt = systemParts.join("\n\n") || "You are a helpful commercial assistant for Hala Supply Chain Services.";

    return {
      id: bot.id,
      name: bot.display_name || bot.name,
      bot_type: "block",
      provider: providerName,
      model: latestVersion?.model || bot.model || "gpt-4o",
      system_prompt: systemPrompt,
      knowledge_base_refs: [],
      allowed_doc_types: bot.domains_allowed || [],
      allowed_block_types: null,
      enabled: true,
      description: bot.purpose || "",
      icon: "Bot",
    };
  } catch (err) {
    console.error("[ai-runs] loadGovernedBot exception:", err);
    return null;
  }
}

export async function getBlockBots(docType: string): Promise<EditorBot[]> {
  // For governed domains (tenders, proposals, documents), prefer Bot Builder (ai_bots)
  if (GOVERNED_DOMAINS.includes(docType)) {
    const bot = await loadGovernedBot(docType);
    if (bot) return [bot];
    // Bot Builder has no active bot for this domain yet — fall back to editor_bots.
    // This allows the seeded ebot-tender-proposal-writer to work until an admin
    // creates a dedicated bot in Bot Builder.
    // Normalize 'tenders' → 'tender' (editor_bots uses singular doc type).
    const legacyDocType = docType === "tenders" ? "tender" : docType;
    const bots = await loadBots();
    const fallback = bots.filter(b =>
      b.bot_type === "block" &&
      b.enabled &&
      b.allowed_doc_types.includes(legacyDocType)
    );
    if (fallback.length > 0) {
      console.info(`[ai-runs] getBlockBots(${docType}): no Bot Builder bot found, using editor_bots fallback (${fallback.map(b => b.id).join(", ")})`);
    }
    return fallback;
  }
  // For legacy doc types (quote, sla, msa), read from editor_bots
  const bots = await loadBots();
  return bots.filter(b =>
    b.bot_type === "block" &&
    b.enabled &&
    b.allowed_doc_types.includes(docType)
  );
}

export async function getDocumentBots(docType: string): Promise<EditorBot[]> {
  const bots = await loadBots();
  return bots.filter(b =>
    b.bot_type === "document" &&
    b.enabled &&
    b.allowed_doc_types.includes(docType)
  );
}

export async function getEditorBotById(botId: string): Promise<EditorBot | null> {
  // Try governed bot first (for tender bots created in Bot Builder)
  try {
    const { data: bot } = await supabase
      .from("ai_bots")
      .select("*, ai_bot_versions(*)")
      .eq("id", botId)
      .single();
    if (bot) {
      const versions = Array.isArray(bot.ai_bot_versions)
        ? [...bot.ai_bot_versions].sort((a: any, b: any) => (b.version || 0) - (a.version || 0))
        : [];
      const v = versions[0] as any;
      let providerName: "openai" | "google" = "openai";
      providerName = await resolveProviderName(v?.provider_id || bot.provider_id);
      return {
        id: bot.id,
        name: (bot as any).display_name || bot.name,
        bot_type: "block",
        provider: providerName,
        model: v?.model || (bot as any).model || "gpt-4o",
        system_prompt: [
          v?.system_instruction,
          v?.custom_instruction,
          v?.knowledge_base_text ? `Knowledge Base:\n${v.knowledge_base_text}` : null,
        ].filter(Boolean).join("\n\n") || "",
        knowledge_base_refs: [],
        allowed_doc_types: (bot as any).domains_allowed || [],
        allowed_block_types: null,
        enabled: (bot as any).status === "active",
        description: (bot as any).purpose || "",
        icon: "Bot",
      };
    }
  } catch { /* fall through to legacy lookup */ }
  // Fall back to editor_bots for legacy bots
  const bots = await loadBots();
  return bots.find(b => b.id === botId) || null;
}

// ============================================================
// DOCUMENT RUN MODE CONFIG
// ============================================================

export const DOCUMENT_RUN_MODES: { value: DocumentRunMode; label: string; description: string; icon: string }[] = [
  { value: "fill_missing", label: "Fill Missing Blocks", description: "Extract content from transcript and fill empty or incomplete blocks", icon: "FileText" },
  { value: "rewrite_all", label: "Rewrite All Blocks", description: "Rewrite all blocks for improved clarity and professionalism", icon: "RefreshCw" },
  { value: "legal_review", label: "Legal Review Pass", description: "Review all blocks for legal risks and suggest improvements", icon: "Shield" },
  { value: "spellcheck", label: "Spellcheck & Grammar", description: "Check spelling, grammar, and formatting across all blocks", icon: "CheckCircle" },
];


export async function generateBlockContent(
  botId: string,
  blockFamily: string,
  prompt: string,
  blockContent: string,
  transcript: string | null,
  docInstanceId?: string,
  workspaceId?: string,
): Promise<BlockGenerateResult> {
  // SX-001/SX-011: AI generation excluded from this build.
  void botId; void blockFamily; void prompt; void blockContent; void transcript; void docInstanceId; void workspaceId;
  throw new Error(AI_UNAVAILABLE);
}

export async function generateDocumentContent(
  botId: string,
  blocks: { id: string; key: string; name: string; content: string }[],
  prompt: string,
  transcript: string | null,
  runMode: DocumentRunMode,
): Promise<{ suggestions: DocumentBlockSuggestion[]; tokens_input: number; tokens_output: number }> {
  // SX-001/SX-011: AI generation excluded from this build.
  void botId; void blocks; void prompt; void transcript; void runMode;
  throw new Error(AI_UNAVAILABLE);
}

// ============================================================
// BOT CHAINING — Pipeline Configuration & Execution
// ============================================================

export interface BotChainConfig {
  next_bot_id: string | null;
  prompt_user: boolean;
  chain_label: string;
}

/**
 * Load chain config for a bot from its latest ai_bot_versions entry.
 * Returns null if no chain config is set.
 */
export async function getBotChainConfig(botId: string): Promise<BotChainConfig | null> {
  try {
    const { data: versions, error } = await supabase
      .from("ai_bot_versions")
      .select("chain_config")
      .eq("bot_id", botId)
      .order("version", { ascending: false })
      .limit(1);

    if (error || !versions?.length) return null;

    const cfg = versions[0].chain_config;
    if (!cfg || typeof cfg !== "object" || !cfg.next_bot_id) return null;

    return {
      next_bot_id: cfg.next_bot_id || null,
      prompt_user: cfg.prompt_user !== false, // default true
      chain_label: cfg.chain_label || "Auto-draft all blocks",
    };
  } catch {
    return null;
  }
}

export interface BlockChainProgress {
  current: number;
  total: number;
  blockTitle: string;
  status: "generating" | "completed" | "failed" | "cancelled";
}

export interface BlockChainResult {
  completed: number;
  failed: number;
  cancelled: boolean;
  results: Record<string, string>; // blockId → generated HTML content
}

/**
 * Auto-draft all blocks sequentially using the section writer bot.
 * Each block goes through generateBlockContent() which logs to the cost ledger.
 *
 * @param botId - The section writer bot ID
 * @param blocks - Array of blocks to generate (must have id, title, block_key, etc.)
 * @param tenderContext - Context string for the tender (built from workspace)
 * @param onProgress - Called after each block with progress info
 * @param abortSignal - Optional signal to cancel the pipeline
 */
export async function generateAllBlocksSequentially(
  botId: string,
  blocks: Array<{
    id: string;
    title: string;
    block_key: string;
    volume: string;
    section_name: string;
    source_stages: string;
    required_source_data: string;
    required_evidence: string;
    editor_content?: string;
    draft_content?: string;
  }>,
  tenderContext: string,
  onProgress: (progress: BlockChainProgress) => void,
  abortSignal?: AbortSignal,
): Promise<BlockChainResult> {
  // SX-001/SX-011: AI generation excluded from this build. Refuse before any
  // per-block progress is reported — no partial "attempted generation" theater.
  void botId; void blocks; void tenderContext; void onProgress; void abortSignal;
  throw new Error(AI_UNAVAILABLE);
}
