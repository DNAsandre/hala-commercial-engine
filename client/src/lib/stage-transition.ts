import { getCurrentUser } from "./auth-state";
/*
 * Stage Transition Engine
 * Controlled, deterministic workspace stage advancement.
 * No AI. No automation beyond validation. Human judgment remains sovereign.
 *
 * Architecture:
 *   1. STAGE_ORDER — canonical ordered list (source of truth)
 *   2. TransitionRule[] — per-transition validation functions
 *   3. advanceStage() — entry point returning a structured TransitionResult
 *   4. Audit logging on every attempt (success or failure)
 *   5. Soft Governance Mode — warnings allow override with reason + logging
 *   6. strict_mode flag — when true, warnings become hard blocks
 *
 * Designed for future rule expansion: add a TransitionRule to the registry
 * and the engine picks it up automatically.
 */

import {
  type WorkspaceStage,
  type Workspace,
  type AuditEntry,
  quotes,
  proposals,
  approvalRecords,
  auditLog,
  workspaces,
} from "./store";
import { syncWorkspaceStage, syncAuditEntry } from "./supabase-sync";

// ─── GOVERNANCE MODE ───────────────────────────────────────
// When strict_mode = false (default), validation failures are
// treated as warnings that can be overridden with a reason.
// When strict_mode = true, warnings become hard blocks.

export let strict_mode = false;

export function setStrictMode(enabled: boolean): void {
  strict_mode = enabled;
}

export function getStrictMode(): boolean {
  return strict_mode;
}

// ─── TYPES ──────────────────────────────────────────────────

export interface GovernanceOverride {
  overrideReason: string;
  userId: string;
  userName: string;
  timestamp: string;
  overriddenRules: string[];
  fromStage: WorkspaceStage;
  toStage: WorkspaceStage;
  workspaceId: string;
}

export interface TransitionResult {
  success: boolean;
  message: string;
  nextStage: WorkspaceStage | null;
  fromStage: WorkspaceStage;
  validationErrors: string[];
  /** Populated on success — ISO timestamp of the transition */
  transitionTimestamp?: string;
  /** True if the transition succeeded via governance override */
  governanceOverride?: boolean;
  /** The override record, if applicable */
  overrideRecord?: GovernanceOverride;
}

// ─── OVERRIDE LOG ──────────────────────────────────────────
// Immutable log of every governance override applied.

export const governanceOverrides: GovernanceOverride[] = [];

/**
 * Get override records for a specific workspace.
 */
export function getWorkspaceOverrides(workspaceId: string): readonly GovernanceOverride[] {
  return governanceOverrides.filter(o => o.workspaceId === workspaceId);
}

/**
 * Get the most recent override for a workspace (if any).
 */
export function getLatestOverride(workspaceId: string): GovernanceOverride | null {
  const overrides = governanceOverrides.filter(o => o.workspaceId === workspaceId);
  return overrides.length > 0 ? overrides[0] : null;
}

// ─── STAGE HISTORY ──────────────────────────────────────────
// Immutable log of every stage change (advance or revert).
// Separate from the general audit trail for dedicated display.

export interface StageHistoryEntry {
  id: string;
  workspaceId: string;
  fromStage: WorkspaceStage;
  toStage: WorkspaceStage;
  action: "advanced" | "reverted" | "advanced_with_override";
  userId: string;
  userName: string;
  timestamp: string;
  reason: string;
  /** If this was an override, store the override record */
  overrideRecord?: GovernanceOverride;
}

export const stageHistory: StageHistoryEntry[] = [];

// ─── UNDO STATE ─────────────────────────────────────────────
// Tracks the last successful transition per workspace for undo.

export interface UndoRecord {
  workspaceId: string;
  fromStage: WorkspaceStage;
  toStage: WorkspaceStage;
  timestamp: number; // epoch ms
  userId: string;
  userName: string;
}

