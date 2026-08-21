/**
 * TenderComplianceMatrixTab.tsx — TCW-T5 rebuild (Tender Functional Closure Wave).
 *
 * REAL register manager for
 * `type_details.submission_readiness.compliance_items` on the canonical
 * commercial_tickets tender row (design pin P1):
 *   - honest three-state load through the tab's own guarded read;
 *   - full row CRUD via `updateTenderSubmissionReadinessData` (read-back
 *     confirmed) and per-row status changes via `updateComplianceStatus`
 *     (exact id, revision-guarded);
 *   - rows carry `evidence` and `source_reference` (supporting text + where in
 *     the tender documents the requirement comes from);
 *   - `expectedRevision` threaded from this tab's confirmed read; 'stale'
 *     preserves the entry and invites retry; 'saved_with_audit_warning' is
 *     amber, never plain green.
 *
 * ADVISORY ONLY. Compliance verdicts here are recorded observations for
 * review — nothing gates stage movement or submission.
 */
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Plus, Scale, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { updateComplianceStatus } from "@/lib/supabase-tender-actions";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  newRegisterRowId,
  nextRowsWithout,
  nextRowsWithUpsert,
  notifyTenderWriteOutcome,
  patchedRowForSave,
  RegisterAdvisoryBanner,
  RegisterStateNotice,
  registerStatusBadgeClass,
  registerStatusLabel,
  registerStatusOptions,
  sectionCrudBlocker,
  submitRegisterSectionRows,
  useSubmissionReadinessRegister,
  describeTenderWriteOutcome,
  type RegisterMutationDeps,
  type TenderWriteOutcome,
} from "./TenderPlaceholdersTab";

/**
 * Per-item compliance status change — exact id, revision-guarded. `evidence`
 * is NOT passed on a bare status change so the stored evidence is preserved;
 * evidence edits go through the section writer.
 */
export async function submitComplianceStatusChange(
  deps: RegisterMutationDeps,
  row: { id: string; requirement: string; status: string },
  nextStatus: string,
  update: typeof updateComplianceStatus = updateComplianceStatus,
): Promise<TenderWriteOutcome> {
  const result = await update(
    deps.tenderId,
    row.id,
    row.requirement,
    row.status,
    nextStatus,
    undefined,
    { expectedRevision: deps.revisionToken },
  );
  return describeTenderWriteOutcome(result);
}

/** UX-level draft validation (the write layer re-validates authoritatively). */
export function validateComplianceDraft(form: { requirement: string }): string | null {
  if (!form.requirement.trim()) return "A requirement text is required.";
  return null;
}

// ── Form dialog ──────────────────────────────────────────────

interface ComplianceFormState {
  id: string | null;
  requirement: string;
  status: string;
  evidence: string;
  source_reference: string;
  owner: string;
  notes: string;
}

function emptyComplianceForm(): ComplianceFormState {
  return { id: null, requirement: "", status: "pending", evidence: "", source_reference: "", owner: "", notes: "" };
}

