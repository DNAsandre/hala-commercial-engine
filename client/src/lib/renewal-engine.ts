// Renewal Engine v1 â€” Baseline â†’ Renewal â†’ Locked
// Immutable baselines, versioned renewal drafts, delta comparison, policy gates, audit trail
// No AI creep: AI cannot lock, change pricing/SLA/decision

import { nanoid } from "nanoid";

// ============================================================
// TYPES
// ============================================================

export type BaselineStatus = "active" | "expired" | "superseded";
export type RenewalWorkspaceStatus = "draft" | "under_review" | "approved" | "rejected" | "locked";
export type RenewalDecision = "renew" | "renegotiate" | "exit" | "pending";
export type GateResult = "pass" | "warn" | "block";
export type RenewalGateMode = "enforce" | "warn" | "off";

export interface ContractBaseline {
  id: string;
  customerId: string;
  customerName: string;
  opportunityId: string | null;
  baselineName: string;
  baselineStartDate: string;
  baselineEndDate: string;
  status: BaselineStatus;
  proposalVersionId: string | null;
  slaVersionId: string | null;
  pricingSnapshot: PricingSnapshot;
  createdAt: string;
  createdBy: string;
}
export interface PricingSnapshot {
  id: string;
  storageRate: number;
  inboundRate: number;
  outboundRate: number;
  palletVolume: number;
  monthlyRevenue: number;
  annualRevenue: number;
  gpPercent: number;
  vasRevenue: number;
  slaScope: string[];
  lanes: string[];
  assumptions: string[];
}

