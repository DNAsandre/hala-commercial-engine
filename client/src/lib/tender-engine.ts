import { getCurrentUser } from "./auth-state";
/*
 * Tender Engine — Commercial Lifecycle Engine
 *
 * Redesigned for decision-first, human-controlled stage management.
 * No blocking, no governance enforcement, no typing confirmations.
 * Movement is instant. System logs but never blocks.
 *
 * 10-Stage Lifecycle:
 *   Identified → Preparing Submission → Submitted → Clarification →
 *   Technical Review → Commercial Review → Negotiation → Awarded / Lost / Withdrawn
 */

import {
  type AuditEntry,
  type Region,
  type Workspace,
  auditLog,
  workspaces,
  customers,
  formatSAR,
} from "./store";
import { syncTenderCreate, syncTenderUpdate, syncAuditEntry } from "./supabase-sync";

// ─── TENDER MILESTONE (LIFECYCLE) ──────────────────────────

export type TenderMilestone =
  | "identified"
  | "preparing_submission"
  | "submitted"
  | "clarification"
  | "technical_review"
  | "commercial_review"
  | "negotiation"
  | "awarded"
  | "lost"
  | "withdrawn";

// Keep TenderStatus as alias for backward compatibility
export type TenderStatus = TenderMilestone;

export const TENDER_MILESTONE_ORDER: TenderMilestone[] = [
  "identified",
  "preparing_submission",
  "submitted",
  "clarification",
  "technical_review",
  "commercial_review",
  "negotiation",
  "awarded",
];

// Active (non-terminal) milestones — shown in kanban and filters
export const TENDER_KANBAN_COLUMNS: TenderMilestone[] = [
  "identified",
  "preparing_submission",
  "submitted",
  "clarification",
  "technical_review",
  "commercial_review",
  "negotiation",
  "awarded",
  "lost",
  "withdrawn",
];

// Terminal milestones
export const TENDER_TERMINAL: TenderMilestone[] = ["awarded", "lost", "withdrawn"];

// Recommended (soft) transitions — guidance only, never enforced
export const TENDER_SOFT_TRANSITIONS: Record<TenderMilestone, TenderMilestone[]> = {
  identified: ["preparing_submission"],
  preparing_submission: ["submitted"],
  submitted: ["clarification", "technical_review", "commercial_review"],
  clarification: ["technical_review", "commercial_review", "negotiation"],
  technical_review: ["commercial_review", "negotiation"],
  commercial_review: ["negotiation"],
  negotiation: ["awarded", "lost"],
  awarded: [],
  lost: [],
  withdrawn: [],
};

export function getMilestoneIndex(milestone: TenderMilestone): number {
  return TENDER_MILESTONE_ORDER.indexOf(milestone);
}

export function getSuggestedNextMilestones(current: TenderMilestone): TenderMilestone[] {
  return TENDER_SOFT_TRANSITIONS[current] ?? [];
}

export function getPrimaryNextMilestone(current: TenderMilestone): TenderMilestone | null {
  const suggestions = getSuggestedNextMilestones(current);
  return suggestions[0] ?? null;
}

export function getTenderStatusDisplayName(status: TenderMilestone): string {
  const labels: Record<TenderMilestone, string> = {
    identified: "Identified",
    preparing_submission: "Preparing Submission",
    submitted: "Submitted",
    clarification: "Clarification",
    technical_review: "Technical Review",
    commercial_review: "Commercial Review",
    negotiation: "Negotiation",
    awarded: "Awarded",
    lost: "Lost",
    withdrawn: "Withdrawn",
  };
  return labels[status] ?? status;
}

// Short labels for the milestone strip
export function getTenderMilestoneShortLabel(status: TenderMilestone): string {
  const labels: Record<TenderMilestone, string> = {
    identified: "Identified",
    preparing_submission: "Preparing",
    submitted: "Submitted",
    clarification: "Clarification",
    technical_review: "Tech Review",
    commercial_review: "Commercial",
    negotiation: "Negotiation",
    awarded: "Awarded",
    lost: "Lost",
    withdrawn: "Withdrawn",
  };
  return labels[status] ?? status;
}

