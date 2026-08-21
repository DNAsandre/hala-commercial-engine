/**
 * TenderPlaceholdersTab.tsx — TCW-T5 rebuild (Tender Functional Closure Wave).
 *
 * REAL register manager for `type_details.submission_readiness.placeholders`
 * on the canonical commercial_tickets tender row (design pin P1):
 *   - the tab READS the register itself through the guarded source-record store
 *     (honest three-state load: loading / failed-with-reason / loaded-empty);
 *   - full row CRUD goes through `updateTenderSubmissionReadinessData`
 *     (section writer, read-back confirmed);
 *   - per-row status changes go through `updatePlaceholderStatus` (exact id,
 *     revision-guarded);
 *   - every write threads `expectedRevision` from this tab's own confirmed
 *     read; 'stale' refusals preserve the user's entry and invite a retry;
 *     'saved_with_audit_warning' renders amber, never plain green.
 *
 * ADVISORY ONLY. Nothing in this register gates stage movement or submission.
 *
 * This file also hosts the SHARED REGISTER FOUNDATION used by
 * TenderRequiredDocumentsTab and TenderComplianceMatrixTab (both T5-owned).
 * It lives here rather than in a new module because the T5 ownership grant
 * enumerates the tab files (+ new tests) only; integration may extract it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Pencil, Plus, RefreshCw, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { createSupabaseTenderSourceRecordStore } from "@/lib/supabase-tender-source-record";
import {
  normalizeSubmissionReadinessFacet,
  readTenderSourceAggregate,
  validateSubmissionReadinessRows,
  SUBMISSION_READINESS_FACET_KEY,
  SUBMISSION_READINESS_SECTION_CONTRACTS,
  type SubmissionReadinessFacet,
  type SubmissionReadinessSectionKey,
  type TenderSourceAggregate,
} from "@/lib/tender-source-record";
import {
  updatePlaceholderStatus,
  updateTenderSubmissionReadinessData,
  type ActionResult,
} from "@/lib/supabase-tender-actions";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";

// ═════════════════════════════════════════════════════════════
// SHARED REGISTER FOUNDATION (T5) — used by all three register tabs
// ═════════════════════════════════════════════════════════════

// ── Load state ───────────────────────────────────────────────

/** Honest three-state register read. `failed` ALWAYS carries the real reason. */
export type RegisterLoadView =
  | { phase: "loading" }
  | { phase: "failed"; message: string }
  | {
      phase: "loaded";
      /** Normalized rows for display (structurally invalid rows dropped HERE only). */
      facet: SubmissionReadinessFacet;
      /** The row's `updated_at` verbatim — the expectedRevision handle for every write. */
      revisionToken: string;
      /** RAW stored rows per section — CRUD builds next-rows from these, never from the normalized view. */
      rawRows: (section: SubmissionReadinessSectionKey) => Array<Record<string, unknown>>;
    };

/**
 * Pure projection from an aggregate read to the tab view. Exported so the
 * three-state honesty is testable without a DOM.
 */
export function projectRegisterLoad(
  aggregate: TenderSourceAggregate | null,
  readError?: string,
): RegisterLoadView {
  if (readError) {
    return { phase: "failed", message: readError };
  }
  if (!aggregate) {
    return {
      phase: "failed",
      message:
        "The canonical tender row could not be read from commercial_tickets (missing or not an active tender), so the register cannot be shown.",
    };
  }
  const raw = aggregate.typeDetails[SUBMISSION_READINESS_FACET_KEY];
  const rawFacet = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return {
    phase: "loaded",
    facet: normalizeSubmissionReadinessFacet(rawFacet),
    revisionToken: aggregate.revision.token,
    rawRows: (section) =>
      Array.isArray(rawFacet[section])
        ? (rawFacet[section] as Array<Record<string, unknown>>)
        : [],
  };
}

const registerStore = createSupabaseTenderSourceRecordStore(supabase);

/**
 * Tab-owned register read. The workspace `ws` prop does not carry the raw
 * register or a revision token, so each register tab performs (and owns) its
 * confirmed read of the same canonical row, and refreshes it after every save.
 */
