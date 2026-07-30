/**
 * final-pack-bot-validation.ts
 * ────────────────────────────
 * FPS-008-10 — AI output shape/safety validation.
 *
 * A PURE validation layer that sits between generateAI() and the preview UI.
 * It takes the raw AI text and returns a safe preview object. It does NOT call
 * AI, run a second pass, use any fallback model, mutate anything, or apply
 * output. Invalid output is never surfaced as clean, applicable content.
 *
 * Doctrine: advisory only. Validation never blocks editing/preview/export — it
 * only classifies what the assistant returned.
 */

export type BlockAIValidationStatus = "valid" | "invalid" | "warning";

export interface BlockAIValidationMeta {
  bot_id: string;
  bot_name: string;
  bot_category: string;
}

export interface BlockAIValidation {
  status: BlockAIValidationStatus;
  /** Content safe to display. Empty for invalid output (never shown as clean). */
  preview_content: string;
  warnings: string[];
  missing_information: string[];
  blocked_reasons: string[];
  language?: "ar" | "en" | "mixed" | "unknown";
  bot_id: string;
  bot_name: string;
  bot_category: string;
  created_at: string;
}

/**
 * Forbidden-directive patterns. If the AI output *attempts* any of these, the
 * output is marked invalid and not shown as clean content. Each entry maps to a
 * human-readable blocked reason.
 */
const BLOCK_PATTERNS: { test: RegExp; reason: string }[] = [
  { test: /\bauto[-\s]?sav(e|ed|ing)\b|\bsave[s]?\s+(the\s+)?document\s+automatically\b/i, reason: "Attempts to auto-save the document" },
  { test: /\bauto[-\s]?export(s|ed|ing)?\b|\bexport[s]?\s+(the\s+)?document\s+automatically\b/i, reason: "Attempts to auto-export the document" },
  { test: /\b(is\s+)?approved\b|\bapproval\s+(granted|complete|confirmed)\b|\bmark(ed)?\s+as\s+approved\b|\bI\s+approve\b/i, reason: "Claims document approval" },
  { test: /\blocked\b|\block(s|ing)?\s+(the\s+)?(document|editing|export)\b|\bblock(ed|s|ing)?\s+(the\s+)?(document|editing|export)\b|\bprison\b/i, reason: "Attempts to lock or block the document" },
  { test: /\b(?:change|update|set|adjust|modify|increase|decrease|recalculate|revise)\w*\s+(the\s+)?(pricing|price|prices|rate|rates|total|totals|vat|tax|subtotal|amount[s]?)\b/i, reason: "Attempts to change pricing/rates/totals/VAT" },
  { test: /\b(?:change|update|modify|set|revise)\w*\s+(the\s+)?payment\s+terms\b/i, reason: "Attempts to change payment terms" },
  { test: /\b(?:change|update|modify|alter|amend|revise)\w*\s+(the\s+)?(legal\s+terms|terms\s+(and|&)\s+conditions|liabilit(y|ies)|indemnit(y|ies)|warranty\s+clause)\b/i, reason: "Attempts to change legal terms/liability" },
  { test: /\b(?:change|update|modify|overwrite|replace)\w*\s+(the\s+)?source\s+data\b/i, reason: "Attempts to change source data" },
  { test: /\b(?:update|modify|change|edit|overwrite)\w*\s+(the\s+)?template[s]?\b/i, reason: "Attempts to update templates" },
  { test: /\b(?:update|modify|change|overwrite)\w*\s+(the\s+)?reusable\s+block[s]?\b/i, reason: "Attempts to update reusable blocks" },
  { test: /\b(?:call|invoke|run|trigger|chain)\w*\s+(to\s+)?(another|the\s+\w+|a\s+different)\s+(bot|assistant|agent)\b/i, reason: "Attempts to call another bot automatically" },
];

/**
 * Internal / meta / control labels that must NEVER reach customer-facing block
 * content. If the model echoes any of these (despite prompt hygiene), the output
 * is invalid and its content is withheld — the human can never apply it.
 */