function ComplianceFormDialog({
  form,
  setForm,
  saving,
  onSave,
  onClose,
}: {
  form: ComplianceFormState;
  setForm: (updater: (prev: ComplianceFormState) => ComplianceFormState) => void;
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
              <h3 className="font-serif text-sm font-bold">{form.id ? "Edit Compliance Item" : "Add Compliance Item"}</h3>
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
            <Label className="text-xs">Requirement</Label>
            <Textarea
              value={form.requirement}
              onChange={(e) => setForm((p) => ({ ...p, requirement: e.target.value }))}
              placeholder="The compliance requirement as stated in the tender"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {registerStatusOptions("compliance_items").map((o) => (
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
            <Label className="text-xs">Source Reference</Label>
            <Input
              value={form.source_reference}
              onChange={(e) => setForm((p) => ({ ...p, source_reference: e.target.value }))}
              placeholder="Where the requirement comes from, e.g. RFQ §4.2"
            />
          </div>
          <div>
            <Label className="text-xs">Evidence</Label>
            <Textarea
              value={form.evidence}
              onChange={(e) => setForm((p) => ({ ...p, evidence: e.target.value }))}
              placeholder="How compliance is evidenced (certificate, document, statement…)"
            />
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

// ── Main component ───────────────────────────────────────────

export default function TenderComplianceMatrixTab({
  ws,
  tenderId,
  reload,
}: {
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
}) {
  void ws;
  const { view, refresh } = useSubmissionReadinessRegister(tenderId);
  const [form, setForm] = useState<ComplianceFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const rows = view.phase === "loaded" ? view.facet.compliance_items : [];
  const rawRows = useMemo(
    () => (view.phase === "loaded" ? view.rawRows("compliance_items") : []),
    [view],
  );
  const crudBlocker = view.phase === "loaded" ? sectionCrudBlocker("compliance_items", rawRows) : null;

  const counts = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      pending: by("pending"),
      inReview: by("in_review"),
      compliant: by("compliant"),
      nonCompliant: by("non_compliant"),
      na: by("na"),
    };
  }, [rows]);

  const afterSaved = useCallback(async () => {
    await refresh();
    reload();
  }, [refresh, reload]);

  const handleSaveForm = async () => {
    if (view.phase !== "loaded" || !form) return;
    const draftError = validateComplianceDraft(form);
    if (draftError) {
      toast.error("Not saved.", { description: draftError });
      return;
    }
    setSaving(true);
    try {
      const existing = form.id ? rawRows.find((r) => r && typeof r === "object" && r.id === form.id) : undefined;
      const patch = {
        requirement: form.requirement.trim(),
        status: form.status,
        evidence: form.evidence,
        source_reference: form.source_reference,
        owner: form.owner,
        notes: form.notes,
      };
      const row = existing
        ? patchedRowForSave(existing, patch)
        : { id: newRegisterRowId("compliance_items"), ...patch };
      const outcome = await submitRegisterSectionRows(
        { tenderId, revisionToken: view.revisionToken },
        "compliance_items",
        nextRowsWithUpsert(rawRows, row),
        form.id ? `Compliance item edited: ${patch.requirement}` : `Compliance item added: ${patch.requirement}`,
      );
      const savedOk = notifyTenderWriteOutcome(
        outcome,
        form.id ? "Compliance item updated." : "Compliance item added.",
      );
      if (savedOk) {
        setForm(null);
        await afterSaved();
      } else if (outcome.kind === "stale") {
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: { id: string; requirement: string }) => {
    if (view.phase !== "loaded") return;
    setRemovingId(row.id);
    try {
      const outcome = await submitRegisterSectionRows(
        { tenderId, revisionToken: view.revisionToken },
        "compliance_items",
        nextRowsWithout(rawRows, row.id),
        `Compliance item removed: ${row.requirement}`,
      );
      if (notifyTenderWriteOutcome(outcome, "Compliance item removed.")) {
        await afterSaved();
      } else if (outcome.kind === "stale") {
        await refresh();
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleStatusChange = async (
    row: { id: string; requirement: string; status: string },
    nextStatus: string,
  ) => {
    if (view.phase !== "loaded" || nextStatus === row.status) return;
    setStatusBusyId(row.id);
    try {
      const outcome = await submitComplianceStatusChange(
        { tenderId, revisionToken: view.revisionToken },
        row,
        nextStatus,
      );
      if (
        notifyTenderWriteOutcome(
          outcome,
          `Compliance: ${registerStatusLabel("compliance_items", row.status)} → ${registerStatusLabel("compliance_items", nextStatus)}.`,
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
      <RegisterAdvisoryBanner noun="compliance items" />

      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-6 gap-2">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Pending", value: counts.pending, color: "text-slate-600" },
            { label: "In Review", value: counts.inReview, color: "text-[#075eea]" },
            { label: "Compliant", value: counts.compliant, color: "text-emerald-600" },
            { label: "Non-Compliant", value: counts.nonCompliant, color: "text-red-600" },
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
          onClick={() => setForm(emptyComplianceForm())}
        >
          <Plus className="h-3.5 w-3.5" /> Add Compliance Item
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
        <RegisterStateNotice
          state={{ phase: "empty", addFirstLabel: "No compliance items recorded yet — add the first." }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Requirement</th>
                <th className="px-3 py-2 text-left font-semibold">Source Ref</th>
                <th className="px-3 py-2 text-left font-semibold">Evidence</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Updated</th>
                <th className="px-3 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const evidence = typeof row.evidence === "string" ? row.evidence : "";
                const sourceReference = typeof row.source_reference === "string" ? row.source_reference : "";
                const owner = typeof row.owner === "string" ? row.owner : "";
                const notes = typeof row.notes === "string" ? row.notes : "";
                const isGap = row.status === "non_compliant";
                return (
                  <tr key={row.id} className={`border-t border-border hover:bg-muted/30 ${isGap ? "border-l-2 border-l-red-400 bg-red-50/40" : ""}`}>
                    <td className="max-w-[280px] px-3 py-2">
                      <p className="flex items-start gap-1.5 font-medium leading-snug">
                        <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{row.requirement}</span>
                      </p>
                      {notes && <p className="mt-0.5 max-w-[260px] truncate text-[10px] text-muted-foreground">{notes}</p>}
                    </td>
                    <td className="max-w-[130px] truncate px-3 py-2 font-mono text-[10px] text-muted-foreground" title={sourceReference}>
                      {sourceReference || "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[10px] text-muted-foreground" title={evidence}>
                      {evidence || <span className="italic">No evidence recorded</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{owner || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={row.status}
                          onValueChange={(v) =>
                            void handleStatusChange({ id: row.id, requirement: row.requirement, status: row.status }, v)
                          }
                          disabled={statusBusyId === row.id || saving}
                        >
                          <SelectTrigger size="sm" className={`h-7 w-[140px] text-[10px] ${registerStatusBadgeClass(row.status)}`}>
                            <SelectValue>{registerStatusLabel("compliance_items", row.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {registerStatusOptions("compliance_items").map((o) => (
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
                          aria-label={`Edit compliance item ${row.id}`}
                          disabled={Boolean(crudBlocker) || saving}
                          onClick={() =>
                            setForm({
                              id: row.id,
                              requirement: row.requirement,
                              status: row.status,
                              evidence,
                              source_reference: sourceReference,
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
                          aria-label={`Remove compliance item ${row.id}`}
                          disabled={Boolean(crudBlocker) || removingId === row.id || saving}
                          onClick={() => void handleRemove({ id: row.id, requirement: row.requirement })}
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
        <ComplianceFormDialog
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
