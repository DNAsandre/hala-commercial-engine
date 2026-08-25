/**
 * TenderDocumentModal.tsx — TCW-T5 documents-chain honesty.
 *
 * The upload path is a THREE-step chain:
 *   1. Supabase Storage upload           (document-vault.uploadDocument)
 *   2. generated_documents row insert    (same call; both steps throw on failure)
 *   3. tender register entry             (addTenderDocument →
 *      type_details.documents on the canonical commercial_tickets row)
 *
 * A step-3 failure AFTER steps 1–2 succeeded used to surface as a generic
 * "Document save failed", inviting a re-upload that would duplicate the stored
 * file. It is now reported as exactly what it is: stored in the vault but NOT
 * listed on this tender. 'saved_with_audit_warning' renders amber, never plain
 * success.
 *
 * NOTE (contract gap, reported to integration): the T1-landed document writers
 * (addTenderDocument / updateTenderDocumentMetadata / changeTenderDocumentStatus)
 * accept NO expectedRevision — they self-guard with a fresh read inside
 * updateTenderDocumentList — so the UI-read-time revision cannot be threaded
 * from here without changing T1's file.
 */
import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { uploadDocument, type DocumentCategory } from "@/lib/document-vault";
import { addTenderDocument, updateTenderDocumentMetadata, type ActionResult } from "@/lib/supabase-tender-actions";
import {
  canonicalTenderDocumentStageRelevance,
  TENDER_DOCUMENT_CATEGORIES,
  TENDER_DOCUMENT_STATUSES,
  TENDER_DOCUMENT_TYPE_OPTIONS,
  TENDER_STAGE_RELEVANCE_OPTIONS,
  type TenderDocument,
  type TenderDocumentCategory,
  type TenderDocumentStatus,
  type TenderStageRelevance,
} from "@/lib/tender-workspace-data";

interface TenderDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenderId: string;
  tenderName: string;
  customerId: string;
  customerName: string;
  document?: TenderDocument | null;
  defaultCategory?: TenderDocumentCategory;
  defaultStage?: TenderStageRelevance;
  onSaved: () => void;
}

function vaultCategoryForTenderCategory(category: TenderDocumentCategory): DocumentCategory {
  if (category === "Supporting") return "Supporting";
  if (category === "Archived") return "Historical";
  return "Tenders";
}

// ─── Honest chain reporting (pure/injectable — exported for tests) ───

/** What actually happened, step by step — the toast layer renders this 1:1. */
export type DocumentSaveReport =
  | { kind: "saved"; amber?: string }
  | { kind: "uploaded_not_linked"; message: string }
  | { kind: "not_saved"; message: string };

/** The honest step-3-failed-after-step-2-succeeded message. */
export function describeUploadLinkFailure(uploadedVaultId: string, reason: string | undefined): string {
  return (
    `The file WAS uploaded to storage and recorded in the document vault (record ${uploadedVaultId}), ` +
    `but adding it to this tender's document list failed: ${reason ?? "no reason was returned"}. ` +
    // PADW T06d (PDS-14): this instruction is now real — the library shows
    // stored-but-unlinked vault files with an exact-id Relink action.
    `Do not upload the file again — that would store a duplicate copy. ` +
    `Open the Documents library: the file appears under "stored but not linked" with a Relink action.`
  );
}

/** Map a confirmed metadata-save ActionResult onto the report contract. */
export function describeMetadataSaveResult(result: ActionResult): DocumentSaveReport {
  if (!result.success) {
    return { kind: "not_saved", message: result.error ?? "Document metadata save failed." };
  }
  return {
    kind: "saved",
    amber: result.status === "saved_with_audit_warning"
      ? result.auditWarning ?? "Saved, but the audit entry was not recorded."
      : undefined,
  };
}

/**
 * Run the upload chain and report each failure mode distinctly:
 *   - steps 1–2 fail  → nothing stored (uploadDocument throws before returning);
 *   - step 3 fails    → stored in the vault but NOT listed on the tender —
 *     reported as such, never as a generic failure and never as success;
 *   - step 3 succeeds → success, amber when the audit append was not recorded.
 */