const META_LABEL_PATTERNS: { test: RegExp; reason: string }[] = [
  { test: /\bpreview\s+only\b/i, reason: "Contains internal label: \"preview only\"" },
  { test: /\bblock\s+content\s*:/i, reason: "Contains internal label: \"Block content:\"" },
  { test: /\bpreview\s+only\s*[—\-–]\s*not\s+applied\b/i, reason: "Contains internal label: \"Preview only — not applied\"" },
  { test: /\bthis\s+is\s+a\s+preview\b/i, reason: "Contains internal label: \"This is a preview\"" },
  { test: /\binternal\s+instruction\b/i, reason: "Contains internal label: \"Internal instruction\"" },
  { test: /\bsafety\s+rule[s]?\b/i, reason: "Contains internal label: \"Safety rule\"" },
  { test: /\bsystem\s+instruction\b/i, reason: "Contains internal label: \"System instruction\"" },
  { test: /\bas\s+an\s+ai\b/i, reason: "Contains meta commentary: \"As an AI\"" },
  { test: /\bI\s+cannot\s+auto[-\s]?save\b/i, reason: "Contains meta commentary: \"I cannot auto-save\"" },
  { test: /\bthe\s+application\s+will\s+display\b/i, reason: "Contains internal label: \"The application will display\"" },
  { test: /\bdocument\s+intent\s*:/i, reason: "Contains internal label: \"Document intent:\"" },
  { test: /\buser\s+instruction\s*:/i, reason: "Contains internal label: \"User instruction:\"" },
];

/** Soft signals that the assistant lacked information (→ warning, not invalid). */
const MISSING_INFO_PATTERNS: { test: RegExp; note: string }[] = [
  { test: /\bno\s+(text\s+)?content\s+(was\s+)?provided\b|\bthis\s+block\s+has\s+no\s+text\b/i, note: "The block had no text content to work with" },
  { test: /\b(information|details?|context)\s+(is|are)\s+missing\b|\bmissing\s+(information|details?)\b/i, note: "The assistant reported missing information" },
  { test: /\b(I|we)\s+(don'?t|do\s+not|cannot|can'?t)\s+(have|find|see)\b.*\b(information|content|data|details?)\b/i, note: "The assistant could not find needed information" },
  { test: /\bplease\s+provide\b|\bnot\s+enough\s+information\b/i, note: "The assistant requested more information" },
];

function detectLanguage(text: string): BlockAIValidation["language"] {
  const hasArabic = /[؀-ۿ]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasArabic && hasLatin) return "mixed";
  if (hasArabic) return "ar";
  if (hasLatin) return "en";
  return "unknown";
}

/**
 * Validate raw AI text into a safe preview object. Pure; no I/O, no AI.
 */
export function validateBlockAIOutput(
  rawText: string | null | undefined,
  meta: BlockAIValidationMeta,
): BlockAIValidation {
  const base = {
    bot_id: meta.bot_id,
    bot_name: meta.bot_name,
    bot_category: meta.bot_category,
    created_at: new Date().toISOString(),
  };

  const text = typeof rawText === "string" ? rawText.trim() : "";

  // Empty output — handled safely (advisory, never applied).
  if (text.length === 0) {
    return {
      ...base,
      status: "invalid",
      preview_content: "",
      warnings: [],
      missing_information: [],
      blocked_reasons: ["The assistant returned no content."],
      language: "unknown",
    };
  }

  // Forbidden-directive scan.
  const blocked_reasons: string[] = [];
  for (const p of BLOCK_PATTERNS) {
    if (p.test.test(text)) blocked_reasons.push(p.reason);
  }
  // Internal/meta-label scan — these must never reach customer-facing content.
  for (const p of META_LABEL_PATTERNS) {
    if (p.test.test(text)) blocked_reasons.push(p.reason);
  }

  // Missing-information / soft warnings.
  const missing_information: string[] = [];
  for (const p of MISSING_INFO_PATTERNS) {
    if (p.test.test(text)) missing_information.push(p.note);
  }

  const warnings: string[] = [];
  if (/\{\{.*?\}\}/.test(text)) warnings.push("Output contains unresolved {{placeholders}}.");

  const language = detectLanguage(text);

  if (blocked_reasons.length > 0) {
    // Invalid: never expose as clean content.
    return {
      ...base,
      status: "invalid",
      preview_content: "",
      warnings,
      missing_information,
      blocked_reasons,
      language,
    };
  }

  const status: BlockAIValidationStatus =
    missing_information.length > 0 || warnings.length > 0 ? "warning" : "valid";

  return {
    ...base,
    status,
    preview_content: text,
    warnings,
    missing_information,
    blocked_reasons: [],
    language,
  };
}
