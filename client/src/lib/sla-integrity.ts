/**
 * SLA Integrity Guard — Commercial Risk Control
 * Sprint 6 — Deterministic. No AI. Human judgment remains sovereign.
 *
 * Responsibilities:
 *   1. isPricingLocked()        — stage-based pricing lock detection
 *   2. Pricing field guards     — selling-rate field identification + lock enforcement
 *   3. Cost field guards        — role-based cost edit prevention
 *   4. SLA Verification         — checklist model + completion check
 *   5. SLA vs P&L delta         — deterministic deviation computation
 *   6. Override audit helpers   — structured audit log entries for overrides
 */

import { nanoid } from "nanoid";
import type { Workspace, WorkspaceStage, UserRole, PnLModel, Quote } from "./store";
import { getCurrentUser } from "./auth-state";
import { STAGE_ORDER, getStageIndex, getStageDisplayName } from "./stage-transition";
import { syncAuditEntry } from "./supabase-sync";
import { supabase } from "./supabase";
import { handleSupabaseError } from "./supabase-error";

// ============================================================
// 1. PRICING LOCK — Stage Threshold
// ============================================================

/**
 * The stage at which pricing becomes locked.
 * At or beyond this stage, selling rates and commercial terms
 * cannot be edited without an Admin override.
 */
export const PRICING_LOCK_STAGE: WorkspaceStage = "sla_drafting";
const PRICING_LOCK_INDEX = getStageIndex(PRICING_LOCK_STAGE);

/**
 * Returns true when the workspace stage is at or beyond the pricing lock threshold.
 * Tender workspaces are excluded from pricing lock (they have their own governance).
 */
export function isPricingLocked(workspace: Workspace): boolean {
  if (workspace.type === "tender") return false;
  const idx = getStageIndex(workspace.stage);
  if (idx === -1) return false; // stage not in controlled sequence
  return idx >= PRICING_LOCK_INDEX;
}

/**
 * Human-readable explanation of why pricing is locked.
 */
export function getPricingLockReason(workspace: Workspace): string {
  if (!isPricingLocked(workspace)) return "";
  return `Pricing is locked because the workspace is at "${getStageDisplayName(workspace.stage)}" stage (lock threshold: ${getStageDisplayName(PRICING_LOCK_STAGE)}).`;
}

// ============================================================
// 2. PRICING FIELD DEFINITIONS
// ============================================================

/** Selling-rate fields that are locked when pricing is locked */
export const SELLING_RATE_FIELDS = [
  "storageRate",
  "inboundRate",
  "outboundRate",
] as const;

/** Commercial term fields that are locked when pricing is locked */
export const COMMERCIAL_TERM_FIELDS = [
  "palletVolume",
  "vasRevenue",
  "monthlyRevenue",
  "annualRevenue",
] as const;

/** All fields locked under pricing lock */
export const PRICING_LOCKED_FIELDS = [
  ...SELLING_RATE_FIELDS,
  ...COMMERCIAL_TERM_FIELDS,
] as const;

export type PricingLockedField = typeof PRICING_LOCKED_FIELDS[number];

/**
 * Check if a specific field is locked for a workspace.
 */
export function isFieldLocked(workspace: Workspace, field: string): boolean {
  if (!isPricingLocked(workspace)) return false;
  return (PRICING_LOCKED_FIELDS as readonly string[]).includes(field);
}

// ============================================================
// 3. COST FIELD GUARDS — Role-Based
// ============================================================

/** Cost fields in PnLModel that Sales cannot edit */
export const COST_FIELDS = [
  "facilityCost",
  "staffCost",
  "mheCost",
  "insuranceCost",
  "operationalCost",
  "gaPercent",
  "gaCost",
  "totalOpex",
] as const;

export type CostField = typeof COST_FIELDS[number];

/** Roles allowed to edit cost fields */
export const COST_EDIT_ROLES: UserRole[] = [
  "regional_ops_head",
  "director",
  "ceo_cfo",
  "admin",
];

/** Roles blocked from editing cost fields */
export const COST_BLOCKED_ROLES: UserRole[] = [
  "salesman",
  "regional_sales_head",
];

/**
 * Returns true if the given role can edit cost fields.
 */
export function canEditCosts(role: UserRole): boolean {
  return COST_EDIT_ROLES.includes(role);
}

/**
 * Returns true if a specific field is a cost field.
 */
export function isCostField(field: string): boolean {
  return (COST_FIELDS as readonly string[]).includes(field);
}

// ============================================================
// 4. SLA VERIFICATION CHECKLIST
// ============================================================

export interface SlaChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface SlaVerificationChecklist {
  id: string;
  workspaceId: string;
  items: SlaChecklistItem[];
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  updatedAt: string;
  createdAt: string;
}

/** Default checklist items for SLA verification */
export const DEFAULT_CHECKLIST_ITEMS: Omit<SlaChecklistItem, "id">[] = [
  { label: "Pricing matches approved P&L", checked: false },
  { label: "SLA scope items confirmed", checked: false },
  { label: "Lanes/locations confirmed", checked: false },
  { label: "Ops feasibility confirmed", checked: false },
  { label: "Legal review completed (optional)", checked: false },
];

