import { getCurrentUser } from "./auth-state";
/*
 * Unified Document Architecture — Production-Grade File Infrastructure
 * Sprint 5: Real file-backed document storage.
 *
 * ⚠️ FUTURE WIRE — DOCUMENT RECORDS LOAD FROM REAL SOURCES
 * ════════════════════════════════════════════════════
 * TARGET WIRING:
 *   documentVault[]     → Supabase `document_vault` table
 *   Version history     → Supabase `document_versions` table
 *   File content        → Supabase Storage (S3-compatible)
 *   Approval chains     → Supabase `document_approvals` table
 *
 * Do not add hardcoded documents. Load from Supabase or explicit uploads only.
 *
 * Architecture:
 *   1. Every document belongs to a Customer (customerId)
 *   2. Documents are categorized into folders (category)
 *   3. Optional links to Workspace, Tender, Opportunity, Deal
 *   4. Versioning: replace file while retaining history
 *   5. Soft delete via archive (no permanent delete)
 *   6. All actions logged to audit trail
 *   7. Real file storage via browser Blob URLs (in-memory file registry)
 *   8. mime_type and file_path are required for clickable documents
 *   9. No placeholder documents — every entry must reference a real file
 *
 * File Storage Strategy (frontend-only, no backend):
 *   - Uploaded files are stored as Blob URLs via URL.createObjectURL()
 *   - A fileRegistry maps document version IDs to Blob URLs
 *   - Documents without valid file_path are rendered as non-clickable
 */

import { type AuditEntry } from "./store";
import { syncAuditEntry } from "./supabase-sync";
import { supabase } from "./supabase";

// ─── DOCUMENT CATEGORIES (Folder Structure) ──────────────────

export type DocumentCategory =
  | "Contracts"
  | "SLAs"
  | "Tenders"
  | "Quotes"
  | "Compliance"
  | "Insurance"
  | "Financial"
  | "Correspondence"
  | "Historical"
  | "Proposals"
  | "ECR"
  | "P&L"
  | "Supporting";

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "Contracts",
  "SLAs",
  "Tenders",
  "Quotes",
  "Proposals",
  "Compliance",
  "Insurance",
  "Financial",
  "P&L",
  "ECR",
  "Correspondence",
  "Historical",
  "Supporting",
];

export type DocumentStatus = "Draft" | "Final" | "Signed" | "Superseded" | "Archived";

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "Draft",
  "Final",
  "Signed",
  "Superseded",
  "Archived",
];

// ─── MIME TYPE HELPERS ──────────────────────────────────────────

export type MimeCategory = "pdf" | "image" | "text" | "spreadsheet" | "document" | "presentation" | "other";

export function getMimeCategory(mimeType: string): MimeCategory {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "text";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv"
  ) return "spreadsheet";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) return "document";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  ) return "presentation";
  return "other";
}

export function extensionToMime(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    csv: "text/csv",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

export function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "application/vnd.ms-powerpoint": "PPT",
    "text/csv": "CSV",
    "text/plain": "TXT",
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
    "image/webp": "WEBP",
  };
  return map[mime] || "FILE";
}

// ─── FILE REGISTRY (Real File Storage) ──────────────────────────

/**
 * Maps "docId:versionNumber" → Blob URL.
 * For uploaded files, the Blob URL is created from the actual File object.
 * Document records must come from Supabase or explicit user uploads.
 */
const fileRegistry = new Map<string, string>();

/** Store a real file and return its Blob URL */
export function storeFile(docId: string, versionNumber: number, file: File): string {
  const key = `${docId}:${versionNumber}`;
  // Revoke old URL if exists
  const old = fileRegistry.get(key);
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(file);
  fileRegistry.set(key, url);
  return url;
}

/** Get the Blob URL for a specific document version */
export function getFileUrl(docId: string, versionNumber: number): string | null {
  return fileRegistry.get(`${docId}:${versionNumber}`) || null;
}

/** Get a signed download URL for a Supabase Storage document */
export async function getSignedDownloadUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from("documents").createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}

/** Get the Blob URL for the current version of a document */
export function getCurrentFileUrl(doc: UnifiedDocument): string | null {
  return getFileUrl(doc.id, doc.currentVersion);
}

