/**
 * workspace-integration.ts
 * ────────────────────────────────────────────────────────────
 * Controlled Workspace Integration v1 — Data Layer
 *
 * Safety constraints:
 *   • Feature flag `workspaceIntegrationV1` (default ON in dev, easy OFF)
 *   • No breaking changes to existing store types
 *   • New types + adapters only — additive integration
 *   • Every write action logs to the existing audit trail
 * ────────────────────────────────────────────────────────────
 */

import { type AuditEntry, auditLog, workspaces, quotes, proposals } from "./store";
import { syncAuditEntry } from "./supabase-sync";

// ─── FEATURE FLAG ───────────────────────────────────────────
export const featureFlags = {
  workspaceIntegrationV1: true, // default ON in dev
};

export function isWorkspaceIntegrationEnabled(): boolean {
  return featureFlags.workspaceIntegrationV1;
}

// ─── CONTRACT CYCLE ─────────────────────────────────────────
export type CycleStatus =
  | "draft"
  | "active"
  | "expiring"
  | "renewal_window"
  | "renewal_in_progress"
  | "closed";

export interface ContractCycle {
  id: string;
  workspaceId: string;
  cycleNumber: number;
  status: CycleStatus;
  startDate?: string;
  endDate?: string; // expiry
  renewalWindowDays: number;
  renewalOwnerId?: string;
  renewalOwnerName?: string;
  linkedSlaVersionId?: string;
  createdAt: string;
  createdBy: string;
}

export const contractCycles: ContractCycle[] = [];

// ─── SUPPORTING DOCS ────────────────────────────────────────
export type SupportDocCategory =
  | "Insurance"
  | "Trade License"
  | "Tax Certificate"
  | "Bank Guarantee"
  | "Power of Attorney"
  | "Technical Specs"
  | "Compliance Certificate"
  | "Other";

export const SUPPORT_DOC_CATEGORIES: SupportDocCategory[] = [
  "Insurance",
  "Trade License",
  "Tax Certificate",
  "Bank Guarantee",
  "Power of Attorney",
  "Technical Specs",
  "Compliance Certificate",
  "Other",
];

