/**
 * AI Runs — Persistence layer for AI generation traceability
 * Sprint 10: Editor AI Pop-up + Bot Selector + Transcript Document Bots
 *
 * Tracks every AI generation action with full audit trail:
 *   - Which bot, which doc, which block(s)
 *   - Input prompt, transcript reference, output text
 *   - Status lifecycle: draft → applied | discarded
 *   - Timestamps for creation and application
 */

import { syncAuditEntry } from "@/lib/supabase-sync";
import { getCurrentUser } from "@/lib/auth-state";
import { generateAI, type AIProviderName } from "@/lib/ai-client";
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
// MOCK EDITOR BOTS — Block + Document types
// ============================================================

export const editorBots: EditorBot[] = [
  // Block bots
  {
    id: "ebot-proposal-writer",
    name: "Proposal Section Writer",
    bot_type: "block",
    provider: "openai",
    model: "gpt-4o",
    system_prompt: "You are a commercial proposal writer for Hala Supply Chain Services, a leading 3PL provider in Saudi Arabia. Write professional, client-focused content for the specified section. Use Hala brand voice — solution-oriented, confident, specific. Reference operational capabilities when relevant. Output HTML-formatted text suitable for a TipTap editor.",
    knowledge_base_refs: ["kb-1", "kb-4"],
    allowed_doc_types: ["proposal", "quote"],
    allowed_block_types: null,
    enabled: true,
    description: "Writes professional proposal sections using Hala brand voice and knowledge base",
    icon: "PenTool",
  },
  {
    id: "ebot-sla-clause-writer",
    name: "SLA Clause Drafter",
    bot_type: "block",
    provider: "openai",
    model: "gpt-4o",
    system_prompt: "You are an SLA clause drafting assistant for Hala Supply Chain Services. Draft clear, enforceable SLA clauses with specific KPIs, measurement methods, penalty structures, and escalation procedures. Follow Saudi commercial law conventions. Output HTML-formatted text.",
    knowledge_base_refs: ["kb-2"],
    allowed_doc_types: ["sla"],
    allowed_block_types: null,
    enabled: true,
    description: "Drafts SLA clauses with KPIs, penalties, and escalation procedures",
    icon: "Shield",
  },
  {
    id: "ebot-executive-summary",
    name: "Executive Summary Generator",
    bot_type: "block",
    provider: "openai",
    model: "gpt-4o-mini",
    system_prompt: "You generate concise executive summaries for commercial documents. Summarize the key value proposition, scope of services, commercial terms, and expected outcomes in 2-3 paragraphs. Use professional business English. Output HTML-formatted text.",
    knowledge_base_refs: ["kb-1", "kb-3"],
    allowed_doc_types: ["proposal", "quote", "sla"],
    allowed_block_types: ["intro.narrative", "intro.executive_summary"],
    enabled: true,
    description: "Generates concise executive summaries from document context",
    icon: "FileText",
  },
  {
    id: "ebot-legal-clause",
    name: "Legal Clause Assistant",
    bot_type: "block",
    provider: "google",
    model: "gemini-1.5-pro",
    system_prompt: "You are a legal clause drafting assistant specializing in Saudi Arabian commercial contracts for logistics and supply chain services. Draft legally sound clauses covering liability, indemnification, force majeure, dispute resolution, and governing law. Follow KSA commercial law. Output HTML-formatted text.",
    knowledge_base_refs: ["kb-2"],
    allowed_doc_types: ["proposal", "sla", "msa"],
    allowed_block_types: ["legal.terms", "legal.liability", "legal.governing_law"],
    enabled: true,
    description: "Drafts legal clauses following Saudi commercial law conventions",
    icon: "Scale",
  },
  // Document bots
  {
    id: "ebot-transcript-filler",
    name: "Transcript → Document Filler",
    bot_type: "document",
    provider: "openai",
    model: "gpt-4o",
    system_prompt: "You are a document assembly assistant. Given a meeting transcript and a document structure with existing blocks, extract relevant information from the transcript and generate content for each block. Return a JSON array of objects with {block_id, block_key, block_name, suggested_text} for each block that should be updated. The suggested_text must be HTML-formatted. Only include blocks where the transcript contains relevant information. Preserve existing content for blocks not mentioned in the transcript.",
    knowledge_base_refs: ["kb-1", "kb-3", "kb-4"],
    allowed_doc_types: ["proposal", "quote", "sla"],
    allowed_block_types: null,
    enabled: true,
    description: "Fills document blocks from meeting transcripts — extracts and maps content automatically",
    icon: "FileText",
  },
  {
    id: "ebot-legal-reviewer",
    name: "Legal Review Pass",
    bot_type: "document",
    provider: "openai",
    model: "gpt-4o",
    system_prompt: "You are a legal review assistant for commercial documents. Review all blocks for legal risks, ambiguous language, missing protections, and compliance issues under Saudi commercial law. For each block that needs attention, suggest improved text. Return a JSON array of objects with {block_id, block_key, block_name, suggested_text} for blocks that need legal improvements. Only include blocks that require changes.",
    knowledge_base_refs: ["kb-2"],
    allowed_doc_types: ["proposal", "sla", "msa"],
    allowed_block_types: null,
    enabled: true,
    description: "Reviews all document blocks for legal risks and suggests improvements",
    icon: "Shield",
  },
  {
    id: "ebot-spellcheck",
    name: "Spellcheck & Grammar Pass",
    bot_type: "document",
    provider: "google",
    model: "gemini-1.5-flash",
    system_prompt: "You are a proofreading assistant. Review all document blocks for spelling errors, grammar issues, inconsistent formatting, and style problems. For each block that needs corrections, provide the corrected text. Return a JSON array of objects with {block_id, block_key, block_name, suggested_text} for blocks that need corrections. Preserve HTML formatting. Only include blocks that have actual errors.",
    knowledge_base_refs: [],
    allowed_doc_types: ["proposal", "quote", "sla", "msa", "service_order_transport", "service_order_warehouse"],
    allowed_block_types: null,
    enabled: true,
    description: "Checks spelling, grammar, and formatting across all document blocks",
    icon: "CheckCircle",
  },
  {
    id: "ebot-rewriter",
    name: "Full Document Rewriter",
    bot_type: "document",
    provider: "openai",
    model: "gpt-4o",
    system_prompt: "You are a professional document rewriter for Hala Supply Chain Services. Rewrite all document blocks to improve clarity, professionalism, and persuasiveness while maintaining the original meaning and structure. Use Hala brand voice. Return a JSON array of objects with {block_id, block_key, block_name, suggested_text} for every block with improved text. The suggested_text must be HTML-formatted.",
    knowledge_base_refs: ["kb-1", "kb-4"],
    allowed_doc_types: ["proposal", "quote"],
    allowed_block_types: null,
    enabled: true,
    description: "Rewrites all blocks for improved clarity and professionalism",
    icon: "RefreshCw",
  },
];

// ============================================================
// SUPABASE-BACKED STORE (with in-memory fallback)
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
    // Cache the result even if empty — empty is a valid state (admin disabled all bots)
    _botCache = live;
    _botCacheTime = Date.now();
    return live;
  } catch (err) {
    console.warn('[ai-runs] loadBots Supabase fallback:', err);
    // Only fall back to hardcoded bots on actual network/DB error
    if (_botCache !== null) return _botCache; // use stale cache if available
    return editorBots; // hardcoded fallback as last resort
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

export async function getBlockBots(docType: string): Promise<EditorBot[]> {
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

  // 2. Call real AI via Edge Functions — throws on failure, no silent fallback
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
    systemPrompt: bot.system_prompt,
    userPrompt,
    temperature: 0.7,
    action: "block_generate",
  });

  // 3. Create bot_run trace
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
    output: { text: result.content },
    status: "draft",
  });

  const citations = extractCitationsFromChunks(retrievedChunks);

  return {
    content: result.content,
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