export function getTenderStatusColor(status: TenderMilestone): string {
  const colors: Record<TenderMilestone, string> = {
    identified: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    preparing_submission: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    submitted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    clarification: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    technical_review: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    commercial_review: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    awarded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    withdrawn: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  return colors[status] ?? "";
}

// Margin signal interpretation
export function getMarginSignal(gpPercent: number): { label: string; color: "green" | "amber" | "red" } {
  if (gpPercent >= 25) return { label: "Healthy", color: "green" };
  if (gpPercent >= 20) return { label: "Tight", color: "amber" };
  return { label: "Risk", color: "red" };
}

// Time risk interpretation
export function getTimeRisk(deadlineStr: string): { label: string; color: "green" | "amber" | "red" } {
  const days = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Overdue", color: "red" };
  if (days <= 7) return { label: `Due in ${days}d`, color: "red" };
  if (days <= 21) return { label: `Due in ${days}d`, color: "amber" };
  return { label: "On Track", color: "green" };
}

// State signal — what does the current milestone imply?
export function getStateSignal(status: TenderMilestone, daysInStatus: number): string {
  const signals: Record<TenderMilestone, string> = {
    identified: "Needs qualification",
    preparing_submission: "Submission in progress",
    submitted: "Awaiting customer response",
    clarification: "Clarification round active",
    technical_review: "Technical evaluation underway",
    commercial_review: "Commercial evaluation underway",
    negotiation: "In active negotiation",
    awarded: "Contract awarded",
    lost: "Tender not awarded",
    withdrawn: "Tender withdrawn",
  };
  const base = signals[status] ?? status;
  if (daysInStatus > 21 && !TENDER_TERMINAL.includes(status)) {
    return `${base} — stalled ${daysInStatus}d`;
  }
  return base;
}

export type TenderSource = "CRM" | "Direct" | "Referral";

// ─── TENDER ENTITY ─────────────────────────────────────────

export interface Tender {
  id: string;
  linkedWorkspaceId: string | null;
  customerId: string;
  customerName: string;
  title: string;
  submissionDeadline: string; // ISO date
  estimatedValue: number;
  targetGpPercent: number;
  probabilityPercent: number;
  assignedOwner: string;
  assignedTeamMembers: string[];
  status: TenderMilestone;
  source: TenderSource;
  region: Region;
  createdAt: string;
  updatedAt: string;
  daysInStatus: number;
  notes: string;
  crmSynced?: boolean;
}

// ─── MOCK DATA ─────────────────────────────────────────────

let tenderIdCounter = 10;

export const tenders: Tender[] = [
  {
    id: "tn-001",
    linkedWorkspaceId: "w1",
    customerId: "c2",
    customerName: "Ma'aden",
    title: "Ma'aden Jubail Expansion — Logistics RFP",
    submissionDeadline: "2026-05-20",
    estimatedValue: 3400000,
    targetGpPercent: 22,
    probabilityPercent: 60,
    assignedOwner: "Ra'ed",
    assignedTeamMembers: ["Ra'ed", "Yazan", "Finance"],
    status: "preparing_submission",
    source: "CRM",
    region: "East",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-14",
    daysInStatus: 8,
    notes: "Linked to workspace w1. Technical draft in progress.",
    crmSynced: false,
  },
  {
    id: "tn-002",
    linkedWorkspaceId: null,
    customerId: "c1",
    customerName: "SABIC",
    title: "SABIC National Warehousing Services Tender",
    submissionDeadline: "2026-06-01",
    estimatedValue: 15000000,
    targetGpPercent: 25,
    probabilityPercent: 45,
    assignedOwner: "Ra'ed",
    assignedTeamMembers: ["Ra'ed", "Albert", "Yazan", "Finance", "Legal"],
    status: "identified",
    source: "Direct",
    region: "East",
    createdAt: "2026-02-01",
    updatedAt: "2026-02-15",
    daysInStatus: 14,
    notes: "Large strategic tender. Committee formation pending.",
    crmSynced: false,
  },
  {
    id: "tn-003",
    linkedWorkspaceId: "w6",
    customerId: "c1",
    customerName: "Aramco Services",
    title: "Aramco Dhahran VAS Expansion Tender",
    submissionDeadline: "2026-04-30",
    estimatedValue: 12000000,
    targetGpPercent: 28,
    probabilityPercent: 75,
    assignedOwner: "Ra'ed",
    assignedTeamMembers: ["Ra'ed", "Hano", "Finance"],
    status: "submitted",
    source: "CRM",
    region: "East",
    createdAt: "2025-12-20",
    updatedAt: "2026-02-10",
    daysInStatus: 5,
    notes: "Submitted on time. Awaiting evaluation committee review.",
    crmSynced: false,
  },
  {
    id: "tn-004",
    linkedWorkspaceId: "w5",
    customerId: "c3",
    customerName: "Almarai",
    title: "Almarai Riyadh Phase 2 — Cold Chain Tender",
    submissionDeadline: "2026-04-15",
    estimatedValue: 8500000,
    targetGpPercent: 30,
    probabilityPercent: 70,
    assignedOwner: "Hano",
    assignedTeamMembers: ["Hano", "Yazan", "Finance"],
    status: "commercial_review",
    source: "CRM",
    region: "Central",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-16",
    daysInStatus: 5,
    notes: "High-value strategic account. Technical analysis complete.",
    crmSynced: false,
  },
  {
    id: "tn-005",
    linkedWorkspaceId: null,
    customerId: "c8",
    customerName: "Nestlé KSA",
    title: "Nestlé Jeddah Cold Chain Partnership",
    submissionDeadline: "2026-05-01",
    estimatedValue: 6200000,
    targetGpPercent: 26,
    probabilityPercent: 55,
    assignedOwner: "Hano",
    assignedTeamMembers: ["Hano", "Albert"],
    status: "technical_review",
    source: "Referral",
    region: "West",
    createdAt: "2025-11-15",
    updatedAt: "2026-02-12",
    daysInStatus: 12,
    notes: "Evaluation ongoing. Shortlisted with 2 competitors.",
    crmSynced: false,
  },
  {
    id: "tn-006",
    linkedWorkspaceId: "w2",
    customerId: "c4",
    customerName: "Sadara Chemical",
    title: "Sadara Contract Renewal Tender 2025",
    submissionDeadline: "2026-05-28",
    estimatedValue: 2800000,
    targetGpPercent: 24,
    probabilityPercent: 85,
    assignedOwner: "Albert",
    assignedTeamMembers: ["Albert", "Ra'ed"],
    status: "negotiation",
    source: "CRM",
    region: "East",
    createdAt: "2025-10-15",
    updatedAt: "2026-02-14",
    daysInStatus: 3,
    notes: "Renewal tender. Strong relationship. High probability.",
    crmSynced: false,
  },
  {
    id: "tn-007",
    linkedWorkspaceId: null,
    customerId: "c3",
    customerName: "Almarai",
    title: "Almarai Dammam Distribution Center",
    submissionDeadline: "2025-12-15",
    estimatedValue: 4500000,
    targetGpPercent: 27,
    probabilityPercent: 0,
    assignedOwner: "Hano",
    assignedTeamMembers: ["Hano", "Yazan"],
    status: "awarded",
    source: "Direct",
    region: "East",
    createdAt: "2025-08-01",
    updatedAt: "2025-12-20",
    daysInStatus: 58,
    notes: "Won. Contract signed. Handover initiated.",
    crmSynced: true,
  },
  {
    id: "tn-008",
    linkedWorkspaceId: null,
    customerId: "c6",
    customerName: "Unilever Arabia",
    title: "Unilever Riyadh Expansion RFP",
    submissionDeadline: "2025-11-30",
    estimatedValue: 3200000,
    targetGpPercent: 20,
    probabilityPercent: 0,
    assignedOwner: "Albert",
    assignedTeamMembers: ["Albert"],
    status: "lost",
    source: "CRM",
    region: "Central",
    createdAt: "2025-07-15",
    updatedAt: "2025-12-05",
    daysInStatus: 73,
    notes: "Lost to competitor. Price was 12% higher.",
    crmSynced: true,
  },
];

// ─── TRANSITION TYPES ──────────────────────────────────────

export interface TenderTransitionContext {
  tender: Tender;
  fromStatus: TenderMilestone;
  toStatus: TenderMilestone;
}

export interface TenderTransitionRule {
  from: TenderMilestone | "*";
  to: TenderMilestone | "*";
  name: string;
  validate: (ctx: TenderTransitionContext) => string | null;
}

export interface TenderValidationFailure {
  ruleName: string;
  error: string;
}

export interface TenderGovernanceOverride {
  overrideReason: string;
  userId: string;
  userName: string;
  timestamp: string;
  overriddenRules: string[];
  fromStatus: TenderMilestone;
  toStatus: TenderMilestone;
  tenderId: string;
}

export interface TenderTransitionResult {
  success: boolean;
  message: string;
  nextStatus: TenderMilestone | null;
  fromStatus: TenderMilestone;
  validationErrors: string[];
  transitionTimestamp?: string;
  workspaceSuggestion?: WorkspaceSuggestion | null;
}

export interface WorkspaceSuggestion {
  type: "advance_to_commercial_approved" | "mark_closed_lost";
  workspaceId: string;
  workspaceName: string;
  message: string;
}

export const tenderGovernanceOverrides: TenderGovernanceOverride[] = [];

// ─── STAGE HISTORY ─────────────────────────────────────────

export interface TenderStageHistoryEntry {
  id: string;
  tenderId: string;
  fromStatus: TenderMilestone;
  toStatus: TenderMilestone;
  action: "advanced" | "reverted";
  userId: string;
  userName: string;
  timestamp: string;
  reason: string;
  note?: string;
}

export const tenderStageHistory: TenderStageHistoryEntry[] = [];

// ─── UNDO STATE ────────────────────────────────────────────

export interface TenderUndoRecord {
  tenderId: string;
  fromStatus: TenderMilestone;
  toStatus: TenderMilestone;
  timestamp: number;
  userId: string;
  userName: string;
}

const tenderUndoRecords: Map<string, TenderUndoRecord> = new Map();
const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─── ENGINE — FRICTIONLESS MOVEMENT ───────────────────────

/**
 * Move tender milestone instantly. No blocking, no required approvals.
 * Logs the transition. Optionally stores a user note.
 */
export function moveTenderMilestone(
  tenderId: string,
  targetMilestone: TenderMilestone,
  note?: string,
): TenderTransitionResult {
  const tender = tenders.find(t => t.id === tenderId);
  if (!tender) {
    return {
      success: false,
      message: "Tender not found.",
      nextStatus: null,
      fromStatus: "identified",
      validationErrors: ["Tender ID does not exist."],
    };
  }

  const fromStatus = tender.status;

  if (fromStatus === targetMilestone) {
    return {
      success: false,
      message: "Tender is already at this milestone.",
      nextStatus: null,
      fromStatus,
      validationErrors: [],
    };
  }

  const now = new Date();
  tender.status = targetMilestone;
  tender.daysInStatus = 0;
  tender.updatedAt = now.toISOString().slice(0, 10);

  // Persist to Supabase (best-effort, non-blocking)
  void syncTenderUpdate(tenderId, { status: targetMilestone, daysInStatus: 0 });

  const successMsg = `Milestone updated to ${getTenderStatusDisplayName(targetMilestone)}.`;

  // Audit log
  const entry: AuditEntry = {
    id: `al-tn-${crypto.randomUUID()}`,
    entityType: "tender",
    entityId: tender.id,
    action: "tender_status_advanced",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    details: `${successMsg} (from ${getTenderStatusDisplayName(fromStatus)})${note ? ` — Note: "${note}"` : ""}`,
  };
  void syncAuditEntry(entry);

  tenderStageHistory.unshift({
    id: `tsh-${crypto.randomUUID()}`,
    tenderId,
    fromStatus,
    toStatus: targetMilestone,
    action: "advanced",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    reason: successMsg,
    note,
  });

  tenderUndoRecords.set(tenderId, {
    tenderId,
    fromStatus,
    toStatus: targetMilestone,
    timestamp: now.getTime(),
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
  });

  const suggestion = generateWorkspaceSuggestion(tender, targetMilestone);

  return {
    success: true,
    message: successMsg,
    nextStatus: targetMilestone,
    fromStatus,
    validationErrors: [],
    transitionTimestamp: now.toISOString(),
    workspaceSuggestion: suggestion,
  };
}

// Backward-compat alias
export function advanceTenderStatus(
  tenderId: string,
  targetStatus: TenderMilestone,
  _options?: { overrideReason?: string },
): TenderTransitionResult {
  return moveTenderMilestone(tenderId, targetStatus, _options?.overrideReason);
}

export function preflightTenderValidation(
  _tenderId: string,
  _targetStatus: TenderMilestone,
): TenderValidationFailure[] {
  // No blocking validations in this phase
  return [];
}

function generateWorkspaceSuggestion(
  tender: Tender,
  newStatus: TenderMilestone,
): WorkspaceSuggestion | null {
  if (!tender.linkedWorkspaceId) return null;
  const workspace = workspaces.find(w => w.id === tender.linkedWorkspaceId);
  if (!workspace) return null;

  if (newStatus === "awarded") {
    return {
      type: "advance_to_commercial_approved",
      workspaceId: workspace.id,
      workspaceName: workspace.title,
      message: `Tender awarded. Consider advancing workspace "${workspace.title}" to Commercial Approved.`,
    };
  }
  if (newStatus === "lost") {
    return {
      type: "mark_closed_lost",
      workspaceId: workspace.id,
      workspaceName: workspace.title,
      message: `Tender lost. Consider marking workspace "${workspace.title}" as Closed – Lost.`,
    };
  }
  return null;
}

// ─── UNDO ──────────────────────────────────────────────────

export interface TenderUndoEligibility {
  eligible: boolean;
  reasons: string[];
  remainingMs: number;
  requiresReason: boolean;
}

export function checkTenderUndoEligibility(tenderId: string): TenderUndoEligibility {
  const record = tenderUndoRecords.get(tenderId);
  if (!record) {
    return { eligible: false, reasons: ["No recent transition to undo."], remainingMs: 0, requiresReason: false };
  }
  const elapsed = Date.now() - record.timestamp;
  const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);
  if (elapsed <= UNDO_WINDOW_MS) {
    return { eligible: true, reasons: [], remainingMs: remaining, requiresReason: false };
  }
  return { eligible: true, reasons: [], remainingMs: 0, requiresReason: false };
}

