// Renewal Engine v1 — Baseline → Renewal → Locked
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
// MOCK PRICING SNAPSHOTS
// ============================================================

const psSABIC: PricingSnapshot = { id: "ps-sabic-1", storageRate: 40, inboundRate: 7, outboundRate: 7, palletVolume: 2500, monthlyRevenue: 433333, annualRevenue: 5200000, gpPercent: 27.5, vasRevenue: 45000, slaScope: ["Ambient Storage", "Inbound Receiving", "Outbound Dispatch", "Inventory Management", "Monthly Reporting"], lanes: ["Jubail → Riyadh", "Jubail → Dammam"], assumptions: ["24/7 operations", "Max 3 shifts", "Client provides MHE insurance"] };
const psMaaden: PricingSnapshot = { id: "ps-maaden-1", storageRate: 38, inboundRate: 7, outboundRate: 7, palletVolume: 1800, monthlyRevenue: 283333, annualRevenue: 3400000, gpPercent: 23.1, vasRevenue: 30000, slaScope: ["Ambient Storage", "Hazmat Handling", "Inbound Receiving", "Outbound Dispatch", "Inventory Management"], lanes: ["Jubail → Riyadh", "Jubail → Jeddah", "Jubail → Dammam"], assumptions: ["Hazmat-certified staff required", "Dedicated storage zone", "Monthly compliance audit"] };
const psSadara: PricingSnapshot = { id: "ps-sadara-1", storageRate: 39, inboundRate: 7, outboundRate: 7, palletVolume: 1200, monthlyRevenue: 233333, annualRevenue: 2800000, gpPercent: 24.5, vasRevenue: 20000, slaScope: ["Ambient Storage", "Inbound Receiving", "Outbound Dispatch", "Quality Inspection"], lanes: ["Jubail → Dammam"], assumptions: ["Standard operations", "Client-owned pallets", "Quarterly review meetings"] };
const psUnilever: PricingSnapshot = { id: "ps-unilever-1", storageRate: 36, inboundRate: 6, outboundRate: 6, palletVolume: 900, monthlyRevenue: 150000, annualRevenue: 1800000, gpPercent: 18.2, vasRevenue: 12000, slaScope: ["Ambient Storage", "Inbound Receiving", "Outbound Dispatch"], lanes: ["Dammam → Riyadh"], assumptions: ["FMCG handling standards", "FIFO rotation", "Seasonal volume spikes expected"] };
const psAlRajhi: PricingSnapshot = { id: "ps-alrajhi-1", storageRate: 34, inboundRate: 5, outboundRate: 5, palletVolume: 400, monthlyRevenue: 66667, annualRevenue: 800000, gpPercent: 12.0, vasRevenue: 5000, slaScope: ["Ambient Storage", "Inbound Receiving", "Outbound Dispatch"], lanes: ["Jubail → Dammam"], assumptions: ["Minimal VAS", "Standard handling", "Payment terms net-60"] };

// ============================================================
// A) CONTRACT BASELINES
// ============================================================