/** Check if a document has a real file stored */
export function hasRealFile(doc: UnifiedDocument): boolean {
  return doc.filePath !== null && doc.filePath !== "";
}

/** Revoke all Blob URLs (cleanup) */
export function revokeAllFiles(): void {
  fileRegistry.forEach(url => URL.revokeObjectURL(url));
  fileRegistry.clear();
}

// ─── DOCUMENT ENTITY ─────────────────────────────────────────

export interface DocumentVersion {
  versionNumber: number;
  fileName: string;
  fileSize: string;
  fileType: string;
  mimeType: string;
  filePath: string | null; // Blob URL or null
  uploadedBy: string;
  uploadedAt: string;
  notes: string;
}

export interface UnifiedDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  customerId: string;
  customerName: string;

  // Optional links
  workspaceId: string | null;
  workspaceName: string | null;
  tenderId: string | null;
  tenderName: string | null;
  dealId: string | null;
  dealName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;

  // Metadata
  uploadedBy: string;
  uploadDate: string;
  currentVersion: number;
  status: DocumentStatus;
  notes: string;
  tags: string[];

  // File info (current version)
  fileName: string;
  fileSize: string;
  fileType: string;
  mimeType: string;
  filePath: string | null; // Blob URL for real files, null for placeholder

  // Version history
  versions: DocumentVersion[];

  // Permission-ready (not enforced yet)
  permissionLevel: "public" | "internal" | "restricted";

  // Timestamps
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// EMPTY DOCUMENT STORE

export const documentVault: UnifiedDocument[] = [];

export function initializeDocumentVault(): void {
  // No local document records are seeded here. Documents arrive through
  // Supabase-backed uploads or explicit API-loaded records only.
}

// ─── QUERY HELPERS ───────────────────────────────────────────

export function getDocumentsByCustomer(customerId: string): UnifiedDocument[] {
  return documentVault.filter(d => d.customerId === customerId && d.status !== "Archived");
}

export function getAllDocumentsByCustomer(customerId: string): UnifiedDocument[] {
  return documentVault.filter(d => d.customerId === customerId);
}

export function getDocumentsByWorkspace(workspaceId: string, includeArchived = false): UnifiedDocument[] {
  return documentVault.filter(d => d.workspaceId === workspaceId && (includeArchived || d.status !== "Archived"));
}

export function getDocumentsByTender(tenderId: string, includeArchived = false): UnifiedDocument[] {
  return documentVault.filter(d => d.tenderId === tenderId && (includeArchived || d.status !== "Archived"));
}

export function getDocumentsByCategory(customerId: string, category: DocumentCategory): UnifiedDocument[] {
  return documentVault.filter(d => d.customerId === customerId && d.category === category && d.status !== "Archived");
}

export function getDocumentById(id: string): UnifiedDocument | undefined {
  return documentVault.find(d => d.id === id);
}

export function getDocumentCounts(customerId: string): Record<DocumentCategory, number> {
  const counts = {} as Record<DocumentCategory, number>;
  for (const cat of DOCUMENT_CATEGORIES) {
    counts[cat] = documentVault.filter(d => d.customerId === customerId && d.category === cat && d.status !== "Archived").length;
  }
  return counts;
}

// ─── CRUD OPERATIONS ─────────────────────────────────────────

export interface UploadDocumentInput {
  name: string;
  category: DocumentCategory;
  customerId: string;
  customerName: string;
  file: File;
  workspaceId?: string | null;
  workspaceName?: string | null;
  tenderId?: string | null;
  tenderName?: string | null;
  dealId?: string | null;
  dealName?: string | null;
  status?: DocumentStatus;
  notes?: string;
  tags?: string[];
  uploadedBy?: string;
  permissionLevel?: "public" | "internal" | "restricted";
}

