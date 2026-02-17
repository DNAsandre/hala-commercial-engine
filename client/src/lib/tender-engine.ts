/*
 * Tender Engine — Governed Tender Module
 * Mirrors the architecture of stage-transition.ts for Workspaces.
 *
 * Architecture:
 *   1. TENDER_STATUS_ORDER — canonical ordered list (source of truth)
 *   2. TenderTransitionRule[] — per-transition validation functions
 *   3. advanceTenderStatus() — centralized transition handler
 *   4. Audit logging on every attempt (success or failure)
 *   5. Soft Governance Mode — reuses strict_mode from stage-transition.ts
 *   6. Workspace linkage suggestions (Won → Commercial Approved, Lost → Closed)
 *   7. Undo within 5 minutes, after that requires reason entry
 *   8. Permission checks: only Owner or Admin can move to Won/Lost
 *
 * No duplicate logic paths. Reuses governance framework concepts.
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
import { getStrictMode } from "./stage-transition";

// ─── TENDER STATUS ─────────────────────────────────────────

export type TenderStatus =
  | "draft"
  | "in_preparation"
  | "submitted"
  | "under_evaluation"
  | "won"
  | "lost"
  | "withdrawn";

export const TENDER_STATUS_ORDER: TenderStatus[] = [
  "draft",
  "in_preparation",
  "submitted",
  "under_evaluation",
  "won",
  "lost",
];

// Kanban columns (excludes withdrawn — that's a side action)
export const TENDER_KANBAN_COLUMNS: TenderStatus[] = [
  "draft",
  "in_preparation",
  "submitted",
  "under_evaluation",
  "won",
  "lost",
];

export function getTenderStatusIndex(status: TenderStatus): number {
  return TENDER_STATUS_ORDER.indexOf(status);
}

export function getNextTenderStatus(current: TenderStatus): TenderStatus | null {
  const idx = getTenderStatusIndex(current);
  if (idx === -1 || idx >= TENDER_STATUS_ORDER.length - 1) return null;
  // Won and Lost are terminal — no next
  if (current === "won" || current === "lost") return null;
  return TENDER_STATUS_ORDER[idx + 1];
}

export function getTenderStatusDisplayName(status: TenderStatus): string {
  const labels: Record<TenderStatus, string> = {
    draft: "Draft",
    in_preparation: "In Preparation",
    submitted: "Submitted",
    under_evaluation: "Under Evaluation",
    won: "Won",
    lost: "Lost",
    withdrawn: "Withdrawn",
  };
  return labels[status] ?? status;
}

export function getTenderStatusColor(status: TenderStatus): string {
  const colors: Record<TenderStatus, string> = {
    draft: "bg-slate-100 text-slate-700",
    in_preparation: "bg-blue-100 text-blue-700",
    submitted: "bg-violet-100 text-violet-700",
    under_evaluation: "bg-amber-100 text-amber-700",
    won: "bg-emerald-100 text-emerald-700",
    lost: "bg-red-100 text-red-700",
    withdrawn: "bg-gray-100 text-gray-500",
  };
  return colors[status] ?? "";
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
  status: TenderStatus;
  source: TenderSource;
  region: Region;
  createdAt: string;
  updatedAt: string;
  daysInStatus: number;
  notes: string;
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
    submissionDeadline: "2026-03-20",
    estimatedValue: 3400000,
    targetGpPercent: 22,
    probabilityPercent: 60,
    assignedOwner: "Ra'ed",
    assignedTeamMembers: ["Ra'ed", "Yazan", "Finance"],
    status: "in_preparation",
    source: "CRM",
    region: "East",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-14",
    daysInStatus: 8,
    notes: "Linked to workspace w1. Technical draft in progress.",
  },
  {
    id: "tn-002",
    linkedWorkspaceId: null,
    customerId: "c1",
    customerName: "SABIC",
    title: "SABIC National Warehousing Services Tender",
    submissionDeadline: "2026-04-01",
    estimatedValue: 15000000,
    targetGpPercent: 25,
    probabilityPercent: 45,
    assignedOwner: "Ra'ed",
    assignedTeamMembers: ["Ra'ed", "Albert", "Yazan", "Finance", "Legal"],
    status: "draft",
    source: "Direct",
    region: "East",
    createdAt: "2026-02-01",
    updatedAt: "2026-02-15",
    daysInStatus: 14,
    notes: "Large strategic tender. Committee formation pending.",
  },
  {
    id: "tn-003",
    linkedWorkspaceId: "w6",
    customerId: "c1",
    customerName: "Aramco Services",
    title: "Aramco Dhahran VAS Expansion Tender",
    submissionDeadline: "2026-03-10",
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
    status: "in_preparation",
    source: "CRM",
    region: "Central",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-16",
    daysInStatus: 5,
    notes: "High-value strategic account. Technical analysis complete.",
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
    status: "under_evaluation",
    source: "Referral",
    region: "West",
    createdAt: "2025-11-15",
    updatedAt: "2026-02-12",
    daysInStatus: 12,
    notes: "Evaluation ongoing. Shortlisted with 2 competitors.",
  },
  {
    id: "tn-006",
    linkedWorkspaceId: "w2",
    customerId: "c4",
    customerName: "Sadara Chemical",
    title: "Sadara Contract Renewal Tender 2025",
    submissionDeadline: "2026-02-28",
    estimatedValue: 2800000,
    targetGpPercent: 24,
    probabilityPercent: 85,
    assignedOwner: "Albert",
    assignedTeamMembers: ["Albert", "Ra'ed"],
    status: "under_evaluation",
    source: "CRM",
    region: "East",
    createdAt: "2025-10-15",
    updatedAt: "2026-02-14",
    daysInStatus: 3,
    notes: "Renewal tender. Strong relationship. High probability.",
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
    status: "won",
    source: "Direct",
    region: "East",
    createdAt: "2025-08-01",
    updatedAt: "2025-12-20",
    daysInStatus: 58,
    notes: "Won. Contract signed. Handover initiated.",
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
  },
];

// ─── TENDER TRANSITION TYPES ───────────────────────────────

export interface TenderTransitionContext {
  tender: Tender;
  fromStatus: TenderStatus;
  toStatus: TenderStatus;
}

export interface TenderTransitionRule {
  from: TenderStatus | "*";
  to: TenderStatus | "*";
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
  fromStatus: TenderStatus;
  toStatus: TenderStatus;
  tenderId: string;
}

export interface TenderTransitionResult {
  success: boolean;
  message: string;
  nextStatus: TenderStatus | null;
  fromStatus: TenderStatus;
  validationErrors: string[];
  transitionTimestamp?: string;
  governanceOverride?: boolean;
  overrideRecord?: TenderGovernanceOverride;
  /** If tender moved to Won/Lost, a workspace suggestion may be included */
  workspaceSuggestion?: WorkspaceSuggestion | null;
}

