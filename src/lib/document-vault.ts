/**
 * document-vault.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.4).
 *
 * Unified document architecture backed by Supabase:
 *   - File content lives in the Supabase Storage "documents" bucket.
 *   - Document records live in the generated_documents table.
 *
 * The module keeps a session registry that is populated ONLY from
 * generated_documents rows and from real uploads performed in this session.
 * It is never seeded. When the source is empty the vault renders empty.
 */

import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
import { handleSupabaseError } from "@/lib/supabase-error";

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

// ─── MIME TYPE HELPERS ──────────────────────────────────────

// Internal (non-exported): return union of getMimeCategory.
type MimeCategory = "pdf" | "image" | "text" | "spreadsheet" | "document" | "presentation" | "other";

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

function extensionToMime(ext: string): string {
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

function mimeToExtension(mime: string): string {
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

// ─── DOCUMENT ENTITY ─────────────────────────────────────────

export interface DocumentVersion {
  versionNumber: number;
  fileName: string;
  fileSize: string;
  fileType: string;
  mimeType: string;
  filePath: string | null; // Supabase Storage path or null
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
  filePath: string | null; // Supabase Storage path when a real file exists

  // Version history
  versions: DocumentVersion[];

  // Permission-ready (not enforced)
  permissionLevel: "public" | "internal" | "restricted";

  // Timestamps
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── SESSION REGISTRY (loaded from generated_documents only) ─

const BUCKET = "documents";
const DOCUMENT_TABLE = "generated_documents";

const documentVault: UnifiedDocument[] = [];
let vaultLoadPromise: Promise<void> | null = null;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isKnownCategory(value: unknown): value is DocumentCategory {
  return DOCUMENT_CATEGORIES.includes(value as DocumentCategory);
}

function mapVaultRowStatus(status: unknown): DocumentStatus {
  if (status === "archived") return "Archived";
  if (status === "superseded") return "Superseded";
  // generated_documents rows in "generated" state map to the safe editable
  // default; no signature or finality is invented for them.
  return "Draft";
}

function mapGeneratedDocumentRow(row: any): UnifiedDocument {
  const mimeType = row.mime_type || "application/octet-stream";
  const fileName = row.file_name || "";
  const createdAt = row.generated_at || row.created_at || "";
  const day = createdAt ? String(createdAt).slice(0, 10) : "";
  const versionNumber = row.version_number || 1;

  return {
    id: row.id,
    name: fileName,
    category: isKnownCategory(row.document_type) ? row.document_type : "Supporting",
    customerId: row.customer_id ?? "",
    customerName: "", // not stored on generated_documents — left honestly empty
    workspaceId: row.source_type === "tender" ? null : (row.workspace_id ?? null),
    workspaceName: null,
    tenderId: row.source_type === "tender" ? (row.source_id ?? row.workspace_id ?? null) : null,
    tenderName: null,
    dealId: null,
    dealName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: row.generated_by ?? "",
    uploadDate: day,
    currentVersion: versionNumber,
    status: mapVaultRowStatus(row.status),
    notes: row.notes ?? "",
    tags: [],
    fileName,
    fileSize: formatFileSize(Number(row.file_size) || 0),
    fileType: mimeToExtension(mimeType),
    mimeType,
    filePath: row.storage_path ?? null,
    versions: [{
      versionNumber,
      fileName,
      fileSize: formatFileSize(Number(row.file_size) || 0),
      fileType: mimeToExtension(mimeType),
      mimeType,
      filePath: row.storage_path ?? null,
      uploadedBy: row.generated_by ?? "",
      uploadedAt: day,
      notes: row.notes ?? "",
    }],
    permissionLevel: "internal",
    createdBy: row.generated_by ?? "",
    createdAt: day,
    updatedAt: day,
  };
}

async function loadVaultFromSupabase(): Promise<void> {
  const { data, error } = await supabase
    .from(DOCUMENT_TABLE)
    .select("*")
    .order("generated_at", { ascending: false });
  if (error) {
    handleSupabaseError("documentVaultLoad", error, { silent: true });
    return; // registry stays as-is; nothing is fabricated
  }
  documentVault.length = 0;
  for (const row of data ?? []) {
    documentVault.push(mapGeneratedDocumentRow(row));
  }
}

function ensureVaultLoaded(): Promise<void> {
  if (!vaultLoadPromise) {
    vaultLoadPromise = loadVaultFromSupabase().finally(() => {
      // Allow a later re-initialize to refresh.
    });
  }
  return vaultLoadPromise;
}

/**
 * Load the document registry from generated_documents. Fire-and-forget by
 * signature; the registry fills as soon as the read resolves. Calling again
 * after the first load triggers a refresh.
 */
export function initializeDocumentVault(): void {
  if (vaultLoadPromise) {
    // Refresh on subsequent explicit initializations.
    vaultLoadPromise = loadVaultFromSupabase();
    return;
  }
  void ensureVaultLoaded();
}

// ─── QUERY HELPERS ───────────────────────────────────────────

export function getDocumentsByWorkspace(workspaceId: string, includeArchived = false): UnifiedDocument[] {
  void ensureVaultLoaded();
  return documentVault.filter(d => d.workspaceId === workspaceId && (includeArchived || d.status !== "Archived"));
}

// ─── FILE URL HELPERS ────────────────────────────────────────

/**
 * The legacy in-memory Blob URL registry has been removed; this build serves
 * files exclusively from Supabase Storage. There is therefore never a local
 * object URL for a version — callers receive null and should use
 * getSignedDownloadUrl(doc.filePath) instead.
 */
export function getFileUrl(docId: string, versionNumber: number): string | null {
  void docId;
  void versionNumber;
  return null;
}

/**
 * Which stored object a viewer should sign for a given version.
 *
 * SC-01 Wave 04: extracted so the choice is testable. Returns null only when
 * the record genuinely has no stored bytes — callers must not conflate that
 * with "the URL could not be signed", which is a transport failure.
 */
export function resolveVersionFilePath(
  doc: Pick<UnifiedDocument, "versions" | "currentVersion" | "filePath">,
  versionNumber?: number | null,
): string | null {
  const versions = doc.versions ?? [];
  const byNumber = versionNumber
    ? versions.find(v => v.versionNumber === versionNumber)
    : undefined;
  const current = versions.find(v => v.versionNumber === doc.currentVersion);
  const last = versions.length > 0 ? versions[versions.length - 1] : undefined;
  const path = byNumber?.filePath ?? current?.filePath ?? last?.filePath ?? doc.filePath ?? null;
  return path && path !== "" ? path : null;
}

/** Get a signed download URL for a Supabase Storage document */
export async function getSignedDownloadUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}

/** Check if a document has a real file stored */
export function hasRealFile(doc: UnifiedDocument): boolean {
  return doc.filePath !== null && doc.filePath !== "";
}

// ─── CRUD OPERATIONS ─────────────────────────────────────────

// Internal (non-exported): parameter shape of uploadDocument.
interface UploadDocumentInput {
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
 * Upload a real file to Supabase Storage and create the document record in
 * generated_documents (same field mapping as the established upload path).
 * Both failures throw — no success shape is returned unless both writes
 * actually happened.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<UnifiedDocument> {
  const now = new Date().toISOString().slice(0, 10);
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = input.file.type || extensionToMime(ext);
  const fileType = mimeToExtension(mimeType) || ext.toUpperCase();
  const fileSize = formatFileSize(input.file.size);
  const uploadedBy = input.uploadedBy ?? getCurrentUser().name;

  const date = new Date().toISOString().split("T")[0];
  const safeName = input.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
  const storagePath = `customers/${input.customerId}/workspaces/${input.workspaceId || "unassigned"}/${input.category}/${date}-${safeName}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  // 1. Upload file directly from browser to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    console.error("[document-vault] Storage upload failed:", uploadErr);
    throw new Error(`File upload failed: ${uploadErr.message}`);
  }

  // 2. Create the DB record directly in generated_documents
  //    (same columns as the established upload wiring)
  const parentType = input.tenderId ? "tender" : (input.workspaceId ? "ticket" : "customer");
  const parentId = input.tenderId || input.workspaceId || input.customerId;

  const { data: created, error: dbErr } = await supabase
    .from(DOCUMENT_TABLE)
    .insert({
      workspace_id: input.workspaceId || input.tenderId || input.customerId,
      customer_id: input.customerId || null,
      document_type: input.category,
      source_type: parentType,
      source_id: parentId,
      source_version: 1,
      file_name: input.file.name,
      file_size: input.file.size,
      mime_type: mimeType,
      storage_path: storagePath,
      status: "generated",
      version_number: 1,
      generated_by: getCurrentUser().id || "system",
      notes: input.notes || "",
    })
    .select()
    .single();

  if (dbErr || !created) {
    console.error("[document-vault] Document record insert failed:", dbErr);
    throw new Error(dbErr?.message || "Failed to create document record");
  }

  // Build the UnifiedDocument to return, carrying the session-level display
  // metadata (name, customerName, links) not persisted by the table.
  const doc: UnifiedDocument = {
    id: created.id,
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
  return doc;
}

function persistVaultStatus(docId: string, status: "generated" | "superseded" | "archived"): void {
  void supabase
    .from(DOCUMENT_TABLE)
    .update({ status })
    .eq("id", docId)
    .then(({ error }) => {
      if (error) handleSupabaseError("documentVaultStatusUpdate", error, { silent: true });
    });
}

/**
 * Soft delete: sets status to "Archived" locally and persists the archived
 * status to generated_documents. The record is retained.
 */
export function softDeleteDocument(docId: string): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "Archived";
  doc.updatedAt = new Date().toISOString().slice(0, 10);
  persistVaultStatus(docId, "archived");
  return doc;
}

/**
 * Restore: sets status back to "Draft" (safe default) locally and persists
 * the active status to generated_documents.
 */
export function restoreDocument(docId: string): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "Draft";
  doc.updatedAt = new Date().toISOString().slice(0, 10);
  persistVaultStatus(docId, "generated");
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

    // Persist the fields that have generated_documents columns.
    const row: Record<string, any> = {};
    if (updates.category !== undefined) row.document_type = updates.category;
    if (updates.notes !== undefined) row.notes = updates.notes;
    if (updates.status === "Archived") row.status = "archived";
    else if (updates.status === "Superseded") row.status = "superseded";
    else if (updates.status !== undefined) row.status = "generated";
    if (Object.keys(row).length > 0) {
      void supabase
        .from(DOCUMENT_TABLE)
        .update(row)
        .eq("id", docId)
        .then(({ error }) => {
          if (error) handleSupabaseError("documentVaultMetadataUpdate", error, { silent: true });
        });
    }
  }
  return doc;
}

// ─── FILE TYPE DISPLAY ──────────────────────────────────────

export function getFileTypeColor(fileType: string): string {
  const colors: Record<string, string> = {
    PDF: "bg-red-100 text-red-700",
    DOCX: "bg-blue-100 text-blue-700",
    DOC: "bg-blue-100 text-blue-700",
    XLSX: "bg-emerald-100 text-emerald-700",
    XLS: "bg-emerald-100 text-emerald-700",
    PPTX: "bg-orange-100 text-orange-700",
    PPT: "bg-orange-100 text-orange-700",
    PNG: "bg-[#075eea]/15 text-[#075eea]",
    JPG: "bg-[#075eea]/15 text-[#075eea]",
    JPEG: "bg-[#075eea]/15 text-[#075eea]",
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

// ─── DOWNLOAD ────────────────────────────────────────────────

/** Download a document file from Supabase Storage via a signed URL */
export async function downloadDocument(doc: UnifiedDocument, versionNumber?: number): Promise<void> {
  const ver = versionNumber
    ? doc.versions.find(v => v.versionNumber === versionNumber)
    : doc.versions.find(v => v.versionNumber === doc.currentVersion);

  if (!ver?.filePath) {
    console.warn("No file available for download");
    return;
  }

  const signedUrl = await getSignedDownloadUrl(ver.filePath);
  if (!signedUrl) { console.warn("Could not generate download URL"); return; }
  const a = document.createElement("a");
  a.href = signedUrl;
  a.download = ver.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
