/*
 * Unified Document Architecture — Client Master File
 * Single source of truth for all documents across the system.
 *
 * Architecture:
 *   1. Every document belongs to a Customer (customerId)
 *   2. Documents are categorized into folders (category)
 *   3. Optional links to Workspace, Tender, Opportunity
 *   4. Versioning: replace file while retaining history
 *   5. Soft delete via archive (no permanent delete)
 *   6. All actions logged to audit trail
 *   7. Permission-ready structure (not enforced yet)
 *
 * No document should live isolated inside a feature.
 * Single source of truth only.
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
  | "Historical";

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "Contracts",
  "SLAs",
  "Tenders",
  "Quotes",
  "Compliance",
  "Insurance",
  "Financial",
  "Correspondence",
  "Historical",
];

export type DocumentStatus = "Draft" | "Final" | "Superseded" | "Archived";

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "Draft",
  "Final",
  "Superseded",
  "Archived",
];

// ─── DOCUMENT ENTITY ─────────────────────────────────────────

export interface DocumentVersion {
  versionNumber: number;
  fileName: string;
  fileSize: string;
  fileType: string;
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
  opportunityId: string | null;
  opportunityName: string | null;

  // Metadata
  uploadedBy: string;
  uploadDate: string;
  currentVersion: number;
  status: DocumentStatus;
  notes: string;

  // File info (current version)
  fileName: string;
  fileSize: string;
  fileType: string;

  // Version history
  versions: DocumentVersion[];

  // Permission-ready (not enforced yet)
  permissionLevel: "public" | "internal" | "restricted";
}

// ─── MOCK DATA ───────────────────────────────────────────────

let docIdCounter = 30;

export const documentVault: UnifiedDocument[] = [
  // SABIC Documents
  {
    id: "doc-001",
    name: "SABIC Master Service Agreement 2025",
    category: "Contracts",
    customerId: "c1",
    customerName: "SABIC",
    workspaceId: null,
    workspaceName: null,
    tenderId: "tn-002",
    tenderName: "SABIC National Warehousing Services Tender",
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Ra'ed",
    uploadDate: "2025-11-15",
    currentVersion: 2,
    status: "Final",
    notes: "Renewed for 2025. Includes updated SLA terms.",
    fileName: "SABIC_MSA_2025_v2.pdf",
    fileSize: "2.4 MB",
    fileType: "PDF",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "SABIC_MSA_2025_v1.pdf", fileSize: "2.1 MB", fileType: "PDF", uploadedBy: "Ra'ed", uploadedAt: "2025-10-01", notes: "Initial draft" },
      { versionNumber: 2, fileName: "SABIC_MSA_2025_v2.pdf", fileSize: "2.4 MB", fileType: "PDF", uploadedBy: "Ra'ed", uploadedAt: "2025-11-15", notes: "Final signed version" },
    ],
  },
  {
    id: "doc-002",
    name: "SABIC SLA — Warehousing KPIs",
    category: "SLAs",
    customerId: "c1",
    customerName: "SABIC",
    workspaceId: null,
    workspaceName: null,
    tenderId: null,
    tenderName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Hano",
    uploadDate: "2025-12-01",
    currentVersion: 1,
    status: "Final",
    notes: "Operational KPI targets for SABIC warehousing.",
    fileName: "SABIC_SLA_WH_KPIs.pdf",
    fileSize: "890 KB",
    fileType: "PDF",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "SABIC_SLA_WH_KPIs.pdf", fileSize: "890 KB", fileType: "PDF", uploadedBy: "Hano", uploadedAt: "2025-12-01", notes: "Approved SLA" },
    ],
  },
  {
    id: "doc-003",
    name: "SABIC Insurance Certificate 2025",
    category: "Insurance",
    customerId: "c1",
    customerName: "SABIC",
    workspaceId: null,
    workspaceName: null,
    tenderId: null,
    tenderName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Finance",
    uploadDate: "2025-09-20",
    currentVersion: 1,
    status: "Final",
    notes: "Annual insurance certificate covering all SABIC goods.",
    fileName: "SABIC_Insurance_2025.pdf",
    fileSize: "1.2 MB",
    fileType: "PDF",
    permissionLevel: "restricted",
    versions: [
      { versionNumber: 1, fileName: "SABIC_Insurance_2025.pdf", fileSize: "1.2 MB", fileType: "PDF", uploadedBy: "Finance", uploadedAt: "2025-09-20", notes: "Annual certificate" },
    ],
  },
  // Ma'aden Documents
  {
    id: "doc-004",
    name: "Ma'aden Jubail Expansion — Technical Proposal",
    category: "Tenders",
    customerId: "c2",
    customerName: "Ma'aden",
    workspaceId: "w1",
    workspaceName: "Ma'aden Jubail Expansion 2500PP",
    tenderId: "tn-001",
    tenderName: "Ma'aden Jubail Expansion — Logistics RFP",
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Ra'ed",
    uploadDate: "2026-02-10",
    currentVersion: 3,
    status: "Draft",
    notes: "Technical proposal for Jubail expansion. Under review.",
    fileName: "Maaden_Jubail_TechProposal_v3.docx",
    fileSize: "4.7 MB",
    fileType: "DOCX",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "Maaden_Jubail_TechProposal_v1.docx", fileSize: "3.2 MB", fileType: "DOCX", uploadedBy: "Ra'ed", uploadedAt: "2026-01-20", notes: "First draft" },
      { versionNumber: 2, fileName: "Maaden_Jubail_TechProposal_v2.docx", fileSize: "4.1 MB", fileType: "DOCX", uploadedBy: "Yazan", uploadedAt: "2026-02-01", notes: "Added cost breakdown" },
      { versionNumber: 3, fileName: "Maaden_Jubail_TechProposal_v3.docx", fileSize: "4.7 MB", fileType: "DOCX", uploadedBy: "Ra'ed", uploadedAt: "2026-02-10", notes: "Final review edits" },
    ],
  },
  {
    id: "doc-005",
    name: "Ma'aden Quote — Storage & Handling",
    category: "Quotes",
    customerId: "c2",
    customerName: "Ma'aden",
    workspaceId: "w1",
    workspaceName: "Ma'aden Jubail Expansion 2500PP",
    tenderId: null,
    tenderName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Ra'ed",
    uploadDate: "2026-01-28",
    currentVersion: 1,
    status: "Final",
    notes: "Approved quote for storage and handling services.",
    fileName: "Maaden_Quote_StorageHandling.xlsx",
    fileSize: "320 KB",
    fileType: "XLSX",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "Maaden_Quote_StorageHandling.xlsx", fileSize: "320 KB", fileType: "XLSX", uploadedBy: "Ra'ed", uploadedAt: "2026-01-28", notes: "Approved by director" },
    ],
  },
  // Almarai Documents
  {
    id: "doc-006",
    name: "Almarai Cold Chain SLA Agreement",
    category: "SLAs",
    customerId: "c3",
    customerName: "Almarai",
    workspaceId: "w5",
    workspaceName: "Almarai Riyadh Phase 2",
    tenderId: "tn-004",
    tenderName: "Almarai Riyadh Phase 2 — Cold Chain Tender",
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Hano",
    uploadDate: "2026-02-05",
    currentVersion: 1,
    status: "Draft",
    notes: "Cold chain SLA terms for Riyadh Phase 2.",
    fileName: "Almarai_ColdChain_SLA_Draft.pdf",
    fileSize: "1.8 MB",
    fileType: "PDF",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "Almarai_ColdChain_SLA_Draft.pdf", fileSize: "1.8 MB", fileType: "PDF", uploadedBy: "Hano", uploadedAt: "2026-02-05", notes: "Initial SLA draft" },
    ],
  },
  {
    id: "doc-007",
    name: "Almarai Financial Due Diligence Report",
    category: "Financial",
    customerId: "c3",
    customerName: "Almarai",
    workspaceId: null,
    workspaceName: null,
    tenderId: null,
    tenderName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Finance",
    uploadDate: "2025-08-15",
    currentVersion: 1,
    status: "Final",
    notes: "Annual financial review for Almarai account.",
    fileName: "Almarai_FinDueDiligence_2025.pdf",
    fileSize: "3.1 MB",
    fileType: "PDF",
    permissionLevel: "restricted",
    versions: [
      { versionNumber: 1, fileName: "Almarai_FinDueDiligence_2025.pdf", fileSize: "3.1 MB", fileType: "PDF", uploadedBy: "Finance", uploadedAt: "2025-08-15", notes: "Completed review" },
    ],
  },
  // Sadara Chemical Documents
  {
    id: "doc-008",
    name: "Sadara Contract Renewal Draft 2025",
    category: "Contracts",
    customerId: "c4",
    customerName: "Sadara Chemical",
    workspaceId: "w2",
    workspaceName: "Sadara Contract Renewal",
    tenderId: "tn-006",
    tenderName: "Sadara Contract Renewal Tender 2025",
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Albert",
    uploadDate: "2026-01-10",
    currentVersion: 2,
    status: "Draft",
    notes: "Contract renewal draft. Pending legal review.",
    fileName: "Sadara_ContractRenewal_v2.pdf",
    fileSize: "2.9 MB",
    fileType: "PDF",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "Sadara_ContractRenewal_v1.pdf", fileSize: "2.5 MB", fileType: "PDF", uploadedBy: "Albert", uploadedAt: "2025-12-15", notes: "Initial draft" },
      { versionNumber: 2, fileName: "Sadara_ContractRenewal_v2.pdf", fileSize: "2.9 MB", fileType: "PDF", uploadedBy: "Albert", uploadedAt: "2026-01-10", notes: "Updated terms per negotiation" },
    ],
  },
  // Aramco Documents
  {
    id: "doc-009",
    name: "Aramco VAS Expansion Compliance Checklist",
    category: "Compliance",
    customerId: "c1",
    customerName: "Aramco Services",
    workspaceId: "w6",
    workspaceName: "Aramco Dhahran VAS Expansion",
    tenderId: "tn-003",
    tenderName: "Aramco Dhahran VAS Expansion Tender",
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Ra'ed",
    uploadDate: "2026-02-08",
    currentVersion: 1,
    status: "Final",
    notes: "Compliance requirements for Aramco VAS expansion.",
    fileName: "Aramco_VAS_Compliance.pdf",
    fileSize: "1.5 MB",
    fileType: "PDF",
    permissionLevel: "restricted",
    versions: [
      { versionNumber: 1, fileName: "Aramco_VAS_Compliance.pdf", fileSize: "1.5 MB", fileType: "PDF", uploadedBy: "Ra'ed", uploadedAt: "2026-02-08", notes: "Approved compliance checklist" },
    ],
  },
  // Nestlé Documents
  {
    id: "doc-010",
    name: "Nestlé Jeddah Partnership Correspondence",
    category: "Correspondence",
    customerId: "c8",
    customerName: "Nestlé KSA",
    workspaceId: null,
    workspaceName: null,
    tenderId: "tn-005",
    tenderName: "Nestlé Jeddah Cold Chain Partnership",
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Hano",
    uploadDate: "2026-01-25",
    currentVersion: 1,
    status: "Final",
    notes: "Key correspondence with Nestlé procurement team.",
    fileName: "Nestle_Jeddah_Correspondence.pdf",
    fileSize: "650 KB",
    fileType: "PDF",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "Nestle_Jeddah_Correspondence.pdf", fileSize: "650 KB", fileType: "PDF", uploadedBy: "Hano", uploadedAt: "2026-01-25", notes: "Compiled correspondence" },
    ],
  },
  // Al-Rajhi Documents
  {
    id: "doc-011",
    name: "Al-Rajhi Emergency Storage Quote",
    category: "Quotes",
    customerId: "c5",
    customerName: "Al-Rajhi Steel",
    workspaceId: "w3",
    workspaceName: "Al-Rajhi Emergency Storage",
    tenderId: null,
    tenderName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Albert",
    uploadDate: "2026-02-12",
    currentVersion: 1,
    status: "Draft",
    notes: "Emergency storage pricing. Low margin — flagged.",
    fileName: "AlRajhi_EmergencyQuote.xlsx",
    fileSize: "180 KB",
    fileType: "XLSX",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "AlRajhi_EmergencyQuote.xlsx", fileSize: "180 KB", fileType: "XLSX", uploadedBy: "Albert", uploadedAt: "2026-02-12", notes: "Initial quote" },
    ],
  },
  // Unilever Documents
  {
    id: "doc-012",
    name: "Unilever Arabia Historical Contract 2024",
    category: "Historical",
    customerId: "c6",
    customerName: "Unilever Arabia",
    workspaceId: null,
    workspaceName: null,
    tenderId: null,
    tenderName: null,
    opportunityId: null,
    opportunityName: null,
    uploadedBy: "Albert",
    uploadDate: "2025-06-01",
    currentVersion: 1,
    status: "Archived",
    notes: "Previous year contract. Archived after expiry.",
    fileName: "Unilever_Contract_2024.pdf",
    fileSize: "2.0 MB",
    fileType: "PDF",
    permissionLevel: "internal",
    versions: [
      { versionNumber: 1, fileName: "Unilever_Contract_2024.pdf", fileSize: "2.0 MB", fileType: "PDF", uploadedBy: "Albert", uploadedAt: "2025-06-01", notes: "Archived" },
    ],
  },
];

// ─── QUERY HELPERS ───────────────────────────────────────────

export function getDocumentsByCustomer(customerId: string): UnifiedDocument[] {
  return documentVault.filter(d => d.customerId === customerId && d.status !== "Archived");
}

export function getAllDocumentsByCustomer(customerId: string): UnifiedDocument[] {
  return documentVault.filter(d => d.customerId === customerId);
}

export function getDocumentsByWorkspace(workspaceId: string): UnifiedDocument[] {
  return documentVault.filter(d => d.workspaceId === workspaceId && d.status !== "Archived");
}

export function getDocumentsByTender(tenderId: string): UnifiedDocument[] {
  return documentVault.filter(d => d.tenderId === tenderId && d.status !== "Archived");
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
    opportunityId: input.opportunityId ?? null,
    opportunityName: input.opportunityName ?? null,
    uploadedBy: input.uploadedBy,
    uploadDate: now,
    currentVersion: 1,
    status: input.status,
    notes: input.notes,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
    permissionLevel: input.permissionLevel ?? "internal",
    versions: [
      {
        versionNumber: 1,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileType: input.fileType,
        uploadedBy: input.uploadedBy,
        uploadedAt: now,
        notes: input.notes || "Initial upload",
      },
    ],
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

  // Mark previous version as superseded if status was Final
  if (doc.status === "Final") {
    doc.status = "Draft";
  }

  doc.versions.push({
    versionNumber: doc.currentVersion,
    fileName: newFileName,
    fileSize: newFileSize,
    fileType: newFileType,
    uploadedBy,
    uploadedAt: doc.uploadDate,
    notes,
  });

  logDocumentAction(doc, "document_version_replaced", `Document "${doc.name}" updated from v${oldVersion} to v${doc.currentVersion} by ${uploadedBy}. ${notes}`);
  return doc;
}

export function updateDocumentMetadata(
  docId: string,
  updates: Partial<Pick<UnifiedDocument, "name" | "category" | "status" | "notes" | "workspaceId" | "workspaceName" | "tenderId" | "tenderName" | "opportunityId" | "opportunityName" | "permissionLevel">>,
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
    logDocumentAction(doc, "document_updated", `Document "${doc.name}" metadata updated: ${changes.join(", ")}.`);
  }
  return doc;
}

export function archiveDocument(docId: string): UnifiedDocument | null {
  const doc = documentVault.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "Archived";
  logDocumentAction(doc, "document_archived", `Document "${doc.name}" archived by admin.`);
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
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const match =
        doc.name.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.notes.toLowerCase().includes(q) ||
        doc.customerName.toLowerCase().includes(q);
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

/**
 * Suggests a document category based on the workspace stage.
 */