const undoRecords: Map<string, UndoRecord> = new Map();

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface TransitionContext {
  workspace: Workspace;
  fromStage: WorkspaceStage;
  toStage: WorkspaceStage;
}

export interface TransitionRule {
  /** Which transition this rule applies to (from → to). Use '*' for any stage. */
  from: WorkspaceStage | "*";
  to: WorkspaceStage | "*";
  /** Human-readable name for audit/debug */
  name: string;
  /** Returns null if passed, or an error message string if blocked */
  validate: (ctx: TransitionContext) => string | null;
}

// ─── STAGE ORDER ────────────────────────────────────────────
// Canonical sequence. Only these stages participate in the
// "Advance Stage" flow. Stages beyond contract_ready are
// handled by separate workflows (contract management, handover).

export const STAGE_ORDER: WorkspaceStage[] = [
  "qualified",
  "solution_design",
  "quoting",
  "proposal_active",
  "negotiation",
  "commercial_approved",
  "sla_drafting",
  "contract_ready",
];

export function getStageIndex(stage: WorkspaceStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getNextStage(current: WorkspaceStage): WorkspaceStage | null {
  const idx = getStageIndex(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function getStageDisplayName(stage: WorkspaceStage): string {
  const labels: Partial<Record<WorkspaceStage, string>> = {
    qualified: "Qualified",
    solution_design: "Solution Design",
    quoting: "Quoting",
    proposal_active: "Proposal Active",
    negotiation: "Negotiation",
    commercial_approved: "Commercial Approved",
    sla_drafting: "SLA Drafting",
    contract_ready: "Contract Ready",
  };
  return labels[stage] ?? stage;
}

// ─── VALIDATION RULES ───────────────────────────────────────
// Each rule targets a specific transition (or '*' for all).
// Returns null on pass, or an error message string on failure.

const rules: TransitionRule[] = [
  // ── Quoting → Proposal Active: require at least one quote ──
  {
    from: "quoting",
    to: "proposal_active",
    name: "Quote Existence Check",
    validate: (ctx) => {
      const wsQuotes = quotes.filter(q => q.workspaceId === ctx.workspace.id);
      if (wsQuotes.length === 0) {
        return "At least one Quote must exist before advancing to Proposal Active.";
      }
      return null;
    },
  },

  // ── Quoting → Proposal Active: GP% threshold with approval gate ──
  {
    from: "quoting",
    to: "proposal_active",
    name: "Margin Threshold Gate",
    validate: (ctx) => {
      if (ctx.workspace.gpPercent >= 22) return null; // above threshold — pass

      // GP% < 22% — check if director approval exists
      const directorApproval = approvalRecords.find(
        a =>
          a.workspaceId === ctx.workspace.id &&
          (a.approverRole === "director" || a.approverRole === "ceo_cfo") &&
          a.decision === "approved"
      );

      if (!directorApproval) {
        return `Director approval required due to margin threshold. Current GP% is ${ctx.workspace.gpPercent.toFixed(1)}% (minimum 22% or director override).`;
      }

      return null;
    },
  },

  // ── Negotiation → Commercial Approved: require approved quote ──
  {
    from: "negotiation",
    to: "commercial_approved",
    name: "Approved Quote Required",
    validate: (ctx) => {
      const approvedQuote = quotes.find(
        q => q.workspaceId === ctx.workspace.id && q.state === "approved"
      );
      if (!approvedQuote) {
        return "At least one approved Quote is required before Commercial Approval.";
      }
      return null;
    },
  },

  // ── Solution Design → Quoting: require pallet volume > 0 ──
  {
    from: "solution_design",
    to: "quoting",
    name: "Pallet Volume Check",
    validate: (ctx) => {
      if (ctx.workspace.palletVolume <= 0) {
        return "Pallet volume must be greater than zero before entering Quoting stage.";
      }
      return null;
    },
  },

  // ── Commercial Approved → SLA Drafting: require fully_approved state ──
  {
    from: "commercial_approved",
    to: "sla_drafting",
    name: "Full Approval Check",
    validate: (ctx) => {
      if (ctx.workspace.approvalState !== "fully_approved") {
        return "All required approvals must be completed before advancing to SLA Drafting.";
      }
      return null;
    },
  },

  // ── Universal: block if workspace is at the final controlled stage ──
  {
    from: "contract_ready",
    to: "*",
    name: "Terminal Stage Check",
    validate: () => {
      return "Workspace is at Contract Ready — the final controlled stage. Further transitions are managed by the contract workflow.";
    },
  },
];

// ─── ENGINE ─────────────────────────────────────────────────

/**
 * Run all applicable rules for a given transition.
 * Returns an array of { ruleName, error } pairs (empty = all passed).
 */
export interface ValidationFailure {
  ruleName: string;
  error: string;
}

function runValidationsDetailed(ctx: TransitionContext): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  for (const rule of rules) {
    const fromMatch = rule.from === "*" || rule.from === ctx.fromStage;
    const toMatch = rule.to === "*" || rule.to === ctx.toStage;
    if (fromMatch && toMatch) {
      const err = rule.validate(ctx);
      if (err) failures.push({ ruleName: rule.name, error: err });
    }
  }
  return failures;
}

/**
 * Run all applicable rules for a given transition.
 * Returns an array of error messages (empty = all passed).
 */
function runValidations(ctx: TransitionContext): string[] {
  return runValidationsDetailed(ctx).map(f => f.error);
}

/**
 * Pre-flight check: returns validation failures with rule names
 * so the UI can display them before the user commits.
 */
export function preflightValidation(workspaceId: string): ValidationFailure[] {
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (!workspace) return [];
  const fromStage = workspace.stage;
  const toStage = getNextStage(fromStage);
  if (!toStage) return [];
  return runValidationsDetailed({ workspace, fromStage, toStage });
}

/**
 * Log a stage transition attempt to the audit trail.
 */
function logTransitionAudit(
  workspace: Workspace,
  fromStage: WorkspaceStage,
  toStage: WorkspaceStage | null,
  success: boolean,
  message: string,
  override?: GovernanceOverride,
): void {
  const action = override
    ? "stage_advanced_override"
    : success
      ? "stage_advanced"
      : "stage_advance_blocked";

  const overrideDetails = override
    ? ` [GOVERNANCE OVERRIDE] Reason: "${override.overrideReason}" | Rules overridden: ${override.overriddenRules.join(", ")} | Approver: ${override.userName}`
    : "";

  const entry: AuditEntry = {
    id: `al-st-${crypto.randomUUID()}`,
    entityType: "workspace",
    entityId: workspace.id,
    action,
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: new Date().toISOString(),
    details: success
      ? `Stage advanced from '${getStageDisplayName(fromStage)}' to '${getStageDisplayName(toStage!)}'. ${message}${overrideDetails}`
      : `Stage advance blocked at '${getStageDisplayName(fromStage)}'. ${message}`,
  };
  // Persist audit entry to Supabase (no in-memory push)
  syncAuditEntry(entry);
}

/**
 * Options for advanceStage — supports governance override.
 */
export interface AdvanceStageOptions {
  /** If provided, allows transition despite validation warnings (soft governance mode) */
  overrideReason?: string;
}

/**
 * Primary entry point. Attempts to advance a workspace to the next stage.
 *
 * In soft governance mode (strict_mode = false):
 *   - Validation failures are treated as warnings
 *   - If overrideReason is provided, the transition proceeds with logging
 *   - If overrideReason is NOT provided, the transition is blocked
 *
 * In strict governance mode (strict_mode = true):
 *   - Validation failures are hard blocks regardless of overrideReason
 *
 * @param workspaceId - The workspace to advance
 * @param options - Optional override configuration
 * @returns TransitionResult with success, message, nextStage, and any validation errors
 */
export function advanceStage(workspaceId: string, options?: AdvanceStageOptions): TransitionResult {
  const workspace = workspaces.find(w => w.id === workspaceId);

  if (!workspace) {
    return {
      success: false,
      message: "Workspace not found.",
      nextStage: null,
      fromStage: "qualified",
      validationErrors: ["Workspace ID does not exist."],
    };
  }

  const fromStage = workspace.stage;
  const toStage = getNextStage(fromStage);

  // Stage not in the controlled sequence (e.g. contract_sent, go_live)
  if (getStageIndex(fromStage) === -1) {
    return {
      success: false,
      message: `Stage '${getStageDisplayName(fromStage)}' is outside the controlled transition sequence.`,
      nextStage: null,
      fromStage,
      validationErrors: ["Current stage is not part of the controlled stage order."],
    };
  }

  // Already at terminal stage
  if (!toStage) {
    const msg = "Workspace is at the final controlled stage. No further automatic advancement.";
    logTransitionAudit(workspace, fromStage, null, false, msg);
    return {
      success: false,
      message: msg,
      nextStage: null,
      fromStage,
      validationErrors: [msg],
    };
  }

  // Run validations
  const ctx: TransitionContext = { workspace, fromStage, toStage };
  const failures = runValidationsDetailed(ctx);
  const errors = failures.map(f => f.error);

  if (failures.length > 0) {
    // ── STRICT MODE: hard block regardless of override ──
    if (strict_mode) {
      const msg = errors.join(" ");
      logTransitionAudit(workspace, fromStage, toStage, false, msg);
      return {
        success: false,
        message: errors[0],
        nextStage: toStage,
        fromStage,
        validationErrors: errors,
      };
    }

    // ── SOFT MODE: allow override if reason provided ──
    if (!options?.overrideReason) {
      // No override reason — block (user hasn't provided justification yet)
      const msg = errors.join(" ");
      logTransitionAudit(workspace, fromStage, toStage, false, msg);
      return {
        success: false,
        message: errors[0],
        nextStage: toStage,
        fromStage,
        validationErrors: errors,
      };
    }

    // Override reason provided — proceed with governance override
    const now = new Date();
    const overrideRecord: GovernanceOverride = {
      overrideReason: options.overrideReason,
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
      timestamp: now.toISOString(),
      overriddenRules: failures.map(f => f.ruleName),
      fromStage,
      toStage,
      workspaceId,
    };

    // Store override record
    governanceOverrides.unshift(overrideRecord);

    // Mutate workspace
    workspace.stage = toStage;
    workspace.daysInStage = 0;
    workspace.updatedAt = now.toISOString().slice(0, 10);
    // Persist to Supabase
    syncWorkspaceStage(workspace.id, toStage, 0);

    const successMsg = `Stage advanced from ${getStageDisplayName(fromStage)} to ${getStageDisplayName(toStage)} (governance override).`;
    logTransitionAudit(workspace, fromStage, toStage, true, successMsg, overrideRecord);

    // Record in stage history
    stageHistory.unshift({
      id: `sh-${crypto.randomUUID()}`,
      workspaceId: workspace.id,
      fromStage,
      toStage,
      action: "advanced_with_override",
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
      timestamp: now.toISOString(),
      reason: successMsg,
      overrideRecord,
    });

    // Store undo record
    undoRecords.set(workspace.id, {
      workspaceId: workspace.id,
      fromStage,
      toStage,
      timestamp: now.getTime(),
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
    });

    return {
      success: true,
      message: successMsg,
      nextStage: toStage,
      fromStage,
      validationErrors: errors, // still report the warnings that were overridden
      transitionTimestamp: now.toISOString(),
      governanceOverride: true,
      overrideRecord,
    };
  }

  // ── Transition succeeds (no validation issues) ──
  workspace.stage = toStage;
  workspace.daysInStage = 0;
  workspace.updatedAt = new Date().toISOString().slice(0, 10);
  // Persist to Supabase
  syncWorkspaceStage(workspace.id, toStage, 0);

  const now = new Date();
  const successMsg = `Stage advanced from ${getStageDisplayName(fromStage)} to ${getStageDisplayName(toStage)}.`;
  logTransitionAudit(workspace, fromStage, toStage, true, successMsg);

  // Record in stage history
  stageHistory.unshift({
    id: `sh-${crypto.randomUUID()}`,
    workspaceId: workspace.id,
    fromStage,
    toStage,
    action: "advanced",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    reason: successMsg,
  });

  // Store undo record
  undoRecords.set(workspace.id, {
    workspaceId: workspace.id,
    fromStage,
    toStage,
    timestamp: now.getTime(),
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
  });

  return {
    success: true,
    message: successMsg,
    nextStage: toStage,
    fromStage,
    validationErrors: [],
    transitionTimestamp: now.toISOString(),
    governanceOverride: false,
  };
}

// ─── MULTI-STEP TRANSITION (for Kanban drag-and-drop) ──────

/**
 * Pre-flight validation for a multi-step transition.
 * Checks all intermediate transitions from current stage to target stage.
 * Returns aggregated validation failures across all steps.
 */
export function preflightToStage(
  workspaceId: string,
  targetStage: WorkspaceStage,
): ValidationFailure[] {
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (!workspace) return [];

  const fromIdx = getStageIndex(workspace.stage);
  const toIdx = getStageIndex(targetStage);
  if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return [];

  const allFailures: ValidationFailure[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const from = STAGE_ORDER[i];
    const to = STAGE_ORDER[i + 1];
    const ctx: TransitionContext = { workspace, fromStage: from, toStage: to };
    const failures = runValidationsDetailed(ctx);
    for (const f of failures) {
      // Avoid duplicates
      if (!allFailures.some(af => af.ruleName === f.ruleName && af.error === f.error)) {
        allFailures.push(f);
      }
    }
  }
  return allFailures;
}

/**
 * Advance a workspace to a specific target stage (may skip intermediate stages).
 * Runs validation for each intermediate step. In soft governance mode, all
 * intermediate warnings are collected and can be overridden with a single reason.
 * Uses the same audit logging and governance override system as advanceStage().
 */
export function advanceToStage(
  workspaceId: string,
  targetStage: WorkspaceStage,
  options?: AdvanceStageOptions,
): TransitionResult {
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (!workspace) {
    return {
      success: false,
      message: "Workspace not found.",
      nextStage: null,
      fromStage: "qualified",
      validationErrors: ["Workspace ID does not exist."],
    };
  }

  const originalStage = workspace.stage;
  const fromIdx = getStageIndex(originalStage);
  const toIdx = getStageIndex(targetStage);

  // Backward movement not allowed
  if (toIdx <= fromIdx) {
    return {
      success: false,
      message: "Cannot move backward. Only forward stage transitions are allowed.",
      nextStage: null,
      fromStage: originalStage,
      validationErrors: ["Backward stage movement is not permitted."],
    };
  }

  // Outside controlled sequence
  if (fromIdx === -1 || toIdx === -1) {
    return {
      success: false,
      message: "One or both stages are outside the controlled transition sequence.",
      nextStage: null,
      fromStage: originalStage,
      validationErrors: ["Stage is not part of the controlled stage order."],
    };
  }

  // Collect all validation failures across intermediate steps
  const allFailures = preflightToStage(workspaceId, targetStage);

  if (allFailures.length > 0) {
    const errors = allFailures.map(f => f.error);

    // Strict mode: hard block
    if (strict_mode) {
      const msg = errors.join(" ");
      logTransitionAudit(workspace, originalStage, targetStage, false, msg);
      return {
        success: false,
        message: errors[0],
        nextStage: targetStage,
        fromStage: originalStage,
        validationErrors: errors,
      };
    }

    // Soft mode without override reason: block
    if (!options?.overrideReason) {
      const msg = errors.join(" ");
      logTransitionAudit(workspace, originalStage, targetStage, false, msg);
      return {
        success: false,
        message: errors[0],
        nextStage: targetStage,
        fromStage: originalStage,
        validationErrors: errors,
      };
    }

    // Soft mode with override reason: proceed
    const now = new Date();
    const overrideRecord: GovernanceOverride = {
      overrideReason: options.overrideReason,
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
      timestamp: now.toISOString(),
      overriddenRules: allFailures.map(f => f.ruleName),
      fromStage: originalStage,
      toStage: targetStage,
      workspaceId,
    };

    governanceOverrides.unshift(overrideRecord);

    workspace.stage = targetStage;
    workspace.daysInStage = 0;
    workspace.updatedAt = now.toISOString().slice(0, 10);

    const successMsg = `Stage advanced from ${getStageDisplayName(originalStage)} to ${getStageDisplayName(targetStage)} (governance override).`;
    logTransitionAudit(workspace, originalStage, targetStage, true, successMsg, overrideRecord);

    stageHistory.unshift({
      id: `sh-${crypto.randomUUID()}`,
      workspaceId: workspace.id,
      fromStage: originalStage,
      toStage: targetStage,
      action: "advanced_with_override",
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
      timestamp: now.toISOString(),
      reason: successMsg,
      overrideRecord,
    });

    undoRecords.set(workspace.id, {
      workspaceId: workspace.id,
      fromStage: originalStage,
      toStage: targetStage,
      timestamp: now.getTime(),
      userId: getCurrentUser().id,
      userName: getCurrentUser().name,
    });

    return {
      success: true,
      message: successMsg,
      nextStage: targetStage,
      fromStage: originalStage,
      validationErrors: errors,
      transitionTimestamp: now.toISOString(),
      governanceOverride: true,
      overrideRecord,
    };
  }

  // No validation failures — advance directly
  const now = new Date();
  workspace.stage = targetStage;
  workspace.daysInStage = 0;
  workspace.updatedAt = now.toISOString().slice(0, 10);

  const successMsg = `Stage advanced from ${getStageDisplayName(originalStage)} to ${getStageDisplayName(targetStage)}.`;
  logTransitionAudit(workspace, originalStage, targetStage, true, successMsg);

  stageHistory.unshift({
    id: `sh-${crypto.randomUUID()}`,
    workspaceId: workspace.id,
    fromStage: originalStage,
    toStage: targetStage,
    action: "advanced",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    reason: successMsg,
  });

  undoRecords.set(workspace.id, {
    workspaceId: workspace.id,
    fromStage: originalStage,
    toStage: targetStage,
    timestamp: now.getTime(),
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
  });

  return {
    success: true,
    message: successMsg,
    nextStage: targetStage,
    fromStage: originalStage,
    validationErrors: [],
    transitionTimestamp: now.toISOString(),
    governanceOverride: false,
  };
}

// ─── RULE REGISTRY (for future expansion) ───────────────────

/**
 * Register a new validation rule at runtime.
 * Allows external modules to extend the transition engine
 * without modifying this file.
 */
export function registerTransitionRule(rule: TransitionRule): void {
  rules.push(rule);
}

/**
 * Get all registered rules (read-only, for admin/debug views).
 */
export function getRegisteredRules(): readonly TransitionRule[] {
  return rules;
}

// ─── UNDO / REVERT ──────────────────────────────────────────

export interface UndoEligibility {
  eligible: boolean;
  reasons: string[];
  remainingMs: number;
}

/**
 * Check whether an undo is eligible for a workspace.
 * Undo is blocked if:
 *   - No undo record exists
 *   - More than 5 minutes have elapsed
 *   - New approvals have been started since the transition
 *   - New dependent documents (quotes/proposals) were created since the transition
 */
export function checkUndoEligibility(workspaceId: string): UndoEligibility {
  const record = undoRecords.get(workspaceId);
  if (!record) {
    return { eligible: false, reasons: ["No recent transition to undo."], remainingMs: 0 };
  }

  const elapsed = Date.now() - record.timestamp;
  const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);
  const reasons: string[] = [];

  // Time window check
  if (elapsed > UNDO_WINDOW_MS) {
    reasons.push("Undo window expired (5 minutes).");
  }

  // Approvals started since transition
  const newApprovals = approvalRecords.filter(
    a => a.workspaceId === workspaceId && new Date(a.timestamp).getTime() > record.timestamp
  );
  if (newApprovals.length > 0) {
    reasons.push(`${newApprovals.length} approval(s) started since transition.`);
  }

  // Dependent documents created since transition
  const newQuotes = quotes.filter(
    q => q.workspaceId === workspaceId && new Date(q.createdAt).getTime() > record.timestamp
  );
  const newProposals = proposals.filter(
    p => p.workspaceId === workspaceId && new Date(p.createdAt).getTime() > record.timestamp
  );
  if (newQuotes.length + newProposals.length > 0) {
    reasons.push(`${newQuotes.length + newProposals.length} document(s) created since transition.`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    remainingMs: remaining,
  };
}

export interface RevertResult {
  success: boolean;
  message: string;
  revertedFrom: WorkspaceStage;
  revertedTo: WorkspaceStage;
}

/**
 * Revert the last stage transition for a workspace.
 * Does NOT re-run validation rules — this is a governance undo, not a new transition.
 */
export function revertStage(workspaceId: string): RevertResult {
  const eligibility = checkUndoEligibility(workspaceId);
  if (!eligibility.eligible) {
    const record = undoRecords.get(workspaceId);
    return {
      success: false,
      message: eligibility.reasons.join(" "),
      revertedFrom: record?.toStage ?? "qualified",
      revertedTo: record?.fromStage ?? "qualified",
    };
  }

  const record = undoRecords.get(workspaceId)!;
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (!workspace) {
    return { success: false, message: "Workspace not found.", revertedFrom: record.toStage, revertedTo: record.fromStage };
  }

  // Revert the stage
  const revertedFrom = workspace.stage;
  workspace.stage = record.fromStage;
  workspace.daysInStage = 0;
  workspace.updatedAt = new Date().toISOString().slice(0, 10);
  // Persist to Supabase
  syncWorkspaceStage(workspace.id, record.fromStage, 0);

  const now = new Date();
  const msg = `Stage reverted from '${getStageDisplayName(revertedFrom)}' to '${getStageDisplayName(record.fromStage)}' (undo).`;

  // Audit log
  const entry: AuditEntry = {
    id: `al-rv-${crypto.randomUUID()}`,
    entityType: "workspace",
    entityId: workspaceId,
    action: "stage_reverted",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    details: msg,
  };
  // Persist audit entry to Supabase (no in-memory push)
  syncAuditEntry(entry);

  // Stage history
  stageHistory.unshift({
    id: `sh-rv-${crypto.randomUUID()}`,
    workspaceId,
    fromStage: revertedFrom,
    toStage: record.fromStage,
    action: "reverted",
    userId: getCurrentUser().id,
    userName: getCurrentUser().name,
    timestamp: now.toISOString(),
    reason: msg,
  });

  // Clear the undo record (one undo per transition)
  undoRecords.delete(workspaceId);

  return {
    success: true,
    message: msg,
    revertedFrom,
    revertedTo: record.fromStage,
  };
}

/**
 * Get stage history entries for a specific workspace.
 */
export function getStageHistory(workspaceId: string): readonly StageHistoryEntry[] {
  return stageHistory.filter(h => h.workspaceId === workspaceId);
}

/**
 * Check if an undo record exists for a workspace.
 */
export function hasUndoRecord(workspaceId: string): boolean {
  return undoRecords.has(workspaceId);
}
