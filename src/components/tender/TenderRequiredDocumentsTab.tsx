/**
 * TenderRequiredDocumentsTab.tsx — TCW-T5 rebuild (Tender Functional Closure Wave).
 *
 * REAL register manager for
 * `type_details.submission_readiness.required_documents` on the canonical
 * commercial_tickets tender row (design pin P1):
 *   - honest three-state load through the tab's own guarded read;
 *   - full row CRUD via `updateTenderSubmissionReadinessData` (read-back
 *     confirmed) and per-row status changes via `updateRequiredDocStatus`
 *     (exact id, revision-guarded);
 *   - `linked_document_id` links a requirement to an UPLOADED tender document
 *     by exact id (full-name display; never fuzzy matching);
 *   - `expectedRevision` threaded from this tab's confirmed read; 'stale'
 *     preserves the entry and invites retry; 'saved_with_audit_warning' is
 *     amber, never plain green.
 *
 * ADVISORY ONLY. Nothing in this register gates stage movement or submission.
 */
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Link2, Loader2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { updateRequiredDocStatus } from "@/lib/supabase-tender-actions";
import { type TenderDocument, type TenderWorkspace } from "@/lib/tender-workspace-data";
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

// ── Linked-document helpers (pure; exact-id matching ONLY) ───

export interface LinkedDocumentOption {
  id: string;
  name: string;
}

/** Uploaded tender documents a requirement can link to (exact stored ids). */
export function documentLinkOptions(documents: TenderDocument[] | undefined): LinkedDocumentOption[] {
  return (documents ?? [])
    .filter((d) => typeof d.id === "string" && d.id.trim())
    .map((d) => ({ id: d.id, name: d.document_name || d.id }));
}

/**
 * Resolve a stored `linked_document_id` to its FULL document name by exact id.
 * A set-but-unresolvable id is reported as such — never fuzzy-matched, never
 * silently blank.
 */
export function linkedDocumentDisplay(
  linkedDocumentId: unknown,
  documents: TenderDocument[] | undefined,
): { linked: boolean; label: string } {
  const id = typeof linkedDocumentId === "string" ? linkedDocumentId.trim() : "";
  if (!id) return { linked: false, label: "Not linked" };
  const match = (documents ?? []).find((d) => d.id === id);
  return match
    ? { linked: true, label: match.document_name || id }
    : { linked: true, label: `Linked document not found in this tender (id ${id})` };
}

/** Per-item required-document status change — exact id, revision-guarded. */
export async function submitRequiredDocStatusChange(
  deps: RegisterMutationDeps,
  row: { id: string; document_name: string; status: string },
  nextStatus: string,
  update: typeof updateRequiredDocStatus = updateRequiredDocStatus,
): Promise<TenderWriteOutcome> {
  const result = await update(
    deps.tenderId,
    row.id,
    row.document_name,
    row.status,
    nextStatus,
    { expectedRevision: deps.revisionToken },
  );
  return describeTenderWriteOutcome(result);
}

/** UX-level draft validation (the write layer re-validates authoritatively). */
export function validateRequiredDocumentDraft(form: { document_name: string }): string | null {
  if (!form.document_name.trim()) return "A document name is required.";
  return null;
}

// ── Form dialog ──────────────────────────────────────────────

const NO_LINK = "__none__";

interface RequiredDocFormState {
  id: string | null;
  document_name: string;
  status: string;
  linked_document_id: string;
  owner: string;
  due_date: string;
  notes: string;
}

function emptyRequiredDocForm(): RequiredDocFormState {
  return { id: null, document_name: "", status: "missing", linked_document_id: "", owner: "", due_date: "", notes: "" };
}

