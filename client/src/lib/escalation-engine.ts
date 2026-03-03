/**
 * Sprint 7 — Escalation Engine
 * 
 * Deterministic rule engine that turns "Red Signals" into structured,
 * trackable escalation events. No AI, no heuristics.
 * 
 * Red ≠ visual warning. Red = state change that triggers a persistent event.
 * Everything is: Logged, Traceable, Acknowledgable, Closable.
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";
import { syncAuditEntry } from "./supabase-sync";
import type { Workspace, Quote, Customer, CustomerGrade, PnLModel } from "./store";
import { DELTA_THRESHOLDS } from "./sla-integrity";

// ============================================================
// TYPES
// ============================================================

export type EscalationSeverity = "red" | "amber";
export type EscalationStatus = "open" | "acknowledged" | "resolved";
export type TriggerType = "margin_breach" | "delta_breach" | "stage_override" | "score_red" | "renewal_risk";
export type TaskStatus = "open" | "in_progress" | "done";

export interface EscalationRule {
  id: string;
  entityType: string;
  triggerType: TriggerType;
  name: string;
  description: string;
  threshold: Record<string, any>;
  severity: EscalationSeverity;
  autoEscalate: boolean;
  active: boolean;
  createdAt: string;
}

export interface EscalationEvent {
  id: string;
  entityType: string;
  entityId: string;
  workspaceId: string | null;
  severity: EscalationSeverity;
  ruleId: string | null;
  triggerType: TriggerType;
  triggerReason: string;
  status: EscalationStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  triggeredBy: string | null;
  triggeredByName: string | null;
  metadata: Record<string, any> | null;
  resolutionReason: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface EscalationTask {
  id: string;
  escalationId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  dueDate: string | null;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

// ============================================================
// CONSTANTS
// ============================================================

/** Commercial Director (Amin Al-Rashid) — default escalation assignee */
const COMMERCIAL_DIRECTOR = { id: "u1", name: "Amin Al-Rashid" };

/** Default rule IDs matching the seeded escalation_rules */
export const RULE_IDS = {
  MARGIN_BREACH: "er-margin-breach",
  DELTA_BREACH: "er-delta-breach",
  STAGE_OVERRIDE: "er-stage-override",
  SCORE_RED: "er-score-red",
  RENEWAL_RISK: "er-renewal-risk",
} as const;

/** Margin thresholds */
const GP_CRITICAL = 10;  // Below 10% = CEO/CFO required
const GP_WARNING = 22;   // Below 22% = Director required

// ============================================================
// SUPABASE CRUD
// ============================================================

function mapEventRow(row: any): EscalationEvent {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    workspaceId: row.workspace_id,
    severity: row.severity,
    ruleId: row.rule_id,
    triggerType: row.trigger_type,
    triggerReason: row.trigger_reason,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    triggeredBy: row.triggered_by,
    triggeredByName: row.triggered_by_name,
    metadata: row.metadata,
    resolutionReason: row.resolution_reason,
    resolvedBy: row.resolved_by,
    resolvedByName: row.resolved_by_name,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
  };
}

function mapTaskRow(row: any): EscalationTask {
  return {
    id: row.id,
    escalationId: row.escalation_id,
    title: row.title,
    description: row.description,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/** Fetch all escalation events for a workspace */
export async function fetchEscalationsByWorkspace(workspaceId: string): Promise<EscalationEvent[]> {
  const { data, error } = await supabase
    .from("escalation_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[EscalationEngine] fetchEscalationsByWorkspace error:", error);
    return [];
  }
  return (data || []).map(mapEventRow);
}

/** Fetch ALL escalation events (for global dashboard) */
export async function fetchAllEscalations(): Promise<EscalationEvent[]> {
  const { data, error } = await supabase
    .from("escalation_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[EscalationEngine] fetchAllEscalations error:", error);
    return [];
  }
  return (data || []).map(mapEventRow);
}

/** Fetch all open escalation events (for badge count) */
export async function fetchOpenEscalationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("escalation_events")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "acknowledged"]);

  if (error) {
    console.error("[EscalationEngine] fetchOpenEscalationCount error:", error);
    return 0;
  }
  return count || 0;
}

/** Fetch tasks for an escalation event */
export async function fetchTasksByEscalation(escalationId: string): Promise<EscalationTask[]> {
  const { data, error } = await supabase
    .from("escalation_tasks")
    .select("*")
    .eq("escalation_id", escalationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[EscalationEngine] fetchTasksByEscalation error:", error);
    return [];
  }
  return (data || []).map(mapTaskRow);
}

