/**
 * Commercial workspace shared types and compatibility helpers.
 *
 * The real commercial workspace bundle is loaded through
 * supabase-commercial-data.ts. This file intentionally carries no bundled
 * operational records.
 */

import type { QuotePricingLine } from "@/components/commercial/CommercialPricingLinesTable";
import type { QuotePnlSnapshot, MarginAuthoritySignal } from "@/components/commercial/CommercialPnlAuthorityPanels";
import type { CommercialCustomerScore } from "@/components/commercial/CommercialCustomerScorePanel";
import type { CommercialCapacityFit, WarehouseConstraint } from "@/components/commercial/CommercialCapacityFitPanel";
import type { CommercialPricingPosture } from "@/components/commercial/CommercialPricingPosturePanel";
import type { CommercialRevenueRealization } from "@/components/commercial/CommercialRevenueRealizationPanel";

export type QuoteScenarioStatus =
  | "not_started"
  | "draft_scenario"
  | "pnl_basis_added"
  | "ready_for_review_mock"
  | "margin_risk_flagged"
  | "mock_reviewed"
  | "client_facing_draft_mock"
  | "superseded_mock";

export type PricingPosture = "Reprice" | "Walk Away / Reprice" | "Balanced" | "Aggressive" | "Premium";
export type CustomerScore = "A" | "B" | "C" | "D";
export type CapacityFit = "Available" | "Acceptable" | "Constrained" | "Critical";
export type RevenueTiming = "This Quarter" | "Next Quarter" | "This Year" | "Beyond";

export interface QuoteScenario {
  id: string;
  name: string;
  version: string;
  status: QuoteScenarioStatus;
  revenue: number;
  cost: number;
  gpPercent: number;
  pricingPosture: PricingPosture;
  customerScore: CustomerScore;
  capacityFit: CapacityFit;
  revenueTiming: RevenueTiming;
  mockEscalation: string;
  owner: string;
  notes: string;
}

export const MOCK_SCENARIOS: QuoteScenario[] = [];
export const MOCK_PRICING_LINES: QuotePricingLine[] = [];
export const MOCK_PNL_SNAPSHOTS: Record<string, QuotePnlSnapshot> = {};
export const MOCK_CUSTOMER_SCORE = {} as CommercialCustomerScore;
export const WAREHOUSE_CONSTRAINTS_BASE: WarehouseConstraint[] = [];
export const MOCK_CAPACITY_FIT: Record<string, CommercialCapacityFit> = {};
export const MOCK_MARGIN_SIGNALS: Record<string, MarginAuthoritySignal> = {};
export const MOCK_PRICING_POSTURE: Record<string, CommercialPricingPosture> = {};
export const MOCK_REVENUE_REALIZATION: Record<string, CommercialRevenueRealization> = {};

export function getPricingLinesForScenario(scenarioId: string): QuotePricingLine[] {
  return MOCK_PRICING_LINES.filter((line) => line.scenarioId === scenarioId);
}

export type EscalationSeverity = "Low" | "Medium" | "High" | "Critical";
export type EscalationStatus = "Open Mock" | "Amber Review" | "Reviewed Mock" | "Testing Bypass Used" | "No Escalation" | "Future Approval Required";
export type SignalSource = "Margin Authority" | "Customer Score" | "Capacity Fit" | "Pricing Posture" | "Revenue Realization" | "P&L Confidence";

