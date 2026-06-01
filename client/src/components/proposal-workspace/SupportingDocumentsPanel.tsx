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
 *   3. API route creates the DB record in generated_documents
 *   4. Document appears in the list immediately (optimistic)
 *   5. Click any document row to view/download via signed URL
 */
import { useState } from "react";
import {
  Upload, FileText, Plus, ChevronDown, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { uploadDocument, downloadDocument, type UnifiedDocument, type DocumentCategory } from "@/lib/document-vault";

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

export type SupportingDocCategory = typeof SUPPORTING_DOC_CATEGORIES[number];

export interface SupportingDocument {
  id: string;
  fileName: string;
  category: SupportingDocCategory;
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
  // For tender workspaces, pass tender context
  tenderId?: string;
  tenderName?: string;
  customerId?: string;
  customerName?: string;
}

export default function SupportingDocumentsPanel({
  linkedStage,
  linkedTab,
  documents = [],
  onUpload,
  tenderId,
  tenderName,
  customerId,
  customerName,
}: SupportingDocumentsPanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState<SupportingDocCategory>("Customer Requirement");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadUsedPricing, setUploadUsedPricing] = useState(false);
  const [uploadUsedProposal, setUploadUsedProposal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const stageDocuments = documents.filter(
    d => d.linkedStage === linkedStage || d.linkedStage === "all"
  );

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (!uploadName.trim()) {
      toast.error("Please enter a document name.");
      return;
    }

    setUploading(true);
    try {
      const doc = await uploadDocument({
        name: uploadName.trim(),
        category: uploadCategory as any,
        customerId: customerId ?? "unknown",
        customerName: customerName ?? "Unknown Customer",
        file: selectedFile,
        workspaceId: null,
        workspaceName: null,
        tenderId: tenderId ?? null,
        tenderName: tenderName ?? null,
        notes: uploadNotes,
        tags: [],
        permissionLevel: "internal",
      });

      // Convert UnifiedDocument → SupportingDocument for parent callback
      const supportingDoc: SupportingDocument = {
        id: doc.id,
        fileName: doc.fileName,
        category: doc.category as SupportingDocCategory,
        linkedStage,
        linkedTab,
        source: "Upload",
        owner: doc.uploadedBy,
        dateUploaded: doc.uploadDate,
        version: doc.currentVersion,
        notes: doc.notes,
        usedInPricing: uploadUsedPricing,
        usedInProposal: uploadUsedProposal,
        confidenceLevel: doc.permissionLevel === "restricted" ? "low" : doc.permissionLevel === "internal" ? "medium" : "high",
      };

      onUpload?.(supportingDoc);
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
        workspaceId: null,
        workspaceName: null,
        tenderId: tenderId ?? null,
        tenderName: tenderName ?? null,
        dealId: null,
        dealName: null,
        opportunityId: null,
        opportunityName: null,
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
        <Card className="border border-dashed border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700">New Document</span>
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
                className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-indigo-200 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
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
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Category</label>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value as SupportingDocCategory)}
                className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300"
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
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none h-16"
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
                className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700"
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

      {/* Document list */}
      {stageDocuments.length > 0 ? (
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
                  {doc.usedInPricing && <Badge variant="outline" className="text-[8px] border-violet-200 text-violet-600">Pricing</Badge>}
                  {doc.usedInProposal && <Badge variant="outline" className="text-[8px] border-teal-200 text-teal-600">Proposal</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center rounded-lg border border-dashed border-border bg-muted/10">
          <Upload className="w-5 h-5 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground/60">No supporting documents uploaded for this stage.</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">Upload customer files, vendor quotes, meeting notes, or any reference documents.</p>
        </div>
      )}
    </div>
  );
}