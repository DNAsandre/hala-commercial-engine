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
 *
 * Designed for future rule expansion: add a TransitionRule to the registry
 * and the engine picks it up automatically.
 */

import {
  type WorkspaceStage,
  type Workspace,
  type AuditEntry,
  quotes,
  approvalRecords,
  auditLog,
  workspaces,
} from "./store";

// ─── TYPES ──────────────────────────────────────────────────

export interface TransitionResult {
  success: boolean;
  message: string;
  nextStage: WorkspaceStage | null;
  fromStage: WorkspaceStage;
  validationErrors: string[];
}

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
 * Returns an array of error messages (empty = all passed).
 */
function runValidations(ctx: TransitionContext): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const fromMatch = rule.from === "*" || rule.from === ctx.fromStage;
    const toMatch = rule.to === "*" || rule.to === ctx.toStage;
    if (fromMatch && toMatch) {
      const err = rule.validate(ctx);
      if (err) errors.push(err);
    }
  }
  return errors;
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
): void {
  const entry: AuditEntry = {
    id: `al-st-${Date.now()}`,
    entityType: "workspace",
    entityId: workspace.id,
    action: success ? "stage_advanced" : "stage_advance_blocked",
    userId: "u1", // current user (Amin Al-Rashid — admin)
    userName: "Amin Al-Rashid",
    timestamp: new Date().toISOString(),
    details: success
      ? `Stage advanced from '${getStageDisplayName(fromStage)}' to '${getStageDisplayName(toStage!)}'. ${message}`
      : `Stage advance blocked at '${getStageDisplayName(fromStage)}'. ${message}`,
  };
  auditLog.unshift(entry);
}

/**
 * Primary entry point. Attempts to advance a workspace to the next stage.
 *
 * @param workspaceId - The workspace to advance
 * @returns TransitionResult with success, message, nextStage, and any validation errors
 */
export function advanceStage(workspaceId: string): TransitionResult {
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
  const errors = runValidations(ctx);

  if (errors.length > 0) {
    const msg = errors.join(" ");
    logTransitionAudit(workspace, fromStage, toStage, false, msg);
    return {
      success: false,
      message: errors[0], // primary error for display
      nextStage: toStage,
      fromStage,
      validationErrors: errors,
    };
  }

  // ── Transition succeeds ──
  // Mutate workspace in-place (mock store — no DB)
  workspace.stage = toStage;
  workspace.daysInStage = 0;
  workspace.updatedAt = new Date().toISOString().slice(0, 10);

  const successMsg = `Stage advanced from ${getStageDisplayName(fromStage)} to ${getStageDisplayName(toStage)}.`;
  logTransitionAudit(workspace, fromStage, toStage, true, successMsg);

  return {
    success: true,
    message: successMsg,
    nextStage: toStage,
    fromStage,
    validationErrors: [],
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