export interface SupportingDoc {
  id: string;
  workspaceId: string;
  name: string;
  fileName: string;
  category: SupportDocCategory;
  isRequiredForContractReady: boolean;
  linkedCycleId?: string;
  version: number;
  status: "active" | "archived" | "deleted";
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export const supportingDocs: SupportingDoc[] = [];

// ─── AUDIT HELPER ───────────────────────────────────────────
function logIntegrationAudit(
  entityType: string,
  entityId: string,
  action: string,
  details: string,
): void {
  const entry: AuditEntry = {
    id: `al-wi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entityType,
    entityId,
    action,
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: new Date().toISOString(),
    details,
  };
  auditLog.push(entry);
  syncAuditEntry(entry);
}

// ─── CONTRACT CYCLE HELPERS ─────────────────────────────────

/** Get all cycles for a workspace, sorted by cycleNumber */
export function getCyclesForWorkspace(workspaceId: string): ContractCycle[] {
  return contractCycles
    .filter(c => c.workspaceId === workspaceId)
    .sort((a, b) => a.cycleNumber - b.cycleNumber);
}

/** Get the active (latest) cycle for a workspace */
export function getActiveCycle(workspaceId: string): ContractCycle | undefined {
  const cycles = getCyclesForWorkspace(workspaceId);
  // Return the latest non-closed cycle, or the latest cycle
  return cycles.findLast(c => c.status !== "closed") ?? cycles[cycles.length - 1];
}

/**
 * Backfill behavior: if no cycles exist for a workspace, create Cycle #1 (draft).
 * If workspace has SLA data, link it and set endDate if available.
 * Returns the active cycle.
 */
export function getOrCreateCycle(workspaceId: string): ContractCycle {
  const existing = getActiveCycle(workspaceId);
  if (existing) return existing;

  const ws = workspaces.find(w => w.id === workspaceId);
  if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

  // Try to find SLA expiry from customer data (mock)
  const slaExpiry = getSlaExpiryForWorkspace(workspaceId);

  const cycle: ContractCycle = {
    id: `cc-${workspaceId}-1`,
    workspaceId,
    cycleNumber: 1,
    status: slaExpiry ? "active" : "draft",
    startDate: ws.createdAt,
    endDate: slaExpiry || undefined,
    renewalWindowDays: 90,
    renewalOwnerId: undefined,
    renewalOwnerName: ws.owner,
    linkedSlaVersionId: undefined,
    createdAt: new Date().toISOString(),
    createdBy: "system",
  };

  contractCycles.push(cycle);
  logIntegrationAudit("contract_cycle", cycle.id, "contract_cycle_created", `Cycle #1 created for workspace "${ws.title}" (backfill)`);
  return cycle;
}

/** Start a renewal — creates a new cycle with status renewal_in_progress */
export function startRenewal(workspaceId: string): ContractCycle {
  const ws = workspaces.find(w => w.id === workspaceId);
  if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

  const currentCycle = getActiveCycle(workspaceId);
  const nextNumber = currentCycle ? currentCycle.cycleNumber + 1 : 1;

  // Close the current cycle if it exists
  if (currentCycle && currentCycle.status !== "closed") {
    currentCycle.status = "closed";
  }

  const newCycle: ContractCycle = {
    id: `cc-${workspaceId}-${nextNumber}`,
    workspaceId,
    cycleNumber: nextNumber,
    status: "renewal_in_progress",
    startDate: undefined,
    endDate: undefined,
    renewalWindowDays: currentCycle?.renewalWindowDays ?? 90,
    renewalOwnerId: currentCycle?.renewalOwnerId,
    renewalOwnerName: currentCycle?.renewalOwnerName ?? ws.owner,
    linkedSlaVersionId: undefined,
    createdAt: new Date().toISOString(),
    createdBy: "u1",
  };

  contractCycles.push(newCycle);
  logIntegrationAudit("contract_cycle", newCycle.id, "renewal_started", `Renewal Cycle #${nextNumber} started for workspace "${ws.title}"`);
  return newCycle;
}

/** Update renewal owner */
export function updateRenewalOwner(cycleId: string, ownerId: string, ownerName: string): void {
  const cycle = contractCycles.find(c => c.id === cycleId);
  if (!cycle) return;
  const oldOwner = cycle.renewalOwnerName;
  cycle.renewalOwnerId = ownerId;
  cycle.renewalOwnerName = ownerName;
  logIntegrationAudit("contract_cycle", cycleId, "renewal_owner_changed", `Renewal owner changed from "${oldOwner}" to "${ownerName}"`);
}

/** Compute days to expiry */
export function getDaysToExpiry(endDate?: string): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Check if within renewal window */
export function isInRenewalWindow(cycle: ContractCycle): boolean {
  if (!cycle.endDate) return false;
  const daysLeft = getDaysToExpiry(cycle.endDate);
  if (daysLeft === null) return false;
  return daysLeft > 0 && daysLeft <= cycle.renewalWindowDays;
}

/** Get SLA expiry for a workspace (mock — uses hardcoded data) */
function getSlaExpiryForWorkspace(workspaceId: string): string | null {
  // Map workspace IDs to known SLA expiry dates (from SLAs mock data)
  const ws = workspaces.find(w => w.id === workspaceId);
  if (!ws) return null;
  const expiryMap: Record<string, string> = {
    "SABIC": "2026-05-31",
    "Almarai": "2025-12-31",
    "Maaden": "2027-02-28",
    "Ma'aden": "2027-02-28",
    "NADEC": "2025-06-30",
    "Aramco": "2024-12-31",
    "Aramco Services": "2024-12-31",
    "Sadara Chemical": "2026-03-31",
    "Unilever Arabia": "2025-06-30",
    "Nestlé KSA": "2026-09-30",
    "Bayer Middle East": "2026-06-30",
  };
  return expiryMap[ws.customerName] ?? null;
}

// ─── SUPPORTING DOC HELPERS ─────────────────────────────────

/** Get supporting docs for a workspace */
export function getSupportingDocs(workspaceId: string, includeArchived = false): SupportingDoc[] {
  return supportingDocs.filter(d =>
    d.workspaceId === workspaceId &&
    (includeArchived || d.status === "active")
  );
}

/** Upload a new supporting doc */
export function uploadSupportingDoc(input: {
  workspaceId: string;
  name: string;
  fileName: string;
  category: SupportDocCategory;
  isRequired?: boolean;
  linkedCycleId?: string;
  notes?: string;
}): SupportingDoc {
  const doc: SupportingDoc = {
    id: `sd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: input.workspaceId,
    name: input.name,
    fileName: input.fileName,
    category: input.category,
    isRequiredForContractReady: input.isRequired ?? false,
    linkedCycleId: input.linkedCycleId,
    version: 1,
    status: "active",
    uploadedBy: "Amin Al-Rashid",
    uploadedAt: new Date().toISOString(),
    notes: input.notes,
  };
  supportingDocs.push(doc);
  logIntegrationAudit("supporting_doc", doc.id, "supporting_doc_uploaded", `Supporting doc "${doc.name}" (${doc.category}) uploaded for workspace`);
  return doc;
}

/** Toggle "required for contract ready" flag */
export function toggleRequiredForContract(docId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.isRequiredForContractReady = !doc.isRequiredForContractReady;
  logIntegrationAudit("supporting_doc", docId, "supporting_doc_required_toggled", `"${doc.name}" required for contract: ${doc.isRequiredForContractReady}`);
  return doc;
}

/** Link a supporting doc to a contract cycle */
export function linkDocToCycle(docId: string, cycleId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.linkedCycleId = cycleId;
  logIntegrationAudit("supporting_doc", docId, "supporting_doc_linked_to_cycle", `"${doc.name}" linked to cycle ${cycleId}`);
  return doc;
}

/** Archive a supporting doc */
export function archiveSupportingDoc(docId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "archived";
  logIntegrationAudit("supporting_doc", docId, "supporting_doc_archived", `"${doc.name}" archived`);
  return doc;
}

/** Restore a supporting doc */
export function restoreSupportingDoc(docId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "active";
  logIntegrationAudit("supporting_doc", docId, "supporting_doc_restored", `"${doc.name}" restored`);
  return doc;
}

// ─── CONTRACT READY CHECKS ─────────────────────────────────

export interface ContractReadyCheck {
  label: string;
  passed: boolean;
  cta?: string; // CTA text if not passed
  ctaAction?: string; // action key for the CTA
}

/**
 * Returns a list of checks required for "Contract Ready" stage.
 * Used by the stage gating system.
 */
export function getContractReadyChecks(workspaceId: string): ContractReadyCheck[] {
  const checks: ContractReadyCheck[] = [];

  // 1. At least one proposal version exists
  const wsProposals = proposals.filter(p => p.workspaceId === workspaceId);
  checks.push({
    label: "At least one proposal version exists",
    passed: wsProposals.length > 0,
    cta: "Create Proposal",
    ctaAction: "create_proposal",
  });

  // 2. At least one approved quote exists
  const approvedQuote = quotes.find(q => q.workspaceId === workspaceId && q.state === "approved");
  checks.push({
    label: "Approved quote exists",
    passed: !!approvedQuote,
    cta: "Approve Quote",
    ctaAction: "approve_quote",
  });

  // 3. All required supporting docs are uploaded and active
  const requiredDocs = supportingDocs.filter(d =>
    d.workspaceId === workspaceId &&
    d.isRequiredForContractReady
  );
  const missingDocs = requiredDocs.filter(d => d.status !== "active");
  const hasRequiredDocs = requiredDocs.length === 0 || missingDocs.length === 0;
  checks.push({
    label: requiredDocs.length > 0
      ? `All required supporting docs uploaded (${requiredDocs.filter(d => d.status === "active").length}/${requiredDocs.length})`
      : "No required supporting docs defined",
    passed: hasRequiredDocs,
    cta: "Upload Documents",
    ctaAction: "upload_docs",
  });

  return checks;
}

// ─── MOCK DATA SEEDING ──────────────────────────────────────
let _seeded = false;

/**
 * Seed mock data for development.
 * Call once on app init when feature flag is ON.
 */
export function seedWorkspaceIntegrationData(): void {
  if (_seeded) return;
  _seeded = true;

  // Seed contract cycles for workspaces that have SLA data
  const seedCycles: Omit<ContractCycle, "id">[] = [
    { workspaceId: "w2", cycleNumber: 1, status: "expiring", startDate: "2023-04-01", endDate: "2026-03-31", renewalWindowDays: 90, renewalOwnerId: "u3", renewalOwnerName: "Albert", linkedSlaVersionId: undefined, createdAt: "2023-04-01T00:00:00Z", createdBy: "system" },
    { workspaceId: "w6", cycleNumber: 1, status: "active", startDate: "2024-01-01", endDate: "2026-12-31", renewalWindowDays: 90, renewalOwnerId: "u2", renewalOwnerName: "Ra'ed", linkedSlaVersionId: undefined, createdAt: "2024-01-01T00:00:00Z", createdBy: "system" },
    { workspaceId: "w7", cycleNumber: 1, status: "draft", startDate: "2025-09-20", endDate: "2026-09-30", renewalWindowDays: 90, renewalOwnerId: "u4", renewalOwnerName: "Hano", linkedSlaVersionId: undefined, createdAt: "2025-09-20T00:00:00Z", createdBy: "system" },
    { workspaceId: "w8", cycleNumber: 1, status: "active", startDate: "2024-06-01", endDate: "2026-06-30", renewalWindowDays: 90, renewalOwnerId: "u4", renewalOwnerName: "Hano", linkedSlaVersionId: undefined, createdAt: "2024-06-01T00:00:00Z", createdBy: "system" },
  ];

  for (const seed of seedCycles) {
    contractCycles.push({ ...seed, id: `cc-${seed.workspaceId}-${seed.cycleNumber}` });
  }

  // Seed some supporting docs
  const seedDocs: Omit<SupportingDoc, "id">[] = [
    { workspaceId: "w2", name: "Sadara Trade License 2025", fileName: "sadara-trade-license-2025.pdf", category: "Trade License", isRequiredForContractReady: true, linkedCycleId: "cc-w2-1", version: 1, status: "active", uploadedBy: "Albert Fernandez", uploadedAt: "2025-11-15T10:00:00Z" },
    { workspaceId: "w2", name: "Sadara Insurance Certificate", fileName: "sadara-insurance-cert.pdf", category: "Insurance", isRequiredForContractReady: true, linkedCycleId: "cc-w2-1", version: 1, status: "active", uploadedBy: "Albert Fernandez", uploadedAt: "2025-11-20T10:00:00Z" },
    { workspaceId: "w6", name: "Aramco Compliance Certificate", fileName: "aramco-compliance.pdf", category: "Compliance Certificate", isRequiredForContractReady: true, linkedCycleId: "cc-w6-1", version: 1, status: "active", uploadedBy: "Ra'ed Al-Harbi", uploadedAt: "2025-10-20T10:00:00Z" },
    { workspaceId: "w7", name: "Nestlé Cold Chain Specs", fileName: "nestle-cold-chain-specs.pdf", category: "Technical Specs", isRequiredForContractReady: false, version: 1, status: "active", uploadedBy: "Hano", uploadedAt: "2025-10-01T10:00:00Z" },
  ];

  for (const seed of seedDocs) {
    supportingDocs.push({ ...seed, id: `sd-${seed.workspaceId}-${Math.random().toString(36).slice(2, 6)}` });
  }
}

// ─── TEAM MEMBERS (for renewal owner dropdown) ──────────────
export const teamMembers = [
  { id: "u1", name: "Amin Al-Rashid", role: "Admin" },
  { id: "u2", name: "Ra'ed Al-Harbi", role: "Regional Sales Head" },
  { id: "u3", name: "Albert Fernandez", role: "Account Manager" },
  { id: "u4", name: "Hano", role: "Account Manager" },
  { id: "u5", name: "Nora Al-Dosari", role: "Commercial Analyst" },
  { id: "u6", name: "Mohammed Al-Qahtani", role: "Director" },
];