export interface TenderRevertResult {
  success: boolean;
  message: string;
  revertedFrom: TenderMilestone;
  revertedTo: TenderMilestone;
}

export function revertTenderStatus(tenderId: string): TenderRevertResult {
  const record = tenderUndoRecords.get(tenderId);
  if (!record) {
    return { success: false, message: "No transition to undo.", revertedFrom: "identified", revertedTo: "identified" };
  }

  const tender = tenders.find(t => t.id === tenderId);
  if (!tender) {
    return { success: false, message: "Tender not found.", revertedFrom: record.toStatus, revertedTo: record.fromStatus };
  }

  const revertedFrom = tender.status;
  tender.status = record.fromStatus;
  tender.daysInStatus = 0;
  tender.updatedAt = new Date().toISOString().slice(0, 10);
  void syncTenderUpdate(tenderId, { status: record.fromStatus, daysInStatus: 0 });

  const now = new Date();
  const msg = `Milestone reverted from ${getTenderStatusDisplayName(revertedFrom)} to ${getTenderStatusDisplayName(record.fromStatus)}.`;

  const entry: AuditEntry = {
    id: `al-tn-rv-${crypto.randomUUID()}`,
    entityType: "tender",
    entityId: tenderId,
    action: "tender_status_reverted",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    details: msg,
  };
  void syncAuditEntry(entry);

  tenderStageHistory.unshift({
    id: `tsh-rv-${crypto.randomUUID()}`,
    tenderId,
    fromStatus: revertedFrom,
    toStatus: record.fromStatus,
    action: "reverted",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    reason: msg,
  });

  tenderUndoRecords.delete(tenderId);
  return { success: true, message: msg, revertedFrom, revertedTo: record.fromStatus };
}