// ============================================================
// EVENT CREATION (Core)
// ============================================================

interface CreateEscalationParams {
  entityType: string;
  entityId: string;
  workspaceId: string | null;
  severity: EscalationSeverity;
  ruleId: string;
  triggerType: TriggerType;
  triggerReason: string;
  metadata?: Record<string, any>;
  taskTitle?: string;
  taskDescription?: string;
}

/**
 * Core function: Create an escalation event + optional task + audit log entry.
 * Returns the created event, or null if creation failed.
 */
export async function createEscalation(params: CreateEscalationParams): Promise<EscalationEvent | null> {
  const user = getCurrentUser();
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 1. Insert escalation_event
  const eventRow = {
    id: eventId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    workspace_id: params.workspaceId,
    severity: params.severity,
    rule_id: params.ruleId,
    trigger_type: params.triggerType,
    trigger_reason: params.triggerReason,
    status: "open",
    assigned_to: COMMERCIAL_DIRECTOR.id,
    assigned_to_name: COMMERCIAL_DIRECTOR.name,
    triggered_by: user.id,
    triggered_by_name: user.name,
    metadata: params.metadata || null,
    created_at: now,
  };

  const { error: eventError } = await supabase.from("escalation_events").insert(eventRow);
  if (eventError) {
    console.error("[EscalationEngine] createEscalation insert error:", eventError);
    return null;
  }

  // 2. Insert escalation_task (if title provided)
  if (params.taskTitle) {
    const taskRow = {
      id: crypto.randomUUID(),
      escalation_id: eventId,
      title: params.taskTitle,
      description: params.taskDescription || null,
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      status: "open",
      created_at: now,
    };
    const { error: taskError } = await supabase.from("escalation_tasks").insert(taskRow);
    if (taskError) {
      console.error("[EscalationEngine] createEscalation task insert error:", taskError);
    }
  }

  // 3. Write audit_log entry
  await syncAuditEntry({
    id: `audit-esc-${eventId}`,
    entityType: params.entityType,
    entityId: params.entityId,
    action: "escalation_triggered",
    userId: user.id,
    userName: user.name,
    timestamp: now,
    details: `Escalation triggered: ${params.triggerReason}`,
    metadata: {
      escalationId: eventId,
      ruleId: params.ruleId,
      severity: params.severity,
      triggerType: params.triggerType,
      assignedTo: COMMERCIAL_DIRECTOR.name,
    },
  });

  return mapEventRow(eventRow);
}

// ============================================================
// RESOLUTION
// ============================================================

/**
 * Acknowledge an escalation (Admin only).
 */