export function useSubmissionReadinessRegister(tenderId: string): {
  view: RegisterLoadView;
  refresh: () => Promise<RegisterLoadView>;
} {
  const [view, setView] = useState<RegisterLoadView>({ phase: "loading" });
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<RegisterLoadView> => {
    let next: RegisterLoadView;
    try {
      const aggregate = await readTenderSourceAggregate(registerStore, tenderId);
      next = projectRegisterLoad(aggregate);
    } catch (error) {
      next = projectRegisterLoad(null, error instanceof Error ? error.message : String(error));
    }
    if (aliveRef.current) setView(next);
    return next;
  }, [tenderId]);

  useEffect(() => {
    setView({ phase: "loading" });
    void refresh();
  }, [refresh]);

  return { view, refresh };
}

// ── Write outcome mapping ────────────────────────────────────

/** What a confirmed-or-refused tender write means for the UI. */
export type TenderWriteOutcome =
  | { kind: "saved" }
  | { kind: "saved_with_audit_warning"; warning: string }
  | { kind: "stale"; message: string }
  | { kind: "failed"; message: string };

/**
 * Pure ActionResult → UI outcome mapping (P2/P3):
 *   - success only when the action layer confirmed the stored row;
 *   - 'saved_with_audit_warning' is SUCCESS with an amber note, never plain green;
 *   - 'stale' is a non-destructive refusal (entry preserved, retry offered);
 *   - anything else is a failure carrying the service's real reason.
 */
export function describeTenderWriteOutcome(result: ActionResult): TenderWriteOutcome {
  if (result.success) {
    if (result.status === "saved_with_audit_warning") {
      return {
        kind: "saved_with_audit_warning",
        warning:
          result.auditWarning ??
          "Saved, but the audit entry was not recorded (no reason was returned).",
      };
    }
    return { kind: "saved" };
  }
  if (result.status === "stale") {
    return {
      kind: "stale",
      message:
        result.error ??
        "The tender changed after this screen loaded. Review the current value and retry without losing your entry.",
    };
  }
  return { kind: "failed", message: result.error ?? "Tender save failed." };
}

/**
 * Render the outcome as toasts. Returns true when the write is SAVED
 * (including saved-with-audit-warning), so callers know to close dialogs and
 * refresh. Stale/failed → false: the caller keeps the user's entry intact.
 */
export function notifyTenderWriteOutcome(outcome: TenderWriteOutcome, savedMessage: string): boolean {
  switch (outcome.kind) {
    case "saved":
      toast.success(savedMessage, { description: "Confirmed against the stored register." });
      return true;
    case "saved_with_audit_warning":
      toast.warning(savedMessage, { description: outcome.warning });
      return true;
    case "stale":
      toast.warning("Tender changed since this screen loaded — nothing was overwritten.", {
        description: `${outcome.message} Your entry is preserved; the register has been refreshed — review and save again.`,
      });
      return false;
    case "failed":
      toast.error("Not saved.", { description: outcome.message });
      return false;
  }
}

// ── Row helpers (pure) ───────────────────────────────────────

/** Stable id for a new register row. */
export function newRegisterRowId(section: SubmissionReadinessSectionKey): string {
  const prefix = section === "placeholders" ? "ph" : section === "required_documents" ? "rd" : "ci";
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Append or replace-by-id, preserving stored order and sibling rows verbatim. */
export function nextRowsWithUpsert(
  rawRows: Array<Record<string, unknown>>,
  row: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const exists = rawRows.some((r) => r && typeof r === "object" && r.id === row.id);
  return exists
    ? rawRows.map((r) => (r && typeof r === "object" && r.id === row.id ? row : r))
    : [...rawRows, row];
}

/** Remove exactly the row with this id; every other row is byte-preserved. */
export function nextRowsWithout(
  rawRows: Array<Record<string, unknown>>,
  id: string,
): Array<Record<string, unknown>> {
  return rawRows.filter((r) => !(r && typeof r === "object" && r.id === id));
}

/**
 * Pre-flight check: would a full-section write be refused because rows ALREADY
 * stored in this section fail the write contract (missing id/name, unknown
 * status)? Per-item status changes still work in that case; row add/edit/remove
 * would be refused by the write layer — say so up front instead of failing.
 * Returns the write layer's own refusal reason, or null when CRUD is possible.
 */
export function sectionCrudBlocker(
  section: SubmissionReadinessSectionKey,
  rawRows: Array<Record<string, unknown>>,
): string | null {
  return validateSubmissionReadinessRows(section, rawRows);
}

/**
 * Prepare an edited row for the section writer: apply the patch and clear the
 * audit stamps so the write layer re-stamps them with the session actor and
 * save time (stale stamps on an edited row would misreport who/when).
 */
export function patchedRowForSave(
  row: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...row, ...patch, updated_at: "", updated_by: "" };
}

