import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
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

import { type AuditEntry, type Workspace, type Quote, type Proposal } from "./store";
import { fetchWorkspaceById, fetchQuotesByWorkspace, fetchProposalsByWorkspace } from "./supabase-data";
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
    id: `al-wi-${crypto.randomUUID()}`,
    entityType,
    entityId,
    action,
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: new Date().toISOString(),
    details,
  };
  // Write to Supabase only (no in-memory push, no duplicate write)
  void syncAuditEntry(entry);
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
export async function getOrCreateCycle(workspaceId: string, wsData?: Workspace | null): Promise<ContractCycle> {
  const existing = getActiveCycle(workspaceId);
  if (existing) return existing;

  const ws = wsData ?? await fetchWorkspaceById(workspaceId);
  if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

  // No inferred SLA expiry. It must come from persisted source data.
  const slaExpiry = getSlaExpiryForWorkspace(workspaceId, ws);

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
export async function startRenewal(workspaceId: string, wsData?: Workspace | null): Promise<ContractCycle> {
  const ws = wsData ?? await fetchWorkspaceById(workspaceId);
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
    createdBy: getCurrentUser().id,
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

/** Get SLA expiry for a workspace. No hardcoded customer/date map is allowed. */
function getSlaExpiryForWorkspace(_workspaceId: string, _ws?: Workspace | null): string | null {
  return null;
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
    id: `sd-${crypto.randomUUID()}`,
    workspaceId: input.workspaceId,
    name: input.name,
    fileName: input.fileName,
    category: input.category,
    isRequiredForContractReady: input.isRequired ?? false,
    linkedCycleId: input.linkedCycleId,
    version: 1,
    status: "active",
    uploadedBy: getCurrentUser().name,
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
export async function getContractReadyChecks(workspaceId: string): Promise<ContractReadyCheck[]> {
  const checks: ContractReadyCheck[] = [];

  // 1. At least one proposal version exists (from Supabase)
  const wsProposals = await fetchProposalsByWorkspace(workspaceId);
  checks.push({
    label: "At least one proposal version exists",
    passed: wsProposals.length > 0,
    cta: "Create Proposal",
    ctaAction: "create_proposal",
  });

  // 2. At least one approved quote exists (from Supabase)
  const wsQuotes = await fetchQuotesByWorkspace(workspaceId);
  const approvedQuote = wsQuotes.find(q => q.state === "approved");
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

// ─── NO-OP LEGACY SEEDING ──────────────────────────────────────
let _seeded = false;

/**
 * Legacy initializer retained for existing imports; it does not seed business data.
 */
export function seedWorkspaceIntegrationData(): void {
  _seeded = true;
}

// ─── TEAM MEMBERS (for renewal owner dropdown) ──────────────
export const teamMembers = [
  { id: getCurrentUser().id, name: getCurrentUser().name, role: getCurrentUser().role },
];
