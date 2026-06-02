import { getCurrentUser } from "./auth-state";
import type { SowData } from "./sow-pdf-studio-wiring";
import type { TenderPricingData } from "./tender-pricing-types";
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

// ─── CRM PIPELINE STAGES (Kanban) ──────────────────────────────

export type TenderMilestone =
  | "prospecting"
  | "qualified"
  | "proposal_sent"
  | "shortlisted"
  | "contract_negotiation"
  | "closed_won"
  | "contract_signed"
  | "operational_handover"
  | "closed_lost"
  | "discontinued";

// Keep TenderStatus as alias for backward compatibility
export type TenderStatus = TenderMilestone;

export const TENDER_MILESTONE_ORDER: TenderMilestone[] = [
  "prospecting",
  "qualified",
  "proposal_sent",
  "shortlisted",
  "contract_negotiation",
  "closed_won",
  "contract_signed",
  "operational_handover",
];

// Kanban columns — all stages including terminal
export const TENDER_KANBAN_COLUMNS: TenderMilestone[] = [
  "prospecting",
  "qualified",
  "proposal_sent",
  "shortlisted",
  "contract_negotiation",
  "closed_won",
  "contract_signed",
  "operational_handover",
  "closed_lost",
  "discontinued",
];

// Terminal milestones — drag disabled
export const TENDER_TERMINAL: TenderMilestone[] = ["closed_won", "closed_lost", "discontinued", "operational_handover"];

// Recommended (soft) transitions — guidance only, never enforced
export const TENDER_SOFT_TRANSITIONS: Record<TenderMilestone, TenderMilestone[]> = {
  prospecting: ["qualified"],
  qualified: ["proposal_sent"],
  proposal_sent: ["shortlisted"],
  shortlisted: ["contract_negotiation"],
  contract_negotiation: ["closed_won", "closed_lost"],
  closed_won: ["contract_signed"],
  contract_signed: ["operational_handover"],
  operational_handover: [],
  closed_lost: [],
  discontinued: [],
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
    prospecting: "Prospecting",
    qualified: "Qualified",
    proposal_sent: "Proposal Sent",
    shortlisted: "Shortlisted",
    contract_negotiation: "Contract Negotiation",
    closed_won: "Closed Won",
    contract_signed: "Contract Signed",
    operational_handover: "Operational Handover",
    closed_lost: "Closed Lost",
    discontinued: "Discontinued",
  };
  return labels[status] ?? status;
}

// Short labels for the milestone strip
export function getTenderMilestoneShortLabel(status: TenderMilestone): string {
  const labels: Record<TenderMilestone, string> = {
    prospecting: "Prospecting",
    qualified: "Qualified",
    proposal_sent: "Proposal Sent",
    shortlisted: "Shortlisted",
    contract_negotiation: "Negotiation",
    closed_won: "Closed Won",
    contract_signed: "Contract Signed",
    operational_handover: "Ops Handover",
    closed_lost: "Closed Lost",
    discontinued: "Discontinued",
  };
  return labels[status] ?? status;
}

