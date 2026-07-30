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
 *   AI execution  → Already wired to real providers via ai-client.ts
 *   AI runs       → Already persisted to Supabase `ai_runs` table
 *
 * DO NOT add more hardcoded bots. Add to Supabase `editor_bots` table.
 *
 * Tracks every AI generation action with full audit trail:
 *   - Which bot, which doc, which block(s)
 *   - Input prompt, transcript reference, output text
 *   - Status lifecycle: draft → applied | discarded
 *   - Timestamps for creation and application
 */

import { syncAuditEntry } from "@/lib/supabase-sync";
import { getCurrentUser } from "@/lib/auth-state";
import { generateAI, fetchAIProviders, type AIProviderName } from "@/lib/ai-client";
import { supabase } from "@/lib/supabase";
import {
  retrieveContext,
  formatRetrievedContext,
  createBotRun,
  type RetrievedChunk,
} from "@/lib/knowledgebase";

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

import {
  fetchEditorBots, insertAIRun as dbInsertAIRun,
  updateAIRunStatus as dbUpdateAIRunStatus, fetchAIRuns as dbFetchAIRuns,
} from "./supabase-data";

// Local cache for bots (refreshed on first access)
let _botCache: EditorBot[] | null = null;
let _botCacheTime = 0;
const BOT_CACHE_TTL = 30_000; // 30 seconds

// In-memory fallback for AI runs (used if DB insert fails)
let aiRunsFallback: AIRun[] = [];

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
  const run: AIRun = {
    ...params,
    id: `airun-${crypto.randomUUID()}`,
    status: "draft",
    created_at: new Date().toISOString(),
    applied_at: null,
  };

  // Always keep a local copy (survives even if DB insert fails)
  aiRunsFallback.push(run);

  // Persist to Supabase in parallel — warn on failure, don't swallow
  dbInsertAIRun(run).catch((err) => {
    console.warn("[ai-runs] DB insert failed, run preserved in local memory:", err);
  });

  // Audit log
  const user = getCurrentUser();
  void syncAuditEntry({
    id: crypto.randomUUID(),
    timestamp: run.created_at,
    userId: user?.id || "system",
    userName: user?.name || "System",
    action: "ai_draft_created",
    entityType: "ai_run",
    entityId: run.id,
    details: `AI draft created by ${run.bot_name} (${run.bot_type}) for ${run.target_scope === "block" ? `block ${run.target_block_ids[0]}` : `document ${run.doc_instance_id}`}`,
    metadata: {
      bot_id: run.bot_id,
      bot_name: run.bot_name,
      provider: run.provider,
      model: run.model,
      doc_instance_id: run.doc_instance_id,
      target_scope: run.target_scope,
      target_block_ids: run.target_block_ids,
      run_mode: run.run_mode,
    },
  }).catch((err) => { console.warn('[ai-runs] createAIRun audit fallback:', err); });

  return run;
}

export function applyAIRun(runId: string): void {
  const appliedAt = new Date().toISOString();

  // Update local mirror immediately (always available)
  const local = aiRunsFallback.find(r => r.id === runId);
  if (local) { local.status = "applied"; local.applied_at = appliedAt; }

  // Persist to Supabase
  dbUpdateAIRunStatus(runId, "applied", appliedAt).catch((err) => {
    console.warn("[ai-runs] DB status update failed for apply:", err);
  });

  // Audit log
  const user = getCurrentUser();
  void syncAuditEntry({
    id: crypto.randomUUID(),
    timestamp: appliedAt,
    userId: user?.id || "system",
    userName: user?.name || "System",
    action: "ai_draft_applied",
    entityType: "ai_run",
    entityId: runId,
    details: `AI draft applied: run ${runId} committed`,
    metadata: { run_id: runId },
  }).catch((err) => { console.warn('[ai-runs] applyAIRun audit fallback:', err); });
}