function RequiredDocFormDialog({
  form,
  setForm,
  linkOptions,
  saving,
  onSave,
  onClose,
}: {
  form: RequiredDocFormState;
  setForm: (updater: (prev: RequiredDocFormState) => RequiredDocFormState) => void;
  linkOptions: LinkedDocumentOption[];
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
              <h3 className="font-serif text-sm font-bold">{form.id ? "Edit Required Document" : "Add Required Document"}</h3>
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
            <Label className="text-xs">Document Name</Label>
            <Input
              value={form.document_name}
              onChange={(e) => setForm((p) => ({ ...p, document_name: e.target.value }))}
              placeholder="e.g. Commercial registration certificate"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {registerStatusOptions("required_documents").map((o) => (
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
            <Label className="text-xs">Linked Uploaded Document</Label>
            <Select
              value={form.linked_document_id || NO_LINK}
              onValueChange={(v) => setForm((p) => ({ ...p, linked_document_id: v === NO_LINK ? "" : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Link an uploaded document" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK} className="text-xs">Not linked</SelectItem>
                {linkOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Links by the uploaded document's exact id — the full document name is shown; no fuzzy matching.
            </p>
          </div>
          <div>
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
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

export default function TenderRequiredDocumentsTab({
  ws,
  tenderId,
  reload,
}: {
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
}) {
  const { view, refresh } = useSubmissionReadinessRegister(tenderId);
  const [form, setForm] = useState<RequiredDocFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const rows = view.phase === "loaded" ? view.facet.required_documents : [];
  const rawRows = useMemo(
    () => (view.phase === "loaded" ? view.rawRows("required_documents") : []),
    [view],
  );
  const crudBlocker = view.phase === "loaded" ? sectionCrudBlocker("required_documents", rawRows) : null;
  const linkOptions = useMemo(() => documentLinkOptions(ws.documents), [ws.documents]);

  const counts = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      missing: by("missing"),
      inProgress: by("in_progress"),
      uploaded: by("uploaded"),
      approved: by("approved"),
      na: by("na"),
    };
  }, [rows]);

  const afterSaved = useCallback(async () => {
    await refresh();
    reload();
  }, [refresh, reload]);

  const handleSaveForm = async () => {
    if (view.phase !== "loaded" || !form) return;
    const draftError = validateRequiredDocumentDraft(form);
    if (draftError) {
      toast.error("Not saved.", { description: draftError });
      return;
    }
    setSaving(true);
    try {
      const existing = form.id ? rawRows.find((r) => r && typeof r === "object" && r.id === form.id) : undefined;
      const patch = {
        document_name: form.document_name.trim(),
        status: form.status,
        linked_document_id: form.linked_document_id,
        owner: form.owner,
        due_date: form.due_date,
        notes: form.notes,
      };
      const row = existing
        ? patchedRowForSave(existing, patch)
        : { id: newRegisterRowId("required_documents"), ...patch };
      const outcome = await submitRegisterSectionRows(
        { tenderId, revisionToken: view.revisionToken },
        "required_documents",
        nextRowsWithUpsert(rawRows, row),
        form.id ? `Required document edited: ${patch.document_name}` : `Required document added: ${patch.document_name}`,
      );
      const savedOk = notifyTenderWriteOutcome(
        outcome,
        form.id ? `Required document "${patch.document_name}" updated.` : `Required document "${patch.document_name}" added.`,
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

  const handleRemove = async (row: { id: string; document_name: string }) => {
    if (view.phase !== "loaded") return;
    setRemovingId(row.id);
    try {
      const outcome = await submitRegisterSectionRows(
        { tenderId, revisionToken: view.revisionToken },
        "required_documents",
        nextRowsWithout(rawRows, row.id),
        `Required document removed: ${row.document_name}`,
      );
      if (notifyTenderWriteOutcome(outcome, `Required document "${row.document_name}" removed.`)) {
        await afterSaved();
      } else if (outcome.kind === "stale") {
        await refresh();
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleStatusChange = async (
    row: { id: string; document_name: string; status: string },
    nextStatus: string,
  ) => {
    if (view.phase !== "loaded" || nextStatus === row.status) return;
    setStatusBusyId(row.id);
    try {
      const outcome = await submitRequiredDocStatusChange(
        { tenderId, revisionToken: view.revisionToken },
        row,
        nextStatus,
      );
      if (
        notifyTenderWriteOutcome(
          outcome,
          `"${row.document_name}": ${registerStatusLabel("required_documents", row.status)} → ${registerStatusLabel("required_documents", nextStatus)}.`,
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
      <RegisterAdvisoryBanner noun="required documents" />

      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-6 gap-2">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Missing", value: counts.missing, color: "text-red-600" },
            { label: "In Progress", value: counts.inProgress, color: "text-amber-600" },
            { label: "Uploaded", value: counts.uploaded, color: "text-blue-600" },
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
          onClick={() => setForm(emptyRequiredDocForm())}
        >
          <Plus className="h-3.5 w-3.5" /> Add Required Document
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
          state={{ phase: "empty", addFirstLabel: "No required documents recorded yet — add the first." }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Required Document</th>
                <th className="px-3 py-2 text-left font-semibold">Linked Upload</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Due</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Updated</th>
                <th className="px-3 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const owner = typeof row.owner === "string" ? row.owner : "";
                const dueDate = typeof row.due_date === "string" ? row.due_date : "";
                const notes = typeof row.notes === "string" ? row.notes : "";
                const linkedId = typeof row.linked_document_id === "string" ? row.linked_document_id : "";
                const link = linkedDocumentDisplay(linkedId, ws.documents);
                return (
                  <tr key={row.id} className={`border-t border-border hover:bg-muted/30 ${row.status === "missing" ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2">
                      <p className="flex items-center gap-1.5 font-medium">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {row.document_name}
                      </p>
                      {notes && <p className="mt-0.5 max-w-[260px] truncate text-[10px] text-muted-foreground">{notes}</p>}
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      {link.linked ? (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Link2 className="h-3 w-3 shrink-0 text-[#075eea]" />
                          <span className="truncate" title={link.label}>{link.label}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{owner || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{dueDate || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={row.status}
                          onValueChange={(v) =>
                            void handleStatusChange(
                              { id: row.id, document_name: row.document_name, status: row.status },
                              v,
                            )
                          }
                          disabled={statusBusyId === row.id || saving}
                        >
                          <SelectTrigger size="sm" className={`h-7 w-[130px] text-[10px] ${registerStatusBadgeClass(row.status)}`}>
                            <SelectValue>{registerStatusLabel("required_documents", row.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {registerStatusOptions("required_documents").map((o) => (
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
                          aria-label={`Edit ${row.document_name}`}
                          disabled={Boolean(crudBlocker) || saving}
                          onClick={() =>
                            setForm({
                              id: row.id,
                              document_name: row.document_name,
                              status: row.status,
                              linked_document_id: linkedId,
                              owner,
                              due_date: dueDate,
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
                          aria-label={`Remove ${row.document_name}`}
                          disabled={Boolean(crudBlocker) || removingId === row.id || saving}
                          onClick={() => void handleRemove({ id: row.id, document_name: row.document_name })}
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
        <RequiredDocFormDialog
          form={form}
          setForm={(updater) => setForm((prev) => (prev ? updater(prev) : prev))}
          linkOptions={linkOptions}
          saving={saving}
          onSave={() => void handleSaveForm()}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
