/**
 * commercial-workspace-data.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.6).
 *
 * Shared commercial workspace types. This file intentionally carries no
 * bundled operational records: live commercial workspace data is loaded
 * through lib/supabase-commercial-data.ts from commercial_tickets.
 */

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

export type EscalationSeverity = "Low" | "Medium" | "High" | "Critical";

// Internal (non-exported) unions referenced by CommercialMockEscalation.
type EscalationStatus = "Open Mock" | "Amber Review" | "Reviewed Mock" | "Testing Bypass Used" | "No Escalation" | "Future Approval Required";
type SignalSource = "Margin Authority" | "Customer Score" | "Capacity Fit" | "Pricing Posture" | "Revenue Realization" | "P&L Confidence";

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

// Internal (non-exported) unions referenced by the proposal interfaces.
type ProposalStatus = "Not Started" | "Drafting" | "Linked to Quote Scenario" | "Client-Facing Draft Mock" | "Negotiation Round Active" | "Revised Mock" | "Mock Reviewed" | "Superseded Mock";
type ProposalType = "Standard Proposal" | "Revised Proposal" | "Negotiation Response" | "Internal Draft" | "Client-Facing Mock";
type ProposalReviewStatus = "Not Reviewed" | "Needs Commercial Review" | "Needs Finance Review" | "Needs Ops Review" | "Mock Reviewed" | "Future Approval Required";
type ProposalGateStatus = "No Gate" | "Future Gate Warning" | "Would Require Review in Production" | "Mock Bypass Available";
type NegotiationStatus = "Open" | "Responded Mock" | "Awaiting Client" | "Revised Proposal Needed" | "Closed Mock";

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

/**
 * Legacy compatibility lookup. Commercial proposal-version records have no
 * established store in this build (the legacy prototype tables were never
 * canonical), so this returns an explicit empty list for every workspace.
 * The workspace's real proposal state loads through
 * lib/supabase-commercial-data.ts#fetchCommercialWorkspaceBundle.
 */
export function getProposalsForWorkspace(workspaceId: string): CommercialProposalVersion[] {
  void workspaceId;
  return [];
}

// Internal (non-exported) unions referenced by the SLA interfaces.
type SlaStatus = "Not Started" | "Draft Mock" | "Linked to Commercial Terms Mock" | "Pricing Lock Warning" | "Ops Review Needed" | "Legal Review Needed" | "Mock Reviewed" | "Ready for Future Contracting";
type SlaType = "Warehousing SLA" | "Emergency Storage SLA" | "Transport Add-On SLA" | "Master Service SLA" | "Client-Facing Mock" | "Internal Draft";
type PricingLockStatus = "Not Locked" | "Mock Linked" | "Pricing Lock Warning" | "Future Lock Required" | "Mock Reviewed";
type CommercialTermsStatus = "Missing" | "Draft Mock" | "Linked to Proposal Mock" | "Future Approval Required" | "Mock Reviewed";
type SlaReviewStatus = "Not Reviewed" | "Needs Ops Review" | "Needs Legal Review" | "Needs Commercial Review" | "Mock Reviewed" | "Future Approval Required";
type SlaGateStatus = "No Gate" | "Future Gate Warning" | "Would Require Review in Production" | "Mock Bypass Available";
type SectionCategory = "Service Scope" | "Operating Hours" | "KPIs" | "Reporting" | "Escalation Matrix" | "Responsibilities" | "Commercial Terms" | "Legal Terms" | "Handover" | "Exclusions";

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

// Internal (non-exported) unions referenced by the activity/audit interfaces.
type ActivityCategory = "Workspace" | "Quote" | "Pricing" | "P&L" | "Margin" | "Customer Score" | "Capacity" | "Pricing Posture" | "Revenue Timing" | "Escalation" | "Proposal" | "Negotiation" | "SLA" | "Review" | "CRM Mock";
type AuditCategory = "WORKSPACE" | "QUOTE" | "PRICING" | "PNL" | "MARGIN" | "CUSTOMER_SCORE" | "CAPACITY" | "PRICING_POSTURE" | "REVENUE_TIMING" | "ESCALATION" | "PROPOSAL" | "NEGOTIATION" | "SLA" | "CRM_SYNC" | "SYSTEM";
type EventSeverity = "Info" | "Warning" | "High" | "Critical";

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
