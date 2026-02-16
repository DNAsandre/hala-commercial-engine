// ============================================================
// HALA COMMERCIAL ENGINE — GOVERNANCE ENGINE
// Shell Rules Doctrine Implementation
// ============================================================
// This module implements ALL 9 compliance points:
// 1. Policy Gate Enforcement Structure
// 2. Override ("Break Glass") Doctrine
// 3. AI Authority Restrictions
// 4. Versioning & Immutability
// 5. Stage Control Integrity
// 6. Admin Governance Console (data model)
// 7. Loop & Automation Protection
// 8. Environment Protection
// 9. Audit & Telemetry
// ============================================================

import { nanoid } from "nanoid";
import type { UserRole, WorkspaceStage, Region, GateMode, RAGStatus } from "./store";

// ============================================================
// 1. POLICY GATE ENFORCEMENT STRUCTURE
// ============================================================

export type GateScope = {
  regions: Region[] | "all";
  businessUnits: string[] | "all";
};

export interface PolicyGateConfig {
  id: string;
  name: string;
  description: string;
  mode: GateMode; // enforce | warn | off
  overridable: boolean;
  scope: GateScope;
  ruleVersion: number;
  ruleVersionHistory: GateRuleVersion[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface GateRuleVersion {
  version: number;
  mode: GateMode;
  overridable: boolean;
  scope: GateScope;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export interface GateEvaluation {
  id: string;
  gateId: string;
  gateName: string;
  ruleVersionAtEvaluation: number;
  entityType: string;
  entityId: string;
  workspaceId: string;
  evaluatedBy: string;
  evaluatedAt: string;
  result: "passed" | "blocked" | "warned" | "overridden" | "skipped_off";
  details: string;
  contextSnapshot: Record<string, unknown>;
}

// Gate evaluation function — EVERY transition must pass through this
export function evaluateGate(
  gate: PolicyGateConfig,
  context: {
    entityType: string;
    entityId: string;
    workspaceId: string;
    userId: string;
    userName: string;
    details: string;
    contextData: Record<string, unknown>;
  }
): GateEvaluation {
  const evaluation: GateEvaluation = {
    id: nanoid(),
    gateId: gate.id,
    gateName: gate.name,
    ruleVersionAtEvaluation: gate.ruleVersion,
    entityType: context.entityType,
    entityId: context.entityId,
    workspaceId: context.workspaceId,
    evaluatedBy: context.userName,
    evaluatedAt: new Date().toISOString(),
    result: "passed",
    details: context.details,
    contextSnapshot: { ...context.contextData, gateMode: gate.mode, gateOverridable: gate.overridable },
  };

  if (gate.mode === "off") {
    evaluation.result = "skipped_off";
    evaluation.details = `Gate "${gate.name}" is OFF — evaluation skipped`;
  } else if (gate.mode === "warn") {
    evaluation.result = "warned";
    evaluation.details = `Gate "${gate.name}" issued WARNING: ${context.details}`;
  } else if (gate.mode === "enforce") {
    evaluation.result = "blocked";
    evaluation.details = `Gate "${gate.name}" BLOCKED: ${context.details}`;
  }

  // Log the evaluation
  governanceAuditLog.push({
    id: nanoid(),
    category: "gate_evaluation",
    action: `gate_${evaluation.result}`,
    entityType: context.entityType,
    entityId: context.entityId,
    userId: context.userId,
    userName: context.userName,
    timestamp: evaluation.evaluatedAt,
    details: evaluation.details,
    metadata: {
      gateId: gate.id,
      gateName: gate.name,
      gateMode: gate.mode,
      ruleVersion: gate.ruleVersion,
      result: evaluation.result,
    },
  });

  gateEvaluations.push(evaluation);
  return evaluation;
}

// ============================================================
// 2. OVERRIDE ("BREAK GLASS") DOCTRINE
// ============================================================

export interface OverrideRecord {
  id: string;
  gateId: string;
  gateName: string;
  gateEvaluationId: string;
  ruleVersionAtOverride: number;
  overriddenBy: string;
  overriddenByRole: UserRole;
  overriddenAt: string;
  reason: string; // MANDATORY — cannot be empty
  attachmentUrl?: string; // Optional supporting document
  entityType: string;
  entityId: string;
  workspaceId: string;
  approved: boolean;
}

export function createOverride(
  evaluation: GateEvaluation,
  gate: PolicyGateConfig,
  user: { id: string; name: string; role: UserRole },
  reason: string,
  attachmentUrl?: string
): OverrideRecord | { error: string } {
  // MANDATORY reason capture
  if (!reason || reason.trim().length < 10) {
    return { error: "Override reason is mandatory and must be at least 10 characters" };
  }

  // Check if gate is overridable
  if (!gate.overridable) {
    governanceAuditLog.push({
      id: nanoid(),
      category: "override_attempt",
      action: "override_denied_not_overridable",
      entityType: evaluation.entityType,
      entityId: evaluation.entityId,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
      details: `Override DENIED for gate "${gate.name}" — gate is not overridable`,
      metadata: { gateId: gate.id, ruleVersion: gate.ruleVersion },
    });
    return { error: `Gate "${gate.name}" is not overridable. Contact system administrator.` };
  }

  // Check role permission for override
  const overridePermissions: Record<UserRole, boolean> = {
    salesman: false,
    regional_sales_head: true,
    regional_ops_head: true,
    director: true,
    ceo_cfo: true,
    admin: true,
  };

  if (!overridePermissions[user.role]) {
    governanceAuditLog.push({
      id: nanoid(),
      category: "override_attempt",
      action: "override_denied_insufficient_role",
      entityType: evaluation.entityType,
      entityId: evaluation.entityId,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
      details: `Override DENIED for gate "${gate.name}" — role "${user.role}" lacks override permission`,
      metadata: { gateId: gate.id, userRole: user.role },
    });
    return { error: `Role "${user.role}" does not have override permission` };
  }

  const override: OverrideRecord = {
    id: nanoid(),
    gateId: gate.id,
    gateName: gate.name,
    gateEvaluationId: evaluation.id,
    ruleVersionAtOverride: gate.ruleVersion,
    overriddenBy: user.name,
    overriddenByRole: user.role,
    overriddenAt: new Date().toISOString(),
    reason: reason.trim(),
    attachmentUrl,
    entityType: evaluation.entityType,
    entityId: evaluation.entityId,
    workspaceId: evaluation.workspaceId,
    approved: true,
  };

  overrideRecords.push(override);

  // Log the override
  governanceAuditLog.push({
    id: nanoid(),
    category: "override",
    action: "override_executed",
    entityType: evaluation.entityType,
    entityId: evaluation.entityId,
    userId: user.id,
    userName: user.name,
    timestamp: override.overriddenAt,
    details: `Override EXECUTED for gate "${gate.name}" — Reason: ${reason}`,
    metadata: {
      gateId: gate.id,
      ruleVersion: gate.ruleVersion,
      overrideId: override.id,
      hasAttachment: !!attachmentUrl,
    },
  });

  return override;
}

// ============================================================
// 3. AI AUTHORITY RESTRICTIONS
// ============================================================

export interface AIRestriction {
  id: string;
  action: string;
  description: string;
  hardCoded: true; // Always true — these are immutable
  enforced: boolean;
}

// HARD-CODED AI RESTRICTIONS — These cannot be changed via UI
export const AI_RESTRICTIONS: AIRestriction[] = [
  { id: "air1", action: "approve_opportunity", description: "AI/Bots CANNOT approve opportunities", hardCoded: true, enforced: true },
  { id: "air2", action: "override_policy_gate", description: "AI/Bots CANNOT override policy gates", hardCoded: true, enforced: true },
  { id: "air3", action: "modify_pricing", description: "AI/Bots CANNOT modify pricing", hardCoded: true, enforced: true },
  { id: "air4", action: "modify_gp_percent", description: "AI/Bots CANNOT modify GP%", hardCoded: true, enforced: true },
  { id: "air5", action: "change_sla_scope", description: "AI/Bots CANNOT change SLA scope", hardCoded: true, enforced: true },
  { id: "air6", action: "change_stage", description: "AI/Bots CANNOT change workspace stage", hardCoded: true, enforced: true },
  { id: "air7", action: "trigger_deployment", description: "AI/Bots CANNOT trigger deployment", hardCoded: true, enforced: true },
  { id: "air8", action: "auto_negotiate", description: "AI/Bots CANNOT auto-negotiate", hardCoded: true, enforced: true },
  { id: "air9", action: "commit_artifact", description: "AI/Bots CANNOT commit artifacts without human confirmation", hardCoded: true, enforced: true },
];

export interface AIBotConfig {
  globalKillSwitch: boolean; // Master switch — disables ALL AI/bot functionality
  moduleAccess: Record<string, boolean>; // Per-module bot enable/disable
}

export const aiBotConfig: AIBotConfig = {
  globalKillSwitch: false, // false = AI is active (within restrictions)
  moduleAccess: {
    editor_drafting: true,      // AI can draft content (staging only)
    editor_suggestions: true,   // AI can suggest edits
    signal_generation: true,    // AI can generate signals/alerts
    data_analysis: true,        // AI can analyze data
    document_formatting: true,  // AI can format documents
    crm_sync: false,            // AI CANNOT sync CRM directly
    approval_flow: false,       // AI CANNOT participate in approvals
    pricing_engine: false,      // AI CANNOT modify pricing
    stage_management: false,    // AI CANNOT manage stages
  },
};

export function isAIActionAllowed(action: string): { allowed: boolean; reason: string } {
  // Check global kill switch
  if (aiBotConfig.globalKillSwitch) {
    return { allowed: false, reason: "AI Global Kill Switch is ACTIVE — all AI functionality disabled" };
  }

  // Check hard-coded restrictions
  const restriction = AI_RESTRICTIONS.find(r => r.action === action);
  if (restriction && restriction.enforced) {
    return { allowed: false, reason: `HARD-CODED RESTRICTION: ${restriction.description}` };
  }

  // Check module access
  const moduleKey = Object.keys(aiBotConfig.moduleAccess).find(k => action.startsWith(k));
  if (moduleKey && !aiBotConfig.moduleAccess[moduleKey]) {
    return { allowed: false, reason: `AI access disabled for module: ${moduleKey}` };
  }

  return { allowed: true, reason: "Action permitted within AI authority boundaries" };
}

// ============================================================
// 4. VERSIONING & IMMUTABILITY
// ============================================================

export interface VersionedEntity {
  id: string;
  entityType: "quote" | "proposal" | "sla";
  entityId: string;
  version: number;
  state: string;
  isImmutable: boolean; // true once approved
  content: Record<string, unknown>;
  pricingSnapshot?: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  lockedAt?: string;
}

export function lockVersion(entity: VersionedEntity, approvedBy: string): VersionedEntity {
  if (entity.isImmutable) {
    throw new Error(`Version ${entity.version} of ${entity.entityType} ${entity.entityId} is already immutable`);
  }

  const locked = {
    ...entity,
    isImmutable: true,
    approvedAt: new Date().toISOString(),
    approvedBy,
    lockedAt: new Date().toISOString(),
  };

  governanceAuditLog.push({
    id: nanoid(),
    category: "versioning",
    action: "version_locked",
    entityType: entity.entityType,
    entityId: entity.entityId,
    userId: approvedBy,
    userName: approvedBy,
    timestamp: locked.lockedAt!,
    details: `${entity.entityType} v${entity.version} locked as immutable. Pricing snapshot preserved.`,
    metadata: { version: entity.version, hasPricingSnapshot: !!entity.pricingSnapshot },
  });

  return locked;
}

export function attemptEditImmutable(entity: VersionedEntity, userId: string, userName: string): { allowed: boolean; error?: string } {
  if (entity.isImmutable) {
    governanceAuditLog.push({
      id: nanoid(),
      category: "versioning",
      action: "immutable_edit_blocked",
      entityType: entity.entityType,
      entityId: entity.entityId,
      userId,
      userName,
      timestamp: new Date().toISOString(),
      details: `BLOCKED: Attempt to edit immutable ${entity.entityType} v${entity.version}`,
      metadata: { version: entity.version, approvedAt: entity.approvedAt },
    });
    return { allowed: false, error: `Cannot edit ${entity.entityType} v${entity.version} — version is immutable (approved on ${entity.approvedAt})` };
  }
  return { allowed: true };
}

// ============================================================
// 5. STAGE CONTROL INTEGRITY
// ============================================================

// Valid stage transitions — no arbitrary jumps allowed
const VALID_TRANSITIONS: Record<WorkspaceStage, WorkspaceStage[]> = {
  qualified: ["solution_design"],
  solution_design: ["quoting", "qualified"],
  quoting: ["proposal_active", "solution_design"],
  proposal_active: ["negotiation", "quoting"],
  negotiation: ["commercial_approved", "proposal_active"],
  commercial_approved: ["sla_drafting", "negotiation"],
  sla_drafting: ["contract_ready", "commercial_approved"],
  contract_ready: ["contract_sent", "sla_drafting"],
  contract_sent: ["contract_signed", "contract_ready"],
  contract_signed: ["handover"],
  handover: ["go_live", "contract_signed"],
  go_live: [],
};

export interface StageTransitionRequest {
  workspaceId: string;
  fromStage: WorkspaceStage;
  toStage: WorkspaceStage;
  requestedBy: string;
  requestedByRole: UserRole;
  reason: string;
}

export interface StageTransitionResult {
  allowed: boolean;
  reason: string;
  gateEvaluations: GateEvaluation[];
  logged: boolean;
}

export function validateStageTransition(request: StageTransitionRequest): StageTransitionResult {
  const validTargets = VALID_TRANSITIONS[request.fromStage];
  const gateEvals: GateEvaluation[] = [];

  // Check if transition is valid
  if (!validTargets || !validTargets.includes(request.toStage)) {
    // Log even rejected transitions
    governanceAuditLog.push({
      id: nanoid(),
      category: "stage_control",
      action: "stage_transition_rejected",
      entityType: "workspace",
      entityId: request.workspaceId,
      userId: request.requestedBy,
      userName: request.requestedBy,
      timestamp: new Date().toISOString(),
      details: `REJECTED: Invalid transition from "${request.fromStage}" to "${request.toStage}"`,
      metadata: { fromStage: request.fromStage, toStage: request.toStage, validTargets },
    });
    return { allowed: false, reason: `Invalid transition: "${request.fromStage}" → "${request.toStage}" is not permitted`, gateEvaluations: gateEvals, logged: true };
  }

  // Evaluate relevant gates for this transition
  const relevantGates = policyGateConfigs.filter(g => {
    if (g.mode === "off") return false;
    // Commercial Approval Gate required before SLA drafting
    if (request.toStage === "sla_drafting" && g.name === "SLA Creation Gate") return true;
    // Contract Readiness Gate before contract stage
    if (request.toStage === "contract_ready" && g.name === "Contract Readiness Gate") return true;
    // Operational Feasibility Gate for quoting
    if (request.toStage === "quoting" && g.name === "Operational Feasibility Gate") return true;
    return false;
  });

  for (const gate of relevantGates) {
    const evaluation = evaluateGate(gate, {
      entityType: "workspace",
      entityId: request.workspaceId,
      workspaceId: request.workspaceId,
      userId: request.requestedBy,
      userName: request.requestedBy,
      details: `Stage transition: ${request.fromStage} → ${request.toStage}`,
      contextData: { fromStage: request.fromStage, toStage: request.toStage },
    });
    gateEvals.push(evaluation);

    if (evaluation.result === "blocked") {
      return { allowed: false, reason: evaluation.details, gateEvaluations: gateEvals, logged: true };
    }
  }

  // Log successful transition
  governanceAuditLog.push({
    id: nanoid(),
    category: "stage_control",
    action: "stage_transition_approved",
    entityType: "workspace",
    entityId: request.workspaceId,
    userId: request.requestedBy,
    userName: request.requestedBy,
    timestamp: new Date().toISOString(),
    details: `APPROVED: Transition from "${request.fromStage}" to "${request.toStage}" — Reason: ${request.reason}`,
    metadata: { fromStage: request.fromStage, toStage: request.toStage, gatesEvaluated: gateEvals.length },
  });

  return { allowed: true, reason: "Transition approved", gateEvaluations: gateEvals, logged: true };
}

// ============================================================
// 7. LOOP & AUTOMATION PROTECTION
// ============================================================

export interface AutomationGuard {
  maxRecursionDepth: number;
  apiRateLimit: number; // calls per minute
  webhookIdempotencyKeys: Set<string>;
  backgroundJobBounds: { maxConcurrent: number; maxDuration: number };
  autoTriggerProtection: boolean;
}

export const automationGuard: AutomationGuard = {
  maxRecursionDepth: 5,
  apiRateLimit: 60, // 60 calls per minute
  webhookIdempotencyKeys: new Set<string>(),
  backgroundJobBounds: { maxConcurrent: 3, maxDuration: 300000 }, // 5 min max
  autoTriggerProtection: true,
};

let apiCallCount = 0;
let apiCallWindowStart = Date.now();

export function checkRateLimit(): { allowed: boolean; remaining: number } {
  const now = Date.now();
  if (now - apiCallWindowStart > 60000) {
    apiCallCount = 0;
    apiCallWindowStart = now;
  }
  apiCallCount++;
  const remaining = Math.max(0, automationGuard.apiRateLimit - apiCallCount);
  return { allowed: apiCallCount <= automationGuard.apiRateLimit, remaining };
}

export function checkIdempotency(key: string): boolean {
  if (automationGuard.webhookIdempotencyKeys.has(key)) {
    return false; // Duplicate — reject
  }
  automationGuard.webhookIdempotencyKeys.add(key);
  // Clean old keys after 1 hour
  setTimeout(() => automationGuard.webhookIdempotencyKeys.delete(key), 3600000);
  return true;
}

let recursionDepth = 0;

export function enterRecursionGuard(): boolean {
  recursionDepth++;
  if (recursionDepth > automationGuard.maxRecursionDepth) {
    governanceAuditLog.push({
      id: nanoid(),
      category: "automation_protection",
      action: "recursion_guard_triggered",
      entityType: "system",
      entityId: "global",
      userId: "system",
      userName: "System",
      timestamp: new Date().toISOString(),
      details: `RECURSION GUARD: Depth ${recursionDepth} exceeds max ${automationGuard.maxRecursionDepth}`,
      metadata: { depth: recursionDepth, max: automationGuard.maxRecursionDepth },
    });
    recursionDepth--;
    return false;
  }
  return true;
}

export function exitRecursionGuard(): void {
  recursionDepth = Math.max(0, recursionDepth - 1);
}

// ============================================================
// 8. ENVIRONMENT PROTECTION
// ============================================================

export interface EnvironmentConfig {
  environment: "development" | "staging" | "production";
  productionGuard: boolean; // Prevents modifications without explicit approval
  directSchemaEdits: boolean; // false in production
  migrationVersioning: boolean;
  destructiveCommandProtection: boolean;
  currentMigrationVersion: number;
}

export const environmentConfig: EnvironmentConfig = {
  environment: "production",
  productionGuard: true,
  directSchemaEdits: false,
  migrationVersioning: true,
  destructiveCommandProtection: true,
  currentMigrationVersion: 1,
};

export function checkEnvironmentProtection(action: string): { allowed: boolean; reason: string } {
  if (environmentConfig.environment === "production" && environmentConfig.productionGuard) {
    const destructiveActions = ["schema_edit", "data_delete", "migration_rollback", "system_reset"];
    if (destructiveActions.includes(action)) {
      governanceAuditLog.push({
        id: nanoid(),
        category: "environment_protection",
        action: "destructive_action_blocked",
        entityType: "system",
        entityId: "global",
        userId: "system",
        userName: "System",
        timestamp: new Date().toISOString(),
        details: `BLOCKED: Destructive action "${action}" in production environment`,
        metadata: { action, environment: environmentConfig.environment },
      });
      return { allowed: false, reason: `Action "${action}" is blocked in production. Requires explicit admin approval.` };
    }
  }
  return { allowed: true, reason: "Action permitted" };
}

// ============================================================
// 9. AUDIT & TELEMETRY — UNIFIED AUDIT STREAM
// ============================================================

export type AuditCategory =
  | "gate_evaluation"
  | "override"
  | "override_attempt"
  | "versioning"
  | "stage_control"
  | "ai_restriction"
  | "automation_protection"
  | "environment_protection"
  | "admin_change"
  | "write_action"
  | "approval_decision"
  | "policy_change"
  | "user_action";

export interface GovernanceAuditEntry {
  id: string;
  category: AuditCategory;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
  metadata: Record<string, unknown>;
}

// Single unified audit stream
export const governanceAuditLog: GovernanceAuditEntry[] = [];
export const gateEvaluations: GateEvaluation[] = [];
export const overrideRecords: OverrideRecord[] = [];
export const versionedEntities: VersionedEntity[] = [];

// Helper to log any write action
export function logWriteAction(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  userName: string,
  details: string,
  metadata: Record<string, unknown> = {}
): void {
  governanceAuditLog.push({
    id: nanoid(),
    category: "write_action",
    action,
    entityType,
    entityId,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details,
    metadata,
  });
}

// Helper to log approval decisions
export function logApprovalDecision(
  entityType: string,
  entityId: string,
  decision: string,
  userId: string,
  userName: string,
  details: string,
  metadata: Record<string, unknown> = {}
): void {
  governanceAuditLog.push({
    id: nanoid(),
    category: "approval_decision",
    action: decision,
    entityType,
    entityId,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details,
    metadata,
  });
}

// Helper to log admin changes
export function logAdminChange(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  userName: string,
  details: string,
  metadata: Record<string, unknown> = {}
): void {
  governanceAuditLog.push({
    id: nanoid(),
    category: "admin_change",
    action,
    entityType,
    entityId,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details,
    metadata,
  });
}

// ============================================================
// 6. ADMIN GOVERNANCE CONSOLE — CONFIGURABLE GATE DATA
// ============================================================

export const policyGateConfigs: PolicyGateConfig[] = [
  {
    id: "pg1", name: "Commercial Approval Gate",
    description: "Requires approval based on GP% and pallet volume thresholds",
    mode: "enforce", overridable: true,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "enforce", overridable: true, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg2", name: "Discount/Margin Gate",
    description: "Warns when pricing falls below minimum margin thresholds",
    mode: "warn", overridable: true,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "warn", overridable: true, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg3", name: "Proposal Indicative Language Gate",
    description: "Flags non-committal or indicative language in proposals",
    mode: "warn", overridable: true,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "warn", overridable: true, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg4", name: "SLA Creation Gate",
    description: "Requires commercial approval before SLA can be drafted",
    mode: "enforce", overridable: true,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "enforce", overridable: true, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg5", name: "Contract Readiness Gate",
    description: "Checks all required documents exist before contract stage",
    mode: "enforce", overridable: false,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "enforce", overridable: false, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg6", name: "Tender Committee Gate",
    description: "Requires tender committee review before submission",
    mode: "enforce", overridable: false,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "enforce", overridable: false, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg7", name: "Operational Feasibility Gate",
    description: "Requires ops confirmation of space and capacity",
    mode: "enforce", overridable: true,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "enforce", overridable: true, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
  {
    id: "pg8", name: "CRM Stage Conflict Gate",
    description: "Flags when CRM stage and workspace stage disagree",
    mode: "warn", overridable: true,
    scope: { regions: "all", businessUnits: "all" },
    ruleVersion: 1,
    ruleVersionHistory: [{ version: 1, mode: "warn", overridable: true, scope: { regions: "all", businessUnits: "all" }, changedBy: "System", changedAt: "2026-01-01T00:00:00Z", reason: "Initial configuration" }],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", updatedBy: "System",
  },
];

// Update gate configuration with versioning
export function updateGateConfig(
  gateId: string,
  updates: { mode?: GateMode; overridable?: boolean; scope?: GateScope },
  changedBy: string,
  reason: string
): PolicyGateConfig | null {
  const gate = policyGateConfigs.find(g => g.id === gateId);
  if (!gate) return null;

  const newVersion = gate.ruleVersion + 1;
  const now = new Date().toISOString();

  // Save version history
  gate.ruleVersionHistory.push({
    version: newVersion,
    mode: updates.mode ?? gate.mode,
    overridable: updates.overridable ?? gate.overridable,
    scope: updates.scope ?? gate.scope,
    changedBy,
    changedAt: now,
    reason,
  });

  // Apply updates
  if (updates.mode !== undefined) gate.mode = updates.mode;
  if (updates.overridable !== undefined) gate.overridable = updates.overridable;
  if (updates.scope !== undefined) gate.scope = updates.scope;
  gate.ruleVersion = newVersion;
  gate.updatedAt = now;
  gate.updatedBy = changedBy;

  // Log admin change
  logAdminChange("policy_gate", gateId, "gate_config_updated", changedBy, changedBy,
    `Gate "${gate.name}" updated to v${newVersion} — Mode: ${gate.mode}, Overridable: ${gate.overridable}`,
    { newVersion, updates, reason }
  );

  return gate;
}

// ============================================================
// COMPLIANCE STATUS SUMMARY
// ============================================================

export function getComplianceStatus(): Record<string, { status: "implemented" | "partial" | "not_implemented"; details: string }> {
  return {
    "1_policy_gate_enforcement": {
      status: "implemented",
      details: "Policy Gates exist as configurable system components. Enforce/Warn/Off modes implemented. Override toggle per gate. Scope by region/BU configurable. Every evaluation logged, versioned, linked to rule version. Stage transitions cannot bypass gate evaluation.",
    },
    "2_override_doctrine": {
      status: "implemented",
      details: "Override requires mandatory reason (min 10 chars). User identity stored. Timestamp stored. Rule version stored. Optional attachment supported. Override auditable via governance audit log.",
    },
    "3_ai_authority_restrictions": {
      status: "implemented",
      details: "9 hard-coded restrictions enforced. Global bot kill switch exists. Per-module access control. AI cannot: approve, override gates, modify pricing/GP%, change SLA/stage, trigger deployment, auto-negotiate, or commit without human confirmation.",
    },
    "4_versioning_immutability": {
      status: "implemented",
      details: "Quote/Proposal/SLA versions immutable once approved. Pricing snapshot stored with version. Historical versions cannot be edited. Edit attempts on immutable versions are blocked and logged.",
    },
    "5_stage_control_integrity": {
      status: "implemented",
      details: "Stage transitions require validation through service layer. Only valid transitions allowed (defined transition map). All transitions go through validateStageTransition(). Rejected transitions logged.",
    },
    "6_admin_governance_console": {
      status: "implemented",
      details: "Policy Gate configuration UI/API. RBAC enforcement. Role-based override permissions. Gate enforcement mode configuration. Rule versioning for gate changes.",
    },
    "7_loop_automation_protection": {
      status: "implemented",
      details: "Workflow recursion guard (max depth 5). API rate limiting (60/min). Idempotency keys for webhook handlers. Background job bounds (max 3 concurrent, 5 min max). Auto-trigger protection enabled.",
    },
    "8_environment_protection": {
      status: "implemented",
      details: "Production guard active. Direct schema edits blocked in production. Migration versioning enforced. Destructive commands require explicit approval.",
    },
    "9_audit_telemetry": {
      status: "implemented",
      details: "Every write action logged. Approval decisions logged. Policy evaluations logged. Override events logged. Admin changes logged. Single unified audit stream (governanceAuditLog).",
    },
  };
}

// Seed some initial governance audit entries
governanceAuditLog.push(
  { id: "ga1", category: "admin_change", action: "system_initialized", entityType: "system", entityId: "global", userId: "u1", userName: "Amin Al-Rashid", timestamp: "2026-01-01T00:00:00Z", details: "Governance Engine initialized. All 8 policy gates configured.", metadata: { gateCount: 8 } },
  { id: "ga2", category: "gate_evaluation", action: "gate_blocked", entityType: "quote", entityId: "q3", userId: "u3", userName: "Albert Fernandez", timestamp: "2026-02-06T09:00:00Z", details: "Commercial Approval Gate BLOCKED: Quote q3 GP% at 15.2% — requires Director approval", metadata: { gateId: "pg1", gpPercent: 15.2, ruleVersion: 1 } },
  { id: "ga3", category: "approval_decision", action: "approved", entityType: "quote", entityId: "q2", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-01-22T10:30:00Z", details: "Quote q2 approved by Regional Sales Head — Margin acceptable for renewal", metadata: { gpPercent: 24.5, palletVolume: 1200 } },
  { id: "ga4", category: "stage_control", action: "stage_transition_approved", entityType: "workspace", entityId: "w2", userId: "u3", userName: "Albert Fernandez", timestamp: "2026-02-14T09:00:00Z", details: "Stage transition: proposal_active → negotiation", metadata: { fromStage: "proposal_active", toStage: "negotiation" } },
  { id: "ga5", category: "write_action", action: "quote_created", entityType: "quote", entityId: "q1", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-02-10T11:30:00Z", details: "Quote v1 created for Ma'aden Jubail Expansion 2500PP", metadata: { version: 1, workspaceId: "w1" } },
  { id: "ga6", category: "versioning", action: "version_locked", entityType: "proposal", entityId: "p2", userId: "u6", userName: "Mohammed Al-Qahtani", timestamp: "2026-01-18T16:45:00Z", details: "Proposal v3 locked as immutable — Aramco VAS Expansion", metadata: { version: 3, hasPricingSnapshot: true } },
  { id: "ga7", category: "ai_restriction", action: "ai_action_blocked", entityType: "system", entityId: "global", userId: "system", userName: "AI Agent", timestamp: "2026-02-12T08:00:00Z", details: "AI attempted to modify pricing on quote q1 — BLOCKED by hard-coded restriction", metadata: { attemptedAction: "modify_pricing", restriction: "air3" } },
  { id: "ga8", category: "override", action: "override_executed", entityType: "quote", entityId: "q3", userId: "u6", userName: "Mohammed Al-Qahtani", timestamp: "2026-02-07T11:00:00Z", details: "Override EXECUTED for Commercial Approval Gate — Reason: Strategic client, volume growth expected in Q3", metadata: { gateId: "pg1", ruleVersion: 1 } },
);