export interface WorkspaceSuggestion {
  type: "advance_to_commercial_approved" | "mark_closed_lost";
  workspaceId: string;
  workspaceName: string;
  message: string;
}

// ─── GOVERNANCE OVERRIDE LOG ───────────────────────────────

export const tenderGovernanceOverrides: TenderGovernanceOverride[] = [];

// ─── TENDER STAGE HISTORY ──────────────────────────────────

export interface TenderStageHistoryEntry {
  id: string;
  tenderId: string;
  fromStatus: TenderStatus;
  toStatus: TenderStatus;
  action: "advanced" | "reverted" | "advanced_with_override";
  userId: string;
  userName: string;
  timestamp: string;
  reason: string;
  overrideRecord?: TenderGovernanceOverride;
}

export const tenderStageHistory: TenderStageHistoryEntry[] = [];

// ─── UNDO STATE ────────────────────────────────────────────

export interface TenderUndoRecord {
  tenderId: string;
  fromStatus: TenderStatus;
  toStatus: TenderStatus;
  timestamp: number;
  userId: string;
  userName: string;
}

const tenderUndoRecords: Map<string, TenderUndoRecord> = new Map();
const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─── VALIDATION RULES ──────────────────────────────────────

const tenderRules: TenderTransitionRule[] = [
  // Draft → In Preparation: must have assigned team members
  {
    from: "draft",
    to: "in_preparation",
    name: "Team Assignment Check",
    validate: (ctx) => {
      if (ctx.tender.assignedTeamMembers.length === 0) {
        return "At least one team member must be assigned before moving to In Preparation.";
      }
      return null;
    },
  },

  // In Preparation → Submitted: must have submission deadline in the future
  {
    from: "in_preparation",
    to: "submitted",
    name: "Deadline Validity Check",
    validate: (ctx) => {
      const deadline = new Date(ctx.tender.submissionDeadline);
      const now = new Date();
      if (deadline < now) {
        return `Submission deadline (${ctx.tender.submissionDeadline}) has passed. Update the deadline before submitting.`;
      }
      return null;
    },
  },

  // In Preparation → Submitted: must have estimated value > 0
  {
    from: "in_preparation",
    to: "submitted",
    name: "Value Estimation Check",
    validate: (ctx) => {
      if (ctx.tender.estimatedValue <= 0) {
        return "Estimated value must be greater than zero before submission.";
      }
      return null;
    },
  },

  // * → Won: permission check — only Owner or Admin
  {
    from: "*",
    to: "won",
    name: "Won Permission Check",
    validate: (ctx) => {
      // Current user is Amin Al-Rashid (Admin) — always passes
      // In production, check actual user role
      const currentUserRole = "admin";
      const currentUserName = "Amin Al-Rashid";
      const isOwner = ctx.tender.assignedOwner === currentUserName;
      const isAdmin = currentUserRole === "admin";
      if (!isOwner && !isAdmin) {
        return "Only the assigned Owner or an Admin can move a tender to Won.";
      }
      return null;
    },
  },

  // * → Lost: permission check — only Owner or Admin
  {
    from: "*",
    to: "lost",
    name: "Lost Permission Check",
    validate: (ctx) => {
      const currentUserRole = "admin";
      const currentUserName = "Amin Al-Rashid";
      const isOwner = ctx.tender.assignedOwner === currentUserName;
      const isAdmin = currentUserRole === "admin";
      if (!isOwner && !isAdmin) {
        return "Only the assigned Owner or an Admin can move a tender to Lost.";
      }
      return null;
    },
  },

  // Won/Lost are terminal — cannot move further
  {
    from: "won",
    to: "*",
    name: "Won Terminal Check",
    validate: () => "Tender is Won — this is a terminal status. No further transitions allowed.",
  },
  {
    from: "lost",
    to: "*",
    name: "Lost Terminal Check",
    validate: () => "Tender is Lost — this is a terminal status. No further transitions allowed.",
  },

  // Withdrawn is terminal
  {
    from: "withdrawn",
    to: "*",
    name: "Withdrawn Terminal Check",
    validate: () => "Tender is Withdrawn — this is a terminal status. No further transitions allowed.",
  },

  // Cannot skip from Draft directly to Submitted
  {
    from: "draft",
    to: "submitted",
    name: "Preparation Required",
    validate: () => "Tender must go through In Preparation before being Submitted.",
  },

  // Cannot skip from Draft directly to Under Evaluation
  {
    from: "draft",
    to: "under_evaluation",
    name: "Submission Required",
    validate: () => "Tender must be Submitted before entering Under Evaluation.",
  },

  // GP% threshold check for submission
  {
    from: "in_preparation",
    to: "submitted",
    name: "GP% Threshold Check",
    validate: (ctx) => {
      if (ctx.tender.targetGpPercent < 22) {
        return `Target GP% is ${ctx.tender.targetGpPercent.toFixed(1)}% — below the 22% threshold. Director approval may be required.`;
      }
      return null;
    },
  },
];