/**
 * Create a new default checklist for a workspace.
 */
export function createDefaultChecklist(workspaceId: string): SlaVerificationChecklist {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    workspaceId,
    items: DEFAULT_CHECKLIST_ITEMS.map(item => ({
      ...item,
      id: nanoid(),
    })),
    completed: false,
    updatedAt: now,
    createdAt: now,
  };
}

/**
 * Check if all required items are checked (optional items excluded from gate).
 * Items with "(optional)" in the label are not required for completion.
 */
export function isChecklistComplete(checklist: SlaVerificationChecklist): boolean {
  const requiredItems = checklist.items.filter(
    item => !item.label.toLowerCase().includes("(optional)")
  );
  return requiredItems.every(item => item.checked);
}

/**
 * Stages that require the SLA verification checklist to be completed before advancing.
 * The checklist gates advancement FROM these stages.
 */
export const CHECKLIST_GATED_STAGES: WorkspaceStage[] = [
  "sla_drafting",    // must complete before moving to contract_ready
];

/**
 * Check if the checklist gates the current stage transition.
 */
export function isChecklistGated(fromStage: WorkspaceStage): boolean {
  return CHECKLIST_GATED_STAGES.includes(fromStage);
}

// ============================================================
// 5. SLA vs P&L DELTA COMPUTATION
// ============================================================

export interface DeltaItem {
  field: string;
  label: string;
  slaValue: number;
  pnlValue: number;
  delta: number;        // absolute difference
  deltaPercent: number;  // percentage difference
  severity: "ok" | "warning" | "critical";
}

export interface DeltaReport {
  workspaceId: string;
  hasDelta: boolean;
  hasBlockingDelta: boolean;
  items: DeltaItem[];
  summary: string;
}

/** Thresholds for delta warnings */
export const DELTA_THRESHOLDS = {
  /** GP% deviation that triggers a warning */
  gpPercentWarning: 3,    // 3 percentage points
  /** GP% deviation that triggers a block */
  gpPercentCritical: 5,   // 5 percentage points
  /** Revenue deviation percentage that triggers a warning */
  revenueWarning: 10,     // 10%
  /** Revenue deviation percentage that triggers a block */
  revenueCritical: 20,    // 20%
  /** Cost deviation percentage that triggers a warning */
  costWarning: 10,        // 10%
  /** Cost deviation percentage that triggers a block */
  costCritical: 20,       // 20%
};

/**
 * Compute delta between current workspace/quote values and the approved P&L baseline.
 * Returns a deterministic report — no AI involved.
 */
export function computeSlaVsPnlDelta(
  workspace: Workspace,
  quote: Quote | null,
  pnl: PnLModel | null,
): DeltaReport {
  const report: DeltaReport = {
    workspaceId: workspace.id,
    hasDelta: false,
    hasBlockingDelta: false,
    items: [],
    summary: "",
  };

  if (!pnl) {
    report.summary = "No P&L model found for this workspace. Delta check skipped.";
    return report;
  }

  if (!quote) {
    report.summary = "No quote found for this workspace. Delta check skipped.";
    return report;
  }

  // Compare GP%
  const gpDelta = Math.abs(quote.gpPercent - pnl.gpPercent);
  const gpSeverity = gpDelta >= DELTA_THRESHOLDS.gpPercentCritical
    ? "critical"
    : gpDelta >= DELTA_THRESHOLDS.gpPercentWarning
      ? "warning"
      : "ok";
  report.items.push({
    field: "gpPercent",
    label: "Gross Profit %",
    slaValue: quote.gpPercent,
    pnlValue: pnl.gpPercent,
    delta: gpDelta,
    deltaPercent: gpDelta, // already in percentage points
    severity: gpSeverity,
  });

  // Compare Annual Revenue
  if (pnl.annualRevenue > 0) {
    const revDelta = Math.abs(quote.annualRevenue - pnl.annualRevenue);
    const revDeltaPct = (revDelta / pnl.annualRevenue) * 100;
    const revSeverity = revDeltaPct >= DELTA_THRESHOLDS.revenueCritical
      ? "critical"
      : revDeltaPct >= DELTA_THRESHOLDS.revenueWarning
        ? "warning"
        : "ok";
    report.items.push({
      field: "annualRevenue",
      label: "Annual Revenue",
      slaValue: quote.annualRevenue,
      pnlValue: pnl.annualRevenue,
      delta: revDelta,
      deltaPercent: revDeltaPct,
      severity: revSeverity,
    });
  }

  // Compare Total Cost
  if (pnl.totalOpex > 0) {
    const costDelta = Math.abs(quote.totalCost - pnl.totalOpex);
    const costDeltaPct = (costDelta / pnl.totalOpex) * 100;
    const costSeverity = costDeltaPct >= DELTA_THRESHOLDS.costCritical
      ? "critical"
      : costDeltaPct >= DELTA_THRESHOLDS.costWarning
        ? "warning"
        : "ok";
    report.items.push({
      field: "totalCost",
      label: "Total Cost (OPEX)",
      slaValue: quote.totalCost,
      pnlValue: pnl.totalOpex,
      delta: costDelta,
      deltaPercent: costDeltaPct,
      severity: costSeverity,
    });
  }

  report.hasDelta = report.items.some(i => i.severity !== "ok");
  report.hasBlockingDelta = report.items.some(i => i.severity === "critical");

  if (report.hasBlockingDelta) {
    const criticals = report.items.filter(i => i.severity === "critical");
    report.summary = `CRITICAL: ${criticals.map(c => c.label).join(", ")} deviate significantly from approved P&L. Stage advancement blocked unless Admin override.`;
  } else if (report.hasDelta) {
    const warnings = report.items.filter(i => i.severity === "warning");
    report.summary = `WARNING: ${warnings.map(w => w.label).join(", ")} show deviation from approved P&L. Review recommended.`;
  } else {
    report.summary = "All values within acceptable thresholds vs approved P&L.";
  }

  return report;
}

