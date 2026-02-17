/*
 * Unified Document Architecture — Production-Grade File Infrastructure
 * Sprint 5: Real file-backed document storage.
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
 *   - Mock documents use synthetic Blob URLs created from sample content
 *   - Documents without valid file_path are rendered as non-clickable
 */

import { type AuditEntry, auditLog } from "./store";

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
 * For mock documents, we create synthetic Blob URLs from sample content.
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

// ─── SYNTHETIC FILE GENERATION ──────────────────────────────────

/**
 * Create a synthetic file (Blob URL) for mock documents.
 * This makes mock documents "real" — they have actual file content
 * that can be opened in the viewer.
 */
function createSyntheticFile(doc: {
  id: string;
  name: string;
  mimeType: string;
  versionNumber: number;
  fileName: string;
}): string {
  let content: string;
  let type: string;

  const mimeCategory = getMimeCategory(doc.mimeType);

  if (mimeCategory === "pdf") {
    // Create a minimal PDF
    content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 24 Tf
50 700 Td
(${doc.name}) Tj
0 -40 Td
/F1 12 Tf
(File: ${doc.fileName}) Tj
0 -20 Td
(Version: ${doc.versionNumber}) Tj
0 -20 Td
(This is a production document from Hala Commercial Engine.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000438 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
521
%%EOF`;
    type = "application/pdf";
  } else if (mimeCategory === "text" || doc.mimeType === "text/csv") {
    content = `${doc.name}\n\nFile: ${doc.fileName}\nVersion: ${doc.versionNumber}\n\nThis is a production document from Hala Commercial Engine.\nGenerated for document infrastructure validation.`;
    type = doc.mimeType;
  } else if (mimeCategory === "image") {
    // Create a simple SVG as image placeholder
    content = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#1a1a2e"/>
  <text x="400" y="280" text-anchor="middle" fill="#e0e0e0" font-family="Arial" font-size="24">${doc.name}</text>
  <text x="400" y="320" text-anchor="middle" fill="#888" font-family="Arial" font-size="14">v${doc.versionNumber} — ${doc.fileName}</text>
  <text x="400" y="360" text-anchor="middle" fill="#666" font-family="Arial" font-size="12">Hala Commercial Engine</text>
</svg>`;
    type = "image/svg+xml";
  } else {
    // For office documents (DOCX, XLSX, PPTX), create a text representation
    content = `${doc.name}\n\nFile: ${doc.fileName}\nVersion: ${doc.versionNumber}\nType: ${doc.mimeType}\n\nThis is a production document from Hala Commercial Engine.\nOffice document preview is available via download.`;
    type = "text/plain";
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  fileRegistry.set(`${doc.id}:${doc.versionNumber}`, url);
  return url;
}

// ─── MOCK DATA ───────────────────────────────────────────────

let docIdCounter = 30;

function makeMockDoc(input: {
  id: string;
  name: string;
  category: DocumentCategory;
  customerId: string;
  customerName: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  tenderId?: string | null;
  tenderName?: string | null;
  uploadedBy: string;
  uploadDate: string;
  status: DocumentStatus;
  notes: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  mimeType: string;
  tags?: string[];
  permissionLevel?: "public" | "internal" | "restricted";
  versions: Array<{
    versionNumber: number;
    fileName: string;
    fileSize: string;
    fileType: string;
    mimeType: string;
    uploadedBy: string;
    uploadedAt: string;
    notes: string;
  }>;
}): UnifiedDocument {
  const currentVersion = input.versions.length;
  const doc: UnifiedDocument = {
    id: input.id,
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
    opportunityId: null,
    opportunityName: null,
    uploadedBy: input.uploadedBy,
    uploadDate: input.uploadDate,
    currentVersion,
    status: input.status,
    notes: input.notes,
    tags: input.tags ?? [],
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
    mimeType: input.mimeType,
    filePath: null, // Will be set by initializeMockFiles()
    permissionLevel: input.permissionLevel ?? "internal",
    createdBy: input.versions[0]?.uploadedBy ?? input.uploadedBy,
    createdAt: input.versions[0]?.uploadedAt ?? input.uploadDate,
    updatedAt: input.uploadDate,
    versions: input.versions.map(v => ({
      ...v,
      filePath: null, // Will be set by initializeMockFiles()
    })),
  };
  return doc;
}

export const documentVault: UnifiedDocument[] = [
  // SABIC Documents
  makeMockDoc({
    id: "doc-001",
    name: "SABIC Master Service Agreement 2025",
    category: "Contracts",
    customerId: "c1",
    customerName: "SABIC",
    tenderId: "tn-002",
    tenderName: "SABIC National Warehousing Services Tender",
    uploadedBy: "Ra'ed",
    uploadDate: "2025-11-15",
    status: "Signed",
    notes: "Renewed for 2025. Includes updated SLA terms.",
    fileName: "SABIC_MSA_2025_v2.pdf",
    fileSize: "2.4 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["contract", "MSA", "2025"],
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "SABIC_MSA_2025_v1.pdf", fileSize: "2.1 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Ra'ed", uploadedAt: "2025-10-01", notes: "Initial draft" },
      { versionNumber: 2, fileName: "SABIC_MSA_2025_v2.pdf", fileSize: "2.4 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Ra'ed", uploadedAt: "2025-11-15", notes: "Final signed version" },
    ],
  }),
  makeMockDoc({
    id: "doc-002",
    name: "SABIC SLA — Warehousing KPIs",
    category: "SLAs",
    customerId: "c1",
    customerName: "SABIC",
    uploadedBy: "Hano",
    uploadDate: "2025-12-01",
    status: "Final",
    notes: "Operational KPI targets for SABIC warehousing.",
    fileName: "SABIC_SLA_WH_KPIs.pdf",
    fileSize: "890 KB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["SLA", "KPI", "warehousing"],
    versions: [
      { versionNumber: 1, fileName: "SABIC_SLA_WH_KPIs.pdf", fileSize: "890 KB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Hano", uploadedAt: "2025-12-01", notes: "Approved SLA" },
    ],
  }),
  makeMockDoc({
    id: "doc-003",
    name: "SABIC Insurance Certificate 2025",
    category: "Insurance",
    customerId: "c1",
    customerName: "SABIC",
    uploadedBy: "Finance",
    uploadDate: "2025-09-20",
    status: "Final",
    notes: "Annual insurance certificate covering all SABIC goods.",
    fileName: "SABIC_Insurance_2025.pdf",
    fileSize: "1.2 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["insurance", "annual"],
    permissionLevel: "restricted",
    versions: [
      { versionNumber: 1, fileName: "SABIC_Insurance_2025.pdf", fileSize: "1.2 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Finance", uploadedAt: "2025-09-20", notes: "Annual certificate" },
    ],
  }),
  makeMockDoc({
    id: "doc-013",
    name: "SABIC Compliance Audit Report Q4 2025",
    category: "Compliance",
    customerId: "c1",
    customerName: "SABIC",
    uploadedBy: "Ra'ed",
    uploadDate: "2026-01-05",
    status: "Final",
    notes: "Q4 compliance audit results — all clear.",
    fileName: "SABIC_Compliance_Q4_2025.pdf",
    fileSize: "1.8 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["compliance", "audit", "Q4"],
    versions: [
      { versionNumber: 1, fileName: "SABIC_Compliance_Q4_2025.pdf", fileSize: "1.8 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Ra'ed", uploadedAt: "2026-01-05", notes: "Q4 audit complete" },
    ],
  }),
  // Ma'aden Documents
  makeMockDoc({
    id: "doc-004",
    name: "Ma'aden Jubail Expansion — Technical Proposal",
    category: "Tenders",
    customerId: "c2",
    customerName: "Ma'aden",
    workspaceId: "w1",
    workspaceName: "Ma'aden Jubail Expansion 2500PP",
    tenderId: "tn-001",
    tenderName: "Ma'aden Jubail Expansion — Logistics RFP",
    uploadedBy: "Ra'ed",
    uploadDate: "2026-02-10",
    status: "Draft",
    notes: "Technical proposal for Jubail expansion. Under review.",
    fileName: "Maaden_Jubail_TechProposal_v3.docx",
    fileSize: "4.7 MB",
    fileType: "DOCX",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    tags: ["proposal", "technical", "Jubail"],
    versions: [
      { versionNumber: 1, fileName: "Maaden_Jubail_TechProposal_v1.docx", fileSize: "3.2 MB", fileType: "DOCX", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", uploadedBy: "Ra'ed", uploadedAt: "2026-01-20", notes: "First draft" },
      { versionNumber: 2, fileName: "Maaden_Jubail_TechProposal_v2.docx", fileSize: "4.1 MB", fileType: "DOCX", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", uploadedBy: "Yazan", uploadedAt: "2026-02-01", notes: "Added cost breakdown" },
      { versionNumber: 3, fileName: "Maaden_Jubail_TechProposal_v3.docx", fileSize: "4.7 MB", fileType: "DOCX", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", uploadedBy: "Ra'ed", uploadedAt: "2026-02-10", notes: "Final review edits" },
    ],
  }),
  makeMockDoc({
    id: "doc-005",
    name: "Ma'aden Quote — Storage & Handling",
    category: "Quotes",
    customerId: "c2",
    customerName: "Ma'aden",
    workspaceId: "w1",
    workspaceName: "Ma'aden Jubail Expansion 2500PP",
    uploadedBy: "Ra'ed",
    uploadDate: "2026-01-28",
    status: "Final",
    notes: "Approved quote for storage and handling services.",
    fileName: "Maaden_Quote_StorageHandling.xlsx",
    fileSize: "320 KB",
    fileType: "XLSX",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    tags: ["quote", "storage", "handling"],
    versions: [
      { versionNumber: 1, fileName: "Maaden_Quote_StorageHandling.xlsx", fileSize: "320 KB", fileType: "XLSX", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uploadedBy: "Ra'ed", uploadedAt: "2026-01-28", notes: "Approved by director" },
    ],
  }),
  // Almarai Documents
  makeMockDoc({
    id: "doc-006",
    name: "Almarai Cold Chain SLA Agreement",
    category: "SLAs",
    customerId: "c3",
    customerName: "Almarai",
    workspaceId: "w5",
    workspaceName: "Almarai Riyadh Phase 2",
    tenderId: "tn-004",
    tenderName: "Almarai Riyadh Phase 2 — Cold Chain Tender",
    uploadedBy: "Hano",
    uploadDate: "2026-02-05",
    status: "Draft",
    notes: "Cold chain SLA terms for Riyadh Phase 2.",
    fileName: "Almarai_ColdChain_SLA_Draft.pdf",
    fileSize: "1.8 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["SLA", "cold-chain", "Riyadh"],
    versions: [
      { versionNumber: 1, fileName: "Almarai_ColdChain_SLA_Draft.pdf", fileSize: "1.8 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Hano", uploadedAt: "2026-02-05", notes: "Initial SLA draft" },
    ],
  }),
  makeMockDoc({
    id: "doc-007",
    name: "Almarai Financial Due Diligence Report",
    category: "Financial",
    customerId: "c3",
    customerName: "Almarai",
    uploadedBy: "Finance",
    uploadDate: "2025-08-15",
    status: "Final",
    notes: "Annual financial review for Almarai account.",
    fileName: "Almarai_FinDueDiligence_2025.pdf",
    fileSize: "3.1 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["financial", "due-diligence"],
    permissionLevel: "restricted",
    versions: [
      { versionNumber: 1, fileName: "Almarai_FinDueDiligence_2025.pdf", fileSize: "3.1 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Finance", uploadedAt: "2025-08-15", notes: "Completed review" },
    ],
  }),
  // Sadara Chemical Documents
  makeMockDoc({
    id: "doc-008",
    name: "Sadara Contract Renewal Draft 2025",
    category: "Contracts",
    customerId: "c4",
    customerName: "Sadara Chemical",
    workspaceId: "w2",
    workspaceName: "Sadara Contract Renewal",
    tenderId: "tn-006",
    tenderName: "Sadara Contract Renewal Tender 2025",
    uploadedBy: "Albert",
    uploadDate: "2026-01-10",
    status: "Draft",
    notes: "Contract renewal draft. Pending legal review.",
    fileName: "Sadara_ContractRenewal_v2.pdf",
    fileSize: "2.9 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["contract", "renewal"],
    versions: [
      { versionNumber: 1, fileName: "Sadara_ContractRenewal_v1.pdf", fileSize: "2.5 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Albert", uploadedAt: "2025-12-15", notes: "Initial draft" },
      { versionNumber: 2, fileName: "Sadara_ContractRenewal_v2.pdf", fileSize: "2.9 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Albert", uploadedAt: "2026-01-10", notes: "Updated terms per negotiation" },
    ],
  }),
  // Aramco Documents
  makeMockDoc({
    id: "doc-009",
    name: "Aramco VAS Expansion Compliance Checklist",
    category: "Compliance",
    customerId: "c1",
    customerName: "Aramco Services",
    workspaceId: "w6",
    workspaceName: "Aramco Dhahran VAS Expansion",
    tenderId: "tn-003",
    tenderName: "Aramco Dhahran VAS Expansion Tender",
    uploadedBy: "Ra'ed",
    uploadDate: "2026-02-08",
    status: "Final",
    notes: "Compliance requirements for Aramco VAS expansion.",
    fileName: "Aramco_VAS_Compliance.pdf",
    fileSize: "1.5 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["compliance", "VAS", "Aramco"],
    permissionLevel: "restricted",
    versions: [
      { versionNumber: 1, fileName: "Aramco_VAS_Compliance.pdf", fileSize: "1.5 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Ra'ed", uploadedAt: "2026-02-08", notes: "Approved compliance checklist" },
    ],
  }),
  // Nestlé Documents
  makeMockDoc({
    id: "doc-010",
    name: "Nestlé Jeddah Partnership Correspondence",
    category: "Correspondence",
    customerId: "c8",
    customerName: "Nestlé KSA",
    tenderId: "tn-005",
    tenderName: "Nestlé Jeddah Cold Chain Partnership",
    uploadedBy: "Hano",
    uploadDate: "2026-01-25",
    status: "Final",
    notes: "Key correspondence with Nestlé procurement team.",
    fileName: "Nestle_Jeddah_Correspondence.pdf",
    fileSize: "650 KB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["correspondence", "procurement"],
    versions: [
      { versionNumber: 1, fileName: "Nestle_Jeddah_Correspondence.pdf", fileSize: "650 KB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Hano", uploadedAt: "2026-01-25", notes: "Compiled correspondence" },
    ],
  }),
  // Al-Rajhi Documents
  makeMockDoc({
    id: "doc-011",
    name: "Al-Rajhi Emergency Storage Quote",
    category: "Quotes",
    customerId: "c5",
    customerName: "Al-Rajhi Steel",
    workspaceId: "w3",
    workspaceName: "Al-Rajhi Emergency Storage",
    uploadedBy: "Albert",
    uploadDate: "2026-02-12",
    status: "Draft",
    notes: "Emergency storage pricing. Low margin — flagged.",
    fileName: "AlRajhi_EmergencyQuote.xlsx",
    fileSize: "180 KB",
    fileType: "XLSX",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    tags: ["quote", "emergency"],
    versions: [
      { versionNumber: 1, fileName: "AlRajhi_EmergencyQuote.xlsx", fileSize: "180 KB", fileType: "XLSX", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uploadedBy: "Albert", uploadedAt: "2026-02-12", notes: "Initial quote" },
    ],
  }),
  // Unilever Documents
  makeMockDoc({
    id: "doc-012",
    name: "Unilever Arabia Historical Contract 2024",
    category: "Historical",
    customerId: "c6",
    customerName: "Unilever Arabia",
    uploadedBy: "Albert",
    uploadDate: "2025-06-01",
    status: "Archived",
    notes: "Previous year contract. Archived after expiry.",
    fileName: "Unilever_Contract_2024.pdf",
    fileSize: "2.0 MB",
    fileType: "PDF",
    mimeType: "application/pdf",
    tags: ["contract", "archived", "2024"],
    versions: [
      { versionNumber: 1, fileName: "Unilever_Contract_2024.pdf", fileSize: "2.0 MB", fileType: "PDF", mimeType: "application/pdf", uploadedBy: "Albert", uploadedAt: "2025-06-01", notes: "Archived" },
    ],
  }),
];

// ─── INITIALIZE MOCK FILES ──────────────────────────────────────

let _initialized = false;

export function initializeMockFiles(): void {
  if (_initialized) return;
  _initialized = true;

  for (const doc of documentVault) {
    // Create synthetic files for each version
    for (const ver of doc.versions) {
      const url = createSyntheticFile({
        id: doc.id,
        name: doc.name,
        mimeType: ver.mimeType,
        versionNumber: ver.versionNumber,
        fileName: ver.fileName,
      });
      ver.filePath = url;
    }
    // Set current version file path
    const currentVer = doc.versions.find(v => v.versionNumber === doc.currentVersion);
    doc.filePath = currentVer?.filePath ?? null;
  }
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
 * Upload a real file and create a document entry.
 * If a document with the same name exists for this customer, auto-increment version.
 */
export function uploadDocument(input: UploadDocumentInput): UnifiedDocument {
  const now = new Date().toISOString().slice(0, 10);
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = input.file.type || extensionToMime(ext);
  const fileType = mimeToExtension(mimeType) || ext.toUpperCase();
  const fileSize = formatFileSize(input.file.size);
  const uploadedBy = input.uploadedBy ?? "Amin Al-Rashid";

  // Check if document with same name exists for this customer → version increment
  const existing = documentVault.find(
    d => d.name === input.name && d.customerId === input.customerId && d.status !== "Archived"
  );

  if (existing) {
    // Version increment
    const newVersion = existing.currentVersion + 1;
    const blobUrl = storeFile(existing.id, newVersion, input.file);

    existing.currentVersion = newVersion;
    existing.fileName = input.file.name;
    existing.fileSize = fileSize;
    existing.fileType = fileType;
    existing.mimeType = mimeType;
    existing.filePath = blobUrl;
    existing.uploadDate = now;
    existing.updatedAt = now;
    if (input.notes) existing.notes = input.notes;
    if (input.status) existing.status = input.status;

    existing.versions.push({
      versionNumber: newVersion,
      fileName: input.file.name,
      fileSize,
      fileType,
      mimeType,
      filePath: blobUrl,
      uploadedBy,
      uploadedAt: now,
      notes: input.notes || `Version ${newVersion} uploaded`,
    });

    logDocumentAction(existing, "document_version_uploaded", `New version v${newVersion} of "${existing.name}" uploaded by ${uploadedBy}.`);
    return existing;
  }

  // New document
  const docId = `doc-${String(++docIdCounter).padStart(3, "0")}`;
  const blobUrl = storeFile(docId, 1, input.file);

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
    filePath: blobUrl,
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
      filePath: blobUrl,
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
    id: `doc-${String(++docIdCounter).padStart(3, "0")}`,
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
    id: `al-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entityType: "document",
    entityId: doc.id,
    action,
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: new Date().toISOString(),
    details,
  };
  auditLog.unshift(entry);

  const customerEntry: AuditEntry = {
    id: `al-doc-c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entityType: "customer",
    entityId: doc.customerId,
    action,
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: new Date().toISOString(),
    details,
  };
  auditLog.unshift(customerEntry);

  if (doc.workspaceId) {
    const wsEntry: AuditEntry = {
      id: `al-doc-w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: "workspace",
      entityId: doc.workspaceId,
      action,
      userId: "u1",
      userName: "Amin Al-Rashid",
      timestamp: new Date().toISOString(),
      details,
    };
    auditLog.unshift(wsEntry);
  }

  if (doc.tenderId) {
    const tnEntry: AuditEntry = {
      id: `al-doc-t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      entityType: "tender",
      entityId: doc.tenderId,
      action,
      userId: "u1",
      userName: "Amin Al-Rashid",
      timestamp: new Date().toISOString(),
      details,
    };
    auditLog.unshift(tnEntry);
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
export function downloadDocument(doc: UnifiedDocument, versionNumber?: number): void {
  const ver = versionNumber
    ? doc.versions.find(v => v.versionNumber === versionNumber)
    : doc.versions.find(v => v.versionNumber === doc.currentVersion);

  if (!ver?.filePath) {
    console.warn("No file available for download");
    return;
  }

  const a = document.createElement("a");
  a.href = ver.filePath;
  a.download = ver.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
