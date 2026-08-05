/**
 * SupportingDocumentsPanel — Reusable document upload/capture panel.
 *
 * Available inside every stage of the Proposal Workspace.
 * Each upload captures: category, linked stage, linked tab, owner, version,
 * notes, used in pricing, used in proposal.
 *
 * Upload flow:
 *   1. User selects a file via <input type="file">
 *   2. uploadDocument() uploads the file directly to Supabase Storage
 *   3. The document vault creates the document metadata record
 *   4. Document appears in the list immediately (optimistic)
 *   5. Click any document row to view/download via signed URL
 */
import { useState } from "react";
import {
  Upload, FileText, Plus, ChevronDown, X, AlertTriangle, Loader2, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { uploadDocument, downloadDocument, type UnifiedDocument, type DocumentCategory } from "@/lib/document-vault";
import { resolveDocumentListState, type DocumentListLoadState } from "@/lib/document-runtime";

// ── Document categories ──
export const SUPPORTING_DOC_CATEGORIES = [
  "Customer Requirement",
  "Meeting Transcript",
  "External Vendor Quote",
  "Transport Rate",
  "Warehouse Costing",
  "Finance Input",
  "Legal Input",
  "Operations Input",
  "Old Proposal",
  "Customer Email",
  "SLA Reference",
  "Contract Reference",
  "Implementation Document",
] as const;

export type SupportingDocCategory = typeof SUPPORTING_DOC_CATEGORIES[number] | (string & {});

const PROPOSAL_DOCUMENT_META_PREFIX = "HALA_PROPOSAL_DOCUMENT_META:";

interface ProposalDocumentMeta {
  linkedStage: string;
  linkedTab: string;
  usedInPricing: boolean;
  usedInProposal: boolean;
}

export function encodeProposalDocumentNotes(
  notes: string,
  meta: ProposalDocumentMeta,
): string {
  const marker = `${PROPOSAL_DOCUMENT_META_PREFIX}${JSON.stringify(meta)}`;
  const cleanNotes = notes.trim();
  return cleanNotes ? `${cleanNotes}\n${marker}` : marker;
}

export function decodeProposalDocumentNotes(notes: string | null | undefined): {
  notes: string;
  meta: ProposalDocumentMeta | null;
} {
  const rawNotes = typeof notes === "string" ? notes : "";
  const lines = rawNotes.split(/\r?\n/);
  const markerIndex = lines.findIndex(line => line.startsWith(PROPOSAL_DOCUMENT_META_PREFIX));
  if (markerIndex === -1) return { notes: rawNotes, meta: null };

  const marker = lines[markerIndex].slice(PROPOSAL_DOCUMENT_META_PREFIX.length);
  try {
    const parsed = JSON.parse(marker) as Partial<ProposalDocumentMeta>;
    const linkedStage = typeof parsed.linkedStage === "string" ? parsed.linkedStage.trim() : "";
    const linkedTab = typeof parsed.linkedTab === "string" ? parsed.linkedTab.trim() : "";
    if (!linkedStage || !linkedTab) {
      return { notes: lines.filter((_, index) => index !== markerIndex).join("\n").trim(), meta: null };
    }
    return {
      notes: lines.filter((_, index) => index !== markerIndex).join("\n").trim(),
      meta: {
        linkedStage,
        linkedTab,
        usedInPricing: parsed.usedInPricing === true,
        usedInProposal: parsed.usedInProposal === true,
      },
    };
  } catch {
    return { notes: lines.filter((_, index) => index !== markerIndex).join("\n").trim(), meta: null };
  }
}

export interface SupportingDocument {
  id: string;
  fileName: string;
  category: SupportingDocCategory;
  proposalId?: string;
  proposalName?: string;
  workspaceId?: string;
  workspaceName?: string;
  linkedStage: string;
  linkedTab: string;
  source: string;
  owner: string;
  dateUploaded: string;
  version: number;
  notes: string;
  usedInPricing: boolean;
  usedInProposal: boolean;
  confidenceLevel: "high" | "medium" | "low";
  expiryDate?: string;
}

interface SupportingDocumentsPanelProps {
  linkedStage: string;
  linkedTab: string;
  documents?: SupportingDocument[];
  // Parent can provide a way to add documents to local list, or panel manages its own
  onUpload?: (doc: SupportingDocument) => void;
  proposalId?: string;
  proposalName?: string;
  workspaceId?: string;
  workspaceName?: string;
  customerId?: string;
  customerName?: string;
  // For tender workspaces, pass tender context
  tenderId?: string;
  tenderName?: string;
  /**
   * How the persisted document read went. Loading, a real empty scope and a
   * failed read are three different answers and are rendered differently; a
   * failure persists on screen instead of vanishing with a toast.
   */
  loadState?: DocumentListLoadState;
  loadError?: string | null;
  onRetryLoad?: () => void;
  /** Set only when the server declared the result set was cut short. */
  truncated?: boolean;
  truncationLimit?: number | null;
}

export default function SupportingDocumentsPanel({
  linkedStage,
  linkedTab,
  documents = [],
  onUpload,
  proposalId,
  proposalName,
  workspaceId,
  workspaceName,
  tenderId,
  tenderName,
  customerId,
  customerName,
  loadState = "loaded",
  loadError = null,
  onRetryLoad,
  truncated = false,
  truncationLimit = null,
}: SupportingDocumentsPanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState<SupportingDocCategory>("Customer Requirement");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadUsedPricing, setUploadUsedPricing] = useState(false);
  const [uploadUsedProposal, setUploadUsedProposal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localDocuments, setLocalDocuments] = useState<SupportingDocument[]>([]);

  const allDocuments = [...documents, ...localDocuments.filter(localDoc => !documents.some(doc => doc.id === localDoc.id))];
  const stageDocuments = allDocuments.filter(
    d => d.linkedStage === linkedStage || d.linkedStage === "all"
  );
  // A document uploaded in this session is real regardless of how the read
  // went, so it is still listed; the read failure is reported alongside it.
  const listState = resolveDocumentListState({
    loadState,
    error: loadError,
    count: stageDocuments.length,
    truncated,
    limit: truncationLimit,
  });
  const showFailure = listState.kind === "error";
  const truncationNotice =
    listState.kind === "list" || listState.kind === "empty" ? listState.truncationNotice : null;

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (!uploadName.trim()) {
      toast.error("Please enter a document name.");
      return;
    }

    const documentScopeId = proposalId ?? workspaceId ?? tenderId ?? null;
    const documentScopeName = proposalName ?? workspaceName ?? tenderName ?? null;
    const resolvedCustomerId = customerId ?? proposalId ?? workspaceId ?? tenderId ?? null;
    const resolvedCustomerName = customerName ?? proposalName ?? workspaceName ?? tenderName ?? null;
    if (!documentScopeId || !resolvedCustomerId || !resolvedCustomerName) {
      toast.error("Active proposal context is missing. Document upload was not started.");
      return;
    }

    setUploading(true);
    try {
      const doc = await uploadDocument({
        name: uploadName.trim(),
        category: uploadCategory as any,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        file: selectedFile,
        workspaceId: documentScopeId,
        workspaceName: documentScopeName,
        tenderId: tenderId ?? null,
        tenderName: tenderName ?? null,
        dealId: proposalId ?? null,
        dealName: proposalName ?? null,
        notes: encodeProposalDocumentNotes(uploadNotes, {
          linkedStage,
          linkedTab,
          usedInPricing: uploadUsedPricing,
          usedInProposal: uploadUsedProposal,
        }),
        tags: [],
        permissionLevel: "internal",
      });

      // Convert UnifiedDocument → SupportingDocument for parent callback
      const supportingDoc: SupportingDocument = {
        id: doc.id,
        fileName: doc.fileName,
        category: doc.category as SupportingDocCategory,
        proposalId,
        proposalName,
        workspaceId: documentScopeId,
        workspaceName: documentScopeName ?? undefined,
        linkedStage,
        linkedTab,
        source: "Upload",
        owner: doc.uploadedBy,
        dateUploaded: doc.uploadDate,
        version: doc.currentVersion,
        notes: uploadNotes.trim(),
        usedInPricing: uploadUsedPricing,
        usedInProposal: uploadUsedProposal,
        confidenceLevel: doc.permissionLevel === "restricted" ? "low" : doc.permissionLevel === "internal" ? "medium" : "high",
      };

      if (onUpload) {
        onUpload(supportingDoc);
      } else {
        setLocalDocuments(current => [supportingDoc, ...current]);
      }
      toast.success(`${selectedFile.name} uploaded successfully.`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadName("");
      setUploadNotes("");
      setUploadCategory("Customer Requirement");
      setUploadUsedPricing(false);
      setUploadUsedProposal(false);
      setSelectedFile(null);
      setShowUpload(false);
    }
  };

  const handleDownload = async (doc: SupportingDocument) => {
    try {
      // Reconstruct a minimal UnifiedDocument for downloadDocument
      const unifiedDoc: UnifiedDocument = {
        id: doc.id,
        name: doc.fileName,
        category: doc.category as DocumentCategory,
        customerId: customerId ?? "",
        customerName: customerName ?? "",
        workspaceId: doc.workspaceId ?? proposalId ?? workspaceId ?? null,
        workspaceName: doc.workspaceName ?? proposalName ?? workspaceName ?? null,
        tenderId: tenderId ?? null,
        tenderName: tenderName ?? null,
        dealId: doc.proposalId ?? proposalId ?? null,
        dealName: doc.proposalName ?? proposalName ?? null,
        opportunityId: doc.proposalId ?? proposalId ?? null,
        opportunityName: doc.proposalName ?? proposalName ?? null,
        uploadedBy: doc.owner,
        uploadDate: doc.dateUploaded,
        currentVersion: doc.version,
        status: "Draft",
        notes: doc.notes,
        tags: [],
        fileName: doc.fileName,
        fileSize: "0",
        fileType: doc.fileName.split(".").pop()?.toUpperCase() ?? "FILE",
        mimeType: "application/octet-stream",
        filePath: null,
        permissionLevel: "internal",
        createdBy: doc.owner,
        createdAt: doc.dateUploaded,
        updatedAt: doc.dateUploaded,
        versions: [],
      };
      await downloadDocument(unifiedDoc);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Supporting Documents</span>
          {stageDocuments.length > 0 && (
            <Badge variant="outline" className="text-[9px]">{stageDocuments.length}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={() => setShowUpload(!showUpload)}
        >
          <Plus className="w-3 h-3" />
          Upload
        </Button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <Card className="border border-dashed border-[#075eea]/20 bg-[#075eea]/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#075eea]">New Document</span>
              <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* File input */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Select File</label>
              <input
                type="file"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file && !uploadName.trim()) {
                    // Auto-fill name from filename without extension
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    setUploadName(baseName);
                  }
                }}
                className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#075eea]/20 file:text-xs file:font-medium file:bg-[#075eea]/10 file:text-[#075eea] hover:file:bg-[#075eea]/15 cursor-pointer"
              />
              {selectedFile && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Document name */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Document Name</label>
              <input
                type="text"
                placeholder="e.g. SABIC Master Service Agreement 2025"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[#075eea]/40"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Category</label>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value as SupportingDocCategory)}
                className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[#075eea]/40"
              >
                {SUPPORTING_DOC_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <textarea
              placeholder="Notes (optional)..."
              value={uploadNotes}
              onChange={e => setUploadNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[#075eea]/40 resize-none h-16"
            />

            {/* Pricing / Proposal toggles */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={uploadUsedPricing} onChange={e => setUploadUsedPricing(e.target.checked)}
                  className="rounded border-border" />
                Used in Pricing
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={uploadUsedProposal} onChange={e => setUploadUsedProposal(e.target.checked)}
                  className="rounded border-border" />
                Used in Proposal
              </label>
            </div>

            {/* Linked context */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline" className="text-[8px]">Stage: {linkedStage}</Badge>
              <Badge variant="outline" className="text-[8px]">Tab: {linkedTab}</Badge>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button
                size="sm"
                className="text-xs h-7 bg-[#075eea] hover:bg-[#0655d6]"
                onClick={handleUpload}
                disabled={!selectedFile || !uploadName.trim() || uploading}
              >
                {uploading ? (
                  <>
                    <span className="animate-spin mr-1">⟳</span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3 mr-1" /> Upload Document
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Persistent read failure — NOT an empty list. Consistent with the
          inline error blocks used by the Quote / Proposal / Document sections. */}
      {showFailure && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Supporting documents could not be loaded
          </p>
          <p className="mt-1 text-[10px] text-destructive/80">
            {listState.kind === "error" ? listState.message : ""} This panel is NOT showing an empty document set — the stored documents are unknown.
          </p>
          {onRetryLoad && (
            <Button variant="outline" size="sm" onClick={onRetryLoad} className="mt-2 h-6 text-xs">Retry</Button>
          )}
        </div>
      )}

      {/* Partial result disclosure — the server capped the row set. */}
      {truncationNotice && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{truncationNotice}</span>
        </div>
      )}

      {/* Document list */}
      {listState.kind === "loading" ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading supporting documents…
        </div>
      ) : stageDocuments.length > 0 ? (
        <div className="space-y-2">
          {stageDocuments.map(doc => (
            <div
              key={doc.id}
              onClick={() => handleDownload(doc)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors cursor-pointer"
              title="Click to download"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[8px]">{doc.category}</Badge>
                  <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
                  <span className="text-[10px] text-muted-foreground">{doc.dateUploaded}</span>
                  {doc.usedInPricing && <Badge variant="outline" className="text-[8px] border-[#075eea]/20 text-[#075eea]">Pricing</Badge>}
                  {doc.usedInProposal && <Badge variant="outline" className="text-[8px] border-teal-200 text-teal-600">Proposal</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : showFailure ? null : (
        <div className="py-6 text-center rounded-lg border border-dashed border-border bg-muted/10">
          <Upload className="w-5 h-5 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground/60">No supporting documents uploaded for this stage.</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">Upload customer files, vendor quotes, meeting notes, or any reference documents.</p>
        </div>
      )}
    </div>
  );
}