export function suggestCategoryByStage(stage: string): DocumentCategory {
  const stageMap: Record<string, DocumentCategory> = {
    qualified: "Correspondence",
    solution_design: "Correspondence",
    quoting: "Quotes",
    proposal_active: "Quotes",
    negotiation: "Contracts",
    commercial_approved: "Contracts",
    sla_drafting: "SLAs",
    contract_ready: "Contracts",
    contract_sent: "Contracts",
    contract_signed: "Contracts",
    handover: "Contracts",
    go_live: "Contracts",
  };
  return stageMap[stage] || "Correspondence";
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

  // Also log under the customer entity for customer audit trail
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

  // If linked to workspace, also log under workspace
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

  // If linked to tender, also log under tender
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

// ─── FILE TYPE ICONS ─────────────────────────────────────────

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
    CSV: "bg-teal-100 text-teal-700",
  };
  return colors[fileType.toUpperCase()] || "bg-gray-100 text-gray-700";
}

export function getCategoryIcon(category: DocumentCategory): string {
  const icons: Record<DocumentCategory, string> = {
    Contracts: "📄",
    SLAs: "📋",
    Tenders: "📑",
    Quotes: "💰",
    Compliance: "✅",
    Insurance: "🛡️",
    Financial: "📊",
    Correspondence: "✉️",
    Historical: "📦",
  };
  return icons[category] || "📄";
}