// ── Status metadata (raw canonical statuses, incl. 'na') ─────

export const REGISTER_STATUS_LABELS: Record<SubmissionReadinessSectionKey, Record<string, string>> = {
  placeholders: { pending: "Pending", in_progress: "In Progress", approved: "Approved", na: "N/A" },
  required_documents: { missing: "Missing", in_progress: "In Progress", uploaded: "Uploaded", approved: "Approved", na: "N/A" },
  compliance_items: { pending: "Pending", in_review: "In Review", compliant: "Compliant", non_compliant: "Non-Compliant", na: "N/A" },
};

export function registerStatusLabel(section: SubmissionReadinessSectionKey, status: string): string {
  return REGISTER_STATUS_LABELS[section][status] ?? status;
}

export function registerStatusOptions(section: SubmissionReadinessSectionKey): Array<{ value: string; label: string }> {
  return SUBMISSION_READINESS_SECTION_CONTRACTS[section].statuses.map((value) => ({
    value,
    label: registerStatusLabel(section, value),
  }));
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "text-slate-600 bg-slate-50 border-slate-200",
  missing: "text-red-700 bg-red-50 border-red-200",
  in_progress: "text-amber-700 bg-amber-50 border-amber-200",
  in_review: "text-[#075eea] bg-[#075eea]/10 border-[#075eea]/20",
  uploaded: "text-blue-700 bg-blue-50 border-blue-200",
  approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
  compliant: "text-emerald-700 bg-emerald-50 border-emerald-200",
  non_compliant: "text-red-700 bg-red-50 border-red-200",
  na: "text-slate-500 bg-slate-50 border-slate-200",
};

export function registerStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "text-slate-600 bg-slate-50 border-slate-200";
}

// ── Shared presentational pieces ─────────────────────────────

/** Loading / failed / empty notices — one honest voice for all three tabs. */
export function RegisterStateNotice({
  state,
  onRetry,
}: {
  state: { phase: "loading" } | { phase: "failed"; message: string } | { phase: "empty"; addFirstLabel: string };
  onRetry?: () => void;
}) {
  if (state.phase === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading register…
      </div>
    );
  }
  if (state.phase === "failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/60 p-4">
        <p className="flex items-start gap-2 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The register could not be read — {state.message} This is a read failure, not an empty register.
          </span>
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={onRetry}>
            <RefreshCw className="mr-1 h-3 w-3" /> Retry
          </Button>
        )}
      </div>
    );
  }
  return (
    <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
      {state.addFirstLabel}
    </p>
  );
}

/** Truthful advisory banner (replaces the false B20 "persist" copy). */
export function RegisterAdvisoryBanner({ noun }: { noun: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/30">
      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-xs text-amber-700">
        Advisory register only: {noun} inform submission readiness — nothing here blocks stage movement or
        submission. Saves are confirmed against the stored register before success is shown.
      </p>
    </div>
  );
}

// ── Mutation runners (deps injected so tests can record exact calls) ──

export interface RegisterMutationDeps {
  tenderId: string;
  /** The revision token from this tab's own confirmed register read. */
  revisionToken: string;
}

/** Full-section write (add / edit / remove) through the P1 section writer. */
export async function submitRegisterSectionRows(
  deps: RegisterMutationDeps,
  section: SubmissionReadinessSectionKey,
  nextRows: Array<Record<string, unknown>>,
  reason: string,
  write: typeof updateTenderSubmissionReadinessData = updateTenderSubmissionReadinessData,
): Promise<TenderWriteOutcome> {
  const result = await write(deps.tenderId, section, nextRows, {
    expectedRevision: deps.revisionToken,
    reason,
  });
  return describeTenderWriteOutcome(result);
}

