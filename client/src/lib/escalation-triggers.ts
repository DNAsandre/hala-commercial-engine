/**
 * Escalation Triggers — Global Exception Detection Layer
 *
 * Reads from: Customers, Workspaces, Renewals
 * Creates escalation_events via the existing engine.
 *
 * Trigger functions:
 *   checkContractExpiry()     — contract expired or expiring soon
 *   checkPaymentRisk()        — bad payer, high DSO
 *   checkMissingDocuments()   — no WSO, no MSA, unsigned contract
 *   checkRenewalStatus()      — renewal stalled or incomplete
 *   checkCRMStatus()          — CRM stage stuck at "ongoing"
 *   checkNotesSignals()       — keyword scanning in workspace notes
 *   checkStalledWorkspace()   — workspace stuck in stage too long
 *   checkCustomerHealth()     — ECR grade deterioration
 *
 * Routing:
 *   Level 1 (signal)      → Account Owner
 *   Level 2 (managed)     → Account Owner
 *   Level 3 (escalation)  → Regional Head
 *   Level 4 (critical)    → Amin Al-Rashid
 */

import { createEscalation } from "./escalation-engine";
import type { EscalationEvent, EscalationSeverity } from "./escalation-engine";
import type { Customer, Workspace } from "./store";
import { customers, workspaces } from "./store";
import { renewalWorkspaces, contractBaselines } from "./renewal-engine";
import { supabase } from "./supabase";

// ============================================================
// SEVERITY MODEL — 4 Levels
// ============================================================

export type EscalationLevel = 1 | 2 | 3 | 4;

export interface EscalationLevelConfig {
  level: EscalationLevel;
  label: string;
  severity: EscalationSeverity;
  description: string;
}

export const ESCALATION_LEVELS: EscalationLevelConfig[] = [
  { level: 1, label: "Signal",             severity: "amber", description: "Informational — Owner awareness" },
  { level: 2, label: "Managed Exception",  severity: "amber", description: "Active tracking — Owner action required" },
  { level: 3, label: "Escalation",         severity: "red",   description: "Escalated — Regional Head intervention" },
  { level: 4, label: "Critical",           severity: "red",   description: "Critical — Commercial Director (Amin)" },
];

export function getLevelConfig(level: EscalationLevel): EscalationLevelConfig {
  return ESCALATION_LEVELS.find(l => l.level === level) || ESCALATION_LEVELS[0];
}

function levelToSeverity(level: EscalationLevel): EscalationSeverity {
  return level >= 3 ? "red" : "amber";
}

// ============================================================
// ROUTING ENGINE — Dynamic Assignment
// ============================================================

/** Owner lookup: name → mock user ID */
const OWNER_MAP: Record<string, { id: string; name: string }> = {
  "Ra'ed":  { id: "u2", name: "Ra'ed Al-Harbi" },
  "Albert": { id: "u3", name: "Albert Fernandez" },
  "Hano":   { id: "u4", name: "Hano Al-Mansour" },
};

/** Regional heads */
const REGIONAL_HEAD_MAP: Record<string, { id: string; name: string }> = {
  East:    { id: "u5", name: "Mohammed Al-Dosari" },
  Central: { id: "u6", name: "Sultan Al-Otaibi" },
  West:    { id: "u7", name: "Tariq Al-Zahrani" },
};

/** Commercial Director — Level 4 only */
const COMMERCIAL_DIRECTOR = { id: "u1", name: "Amin Al-Rashid" };

export interface RouteTarget {
  id: string;
  name: string;
}

/**
 * Route escalation to the correct person based on level.
 * Level 1–2: Account/Workspace Owner
 * Level 3: Regional Head
 * Level 4: Amin (Commercial Director)
 */
export function routeEscalation(
  level: EscalationLevel,
  ownerName?: string,
  region?: string
): RouteTarget {
  if (level >= 4) return COMMERCIAL_DIRECTOR;

  if (level >= 3 && region) {
    return REGIONAL_HEAD_MAP[region] || COMMERCIAL_DIRECTOR;
  }

  // Level 1–2: route to account owner
  if (ownerName) {
    const owner = OWNER_MAP[ownerName];
    if (owner) return owner;
  }

  // Fallback
  return COMMERCIAL_DIRECTOR;
}

