/**
 * tender-save-outcome.ts — TCW-T4 shared save plumbing for stage 6-15 tabs.
 *
 * Implements the two lane-wide contracts every save handler in the late-stage
 * tabs threads through:
 *
 *  P2a — revision threading. Writers accept a trailing `expectedRevision`; the
 *  token is the workspace bundle's `revisionToken` (the tender row's
 *  `updated_at` VERBATIM at load time). `wsRevisionToken` is the single
 *  accessor every handler uses, so the moment the token is present on the
 *  `ws` object all ~40 save paths thread it with no further change.
 *
 *  P3 — outcome truth. A writer result is one of four honest outcomes:
 *    saved                      → plain success
 *    saved_with_audit_warning   → PRIMARY row saved, audit append NOT recorded
 *                                 (amber warning, never plain success)
 *    stale                      → nothing written; the tender changed since the
 *                                 page loaded. NON-destructive: the caller must
 *                                 keep the user's entry on screen (no reload)
 *                                 and invite a retry.
 *    failed                     → nothing confirmed written; real reason shown.
 *
 * `classifySaveOutcome` is pure and unit-tested; `reportSaveOutcome` is the
 * thin toast wrapper call sites use.
 */
import { toast } from "sonner";
import type { ActionResult } from "@/lib/supabase-tender-actions";

/**
 * P2a — the UI-load-time revision token for `expectedRevision`.
 *
 * The canonical token is `bundle.revisionToken` (supabase-tender-data.ts). On
 * the current baseline `bundleToTenderWorkspace` does not yet copy that field
 * onto the `ws` object the stage tabs receive — that one-line mapping lives in
 * T1/T2-owned files and is recorded as an integration item in the lane report.
 * This accessor reads the token when present and returns undefined otherwise;
 * an undefined token makes the write layer fall back to its own fresh-read
 * token (exactly the pre-wave protection — never less, never a fabricated
 * token).
 */
export function wsRevisionToken(ws: unknown): string | undefined {
  const token = (ws as { revisionToken?: unknown } | null | undefined)?.revisionToken;
  return typeof token === "string" && token.trim() ? token : undefined;
}

export type SaveOutcomeKind = "saved" | "saved_with_audit_warning" | "stale" | "failed";

export interface SaveOutcomeMessage {
  kind: SaveOutcomeKind;
  /** True only when the PRIMARY write is confirmed (audit warning included). */
  success: boolean;
  title: string;
  description?: string;
}

/**
 * Pure classifier for a writer's ActionResult. Exported so tests can assert
 * the outcome contract without rendering anything.
 */
export function classifySaveOutcome(result: ActionResult, successTitle: string): SaveOutcomeMessage {
  if (result.success) {
    if (result.status === "saved_with_audit_warning") {
      return {
        kind: "saved_with_audit_warning",
        success: true,
        title: `${successTitle} — audit entry not recorded`,
        description: result.auditWarning ?? "Saved, but the audit entry was not recorded.",
      };
    }
    return { kind: "saved", success: true, title: successTitle };
  }
  if (result.status === "stale") {
    return {
      kind: "stale",
      success: false,
      title: "Not saved — tender changed since this page loaded",
      description: `${result.error ?? "The tender was modified elsewhere."} Your entry is still on this screen; review and save again.`,
    };
  }
  return {
    kind: "failed",
    success: false,
    title: "Not saved",
    description: result.error ?? "The save was not confirmed by the database.",
  };
}

/**
 * Renders the classified outcome as a toast and returns whether the PRIMARY
 * write is confirmed, so callers gate `setDirty(false)` / `reload()` on it.
 * Callers must NOT reload on a stale outcome — reloading would resync local
 * form state from the bundle and destroy the user's unsaved entry.
 */
export function reportSaveOutcome(result: ActionResult, successTitle: string): boolean {
  const outcome = classifySaveOutcome(result, successTitle);
  if (outcome.kind === "saved") {
    toast.success(outcome.title);
  } else if (outcome.kind === "saved_with_audit_warning" || outcome.kind === "stale") {
    toast.warning(outcome.title, { description: outcome.description, duration: 8000 });
  } else {
    toast.error(outcome.title, { description: outcome.description, duration: 8000 });
  }
  return outcome.success;
}