/**
 * Upload a real file and create a document entry in Supabase Storage.
 * File is uploaded directly from browser to Supabase Storage.
 * DB record is created via the API.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<UnifiedDocument> {
  const now = new Date().toISOString().slice(0, 10);
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = input.file.type || extensionToMime(ext);
  const fileType = mimeToExtension(mimeType) || ext.toUpperCase();
  const fileSize = formatFileSize(input.file.size);
  const uploadedBy = input.uploadedBy ?? getCurrentUser().name;

  const BUCKET = "documents";
  const date = new Date().toISOString().split("T")[0];
  const safeName = input.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
  const storagePath = `customers/${input.customerId}/workspaces/${input.workspaceId || "unassigned"}/${input.category}/${date}-${safeName}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  // Upload file directly from browser to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    console.error("[document-vault] Storage upload failed:", uploadErr);
    throw new Error(`File upload failed: ${uploadErr.message}`);
  }

  // Create DB record via API
  let docId: string;
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      category: input.category,
      customerId: input.customerId,
      customerName: input.customerName,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      tenderId: input.tenderId,
      tenderName: input.tenderName,
      fileName: input.file.name,
      fileSize: String(input.file.size),
      mimeType,
      storagePath,
      notes: input.notes,
      tags: input.tags,
      permissionLevel: input.permissionLevel ?? "internal",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Failed to create document record");
  }

  const created = await res.json();
  docId = created.data.id;

  // Build the UnifiedDocument to return (for local in-memory state)
  const doc: UnifiedDocument = {
    id: docId,
    name: input.name,
    category: input.category,
    customerId: input.customerId,
    customerName: input.customerName,
    workspaceId: input.workspaceId ?? null,
    workspaceName: input.workspaceName ?? null,
    tenderId: input.tenderId ?? null,
    tenderName: input.tenderName ?? null,
    dealId: input.dealId ?? null,
    dealName: input.dealName ?? null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy,
    uploadDate: now,
    currentVersion: 1,
    status: input.status ?? "Draft",
    notes: input.notes ?? "",
    tags: input.tags ?? [],
    fileName: input.file.name,
    fileSize,
    fileType,
    mimeType,
    filePath: storagePath,
    permissionLevel: input.permissionLevel ?? "internal",
    createdBy: uploadedBy,
    createdAt: now,
    updatedAt: now,
    versions: [{
      versionNumber: 1,
      fileName: input.file.name,
      fileSize,
      fileType,
      mimeType,
      filePath: storagePath,
      uploadedBy,
      uploadedAt: now,
      notes: input.notes || "Initial upload",
    }],
  };

  documentVault.unshift(doc);
  logDocumentAction(doc, "document_uploaded", `Document "${doc.name}" uploaded to ${doc.category} folder for ${doc.customerName}.`);
  return doc;
}

/** Legacy createDocument for backward compatibility */
export interface CreateDocumentInput {
  name: string;
  category: DocumentCategory;
  customerId: string;
  customerName: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  tenderId?: string | null;
  tenderName?: string | null;
  opportunityId?: string | null;
  opportunityName?: string | null;
  status: DocumentStatus;
  notes: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadedBy: string;
  permissionLevel?: "public" | "internal" | "restricted";
}

export function createDocument(input: CreateDocumentInput): UnifiedDocument {
  const now = new Date().toISOString().slice(0, 10);
  const ext = input.fileName.split(".").pop()?.toLowerCase() || "";
  const mimeType = extensionToMime(ext);
  const doc: UnifiedDocument = {
    id: `doc-${crypto.randomUUID()}`,
    name: input.name,
    category: input.category,
    customerId: input.customerId,
    customerName: input.customerName,
    workspaceId: input.workspaceId ?? null,
    workspaceName: input.workspaceName ?? null,
    tenderId: input.tenderId ?? null,
    tenderName: input.tenderName ?? null,
    dealId: null,
    dealName: null,
    opportunityId: input.opportunityId ?? null,
    opportunityName: input.opportunityName ?? null,
    uploadedBy: input.uploadedBy,
    uploadDate: now,
    currentVersion: 1,
    status: input.status,
    notes: input.notes,
    tags: [],
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
    mimeType,
    filePath: null,
    permissionLevel: input.permissionLevel ?? "internal",
    createdBy: input.uploadedBy,
    createdAt: now,
    updatedAt: now,
    versions: [{
      versionNumber: 1,
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileType: input.fileType,
      mimeType,
      filePath: null,
      uploadedBy: input.uploadedBy,
      uploadedAt: now,
      notes: input.notes || "Initial upload",
    }],
  };
  documentVault.unshift(doc);
  logDocumentAction(doc, "document_uploaded", `Document "${doc.name}" uploaded to ${doc.category} folder for ${doc.customerName}.`);
  return doc;
}