// ============================================================
// TRIGGER RULE IDS — Extended
// ============================================================

export const TRIGGER_RULE_IDS = {
  CONTRACT_EXPIRED:    "tr-contract-expired",
  CONTRACT_EXPIRING:   "tr-contract-expiring",
  PAYMENT_BAD:         "tr-payment-bad",
  PAYMENT_DSO_HIGH:    "tr-payment-dso",
  MISSING_CONTRACT:    "tr-missing-contract",
  MISSING_WSO:         "tr-missing-wso",
  RENEWAL_STALLED:     "tr-renewal-stalled",
  RENEWAL_EXPIRED:     "tr-renewal-expired",
  CRM_ONGOING:         "tr-crm-ongoing",
  NOTES_RED_FLAG:      "tr-notes-red",
  STALLED_WORKSPACE:   "tr-stalled-workspace",
  CUSTOMER_GRADE_DROP: "tr-customer-grade",
} as const;

export type ExtendedTriggerType =
  | "contract_expired" | "contract_expiring"
  | "payment_bad" | "payment_dso"
  | "missing_document"
  | "renewal_stalled" | "renewal_expired"
  | "crm_ongoing"
  | "notes_red_flag"
  | "stalled_workspace"
  | "customer_grade_drop"
  // Legacy types from original engine
  | "margin_breach" | "delta_breach" | "stage_override" | "score_red" | "renewal_risk" | "crm_sync_failed";

// ============================================================
// DEDUP HELPER
// ============================================================

async function hasOpenEscalation(
  entityType: string,
  entityId: string,
  triggerType: string
): Promise<boolean> {
  const { data } = await supabase
    .from("escalation_events")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("trigger_type", triggerType)
    .in("status", ["open", "acknowledged"])
    .limit(1);

  return (data && data.length > 0) || false;
}

// ============================================================
// RENEWAL HELPERS (inline — avoid circular)
// ============================================================

function getBaseline(baselineId: string) {
  return contractBaselines.find(b => b.id === baselineId) || null;
}

