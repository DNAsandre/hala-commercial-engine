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
// IN-MEMORY STORE
// ============================================================

let aiRuns: AIRun[] = [];

// ============================================================
// CRUD OPERATIONS
// ============================================================

export function createAIRun(params: Omit<AIRun, "id" | "created_at" | "applied_at" | "status">): AIRun {
  const run: AIRun = {
    ...params,
    id: `airun-${crypto.randomUUID()}`,
    status: "draft",
    created_at: new Date().toISOString(),
    applied_at: null,
  };
  aiRuns.push(run);

  // Audit log
  const user = getCurrentUser();
  syncAuditEntry({
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
  }).catch(() => {});

  return run;
}

export function applyAIRun(runId: string): AIRun | null {
  const run = aiRuns.find(r => r.id === runId);
  if (!run || run.status !== "draft") return null;

  run.status = "applied";
  run.applied_at = new Date().toISOString();

  const user = getCurrentUser();
  syncAuditEntry({
    id: crypto.randomUUID(),
    timestamp: run.applied_at,
    userId: user?.id || "system",
    userName: user?.name || "System",
    action: "ai_draft_applied",
    entityType: "ai_run",
    entityId: run.id,
    details: `AI draft applied: ${run.bot_name} output committed to ${run.target_scope === "block" ? `block ${run.target_block_ids[0]}` : `${run.target_block_ids.length} blocks in document ${run.doc_instance_id}`}`,
    metadata: {
      bot_id: run.bot_id,
      provider: run.provider,
      model: run.model,
      doc_instance_id: run.doc_instance_id,
      target_block_ids: run.target_block_ids,
    },
  }).catch(() => {});

  return run;
}

export function discardAIRun(runId: string): AIRun | null {
  const run = aiRuns.find(r => r.id === runId);
  if (!run || run.status !== "draft") return null;

  run.status = "discarded";

  const user = getCurrentUser();
  syncAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: user?.id || "system",
    userName: user?.name || "System",
    action: "ai_draft_discarded",
    entityType: "ai_run",
    entityId: run.id,
    details: `AI draft discarded: ${run.bot_name} output rejected for ${run.target_scope === "block" ? `block ${run.target_block_ids[0]}` : `document ${run.doc_instance_id}`}`,
    metadata: {
      bot_id: run.bot_id,
      doc_instance_id: run.doc_instance_id,
    },
  }).catch(() => {});

  return run;
}