export function hasTenderUndoRecord(tenderId: string): boolean {
  return tenderUndoRecords.has(tenderId);
}

export function getTenderStageHistory(tenderId: string): readonly TenderStageHistoryEntry[] {
  return tenderStageHistory.filter(h => h.tenderId === tenderId);
}

// Backward-compat shims
export function getNextTenderStatus(current: TenderMilestone): TenderMilestone | null {
  return getPrimaryNextMilestone(current);
}

export function getTenderStatusIndex(status: TenderMilestone): number {
  return getMilestoneIndex(status);
}

export function registerTenderRule(_rule: TenderTransitionRule): void {
  // No-op in human-first mode
}

export function getRegisteredTenderRules(): readonly TenderTransitionRule[] {
  return [];
}

// ─── METRICS ───────────────────────────────────────────────

export function getTenderMetrics(liveTenders?: Tender[]) {
  const src = liveTenders ?? tenders;
  const open = src.filter(t => !TENDER_TERMINAL.includes(t.status));
  const awarded = src.filter(t => t.status === "awarded");
  const lost = src.filter(t => t.status === "lost");
  const decided = awarded.length + lost.length;
  const winRate = decided > 0 ? (awarded.length / decided) * 100 : 0;

  const submitted = src.filter(t =>
    ["submitted", "clarification", "technical_review", "commercial_review", "negotiation", "awarded", "lost"].includes(t.status)
  );
  const avgCycleDays = submitted.length > 0
    ? submitted.reduce((sum, t) => {
        const created = new Date(t.createdAt);
        const updated = new Date(t.updatedAt);
        return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0) / submitted.length
    : 0;

  const activePipelineValue = open.reduce((sum, t) => sum + t.estimatedValue, 0);
  const weightedPipeline = open.reduce((sum, t) => sum + t.estimatedValue * (t.probabilityPercent / 100), 0);

  // Stalled: open tenders with daysInStatus > 14
  const stalled = open.filter(t => t.daysInStatus > 14);

  // Risk signals
  const lowMargin = open.filter(t => t.targetGpPercent < 22);
  const overdue = open.filter(t => {
    if (!t.submissionDeadline) return false;
    const days = Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days < 0;
  });

  return {
    totalOpen: open.length,
    totalAwarded: awarded.length,
    totalLost: lost.length,
    winRate,
    totalWon: awarded.length,
    avgSubmissionCycleDays: Math.round(avgCycleDays),
    activePipelineValue,
    weightedPipeline,
    stalled,
    lowMargin,
    overdue,
    byStatus: TENDER_KANBAN_COLUMNS.map(s => ({
      status: s,
      count: src.filter(t => t.status === s).length,
      value: src.filter(t => t.status === s).reduce((sum, t) => sum + t.estimatedValue, 0),
    })),
  };
}

// ─── CRUD ──────────────────────────────────────────────────

export function createTender(data: Omit<Tender, "id" | "createdAt" | "updatedAt" | "daysInStatus">): Tender {
  const now = new Date().toISOString().slice(0, 10);
  const tender: Tender = {
    ...data,
    id: `tn-${String(++tenderIdCounter).padStart(3, "0")}`,
    createdAt: now,
    updatedAt: now,
    daysInStatus: 0,
  };
  tenders.unshift(tender);
  void syncTenderCreate(tender);

  const entry: AuditEntry = {
    id: `al-tn-cr-${crypto.randomUUID()}`,
    entityType: "tender",
    entityId: tender.id,
    action: "tender_created",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: new Date().toISOString(),
    details: `Tender "${tender.title}" created for ${tender.customerName}. Estimated value: ${formatSAR(tender.estimatedValue)}.`,
  };
  void syncAuditEntry(entry);

  return tender;
}

export function getTenderById(id: string): Tender | undefined {
  return tenders.find(t => t.id === id);
}

export function getTendersByWorkspace(workspaceId: string): Tender[] {
  return tenders.filter(t => t.linkedWorkspaceId === workspaceId);
}

export function getTendersByCustomer(customerId: string): Tender[] {
  return tenders.filter(t => t.customerId === customerId);
}