export function discardAIRun(runId: string): void {
  // Update local mirror immediately
  const local = aiRunsFallback.find(r => r.id === runId);
  if (local) local.status = "discarded";

  // Persist to Supabase
  dbUpdateAIRunStatus(runId, "discarded").catch((err) => {
    console.warn("[ai-runs] DB status update failed for discard:", err);
  });

  // Audit log
  const user = getCurrentUser();
  void syncAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: user?.id || "system",
    userName: user?.name || "System",
    action: "ai_draft_discarded",
    entityType: "ai_run",
    entityId: runId,
    details: `AI draft discarded: run ${runId} rejected`,
    metadata: { run_id: runId },
  }).catch((err) => { console.warn('[ai-runs] discardAIRun audit fallback:', err); });
}

export async function getAIRunsForDocument(docInstanceId: string): Promise<AIRun[]> {
  try {
    const dbRuns = await dbFetchAIRuns(docInstanceId);
    // Merge: DB runs + any local-only runs not yet persisted
    const dbIds = new Set(dbRuns.map(r => r.id));
    const localOnly = aiRunsFallback.filter(r => r.doc_instance_id === docInstanceId && !dbIds.has(r.id));
    const merged = [...dbRuns, ...localOnly].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return merged;
  } catch (err) {
    console.warn('[ai-runs] getAIRunsForDocument Supabase fallback:', err);
    // DB unavailable — return local-only
    return aiRunsFallback.filter(r => r.doc_instance_id === docInstanceId).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

export function getAIRunById(runId: string): AIRun | null {
  return aiRunsFallback.find(r => r.id === runId) || null;
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
    try {
      const providers = await fetchAIProviders();
      const matched = providers.find(p => p.id === (latestVersion?.provider_id || bot.provider_id));
      if (matched?.name) providerName = matched.name as "openai" | "google";
    } catch { /* keep default */ }

    // Build system prompt from version
    const systemParts = [
      latestVersion?.system_instruction,
      latestVersion?.custom_instruction,
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
    try {
      const providers = await fetchAIProviders();
      const matched = providers.find(p => p.id === (latestVersion?.provider_id || bot.provider_id));
      if (matched?.name) providerName = matched.name as "openai" | "google";
    } catch { /* keep default */ }

    // Build system prompt: system_instruction + custom_instruction from the version
    const systemParts = [
      latestVersion?.system_instruction,
      latestVersion?.custom_instruction,
    ].filter(Boolean);
    const systemPrompt = systemParts.join("\n\n") || "You are a helpful commercial assistant for Hala Supply Chain Services.";

    return {
      id: bot.id,
      name: bot.display_name || bot.name,
      bot_type: "block",
      provider: providerName,
      model: latestVersion?.model || bot.model || "gpt-4o",
      system_prompt: systemPrompt,
      knowledge_base_refs: latestVersion?.knowledge_base_ids || [],
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
      try {
        const providers = await fetchAIProviders();
        const matched = providers.find(p => p.id === (v?.provider_id || bot.provider_id));
        if (matched?.name) providerName = matched.name as "openai" | "google";
      } catch { /* keep default */ }
      return {
        id: bot.id,
        name: (bot as any).display_name || bot.name,
        bot_type: "block",
        provider: providerName,
        model: v?.model || (bot as any).model || "gpt-4o",
        system_prompt: [v?.system_instruction, v?.custom_instruction].filter(Boolean).join("\n\n") || "",
        knowledge_base_refs: v?.knowledge_base_ids || [],
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
  const bot = await getEditorBotById(botId);

  if (!bot) {
    throw new Error(`AI bot "${botId}" not found — check bot configuration`);
  }

  // 1. Retrieve KB context
  let retrievedChunks: RetrievedChunk[] = [];
  let kbContext = "";
  try {
    retrievedChunks = await retrieveContext(botId, prompt + " " + blockContent.replace(/<[^>]*>/g, "").substring(0, 200), 5);
    if (retrievedChunks.length > 0) {
      kbContext = formatRetrievedContext(retrievedChunks);
    }
  } catch (err) {
    console.warn("[ai-runs] KB retrieval failed:", (err as Error).message);
  }

  // 2. Build system prompt with mandatory HTML output directive
  const htmlDirective = `

OUTPUT FORMAT — MANDATORY:
You MUST output valid HTML only. Do NOT use markdown syntax.
- Use <h2> and <h3> for headings (never # or ##)
- Use <strong> for bold (never **)
- Use <em> for italics (never *)
- Use <ul><li> for bullet lists (never - or *)
- Use <ol><li> for numbered lists (never 1. 2. 3.)
- Use <table><thead><tbody><tr><th><td> for tables
- Use <p> for paragraphs
- Use <blockquote> for quotes
- Structure with clear section headings using <h2> and <h3>
- Number your sections in headings, e.g. <h2>1. Executive Summary</h2>
- Do NOT wrap output in \`\`\`html code fences
- Output raw HTML directly, starting with the first HTML tag`;

  const fullSystemPrompt = bot.system_prompt + htmlDirective;

  // 3. Call real AI via Edge Functions — throws on failure, no silent fallback
  const userPrompt = [
    prompt,
    blockContent ? `\n\nExisting block content:\n${blockContent.replace(/<[^>]*>/g, "")}` : "",
    transcript ? `\n\nTranscript reference:\n${transcript.substring(0, 3000)}` : "",
    kbContext ? `\n\nKnowledgebase context:\n${kbContext}` : "",
    retrievedChunks.length > 0 ? `\n\nIMPORTANT: Cite sources using [Source: DocumentTitle #ChunkIndex] format when using KB context.` : "",
  ].join("");

  const result = await generateAI({
    provider: bot.provider as AIProviderName,
    model: bot.model,
    systemPrompt: fullSystemPrompt,
    userPrompt,
    temperature: 0.7,
    action: "block_generate",
    botId: bot.id,
    botName: bot.name,
  });

  // Post-process: strip markdown code fences and convert stray markdown → HTML
  let cleanContent = result.content;
  // Strip ```html ... ``` wrappers
  cleanContent = cleanContent.replace(/^```html\s*/i, "").replace(/\s*```$/i, "");
  // Convert stray markdown headings → HTML (in case model ignores directive)
  cleanContent = cleanContent.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  cleanContent = cleanContent.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  cleanContent = cleanContent.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Convert stray **bold** → <strong>
  cleanContent = cleanContent.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Convert stray *italic* → <em>
  cleanContent = cleanContent.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  // Convert stray markdown bullets → list items (group consecutive lines)
  cleanContent = cleanContent.replace(/(?:^|\n)(?:- (.+)\n?)+/g, (match) => {
    const items = match.trim().split("\n").map(line => `<li>${line.replace(/^- /, "")}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  // 4. Create bot_run trace
  createBotRun({
    bot_id: botId,
    bot_name: bot.name,
    doc_instance_id: docInstanceId || null,
    workspace_id: workspaceId || null,
    scope: "block",
    target_block_ids: null,
    prompt,
    provider: bot.provider,
    model: bot.model,
    kb_collections: Array.from(new Set(retrievedChunks.map(c => c.collection_name))),
    retrieved_chunks: retrievedChunks,
    output: { text: cleanContent },
    status: "draft",
  });

  const citations = extractCitationsFromChunks(retrievedChunks);

  return {
    content: cleanContent,
    tokens_input: result.tokensInput,
    tokens_output: result.tokensOutput,
    retrieved_chunks: retrievedChunks,
    citations,
  };
}

function extractCitationsFromChunks(chunks: RetrievedChunk[]): { source: string; chunkIndex: number; snippet: string }[] {
  return chunks.slice(0, 5).map(c => ({
    source: c.document_title,
    chunkIndex: c.chunk_index,
    snippet: c.content.substring(0, 120),
  }));
}

export async function generateDocumentContent(
  botId: string,
  blocks: { id: string; key: string; name: string; content: string }[],
  prompt: string,
  transcript: string | null,
  runMode: DocumentRunMode,
): Promise<{ suggestions: DocumentBlockSuggestion[]; tokens_input: number; tokens_output: number }> {
  // Call real AI via Edge Functions — throws on failure, no silent fallback
  const bot = await getEditorBotById(botId);
  if (!bot) {
    throw new Error(`AI bot "${botId}" not found — check bot configuration`);
  }
  const blockSummary = blocks.map(b => `[${b.key}] ${b.name}: ${b.content.replace(/<[^>]*>/g, "").substring(0, 200)}`).join("\n");
  const userPrompt = [
    `Run mode: ${runMode}`,
    prompt ? `\nUser instructions: ${prompt}` : "",
    `\n\nDocument blocks:\n${blockSummary}`,
    transcript ? `\n\nTranscript:\n${transcript.substring(0, 5000)}` : "",
    `\n\nReturn a JSON array of objects: [{"block_id": "...", "block_key": "...", "block_name": "...", "suggested_text": "<html content>"}]`,
  ].join("");

  const result = await generateAI({
    provider: bot.provider as AIProviderName,
    model: bot.model,
    systemPrompt: bot.system_prompt,
    userPrompt,
    temperature: 0.5,
    action: `document_${runMode}`,
    botId: bot.id,
    botName: bot.name,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error("AI returned a response that could not be parsed — check provider output format");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a JSON array — check provider output format");
  }

  const suggestions: DocumentBlockSuggestion[] = (parsed as any[]).map((s) => {
    const matchBlock = blocks.find(b => b.id === s.block_id || b.key === s.block_key);
    return {
      block_id: s.block_id || matchBlock?.id || "",
      block_key: s.block_key || matchBlock?.key || "",
      block_name: s.block_name || matchBlock?.name || "",
      original_text: matchBlock?.content || "",
      suggested_text: s.suggested_text || "",
      selected: true,
    };
  }).filter((s: DocumentBlockSuggestion) => s.block_id && s.suggested_text);

  return {
    suggestions,
    tokens_input: result.tokensInput,
    tokens_output: result.tokensOutput,
  };
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
  const results: Record<string, string> = {};
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < blocks.length; i++) {
    // Check abort
    if (abortSignal?.aborted) {
      return { completed, failed, cancelled: true, results };
    }

    const block = blocks[i];
    onProgress({
      current: i + 1,
      total: blocks.length,
      blockTitle: block.title || block.block_key,
      status: "generating",
    });

    try {
      const prompt = [
        `## Block Metadata`,
        `Title: ${block.title || "Untitled"}`,
        `Volume: ${block.volume || "Not specified"}`,
        `Section: ${block.section_name || "Not specified"}`,
        `Source Stages: ${block.source_stages || "Not specified"}`,
        `Required Source Data: ${block.required_source_data || "Not specified"}`,
        `Required Evidence: ${block.required_evidence || "Not specified"}`,
        ``,
        tenderContext,
      ].join("\n");

      const existingContent = block.editor_content || block.draft_content || "";

      const result = await generateBlockContent(
        botId,
        "commercial",
        prompt,
        existingContent,
        null, // no transcript
      );

      results[block.id] = result.content;
      completed++;
      onProgress({
        current: i + 1,
        total: blocks.length,
        blockTitle: block.title || block.block_key,
        status: "completed",
      });
    } catch (err: any) {
      console.error(`[ai-runs] Chain: block "${block.title}" failed:`, err.message);
      failed++;
      onProgress({
        current: i + 1,
        total: blocks.length,
        blockTitle: block.title || block.block_key,
        status: "failed",
      });
    }
  }

  return { completed, failed, cancelled: false, results };
}
