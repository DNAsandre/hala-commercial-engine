/**
 * final-pack-bot-context.ts
 * ─────────────────────────
 * FPS-008-08 — Selected-block AI context assembler.
 *
 * Builds the *minimal, scoped* context handed to a Bot Builder microbot for a
 * single editable block. It deliberately includes ONLY the selected block and
 * its own document's framing.
 *
 * EXCLUDED on purpose (never assembled):
 * - other documents / tenders / proposals / customers
 * - internal costs, margins, GP%, pricing rows, SLA penalty figures
 * - unrelated source tables
 * - rejected previews
 *
 * Pure / no I/O. The bot's prompt itself comes from Bot Builder
 * (ai_bot_versions.system_instruction) — never from here.
 */

import type { OutputBlock } from "@/lib/final-pack-loader";
import type { DiscoveredBot } from "@/lib/final-pack-bots";

/** Traceability label only (mirrors OutputBlock.provenance, kept structural). */
type BlockProvenance = NonNullable<OutputBlock["provenance"]>;

/** Document-level framing for the active instance (no source/cost tables). */
export interface BlockAIDocContext {
  doc_instance_id: string;
  document_title: string;
  document_intent: string | null; // pack_type
  source_mode: string | null;
  source_kind: string | null;
  creation_method: string | null;
}

/** The full scoped context for one block + one bot. */
export interface BlockAIContext {
  // Block identity
  doc_instance_id: string;
  block_id: string;
  block_title: string;
  render_key: string;
  block_type: string; // == render_key (the bot-eligibility token)
  editor_mode: string;
  // Block content (narrative text only — no pricing/SLA/cost fields)
  block_content_text: string;
  block_provenance?: BlockProvenance;
  // Document framing
  document_title: string;
  document_intent: string | null;
  source_mode: string | null;
  source_kind: string | null;
  creation_method: string | null;
  // Selected bot
  bot_id: string;
  bot_name: string;
  bot_category: string;
  // Optional human instruction (placeholder; UI may fill later)
  user_instruction?: string;
}

/** Render keys whose content is structured commercial/legal data (never sent as text). */
const STRUCTURED_DATA_KEYS = new Set([
  "pricing_table_multi",
  "pricing_table_single",
  "quote_pricing_vat",
  "totals_words",
  "annexure_rate_card",
  "annexure_sla",
  "scope_table",
]);

/** Strip HTML tags to a plain-text approximation for the prompt. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract ONLY the narrative text of a block. For structured commercial/legal
 * blocks we return an empty string — those are never sent to AI (and the UI
 * does not show a sparkle on them anyway).
 */
export function extractBlockText(block: OutputBlock): string {
  if (STRUCTURED_DATA_KEYS.has(block.render_key)) return "";
  const c = block.content || ({} as OutputBlock["content"]);
  if (typeof c.html === "string" && c.html.trim()) return htmlToText(c.html);
  if (c.variables && typeof c.variables === "object") {
    const vals = Object.values(c.variables).filter((v) => typeof v === "string" && v.trim());
    if (vals.length) return vals.join("\n");
  }
  if (typeof block.default_content === "string" && block.default_content.trim()) {
    return htmlToText(block.default_content);
  }
  return "";
}

/**
 * Assemble the scoped context for the selected block + bot.
 */
export function assembleBlockAIContext(params: {
  block: OutputBlock;
  doc: BlockAIDocContext;
  bot: DiscoveredBot;
  userInstruction?: string;
}): BlockAIContext {
  const { block, doc, bot, userInstruction } = params;
  return {
    doc_instance_id: doc.doc_instance_id,
    block_id: block.id,
    block_title: block.display_name,
    render_key: block.render_key,
    block_type: block.render_key,
    editor_mode: block.editor_mode,
    block_content_text: extractBlockText(block),
    block_provenance: block.provenance,
    document_title: doc.document_title,
    document_intent: doc.document_intent,
    source_mode: doc.source_mode,
    source_kind: doc.source_kind,
    creation_method: doc.creation_method,
    bot_id: bot.id,
    bot_name: bot.display_name,
    bot_category: bot.category,
    user_instruction: userInstruction?.trim() || undefined,
  };
}

/**
 * Build the userPrompt string from the assembled context. The systemPrompt
 * (the bot's instruction + safety rules) is assembled separately in the runtime.
 */
export function buildUserPrompt(context: BlockAIContext): string {
  const lines: string[] = [];
  lines.push(`Document: ${context.document_title || "(untitled)"}`);
  if (context.document_intent) lines.push(`Document type: ${context.document_intent}`);
  lines.push(`Block: ${context.block_title} (${context.render_key})`);
  if (context.user_instruction) {
    lines.push(`\nUser instruction: ${context.user_instruction}`);
  }
  lines.push("\nBlock content:");
  lines.push(context.block_content_text || "(this block has no text content yet)");
  return lines.join("\n");
}