export function updateDocumentVersion(
  docId: string,
  newFileName: string,
  newFileSize: string,
  newFileType: string,
  uploadedBy: string,
  notes: string,
): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;

  const oldVersion = doc.currentVersion;
  doc.currentVersion += 1;
  doc.fileName = newFileName;
  doc.fileSize = newFileSize;
  doc.fileType = newFileType;
  doc.uploadDate = new Date().toISOString().slice(0, 10);
  doc.updatedAt = doc.uploadDate;

  const ext = newFileName.split(".").pop()?.toLowerCase() || "";
  const mimeType = extensionToMime(ext);
  doc.mimeType = mimeType;

  if (doc.status === "Final" || doc.status === "Signed") {
    // B5 FIX: Audit the status downgrade before mutating
    logDocumentAction(doc, "document_status_downgraded",
      `Document "${doc.name}" status downgraded from "${doc.status}" to "Draft" due to new version upload by ${uploadedBy}.`);
    doc.status = "Draft";
  }

  doc.versions.push({
    versionNumber: doc.currentVersion,
    fileName: newFileName,
    fileSize: newFileSize,
    fileType: newFileType,
    mimeType,
    filePath: null,
    uploadedBy,
    uploadedAt: doc.uploadDate,
    notes,
  });

  logDocumentAction(doc, "document_version_replaced", `Document "${doc.name}" updated from v${oldVersion} to v${doc.currentVersion} by ${uploadedBy}. ${notes}`);
  return doc;
}

export function updateDocumentMetadata(
  docId: string,
  updates: Partial<Pick<UnifiedDocument, "name" | "category" | "status" | "notes" | "workspaceId" | "workspaceName" | "tenderId" | "tenderName" | "opportunityId" | "opportunityName" | "permissionLevel" | "tags">>,
): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;

  const changes: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && (doc as any)[key] !== value) {
      changes.push(`${key}: "${(doc as any)[key]}" → "${value}"`);
      (doc as any)[key] = value;
    }
  }

  if (changes.length > 0) {
    doc.updatedAt = new Date().toISOString().slice(0, 10);
    logDocumentAction(doc, "document_updated", `Document "${doc.name}" metadata updated: ${changes.join(", ")}.`);
  }
  return doc;
}

export function archiveDocument(docId: string): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "Archived";
  doc.updatedAt = new Date().toISOString().slice(0, 10);
  logDocumentAction(doc, "document_archived", `Document "${doc.name}" archived by admin.`);
  return doc;
}

/**
 * Soft delete: sets status to "Archived", keeps in vault, logs audit.
 * Document remains searchable under "Show Archived".
 */
export function softDeleteDocument(docId: string): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;
  const previousStatus = doc.status;
  doc.status = "Archived";
  doc.updatedAt = new Date().toISOString().slice(0, 10);
  const linkedInfo = [doc.customerName, doc.workspaceName, doc.tenderName].filter(Boolean).join(", ");
  logDocumentAction(
    doc,
    "document_deleted",
    `Document "${doc.name}" soft-deleted (was ${previousStatus}). Linked: ${linkedInfo}. File retained in audit history.`
  );
  return doc;
}

/**
 * Restore: sets status back to "Draft" (safe default), logs audit.
 */
export function restoreDocument(docId: string): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "Draft";
  doc.updatedAt = new Date().toISOString().slice(0, 10);
  logDocumentAction(
    doc,
    "document_restored",
    `Document "${doc.name}" restored from archive by user. Status set to Draft.`
  );
  return doc;
}

export function linkDocument(
  docId: string,
  linkType: "workspace" | "tender" | "opportunity",
  linkId: string,
  linkName: string,
): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;

  if (linkType === "workspace") {
    doc.workspaceId = linkId;
    doc.workspaceName = linkName;
  } else if (linkType === "tender") {
    doc.tenderId = linkId;
    doc.tenderName = linkName;
  } else {
    doc.opportunityId = linkId;
    doc.opportunityName = linkName;
  }

  doc.updatedAt = new Date().toISOString().slice(0, 10);
  logDocumentAction(doc, "document_linked", `Document "${doc.name}" linked to ${linkType}: "${linkName}".`);
  return doc;
}

