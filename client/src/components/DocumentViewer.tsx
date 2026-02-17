/*
 * Document Viewer Engine — Sprint 5 → Sprint 6 Upgrade
 * Production-grade document viewer modal.
 *
 * Fixes:
 *   - PDF rendered via object tag with fallback (no print tab)
 *   - All row/eye clicks open modal, never new tab
 *   - Delete button with soft-delete confirmation
 *   - Restore button for archived documents
 *   - Edit metadata button
 *   - Download triggers real file download
 *
 * Supports:
 *   - PDF: embedded <object> viewer (not iframe to avoid print)
 *   - Images: full-resolution viewer
 *   - Text/CSV: inline preview
 *   - Office docs (DOCX, XLSX, PPTX): metadata + download prompt
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  type UnifiedDocument,
  type DocumentVersion,
  type DocumentCategory,
  type DocumentStatus,
  getMimeCategory,
  getFileTypeColor,
  getCategoryIcon,
  getFileUrl,
  hasRealFile,
  downloadDocument,
  initializeMockFiles,
  softDeleteDocument,
  restoreDocument,
  updateDocumentMetadata,
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
} from "@/lib/document-vault";
import { auditLog } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  Download,
  Clock,
  FileText,
  Image,
  File,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  Briefcase,
  BookOpen,
  Shield,
  Trash2,
  RotateCcw,
  Pencil,
  AlertTriangle,
} from "lucide-react";

// ─── DOCUMENT VIEWER ─────────────────────────────────────────

interface DocumentViewerProps {
  document: UnifiedDocument | null;
  open: boolean;
  onClose: () => void;
  onDocumentChanged?: () => void; // callback after delete/restore/edit
}

export function DocumentViewer({ document: doc, open, onClose, onDocumentChanged }: DocumentViewerProps) {
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditMeta, setShowEditMeta] = useState(false);

  // Initialize mock files on first render
  useEffect(() => {
    initializeMockFiles();
  }, []);

  // Reset state when document changes
  useEffect(() => {
    if (doc) {
      setActiveVersion(doc.currentVersion);
      setShowVersions(false);
      setShowAudit(false);
      setTextContent(null);
      setShowDeleteConfirm(false);
      setShowEditMeta(false);
    }
  }, [doc?.id]);

  // Load text content for text-based files
  useEffect(() => {
    if (!doc || !activeVersion) return;
    const mimeCategory = getMimeCategory(doc.mimeType);
    if (mimeCategory === "text") {
      const url = getFileUrl(doc.id, activeVersion);
      if (url) {
        fetch(url)
          .then(r => r.text())
          .then(setTextContent)
          .catch(() => setTextContent("Unable to load file content."));
      }
    }
  }, [doc?.id, activeVersion]);

  const handleDelete = useCallback(() => {
    if (!doc) return;
    softDeleteDocument(doc.id);
    setShowDeleteConfirm(false);
    onDocumentChanged?.();
    onClose();
  }, [doc, onClose, onDocumentChanged]);

  const handleRestore = useCallback(() => {
    if (!doc) return;
    restoreDocument(doc.id);
    onDocumentChanged?.();
    onClose();
  }, [doc, onClose, onDocumentChanged]);

  if (!doc) return null;

  const isArchived = doc.status === "Archived";
  const mimeCategory = getMimeCategory(doc.mimeType);
  const currentVersionData = doc.versions.find(v => v.versionNumber === activeVersion) || doc.versions[doc.versions.length - 1];
  const fileUrl = activeVersion ? getFileUrl(doc.id, activeVersion) : null;
  const isViewable = hasRealFile(doc) && fileUrl;

  // Get audit entries for this document
  const docAuditEntries = auditLog
    .filter(e => e.entityType === "document" && e.entityId === doc.id)
    .slice(0, 20);

  const statusColors: Record<string, string> = {
    Draft: "bg-amber-100 text-amber-800",
    Final: "bg-emerald-100 text-emerald-800",
    Signed: "bg-blue-100 text-blue-800",
    Superseded: "bg-gray-100 text-gray-600",
    Archived: "bg-red-100 text-red-700",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getCategoryIcon(doc.category)}</span>
                  <DialogTitle className="text-lg font-semibold truncate">{doc.name}</DialogTitle>
                  {isArchived && (
                    <Badge variant="destructive" className="text-xs">Archived</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  <Badge variant="outline" className={getFileTypeColor(doc.fileType)}>
                    {doc.fileType}
                  </Badge>
                  <Badge variant="outline" className={statusColors[doc.status] || ""}>
                    {doc.status}
                  </Badge>
                  <span>v{activeVersion || doc.currentVersion}</span>
                  <span>·</span>
                  <span>{currentVersionData?.fileSize || doc.fileSize}</span>
                  <span>·</span>
                  <span>{doc.customerName}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isViewable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      downloadDocument(doc, activeVersion || undefined);
                    }}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                )}
                {!isArchived && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowEditMeta(true)}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </>
                )}
                {isArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRestore}
                    className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex">
            {/* Main Viewer */}
            <div className="flex-1 overflow-auto bg-muted/30">
              {!isViewable ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                  <File className="h-16 w-16 text-muted-foreground/40 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">No file available</p>
                  <p className="text-sm text-muted-foreground/70 max-w-md">
                    This document does not have a valid file attached. Upload a file to enable viewing.
                  </p>
                </div>
              ) : mimeCategory === "pdf" ? (
                /* Use <object> instead of <iframe> to avoid browser print dialog */
                <object
                  data={`${fileUrl}#toolbar=1&navpanes=0&view=FitH`}
                  type="application/pdf"
                  className="w-full h-full min-h-[500px]"
                  title={doc.name}
                >
                  {/* Fallback if object doesn't render */}
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                    <FileText className="h-16 w-16 text-red-400 mb-4" />
                    <p className="text-lg font-medium mb-2">{doc.fileName}</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      PDF preview is not available in this browser.
                    </p>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        downloadDocument(doc, activeVersion || undefined);
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </object>
              ) : mimeCategory === "image" ? (
                <div className="flex items-center justify-center p-8 min-h-[400px]">
                  <img
                    src={fileUrl}
                    alt={doc.name}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : mimeCategory === "text" ? (
                <div className="p-6">
                  <pre className="bg-background rounded-lg p-4 text-sm font-mono whitespace-pre-wrap border border-border/50 max-h-[500px] overflow-auto">
                    {textContent || "Loading..."}
                  </pre>
                </div>
              ) : (
                /* Office documents and other types */
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                  {mimeCategory === "spreadsheet" ? (
                    <FileText className="h-16 w-16 text-emerald-400 mb-4" />
                  ) : mimeCategory === "document" ? (
                    <FileText className="h-16 w-16 text-blue-400 mb-4" />
                  ) : mimeCategory === "presentation" ? (
                    <Image className="h-16 w-16 text-orange-400 mb-4" />
                  ) : (
                    <File className="h-16 w-16 text-muted-foreground/40 mb-4" />
                  )}
                  <p className="text-lg font-medium mb-2">{doc.fileName}</p>
                  <p className="text-sm text-muted-foreground mb-1">
                    {doc.fileType} file · {doc.fileSize} · v{activeVersion}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mb-6 max-w-md">
                    Preview is not available for {doc.fileType} files. Download the file to open it in the appropriate application.
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      downloadDocument(doc, activeVersion || undefined);
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download {doc.fileName}
                  </Button>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="w-72 border-l border-border/50 overflow-auto flex-shrink-0 bg-background">
              {/* Document Info */}
              <div className="p-4 border-b border-border/30">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{doc.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uploaded by</span>
                    <span className="font-medium">{currentVersionData?.uploadedBy || doc.uploadedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">{currentVersionData?.uploadedAt || doc.uploadDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permission</span>
                    <Badge variant="outline" className="text-xs capitalize">{doc.permissionLevel}</Badge>
                  </div>
                  {doc.tags.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Tags</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.tags.map(t => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {doc.notes && (
                    <div>
                      <span className="text-muted-foreground text-xs">Notes</span>
                      <p className="text-xs mt-0.5 text-foreground/80">{doc.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Entities */}
              {(doc.workspaceId || doc.tenderId) && (
                <div className="p-4 border-b border-border/30">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Linked Entities</h4>
                  <div className="space-y-2">
                    {doc.workspaceId && (
                      <Link href={`/workspaces/${doc.workspaceId}`} onClick={onClose}>
                        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors">
                          <Briefcase className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Workspace</p>
                            <p className="text-sm font-medium truncate">{doc.workspaceName}</p>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </div>
                      </Link>
                    )}
                    {doc.tenderId && (
                      <Link href="/tenders" onClick={onClose}>
                        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors">
                          <BookOpen className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Tender</p>
                            <p className="text-sm font-medium truncate">{doc.tenderName}</p>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Version History */}
              <div className="p-4 border-b border-border/30">
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Versions ({doc.versions.length})
                  </span>
                  {showVersions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showVersions && (
                  <div className="space-y-1.5 mt-2">
                    {[...doc.versions].reverse().map((ver) => (
                      <VersionRow
                        key={ver.versionNumber}
                        version={ver}
                        docId={doc.id}
                        isActive={ver.versionNumber === activeVersion}
                        isCurrent={ver.versionNumber === doc.currentVersion}
                        onSelect={() => setActiveVersion(ver.versionNumber)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Trail */}
              <div className="p-4">
                <button
                  onClick={() => setShowAudit(!showAudit)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
                >
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Audit Trail ({docAuditEntries.length})
                  </span>
                  {showAudit ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showAudit && (
                  <div className="space-y-2 mt-2">
                    {docAuditEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60">No audit entries.</p>
                    ) : (
                      docAuditEntries.map(entry => (
                        <div key={entry.id} className="text-xs p-2 rounded-md bg-muted/40">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium">{entry.userName}</span>
                            <span className="text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{entry.details}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={v => { if (!v) setShowDeleteConfirm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete Document
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground mb-3">
              You are about to delete this document.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              This action will archive the file but keep it in audit history. The document will be removed from normal lists but remain searchable under "Show Archived".
            </p>
            {doc && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{doc.name}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {doc.fileType} · v{doc.currentVersion} · {doc.customerName}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Continue?
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Confirm Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Metadata Modal */}
      {doc && (
        <EditMetadataDialog
          document={doc}
          open={showEditMeta}
          onClose={() => setShowEditMeta(false)}
          onSave={() => {
            setShowEditMeta(false);
            onDocumentChanged?.();
          }}
        />
      )}
    </>
  );
}

// ─── VERSION ROW ─────────────────────────────────────────────

function VersionRow({
  version,
  docId,
  isActive,
  isCurrent,
  onSelect,
}: {
  version: DocumentVersion;
  docId: string;
  isActive: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const hasFile = version.filePath !== null;

  return (
    <button
      onClick={hasFile ? onSelect : undefined}
      disabled={!hasFile}
      className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : hasFile
            ? "hover:bg-accent/50 border border-transparent"
            : "opacity-50 cursor-not-allowed border border-transparent"
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-medium flex items-center gap-1">
          v{version.versionNumber}
          {isCurrent && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">current</Badge>
          )}
        </span>
        {hasFile && (
          <Eye className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      <p className="text-muted-foreground truncate">{version.fileName}</p>
      <div className="flex items-center gap-1 text-muted-foreground/70 mt-0.5">
        <span>{version.uploadedBy}</span>
        <span>·</span>
        <span>{version.uploadedAt}</span>
      </div>
      {version.notes && (
        <p className="text-muted-foreground/60 mt-0.5 truncate">{version.notes}</p>
      )}
    </button>
  );
}

// ─── EDIT METADATA DIALOG ────────────────────────────────────

function EditMetadataDialog({
  document: doc,
  open,
  onClose,
  onSave,
}: {
  document: UnifiedDocument;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState<DocumentCategory>(doc.category);
  const [status, setStatus] = useState<DocumentStatus>(doc.status);
  const [notes, setNotes] = useState(doc.notes);
  const [tagsInput, setTagsInput] = useState(doc.tags.join(", "));

  useEffect(() => {
    if (open) {
      setName(doc.name);
      setCategory(doc.category);
      setStatus(doc.status);
      setNotes(doc.notes);
      setTagsInput(doc.tags.join(", "));
    }
  }, [open, doc]);

  const handleSave = () => {
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    updateDocumentMetadata(doc.id, { name, category, status, notes, tags });
    onSave();
  };

  const editableStatuses = DOCUMENT_STATUSES.filter(s => s !== "Archived");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Document Metadata</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Document Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as DocumentCategory)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DOCUMENT_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as DocumentStatus)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {editableStatuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── UPLOAD DIALOG COMPONENT ─────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (data: {
    name: string;
    category: string;
    file: File;
    notes: string;
    tags: string[];
  }) => void;
  defaultCategory?: string;
  suggestedName?: string;
}

export function UploadDialog({ open, onClose, onUpload, defaultCategory, suggestedName }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(suggestedName || "");
  const [category, setCategory] = useState(defaultCategory || "Supporting");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const categories = DOCUMENT_CATEGORIES;

  useEffect(() => {
    if (open) {
      setFile(null);
      setName(suggestedName || "");
      setCategory(defaultCategory || "Supporting");
      setNotes("");
      setTagsInput("");
    }
  }, [open, suggestedName, defaultCategory]);

  // Auto-suggest name from file
  useEffect(() => {
    if (file && !name) {
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
      setName(baseName);
    }
  }, [file]);

  const handleSubmit = () => {
    if (!file || !name || !category) return;
    const tags = tagsInput
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    onUpload({ name, category, file, notes, tags });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || "unknown type"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
                <File className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click to select a file</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOCX, XLSX, images, and more</p>
              </label>
            )}
          </div>

          {/* Document Name */}
          <div>
            <label className="text-sm font-medium mb-1 block">Document Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter document name..."
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1 block">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. contract, renewal, 2025"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!file || !name || !category}
            >
              Upload Document
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentViewer;
