/**
 * orchestration.ts
 * ────────────────
 * Sprint 2.2 — Orchestration Suggestion Store (ASYNC SERVICE).
 *
 * Persists orchestration packages + suggestions into the ADDITIVE holding layer
 * `commercial_tickets.type_details.orchestration`. Mirrors the exact read-merge-
 * write-audit pattern used by the existing tender section writers
 * (see supabase-tender-actions.ts) so behavior + RLS handling stay identical.
 *
 * HARD GUARANTEES (Sprint 2.2):
 *   - Writes ONLY `type_details.orchestration`. Never any canonical tender field,
 *     stage, CRM stage, FinalStudio, or document row.
 *   - No apply-reviewed-patch (Sprint 2.3). `applied` status is rejected.
 *   - No gates: nothing here can block save / stage / draft / FinalStudio / export.
 *   - Best-effort audit to commercial_ticket_audit, identical to SUPA-008.
 *
 * Pure logic lives in orchestration-core.ts (unit-tested, network-free).
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";
import {
  type TenderOrchestrationState,
  type OrchestrationPackage,
  type OrchestrationSuggestion,
  type NewPackageInput,
  type NewSuggestionInput,
  type StatusUpdateInput,
  type SuggestionFilter,
  type FieldRegistryEntry,
  buildPackage,
  buildSuggestion,
  buildSuggestionWithBaseline,
  applyStatusTransition,
  mergePackageIntoState,
  mergeSuggestionIntoState,
  filterSuggestions,
  normalizeOrchestrationState,
  resolveFieldPath,
  getFieldRegistry,
  countByStatus,
  FIELD_REGISTRY_VERSION,
} from "./orchestration-core";
import { applyReviewedPatchService, type ApplyServiceResult } from "./orchestration-apply";

// Re-export the contract surface so callers can import from one module.
export * from "./orchestration-core";

export interface OrchestrationResult<T = void> {
  success: boolean;
  error?: string;
  /** Advisory note (e.g. unsupported field_path) — never blocks the call. */
  warning?: string;
  data?: T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function actorName(): string {
  const u = getCurrentUser();
  return u?.name ?? "System";
}

// ═══════════════════════════════════════════════════════════
// Best-effort audit (mirrors writeCanonicalTenderAudit / SUPA-008)
// ═══════════════════════════════════════════════════════════

function writeOrchestrationAudit(params: {
  tenderId: string;
  fieldChanged: string;
  newValue?: string | null;
  notes?: string | null;
}): void {
  const timeoutMs = 4000;
  let handle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error("orchestration audit timeout")), timeoutMs);
  });
  Promise.race([
    Promise.resolve(
      supabase.from("commercial_ticket_audit").insert({
        ticket_id: params.tenderId,
        action: "updated", // orchestration drafts are advisory metadata, never a stage change
        field_changed: params.fieldChanged,
        old_value: null,
        new_value: params.newValue ?? null,
        user_name: actorName(),
        notes: params.notes ?? null,
      }),
    ),
    timeout,
  ])
    .then((res: any) => {
      if (res?.error) console.warn("[ORCH-2.2] audit insert failed:", res.error.message);
    })
    .catch((e) => console.warn("[ORCH-2.2] audit insert skipped:", e?.message || String(e)))
    .finally(() => {
      if (handle) clearTimeout(handle);
    });
}

// ═══════════════════════════════════════════════════════════
// State read / write (type_details.orchestration ONLY)
// ═══════════════════════════════════════════════════════════

/** Read a tender's FULL type_details (safe empty default). Read-only, single tender. */
export async function readTenderTypeDetails(
  tenderId: string,
): Promise<OrchestrationResult<Record<string, unknown>>> {
  const existing = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", tenderId)
    .eq("ticket_type", "tender")
    .eq("active", true)
    .maybeSingle();

  if (existing.error) return { success: false, error: existing.error.message };
  if (!existing.data) return { success: false, error: "Tender not found." };

  const details =
    existing.data.type_details && typeof existing.data.type_details === "object" && !Array.isArray(existing.data.type_details)
      ? (existing.data.type_details as Record<string, unknown>)
      : {};

  return { success: true, data: details };
}

/** Read the orchestration holding-state for a tender (safe empty default). */
export async function readOrchestrationState(
  tenderId: string,
): Promise<OrchestrationResult<TenderOrchestrationState>> {
  const res = await readTenderTypeDetails(tenderId);
  if (!res.success || !res.data) return { success: false, error: res.error };
  return { success: true, data: normalizeOrchestrationState(res.data.orchestration) };
}