export const contractBaselines: ContractBaseline[] = [
  { id: "bl-sabic-1", customerId: "c1", customerName: "SABIC", opportunityId: null, baselineName: "SABIC Warehousing Contract 2024-2026", baselineStartDate: "2024-07-01", baselineEndDate: "2026-06-30", status: "active", proposalVersionId: "p-sabic-v2", slaVersionId: "sla-sabic-v1", pricingSnapshot: psSABIC, createdAt: "2024-06-15", createdBy: "Ra'ed Al-Harbi" },
  { id: "bl-maaden-1", customerId: "c2", customerName: "Ma'aden", opportunityId: null, baselineName: "Ma'aden Logistics Contract 2024-2026", baselineStartDate: "2024-04-01", baselineEndDate: "2026-03-31", status: "active", proposalVersionId: "p-maaden-v1", slaVersionId: "sla-maaden-v1", pricingSnapshot: psMaaden, createdAt: "2024-03-20", createdBy: "Ra'ed Al-Harbi" },
  { id: "bl-sadara-1", customerId: "c4", customerName: "Sadara Chemical", opportunityId: null, baselineName: "Sadara Chemical Storage Contract 2023-2025", baselineStartDate: "2023-10-01", baselineEndDate: "2025-09-30", status: "active", proposalVersionId: "p-sadara-v2", slaVersionId: "sla-sadara-v1", pricingSnapshot: psSadara, createdAt: "2023-09-15", createdBy: "Albert Fernandez" },
  { id: "bl-unilever-1", customerId: "c6", customerName: "Unilever Arabia", opportunityId: null, baselineName: "Unilever Arabia Warehousing 2024-2025", baselineStartDate: "2024-07-01", baselineEndDate: "2025-06-30", status: "active", proposalVersionId: "p-unilever-v1", slaVersionId: "sla-unilever-v1", pricingSnapshot: psUnilever, createdAt: "2024-06-20", createdBy: "Albert Fernandez" },
  { id: "bl-alrajhi-1", customerId: "c9", customerName: "Al-Rajhi Steel", opportunityId: null, baselineName: "Al-Rajhi Steel Emergency Storage 2024-2025", baselineStartDate: "2024-05-01", baselineEndDate: "2025-04-30", status: "active", proposalVersionId: "p-alrajhi-v1", slaVersionId: null, pricingSnapshot: psAlRajhi, createdAt: "2024-04-25", createdBy: "Albert Fernandez" },
];

// ============================================================
// B) RENEWAL WORKSPACES
// ============================================================

export const renewalWorkspaces: RenewalWorkspace[] = [
  { id: "rw-maaden-1", customerId: "c2", customerName: "Ma'aden", baselineId: "bl-maaden-1", renewalCycleName: "Ma'aden 2026-2028 Renewal", targetStartDate: "2026-04-01", targetEndDate: "2028-03-31", status: "under_review", renewalDecision: "renegotiate", ownerUserId: "u2", ownerName: "Ra'ed Al-Harbi", createdAt: "2025-12-01", updatedAt: "2026-02-10" },
  { id: "rw-sadara-1", customerId: "c4", customerName: "Sadara Chemical", baselineId: "bl-sadara-1", renewalCycleName: "Sadara 2025-2028 Renewal", targetStartDate: "2025-10-01", targetEndDate: "2028-09-30", status: "approved", renewalDecision: "renew", ownerUserId: "u3", ownerName: "Albert Fernandez", createdAt: "2025-06-15", updatedAt: "2026-02-14" },
  { id: "rw-unilever-1", customerId: "c6", customerName: "Unilever Arabia", baselineId: "bl-unilever-1", renewalCycleName: "Unilever 2025-2027 Renewal", targetStartDate: "2025-07-01", targetEndDate: "2027-06-30", status: "draft", renewalDecision: "pending", ownerUserId: "u3", ownerName: "Albert Fernandez", createdAt: "2026-01-15", updatedAt: "2026-02-12" },
  { id: "rw-alrajhi-1", customerId: "c9", customerName: "Al-Rajhi Steel", baselineId: "bl-alrajhi-1", renewalCycleName: "Al-Rajhi 2025-2026 Renewal", targetStartDate: "2025-05-01", targetEndDate: "2026-04-30", status: "rejected", renewalDecision: "exit", ownerUserId: "u3", ownerName: "Albert Fernandez", createdAt: "2025-02-01", updatedAt: "2025-03-20" },
];

// ============================================================
// C) RENEWAL DRAFT VERSIONS
// ============================================================