function getDaysUntilExpiry(endDate: string): number {
  return Math.floor((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// NOTES RED FLAG KEYWORDS
// ============================================================

const NOTES_RED_FLAGS = [
  "not signed",
  "follow up",
  "billing stopped",
  "only po",
  "no confirmation",
  "need wso",
  "new rates",
  "payment issue",
  "contract pending",
  "unsigned",
  "overdue",
] as const;

// ============================================================
// TRIGGER 1: CONTRACT EXPIRY
// ============================================================

export async function checkContractExpiry(customer: Customer): Promise<EscalationEvent | null> {
  if (!customer.contractExpiry || customer.status === "Terminated" || customer.status === "Closed") return null;

  const expiry = new Date(customer.contractExpiry);
  const now = new Date();
  const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Already expired → Level 3
  if (daysLeft < 0) {
    if (await hasOpenEscalation("customer", customer.id, "contract_expired")) return null;

    const target = routeEscalation(3, customer.accountOwner, customer.region);
    return createEscalation({
      entityType: "customer",
      entityId: customer.id,
      workspaceId: null,
      severity: "red",
      ruleId: TRIGGER_RULE_IDS.CONTRACT_EXPIRED,
      triggerType: "contract_expired",
      triggerReason: `Contract for ${customer.name} expired ${Math.abs(daysLeft)} days ago (${customer.contractExpiry}). Immediate action required.`,
      assignedToId: target.id,
      assignedToName: target.name,
      metadata: {
        customerName: customer.name,
        contractExpiry: customer.contractExpiry,
        daysExpired: Math.abs(daysLeft),
        accountOwner: customer.accountOwner,
        region: customer.region,
        grade: customer.grade,
        level: 3,
      },
      taskTitle: `Resolve expired contract: ${customer.name}`,
      taskDescription: `Contract expired ${Math.abs(daysLeft)}d ago. Renew, renegotiate, or exit.`,
    });
  }

  // Expiring within 90 days → Level 2
  if (daysLeft <= 90) {
    if (await hasOpenEscalation("customer", customer.id, "contract_expiring")) return null;

    const level: EscalationLevel = daysLeft <= 30 ? 3 : 2;
    const target = routeEscalation(level, customer.accountOwner, customer.region);
    return createEscalation({
      entityType: "customer",
      entityId: customer.id,
      workspaceId: null,
      severity: levelToSeverity(level),
      ruleId: TRIGGER_RULE_IDS.CONTRACT_EXPIRING,
      triggerType: "contract_expiring",
      triggerReason: `Contract for ${customer.name} expires in ${daysLeft} days (${customer.contractExpiry}).${daysLeft <= 30 ? " URGENT — less than 30 days." : ""}`,
      assignedToId: target.id,
      assignedToName: target.name,
      metadata: {
        customerName: customer.name,
        contractExpiry: customer.contractExpiry,
        daysLeft,
        accountOwner: customer.accountOwner,
        region: customer.region,
        level,
      },
      taskTitle: `Contract expiring: ${customer.name} (${daysLeft}d)`,
      taskDescription: `Contract expires ${customer.contractExpiry}. Initiate renewal or renegotiation.`,
    });
  }

  return null;
}

// ============================================================
// TRIGGER 2: PAYMENT RISK
// ============================================================

export async function checkPaymentRisk(customer: Customer): Promise<EscalationEvent | null> {
  if (customer.status === "Terminated" || customer.status === "Closed") return null;

  // Bad payer → Level 3
  if (customer.paymentStatus === "Bad") {
    if (await hasOpenEscalation("customer", customer.id, "payment_bad")) return null;

    const target = routeEscalation(3, customer.accountOwner, customer.region);
    return createEscalation({
      entityType: "customer",
      entityId: customer.id,
      workspaceId: null,
      severity: "red",
      ruleId: TRIGGER_RULE_IDS.PAYMENT_BAD,
      triggerType: "payment_bad",
      triggerReason: `${customer.name} flagged as "Bad" payer. DSO: ${customer.dso} days. Revenue at risk: SAR ${(customer.contractValue2025 / 1_000_000).toFixed(1)}M.`,
      assignedToId: target.id,
      assignedToName: target.name,
      metadata: {
        customerName: customer.name,
        paymentStatus: customer.paymentStatus,
        dso: customer.dso,
        contractValue: customer.contractValue2025,
        accountOwner: customer.accountOwner,
        region: customer.region,
        grade: customer.grade,
        level: 3,
      },
      taskTitle: `Payment risk: ${customer.name}`,
      taskDescription: `Bad payer status with DSO of ${customer.dso}d. Review collection action.`,
    });
  }

  // High DSO (>60 days) → Level 2
  if (customer.dso > 60) {
    if (await hasOpenEscalation("customer", customer.id, "payment_dso")) return null;

    const level: EscalationLevel = customer.dso > 90 ? 3 : 2;
    const target = routeEscalation(level, customer.accountOwner, customer.region);
    return createEscalation({
      entityType: "customer",
      entityId: customer.id,
      workspaceId: null,
      severity: levelToSeverity(level),
      ruleId: TRIGGER_RULE_IDS.PAYMENT_DSO_HIGH,
      triggerType: "payment_dso",
      triggerReason: `${customer.name} DSO at ${customer.dso} days — exceeds 60-day threshold.${customer.dso > 90 ? " CRITICAL: >90 days." : ""}`,
      assignedToId: target.id,
      assignedToName: target.name,
      metadata: {
        customerName: customer.name,
        dso: customer.dso,
        paymentStatus: customer.paymentStatus,
        accountOwner: customer.accountOwner,
        region: customer.region,
        level,
      },
      taskTitle: `High DSO: ${customer.name} (${customer.dso}d)`,
      taskDescription: `Follow up on outstanding payments. DSO exceeds threshold.`,
    });
  }

  return null;
}

// ============================================================
// TRIGGER 3: MISSING DOCUMENTS (via workspace notes / stage)
// ============================================================

export async function checkMissingDocuments(
  workspace: Workspace,
  customer: Customer
): Promise<EscalationEvent | null> {
  // Only check workspaces past proposal stage
  const advancedStages = ["sla_drafting", "sla_submitted", "contract_sent", "commercial_approved", "go_live"];
  if (!advancedStages.includes(workspace.stage)) return null;

  const notesLower = (workspace.notes || "").toLowerCase();

  // Check for indicators of missing documents
  const missingIndicators = [
    notesLower.includes("need wso"),
    notesLower.includes("no confirmation"),
    notesLower.includes("not signed"),
    notesLower.includes("unsigned"),
    notesLower.includes("contract pending"),
  ];

  if (!missingIndicators.some(Boolean)) return null;

  if (await hasOpenEscalation("workspace", workspace.id, "missing_document")) return null;

  const target = routeEscalation(2, workspace.owner, workspace.region);
  return createEscalation({
    entityType: "workspace",
    entityId: workspace.id,
    workspaceId: workspace.id,
    severity: "amber",
    ruleId: TRIGGER_RULE_IDS.MISSING_CONTRACT,
    triggerType: "missing_document",
    triggerReason: `Workspace "${workspace.title}" at ${workspace.stage} stage but has missing document indicators. Notes contain red flags.`,
    assignedToId: target.id,
    assignedToName: target.name,
    metadata: {
      customerName: customer.name,
      workspaceTitle: workspace.title,
      stage: workspace.stage,
      accountOwner: workspace.owner,
      region: workspace.region,
      level: 2,
    },
    taskTitle: `Missing documents: ${workspace.title}`,
    taskDescription: `Ensure WSO/MSA/contract are complete before progressing.`,
  });
}

// ============================================================
// TRIGGER 4: RENEWAL STATUS
// ============================================================

export async function checkRenewalStatus(): Promise<EscalationEvent[]> {
  const results: EscalationEvent[] = [];

  for (const rw of renewalWorkspaces) {
    const baseline = getBaseline(rw.baselineId);
    if (!baseline) continue;

    const daysLeft = getDaysUntilExpiry(baseline.baselineEndDate);
    const isExpired = daysLeft < 0;

    // Expired renewal not locked → Level 3
    if (isExpired && rw.status !== "locked" && rw.status !== "rejected") {
      if (await hasOpenEscalation("renewal", rw.id, "renewal_expired")) continue;

      const target = routeEscalation(3, rw.ownerName, undefined);
      const event = await createEscalation({
        entityType: "renewal",
        entityId: rw.id,
        workspaceId: null,
        severity: "red",
        ruleId: TRIGGER_RULE_IDS.RENEWAL_EXPIRED,
        triggerType: "renewal_expired",
        triggerReason: `Renewal for ${rw.customerName} expired ${Math.abs(daysLeft)} days ago. Status: ${rw.status}. Decision: ${rw.renewalDecision}.`,
        assignedToId: target.id,
        assignedToName: target.name,
        metadata: {
          customerName: rw.customerName,
          renewalCycle: rw.renewalCycleName,
          daysExpired: Math.abs(daysLeft),
          status: rw.status,
          decision: rw.renewalDecision,
          owner: rw.ownerName,
          level: 3,
        },
        taskTitle: `Expired renewal: ${rw.customerName}`,
        taskDescription: `Renewal expired ${Math.abs(daysLeft)}d ago. Resolve strategy immediately.`,
      });
      if (event) results.push(event);
    }

    // Renewal pending decision with <90 days → Level 2
    if (!isExpired && daysLeft <= 90 && rw.renewalDecision === "pending" && rw.status === "draft") {
      if (await hasOpenEscalation("renewal", rw.id, "renewal_stalled")) continue;

      const level: EscalationLevel = daysLeft <= 30 ? 3 : 2;
      const target = routeEscalation(level, rw.ownerName, undefined);
      const event = await createEscalation({
        entityType: "renewal",
        entityId: rw.id,
        workspaceId: null,
        severity: levelToSeverity(level),
        ruleId: TRIGGER_RULE_IDS.RENEWAL_STALLED,
        triggerType: "renewal_stalled",
        triggerReason: `Renewal for ${rw.customerName} has no decision set. ${daysLeft} days to expiry.`,
        assignedToId: target.id,
        assignedToName: target.name,
        metadata: {
          customerName: rw.customerName,
          renewalCycle: rw.renewalCycleName,
          daysLeft,
          status: rw.status,
          decision: rw.renewalDecision,
          owner: rw.ownerName,
          level,
        },
        taskTitle: `Stalled renewal: ${rw.customerName}`,
        taskDescription: `No decision set with ${daysLeft}d to expiry. Define strategy.`,
      });
      if (event) results.push(event);
    }
  }

  return results;
}

// ============================================================
// TRIGGER 5: CRM STATUS STUCK
// ============================================================

export async function checkCRMStatus(workspace: Workspace): Promise<EscalationEvent | null> {
  // Only flag workspaces where CRM stage is still early but workspace is advanced
  if (!workspace.crmStage) return null;
  if (workspace.type === "tender") return null;

  const earlyStages = ["prospecting", "qualified"];
  const advancedWorkspaceStages = ["negotiation", "sla_drafting", "sla_submitted", "contract_sent", "commercial_approved", "go_live"];

  if (earlyStages.includes(workspace.crmStage) && advancedWorkspaceStages.includes(workspace.stage)) {
    if (await hasOpenEscalation("workspace", workspace.id, "crm_ongoing")) return null;

    const target = routeEscalation(1, workspace.owner, workspace.region);
    return createEscalation({
      entityType: "workspace",
      entityId: workspace.id,
      workspaceId: workspace.id,
      severity: "amber",
      ruleId: TRIGGER_RULE_IDS.CRM_ONGOING,
      triggerType: "crm_ongoing",
      triggerReason: `CRM stage "${workspace.crmStage}" is behind workspace stage "${workspace.stage}" for ${workspace.customerName}. CRM not updated.`,
      assignedToId: target.id,
      assignedToName: target.name,
      metadata: {
        customerName: workspace.customerName,
        workspaceTitle: workspace.title,
        crmStage: workspace.crmStage,
        workspaceStage: workspace.stage,
        owner: workspace.owner,
        level: 1,
      },
      taskTitle: `CRM mismatch: ${workspace.title}`,
      taskDescription: `Update CRM stage from "${workspace.crmStage}" to match "${workspace.stage}".`,
    });
  }

  return null;
}

// ============================================================
// TRIGGER 6: NOTES RED FLAGS
// ============================================================

export async function checkNotesSignals(
  workspace: Workspace,
  customer: Customer
): Promise<EscalationEvent | null> {
  const notesText = (workspace.notes || "").toLowerCase();
  if (!notesText) return null;

  const matched = NOTES_RED_FLAGS.filter(kw => notesText.includes(kw));
  if (matched.length === 0) return null;

  if (await hasOpenEscalation("workspace", workspace.id, "notes_red_flag")) return null;

  // Multiple flags → higher level
  const level: EscalationLevel = matched.length >= 3 ? 3 : matched.length >= 2 ? 2 : 1;
  const target = routeEscalation(level, workspace.owner, workspace.region);

  return createEscalation({
    entityType: "workspace",
    entityId: workspace.id,
    workspaceId: workspace.id,
    severity: levelToSeverity(level),
    ruleId: TRIGGER_RULE_IDS.NOTES_RED_FLAG,
    triggerType: "notes_red_flag",
    triggerReason: `Workspace "${workspace.title}" contains ${matched.length} red flag keyword(s): ${matched.map(k => `"${k}"`).join(", ")}.`,
    assignedToId: target.id,
    assignedToName: target.name,
    metadata: {
      customerName: customer.name,
      workspaceTitle: workspace.title,
      matchedKeywords: matched,
      notesSnippet: workspace.notes?.slice(0, 200),
      owner: workspace.owner,
      level,
    },
    taskTitle: `Notes alert: ${workspace.title}`,
    taskDescription: `Red flag keywords detected: ${matched.join(", ")}. Review and take action.`,
  });
}

// ============================================================
// TRIGGER 7: STALLED WORKSPACE
// ============================================================

export async function checkStalledWorkspace(workspace: Workspace): Promise<EscalationEvent | null> {
  if (workspace.type === "tender") return null;

  // Thresholds by stage (days)
  const stallThresholds: Record<string, number> = {
    qualified: 14,
    solution_design: 14,
    quoting: 10,
    proposal_active: 10,
    negotiation: 14,
    sla_drafting: 10,
    sla_submitted: 14,
    contract_sent: 14,
  };

  const threshold = stallThresholds[workspace.stage];
  if (!threshold || workspace.daysInStage < threshold) return null;

  if (await hasOpenEscalation("workspace", workspace.id, "stalled_workspace")) return null;

  const level: EscalationLevel = workspace.daysInStage > threshold * 2 ? 3 : 2;
  const target = routeEscalation(level, workspace.owner, workspace.region);

  return createEscalation({
    entityType: "workspace",
    entityId: workspace.id,
    workspaceId: workspace.id,
    severity: levelToSeverity(level),
    ruleId: TRIGGER_RULE_IDS.STALLED_WORKSPACE,
    triggerType: "stalled_workspace",
    triggerReason: `Workspace "${workspace.title}" has been in "${workspace.stage}" for ${workspace.daysInStage} days (threshold: ${threshold}d).`,
    assignedToId: target.id,
    assignedToName: target.name,
    metadata: {
      customerName: workspace.customerName,
      workspaceTitle: workspace.title,
      stage: workspace.stage,
      daysInStage: workspace.daysInStage,
      threshold,
      owner: workspace.owner,
      region: workspace.region,
      estimatedValue: workspace.estimatedValue,
      level,
    },
    taskTitle: `Stalled: ${workspace.title} (${workspace.daysInStage}d)`,
    taskDescription: `${workspace.daysInStage}d in "${workspace.stage}" — exceeds ${threshold}d threshold. Progress or close.`,
  });
}

// ============================================================
// TRIGGER 8: CUSTOMER HEALTH (Grade Drop)
// ============================================================

export async function checkCustomerHealth(customer: Customer): Promise<EscalationEvent | null> {
  if (customer.status === "Terminated" || customer.status === "Closed") return null;

  const redGrades = ["D", "F"];
  if (!redGrades.includes(customer.grade)) return null;

  if (await hasOpenEscalation("customer", customer.id, "customer_grade_drop")) return null;

  const level: EscalationLevel = customer.grade === "F" ? 4 : 3;
  const target = routeEscalation(level, customer.accountOwner, customer.region);

  return createEscalation({
    entityType: "customer",
    entityId: customer.id,
    workspaceId: null,
    severity: "red",
    ruleId: TRIGGER_RULE_IDS.CUSTOMER_GRADE_DROP,
    triggerType: "customer_grade_drop",
    triggerReason: `${customer.name} ECR grade is ${customer.grade}.${customer.grade === "F" ? " CRITICAL — portfolio exit assessment required." : " Review and define action plan."}`,
    assignedToId: target.id,
    assignedToName: target.name,
    metadata: {
      customerName: customer.name,
      grade: customer.grade,
      paymentStatus: customer.paymentStatus,
      dso: customer.dso,
      contractValue: customer.contractValue2025,
      contractExpiry: customer.contractExpiry,
      accountOwner: customer.accountOwner,
      region: customer.region,
      level,
    },
    taskTitle: `Customer health: ${customer.name} (Grade ${customer.grade})`,
    taskDescription: `ECR grade ${customer.grade}. Assess risk and determine action plan.`,
  });
}

// ============================================================
// BATCH EVALUATION — Run all triggers across portfolio
// ============================================================

export interface BatchEvaluationResult {
  newEvents: EscalationEvent[];
  customersChecked: number;
  workspacesChecked: number;
  renewalsChecked: number;
  triggersFound: number;
}

/**
 * Run all escalation triggers across all customers, workspaces, and renewals.
 * This is the global sweep function — call on dashboard load or scheduled interval.
 * Dedup ensures no duplicate open events are created.
 */
export async function runGlobalEscalationSweep(): Promise<BatchEvaluationResult> {
  const newEvents: EscalationEvent[] = [];

  // 1. Customer-level triggers
  for (const customer of customers) {
    const expiryEvent = await checkContractExpiry(customer);
    if (expiryEvent) newEvents.push(expiryEvent);

    const paymentEvent = await checkPaymentRisk(customer);
    if (paymentEvent) newEvents.push(paymentEvent);

    const healthEvent = await checkCustomerHealth(customer);
    if (healthEvent) newEvents.push(healthEvent);
  }

  // 2. Workspace-level triggers
  const commercialWorkspaces = workspaces.filter(w => w.type !== "tender");
  for (const ws of commercialWorkspaces) {
    const customer = customers.find(c => c.id === ws.customerId);
    if (!customer) continue;

    const stalledEvent = await checkStalledWorkspace(ws);
    if (stalledEvent) newEvents.push(stalledEvent);

    const docsEvent = await checkMissingDocuments(ws, customer);
    if (docsEvent) newEvents.push(docsEvent);

    const crmEvent = await checkCRMStatus(ws);
    if (crmEvent) newEvents.push(crmEvent);

    const notesEvent = await checkNotesSignals(ws, customer);
    if (notesEvent) newEvents.push(notesEvent);
  }

  // 3. Renewal-level triggers
  const renewalEvents = await checkRenewalStatus();
  newEvents.push(...renewalEvents);

  return {
    newEvents,
    customersChecked: customers.length,
    workspacesChecked: commercialWorkspaces.length,
    renewalsChecked: renewalWorkspaces.length,
    triggersFound: newEvents.length,
  };
}

// ============================================================
// PHASE 2 PREPARATION — Proactive Signal Stubs
// ============================================================

/**
 * STUB: Volume drop detection
 * Will compare current pallet occupied vs contracted to detect utilization drops.
 * Not implemented — structured for future use.
 */
export async function checkVolumeDropSignal(_customer: Customer): Promise<EscalationEvent | null> {
  // Future: compare palletOccupied / palletContracted ratio over time
  // Trigger if ratio drops below 60% for 2 consecutive months
  return null;
}

/**
 * STUB: Complaint ingestion
 * Will read from complaint/ticket system when integrated.
 */
export async function checkComplaintSignal(_customer: Customer, _complaintCount?: number): Promise<EscalationEvent | null> {
  // Future: trigger if complaints > threshold in rolling 30d window
  return null;
}

/**
 * STUB: Utilization mismatch
 * Will compare contracted vs actual utilization.
 */
export async function checkUtilizationMismatch(_customer: Customer): Promise<EscalationEvent | null> {
  // Future: flag if actual << contracted (under-utilization) or actual >> contracted (over-utilization)
  return null;
}

/**
 * STUB: Financial deviation
 * Will compare actual revenue vs expected monthly revenue.
 */
export async function checkFinancialDeviation(_customer: Customer): Promise<EscalationEvent | null> {
  // Future: flag if actual monthly revenue < 70% of expected for 2+ months
  return null;
}

// ============================================================
// TRIGGER TYPE LABELS — Extended
// ============================================================

export function getExtendedTriggerLabel(type: string): string {
  const labels: Record<string, string> = {
    // New triggers
    contract_expired: "Contract Expired",
    contract_expiring: "Contract Expiring",
    payment_bad: "Bad Payer",
    payment_dso: "High DSO",
    missing_document: "Missing Document",
    renewal_stalled: "Renewal Stalled",
    renewal_expired: "Renewal Expired",
    crm_ongoing: "CRM Mismatch",
    notes_red_flag: "Notes Red Flag",
    stalled_workspace: "Stalled Workspace",
    customer_grade_drop: "Customer Grade Drop",
    // Legacy triggers
    margin_breach: "Margin Breach",
    delta_breach: "SLA/P&L Delta Breach",
    stage_override: "Stage Override",
    score_red: "Customer Score Red",
    renewal_risk: "Renewal Risk",
    crm_sync_failed: "CRM Sync Failed",
  };
  return labels[type] || type;
}

/**
 * Get the escalation level from event metadata.
 * Falls back to severity-based detection if metadata doesn't include level.
 */
export function getEventLevel(event: EscalationEvent): EscalationLevel {
  if (event.metadata?.level) return event.metadata.level as EscalationLevel;
  return event.severity === "red" ? 3 : 1;
}