export function getTenderStatusColor(status: TenderMilestone): string {
  const colors: Record<TenderMilestone, string> = {
    prospecting: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    qualified: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    proposal_sent: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    shortlisted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    contract_negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    closed_won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    contract_signed: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    operational_handover: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    closed_lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    discontinued: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  return colors[status] ?? "";
}

// Stage header background colors
export const TENDER_STATUS_HEADER_BG: Record<TenderMilestone, string> = {
  prospecting: "bg-slate-50 dark:bg-slate-900/30",
  qualified: "bg-blue-50 dark:bg-blue-900/30",
  proposal_sent: "bg-violet-50 dark:bg-violet-900/30",
  shortlisted: "bg-amber-50 dark:bg-amber-900/30",
  contract_negotiation: "bg-orange-50 dark:bg-orange-900/30",
  closed_won: "bg-emerald-50 dark:bg-emerald-900/30",
  contract_signed: "bg-teal-50 dark:bg-teal-900/30",
  operational_handover: "bg-cyan-50 dark:bg-cyan-900/30",
  closed_lost: "bg-red-50 dark:bg-red-900/30",
  discontinued: "bg-gray-50 dark:bg-gray-900/30",
};

// Column border accent colors
export const TENDER_STATUS_COLUMN_COLORS: Record<TenderMilestone, string> = {
  prospecting: "border-t-slate-400",
  qualified: "border-t-blue-400",
  proposal_sent: "border-t-violet-400",
  shortlisted: "border-t-amber-400",
  contract_negotiation: "border-t-orange-400",
  closed_won: "border-t-emerald-400",
  contract_signed: "border-t-teal-400",
  operational_handover: "border-t-cyan-400",
  closed_lost: "border-t-red-400",
  discontinued: "border-t-gray-400",
};

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
    prospecting: "Identifying and qualifying opportunity",
    qualified: "Lead qualified — ready for proposal",
    proposal_sent: "Proposal submitted — awaiting response",
    shortlisted: "Shortlisted — in final consideration",
    contract_negotiation: "Contract negotiation in progress",
    closed_won: "Deal closed — contract signed",
    contract_signed: "Contract signed — preparing operational handover",
    operational_handover: "Operational handover to delivery team in progress",
    closed_lost: "Tender not won",
    discontinued: "Opportunity discontinued",
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
  /** Internal tender process stage — stored in tenders.phase */
  status: TenderMilestone;
  /** CRM Pipeline stage — stored in tenders.crm_pipeline_stage */
  crmPipelineStage: TenderMilestone;
  source: TenderSource;
  region: Region;
  /** Tender Execution Scope — operational delivery geography (manual capture from RFQ/SOW) */
  executionRegions: string[];
  targetSites: { name: string; type: string }[];
  executionType: string;
  geographicComplexity: string;
  siteCount: number;
  executionNotes: string;
  createdAt: string;
  updatedAt: string;
  daysInStatus: number;
  notes: string;
  crmSynced?: boolean;
  /** Structured Scope of Work data — persisted in type_details.sow_data */
  sowData?: SowData;
  /** Structured Customer Fit Qualification data — persisted in type_details.customer_fit_data */
  customerFitData?: Record<string, any>;
  /** Structured SOW Qualification data — persisted in type_details.sow_qualification_data */
  sowQualificationData?: Record<string, any>;
  /** Structured Technical Qualification data — persisted in type_details.technical_qualification_data */
  technicalQualificationData?: Record<string, any>;
  /** Structured Risk Snapshot data — persisted in type_details.risk_snapshot_data */
  riskSnapshotData?: Record<string, any>;
  /** Structured Bid / No-Bid data — persisted in type_details.bid_no_bid_data */
  bidNoBidData?: Record<string, any>;
  /** Structured Solution Design data — persisted in type_details.solution_design_data */
  solutionDesignData?: Record<string, any>;
  /** Structured P&L / Pricing data - persisted in type_details.pricing */
  pricingData?: TenderPricingData;
  /** Structured Tender Drafting data — persisted in type_details.tender_drafting */
  tenderDraftingData?: Record<string, any>;
  /** Raw internal_stage value from commercial_tickets — used to open workspace at the correct process stage */
  internalStageRaw?: string;
}
// ─── TENDER DATA — SUPABASE ONLY ───────────────────────────
// No hardcoded tenders. All data comes from the tenders table in Supabase.
// If no data exists, components show "Unknown" / "Not available".

let tenderIdCounter = 10;

export const tenders: Tender[] = [];

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
      fromStatus: "prospecting",
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

  if ((newStatus as string) === "awarded" || newStatus === "closed_won") {
    return {
      type: "advance_to_commercial_approved",
      workspaceId: workspace.id,
      workspaceName: workspace.title,
      message: `Tender awarded. Consider advancing workspace "${workspace.title}" to Commercial Approved.`,
    };
  }
  if ((newStatus as string) === "lost_withdrawn" || newStatus === "closed_lost") {
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
    return { success: false, message: "No transition to undo.", revertedFrom: "prospecting", revertedTo: "prospecting" };
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
  const awarded = src.filter(t => t.status === "closed_won");
  const lost = src.filter(t => t.status === "closed_lost");
  const decided = awarded.length + lost.length;
  const winRate = decided > 0 ? (awarded.length / decided) * 100 : 0;

  const submitted = src.filter(t =>
    ["qualified", "proposal_sent", "shortlisted", "contract_negotiation", "closed_won", "contract_signed", "actual_go_live", "closed_lost", "discontinued"].includes(t.status)
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