export interface CommercialMockEscalation {
  id: string;
  workspaceId: string;
  scenarioId: string;
  escalationCode: string;
  signalSource: SignalSource;
  signalName: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  owner: string;
  futureRequiredRoles: string[];
  triggerReason: string;
  commercialImpact: string;
  recommendedAction: string;
  linkedControls: string[];
  wouldEscalate: boolean;
  wouldRequireApproval: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  runtimeMode: string;
  createdAt: string;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

export const MOCK_ESCALATIONS: Record<string, CommercialMockEscalation[]> = {};

export function getEscalationsForScenario(scenarioId: string): CommercialMockEscalation[] {
  return MOCK_ESCALATIONS[scenarioId] || [];
}

export function getEscalationSummary(scenarioId: string) {
  const escalations = getEscalationsForScenario(scenarioId);
  return {
    total: escalations.length,
    critical: escalations.filter((item) => item.severity === "Critical").length,
    high: escalations.filter((item) => item.severity === "High").length,
    medium: escalations.filter((item) => item.severity === "Medium").length,
    mockCreated: escalations.filter((item) => item.mockEscalationCreated).length,
    bypassAvailable: escalations.filter((item) => item.allowTestBypass).length,
    hasRed: escalations.some((item) => item.severity === "Critical" || item.severity === "High"),
  };
}

export type ProposalStatus = "Not Started" | "Drafting" | "Linked to Quote Scenario" | "Client-Facing Draft Mock" | "Negotiation Round Active" | "Revised Mock" | "Mock Reviewed" | "Superseded Mock";
export type ProposalType = "Standard Proposal" | "Revised Proposal" | "Negotiation Response" | "Internal Draft" | "Client-Facing Mock";
export type ProposalReviewStatus = "Not Reviewed" | "Needs Commercial Review" | "Needs Finance Review" | "Needs Ops Review" | "Mock Reviewed" | "Future Approval Required";
export type ProposalGateStatus = "No Gate" | "Future Gate Warning" | "Would Require Review in Production" | "Mock Bypass Available";
export type NegotiationStatus = "Open" | "Responded Mock" | "Awaiting Client" | "Revised Proposal Needed" | "Closed Mock";

export interface CommercialProposalVersion {
  id: string;
  workspaceId: string;
  proposalName: string;
  version: string;
  linkedQuoteScenarioId: string;
  linkedQuoteScenarioName: string;
  status: ProposalStatus;
  proposalType: ProposalType;
  clientFacingMock: boolean;
  revenue: number;
  gpPercent: number;
  marginDeltaFromQuote: number;
  owner: string;
  reviewStatus: ProposalReviewStatus;
  futureGateStatus: ProposalGateStatus;
  mockEscalationStatus: string;
  issuedAtMock: string;
  lastUpdated: string;
  notes: string;
}

export interface CommercialNegotiationRound {
  id: string;
  workspaceId: string;
  proposalVersionId: string;
  roundNumber: number;
  clientAsk: string;
  halaResponse: string;
  pricingChange: string;
  marginChange: string;
  concessionReason: string;
  approvalImpact: string;
  status: NegotiationStatus;
  owner: string;
  lastUpdated: string;
  notes: string;
}

export const MOCK_PROPOSALS: CommercialProposalVersion[] = [];
export const MOCK_NEGOTIATIONS: CommercialNegotiationRound[] = [];

export function getProposalsForWorkspace(workspaceId: string): CommercialProposalVersion[] {
  return MOCK_PROPOSALS.filter((proposal) => proposal.workspaceId === workspaceId);
}

export function getNegotiationsForProposal(proposalId: string): CommercialNegotiationRound[] {
  return MOCK_NEGOTIATIONS.filter((round) => round.proposalVersionId === proposalId);
}

export function getLinkedQuoteForProposal(proposal: CommercialProposalVersion) {
  const scenario = MOCK_SCENARIOS.find((item) => item.id === proposal.linkedQuoteScenarioId);
  if (!scenario) return null;
  return {
    name: scenario.name,
    gpPercent: scenario.gpPercent,
    pricingPosture: scenario.pricingPosture,
    capacityFit: scenario.capacityFit,
    customerScore: scenario.customerScore,
    revenueTiming: scenario.revenueTiming,
    mockEscalation: scenario.mockEscalation,
  };
}

export type SlaStatus = "Not Started" | "Draft Mock" | "Linked to Commercial Terms Mock" | "Pricing Lock Warning" | "Ops Review Needed" | "Legal Review Needed" | "Mock Reviewed" | "Ready for Future Contracting";
export type SlaType = "Warehousing SLA" | "Emergency Storage SLA" | "Transport Add-On SLA" | "Master Service SLA" | "Client-Facing Mock" | "Internal Draft";
export type PricingLockStatus = "Not Locked" | "Mock Linked" | "Pricing Lock Warning" | "Future Lock Required" | "Mock Reviewed";
export type CommercialTermsStatus = "Missing" | "Draft Mock" | "Linked to Proposal Mock" | "Future Approval Required" | "Mock Reviewed";
export type SlaReviewStatus = "Not Reviewed" | "Needs Ops Review" | "Needs Legal Review" | "Needs Commercial Review" | "Mock Reviewed" | "Future Approval Required";
export type SlaGateStatus = "No Gate" | "Future Gate Warning" | "Would Require Review in Production" | "Mock Bypass Available";
export type SectionCategory = "Service Scope" | "Operating Hours" | "KPIs" | "Reporting" | "Escalation Matrix" | "Responsibilities" | "Commercial Terms" | "Legal Terms" | "Handover" | "Exclusions";

export interface CommercialSlaDraft {
  id: string;
  workspaceId: string;
  slaName: string;
  version: string;
  linkedProposalId: string;
  linkedProposalName: string;
  linkedQuoteScenarioId: string;
  linkedQuoteScenarioName: string;
  status: SlaStatus;
  slaType: SlaType;
  clientFacingMock: boolean;
  pricingLockStatus: PricingLockStatus;
  commercialTermsStatus: CommercialTermsStatus;
  opsReviewStatus: SlaReviewStatus;
  legalReviewStatus: SlaReviewStatus;
  kpiReadiness: number;
  responsibilityReadiness: number;
  escalationMatrixStatus: string;
  promiseGapCount: number;
  riskLevel: string;
  futureGateStatus: SlaGateStatus;
  mockEscalationStatus: string;
  owner: string;
  lastUpdated: string;
  notes: string;
}

export interface CommercialSlaSection {
  id: string;
  slaId: string;
  sectionName: string;
  category: SectionCategory;
  status: string;
  owner: string;
  readiness: number;
  riskLevel: string;
  notes: string;
}

export interface CommercialSlaKpi {
  id: string;
  slaId: string;
  kpiName: string;
  target: string;
  measurementMethod: string;
  owner: string;
  readiness: number;
  riskLevel: string;
  notes: string;
}

export interface CommercialSlaPromiseGap {
  id: string;
  slaId: string;
  promise: string;
  operationalReality: string;
  impact: string;
  owner: string;
  severity: string;
  recommendedAction: string;
  wouldEscalateInProduction: boolean;
  mockEscalationCreated: boolean;
  notes: string;
}

export const MOCK_SLA_DRAFTS: CommercialSlaDraft[] = [];
export const MOCK_SLA_SECTIONS: CommercialSlaSection[] = [];
export const MOCK_SLA_KPIS: CommercialSlaKpi[] = [];
export const MOCK_SLA_PROMISE_GAPS: CommercialSlaPromiseGap[] = [];

export function getSlaDraftsForWorkspace(workspaceId: string): CommercialSlaDraft[] {
  return MOCK_SLA_DRAFTS.filter((sla) => sla.workspaceId === workspaceId);
}

export function getSlaSections(slaId: string): CommercialSlaSection[] {
  return MOCK_SLA_SECTIONS.filter((section) => section.slaId === slaId);
}

export function getSlaKpis(slaId: string): CommercialSlaKpi[] {
  return MOCK_SLA_KPIS.filter((kpi) => kpi.slaId === slaId);
}

export function getSlaPromiseGaps(slaId: string): CommercialSlaPromiseGap[] {
  return MOCK_SLA_PROMISE_GAPS.filter((gap) => gap.slaId === slaId);
}

export function getLinkedCommercialBasis(sla: CommercialSlaDraft) {
  const proposal = MOCK_PROPOSALS.find((item) => item.id === sla.linkedProposalId);
  const scenario = MOCK_SCENARIOS.find((item) => item.id === sla.linkedQuoteScenarioId);
  if (!proposal || !scenario) return null;

  return {
    proposalName: `${proposal.proposalName} ${proposal.version}`,
    proposalStatus: proposal.status,
    quoteName: scenario.name,
    quoteGpPercent: scenario.gpPercent,
    pricingPosture: scenario.pricingPosture,
    capacityFit: scenario.capacityFit,
    customerScore: scenario.customerScore,
    marginAuthority: scenario.gpPercent < 10 ? "CEO/CFO Required" : scenario.gpPercent < 22 ? "Commercial Director" : "Standard",
    pnlConfidence: scenario.gpPercent < 10 ? "Low" : scenario.gpPercent < 22 ? "Medium" : "High",
  };
}

export type ActivityCategory = "Workspace" | "Quote" | "Pricing" | "P&L" | "Margin" | "Customer Score" | "Capacity" | "Pricing Posture" | "Revenue Timing" | "Escalation" | "Proposal" | "Negotiation" | "SLA" | "Review" | "CRM Mock";
export type AuditCategory = "WORKSPACE" | "QUOTE" | "PRICING" | "PNL" | "MARGIN" | "CUSTOMER_SCORE" | "CAPACITY" | "PRICING_POSTURE" | "REVENUE_TIMING" | "ESCALATION" | "PROPOSAL" | "NEGOTIATION" | "SLA" | "CRM_SYNC" | "SYSTEM";
export type EventSeverity = "Info" | "Warning" | "High" | "Critical";

export interface CommercialActivityEvent {
  id: string;
  workspaceId: string;
  eventType: string;
  title: string;
  description: string;
  category: ActivityCategory;
  actor: string;
  role: string;
  timestamp: string;
  relatedArtifact: string;
  relatedModule: string;
  relatedScenarioId: string;
  severity: EventSeverity;
  mock: boolean;
  notes: string;
}

export interface CommercialAuditEvent {
  id: string;
  workspaceId: string;
  eventCode: string;
  eventName: string;
  description: string;
  category: AuditCategory;
  actor: string;
  role: string;
  timestamp: string;
  entityType: string;
  entityName: string;
  beforeState: string;
  afterState: string;
  mock: boolean;
  severity: EventSeverity;
  traceId: string;
  notes: string;
}

export const MOCK_ACTIVITY_EVENTS: CommercialActivityEvent[] = [];
export const MOCK_AUDIT_EVENTS: CommercialAuditEvent[] = [];

export function getActivityForWorkspace(workspaceId: string): CommercialActivityEvent[] {
  return MOCK_ACTIVITY_EVENTS
    .filter((event) => event.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getAuditForWorkspace(workspaceId: string): CommercialAuditEvent[] {
  return MOCK_AUDIT_EVENTS
    .filter((event) => event.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export type CommercialRiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface CommercialWorkspaceSignalSummary {
  workspaceId: string;
  workspaceName: string;
  customerName: string;
  stage: string;
  value: number;
  gpPercent: number;
  riskLevel: CommercialRiskLevel;
  quoteStatus: string;
  proposalStatus: string;
  slaStatus: string;
  marginRisk: CommercialRiskLevel;
  customerRisk: string;
  capacityRisk: string;
  mockEscalationCount: number;
  criticalEscalationCount: number;
  proposalReviewNeeded: boolean;
  slaReviewNeeded: boolean;
  revenueTiming: string;
  nextAction: string;
  crmStatus: string;
  developmentMode: true;
}

export interface CommercialExecutionSignal {
  workspaceId: string;
  workspaceName: string;
  customerName: string;
  stage: string;
  riskColor: "red" | "amber" | "green";
  riskReason: string;
  nextAction: string;
  signalType: string;
  developmentMode: true;
}

export function getCommercialWorkspaceSignalSummary(workspaceId: string): CommercialWorkspaceSignalSummary | null {
  void workspaceId;
  return null;
}

export function getCommercialWorkspaceSignals(workspaceId: string): CommercialExecutionSignal[] {
  void workspaceId;
  return [];
}

export function getAllCommercialWorkspaceSignals(): CommercialExecutionSignal[] {
  return [];
}
