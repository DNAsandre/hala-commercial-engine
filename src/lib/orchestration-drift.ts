/**
 * orchestration-drift.ts
 * ──────────────────────
 * Sprint 2.8 — Read-only conflict / drift PREVIEW (pure, network-free).
 *
 * Compares a suggestion's captured baseline (`current_saved_value`) against the
 * CURRENT value at its registry target. Purely informational — it applies
 * nothing, blocks nothing, and never writes. A drift warning is NOT a gate.
 *
 * Reuses the live registry (`resolveFieldPath`) and target reader
 * (`readTargetValue`) from orchestration-core. No invented routing.
 */

import {
  resolveFieldPath,
  readTargetValue,
  type OrchestrationSuggestion,
} from "./orchestration-core";

export type DriftStatus =
  | "in_sync"
  | "source_drift"
  | "baseline_unavailable"
  | "unknown_field_path"
  | "unsupported_field_path"
  | "target_unavailable";

export interface DriftResult {
  suggestion_id: string;
  field_path: string;
  status: DriftStatus;
  baseline_value?: unknown;
  current_value?: unknown;
  message: string;
}

const MESSAGES: Record<DriftStatus, string> = {
  in_sync: "Current field still matches the value captured when this suggestion was created.",
  source_drift: "This field changed after the suggestion was created. Review carefully before applying later.",
  baseline_unavailable: "No baseline was captured for this suggestion. Manual review is recommended.",
  unknown_field_path: "This suggestion targets an unknown field path.",
  unsupported_field_path: "This field path is not supported for drift comparison yet.",
  target_unavailable: "No current field value is available for comparison.",
};

/** Short badge labels (advisory wording — never blocking). */
const LABELS: Record<DriftStatus, string> = {
  in_sync: "In sync",
  source_drift: "Changed since suggested",
  baseline_unavailable: "No baseline",
  unknown_field_path: "Unknown path",
  unsupported_field_path: "Unsupported",
  target_unavailable: "No current value",
};

export function driftLabel(status: DriftStatus): string {
  return LABELS[status];
}

export type DriftSeverity = "ok" | "warn" | "info";

/** Severity for badge styling. Only real drift is a "warn"; nothing is a gate. */
export function driftSeverity(status: DriftStatus): DriftSeverity {
  if (status === "in_sync") return "ok";
  if (status === "source_drift") return "warn";
  return "info";
}

/** Structural equality good enough for drift comparison on JSON values. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export interface EvaluateDriftInput {
  typeDetails: Record<string, unknown> | undefined;
  suggestion: OrchestrationSuggestion;
}

/**
 * Evaluate drift for one suggestion. Never throws. Read-only.
 */
export function evaluateSuggestionDrift(input: EvaluateDriftInput): DriftResult {
  const { suggestion } = input;
  const base = { suggestion_id: suggestion.id, field_path: suggestion.field_path };

  const res = resolveFieldPath(suggestion.field_path);

  if (!res.entry) {
    return { ...base, status: "unknown_field_path", message: MESSAGES.unknown_field_path };
  }
  if (!res.entry.suggestion_supported || res.entry.type_details_key === "UNKNOWN") {
    return { ...base, status: "unsupported_field_path", message: MESSAGES.unsupported_field_path };
  }

  // Baseline present iff a current_saved_value was captured/provided.
  const baselineValue = suggestion.current_saved_value;
  if (baselineValue === undefined) {
    return { ...base, status: "baseline_unavailable", message: MESSAGES.baseline_unavailable };
  }

  const currentValue = readTargetValue(input.typeDetails, res.entry);
  if (currentValue === undefined) {
    return { ...base, status: "target_unavailable", baseline_value: baselineValue, message: MESSAGES.target_unavailable };
  }

  const status: DriftStatus = valuesEqual(currentValue, baselineValue) ? "in_sync" : "source_drift";
  return { ...base, status, baseline_value: baselineValue, current_value: currentValue, message: MESSAGES[status] };
}

/** Evaluate drift for many suggestions against the same typeDetails. */
export function evaluateDriftForList(
  typeDetails: Record<string, unknown> | undefined,
  suggestions: OrchestrationSuggestion[],
): DriftResult[] {
  return suggestions.map((suggestion) => evaluateSuggestionDrift({ typeDetails, suggestion }));
}

/** Map of suggestion_id → DriftResult (for the panel/cards). */
export function driftById(
  typeDetails: Record<string, unknown> | undefined,
  suggestions: OrchestrationSuggestion[],
): Record<string, DriftResult> {
  const map: Record<string, DriftResult> = {};
  for (const s of suggestions) map[s.id] = evaluateSuggestionDrift({ typeDetails, suggestion: s });
  return map;
}

export type DriftSummary = Record<DriftStatus, number>;

const DRIFT_STATUSES: DriftStatus[] = [
  "in_sync",
  "source_drift",
  "baseline_unavailable",
  "unknown_field_path",
  "unsupported_field_path",
  "target_unavailable",
];

export function summarizeDrift(results: DriftResult[]): DriftSummary {
  const summary = Object.fromEntries(DRIFT_STATUSES.map((s) => [s, 0])) as DriftSummary;
  for (const r of results) summary[r.status] += 1;
  return summary;
}
