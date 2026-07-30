/**
 * orchestration-apply.ts
 * ──────────────────────
 * Sprint 2.3 — Apply Reviewed Patch (PURE planner/executor, unit/dry-run only).
 *
 * Converts accepted/edited orchestration suggestions into a reviewed patch over a
 * tender's `type_details` object. PURE + network-free: it takes a typeDetails
 * object in, returns a new one out. No Supabase, no live write, no I/O.
 *
 * HUMAN-CONTROL MODEL (unchanged):
 *   AI suggests → human accepts/edits → system applies reviewed patch → audit kept.
 *
 * HARD RULES (Sprint 2.3):
 *   - Only `accepted` / `edited` suggestions may apply. All others skip (per-item).
 *   - A suggestion applies only to a registry path that is supported AND has
 *     apply_supported=true AND a real canonical target + writer binding.
 *   - Source drift (live value ≠ captured baseline) → conflict, never overwrite.
 *   - dryRun produces a plan and mutates NOTHING.
 *   - Non-dry-run mutates ONLY the specific canonical target(s) + the suggestion
 *     status inside `type_details.orchestration`. Never tender stage, CRM, the
 *     document output layer, or unrelated buckets.
 *   - `applied` is set ONLY here, ONLY after a successful patch (manual status
 *     updates still cannot set `applied`).
 *   - Batch is per-item; one bad item never fails the batch.
 */

import {
  resolveFieldPath,
  normalizeOrchestrationState,
  type OrchestrationSuggestion,
  type FieldRegistryEntry,
} from "./orchestration-core";

// ═══════════════════════════════════════════════════════════
// Result types
// ═══════════════════════════════════════════════════════════

export interface AppliedSuggestionResult {
  suggestion_id: string;
  field_path: string;
  applied_value: unknown;
}

export interface SkippedSuggestionResult {
  suggestion_id: string;
  field_path?: string;
  reason: string;
}

export interface ApplyConflictResult {
  suggestion_id: string;
  field_path: string;
  reason: "source_drift";
  baseline_value: unknown;
  live_value: unknown;
  proposed_apply_value: unknown;
}

export interface ApplyErrorResult {
  suggestion_id?: string;
  reason: string;
  message?: string;
}

export interface ApplyBatchResult {
  /** New type_details (only on a successful non-dry-run with ≥1 apply). */
  nextTypeDetails?: Record<string, unknown>;
  applied: AppliedSuggestionResult[];
  skipped: SkippedSuggestionResult[];
  conflicts: ApplyConflictResult[];
  errors: ApplyErrorResult[];
  dryRun: boolean;
}

export interface ApplyReviewedPatchInput {
  tenderId: string;
  /** The tender's full type_details object (incl. `.orchestration`). */
  typeDetails: Record<string, unknown>;
  suggestionIds: string[];
  actorId?: string;
  dryRun?: boolean;
  /** Injectable clock for deterministic tests. */
  now?: () => string;
}

// ═══════════════════════════════════════════════════════════
// Helpers (pure)
// ═══════════════════════════════════════════════════════════

/** Structural equality good enough for drift detection on JSON values. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Read the live canonical value the registry entry points at. */
function readTarget(typeDetails: Record<string, unknown>, entry: FieldRegistryEntry): unknown {
  const bucket = typeDetails[entry.type_details_key];
  if (entry.section == null) return bucket;
  if (bucket && typeof bucket === "object" && !Array.isArray(bucket)) {
    return (bucket as Record<string, unknown>)[entry.section];
  }
  return undefined;
}

/** Immutably write the canonical value, mirroring the real section writers' merge. */
function writeTarget(
  typeDetails: Record<string, unknown>,
  entry: FieldRegistryEntry,
  value: unknown,
): Record<string, unknown> {
  if (entry.section == null) {
    return { ...typeDetails, [entry.type_details_key]: value };
  }
  const existingBucket =
    typeDetails[entry.type_details_key] && typeof typeDetails[entry.type_details_key] === "object" && !Array.isArray(typeDetails[entry.type_details_key])
      ? (typeDetails[entry.type_details_key] as Record<string, unknown>)
      : {};
  return {
    ...typeDetails,
    [entry.type_details_key]: { ...existingBucket, [entry.section]: value },
  };
}

/** Resolve the value an applyable suggestion should write (or a skip reason). */
function resolveApplyValue(s: OrchestrationSuggestion): { value: unknown } | { skip: string } {
  if (s.status === "accepted") {
    return { value: s.accepted_value !== undefined ? s.accepted_value : s.proposed_value };
  }
  // edited
  if (s.accepted_value === undefined) return { skip: "edited_missing_accepted_value" };
  return { value: s.accepted_value };
}

/** Why a registry path may not apply (or null if it can). */
function pathBlockReason(fieldPath: string): string | null {
  const res = resolveFieldPath(fieldPath);
  if (!res.entry && res.reason === "unknown_field_path") return "unknown_field_path";
  if (!res.entry) return "unknown_field_path";
  if (!res.entry.suggestion_supported) return "unsupported_field_path";
  if (!res.entry.apply_supported) return "apply_not_enabled";
  if (!res.entry.type_details_key || res.entry.type_details_key === "UNKNOWN") return "missing_target";
  if (!res.entry.writer || res.entry.writer === "UNKNOWN") return "missing_writer_binding";
  return null;
}

// ═══════════════════════════════════════════════════════════
// Main: applyReviewedPatch (pure)
// ═══════════════════════════════════════════════════════════