export function getAIRunsForDocument(docInstanceId: string): AIRun[] {
  return aiRuns.filter(r => r.doc_instance_id === docInstanceId).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getAIRunById(runId: string): AIRun | null {
  return aiRuns.find(r => r.id === runId) || null;
}

// ============================================================
// BOT QUERY HELPERS
// ============================================================

export function getBlockBots(docType: string): EditorBot[] {
  return editorBots.filter(b =>
    b.bot_type === "block" &&
    b.enabled &&
    b.allowed_doc_types.includes(docType)
  );
}

export function getDocumentBots(docType: string): EditorBot[] {
  return editorBots.filter(b =>
    b.bot_type === "document" &&
    b.enabled &&
    b.allowed_doc_types.includes(docType)
  );
}

export function getEditorBotById(botId: string): EditorBot | null {
  return editorBots.find(b => b.id === botId) || null;
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

// ============================================================
// MOCK AI GENERATION (simulates Edge Function call)
// ============================================================

const BLOCK_MOCK_RESPONSES: Record<string, string> = {
  "commercial": "<p><strong>[AI GENERATED — Commercial Section]</strong></p><p>We are delighted to propose a tailored cold-chain logistics partnership designed to meet your organization's exacting standards. Our integrated warehousing and distribution network spans 12 strategically located facilities across the Kingdom, offering ambient, chilled (+2°C to +8°C), and frozen (−18°C to −25°C) storage zones with 24/7 temperature monitoring and automated alert systems.</p><p>This proposal outlines a comprehensive scope of services including inbound receiving, quality inspection, WMS-integrated inventory management, order fulfillment, and last-mile delivery — all backed by dedicated account management and real-time visibility dashboards.</p>",
  "legal": "<p><strong>[AI GENERATED — Legal Clause]</strong></p><p>This Agreement shall be governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia. Any dispute arising out of or in connection with this Agreement shall be referred to arbitration under the Rules of the Saudi Center for Commercial Arbitration (SCCA), conducted in Riyadh in the Arabic language. The arbitral tribunal shall consist of a sole arbitrator.</p><p>Neither party shall be liable for any failure to perform due to circumstances beyond reasonable control (Force Majeure), including but not limited to natural disasters, government actions, or pandemic events.</p>",
  "annexure": "<p><strong>[AI GENERATED — Annexure]</strong></p><p>The following annexure details the operational parameters, service configurations, and performance benchmarks that form an integral part of this agreement. All metrics specified herein shall be measured on a monthly basis unless otherwise stated.</p>",
  "asset": "<p><strong>[AI GENERATED — Asset Section]</strong></p><p>Our state-of-the-art facilities across the Kingdom provide the infrastructure backbone for reliable, scalable logistics operations. With over 500,000 sqm of warehousing space across 12 facilities, we offer ambient, temperature-controlled, and hazardous materials storage capabilities.</p>",
  "default": "<p><strong>[AI GENERATED — Default Section]</strong></p><p>Hala Supply Chain Services delivers comprehensive logistics solutions designed to optimize your supply chain performance. Our team of experienced professionals works closely with each client to develop customized solutions that address specific operational challenges while maintaining the highest standards of service quality and regulatory compliance.</p>",
};

export async function generateBlockContent(
  botId: string,
  blockFamily: string,
  prompt: string,
  blockContent: string,
  transcript: string | null,
  docInstanceId?: string,
  workspaceId?: string,
): Promise<BlockGenerateResult> {
  const bot = getEditorBotById(botId);

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

  // 2. Try real AI via Edge Functions
  if (bot) {
    try {
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
    } catch (err) {
      console.warn("[ai-runs] Edge Function unavailable, falling back to mock:", (err as Error).message);
    }
  }

  // 4. Fallback: mock response with KB citations appended
  return new Promise((resolve) => {
    setTimeout(() => {
      let content = BLOCK_MOCK_RESPONSES[blockFamily] || BLOCK_MOCK_RESPONSES["default"];
      const citations = extractCitationsFromChunks(retrievedChunks);

      if (retrievedChunks.length > 0) {
        const refs = retrievedChunks.slice(0, 3).map(c => `[Source: ${c.document_title} #${c.chunk_index}]`).join(" ");
        content += `<p class="text-xs text-muted-foreground mt-2"><em>${refs}</em></p>`;
      }

      // Create bot_run trace for mock too
      if (bot) {
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
          output: { text: content },
          status: "draft",
        });
      }

      resolve({
        content,
        tokens_input: Math.floor(Math.random() * 500) + 200,
        tokens_output: Math.floor(Math.random() * 800) + 300,
        retrieved_chunks: retrievedChunks,
        citations,
      });
    }, 1500 + Math.random() * 1000);
  });
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
  // Try real AI via Edge Functions first
  const bot = getEditorBotById(botId);
  if (bot) {
    try {
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

      // Parse AI response as JSON array
      try {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed)) {
          const suggestions: DocumentBlockSuggestion[] = parsed.map((s: any) => {
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
      } catch {
        console.warn("[ai-runs] Could not parse AI document response as JSON, falling back to mock");
      }
    } catch (err) {
      console.warn("[ai-runs] Edge Function unavailable, falling back to mock:", (err as Error).message);
    }
  }

  // Fallback: mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      const suggestions: DocumentBlockSuggestion[] = blocks
        .filter((_, i) => {
          if (runMode === "rewrite_all") return true;
          if (runMode === "spellcheck") return i % 2 === 0;
          if (runMode === "legal_review") return blocks[i].key.includes("legal") || i === 0;
          return !blocks[i].content || blocks[i].content.length < 50 || i < 3;
        })
        .map(block => ({
          block_id: block.id,
          block_key: block.key,
          block_name: block.name,
          original_text: block.content,
          suggested_text: generateSuggestionForBlock(block.key, block.content, runMode),
          selected: true,
        }));

      resolve({
        suggestions,
        tokens_input: Math.floor(Math.random() * 2000) + 1000,
        tokens_output: Math.floor(Math.random() * 3000) + 1500,
      });
    }, 2500 + Math.random() * 1500);
  });
}

function generateSuggestionForBlock(blockKey: string, originalContent: string, mode: DocumentRunMode): string {
  if (mode === "spellcheck") {
    // Return slightly modified version (simulating corrections)
    return originalContent
      .replace(/\bthe\b/g, "the")
      .replace(/<p>/g, "<p>")
      || `<p>Reviewed and corrected content for ${blockKey}. No significant errors found — minor formatting improvements applied.</p>`;
  }
  if (mode === "legal_review") {
    return `<p><strong>[Legal Review]</strong> The following clause has been reviewed for legal compliance under Saudi commercial law. Recommended improvements include clearer liability limitations, explicit force majeure provisions, and alignment with SCCA arbitration standards.</p>${originalContent || "<p>No existing content — legal clause recommended for this section.</p>"}`;
  }
  if (mode === "rewrite_all") {
    if (originalContent && originalContent.length > 20) {
      return `<p>Hala Supply Chain Services is committed to delivering exceptional value through this engagement. ${originalContent.replace(/<[^>]*>/g, "").substring(0, 100)}...</p><p>Our proven track record across the Kingdom's major industrial corridors ensures reliable, scalable operations tailored to your specific requirements.</p>`;
    }
    return `<p>This section has been professionally rewritten to align with Hala's brand standards and commercial best practices. The content emphasizes our operational capabilities, regional expertise, and commitment to client success.</p>`;
  }
  // fill_missing
  return `<p>Based on the meeting transcript, this section covers the key discussion points related to ${blockKey.replace(/[._]/g, " ")}. The client expressed interest in comprehensive logistics solutions with emphasis on temperature-controlled storage and last-mile delivery capabilities across the Eastern Province.</p>`;
}