export const renewalVersions: RenewalVersion[] = [
  { id: "rv-maaden-v1", workspaceId: "rw-maaden-1", versionNumber: 1, proposalVersionId: "p-maaden-v1", slaVersionId: "sla-maaden-v1", pricingSnapshot: { ...psMaaden, id: "ps-maaden-rv1" }, notes: "Cloned from baseline — no changes yet", createdAt: "2025-12-01", createdBy: "Ra'ed Al-Harbi" },
  { id: "rv-maaden-v2", workspaceId: "rw-maaden-1", versionNumber: 2, proposalVersionId: "p-maaden-v2", slaVersionId: "sla-maaden-v2", pricingSnapshot: { id: "ps-maaden-rv2", storageRate: 41, inboundRate: 7.5, outboundRate: 7.5, palletVolume: 2200, monthlyRevenue: 340000, annualRevenue: 4080000, gpPercent: 25.8, vasRevenue: 42000, slaScope: ["Ambient Storage", "Hazmat Handling", "Inbound Receiving", "Outbound Dispatch", "Inventory Management", "Dedicated Account Manager"], lanes: ["Jubail → Riyadh", "Jubail → Jeddah", "Jubail → Dammam", "Jubail → Yanbu"], assumptions: ["Hazmat-certified staff required", "Dedicated storage zone", "Monthly compliance audit", "Quarterly business review"] }, notes: "Renegotiated: increased rate, added scope, expanded lanes. GP% improved.", createdAt: "2026-01-15", createdBy: "Ra'ed Al-Harbi" },
  { id: "rv-sadara-v1", workspaceId: "rw-sadara-1", versionNumber: 1, proposalVersionId: "p-sadara-v2", slaVersionId: "sla-sadara-v1", pricingSnapshot: { ...psSadara, id: "ps-sadara-rv1" }, notes: "Cloned from baseline", createdAt: "2025-06-15", createdBy: "Albert Fernandez" },
  { id: "rv-sadara-v2", workspaceId: "rw-sadara-1", versionNumber: 2, proposalVersionId: "p-sadara-v3", slaVersionId: "sla-sadara-v2", pricingSnapshot: { id: "ps-sadara-rv2", storageRate: 40, inboundRate: 7, outboundRate: 7, palletVolume: 1200, monthlyRevenue: 240000, annualRevenue: 2880000, gpPercent: 25.2, vasRevenue: 22000, slaScope: ["Ambient Storage", "Inbound Receiving", "Outbound Dispatch", "Quality Inspection"], lanes: ["Jubail → Dammam"], assumptions: ["Standard operations", "Client-owned pallets", "Quarterly review meetings"] }, notes: "Minor rate increase to SAR 40/pallet. GP% improved from 24.5% to 25.2%.", createdAt: "2026-01-20", createdBy: "Albert Fernandez" },
  { id: "rv-unilever-v1", workspaceId: "rw-unilever-1", versionNumber: 1, proposalVersionId: "p-unilever-v1", slaVersionId: "sla-unilever-v1", pricingSnapshot: { ...psUnilever, id: "ps-unilever-rv1" }, notes: "Cloned from baseline — pending decision", createdAt: "2026-01-15", createdBy: "Albert Fernandez" },
  { id: "rv-alrajhi-v1", workspaceId: "rw-alrajhi-1", versionNumber: 1, proposalVersionId: "p-alrajhi-v1", slaVersionId: null, pricingSnapshot: { ...psAlRajhi, id: "ps-alrajhi-rv1" }, notes: "Cloned from baseline. Decision: Exit due to payment risk and low margin.", createdAt: "2025-02-01", createdBy: "Albert Fernandez" },
];

// ============================================================
// D) RENEWAL DELTAS
// ============================================================