export async function performDocumentUploadChain<TUploaded extends { id: string }>(deps: {
  upload: () => Promise<TUploaded>;
  link: (uploaded: TUploaded) => Promise<ActionResult>;
}): Promise<DocumentSaveReport> {
  let uploaded: TUploaded;
  try {
    uploaded = await deps.upload();
  } catch (err) {
    return {
      kind: "not_saved",
      message: err instanceof Error ? err.message : "File upload failed before anything was stored.",
    };
  }
  let linkResult: ActionResult;
  try {
    linkResult = await deps.link(uploaded);
  } catch (err) {
    linkResult = { success: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!linkResult.success) {
    return { kind: "uploaded_not_linked", message: describeUploadLinkFailure(uploaded.id, linkResult.error) };
  }
  return {
    kind: "saved",
    amber: linkResult.status === "saved_with_audit_warning"
      ? linkResult.auditWarning ?? "Saved, but the audit entry was not recorded."
      : undefined,
  };
}

function blankForm(defaultCategory: TenderDocumentCategory, defaultStage?: TenderStageRelevance) {
  return {
    document_name: "",
    document_category: defaultCategory,
    document_type: "",
    version: "1",
    status: "Uploaded" as TenderDocumentStatus,
    stage_relevance: defaultStage ? [defaultStage] : [] as TenderStageRelevance[],
    owner: "",
    received_date: "",
    expiry_date: "",
    required_for_submission: false,
    linked_requirement_id: "",
    linked_proposal_section: "",
    source_channel: "",
    buyer_reference_number: "",
    notes: "",
  };
}

export default function TenderDocumentModal({
  open,
  onOpenChange,
  tenderId,
  tenderName,
  customerId,
  customerName,
  document,
  defaultCategory = "Source",
  defaultStage,
  onSaved,
}: TenderDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm(defaultCategory, defaultStage));
  const isEdit = Boolean(document);

  useEffect(() => {
    if (!open) return;
    if (document) {
      setForm({
        document_name: document.document_name,
        document_category: document.document_category,
        document_type: document.document_type,
        version: document.version || "1",
        status: document.status,
        stage_relevance: Array.from(new Set(document.stage_relevance.map(canonicalTenderDocumentStageRelevance))),
        owner: document.owner,
        received_date: document.received_date,
        expiry_date: document.expiry_date,
        required_for_submission: document.required_for_submission,
        linked_requirement_id: document.linked_requirement_id,
        linked_proposal_section: document.linked_proposal_section,
        source_channel: document.source_channel,
        buyer_reference_number: document.buyer_reference_number,
        notes: document.notes,
      });
    } else {
      setForm(blankForm(defaultCategory, defaultStage));
      setFile(null);
    }
  }, [defaultCategory, defaultStage, document, open]);

  const canSave = useMemo(() => {
    return form.document_name.trim() && form.document_category && form.document_type.trim() && form.owner.trim() && form.status && (isEdit || file);
  }, [file, form, isEdit]);

  const toggleStage = (stage: TenderStageRelevance) => {
    setForm(prev => ({
      ...prev,
      stage_relevance: prev.stage_relevance.includes(stage)
        ? prev.stage_relevance.filter(item => item !== stage)
        : [...prev.stage_relevance, stage],
    }));
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Complete the required document fields before saving.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && document) {
        const report = describeMetadataSaveResult(
          await updateTenderDocumentMetadata(tenderId, document.id, form),
        );
        if (report.kind !== "saved") {
          toast.error("Document metadata NOT saved.", { description: report.message });
          return; // dialog stays open; the entry is preserved for retry
        }
        if (report.amber) {
          toast.warning("Document metadata updated.", { description: report.amber });
        } else {
          toast.success("Document metadata updated.", { description: "Confirmed against the stored tender record." });
        }
      } else if (file) {
        const report = await performDocumentUploadChain({
          // Steps 1–2: storage object + generated_documents row (throws on either failure).
          upload: () =>
            uploadDocument({
              name: form.document_name.trim(),
              category: vaultCategoryForTenderCategory(form.document_category),
              customerId: customerId || "unknown",
              customerName: customerName || "Unknown Customer",
              tenderId,
              tenderName,
              file,
              notes: form.notes,
              tags: [],
              permissionLevel: "internal",
            }),
          // Step 3: the tender's own document register (type_details.documents).
          link: (uploaded) => {
            const tenderDocument: TenderDocument = {
              id: uploaded.id,
              tender_id: tenderId,
              document_name: form.document_name.trim(),
              document_category: form.document_category,
              document_type: form.document_type.trim(),
              file_url: "",
              storage_path: uploaded.filePath ?? "",
              version: form.version.trim(),
              status: form.status,
              stage_relevance: form.stage_relevance,
              owner: form.owner.trim(),
              uploaded_by: uploaded.uploadedBy,
              uploaded_at: new Date().toISOString(),
              received_date: form.received_date,
              expiry_date: form.expiry_date,
              required_for_submission: form.required_for_submission,
              linked_requirement_id: form.linked_requirement_id.trim(),
              linked_proposal_section: form.linked_proposal_section.trim(),
              source_channel: form.source_channel.trim(),
              buyer_reference_number: form.buyer_reference_number.trim(),
              notes: form.notes.trim(),
            };
            return addTenderDocument(tenderId, tenderDocument);
          },
        });

        if (report.kind === "not_saved") {
          toast.error("Document NOT saved.", { description: report.message });
          return; // nothing was stored; the dialog keeps the entry for retry
        }
        if (report.kind === "uploaded_not_linked") {
          // Steps 1–2 stored the file; step 3 did not list it on this tender.
          // Close the dialog (a retry via this button would duplicate the file)
          // and refresh so the caller shows the true current state.
          toast.error("Uploaded, but NOT listed on this tender.", {
            description: report.message,
            duration: 15000,
          });
          onSaved();
          onOpenChange(false);
          return;
        }
        if (report.amber) {
          toast.warning("Document uploaded to tender documents.", { description: report.amber });
        } else {
          toast.success("Document uploaded to tender documents.", {
            description: "Storage, vault record and tender listing all confirmed.",
          });
        }
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Document Metadata" : "Upload Document"}</DialogTitle>
          <DialogDescription className="sr-only">
            Add or update a tender document and link it to the relevant tender process stage.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {!isEdit && (
            <div className="md:col-span-2">
              <Label className="text-xs">File</Label>
              <Input type="file" onChange={event => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                if (selected && !form.document_name.trim()) {
                  setForm(prev => ({ ...prev, document_name: selected.name.replace(/\.[^.]+$/, "") }));
                }
              }} />
            </div>
          )}

          <div>
            <Label className="text-xs">Document Name</Label>
            <Input value={form.document_name} onChange={event => setForm(prev => ({ ...prev, document_name: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.document_category} onValueChange={value => setForm(prev => ({ ...prev, document_category: value as TenderDocumentCategory }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TENDER_DOCUMENT_CATEGORIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Document Type</Label>
            <Select value={form.document_type || undefined} onValueChange={value => setForm(prev => ({ ...prev, document_type: value }))}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{TENDER_DOCUMENT_TYPE_OPTIONS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Owner</Label>
            <Input value={form.owner} onChange={event => setForm(prev => ({ ...prev, owner: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={value => setForm(prev => ({ ...prev, status: value as TenderDocumentStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TENDER_DOCUMENT_STATUSES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Version</Label>
            <Input value={form.version} onChange={event => setForm(prev => ({ ...prev, version: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Received Date</Label>
            <Input type="date" value={form.received_date} onChange={event => setForm(prev => ({ ...prev, received_date: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Expiry Date</Label>
            <Input type="date" value={form.expiry_date} onChange={event => setForm(prev => ({ ...prev, expiry_date: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Linked Requirement</Label>
            <Input value={form.linked_requirement_id} onChange={event => setForm(prev => ({ ...prev, linked_requirement_id: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Linked Proposal Section</Label>
            <Input value={form.linked_proposal_section} onChange={event => setForm(prev => ({ ...prev, linked_proposal_section: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Source Channel</Label>
            <Input value={form.source_channel} onChange={event => setForm(prev => ({ ...prev, source_channel: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Buyer Reference Number</Label>
            <Input value={form.buyer_reference_number} onChange={event => setForm(prev => ({ ...prev, buyer_reference_number: event.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">Stage Relevance</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TENDER_STAGE_RELEVANCE_OPTIONS.map(stage => (
                <label key={stage} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs">
                  <Checkbox checked={form.stage_relevance.includes(stage)} onCheckedChange={() => toggleStage(stage)} />
                  {stage}
                </label>
              ))}
            </div>
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-xs">
            <Checkbox checked={form.required_for_submission} onCheckedChange={checked => setForm(prev => ({ ...prev, required_for_submission: checked === true }))} />
            Required for submission
          </label>

          <div className="md:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving} className="gap-1.5">
            <Upload className="h-4 w-4" />
            {saving ? "Saving..." : isEdit ? "Save Metadata" : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