/**
 * Persist a new orchestration state by merging ONLY the `orchestration` key into
 * the tender's existing type_details. All other buckets are preserved verbatim.
 * Uses .select('id') 0-row detection (RLS-block aware), exactly like SUPA-008.
 */
async function writeOrchestrationState(
  tenderId: string,
  state: TenderOrchestrationState,
  audit: { fieldChanged: string; newValue: string; notes: string },
): Promise<OrchestrationResult> {
  const existing = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", tenderId)
    .eq("ticket_type", "tender")
    .eq("active", true)
    .maybeSingle();

  if (existing.error) return { success: false, error: existing.error.message };
  if (!existing.data) return { success: false, error: "Tender not found." };

  const currentDetails =
    existing.data.type_details && typeof existing.data.type_details === "object" && !Array.isArray(existing.data.type_details)
      ? (existing.data.type_details as Record<string, unknown>)
      : {};

  const nextState: TenderOrchestrationState = {
    ...state,
    field_registry_version: FIELD_REGISTRY_VERSION,
    updated_at: nowIso(),
  };

  const { error, count } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: { ...currentDetails, orchestration: nextState },
      updated_at: nowIso(),
    })
    .eq("id", tenderId)
    .select("id")
    .then((res) => ({ error: res.error, count: res.data?.length ?? 0 }));

  if (error) return { success: false, error: error.message };
  if (count === 0) {
    return { success: false, error: "Update failed — no rows affected (possible RLS block; try re-login)." };
  }

  writeOrchestrationAudit({
    tenderId,
    fieldChanged: audit.fieldChanged,
    newValue: audit.newValue,
    notes: audit.notes,
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// Public service API (helper-based; matches existing architecture)
// ═══════════════════════════════════════════════════════════

/** Create an orchestration package for a tender. Changes nothing official. */
export async function createOrchestrationPackage(
  tenderId: string,
  input: Omit<NewPackageInput, "tender_id">,
): Promise<OrchestrationResult<OrchestrationPackage>> {
  const read = await readOrchestrationState(tenderId);
  if (!read.success || !read.data) return { success: false, error: read.error ?? "State read failed." };

  const pkg = buildPackage({ ...input, tender_id: tenderId, created_by: input.created_by ?? actorName() });
  const nextState = mergePackageIntoState(read.data, pkg);

  const write = await writeOrchestrationState(tenderId, nextState, {
    fieldChanged: "orchestration.package",
    newValue: `package ${pkg.id} created`,
    notes: `Orchestration package "${pkg.package_name}" created (${pkg.document_ids.length} docs).`,
  });
  if (!write.success) return { success: false, error: write.error };
  return { success: true, data: pkg };
}

/**
 * Add a suggestion to a tender. Always created as pending_review.
 * Unsupported/unknown field_paths are STORED but flagged via `warning` — they are
 * advisory-only and ineligible for the future apply step. Never blocks.
 */
export async function addOrchestrationSuggestion(
  tenderId: string,
  input: Omit<NewSuggestionInput, "tender_id">,
): Promise<OrchestrationResult<OrchestrationSuggestion>> {
  // Read the FULL type_details once — needed for baseline capture (Sprint 2.4).
  const detailsRes = await readTenderTypeDetails(tenderId);
  if (!detailsRes.success || !detailsRes.data) return { success: false, error: detailsRes.error ?? "State read failed." };
  const fullDetails = detailsRes.data;

  // Reject only the unsafe creation state; pending_review is the default.
  if (input.status && input.status === "applied") {
    return { success: false, error: "Suggestions cannot be created as 'applied' (deferred to Sprint 2.3)." };
  }

  const resolution = resolveFieldPath(input.field_path);
  // Sprint 2.4: capture the current canonical value at the target path as the
  // drift baseline (caller-provided current_saved_value is preserved).
  const suggestion = buildSuggestionWithBaseline(
    { ...input, tender_id: tenderId, created_by: input.created_by ?? actorName() },
    fullDetails,
  );

  const currentState = normalizeOrchestrationState(fullDetails.orchestration);
  const nextState = mergeSuggestionIntoState(currentState, suggestion);
  const write = await writeOrchestrationState(tenderId, nextState, {
    fieldChanged: "orchestration.suggestion",
    newValue: `suggestion ${suggestion.id} (${suggestion.field_path})`,
    notes: `AI suggestion stored for ${suggestion.field_path} [${resolution.supported ? "supported" : "UNSUPPORTED:" + resolution.reason}] (baseline: ${suggestion.baseline_status ?? "n/a"}).`,
  });
  if (!write.success) return { success: false, error: write.error };

  return {
    success: true,
    data: suggestion,
    warning: resolution.supported
      ? undefined
      : `field_path "${input.field_path}" is not a supported target in Sprint 2.2 (${resolution.reason}); stored as advisory only.`,
  };
}

/** List suggestions for a tender, optionally filtered. Read-only. */
export async function listOrchestrationSuggestions(
  tenderId: string,
  filter: SuggestionFilter = {},
): Promise<OrchestrationResult<{ suggestions: OrchestrationSuggestion[]; countsByStatus: Record<string, number> }>> {
  const read = await readOrchestrationState(tenderId);
  if (!read.success || !read.data) return { success: false, error: read.error ?? "State read failed." };
  return {
    success: true,
    data: { suggestions: filterSuggestions(read.data, filter), countsByStatus: countByStatus(read.data) },
  };
}

/** List packages for a tender. Read-only. */
export async function listOrchestrationPackages(
  tenderId: string,
): Promise<OrchestrationResult<OrchestrationPackage[]>> {
  const read = await readOrchestrationState(tenderId);
  if (!read.success || !read.data) return { success: false, error: read.error ?? "State read failed." };
  return { success: true, data: read.data.packages };
}

/**
 * Update a suggestion's review status. Does NOT write any canonical tender field.
 * `applied` is rejected (Sprint 2.3). Human/test-harness review action only.
 */
export async function updateOrchestrationSuggestionStatus(
  tenderId: string,
  suggestionId: string,
  update: StatusUpdateInput,
): Promise<OrchestrationResult<OrchestrationSuggestion>> {
  const read = await readOrchestrationState(tenderId);
  if (!read.success || !read.data) return { success: false, error: read.error ?? "State read failed." };

  const current = read.data.suggestions.find((s) => s.id === suggestionId);
  if (!current) return { success: false, error: `Suggestion ${suggestionId} not found.` };

  const transition = applyStatusTransition(current, {
    ...update,
    reviewed_by: update.reviewed_by ?? actorName(),
  });
  if (!transition.ok || !transition.suggestion) {
    return { success: false, error: transition.error };
  }

  const nextState = mergeSuggestionIntoState(read.data, transition.suggestion);
  const write = await writeOrchestrationState(tenderId, nextState, {
    fieldChanged: "orchestration.suggestion_status",
    newValue: `${suggestionId} → ${update.status}`,
    notes: `Suggestion ${suggestionId} reviewed: ${update.status}${update.rejection_reason ? ` | ${update.rejection_reason}` : ""}.`,
  });
  if (!write.success) return { success: false, error: write.error };
  return { success: true, data: transition.suggestion };
}

/** Retrieve the live-accurate field registry (read-only). */
export function getOrchestrationFieldRegistry(): FieldRegistryEntry[] {
  return getFieldRegistry();
}

// ═══════════════════════════════════════════════════════════
// Sprint 2.4 — guarded live apply wrapper (DRY-RUN ONLY)
// ═══════════════════════════════════════════════════════════
//
// Reads the tender's full type_details (read-only), runs the pure, tested
// applyReviewedPatchService, and returns the plan. COMMIT IS NOT ENABLED:
// a commit request never writes back in Sprint 2.4 — it returns a guarded
// NEEDS-DECISION result requiring live UAT sign-off (Sprint 2.5+). Default is
// a safe dry-run. This wrapper never moves stage/CRM and never touches
// FinalStudio; the only place it could ever write is the orchestration/canonical
// merge, which is intentionally withheld here.

export interface ApplyToTenderArgs {
  tenderId: string;
  suggestionIds: string[];
  actorId?: string;
  dryRun?: boolean;
  mode?: "dry_run" | "commit";
}

export async function applyReviewedPatchToTender(
  args: ApplyToTenderArgs,
): Promise<OrchestrationResult<ApplyServiceResult>> {
  const detailsRes = await readTenderTypeDetails(args.tenderId);
  if (!detailsRes.success || !detailsRes.data) {
    return { success: false, error: detailsRes.error ?? "State read failed." };
  }

  const result = applyReviewedPatchService({
    tenderId: args.tenderId,
    typeDetails: detailsRes.data,
    suggestionIds: args.suggestionIds,
    actorId: args.actorId ?? actorName(),
    dryRun: args.dryRun ?? true,
    mode: args.mode ?? "dry_run",
  });

  // GUARD: live commit write-back is intentionally not implemented in Sprint 2.4.
  if (result.mode === "commit") {
    return {
      success: false,
      warning: "commit_requires_live_uat",
      error:
        "Live commit write-back is not enabled in Sprint 2.4 (dry-run only). The apply plan was computed but NOT persisted. Live commit requires UAT sign-off (Sprint 2.5+).",
      data: result,
    };
  }

  // Dry-run: plan only, nothing written.
  return { success: true, data: result };
}
