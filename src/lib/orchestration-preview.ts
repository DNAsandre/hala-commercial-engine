/**
 * orchestration-preview.ts
 * ────────────────────────
 * Sprint 2.9 — Read-only APPLY DRY-RUN PREVIEW (pure, network-free).
 *
 * Shows a human reviewer what WOULD happen if reviewed suggestions were applied
 * later — without applying anything. Wraps applyReviewedPatchService in DRY-RUN
 * mode only: it never commits, never writes a canonical field, never sets
 * `applied`. A dry-run conflict is NOT a gate.
 */

import { normalizeOrchestrationState } from "./orchestration-core";
import { applyReviewedPatchService } from "./orchestration-apply";

export type PreviewCategory = "would_apply" | "skipped" | "conflict" | "error";

export interface PreviewItem {
  suggestion_id: string;
  field_path?: string;
  category: PreviewCategory;
  reason?: string;
  /** For would_apply: the value that WOULD be written later. */
  apply_value?: unknown;
  /** For conflict: the captured baseline + the current live value. */
  baseline_value?: unknown;
  current_value?: unknown;
}

export interface ApplyPreview {
  considered: number;
  wouldApply: PreviewItem[];
  skipped: PreviewItem[];
  conflicts: PreviewItem[];
  errors: PreviewItem[];
  summary: { considered: number; wouldApply: number; skipped: number; conflicts: number; errors: number };
  byId: Record<string, PreviewItem>;
  /** Always true — this is a preview. */
  dryRun: true;
}

const CATEGORY_LABELS: Record<PreviewCategory, string> = {
  would_apply: "Would apply later",
  skipped: "Would be skipped",
  conflict: "Needs review — field changed",
  error: "Preview error",
};

export function previewLabel(category: PreviewCategory): string {
  return CATEGORY_LABELS[category];
}

export type PreviewSeverity = "ok" | "warn" | "error" | "info";

export function previewSeverity(category: PreviewCategory): PreviewSeverity {
  if (category === "would_apply") return "ok";
  if (category === "conflict") return "warn";
  if (category === "error") return "error";
  return "info";
}

/** Friendly copy for the apply skip reasons surfaced by the apply layer. */
const SKIP_REASON_COPY: Record<string, string> = {
  edited_missing_accepted_value: "Edited but no accepted value was provided.",
  unknown_field_path: "Targets an unknown field path.",
  unsupported_field_path: "Field path is not supported for apply.",
  apply_not_enabled: "Apply is not enabled for this field path.",
  missing_target: "No canonical target is mapped for this field path.",
  missing_writer_binding: "No writer is bound for this field path.",
};

/** Human-readable reason for a skipped/error item (falls back to the raw code). */
export function previewReasonCopy(reason?: string): string {
  if (!reason) return "";
  if (reason.startsWith("status_not_applyable:")) {
    const status = reason.split(":")[1] ?? "";
    return `Status is "${status}" — only accepted or edited suggestions can apply.`;
  }
  return SKIP_REASON_COPY[reason] ?? reason;
}

export const PREVIEW_ONLY_NOTICE = "Preview only — no tender fields will be updated.";

/**
 * Build a read-only apply preview for the given typeDetails (which must carry
 * `orchestration.suggestions`). DRY-RUN ONLY — mutates nothing.
 */
export function buildApplyPreview(
  typeDetails: Record<string, unknown> | undefined,
  suggestionIds?: string[],
): ApplyPreview {
  const td = typeDetails && typeof typeDetails === "object" && !Array.isArray(typeDetails) ? typeDetails : {};
  const state = normalizeOrchestrationState(td.orchestration);
  const ids = suggestionIds ?? state.suggestions.map((s) => s.id);

  // DRY-RUN ONLY: explicit dry_run; commit is never requested here.
  const res = applyReviewedPatchService({
    tenderId: "preview",
    typeDetails: td,
    suggestionIds: ids,
    dryRun: true,
    mode: "dry_run",
  });

  const wouldApply: PreviewItem[] = res.applied.map((a) => ({
    suggestion_id: a.suggestion_id,
    field_path: a.field_path,
    category: "would_apply",
    apply_value: a.applied_value,
  }));
  const skipped: PreviewItem[] = res.skipped.map((sk) => ({
    suggestion_id: sk.suggestion_id,
    field_path: sk.field_path,
    category: "skipped",
    reason: sk.reason,
  }));
  const conflicts: PreviewItem[] = res.conflicts.map((c) => ({
    suggestion_id: c.suggestion_id,
    field_path: c.field_path,
    category: "conflict",
    reason: c.reason,
    baseline_value: c.baseline_value,
    current_value: c.live_value,
  }));
  const errors: PreviewItem[] = res.errors.map((e) => ({
    suggestion_id: e.suggestion_id ?? "(unknown)",
    category: "error",
    reason: e.reason,
  }));

  const byId: Record<string, PreviewItem> = {};
  for (const item of [...wouldApply, ...skipped, ...conflicts, ...errors]) byId[item.suggestion_id] = item;

  return {
    considered: ids.length,
    wouldApply,
    skipped,
    conflicts,
    errors,
    summary: {
      considered: ids.length,
      wouldApply: wouldApply.length,
      skipped: skipped.length,
      conflicts: conflicts.length,
      errors: errors.length,
    },
    byId,
    dryRun: true,
  };
}