export function unlinkDocument(
  docId: string,
  linkType: "workspace" | "tender" | "opportunity",
): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;

  let oldName = "";
  if (linkType === "workspace") {
    oldName = doc.workspaceName || "";
    doc.workspaceId = null;
    doc.workspaceName = null;
  } else if (linkType === "tender") {
    oldName = doc.tenderName || "";
    doc.tenderId = null;
    doc.tenderName = null;
  } else {
    oldName = doc.opportunityName || "";
    doc.opportunityId = null;
    doc.opportunityName = null;
  }

  doc.updatedAt = new Date().toISOString().slice(0, 10);
  logDocumentAction(doc, "document_unlinked", `Document "${doc.name}" unlinked from ${linkType}: "${oldName}".`);
  return doc;
}

// ─── SEARCH & FILTER ─────────────────────────────────────────

export interface DocumentFilter {
  customerId?: string;
  category?: DocumentCategory;
  status?: DocumentStatus;
  workspaceId?: string;
  tenderId?: string;
  opportunityId?: string;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  includeArchived?: boolean;
  tags?: string[];
}

export function searchDocuments(filter: DocumentFilter): UnifiedDocument[] {
  return documentVault.filter(doc => {
    if (filter.customerId && doc.customerId !== filter.customerId) return false;
    if (filter.category && doc.category !== filter.category) return false;
    if (filter.status && doc.status !== filter.status) return false;
    if (filter.workspaceId && doc.workspaceId !== filter.workspaceId) return false;
    if (filter.tenderId && doc.tenderId !== filter.tenderId) return false;
    if (filter.opportunityId && doc.opportunityId !== filter.opportunityId) return false;
    if (filter.uploadedBy && doc.uploadedBy !== filter.uploadedBy) return false;
    if (filter.dateFrom && doc.uploadDate < filter.dateFrom) return false;
    if (filter.dateTo && doc.uploadDate > filter.dateTo) return false;
    if (!filter.includeArchived && doc.status === "Archived") return false;
    if (filter.tags && filter.tags.length > 0) {
      if (!filter.tags.some(t => doc.tags.includes(t))) return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const match =
        doc.name.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.notes.toLowerCase().includes(q) ||
        doc.customerName.toLowerCase().includes(q) ||
        doc.tags.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });
}

// ─── STATISTICS ──────────────────────────────────────────────

export function getVaultStats(customerId: string) {
  const docs = getAllDocumentsByCustomer(customerId);
  const active = docs.filter(d => d.status !== "Archived");
  const totalVersions = docs.reduce((sum, d) => sum + d.versions.length, 0);
  const categories = new Set(active.map(d => d.category));
  const linkedWorkspaces = new Set(active.filter(d => d.workspaceId).map(d => d.workspaceId));
  const linkedTenders = new Set(active.filter(d => d.tenderId).map(d => d.tenderId));

  return {
    totalDocuments: active.length,
    archivedDocuments: docs.length - active.length,
    totalVersions,
    categoriesUsed: categories.size,
    linkedWorkspaces: linkedWorkspaces.size,
    linkedTenders: linkedTenders.size,
  };
}

// ─── AUTO-CATEGORIZATION ─────────────────────────────────────

export function suggestCategoryByStage(stage: string): DocumentCategory {
  const stageMap: Record<string, DocumentCategory> = {
    qualified: "Correspondence",
    solution_design: "Correspondence",
    quoting: "Quotes",
    proposal_active: "Proposals",
    negotiation: "Contracts",
    commercial_approved: "Contracts",
    sla_drafting: "SLAs",
    contract_ready: "Contracts",
    contract_sent: "Contracts",
    contract_signed: "Contracts",
    handover: "Contracts",
    go_live: "Contracts",
  };
  return stageMap[stage] || "Supporting";
}

export function suggestCategoryByFileName(fileName: string): DocumentCategory | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("contract") || lower.includes("msa")) return "Contracts";
  if (lower.includes("sla")) return "SLAs";
  if (lower.includes("quote") || lower.includes("pricing")) return "Quotes";
  if (lower.includes("proposal")) return "Proposals";
  if (lower.includes("tender") || lower.includes("rfp") || lower.includes("rfq")) return "Tenders";
  if (lower.includes("compliance") || lower.includes("audit")) return "Compliance";
  if (lower.includes("insurance") || lower.includes("certificate")) return "Insurance";
  if (lower.includes("financial") || lower.includes("p&l") || lower.includes("pnl")) return "Financial";
  if (lower.includes("invoice") || lower.includes("receipt")) return "Financial";
  return null;
}