/** Per-item placeholder status change — exact id, revision-guarded. */
export async function submitPlaceholderStatusChange(
  deps: RegisterMutationDeps,
  row: { id: string; label: string; status: string },
  nextStatus: string,
  update: typeof updatePlaceholderStatus = updatePlaceholderStatus,
): Promise<TenderWriteOutcome> {
  const result = await update(
    deps.tenderId,
    row.id,
    row.label,
    row.status,
    nextStatus,
    undefined, // value edits go through the section writer; status change must not clobber the stored value
    { expectedRevision: deps.revisionToken },
  );
  return describeTenderWriteOutcome(result);
}

// ═════════════════════════════════════════════════════════════
// PLACEHOLDERS TAB
// ═════════════════════════════════════════════════════════════

interface PlaceholderFormState {
  id: string | null; // null = new row
  label: string;
  status: string;
  value: string;
  owner: string;
  notes: string;
}

function emptyPlaceholderForm(): PlaceholderFormState {
  return { id: null, label: "", status: "pending", value: "", owner: "", notes: "" };
}

/** UX-level draft validation (the write layer re-validates authoritatively). */
export function validatePlaceholderDraft(form: { label: string }): string | null {
  if (!form.label.trim()) return "A placeholder label is required.";
  return null;
}

function PlaceholderFormDialog({
  form,
  setForm,
  saving,
  onSave,
  onClose,
}: {
  form: PlaceholderFormState;
  setForm: (updater: (prev: PlaceholderFormState) => PlaceholderFormState) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background shadow-2xl">
        <div className="border-b p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-sm font-bold">{form.id ? "Edit Placeholder" : "Add Placeholder"}</h3>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                The save is confirmed against the stored register before it is reported as saved.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <Label className="text-xs">Label</Label>
            <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Bid validity period" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {registerStatusOptions("placeholders").map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Owner</Label>
              <Input value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Value</Label>
            <Input value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} placeholder="The value this placeholder resolves to" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-5">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TenderPlaceholdersTab({
  ws,
  tenderId,
  reload,
}: {
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
}) {
  void ws; // identity comes from tenderId; the register is read from the canonical row itself
  const { view, refresh } = useSubmissionReadinessRegister(tenderId);
  const [form, setForm] = useState<PlaceholderFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const rows = view.phase === "loaded" ? view.facet.placeholders : [];
  const rawRows = useMemo(
    () => (view.phase === "loaded" ? view.rawRows("placeholders") : []),
    [view],
  );
  const crudBlocker = view.phase === "loaded" ? sectionCrudBlocker("placeholders", rawRows) : null;

  const counts = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return { total: rows.length, pending: by("pending"), inProgress: by("in_progress"), approved: by("approved"), na: by("na") };
  }, [rows]);

  const afterSaved = useCallback(async () => {
    await refresh();
    reload();
  }, [refresh, reload]);

  const handleSaveForm = async () => {
    if (view.phase !== "loaded" || !form) return;
    const draftError = validatePlaceholderDraft(form);
    if (draftError) {
      toast.error("Not saved.", { description: draftError });
      return;
    }
    setSaving(true);
    try {
      const existing = form.id ? rawRows.find((r) => r && typeof r === "object" && r.id === form.id) : undefined;
      const patch = {
        label: form.label.trim(),
        status: form.status,
        value: form.value,
        owner: form.owner,
        notes: form.notes,
      };
      const row = existing
        ? patchedRowForSave(existing, patch)
        : { id: newRegisterRowId("placeholders"), ...patch };
      const nextRows = nextRowsWithUpsert(rawRows, row);
      const outcome = await submitRegisterSectionRows(
        { tenderId, revisionToken: view.revisionToken },
        "placeholders",
        nextRows,
        form.id ? `Placeholder edited: ${patch.label}` : `Placeholder added: ${patch.label}`,
      );
      const savedOk = notifyTenderWriteOutcome(
        outcome,
        form.id ? `Placeholder "${patch.label}" updated.` : `Placeholder "${patch.label}" added.`,
      );
      if (savedOk) {
        setForm(null);
        await afterSaved();
      } else if (outcome.kind === "stale") {
        await refresh(); // fresh rows + token for the retry; the dialog keeps the user's entry
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: { id: string; label: string }) => {
    if (view.phase !== "loaded") return;
    setRemovingId(row.id);
    try {
      const outcome = await submitRegisterSectionRows(
        { tenderId, revisionToken: view.revisionToken },
        "placeholders",
        nextRowsWithout(rawRows, row.id),
        `Placeholder removed: ${row.label}`,
      );
      if (notifyTenderWriteOutcome(outcome, `Placeholder "${row.label}" removed.`)) {
        await afterSaved();
      } else if (outcome.kind === "stale") {
        await refresh();
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleStatusChange = async (row: { id: string; label: string; status: string }, nextStatus: string) => {
    if (view.phase !== "loaded" || nextStatus === row.status) return;
    setStatusBusyId(row.id);
    try {
      const outcome = await submitPlaceholderStatusChange(
        { tenderId, revisionToken: view.revisionToken },
        row,
        nextStatus,
      );
      if (
        notifyTenderWriteOutcome(
          outcome,
          `Placeholder "${row.label}": ${registerStatusLabel("placeholders", row.status)} → ${registerStatusLabel("placeholders", nextStatus)}.`,
        )
      ) {
        await afterSaved();
      } else if (outcome.kind === "stale") {
        await refresh();
      }
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <RegisterAdvisoryBanner noun="placeholders" />

      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-5 gap-2">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Pending", value: counts.pending, color: "text-slate-600" },
            { label: "In Progress", value: counts.inProgress, color: "text-amber-600" },
            { label: "Approved", value: counts.approved, color: "text-emerald-600" },
            { label: "N/A", value: counts.na, color: "text-slate-500" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border p-3 text-center">
              <p className={`font-mono text-lg font-bold ${c.color}`}>{c.value}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={view.phase !== "loaded" || Boolean(crudBlocker)}
          onClick={() => setForm(emptyPlaceholderForm())}
        >
          <Plus className="h-3.5 w-3.5" /> Add Placeholder
        </Button>
      </div>

      {crudBlocker && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs text-amber-800">
            Row add/edit/remove is unavailable: the stored section would be refused by the write contract —{" "}
            {crudBlocker} Per-row status changes still work.
          </p>
        </div>
      )}

      {view.phase !== "loaded" ? (
        <RegisterStateNotice state={view} onRetry={() => void refresh()} />
      ) : rows.length === 0 ? (
        <RegisterStateNotice state={{ phase: "empty", addFirstLabel: "No placeholders recorded yet — add the first." }} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Placeholder</th>
                <th className="px-3 py-2 text-left font-semibold">Value</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Updated</th>
                <th className="px-3 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const value = typeof row.value === "string" ? row.value : "";
                const owner = typeof row.owner === "string" ? row.owner : "";
                const notes = typeof row.notes === "string" ? row.notes : "";
                return (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.label}</p>
                      {notes && <p className="mt-0.5 max-w-[280px] truncate text-[10px] text-muted-foreground">{notes}</p>}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2">
                      {value || <span className="italic text-muted-foreground">No value recorded</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{owner || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={row.status}
                          onValueChange={(v) => void handleStatusChange({ id: row.id, label: row.label, status: row.status }, v)}
                          disabled={statusBusyId === row.id || saving}
                        >
                          <SelectTrigger size="sm" className={`h-7 w-[130px] text-[10px] ${registerStatusBadgeClass(row.status)}`}>
                            <SelectValue>{registerStatusLabel("placeholders", row.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {registerStatusOptions("placeholders").map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {statusBusyId === row.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {row.updated_at ? `${row.updated_at.slice(0, 10)} · ${row.updated_by || "unknown"}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          aria-label={`Edit ${row.label}`}
                          disabled={Boolean(crudBlocker) || saving}
                          onClick={() =>
                            setForm({
                              id: row.id,
                              label: row.label,
                              status: row.status,
                              value,
                              owner,
                              notes,
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          aria-label={`Remove ${row.label}`}
                          disabled={Boolean(crudBlocker) || removingId === row.id || saving}
                          onClick={() => void handleRemove({ id: row.id, label: row.label })}
                        >
                          {removingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && view.phase === "loaded" && (
        <PlaceholderFormDialog
          form={form}
          setForm={(updater) => setForm((prev) => (prev ? updater(prev) : prev))}
          saving={saving}
          onSave={() => void handleSaveForm()}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