export function applyReviewedPatch(input: ApplyReviewedPatchInput): ApplyBatchResult {
  const dryRun = !!input.dryRun;
  const now = input.now ?? (() => new Date().toISOString());
  const result: ApplyBatchResult = { applied: [], skipped: [], conflicts: [], errors: [], dryRun };

  const typeDetails =
    input.typeDetails && typeof input.typeDetails === "object" && !Array.isArray(input.typeDetails)
      ? input.typeDetails
      : {};

  const orchState = normalizeOrchestrationState(typeDetails.orchestration);
  const byId = new Map(orchState.suggestions.map((s) => [s.id, s]));

  // Accumulators for non-dry-run mutation (applied once at the end).
  let workingDetails: Record<string, unknown> = { ...typeDetails };
  const appliedSuggestionIds = new Map<string, unknown>(); // id → applied value

  for (const id of input.suggestionIds) {
    const s = byId.get(id);
    if (!s) {
      result.errors.push({ suggestion_id: id, reason: "suggestion_not_found" });
      continue;
    }

    // 1) Status gate — only accepted/edited apply.
    if (s.status !== "accepted" && s.status !== "edited") {
      result.skipped.push({ suggestion_id: id, field_path: s.field_path, reason: `status_not_applyable:${s.status}` });
      continue;
    }

    // 2) Field-path gate.
    const block = pathBlockReason(s.field_path);
    if (block) {
      result.skipped.push({ suggestion_id: id, field_path: s.field_path, reason: block });
      continue;
    }
    const entry = resolveFieldPath(s.field_path).entry!;

    // 3) Apply-value gate (edited requires accepted_value).
    const valueOrSkip = resolveApplyValue(s);
    if ("skip" in valueOrSkip) {
      result.skipped.push({ suggestion_id: id, field_path: s.field_path, reason: valueOrSkip.skip });
      continue;
    }
    const applyValue = valueOrSkip.value;

    // 4) Source-drift gate — only when a baseline was captured.
    const liveValue = readTarget(workingDetails, entry);
    if (s.current_saved_value !== undefined && !valuesEqual(liveValue, s.current_saved_value)) {
      result.conflicts.push({
        suggestion_id: id,
        field_path: s.field_path,
        reason: "source_drift",
        baseline_value: s.current_saved_value,
        live_value: liveValue,
        proposed_apply_value: applyValue,
      });
      continue;
    }

    // 5) Plan the apply.
    result.applied.push({ suggestion_id: id, field_path: s.field_path, applied_value: applyValue });

    if (!dryRun) {
      workingDetails = writeTarget(workingDetails, entry, applyValue);
      appliedSuggestionIds.set(id, applyValue);
    }
  }

  // dry-run mutates nothing — no nextTypeDetails, no status changes.
  if (dryRun || appliedSuggestionIds.size === 0) {
    return result;
  }

  // Non-dry-run: mark applied suggestions inside orchestration (status set ONLY here).
  const stamp = now();
  const nextSuggestions = orchState.suggestions.map((s) => {
    if (!appliedSuggestionIds.has(s.id)) return s;
    return {
      ...s, // preserve all provenance (bot_id, source_*, ai_run_id, …)
      status: "applied" as const,
      accepted_value: appliedSuggestionIds.get(s.id),
      reviewed_by: input.actorId ?? s.reviewed_by,
      applied_at: stamp,
    };
  });

  workingDetails = {
    ...workingDetails,
    orchestration: { ...orchState, suggestions: nextSuggestions, updated_at: stamp },
  };

  result.nextTypeDetails = workingDetails;
  return result;
}

// ═══════════════════════════════════════════════════════════
// Sprint 2.4 — pure apply service wrapper (commit-guarded)
// ═══════════════════════════════════════════════════════════
//
// Wraps applyReviewedPatch with mode/guard semantics. PURE: operates on a
// provided typeDetails, no I/O. The live binding (read row → call this →
// write back) lives in orchestration.ts and is NOT enabled in Sprint 2.4.

export interface ApplyServiceInput {
  tenderId?: string;
  typeDetails: Record<string, unknown>;
  suggestionIds: string[];
  actorId?: string;
  /** Default true (safe). Commit requires dryRun:false AND mode:'commit'. */
  dryRun?: boolean;
  mode?: "dry_run" | "commit";
  now?: () => string;
}

export interface ApplyServiceResult extends ApplyBatchResult {
  mode: "dry_run" | "commit";
  /** True only when a real (in-memory) commit produced nextTypeDetails. */
  committed: boolean;
}

/**
 * Commit is GUARDED: it runs only when the caller passes BOTH `mode:'commit'`
 * AND `dryRun:false`. Any other combination (including the defaults) is a safe
 * dry-run that mutates nothing. This prevents accidental commits by default.
 */
export function applyReviewedPatchService(input: ApplyServiceInput): ApplyServiceResult {
  const wantsCommit = input.mode === "commit" && input.dryRun === false;
  const effectiveDryRun = !wantsCommit;

  const batch = applyReviewedPatch({
    tenderId: input.tenderId ?? "service",
    typeDetails: input.typeDetails,
    suggestionIds: input.suggestionIds,
    actorId: input.actorId,
    dryRun: effectiveDryRun,
    now: input.now,
  });

  return {
    ...batch,
    mode: wantsCommit ? "commit" : "dry_run",
    committed: wantsCommit && !!batch.nextTypeDetails,
  };
}
