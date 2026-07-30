/**
 * orchestration-review-helpers.ts
 * ───────────────────────────────
 * Sprint 2.5 — Pure view/decision logic for the human review surface.
 *
 * Network-free + DOM-free so it is fully unit-testable. The React components
 * (OrchestrationReviewPanel / OrchestrationSuggestionCard) are thin shells over
 * these helpers + the existing orchestration service.
 *
 * DECISION CAPTURE ONLY:
 *   - Builders produce StatusUpdateInput for accepted / edited / rejected.
 *   - There is NO path here that produces `applied` — review never applies to
 *     canonical fields (that is the service/apply layer, gated separately).
 */

import {
  SUGGESTION_STATUSES,
  type SuggestionStatus,
  type StatusUpdateInput,
  type OrchestrationSuggestion,
  type BaselineStatus,
} from "./orchestration-core";

// ── The decisions a human reviewer may take in this surface ──
export const REVIEW_DECISIONS = ["accept", "edit", "reject", "defer"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

// ═══════════════════════════════════════════════════════════
// Value preview (safe for strings, numbers, objects, arrays)
// ═══════════════════════════════════════════════════════════

export function formatValuePreview(value: unknown, maxLen = 200): string {
  if (value === undefined || value === null) return "—";
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

/** Pretty multi-line string for an object/array value (for an expanded view). */
export function formatValueFull(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ═══════════════════════════════════════════════════════════
// Status summary + grouping (advisory only)
// ═══════════════════════════════════════════════════════════

export interface ReviewSummary {
  total: number;
  byStatus: Record<SuggestionStatus, number>;
}

export function summarizeReview(suggestions: OrchestrationSuggestion[]): ReviewSummary {
  const byStatus = Object.fromEntries(SUGGESTION_STATUSES.map((s) => [s, 0])) as Record<SuggestionStatus, number>;
  for (const s of suggestions) {
    if (byStatus[s.status] !== undefined) byStatus[s.status] += 1;
  }
  return { total: suggestions.length, byStatus };
}

export type GroupBy = "status" | "stage" | "field_path";

export function groupSuggestions(
  suggestions: OrchestrationSuggestion[],
  by: GroupBy,
): Array<{ key: string; suggestions: OrchestrationSuggestion[] }> {
  const map = new Map<string, OrchestrationSuggestion[]>();
  for (const s of suggestions) {
    const key = String(s[by] ?? "—");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([key, list]) => ({ key, suggestions: list }));
}

/** Actions are available for any non-terminal-by-apply status; `applied` is read-only. */
export function canReview(status: SuggestionStatus): boolean {
  return status !== "applied";
}

// ═══════════════════════════════════════════════════════════
// Provenance display rows
// ═══════════════════════════════════════════════════════════

export interface DisplayRow {
  label: string;
  value: string;
}

export function provenanceRows(s: OrchestrationSuggestion): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const push = (label: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") rows.push({ label, value: String(v) });
  };
  push("Baseline", s.baseline_status);
  push("Confidence", typeof s.confidence === "number" ? `${Math.round(s.confidence * 100)}%` : undefined);
  push("Source role", s.source_role);
  push("Source document", s.source_document_id);
  push("Source page", s.source_page);
  push("Source section", s.source_section);
  push("Source span", s.source_span);
  push("Bot", s.bot_id);
  push("Bot version", s.bot_version_id);
  push("AI run", s.ai_run_id);
  push("Created", s.created_at);
  push("Reviewed by", s.reviewed_by);
  push("Reviewed at", s.reviewed_at);
  return rows;
}

// ═══════════════════════════════════════════════════════════
// Decision → StatusUpdateInput builders (NEVER produce `applied`)
// ═══════════════════════════════════════════════════════════

export function buildAcceptUpdate(reviewedBy?: string): StatusUpdateInput {
  return { status: "accepted", reviewed_by: reviewedBy };
}

export function buildEditUpdate(acceptedValue: unknown, reviewedBy?: string): StatusUpdateInput {
  return { status: "edited", accepted_value: acceptedValue, reviewed_by: reviewedBy };
}

export function buildRejectUpdate(reason: string, reviewedBy?: string): StatusUpdateInput {
  const trimmed = (reason ?? "").trim();
  return { status: "rejected", rejection_reason: trimmed.length > 0 ? trimmed : "(no reason provided)", reviewed_by: reviewedBy };
}

/**
 * Parse a human-edited value from a textarea. If the original value was an
 * object/array, try JSON first; otherwise keep the raw string. Never throws.
 */
export function parseEditedValue(text: string, originalValue: unknown): unknown {
  const wasStructured = originalValue !== null && typeof originalValue === "object";
  if (wasStructured) {
    try {
      return JSON.parse(text);
    } catch {
      return text; // fall back to raw string; apply layer stores as-is
    }
  }
  return text;
}

/** The constant banner shown above the review surface. */
export const REVIEW_NOTICE = "AI suggestion — human review required before official tender update.";

// ═══════════════════════════════════════════════════════════
// Sprint 2.7 — confidence / baseline labels, edit validation, filters, copy
// ═══════════════════════════════════════════════════════════

export type ConfidenceLabel = "high" | "medium" | "low" | "unknown";

/** Bucket a 0–1 confidence into a human label. Missing/NaN → "unknown". */
export function confidenceLabel(confidence?: number | null): ConfidenceLabel {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "unknown";
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

/** Human description of baseline status (advisory; no apply/conflict logic here). */
export function baselineLabel(status?: BaselineStatus): string {
  if (status === "baseline_captured") return "Captured — current value recorded when suggested";
  if (status === "baseline_unavailable") return "Not captured — apply may need extra caution later";
  return "—";
}

export interface EditValidation {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/**
 * Validate a human-edited value. For a structured original (object/array) the
 * text MUST be valid JSON — malformed JSON is reported (and NOT saved as object).
 * For a string original, any text is accepted as-is. Never throws.
 */
export function validateEditedValue(text: string, originalValue: unknown): EditValidation {
  const wasStructured = originalValue !== null && typeof originalValue === "object";
  if (!wasStructured) return { ok: true, value: text };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "Invalid JSON — fix the formatting before saving." };
  }
}

/** Sorted unique values for a filterable key (stage / field_path). */
export function uniqueValues(suggestions: OrchestrationSuggestion[], key: "stage" | "field_path"): string[] {
  return Array.from(new Set(suggestions.map((s) => String(s[key] ?? "—")))).sort();
}

export const LOADING_COPY = "Loading orchestration suggestions…";
export const EMPTY_COPY = "No orchestration suggestions yet. This tender can continue normally.";
export const ERROR_COPY = "Could not load orchestration suggestions. Tender work is not blocked.";