// ─── ENGINE ────────────────────────────────────────────────

function runTenderValidationsDetailed(ctx: TenderTransitionContext): TenderValidationFailure[] {
  const failures: TenderValidationFailure[] = [];
  for (const rule of tenderRules) {
    const fromMatch = rule.from === "*" || rule.from === ctx.fromStatus;
    const toMatch = rule.to === "*" || rule.to === ctx.toStatus;
    if (fromMatch && toMatch) {
      const err = rule.validate(ctx);
      if (err) failures.push({ ruleName: rule.name, error: err });
    }
  }
  return failures;
}

/**
 * Pre-flight validation for a tender transition.
 */
export function preflightTenderValidation(
  tenderId: string,
  targetStatus: TenderStatus,
): TenderValidationFailure[] {
  const tender = tenders.find(t => t.id === tenderId);
  if (!tender) return [];
  return runTenderValidationsDetailed({
    tender,
    fromStatus: tender.status,
    toStatus: targetStatus,
  });
}

/**
 * Log a tender transition attempt to the audit trail.
 */
function logTenderTransitionAudit(
  tender: Tender,
  fromStatus: TenderStatus,
  toStatus: TenderStatus | null,
  success: boolean,
  message: string,
  override?: TenderGovernanceOverride,
): void {
  const action = override
    ? "tender_status_advanced_override"
    : success
      ? "tender_status_advanced"
      : "tender_status_advance_blocked";

  const overrideDetails = override
    ? ` [GOVERNANCE OVERRIDE] Reason: "${override.overrideReason}" | Rules overridden: ${override.overriddenRules.join(", ")} | Approver: ${override.userName}`
    : "";

  const entry: AuditEntry = {
    id: `al-tn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entityType: "tender",
    entityId: tender.id,
    action,
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: new Date().toISOString(),
    details: success
      ? `Tender status advanced from '${getTenderStatusDisplayName(fromStatus)}' to '${getTenderStatusDisplayName(toStatus!)}'. ${message}${overrideDetails}`
      : `Tender status advance blocked at '${getTenderStatusDisplayName(fromStatus)}'. ${message}`,
  };
  auditLog.unshift(entry);
}

/**
 * Generate workspace suggestion when tender moves to Won or Lost.
 */
function generateWorkspaceSuggestion(
  tender: Tender,
  newStatus: TenderStatus,
): WorkspaceSuggestion | null {
  if (!tender.linkedWorkspaceId) return null;

  const workspace = workspaces.find(w => w.id === tender.linkedWorkspaceId);
  if (!workspace) return null;

  if (newStatus === "won") {
    return {
      type: "advance_to_commercial_approved",
      workspaceId: workspace.id,
      workspaceName: workspace.title,
      message: `Tender won. Consider advancing workspace "${workspace.title}" to Commercial Approved.`,
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

export interface AdvanceTenderOptions {
  overrideReason?: string;
}

/**
 * Centralized transition handler for tenders.
 * Same architecture as advanceStage() for workspaces.
 */
export function advanceTenderStatus(
  tenderId: string,
  targetStatus: TenderStatus,
  options?: AdvanceTenderOptions,
): TenderTransitionResult {
  const tender = tenders.find(t => t.id === tenderId);
  if (!tender) {
    return {
      success: false,
      message: "Tender not found.",
      nextStatus: null,
      fromStatus: "draft",
      validationErrors: ["Tender ID does not exist."],
    };
  }

  const fromStatus = tender.status;

  // Same status — no-op
  if (fromStatus === targetStatus) {
    return {
      success: false,
      message: "Tender is already in this status.",
      nextStatus: null,
      fromStatus,
      validationErrors: [],
    };
  }

  // Run validations
  const failures = runTenderValidationsDetailed({
    tender,
    fromStatus,
    toStatus: targetStatus,
  });
  const errors = failures.map(f => f.error);

  if (failures.length > 0) {
    const strict = getStrictMode();

    // Strict mode: hard block
    if (strict) {
      const msg = errors.join(" ");
      logTenderTransitionAudit(tender, fromStatus, targetStatus, false, msg);
      return {
        success: false,
        message: errors[0],
        nextStatus: targetStatus,
        fromStatus,
        validationErrors: errors,
      };
    }

    // Soft mode without override reason: block
    if (!options?.overrideReason) {
      const msg = errors.join(" ");
      logTenderTransitionAudit(tender, fromStatus, targetStatus, false, msg);
      return {
        success: false,
        message: errors[0],
        nextStatus: targetStatus,
        fromStatus,
        validationErrors: errors,
      };
    }

    // Soft mode with override reason: proceed
    const now = new Date();
    const overrideRecord: TenderGovernanceOverride = {
      overrideReason: options.overrideReason,
      userId: "u1",
      userName: "Amin Al-Rashid",
      timestamp: now.toISOString(),
      overriddenRules: failures.map(f => f.ruleName),
      fromStatus,
      toStatus: targetStatus,
      tenderId,
    };

    tenderGovernanceOverrides.unshift(overrideRecord);

    tender.status = targetStatus;
    tender.daysInStatus = 0;
    tender.updatedAt = now.toISOString().slice(0, 10);

    const successMsg = `Tender status advanced from ${getTenderStatusDisplayName(fromStatus)} to ${getTenderStatusDisplayName(targetStatus)} (governance override).`;
    logTenderTransitionAudit(tender, fromStatus, targetStatus, true, successMsg, overrideRecord);

    tenderStageHistory.unshift({
      id: `tsh-${Date.now()}`,
      tenderId,
      fromStatus,
      toStatus: targetStatus,
      action: "advanced_with_override",
      userId: "u1",
      userName: "Amin Al-Rashid",
      timestamp: now.toISOString(),
      reason: successMsg,
      overrideRecord,
    });

    tenderUndoRecords.set(tenderId, {
      tenderId,
      fromStatus,
      toStatus: targetStatus,
      timestamp: now.getTime(),
      userId: "u1",
      userName: "Amin Al-Rashid",
    });

    const suggestion = generateWorkspaceSuggestion(tender, targetStatus);

    return {
      success: true,
      message: successMsg,
      nextStatus: targetStatus,
      fromStatus,
      validationErrors: errors,
      transitionTimestamp: now.toISOString(),
      governanceOverride: true,
      overrideRecord,
      workspaceSuggestion: suggestion,
    };
  }

  // No validation failures — advance directly
  const now = new Date();
  tender.status = targetStatus;
  tender.daysInStatus = 0;
  tender.updatedAt = now.toISOString().slice(0, 10);

  const successMsg = `Tender status advanced from ${getTenderStatusDisplayName(fromStatus)} to ${getTenderStatusDisplayName(targetStatus)}.`;
  logTenderTransitionAudit(tender, fromStatus, targetStatus, true, successMsg);

  tenderStageHistory.unshift({
    id: `tsh-${Date.now()}`,
    tenderId,
    fromStatus,
    toStatus: targetStatus,
    action: "advanced",
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: now.toISOString(),
    reason: successMsg,
  });

  tenderUndoRecords.set(tenderId, {
    tenderId,
    fromStatus,
    toStatus: targetStatus,
    timestamp: now.getTime(),
    userId: "u1",
    userName: "Amin Al-Rashid",
  });

  const suggestion = generateWorkspaceSuggestion(tender, targetStatus);

  return {
    success: true,
    message: successMsg,
    nextStatus: targetStatus,
    fromStatus,
    validationErrors: [],
    transitionTimestamp: now.toISOString(),
    governanceOverride: false,
    workspaceSuggestion: suggestion,
  };
}

// ─── UNDO / REVERT ─────────────────────────────────────────

export interface TenderUndoEligibility {
  eligible: boolean;
  reasons: string[];
  remainingMs: number;
  /** If outside 5-min window, reversal still allowed with reason */
  requiresReason: boolean;
}

export function checkTenderUndoEligibility(tenderId: string): TenderUndoEligibility {
  const record = tenderUndoRecords.get(tenderId);
  if (!record) {
    return { eligible: false, reasons: ["No recent transition to undo."], remainingMs: 0, requiresReason: false };
  }

  const elapsed = Date.now() - record.timestamp;
  const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);

  // Within 5 minutes — free undo
  if (elapsed <= UNDO_WINDOW_MS) {
    return { eligible: true, reasons: [], remainingMs: remaining, requiresReason: false };
  }

  // After 5 minutes — still allowed but requires reason entry
  return { eligible: true, reasons: ["Undo window expired. Reason required for reversal."], remainingMs: 0, requiresReason: true };
}

export interface TenderRevertResult {
  success: boolean;
  message: string;
  revertedFrom: TenderStatus;
  revertedTo: TenderStatus;
}

export function revertTenderStatus(tenderId: string, reason?: string): TenderRevertResult {
  const eligibility = checkTenderUndoEligibility(tenderId);
  if (!eligibility.eligible) {
    const record = tenderUndoRecords.get(tenderId);
    return {
      success: false,
      message: eligibility.reasons.join(" "),
      revertedFrom: record?.toStatus ?? "draft",
      revertedTo: record?.fromStatus ?? "draft",
    };
  }

  // If reason is required (past 5 min) but not provided, block
  if (eligibility.requiresReason && !reason) {
    return {
      success: false,
      message: "Undo window has expired. A reason is required for reversal.",
      revertedFrom: "draft",
      revertedTo: "draft",
    };
  }

  const record = tenderUndoRecords.get(tenderId)!;
  const tender = tenders.find(t => t.id === tenderId);
  if (!tender) {
    return { success: false, message: "Tender not found.", revertedFrom: record.toStatus, revertedTo: record.fromStatus };
  }

  const revertedFrom = tender.status;
  tender.status = record.fromStatus;
  tender.daysInStatus = 0;
  tender.updatedAt = new Date().toISOString().slice(0, 10);

  const now = new Date();
  const reasonText = reason ? ` Reason: "${reason}"` : "";
  const msg = `Tender status reverted from '${getTenderStatusDisplayName(revertedFrom)}' to '${getTenderStatusDisplayName(record.fromStatus)}' (undo).${reasonText}`;

  const entry: AuditEntry = {
    id: `al-tn-rv-${Date.now()}`,
    entityType: "tender",
    entityId: tenderId,
    action: "tender_status_reverted",
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: now.toISOString(),
    details: msg,
  };
  auditLog.unshift(entry);

  tenderStageHistory.unshift({
    id: `tsh-rv-${Date.now()}`,
    tenderId,
    fromStatus: revertedFrom,
    toStatus: record.fromStatus,
    action: "reverted",
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: now.toISOString(),
    reason: msg,
  });

  tenderUndoRecords.delete(tenderId);

  return {
    success: true,
    message: msg,
    revertedFrom,
    revertedTo: record.fromStatus,
  };
}

export function hasTenderUndoRecord(tenderId: string): boolean {
  return tenderUndoRecords.has(tenderId);
}

export function getTenderStageHistory(tenderId: string): readonly TenderStageHistoryEntry[] {
  return tenderStageHistory.filter(h => h.tenderId === tenderId);
}

// ─── RULE REGISTRY ─────────────────────────────────────────

export function registerTenderRule(rule: TenderTransitionRule): void {
  tenderRules.push(rule);
}

export function getRegisteredTenderRules(): readonly TenderTransitionRule[] {
  return tenderRules;
}

// ─── METRICS HELPERS ───────────────────────────────────────

export function getTenderMetrics() {
  const open = tenders.filter(t => !["won", "lost", "withdrawn"].includes(t.status));
  const won = tenders.filter(t => t.status === "won");
  const lost = tenders.filter(t => t.status === "lost");
  const decided = won.length + lost.length;
  const winRate = decided > 0 ? (won.length / decided) * 100 : 0;

  // Average submission cycle: days from createdAt to when status became "submitted"
  // For mock, use daysInStatus as approximation
  const submitted = tenders.filter(t =>
    ["submitted", "under_evaluation", "won", "lost"].includes(t.status)
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

  return {
    totalOpen: open.length,
    totalWon: won.length,
    totalLost: lost.length,
    winRate,
    avgSubmissionCycleDays: Math.round(avgCycleDays),
    activePipelineValue,
    weightedPipeline,
    byStatus: TENDER_KANBAN_COLUMNS.map(s => ({
      status: s,
      count: tenders.filter(t => t.status === s).length,
      value: tenders.filter(t => t.status === s).reduce((sum, t) => sum + t.estimatedValue, 0),
    })),
  };
}

// ─── CRUD HELPERS ──────────────────────────────────────────

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

  // Audit log
  const entry: AuditEntry = {
    id: `al-tn-cr-${Date.now()}`,
    entityType: "tender",
    entityId: tender.id,
    action: "tender_created",
    userId: "u1",
    userName: "Amin Al-Rashid",
    timestamp: new Date().toISOString(),
    details: `Tender "${tender.title}" created for ${tender.customerName}. Estimated value: ${formatSAR(tender.estimatedValue)}.`,
  };
  auditLog.unshift(entry);

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