export const renewalDeltas: RenewalDelta[] = [
  {
    id: "rd-maaden-v2", workspaceId: "rw-maaden-1", baselineId: "bl-maaden-1", renewalVersionId: "rv-maaden-v2",
    deltaJson: [
      { field: "Storage Rate", category: "pricing", baselineValue: 38, renewalValue: 41, changePercent: 7.9, direction: "increase", severity: "positive" },
      { field: "Inbound Rate", category: "pricing", baselineValue: 7, renewalValue: 7.5, changePercent: 7.1, direction: "increase", severity: "positive" },
      { field: "Outbound Rate", category: "pricing", baselineValue: 7, renewalValue: 7.5, changePercent: 7.1, direction: "increase", severity: "positive" },
      { field: "Pallet Volume", category: "volume", baselineValue: 1800, renewalValue: 2200, changePercent: 22.2, direction: "increase", severity: "warning" },
      { field: "Annual Revenue", category: "pricing", baselineValue: 3400000, renewalValue: 4080000, changePercent: 20.0, direction: "increase", severity: "positive" },
      { field: "GP%", category: "pricing", baselineValue: 23.1, renewalValue: 25.8, changePercent: 11.7, direction: "increase", severity: "positive" },
      { field: "VAS Revenue", category: "pricing", baselineValue: 30000, renewalValue: 42000, changePercent: 40.0, direction: "increase", severity: "positive" },
      { field: "SLA Scope Items", category: "scope", baselineValue: 5, renewalValue: 6, changePercent: 20.0, direction: "increase", severity: "warning" },
      { field: "Lanes", category: "scope", baselineValue: 3, renewalValue: 4, changePercent: 33.3, direction: "increase", severity: "neutral" },
      { field: "Dedicated Account Manager", category: "sla", baselineValue: "No", renewalValue: "Yes", changePercent: null, direction: "added", severity: "warning" },
    ],
    riskFlagsJson: [
      { key: "volume_increase", severity: "medium", message: "Pallet volume increasing 22.2% — verify ops capacity", gateKey: "ops_feasibility_gate" },
      { key: "scope_increase", severity: "low", message: "SLA scope expanded with 1 new item — ensure pricing covers cost", gateKey: "scope_drift_gate" },
    ],
    computedAt: "2026-01-15",
  },
  {
    id: "rd-sadara-v2", workspaceId: "rw-sadara-1", baselineId: "bl-sadara-1", renewalVersionId: "rv-sadara-v2",
    deltaJson: [
      { field: "Storage Rate", category: "pricing", baselineValue: 39, renewalValue: 40, changePercent: 2.6, direction: "increase", severity: "positive" },
      { field: "Annual Revenue", category: "pricing", baselineValue: 2800000, renewalValue: 2880000, changePercent: 2.9, direction: "increase", severity: "positive" },
      { field: "GP%", category: "pricing", baselineValue: 24.5, renewalValue: 25.2, changePercent: 2.9, direction: "increase", severity: "positive" },
      { field: "VAS Revenue", category: "pricing", baselineValue: 20000, renewalValue: 22000, changePercent: 10.0, direction: "increase", severity: "positive" },
    ],
    riskFlagsJson: [],
    computedAt: "2026-01-20",
  },
];

// ============================================================
// E) GATE EVALUATIONS
// ============================================================

export const renewalGateEvaluations: RenewalGateEvaluation[] = [
  {
    id: "rge-maaden-v2", workspaceId: "rw-maaden-1", renewalVersionId: "rv-maaden-v2", ruleSetVersionId: null, result: "warn",
    gates: [
      { gateKey: "ecr_gate", gateName: "ECR Gate", mode: "warn", result: "pass", reason: "ECR grade B — above minimum threshold C", overridable: true },
      { gateKey: "margin_gate", gateName: "Margin Gate", mode: "enforce", result: "pass", reason: "GP% 25.8% — above minimum 18%. Improved from baseline 23.1%.", overridable: true },
      { gateKey: "scope_drift_gate", gateName: "Scope Drift Gate", mode: "warn", result: "warn", reason: "SLA scope expanded from 5 to 6 items. Pricing increased — verify cost coverage.", overridable: true },
      { gateKey: "ops_feasibility_gate", gateName: "Ops Feasibility Gate", mode: "warn", result: "warn", reason: "Volume increase 22.2% (1800→2200 pallets). Below 25% threshold but verify capacity.", overridable: true },
      { gateKey: "contract_timing_gate", gateName: "Contract Timing Gate", mode: "warn", result: "pass", reason: "Renewal initiated 121 days before expiry — above 60-day minimum.", overridable: true },
    ],
    evaluatedAt: "2026-01-15",
  },
  {
    id: "rge-sadara-v2", workspaceId: "rw-sadara-1", renewalVersionId: "rv-sadara-v2", ruleSetVersionId: null, result: "pass",
    gates: [
      { gateKey: "ecr_gate", gateName: "ECR Gate", mode: "warn", result: "pass", reason: "ECR grade B — above minimum threshold C", overridable: true },
      { gateKey: "margin_gate", gateName: "Margin Gate", mode: "enforce", result: "pass", reason: "GP% 25.2% — above minimum 18%. Improved from baseline 24.5%.", overridable: true },
      { gateKey: "scope_drift_gate", gateName: "Scope Drift Gate", mode: "warn", result: "pass", reason: "No scope changes detected.", overridable: true },
      { gateKey: "ops_feasibility_gate", gateName: "Ops Feasibility Gate", mode: "warn", result: "pass", reason: "No volume change.", overridable: true },
      { gateKey: "contract_timing_gate", gateName: "Contract Timing Gate", mode: "warn", result: "pass", reason: "Renewal initiated well before expiry.", overridable: true },
    ],
    evaluatedAt: "2026-01-20",
  },
];