export async function acknowledgeEscalation(escalationId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (user.role !== "admin") {
    console.warn("[EscalationEngine] Non-admin tried to acknowledge escalation");
    return false;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("escalation_events")
    .update({ status: "acknowledged", acknowledged_at: now })
    .eq("id", escalationId);

  if (error) {
    console.error("[EscalationEngine] acknowledgeEscalation error:", error);
    return false;
  }
  return true;
}

/**
 * Resolve an escalation with a reason (Admin only).
 * Writes an audit_log entry for the resolution.
 */
export async function resolveEscalation(escalationId: string, reason: string): Promise<boolean> {
  const user = getCurrentUser();
  if (user.role !== "admin") {
    console.warn("[EscalationEngine] Non-admin tried to resolve escalation");
    return false;
  }

  if (!reason || reason.trim().length < 10) {
    console.warn("[EscalationEngine] Resolution reason too short");
    return false;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("escalation_events")
    .update({
      status: "resolved",
      resolution_reason: reason.trim(),
      resolved_by: user.id,
      resolved_by_name: user.name,
      resolved_at: now,
    })
    .eq("id", escalationId);

  if (error) {
    console.error("[EscalationEngine] resolveEscalation error:", error);
    return false;
  }

  // Audit log for resolution
  await syncAuditEntry({
    id: `audit-esc-resolve-${escalationId}`,
    entityType: "escalation",
    entityId: escalationId,
    action: "escalation_resolved",
    userId: user.id,
    userName: user.name,
    timestamp: now,
    details: `Escalation resolved: ${reason.trim()}`,
    metadata: {
      escalationId,
      resolvedBy: user.name,
    },
  });

  return true;
}

// ============================================================
// TRIGGER DETECTION FUNCTIONS
// ============================================================

/**
 * Trigger 1: Margin below authority threshold
 * Fires when workspace GP% < 10% (critical/red)
 */
export async function checkMarginBreach(workspace: Workspace): Promise<EscalationEvent | null> {
  if (workspace.gpPercent >= GP_CRITICAL) return null;

  // Check for existing open escalation to avoid duplicates
  const existing = await fetchEscalationsByWorkspace(workspace.id);
  const alreadyOpen = existing.find(
    e => e.triggerType === "margin_breach" && e.status !== "resolved"
  );
  if (alreadyOpen) return null;

  return createEscalation({
    entityType: "workspace",
    entityId: workspace.id,
    workspaceId: workspace.id,
    severity: "red",
    ruleId: RULE_IDS.MARGIN_BREACH,
    triggerType: "margin_breach",
    triggerReason: `GP% at ${workspace.gpPercent.toFixed(1)}% — below ${GP_CRITICAL}% critical threshold. CEO/CFO approval required.`,
    metadata: {
      gpPercent: workspace.gpPercent,
      threshold: GP_CRITICAL,
      customerName: workspace.customerName,
      workspaceTitle: workspace.title,
      estimatedValue: workspace.estimatedValue,
    },
    taskTitle: `Review margin breach: ${workspace.title}`,
    taskDescription: `GP% at ${workspace.gpPercent.toFixed(1)}% for ${workspace.customerName}. Requires CEO/CFO review and decision.`,
  });
}

/**
 * Trigger 2: SLA vs P&L delta breach
 * Fires when GP% delta exceeds critical threshold (5pp)
 */
export async function checkDeltaBreach(
  workspace: Workspace,
  quote: Quote,
  pnl: PnLModel
): Promise<EscalationEvent | null> {
  const gpDelta = Math.abs(quote.gpPercent - pnl.gpPercent);
  if (gpDelta < DELTA_THRESHOLDS.gpPercentCritical) return null;

  // Check for existing open escalation
  const existing = await fetchEscalationsByWorkspace(workspace.id);
  const alreadyOpen = existing.find(
    e => e.triggerType === "delta_breach" && e.status !== "resolved"
  );
  if (alreadyOpen) return null;

  return createEscalation({
    entityType: "workspace",
    entityId: workspace.id,
    workspaceId: workspace.id,
    severity: "red",
    ruleId: RULE_IDS.DELTA_BREACH,
    triggerType: "delta_breach",
    triggerReason: `SLA vs P&L GP% delta is ${gpDelta.toFixed(1)}pp — exceeds ${DELTA_THRESHOLDS.gpPercentCritical}pp critical threshold.`,
    metadata: {
      quoteGpPercent: quote.gpPercent,
      pnlGpPercent: pnl.gpPercent,
      gpDelta,
      threshold: DELTA_THRESHOLDS.gpPercentCritical,
      customerName: workspace.customerName,
      workspaceTitle: workspace.title,
    },
    taskTitle: `Investigate SLA/P&L delta: ${workspace.title}`,
    taskDescription: `GP% delta of ${gpDelta.toFixed(1)}pp between SLA (${quote.gpPercent}%) and P&L (${pnl.gpPercent}%). Requires reconciliation.`,
  });
}

/**
 * Trigger 3: Stage forced override
 * Called when an admin forces a stage transition or pricing lock override.
 */
export async function checkStageOverride(
  workspace: Workspace,
  overrideType: string,
  overrideReason: string
): Promise<EscalationEvent | null> {
  return createEscalation({
    entityType: "workspace",
    entityId: workspace.id,
    workspaceId: workspace.id,
    severity: "amber",
    ruleId: RULE_IDS.STAGE_OVERRIDE,
    triggerType: "stage_override",
    triggerReason: `Admin override: ${overrideType}. Reason: ${overrideReason}`,
    metadata: {
      overrideType,
      overrideReason,
      customerName: workspace.customerName,
      workspaceTitle: workspace.title,
      stage: workspace.stage,
    },
    taskTitle: `Review admin override: ${workspace.title}`,
    taskDescription: `${overrideType} override executed. Reason: ${overrideReason}`,
  });
}

/**
 * Trigger 4: Customer score falls to red (grade D or F)
 */
export async function checkCustomerScoreRed(
  customer: Customer,
  workspaceId?: string
): Promise<EscalationEvent | null> {
  const redGrades: CustomerGrade[] = ["D", "F"];
  if (!redGrades.includes(customer.grade)) return null;

  // Check for existing open escalation for this customer
  const { data: existing } = await supabase
    .from("escalation_events")
    .select("id")
    .eq("entity_type", "customer")
    .eq("entity_id", customer.id)
    .eq("trigger_type", "score_red")
    .in("status", ["open", "acknowledged"])
    .limit(1);

  if (existing && existing.length > 0) return null;

  return createEscalation({
    entityType: "customer",
    entityId: customer.id,
    workspaceId: workspaceId || null,
    severity: "red",
    ruleId: RULE_IDS.SCORE_RED,
    triggerType: "score_red",
    triggerReason: `Customer ${customer.name} ECR grade dropped to ${customer.grade}. Immediate review required.`,
    metadata: {
      customerName: customer.name,
      grade: customer.grade,
      region: customer.region,
      contractExpiry: customer.contractExpiry,
    },
    taskTitle: `Review customer health: ${customer.name}`,
    taskDescription: `ECR grade at ${customer.grade}. Assess risk and determine action plan.`,
  });
}

/**
 * Trigger 5: Renewal risk above threshold
 * Called when renewal gate evaluation produces a "block" result.
 */
export async function checkRenewalRisk(
  workspaceId: string,
  customerName: string,
  blockedGates: string[],
  renewalWorkspaceId: string
): Promise<EscalationEvent | null> {
  if (blockedGates.length === 0) return null;

  // Check for existing open escalation
  const { data: existing } = await supabase
    .from("escalation_events")
    .select("id")
    .eq("entity_type", "renewal")
    .eq("entity_id", renewalWorkspaceId)
    .eq("trigger_type", "renewal_risk")
    .in("status", ["open", "acknowledged"])
    .limit(1);

  if (existing && existing.length > 0) return null;

  return createEscalation({
    entityType: "renewal",
    entityId: renewalWorkspaceId,
    workspaceId: workspaceId,
    severity: "red",
    ruleId: RULE_IDS.RENEWAL_RISK,
    triggerType: "renewal_risk",
    triggerReason: `Renewal for ${customerName} has ${blockedGates.length} blocked gate(s): ${blockedGates.join(", ")}`,
    metadata: {
      customerName,
      blockedGates,
      renewalWorkspaceId,
    },
    taskTitle: `Address renewal risk: ${customerName}`,
    taskDescription: `Renewal blocked by: ${blockedGates.join(", ")}. Requires resolution before renewal can proceed.`,
  });
}

// ============================================================
// BATCH EVALUATION (run on workspace load)
// ============================================================

/**
 * Evaluate all applicable escalation triggers for a workspace.
 * Called on workspace detail load to catch any red conditions.
 * Returns array of newly created escalation events.
 */
export async function evaluateWorkspaceEscalations(
  workspace: Workspace,
  quote?: Quote | null,
  pnl?: PnLModel | null,
  customer?: Customer | null
): Promise<EscalationEvent[]> {
  const results: EscalationEvent[] = [];

  // 1. Margin breach
  const marginEvent = await checkMarginBreach(workspace);
  if (marginEvent) results.push(marginEvent);

  // 2. Delta breach (only if both quote and P&L exist)
  if (quote && pnl) {
    const deltaEvent = await checkDeltaBreach(workspace, quote, pnl);
    if (deltaEvent) results.push(deltaEvent);
  }

  // 3. Customer score red (if customer provided)
  if (customer) {
    const scoreEvent = await checkCustomerScoreRed(customer, workspace.id);
    if (scoreEvent) results.push(scoreEvent);
  }

  return results;
}

// ============================================================
// SEED DATA (for initial demo)
// ============================================================

/**
 * Seed initial escalation events for demo purposes.
 * Only seeds if no events exist yet.
 */
export async function seedEscalationEvents(): Promise<void> {
  const { count } = await supabase
    .from("escalation_events")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) return; // Already seeded

  const now = new Date();
  const events = [
    {
      id: crypto.randomUUID(),
      entity_type: "workspace",
      entity_id: "w4",
      workspace_id: "w4",
      severity: "red",
      rule_id: RULE_IDS.MARGIN_BREACH,
      trigger_type: "margin_breach",
      trigger_reason: "GP% at 8.5% — below 10% critical threshold. CEO/CFO approval required.",
      status: "open",
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      triggered_by: "system",
      triggered_by_name: "System",
      metadata: { gpPercent: 8.5, threshold: 10, customerName: "Al-Rajhi Steel", workspaceTitle: "Al-Rajhi Emergency Storage" },
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      entity_type: "customer",
      entity_id: "c9",
      workspace_id: "w4",
      severity: "red",
      rule_id: RULE_IDS.SCORE_RED,
      trigger_type: "score_red",
      trigger_reason: "Customer Al-Rajhi Steel ECR grade dropped to D. Immediate review required.",
      status: "open",
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      triggered_by: "system",
      triggered_by_name: "System",
      metadata: { customerName: "Al-Rajhi Steel", grade: "D", region: "East" },
      created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      entity_type: "workspace",
      entity_id: "w3",
      workspace_id: "w3",
      severity: "amber",
      rule_id: RULE_IDS.STAGE_OVERRIDE,
      trigger_type: "stage_override",
      trigger_reason: "Admin override: Pricing lock bypass. Reason: Client requested urgent pricing revision for Unilever Dammam.",
      status: "acknowledged",
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      triggered_by: "u1",
      triggered_by_name: "Amin Al-Rashid",
      metadata: { overrideType: "pricing_lock_bypass", customerName: "Unilever Arabia", workspaceTitle: "Unilever Dammam New SOW" },
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      acknowledged_at: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      entity_type: "workspace",
      entity_id: "w1",
      workspace_id: "w1",
      severity: "red",
      rule_id: RULE_IDS.MARGIN_BREACH,
      trigger_type: "margin_breach",
      trigger_reason: "GP% at 19.7% — below 22% warning threshold. Director approval required.",
      status: "resolved",
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      triggered_by: "system",
      triggered_by_name: "System",
      metadata: { gpPercent: 19.7, threshold: 22, customerName: "Ma'aden", workspaceTitle: "Ma'aden Jubail Expansion 2500PP" },
      resolution_reason: "Director approved margin exception. Client is strategic account with growth potential.",
      resolved_by: "u1",
      resolved_by_name: "Amin Al-Rashid",
      created_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      resolved_at: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const { error } = await supabase.from("escalation_events").insert(events);
  if (error) {
    console.error("[EscalationEngine] seedEscalationEvents error:", error);
  }

  // Seed tasks for open events
  const tasks = [
    {
      id: crypto.randomUUID(),
      escalation_id: events[0].id,
      title: "Review margin breach: Al-Rajhi Emergency Storage",
      description: "GP% at 8.5% for Al-Rajhi Steel. Requires CEO/CFO review and decision.",
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      due_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: "open",
      created_at: events[0].created_at,
    },
    {
      id: crypto.randomUUID(),
      escalation_id: events[1].id,
      title: "Review customer health: Al-Rajhi Steel",
      description: "ECR grade at D. Assess risk and determine action plan.",
      assigned_to: COMMERCIAL_DIRECTOR.id,
      assigned_to_name: COMMERCIAL_DIRECTOR.name,
      due_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: "open",
      created_at: events[1].created_at,
    },
  ];

  const { error: taskError } = await supabase.from("escalation_tasks").insert(tasks);
  if (taskError) {
    console.error("[EscalationEngine] seedEscalationTasks error:", taskError);
  }
}

// ============================================================
// TRIGGER LABEL HELPERS
// ============================================================

export function getTriggerTypeLabel(type: TriggerType): string {
  const labels: Record<TriggerType, string> = {
    margin_breach: "Margin Breach",
    delta_breach: "SLA/P&L Delta Breach",
    stage_override: "Stage Override",
    score_red: "Customer Score Red",
    renewal_risk: "Renewal Risk",
  };
  return labels[type] || type;
}

export function getSeverityColor(severity: EscalationSeverity): { bg: string; text: string; border: string } {
  if (severity === "red") return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
  return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
}

export function getStatusColor(status: EscalationStatus): { bg: string; text: string } {
  switch (status) {
    case "open": return { bg: "bg-red-100", text: "text-red-800" };
    case "acknowledged": return { bg: "bg-amber-100", text: "text-amber-800" };
    case "resolved": return { bg: "bg-green-100", text: "text-green-800" };
    default: return { bg: "bg-gray-100", text: "text-gray-800" };
  }
}