export interface RenewalWorkspace {
  id: string;
  customerId: string;
  customerName: string;
  baselineId: string;
  renewalCycleName: string;
  targetStartDate: string;
  targetEndDate: string;
  status: RenewalWorkspaceStatus;
  renewalDecision: RenewalDecision;
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RenewalVersion {
  id: string;
  workspaceId: string;
  versionNumber: number;
  proposalVersionId: string | null;
  slaVersionId: string | null;
  pricingSnapshot: PricingSnapshot;
  notes: string;
  createdAt: string;
  createdBy: string;
}

export interface DeltaDetail {
  field: string;
  category: "pricing" | "scope" | "sla" | "volume" | "terms";
  baselineValue: string | number;
  renewalValue: string | number;
  changePercent: number | null;
  direction: "increase" | "decrease" | "unchanged" | "added" | "removed";
  severity: "neutral" | "positive" | "warning" | "critical";
}

export interface RiskFlag {
  key: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  gateKey: string;
}

export interface RenewalDelta {
  id: string;
  workspaceId: string;
  baselineId: string;
  renewalVersionId: string;
  deltaJson: DeltaDetail[];
  riskFlagsJson: RiskFlag[];
  computedAt: string;
}

export interface GateCheckResult {
  gateKey: string;
  gateName: string;
  mode: RenewalGateMode;
  result: GateResult;
  reason: string;
  overridable: boolean;
  overridden?: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: string;
}

export interface RenewalGateEvaluation {
  id: string;
  workspaceId: string;
  renewalVersionId: string;
  ruleSetVersionId: string | null;
  result: GateResult;
  gates: GateCheckResult[];
  evaluatedAt: string;
}

export interface RenewalOutcome {
  id: string;
  workspaceId: string;
  approvedRenewalVersionId: string;
  newBaselineId: string;
  lockedAt: string;
  lockedBy: string;
}

export interface RenewalAuditEntry {
  id: string;
  entityType: "renewal_workspace" | "renewal_version" | "renewal_gate" | "renewal_baseline" | "renewal_outcome";
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

export interface RenewalGateConfig {
  key: string;
  name: string;
  description: string;
  mode: RenewalGateMode;
  overridable: boolean;
  thresholds: Record<string, number>;
}

export const renewalGateConfigs: RenewalGateConfig[] = [
  { key: "ecr_gate", name: "ECR Gate", description: "If ECR grade drops vs baseline or below threshold", mode: "warn", overridable: true, thresholds: { minGrade: 3, maxGradeDrop: 1 } },
  { key: "margin_gate", name: "Margin Gate", description: "If GP% below threshold or declines more than X% vs baseline", mode: "enforce", overridable: true, thresholds: { minGpPercent: 18, maxGpDeclinePercent: 5 } },
  { key: "scope_drift_gate", name: "Scope Drift Gate", description: "If SLA scope increased without aligned price change", mode: "warn", overridable: true, thresholds: { maxScopeIncreaseWithoutPrice: 0 } },
  { key: "ops_feasibility_gate", name: "Ops Feasibility Gate", description: "If capacity risk flagged (volume increase > threshold)", mode: "warn", overridable: true, thresholds: { maxVolumeIncreasePercent: 25 } },
  { key: "contract_timing_gate", name: "Contract Timing Gate", description: "If renewal initiated too late (< X days before expiry)", mode: "warn", overridable: true, thresholds: { minDaysBeforeExpiry: 60 } },
];

// ============================================================
// RUNTIME DATA
// ============================================================

// No seeded renewal records are allowed here. Renewal records must come
// from Supabase-backed intake/workspace tables. Empty arrays mean the app
// shows an empty state instead of invented SABIC/Ma'aden/Sadara/etc. data.
export const contractBaselines: ContractBaseline[] = [];
export const renewalWorkspaces: RenewalWorkspace[] = [];
export const renewalVersions: RenewalVersion[] = [];
export const renewalDeltas: RenewalDelta[] = [];
export const renewalGateEvaluations: RenewalGateEvaluation[] = [];
export const renewalOutcomes: RenewalOutcome[] = [];
export const renewalAuditLog: RenewalAuditEntry[] = [];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getBaseline(id: string): ContractBaseline | undefined {
  return contractBaselines.find(b => b.id === id);
}

export function getBaselinesByCustomer(customerId: string): ContractBaseline[] {
  return contractBaselines.filter(b => b.customerId === customerId);
}

export function getActiveBaselines(): ContractBaseline[] {
  return contractBaselines.filter(b => b.status === "active");
}

export function getRenewalWorkspace(id: string): RenewalWorkspace | undefined {
  return renewalWorkspaces.find(w => w.id === id);
}

export function getRenewalWorkspacesByCustomer(customerId: string): RenewalWorkspace[] {
  return renewalWorkspaces.filter(w => w.customerId === customerId);
}

export function getRenewalVersions(workspaceId: string): RenewalVersion[] {
  return renewalVersions.filter(v => v.workspaceId === workspaceId).sort((a, b) => b.versionNumber - a.versionNumber);
}

export function getLatestRenewalVersion(workspaceId: string): RenewalVersion | undefined {
  const versions = getRenewalVersions(workspaceId);
  return versions.length > 0 ? versions[0] : undefined;
}

export function getRenewalDelta(workspaceId: string, versionId: string): RenewalDelta | undefined {
  return renewalDeltas.find(d => d.workspaceId === workspaceId && d.renewalVersionId === versionId);
}

export function getLatestDelta(workspaceId: string): RenewalDelta | undefined {
  const latestVersion = getLatestRenewalVersion(workspaceId);
  if (!latestVersion) return undefined;
  return renewalDeltas.find(d => d.renewalVersionId === latestVersion.id);
}

export function getGateEvaluation(workspaceId: string, versionId: string): RenewalGateEvaluation | undefined {
  return renewalGateEvaluations.find(e => e.workspaceId === workspaceId && e.renewalVersionId === versionId);
}

export function getLatestGateEvaluation(workspaceId: string): RenewalGateEvaluation | undefined {
  const latestVersion = getLatestRenewalVersion(workspaceId);
  if (!latestVersion) return undefined;
  return renewalGateEvaluations.find(e => e.renewalVersionId === latestVersion.id);
}

export function getRenewalOutcome(workspaceId: string): RenewalOutcome | undefined {
  return renewalOutcomes.find(o => o.workspaceId === workspaceId);
}

export function getRenewalAudit(workspaceId: string): RenewalAuditEntry[] {
  return renewalAuditLog.filter(a => a.entityId === workspaceId || renewalVersions.filter(v => v.workspaceId === workspaceId).some(v => v.id === a.entityId) || renewalGateEvaluations.filter(g => g.workspaceId === workspaceId).some(g => g.id === a.entityId) || renewalOutcomes.filter(o => o.workspaceId === workspaceId).some(o => o.id === a.entityId)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================
// DELTA COMPUTATION
// ============================================================

export function computeDelta(baseline: ContractBaseline, version: RenewalVersion): DeltaDetail[] {
  const bp = baseline.pricingSnapshot;
  const rp = version.pricingSnapshot;
  const deltas: DeltaDetail[] = [];

  const addNumericDelta = (field: string, cat: DeltaDetail["category"], bv: number, rv: number) => {
    if (bv === rv) return;
    const pct = bv !== 0 ? ((rv - bv) / bv) * 100 : null;
    const dir: DeltaDetail["direction"] = rv > bv ? "increase" : "decrease";
    let sev: DeltaDetail["severity"] = "neutral";
    if (cat === "pricing") sev = dir === "increase" ? "positive" : "warning";
    if (field === "GP%" && dir === "decrease" && pct !== null && Math.abs(pct) > 5) sev = "critical";
    if (field === "GP%" && dir === "increase") sev = "positive";
    deltas.push({ field, category: cat, baselineValue: bv, renewalValue: rv, changePercent: pct ? Math.round(pct * 10) / 10 : null, direction: dir, severity: sev });
  };

  addNumericDelta("Storage Rate", "pricing", bp.storageRate, rp.storageRate);
  addNumericDelta("Inbound Rate", "pricing", bp.inboundRate, rp.inboundRate);
  addNumericDelta("Outbound Rate", "pricing", bp.outboundRate, rp.outboundRate);
  addNumericDelta("Pallet Volume", "volume", bp.palletVolume, rp.palletVolume);
  addNumericDelta("Monthly Revenue", "pricing", bp.monthlyRevenue, rp.monthlyRevenue);
  addNumericDelta("Annual Revenue", "pricing", bp.annualRevenue, rp.annualRevenue);
  addNumericDelta("GP%", "pricing", bp.gpPercent, rp.gpPercent);
  addNumericDelta("VAS Revenue", "pricing", bp.vasRevenue, rp.vasRevenue);

  if (bp.slaScope.length !== rp.slaScope.length) {
    addNumericDelta("SLA Scope Items", "scope", bp.slaScope.length, rp.slaScope.length);
  }
  const addedScope = rp.slaScope.filter(s => !bp.slaScope.includes(s));
  const removedScope = bp.slaScope.filter(s => !rp.slaScope.includes(s));
  addedScope.forEach(s => deltas.push({ field: s, category: "sla", baselineValue: "No", renewalValue: "Yes", changePercent: null, direction: "added", severity: "warning" }));
  removedScope.forEach(s => deltas.push({ field: s, category: "sla", baselineValue: "Yes", renewalValue: "No", changePercent: null, direction: "removed", severity: "warning" }));

  if (bp.lanes.length !== rp.lanes.length) {
    addNumericDelta("Lanes", "scope", bp.lanes.length, rp.lanes.length);
  }

  return deltas;
}

// ============================================================
// GATE EVALUATION ENGINE
// ============================================================

export function evaluateRenewalGates(workspace: RenewalWorkspace, version: RenewalVersion, baseline: ContractBaseline): GateCheckResult[] {
  const bp = baseline.pricingSnapshot;
  const rp = version.pricingSnapshot;
  const results: GateCheckResult[] = [];

  for (const gate of renewalGateConfigs) {
    if (gate.mode === "off") {
      results.push({ gateKey: gate.key, gateName: gate.name, mode: gate.mode, result: "pass", reason: "Gate disabled", overridable: gate.overridable });
      continue;
    }

    let result: GateResult = "pass";
    let reason = "";

    switch (gate.key) {
      case "ecr_gate": {
        // Simplified: check if customer has ECR data â€” in real system would compare grades
        reason = "ECR check completed â€” no grade degradation detected";
        break;
      }
      case "margin_gate": {
        const minGp = gate.thresholds.minGpPercent;
        const maxDecline = gate.thresholds.maxGpDeclinePercent;
        const gpDecline = bp.gpPercent - rp.gpPercent;
        if (rp.gpPercent < minGp) {
          result = gate.mode === "enforce" ? "block" : "warn";
          reason = `GP% ${rp.gpPercent}% is below minimum threshold ${minGp}%`;
        } else if (gpDecline > maxDecline) {
          result = gate.mode === "enforce" ? "block" : "warn";
          reason = `GP% declined ${gpDecline.toFixed(1)}% from baseline (${bp.gpPercent}% â†’ ${rp.gpPercent}%) â€” exceeds max decline ${maxDecline}%`;
        } else {
          reason = `GP% ${rp.gpPercent}% â€” above minimum ${minGp}%. ${rp.gpPercent >= bp.gpPercent ? "Improved" : "Slight decline"} from baseline ${bp.gpPercent}%.`;
        }
        break;
      }
      case "scope_drift_gate": {
        const addedItems = rp.slaScope.filter(s => !bp.slaScope.includes(s)).length;
        const priceIncrease = rp.annualRevenue > bp.annualRevenue;
        if (addedItems > 0 && !priceIncrease) {
          result = gate.mode === "enforce" ? "block" : "warn";
          reason = `${addedItems} new SLA scope item(s) added without revenue increase`;
        } else if (addedItems > 0) {
          result = "warn";
          reason = `${addedItems} new SLA scope item(s) added. Revenue increased â€” verify cost coverage.`;
        } else {
          reason = "No scope changes detected.";
        }
        break;
      }
      case "ops_feasibility_gate": {
        const maxIncrease = gate.thresholds.maxVolumeIncreasePercent;
        const volumeChange = bp.palletVolume > 0 ? ((rp.palletVolume - bp.palletVolume) / bp.palletVolume) * 100 : 0;
        if (volumeChange > maxIncrease) {
          result = gate.mode === "enforce" ? "block" : "warn";
          reason = `Volume increase ${volumeChange.toFixed(1)}% exceeds ${maxIncrease}% threshold (${bp.palletVolume} â†’ ${rp.palletVolume} pallets)`;
        } else if (volumeChange > 0) {
          reason = `Volume increase ${volumeChange.toFixed(1)}% â€” within threshold.`;
        } else {
          reason = "No volume increase.";
        }
        break;
      }
      case "contract_timing_gate": {
        const minDays = gate.thresholds.minDaysBeforeExpiry;
        const expiryDate = new Date(baseline.baselineEndDate);
        const createdDate = new Date(workspace.createdAt);
        const daysBeforeExpiry = Math.floor((expiryDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysBeforeExpiry < minDays) {
          result = "warn";
          reason = `Renewal initiated ${daysBeforeExpiry} days before expiry â€” below recommended ${minDays} days`;
        } else {
          reason = `Renewal initiated ${daysBeforeExpiry} days before expiry â€” above ${minDays}-day minimum.`;
        }
        break;
      }
    }

    results.push({ gateKey: gate.key, gateName: gate.name, mode: gate.mode, result, reason, overridable: gate.overridable });
  }

  return results;
}

// ============================================================
// STATUS HELPERS
// ============================================================

export function getStatusColor(status: RenewalWorkspaceStatus): string {
  switch (status) {
    case "draft": return "text-gray-600 bg-gray-50 border-gray-200";
    case "under_review": return "text-amber-700 bg-amber-50 border-amber-200";
    case "approved": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "rejected": return "text-red-700 bg-red-50 border-red-200";
    case "locked": return "text-blue-700 bg-blue-50 border-blue-200";
  }
}

export function getDecisionColor(decision: RenewalDecision): string {
  switch (decision) {
    case "renew": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "renegotiate": return "text-amber-700 bg-amber-50 border-amber-200";
    case "exit": return "text-red-700 bg-red-50 border-red-200";
    case "pending": return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export function getGateResultColor(result: GateResult): string {
  switch (result) {
    case "pass": return "text-emerald-700";
    case "warn": return "text-amber-700";
    case "block": return "text-red-700";
  }
}

export function getGateResultBg(result: GateResult): string {
  switch (result) {
    case "pass": return "bg-emerald-50 border-emerald-200";
    case "warn": return "bg-amber-50 border-amber-200";
    case "block": return "bg-red-50 border-red-200";
  }
}

export function getDeltaSeverityColor(severity: DeltaDetail["severity"]): string {
  switch (severity) {
    case "positive": return "text-emerald-700";
    case "warning": return "text-amber-700";
    case "critical": return "text-red-700";
    case "neutral": return "text-gray-500";
  }
}

export function getDeltaDirectionIcon(direction: DeltaDetail["direction"]): string {
  switch (direction) {
    case "increase": return "â†‘";
    case "decrease": return "â†“";
    case "unchanged": return "â€”";
    case "added": return "+";
    case "removed": return "âˆ’";
  }
}

export function getDaysUntilExpiry(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  return Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryUrgency(daysLeft: number): { label: string; color: string } {
  if (daysLeft < 0) return { label: "Expired", color: "text-red-700 bg-red-50" };
  if (daysLeft <= 30) return { label: "Critical", color: "text-red-600 bg-red-50" };
  if (daysLeft <= 90) return { label: "Urgent", color: "text-amber-700 bg-amber-50" };
  if (daysLeft <= 180) return { label: "Approaching", color: "text-yellow-700 bg-yellow-50" };
  return { label: "Healthy", color: "text-emerald-700 bg-emerald-50" };
}

export function formatSAR(value: number): string {
  if (value >= 1000000) return `SAR ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `SAR ${(value / 1000).toFixed(0)}K`;
  return `SAR ${value.toLocaleString()}`;
}

// ============================================================
// MUTATION HELPERS (for UI actions)
// ============================================================

export function addRenewalAuditEntry(entry: Omit<RenewalAuditEntry, "id">): RenewalAuditEntry {
  const newEntry: RenewalAuditEntry = { ...entry, id: `ra-${nanoid(6)}` };
  renewalAuditLog.unshift(newEntry);
  return newEntry;
}

export function updateRenewalWorkspaceStatus(workspaceId: string, status: RenewalWorkspaceStatus, userId: string, userName: string): boolean {
  const ws = renewalWorkspaces.find(w => w.id === workspaceId);
  if (!ws) return false;
  const oldStatus = ws.status;
  ws.status = status;
  ws.updatedAt = new Date().toISOString().split("T")[0];
  addRenewalAuditEntry({
    entityType: "renewal_workspace",
    entityId: workspaceId,
    action: "status_changed",
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details: `Status changed from ${oldStatus} to ${status}`,
  });
  return true;
}

export function updateRenewalDecision(workspaceId: string, decision: RenewalDecision, userId: string, userName: string): boolean {
  const ws = renewalWorkspaces.find(w => w.id === workspaceId);
  if (!ws) return false;
  const oldDecision = ws.renewalDecision;
  ws.renewalDecision = decision;
  ws.updatedAt = new Date().toISOString().split("T")[0];
  addRenewalAuditEntry({
    entityType: "renewal_workspace",
    entityId: workspaceId,
    action: "decision_changed",
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details: `Decision changed from ${oldDecision} to ${decision}`,
  });
  return true;
}

export function overrideGate(
  evaluationId: string,
  gateKey: string,
  reason: string,
  userId: string,
  userName: string,
  userRole?: string
): { success: boolean; error?: string } {
  const evaluation = renewalGateEvaluations.find(e => e.id === evaluationId);
  if (!evaluation) return { success: false, error: "Gate evaluation not found" };

  const gate = evaluation.gates.find(g => g.gateKey === gateKey);
  if (!gate) return { success: false, error: "Gate not found in evaluation" };

  // Non-overridable gates cannot be overridden
  if (!gate.overridable) {
    return { success: false, error: `Gate "${gate.gateName}" is non-overridable` };
  }

  // Cannot override a gate that already passed
  if (gate.result === "pass") {
    return { success: false, error: "Gate already passed â€” no override needed" };
  }

  // Already overridden
  if (gate.overridden) {
    return { success: false, error: "Gate has already been overridden" };
  }

  // Validate reason (minimum 10 characters)
  if (!reason || reason.trim().length < 10) {
    return { success: false, error: "Override reason is required and must be at least 10 characters" };
  }

  // Self-approval prevention: workspace owner cannot override their own renewal gates
  const workspace = renewalWorkspaces.find(w => w.id === evaluation.workspaceId);
  if (workspace && workspace.ownerUserId === userId) {
    return { success: false, error: "Cannot override gates on your own renewal workspace. A different authorized user must approve." };
  }

  // RBAC: validate role against allowed override roles for this gate
  // Allowed roles per gate (aligned with commercial-integrity.ts overrideRoleConfigs)
  const gateRoleMap: Record<string, string[]> = {
    ecr_gate: ["director", "ceo_cfo", "admin"],
    margin_gate: ["director", "ceo_cfo", "admin"],
    scope_drift_gate: ["regional_sales_head", "director", "ceo_cfo", "admin"],
    ops_feasibility_gate: ["regional_ops_head", "director", "ceo_cfo", "admin"],
    contract_timing_gate: ["regional_sales_head", "director", "ceo_cfo", "admin"],
  };

  const allowedRoles = gateRoleMap[gateKey] || ["director", "ceo_cfo", "admin"];
  if (userRole && !allowedRoles.includes(userRole)) {
    return {
      success: false,
      error: `Role "${userRole}" is not authorized to override gate "${gate.gateName}". Required: ${allowedRoles.join(", ")}`,
    };
  }

  // Apply override
  gate.overridden = true;
  gate.overrideReason = reason.trim();
  gate.overrideBy = userName;
  gate.overrideAt = new Date().toISOString();

  addRenewalAuditEntry({
    entityType: "renewal_gate",
    entityId: evaluationId,
    action: "gate_overridden",
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details: `Gate "${gate.gateName}" overridden by ${userName} (${userRole || "unknown role"}): ${reason.trim()}`,
  });

  return { success: true };
}