// ============================================================
// 6. OVERRIDE AUDIT HELPERS
// ============================================================

export type OverrideAction =
  | "pricing_lock_override"
  | "cost_edit_override"
  | "checklist_override"
  | "delta_gate_override";

export interface OverrideAuditPayload {
  action: OverrideAction;
  entityType: "workspace" | "quote" | "sla" | "pnl";
  entityId: string;
  workspaceId: string;
  field?: string;
  oldValue?: string | number;
  newValue?: string | number;
  reason: string;
  workspaceStage: WorkspaceStage;
}

/**
 * Log an override action to the audit trail.
 * Writes to both in-memory audit log and Supabase.
 */
export async function logOverrideAudit(payload: OverrideAuditPayload): Promise<void> {
  const user = getCurrentUser();
  const entry = {
    id: `sla-ov-${nanoid()}`,
    entityType: payload.entityType,
    entityId: payload.entityId,
    action: payload.action,
    userId: user.id,
    userName: user.name,
    timestamp: new Date().toISOString(),
    details: `[SLA Integrity Override] ${payload.action}: ${payload.reason}. Workspace: ${payload.workspaceId}, Stage: ${getStageDisplayName(payload.workspaceStage)}${payload.field ? `, Field: ${payload.field}` : ""}${payload.oldValue !== undefined ? `, Old: ${payload.oldValue}` : ""}${payload.newValue !== undefined ? `, New: ${payload.newValue}` : ""}`,
  };

  // Sync to Supabase
  await syncAuditEntry(entry);
}

/**
 * Validate override reason — must be at least 10 characters.
 */
export function isValidOverrideReason(reason: string): boolean {
  return reason.trim().length >= 10;
}

/**
 * Roles that can perform pricing lock overrides.
 */
export const PRICING_OVERRIDE_ROLES: UserRole[] = ["admin"];

/**
 * Roles that can override the SLA verification checklist gate.
 */
export const CHECKLIST_OVERRIDE_ROLES: UserRole[] = ["admin"];

/**
 * Roles that can override the SLA vs P&L delta gate.
 */
export const DELTA_OVERRIDE_ROLES: UserRole[] = ["admin"];

/**
 * Check if the current user can perform a pricing lock override.
 */
export function canOverridePricingLock(role: UserRole): boolean {
  return PRICING_OVERRIDE_ROLES.includes(role);
}

/**
 * Check if the current user can override the checklist gate.
 */
export function canOverrideChecklist(role: UserRole): boolean {
  return CHECKLIST_OVERRIDE_ROLES.includes(role);
}

/**
 * Check if the current user can override the delta gate.
 */
export function canOverrideDeltaGate(role: UserRole): boolean {
  return DELTA_OVERRIDE_ROLES.includes(role);
}

// ============================================================
// 7. SUPABASE PERSISTENCE — SLA Verification Checklists
// ============================================================

/**
 * Fetch the SLA verification checklist for a workspace.
 */
export async function fetchSlaChecklist(workspaceId: string): Promise<SlaVerificationChecklist | null> {
  const { data, error } = await supabase
    .from("sla_verification_checklists")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    items: data.items || [],
    completed: data.completed,
    completedBy: data.completed_by,
    completedAt: data.completed_at,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
  };
}

/**
 * Upsert the SLA verification checklist for a workspace.
 */
export async function upsertSlaChecklist(checklist: SlaVerificationChecklist): Promise<boolean> {
  const row = {
    id: checklist.id,
    workspace_id: checklist.workspaceId,
    items: checklist.items,
    completed: checklist.completed,
    completed_by: checklist.completedBy || null,
    completed_at: checklist.completedAt || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("sla_verification_checklists")
    .upsert(row, { onConflict: "id" });

  if (error) {
    handleSupabaseError("upsertSlaChecklist", error, { entityId: checklist.id });
    return false;
  }
  return true;
}
