import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { uploadDocument, type DocumentCategory } from "@/lib/document-vault";
import { addTenderDocument, updateTenderDocumentMetadata } from "@/lib/supabase-tender-actions";
import {
  TENDER_DOCUMENT_CATEGORIES,
  TENDER_DOCUMENT_STATUSES,
  TENDER_DOCUMENT_TYPE_OPTIONS,
  TENDER_STAGE_RELEVANCE,
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
        stage_relevance: document.stage_relevance,
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
        const result = await updateTenderDocumentMetadata(tenderId, document.id, form);
        if (!result.success) throw new Error(result.error);
        toast.success("Document metadata updated.");
      } else if (file) {
        const uploaded = await uploadDocument({
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
        });
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
        const result = await addTenderDocument(tenderId, tenderDocument);
        if (!result.success) throw new Error(result.error);
        toast.success("Document uploaded to tender library.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Document save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Document Metadata" : "Upload Document"}</DialogTitle>
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
              {TENDER_STAGE_RELEVANCE.map(stage => (
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