// ─── AUDIT LOGGING ───────────────────────────────────────────

function logDocumentAction(doc: UnifiedDocument, action: string, details: string): void {
  const entry: AuditEntry = {
    id: `al-doc-${crypto.randomUUID()}`,
    entityType: "document",
    entityId: doc.id,
    action,
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: new Date().toISOString(),
    details,
  };
  void syncAuditEntry(entry);

  const customerEntry: AuditEntry = {
    id: `al-doc-c-${crypto.randomUUID()}`,
    entityType: "customer",
    entityId: doc.customerId,
    action,
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: new Date().toISOString(),
    details,
  };
  void syncAuditEntry(customerEntry);

  if (doc.workspaceId) {
    const wsEntry: AuditEntry = {
      id: `al-doc-w-${crypto.randomUUID()}`,
      entityType: "workspace",
      entityId: doc.workspaceId,
      action,
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
      timestamp: new Date().toISOString(),
      details,
    };
    void syncAuditEntry(wsEntry);
  }

  if (doc.tenderId) {
    const tnEntry: AuditEntry = {
      id: `al-doc-t-${crypto.randomUUID()}`,
      entityType: "tender",
      entityId: doc.tenderId,
      action,
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
      timestamp: new Date().toISOString(),
      details,
    };
    void syncAuditEntry(tnEntry);
  }
}

// ─── FILE TYPE DISPLAY ──────────────────────────────────────────

export function getFileTypeColor(fileType: string): string {
  const colors: Record<string, string> = {
    PDF: "bg-red-100 text-red-700",
    DOCX: "bg-blue-100 text-blue-700",
    DOC: "bg-blue-100 text-blue-700",
    XLSX: "bg-emerald-100 text-emerald-700",
    XLS: "bg-emerald-100 text-emerald-700",
    PPTX: "bg-orange-100 text-orange-700",
    PPT: "bg-orange-100 text-orange-700",
    PNG: "bg-violet-100 text-violet-700",
    JPG: "bg-violet-100 text-violet-700",
    JPEG: "bg-violet-100 text-violet-700",
    CSV: "bg-teal-100 text-teal-700",
    TXT: "bg-gray-100 text-gray-700",
    SVG: "bg-pink-100 text-pink-700",
  };
  return colors[fileType.toUpperCase()] || "bg-gray-100 text-gray-700";
}

export function getCategoryIcon(category: DocumentCategory): string {
  const icons: Record<DocumentCategory, string> = {
    Contracts: "📄",
    SLAs: "📋",
    Tenders: "📑",
    Quotes: "💰",
    Proposals: "📝",
    Compliance: "✅",
    Insurance: "🛡️",
    Financial: "📊",
    "P&L": "📈",
    ECR: "⭐",
    Correspondence: "✉️",
    Historical: "📦",
    Supporting: "📎",
  };
  return icons[category] || "📄";
}

// ─── UTILITY ─────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Download a document file */
export async function downloadDocument(doc: UnifiedDocument, versionNumber?: number): Promise<void> {
  const ver = versionNumber
    ? doc.versions.find(v => v.versionNumber === versionNumber)
    : doc.versions.find(v => v.versionNumber === doc.currentVersion);

  if (!ver?.filePath) {
    console.warn("No file available for download");
    return;
  }

  // Check if filePath is a blob URL or Supabase Storage path
  if (ver.filePath.startsWith("blob:")) {
    const a = document.createElement("a");
    a.href = ver.filePath;
    a.download = ver.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    // Real document in Supabase Storage — get signed URL then trigger download
    const signedUrl = await getSignedDownloadUrl(ver.filePath);
    if (!signedUrl) { console.warn("Could not generate download URL"); return; }
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = ver.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