// ============================================================
// F) RENEWAL OUTCOMES
// ============================================================

export const renewalOutcomes: RenewalOutcome[] = [
  { id: "ro-sadara-1", workspaceId: "rw-sadara-1", approvedRenewalVersionId: "rv-sadara-v2", newBaselineId: "bl-sadara-2-pending", lockedAt: "2026-02-14", lockedBy: "Albert Fernandez" },
];

// ============================================================
// G) AUDIT ENTRIES
// ============================================================

export const renewalAuditLog: RenewalAuditEntry[] = [
  { id: "ra-1", entityType: "renewal_workspace", entityId: "rw-maaden-1", action: "created", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2025-12-01T09:00:00Z", details: "Renewal workspace created for Ma'aden 2026-2028" },
  { id: "ra-2", entityType: "renewal_version", entityId: "rv-maaden-v1", action: "created", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2025-12-01T09:05:00Z", details: "Version 1 cloned from baseline" },
  { id: "ra-3", entityType: "renewal_version", entityId: "rv-maaden-v2", action: "created", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-01-15T10:00:00Z", details: "Version 2 created — renegotiated pricing and scope" },
  { id: "ra-4", entityType: "renewal_gate", entityId: "rge-maaden-v2", action: "evaluated", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-01-15T10:05:00Z", details: "Gate evaluation: 2 warnings (scope drift, ops feasibility)" },
  { id: "ra-5", entityType: "renewal_workspace", entityId: "rw-maaden-1", action: "status_changed", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-01-15T10:10:00Z", details: "Status changed from draft to under_review" },
  { id: "ra-6", entityType: "renewal_workspace", entityId: "rw-sadara-1", action: "created", userId: "u3", userName: "Albert Fernandez", timestamp: "2025-06-15T08:00:00Z", details: "Renewal workspace created for Sadara 2025-2028" },
  { id: "ra-7", entityType: "renewal_workspace", entityId: "rw-sadara-1", action: "status_changed", userId: "u3", userName: "Albert Fernandez", timestamp: "2026-02-14T11:00:00Z", details: "Status changed to approved — all gates passed" },
  { id: "ra-8", entityType: "renewal_outcome", entityId: "ro-sadara-1", action: "locked", userId: "u3", userName: "Albert Fernandez", timestamp: "2026-02-14T11:05:00Z", details: "Renewal locked. New baseline pending creation." },
  { id: "ra-9", entityType: "renewal_workspace", entityId: "rw-alrajhi-1", action: "status_changed", userId: "u3", userName: "Albert Fernandez", timestamp: "2025-03-20T14:00:00Z", details: "Status changed to rejected — decision: exit. Low margin and payment risk." },
  { id: "ra-10", entityType: "renewal_workspace", entityId: "rw-unilever-1", action: "created", userId: "u3", userName: "Albert Fernandez", timestamp: "2026-01-15T09:00:00Z", details: "Renewal workspace created for Unilever 2025-2027" },
];

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
        // Simplified: check if customer has ECR data — in real system would compare grades
        reason = "ECR check completed — no grade degradation detected";
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
          reason = `GP% declined ${gpDecline.toFixed(1)}% from baseline (${bp.gpPercent}% → ${rp.gpPercent}%) — exceeds max decline ${maxDecline}%`;
        } else {
          reason = `GP% ${rp.gpPercent}% — above minimum ${minGp}%. ${rp.gpPercent >= bp.gpPercent ? "Improved" : "Slight decline"} from baseline ${bp.gpPercent}%.`;
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
          reason = `${addedItems} new SLA scope item(s) added. Revenue increased — verify cost coverage.`;
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
          reason = `Volume increase ${volumeChange.toFixed(1)}% exceeds ${maxIncrease}% threshold (${bp.palletVolume} → ${rp.palletVolume} pallets)`;
        } else if (volumeChange > 0) {
          reason = `Volume increase ${volumeChange.toFixed(1)}% — within threshold.`;
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
          reason = `Renewal initiated ${daysBeforeExpiry} days before expiry — below recommended ${minDays} days`;
        } else {
          reason = `Renewal initiated ${daysBeforeExpiry} days before expiry — above ${minDays}-day minimum.`;
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
    case "draft": return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
    case "under_review": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "approved": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "rejected": return "text-red-400 bg-red-400/10 border-red-400/20";
    case "locked": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  }
}

export function getDecisionColor(decision: RenewalDecision): string {
  switch (decision) {
    case "renew": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "renegotiate": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "exit": return "text-red-400 bg-red-400/10 border-red-400/20";
    case "pending": return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
  }
}

export function getGateResultColor(result: GateResult): string {
  switch (result) {
    case "pass": return "text-emerald-400";
    case "warn": return "text-amber-400";
    case "block": return "text-red-400";
  }
}

export function getGateResultBg(result: GateResult): string {
  switch (result) {
    case "pass": return "bg-emerald-400/10 border-emerald-400/20";
    case "warn": return "bg-amber-400/10 border-amber-400/20";
    case "block": return "bg-red-400/10 border-red-400/20";
  }
}

export function getDeltaSeverityColor(severity: DeltaDetail["severity"]): string {
  switch (severity) {
    case "positive": return "text-emerald-400";
    case "warning": return "text-amber-400";
    case "critical": return "text-red-400";
    case "neutral": return "text-zinc-400";
  }
}

export function getDeltaDirectionIcon(direction: DeltaDetail["direction"]): string {
  switch (direction) {
    case "increase": return "↑";
    case "decrease": return "↓";
    case "unchanged": return "—";
    case "added": return "+";
    case "removed": return "−";
  }
}

export function getDaysUntilExpiry(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  return Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryUrgency(daysLeft: number): { label: string; color: string } {
  if (daysLeft < 0) return { label: "Expired", color: "text-red-500 bg-red-500/10" };
  if (daysLeft <= 30) return { label: "Critical", color: "text-red-400 bg-red-400/10" };
  if (daysLeft <= 90) return { label: "Urgent", color: "text-amber-400 bg-amber-400/10" };
  if (daysLeft <= 180) return { label: "Approaching", color: "text-yellow-400 bg-yellow-400/10" };
  return { label: "Healthy", color: "text-emerald-400 bg-emerald-400/10" };
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

export function overrideGate(evaluationId: string, gateKey: string, reason: string, userId: string, userName: string): boolean {
  const evaluation = renewalGateEvaluations.find(e => e.id === evaluationId);
  if (!evaluation) return false;
  const gate = evaluation.gates.find(g => g.gateKey === gateKey);
  if (!gate || !gate.overridable) return false;
  gate.overridden = true;
  gate.overrideReason = reason;
  gate.overrideBy = userName;
  gate.overrideAt = new Date().toISOString();
  addRenewalAuditEntry({
    entityType: "renewal_gate",
    entityId: evaluationId,
    action: "gate_overridden",
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details: `Gate "${gate.gateName}" overridden: ${reason}`,
  });
  return true;
}
