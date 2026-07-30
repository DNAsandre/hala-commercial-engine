/**
 * Proposal Workspace — Centralized state types and defaults.
 * Used by stages 1-4 (Qualified → P&L) and beyond.
 */

// ══════════════════════════════════════════════════════
// STAGE 1 — QUALIFIED
// ══════════════════════════════════════════════════════

export interface QualificationSummary {
  opportunityName: string;
  customer: string;
  region: string;
  industry: string;
  serviceType: string;
  estimatedRevenue: number;
  estimatedPallets: number;
  expectedCloseDate: string;
  crmRef: string;
  leadSource: string;
  qualificationConfidence: number; // 0-100
}

export interface CustomerFit {
  icpFit: "strong" | "moderate" | "weak" | "";
  strategicFit: "strong" | "moderate" | "weak" | "";
  regionFit: "strong" | "moderate" | "weak" | "";
  capabilityFit: "strong" | "moderate" | "weak" | "";
  relationshipStrength: "strong" | "moderate" | "weak" | "";
  competitorPresence: "none" | "low" | "high" | "incumbent" | "";
  fitScore: "green" | "amber" | "red" | "";
  strategicFindings: string;
}

export interface OpportunityBrief {
  customerNeed: string;
  whyNow: string;
  scopeSummary: string;
  keyStakeholders: string;
  decisionTimeline: string;
  knownConstraints: string;
}

export interface RequiredInfoItem {
  label: string;
  key: string;
  complete: boolean;
  notes: string;
}

export const DEFAULT_REQUIRED_INFO: RequiredInfoItem[] = [
  { label: "Customer Volumes", key: "volumes", complete: false, notes: "" },
  { label: "Site Info", key: "site_info", complete: false, notes: "" },
  { label: "Required Services", key: "services", complete: false, notes: "" },
  { label: "Budget Insight", key: "budget", complete: false, notes: "" },
  { label: "Deadline", key: "deadline", complete: false, notes: "" },
  { label: "Customer Requirements Doc", key: "requirements", complete: false, notes: "" },
  { label: "Internal Owner Assigned", key: "owner", complete: false, notes: "" },
];

// ══════════════════════════════════════════════════════
// STAGE 2 — DISCOVERY
// ══════════════════════════════════════════════════════

export interface MeetingNote {
  id: string;
  date: string;
  attendees: string;
  notes: string;
  keyDecisions: string;
  openQuestions: string;
  nextActions: string;
}

export interface CustomerNeeds {
  warehousing: string;
  transport: string;
  vas: string;
  reporting: string;
  compliance: string;
  slaExpectations: string;
}

export interface CurrentPain {
  currentProvider: string;
  costPain: string;
  servicePain: string;
  speedPain: string;
  compliancePain: string;
}

export interface VolumesLanesStorage {
  skuCount: string;
  inbound: string;
  outbound: string;
  pallets: string;
  locations: string;
  laneMatrix: string;
  tempZones: string;
  peakSeasonality: string;
}

export interface RisksAssumptions {
  unknowns: string;
  dataGaps: string;
  customerUncertainty: string;
  capacityAssumptions: string;
  commercialAssumptions: string;
}

// ══════════════════════════════════════════════════════
// STAGE 3 — SOLUTION DESIGN
// ══════════════════════════════════════════════════════

export interface SolutionConfiguration {
  solutionOverview: string;
  operatingModel: string;
  serviceMix: string;
  geographicCoverage: string;
  designRationale: string;
  handoverNotes: string;
}

export interface WarehouseModel {
  storageType: string;
  facilityType: string;
  capacityEstimate: string;
  handlingAssumptions: string;
  tempZones: string;
  laborAssumptions: string;
}

export interface TransportModel {
  laneStructure: string;
  vehicleTypes: string;
  frequency: string;
  sla: string;
  routeComplexity: string;
  vendorRequirements: string;
}

export interface VasHandling {
  labeling: string;
  kitting: string;
  packaging: string;
  returns: string;
  compliance: string;
  specializedHandling: string;
}

export interface SystemsVisibility {
  wmsRequirements: string;
  tmsRequirements: string;
  reportingDashboards: string;
  integrationNeeds: string;
  customerPortal: string;
  dataExchange: string;
}

export interface ServiceScope {
  included: string;
  excluded: string;
  customerResponsibilities: string;
  halaResponsibilities: string;
  kpiScope: string;
}

export interface OperationalFeasibility {
  capacityFit: "fit" | "tight" | "gap" | "";
  equipmentFit: "fit" | "tight" | "gap" | "";
  regionFit: "fit" | "tight" | "gap" | "";
  opsComments: string;
  riskFlags: string;
}

export interface AssumptionsDependencies {
  customerInputs: string;
  halaDependencies: string;
  timingAssumptions: string;
  volumeAssumptions: string;
  commercialDependencies: string;
  openDecisions: string;
}

// ══════════════════════════════════════════════════════
// STAGE 4 — P&L / PRICING
// ══════════════════════════════════════════════════════

export interface PnlLine {
  label: string;
  amount: number;
}

export interface PnlVersion {
  id: string;
  name: string;
  createdAt: string;
  revenue: PnlLine[];
  costs: PnlLine[];
  overheadPercent: number;
  notes: string;
  isApproved: boolean;
}

export interface CostInput {
  category: string;
  description: string;
  amount: number;
  source: string;
  verified: boolean;
}

export interface PricingLine {
  service: string;
  unit: string;
  rate: number;
  quantity: number;
  frequency: string;
  total: number;
}

export interface MarginScenario {
  name: string;
  revenue: number;
  cost: number;
  gp: number;
  gpPercent: number;
  notes: string;
}

export interface CommercialTerms {
  vat: string;
  paymentTerms: string;
  proposalValidity: string;
  contractDuration: string;
  renewalNotice: string;
  mobilization: string;
  workingDays: string;
  workingHours: string;
  forecastNotice: string;
  loadingResponsibility: string;
  offloadingResponsibility: string;
  permits: string;
  weightLimits: string;
  insurance: string;
  liabilityExclusions: string;
  overtime: string;
  cancellation: string;
  detention: string;
  demurrage: string;
  fuelSurcharge: string;
  policyChangeClause: string;
  additionalChargeApproval: string;
}

export interface PricingAssumptionsExclusions {
  pricingAssumptions: string;
  operationalAssumptions: string;
  volumeAssumptions: string;
  customerResponsibilities: string;
  halaResponsibilities: string;
  exclusions: string;
  dependencies: string;
  limitations: string;
  commercialRiskNotes: string;
  pricingApprovalNotes: string;
}

// STAGE 5 - QUOTE

export interface QuoteSummary {
  quoteTitle: string;
  quoteDate: string;
  quoteOwner: string;
  quoteVersion: string;
  customerName: string;
  quotedServices: string;
  quoteNarrative: string;
  internalNotes: string;
}

export interface QuoteServiceScope {
  includedServices: string;
  excludedServices: string;
  serviceLocations: string;
  serviceLevels: string;
  customerResponsibilities: string;
  halaResponsibilities: string;
}

export interface QuotePricingSummary {
  linkedPnlVersionId: string;
  linkedPnlVersionName: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitPercent: number;
  pricingSummary: string;
  pricingTableNotes: string;
}

export interface QuoteTermsAssumptionsExclusions {
  paymentTerms: string;
  validity: string;
  contractTerm: string;
  vat: string;
  assumptions: string;
  exclusions: string;
  dependencies: string;
  riskNotes: string;
}

export interface QuoteVersion {
  id: string;
  versionLabel: string;
  createdAt: string;
  status: string;
  notes: string;
}

// STAGE 6 - PROPOSAL DRAFTING

export interface ProposalTocSection {
  id: string;
  sectionTitle: string;
  volume: string;
  purpose: string;
  sourceStage: string;
  includeInProposal: boolean;
  notes: string;
}

export interface ProposalSourceMapItem {
  id: string;
  sourceStage: string;
  sourceTab: string;
  sourceField: string;
  targetSectionId: string;
  usageNotes: string;
}

export interface ProposalDraftBlock {
  id: string;
  sectionId: string;
  blockTitle: string;
  volume: string;
  owner: string;
  status: string;
  sourceRefs: string;
  content: string;
}

export interface ProposalTechnicalVolume {
  solutionOverview: string;
  warehouseOperations: string;
  transportOperations: string;
  systemsVisibility: string;
  serviceLevels: string;
  implementationNotes: string;
}

export interface ProposalCommercialVolume {
  pricingNarrative: string;
  commercialTerms: string;
  assumptionsExclusions: string;
  valueNarrative: string;
  riskNotes: string;
}

export interface ProposalEvidenceItem {
  id: string;
  evidenceTitle: string;
  evidenceType: string;
  sourceStage: string;
  linkedSectionId: string;
  documentRef: string;
  notes: string;
}

export interface ProposalAppendixNotes {
  appendixPlan: string;
  evidenceGaps: string;
  formattingNotes: string;
}

export interface ProposalFinalDraftReview {
  reviewOwner: string;
  reviewDate: string;
  readinessNotes: string;
  openIssues: string;
  nextAction: string;
}

// STAGE 7 - PROPOSAL SENT

export interface ProposalSentVersion {
  sentVersionLabel: string;
  sourceDraftReference: string;
  proposalTitle: string;
  sentStatus: string;
  sentDocumentRef: string;
  notes: string;
}

export interface ProposalDeliveryRecord {
  sentDate: string;
  sentTime: string;
  channel: string;
  sentBy: string;
  deliveryStatus: string;
  deliveryNotes: string;
}

export interface ProposalRecipientContact {
  id: string;
  contactName: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  included: boolean;
  notes: string;
}

export interface ProposalSentAttachment {
  id: string;
  documentName: string;
  category: string;
  versionLabel: string;
  documentRef: string;
  included: boolean;
  notes: string;
}

export interface ProposalCrmSyncRecord {
  crmOpportunityRef: string;
  crmStage: string;
  syncStatus: string;
  recordedBy: string;
  recordedAt: string;
  notes: string;
}

export interface ProposalSentAuditNote {
  id: string;
  eventDate: string;
  actor: string;
  action: string;
  notes: string;
}

// STAGE 8 - NEGOTIATION

export interface ProposalCustomerFeedback {
  id: string;
  feedbackDate: string;
  contactName: string;
  feedbackType: string;
  feedbackSummary: string;
  sentiment: string;
  owner: string;
  nextAction: string;
}

export interface ProposalRequestedScopeChange {
  id: string;
  changeArea: string;
  requestedChange: string;
  operationalImpact: string;
  status: string;
  owner: string;
  notes: string;
}

export interface ProposalPricingChange {
  id: string;
  serviceLine: string;
  requestedChange: string;
  revisedPrice: string;
  commercialImpact: string;
  status: string;
  notes: string;
}

export interface ProposalNegotiationMarginImpact {
  linkedPnlVersion: string;
  revenueImpact: string;
  costImpact: string;
  grossProfitImpact: string;
  marginNotes: string;
  approvalNotes: string;
}

export interface ProposalRevisedVersion {
  id: string;
  versionLabel: string;
  sourceVersion: string;
  changeSummary: string;
  documentRef: string;
  status: string;
  notes: string;
}

export interface ProposalNegotiationNote {
  id: string;
  noteDate: string;
  actor: string;
  discussionSummary: string;
  decision: string;
  nextAction: string;
}

export interface ProposalApprovalSummary {
  reviewOwner: string;
  reviewDate: string;
  reviewStatus: string;
  proposalVersion: string;
  reviewScope: string;
  summaryNotes: string;
}

export interface ProposalMarginTermsReview {
  linkedPnlVersion: string;
  finalRevenue: string;
  finalCost: string;
  finalGrossProfit: string;
  finalGpPercent: string;
  marginPosition: string;
  paymentTermsPosition: string;
  commercialTermsPosition: string;
}

export interface ProposalRiskExceptionNotes {
  riskSummary: string;
  exceptionSummary: string;
  mitigationNotes: string;
  unresolvedItems: string;
  customerDependencies: string;
}

export interface ProposalFinalCommercialPosition {
  finalScopePosition: string;
  finalPricingPosition: string;
  finalTermsPosition: string;
  negotiationCarryForward: string;
  valueJustification: string;
  handoverNotes: string;
}

export interface ProposalApprovalRecord {
  recordedDecision: string;
  recordedBy: string;
  recordedDate: string;
  reference: string;
  conditions: string;
  nextAction: string;
}

export interface ProposalSignedContractReference {
  contractTitle: string;
  contractNumber: string;
  finalCustomer: string;
  signedDate: string;
  customerSignatory: string;
  halaSignatory: string;
  contractDocumentRef: string;
  notes: string;
}

export interface ProposalFinalContractScope {
  finalServiceScope: string;
  finalLocations: string;
  finalVolumes: string;
  halaResponsibilities: string;
  customerResponsibilities: string;
  exclusions: string;
}

export interface ProposalFinalContractPricing {
  linkedCommercialApproval: string;
  finalRevenue: string;
  finalCost: string;
  finalGrossProfit: string;
  finalGpPercent: string;
  pricingNotes: string;
}

export interface ProposalFinalContractTerms {
  paymentTerms: string;
  contractTerm: string;
  startDate: string;
  renewalNotice: string;
  liabilityPosition: string;
  terminationTerms: string;
  finalSlaKpiNotes: string;
  specialConditions: string;
}

export interface ProposalContractHandoverPrep {
  handoverOwner: string;
  operationsOwner: string;
  handoverDate: string;
  mobilisationNotes: string;
  openActions: string;
  contractMemoryNotes: string;
}

// STAGE 11 - GO-LIVE

export interface ProposalGoLiveSummary {
  goLiveDate: string;
  goLiveStatus: string;
  commercialOwner: string;
  operationalOwner: string;
  customerContact: string;
  commercialPromiseSummary: string;
}

export interface ProposalMobilizationTracker {
  mobilizationStatus: string;
  mobilizationStartDate: string;
  targetGoLiveDate: string;
  facilityReadiness: string;
  resourceReadiness: string;
  systemsReadiness: string;
  customerReadiness: string;
  mobilizationNotes: string;
}

export interface ProposalOperationsHandover {
  operationsOwner: string;
  handoverDate: string;
  handoverChecklist: string;
  finalScopeReference: string;
  keyResponsibilities: string;
  handoverNotes: string;
}

export interface ProposalSlaKpiSetup {
  serviceLevelSummary: string;
  kpiDefinitions: string;
  measurementMethod: string;
  reportingCadence: string;
  exclusions: string;
  openSlaKpiNotes: string;
}

export interface ProposalOpenImplementationRisks {
  riskSummary: string;
  customerDependencies: string;
  operationalRisks: string;
  commercialRisks: string;
  mitigationPlan: string;
  owner: string;
  status: string;
}

export interface ProposalRenewalFutureMemory {
  renewalBaselineNotes: string;
  noticePeriodMemory: string;
  futureOpportunityNotes: string;
  expansionPotential: string;
  contractReviewNotes: string;
  memoryOwner: string;
}

// ══════════════════════════════════════════════════════
// FULL WORKSPACE STATE
// ══════════════════════════════════════════════════════

export interface ProposalWorkspaceData {
  // Stage 1
  qualificationSummary: QualificationSummary;
  customerFit: CustomerFit;
  opportunityBrief: OpportunityBrief;
  requiredInfo: RequiredInfoItem[];

  // Stage 2
  meetingNotes: MeetingNote[];
  customerNeeds: CustomerNeeds;
  currentPain: CurrentPain;
  volumesLanes: VolumesLanesStorage;
  risksAssumptions: RisksAssumptions;

  // Stage 3
  solutionConfiguration: SolutionConfiguration;
  warehouseModel: WarehouseModel;
  transportModel: TransportModel;
  vasHandling: VasHandling;
  systemsVisibility: SystemsVisibility;
  serviceScope: ServiceScope;
  operationalFeasibility: OperationalFeasibility;
  assumptionsDependencies: AssumptionsDependencies;

  // Stage 4
  pnlVersions: PnlVersion[];
  activePnlVersion: string; // version id
  costInputs: CostInput[];
  pricingLines: PricingLine[];
  marginScenarios: MarginScenario[];
  commercialTerms: CommercialTerms;
  pricingAssumptionsExclusions: PricingAssumptionsExclusions;

  // Stage 5
  quoteSummary: QuoteSummary;
  quoteServiceScope: QuoteServiceScope;
  quotePricingSummary: QuotePricingSummary;
  quoteTermsAssumptionsExclusions: QuoteTermsAssumptionsExclusions;
  quoteVersions: QuoteVersion[];

  // Stage 6
  proposalTocSections: ProposalTocSection[];
  proposalSourceMap: ProposalSourceMapItem[];
  proposalDraftBlocks: ProposalDraftBlock[];
  proposalTechnicalVolume: ProposalTechnicalVolume;
  proposalCommercialVolume: ProposalCommercialVolume;
  proposalEvidenceItems: ProposalEvidenceItem[];
  proposalAppendixNotes: ProposalAppendixNotes;
  proposalFinalDraftReview: ProposalFinalDraftReview;

  // Stage 7
  proposalSentVersion: ProposalSentVersion;
  proposalDeliveryRecord: ProposalDeliveryRecord;
  proposalRecipientContacts: ProposalRecipientContact[];
  proposalSentAttachments: ProposalSentAttachment[];
  proposalCrmSyncRecord: ProposalCrmSyncRecord;
  proposalSentAuditNotes: ProposalSentAuditNote[];

  // Stage 8
  proposalCustomerFeedback: ProposalCustomerFeedback[];
  proposalRequestedScopeChanges: ProposalRequestedScopeChange[];
  proposalPricingChanges: ProposalPricingChange[];
  proposalNegotiationMarginImpact: ProposalNegotiationMarginImpact;
  proposalRevisedVersions: ProposalRevisedVersion[];
  proposalNegotiationNotes: ProposalNegotiationNote[];

  // Stage 9
  proposalApprovalSummary: ProposalApprovalSummary;
  proposalMarginTermsReview: ProposalMarginTermsReview;
  proposalRiskExceptionNotes: ProposalRiskExceptionNotes;
  proposalFinalCommercialPosition: ProposalFinalCommercialPosition;
  proposalApprovalRecord: ProposalApprovalRecord;

  // Stage 10
  proposalSignedContractReference: ProposalSignedContractReference;
  proposalFinalContractScope: ProposalFinalContractScope;
  proposalFinalContractPricing: ProposalFinalContractPricing;
  proposalFinalContractTerms: ProposalFinalContractTerms;
  proposalContractHandoverPrep: ProposalContractHandoverPrep;

  // Stage 11
  proposalGoLiveSummary: ProposalGoLiveSummary;
  proposalMobilizationTracker: ProposalMobilizationTracker;
  proposalOperationsHandover: ProposalOperationsHandover;
  proposalSlaKpiSetup: ProposalSlaKpiSetup;
  proposalOpenImplementationRisks: ProposalOpenImplementationRisks;
  proposalRenewalFutureMemory: ProposalRenewalFutureMemory;
}

export function createDefaultWorkspaceData(): ProposalWorkspaceData {
  return {
    qualificationSummary: {
      opportunityName: "", customer: "", region: "", industry: "",
      serviceType: "", estimatedRevenue: 0, estimatedPallets: 0,
      expectedCloseDate: "", crmRef: "", leadSource: "",
      qualificationConfidence: 0,
    },
    customerFit: {
      icpFit: "", strategicFit: "", regionFit: "",
      capabilityFit: "", relationshipStrength: "",
      competitorPresence: "", fitScore: "",
      strategicFindings: "",
    },
    opportunityBrief: {
      customerNeed: "", whyNow: "", scopeSummary: "",
      keyStakeholders: "", decisionTimeline: "", knownConstraints: "",
    },
    requiredInfo: [...DEFAULT_REQUIRED_INFO],
    meetingNotes: [],
    customerNeeds: {
      warehousing: "", transport: "", vas: "",
      reporting: "", compliance: "", slaExpectations: "",
    },
    currentPain: {
      currentProvider: "", costPain: "", servicePain: "",
      speedPain: "", compliancePain: "",
    },
    volumesLanes: {
      skuCount: "", inbound: "", outbound: "", pallets: "",
      locations: "", laneMatrix: "", tempZones: "", peakSeasonality: "",
    },
    risksAssumptions: {
      unknowns: "", dataGaps: "", customerUncertainty: "",
      capacityAssumptions: "", commercialAssumptions: "",
    },
    solutionConfiguration: {
      solutionOverview: "", operatingModel: "", serviceMix: "",
      geographicCoverage: "", designRationale: "", handoverNotes: "",
    },
    warehouseModel: {
      storageType: "", facilityType: "", capacityEstimate: "",
      handlingAssumptions: "", tempZones: "", laborAssumptions: "",
    },
    transportModel: {
      laneStructure: "", vehicleTypes: "", frequency: "",
      sla: "", routeComplexity: "", vendorRequirements: "",
    },
    vasHandling: {
      labeling: "", kitting: "", packaging: "",
      returns: "", compliance: "", specializedHandling: "",
    },
    systemsVisibility: {
      wmsRequirements: "", tmsRequirements: "", reportingDashboards: "",
      integrationNeeds: "", customerPortal: "", dataExchange: "",
    },
    serviceScope: {
      included: "", excluded: "", customerResponsibilities: "",
      halaResponsibilities: "", kpiScope: "",
    },
    operationalFeasibility: {
      capacityFit: "", equipmentFit: "", regionFit: "",
      opsComments: "", riskFlags: "",
    },
    assumptionsDependencies: {
      customerInputs: "", halaDependencies: "", timingAssumptions: "",
      volumeAssumptions: "", commercialDependencies: "", openDecisions: "",
    },
    pnlVersions: [],
    activePnlVersion: "",
    costInputs: [],
    pricingLines: [],
    marginScenarios: [
      { name: "Base Case", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Aggressive", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Defensive", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Strategic", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Customer Target", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
    ],
    commercialTerms: {
      vat: "", paymentTerms: "", proposalValidity: "", contractDuration: "",
      renewalNotice: "", mobilization: "", workingDays: "", workingHours: "",
      forecastNotice: "", loadingResponsibility: "", offloadingResponsibility: "",
      permits: "", weightLimits: "", insurance: "", liabilityExclusions: "",
      overtime: "", cancellation: "", detention: "", demurrage: "",
      fuelSurcharge: "", policyChangeClause: "", additionalChargeApproval: "",
    },
    pricingAssumptionsExclusions: {
      pricingAssumptions: "", operationalAssumptions: "", volumeAssumptions: "",
      customerResponsibilities: "", halaResponsibilities: "", exclusions: "",
      dependencies: "", limitations: "", commercialRiskNotes: "",
      pricingApprovalNotes: "",
    },
    quoteSummary: {
      quoteTitle: "", quoteDate: "", quoteOwner: "", quoteVersion: "",
      customerName: "", quotedServices: "", quoteNarrative: "", internalNotes: "",
    },
    quoteServiceScope: {
      includedServices: "", excludedServices: "", serviceLocations: "",
      serviceLevels: "", customerResponsibilities: "", halaResponsibilities: "",
    },
    quotePricingSummary: {
      linkedPnlVersionId: "", linkedPnlVersionName: "",
      totalRevenue: 0, totalCost: 0, grossProfit: 0, grossProfitPercent: 0,
      pricingSummary: "", pricingTableNotes: "",
    },
    quoteTermsAssumptionsExclusions: {
      paymentTerms: "", validity: "", contractTerm: "", vat: "",
      assumptions: "", exclusions: "", dependencies: "", riskNotes: "",
    },
    quoteVersions: [],
    proposalTocSections: [],
    proposalSourceMap: [],
    proposalDraftBlocks: [],
    proposalTechnicalVolume: {
      solutionOverview: "", warehouseOperations: "", transportOperations: "",
      systemsVisibility: "", serviceLevels: "", implementationNotes: "",
    },
    proposalCommercialVolume: {
      pricingNarrative: "", commercialTerms: "", assumptionsExclusions: "",
      valueNarrative: "", riskNotes: "",
    },
    proposalEvidenceItems: [],
    proposalAppendixNotes: {
      appendixPlan: "", evidenceGaps: "", formattingNotes: "",
    },
    proposalFinalDraftReview: {
      reviewOwner: "", reviewDate: "", readinessNotes: "",
      openIssues: "", nextAction: "",
    },
    proposalSentVersion: {
      sentVersionLabel: "", sourceDraftReference: "", proposalTitle: "",
      sentStatus: "", sentDocumentRef: "", notes: "",
    },
    proposalDeliveryRecord: {
      sentDate: "", sentTime: "", channel: "", sentBy: "",
      deliveryStatus: "", deliveryNotes: "",
    },
    proposalRecipientContacts: [],
    proposalSentAttachments: [],
    proposalCrmSyncRecord: {
      crmOpportunityRef: "", crmStage: "", syncStatus: "",
      recordedBy: "", recordedAt: "", notes: "",
    },
    proposalSentAuditNotes: [],
    proposalCustomerFeedback: [],
    proposalRequestedScopeChanges: [],
    proposalPricingChanges: [],
    proposalNegotiationMarginImpact: {
      linkedPnlVersion: "", revenueImpact: "", costImpact: "",
      grossProfitImpact: "", marginNotes: "", approvalNotes: "",
    },
    proposalRevisedVersions: [],
    proposalNegotiationNotes: [],
    proposalApprovalSummary: {
      reviewOwner: "", reviewDate: "", reviewStatus: "",
      proposalVersion: "", reviewScope: "", summaryNotes: "",
    },
    proposalMarginTermsReview: {
      linkedPnlVersion: "", finalRevenue: "", finalCost: "",
      finalGrossProfit: "", finalGpPercent: "", marginPosition: "",
      paymentTermsPosition: "", commercialTermsPosition: "",
    },
    proposalRiskExceptionNotes: {
      riskSummary: "", exceptionSummary: "", mitigationNotes: "",
      unresolvedItems: "", customerDependencies: "",
    },
    proposalFinalCommercialPosition: {
      finalScopePosition: "", finalPricingPosition: "", finalTermsPosition: "",
      negotiationCarryForward: "", valueJustification: "", handoverNotes: "",
    },
    proposalApprovalRecord: {
      recordedDecision: "", recordedBy: "", recordedDate: "",
      reference: "", conditions: "", nextAction: "",
    },
    proposalSignedContractReference: {
      contractTitle: "", contractNumber: "", signedDate: "",
      finalCustomer: "", customerSignatory: "", halaSignatory: "",
      contractDocumentRef: "", notes: "",
    },
    proposalFinalContractScope: {
      finalServiceScope: "", finalLocations: "", finalVolumes: "",
      halaResponsibilities: "", customerResponsibilities: "", exclusions: "",
    },
    proposalFinalContractPricing: {
      linkedCommercialApproval: "", finalRevenue: "", finalCost: "",
      finalGrossProfit: "", finalGpPercent: "", pricingNotes: "",
    },
    proposalFinalContractTerms: {
      paymentTerms: "", contractTerm: "", startDate: "",
      renewalNotice: "", liabilityPosition: "", terminationTerms: "",
      finalSlaKpiNotes: "", specialConditions: "",
    },
    proposalContractHandoverPrep: {
      handoverOwner: "", operationsOwner: "", handoverDate: "",
      mobilisationNotes: "", openActions: "", contractMemoryNotes: "",
    },
    proposalGoLiveSummary: {
      goLiveDate: "", goLiveStatus: "", commercialOwner: "",
      operationalOwner: "", customerContact: "", commercialPromiseSummary: "",
    },
    proposalMobilizationTracker: {
      mobilizationStatus: "", mobilizationStartDate: "", targetGoLiveDate: "",
      facilityReadiness: "", resourceReadiness: "", systemsReadiness: "",
      customerReadiness: "", mobilizationNotes: "",
    },
    proposalOperationsHandover: {
      operationsOwner: "", handoverDate: "", handoverChecklist: "",
      finalScopeReference: "", keyResponsibilities: "", handoverNotes: "",
    },
    proposalSlaKpiSetup: {
      serviceLevelSummary: "", kpiDefinitions: "", measurementMethod: "",
      reportingCadence: "", exclusions: "", openSlaKpiNotes: "",
    },
    proposalOpenImplementationRisks: {
      riskSummary: "", customerDependencies: "", operationalRisks: "",
      commercialRisks: "", mitigationPlan: "", owner: "", status: "",
    },
    proposalRenewalFutureMemory: {
      renewalBaselineNotes: "", noticePeriodMemory: "", futureOpportunityNotes: "",
      expansionPotential: "", contractReviewNotes: "", memoryOwner: "",
    },
  };
}

// ══════════════════════════════════════════════════════
// READINESS SCORES (advisory only)
// ══════════════════════════════════════════════════════

function hasStringValue(value: string): boolean {
  return value.trim().length > 0;
}

function hasNumberValue(value: number): boolean {
  return value !== 0;
}

function hasMeetingNoteContent(item: MeetingNote): boolean {
  return [item.date, item.attendees, item.notes, item.keyDecisions, item.openQuestions, item.nextActions].some(hasStringValue);
}

function hasPnlLineContent(item: PnlLine): boolean {
  return hasNumberValue(item.amount);
}

function hasPnlVersionContent(item: PnlVersion): boolean {
  return item.revenue.some(hasPnlLineContent) ||
    item.costs.some(hasPnlLineContent) ||
    hasNumberValue(item.overheadPercent) ||
    hasStringValue(item.notes);
}

function hasCostInputContent(item: CostInput): boolean {
  return [item.category, item.description, item.source].some(hasStringValue) || hasNumberValue(item.amount);
}

function hasPricingLineContent(item: PricingLine): boolean {
  return [item.service, item.unit, item.frequency].some(hasStringValue) ||
    [item.rate, item.quantity, item.total].some(hasNumberValue);
}

function hasQuoteVersionContent(item: QuoteVersion): boolean {
  return [item.versionLabel, item.createdAt, item.status, item.notes].some(hasStringValue);
}

function hasTocSectionContent(item: ProposalTocSection): boolean {
  return [item.sectionTitle, item.volume, item.purpose, item.sourceStage, item.notes].some(hasStringValue);
}

function hasSourceMapContent(item: ProposalSourceMapItem): boolean {
  return [item.sourceStage, item.sourceTab, item.sourceField, item.targetSectionId, item.usageNotes].some(hasStringValue);
}

function hasDraftBlockContent(item: ProposalDraftBlock): boolean {
  return [item.sectionId, item.blockTitle, item.volume, item.owner, item.status, item.sourceRefs, item.content].some(hasStringValue);
}

function hasEvidenceItemContent(item: ProposalEvidenceItem): boolean {
  return [item.evidenceTitle, item.evidenceType, item.sourceStage, item.linkedSectionId, item.documentRef, item.notes].some(hasStringValue);
}

export function calcQualificationReadiness(d: ProposalWorkspaceData): number {
  const qs = d.qualificationSummary;
  const cf = d.customerFit;
  const ob = d.opportunityBrief;
  const ri = d.requiredInfo;
  let score = 0, total = 0;
  // Summary fields
  const sFields = [qs.opportunityName, qs.customer, qs.region, qs.serviceType, qs.expectedCloseDate];
  sFields.forEach(f => { total++; if (f) score++; });
  if (qs.estimatedRevenue > 0) score++; total++;
  // Fit
  [cf.icpFit, cf.strategicFit, cf.regionFit, cf.capabilityFit].forEach(f => { total++; if (f) score++; });
  // Brief
  [ob.customerNeed, ob.scopeSummary].forEach(f => { total++; if (f) score++; });
  // Required info
  ri.forEach(r => { total++; if (r.complete) score++; });
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcDiscoveryCompleteness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  // Meeting notes
  total++; if (d.meetingNotes.some(hasMeetingNoteContent)) score++;
  // Needs
  const cn = d.customerNeeds;
  [cn.warehousing, cn.transport].forEach(f => { total++; if (f) score++; });
  // Volumes
  const vl = d.volumesLanes;
  [vl.pallets, vl.skuCount, vl.inbound, vl.outbound].forEach(f => { total++; if (f) score++; });
  // Pain
  const cp = d.currentPain;
  [cp.currentProvider, cp.costPain].forEach(f => { total++; if (f) score++; });
  // Risks
  total++; if (d.risksAssumptions.unknowns || d.risksAssumptions.dataGaps) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcSolutionReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  const sc = d.solutionConfiguration;
  [sc.solutionOverview, sc.operatingModel, sc.serviceMix, sc.geographicCoverage].forEach(f => { total++; if (f) score++; });
  const wm = d.warehouseModel;
  [wm.storageType, wm.capacityEstimate].forEach(f => { total++; if (f) score++; });
  const tm = d.transportModel;
  [tm.laneStructure, tm.vehicleTypes].forEach(f => { total++; if (f) score++; });
  const sv = d.systemsVisibility;
  [sv.wmsRequirements, sv.tmsRequirements, sv.reportingDashboards].forEach(f => { total++; if (f) score++; });
  const ss = d.serviceScope;
  [ss.included, ss.excluded].forEach(f => { total++; if (f) score++; });
  const of2 = d.operationalFeasibility;
  [of2.capacityFit, of2.equipmentFit].forEach(f => { total++; if (f) score++; });
  const ad = d.assumptionsDependencies;
  [ad.customerInputs, ad.halaDependencies, ad.timingAssumptions, ad.openDecisions].forEach(f => { total++; if (f) score++; });
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcPricingConfidence(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (d.pnlVersions.some(hasPnlVersionContent)) score++;
  total++; if (d.costInputs.some(hasCostInputContent)) score++;
  total++; if (d.pricingLines.some(hasPricingLineContent)) score++;
  total++; if (d.costInputs.some(c => c.verified && hasCostInputContent(c))) score++;
  total++; if (d.pnlVersions.some(v => v.isApproved && hasPnlVersionContent(v))) score++;
  total++; if (Object.values(d.commercialTerms).some(Boolean)) score++;
  total++; if (Object.values(d.pricingAssumptionsExclusions).some(Boolean)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcQuoteReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (Object.values(d.quoteSummary).some(Boolean)) score++;
  total++; if (Object.values(d.quoteServiceScope).some(Boolean)) score++;
  total++; if (d.quotePricingSummary.totalRevenue > 0 || d.quotePricingSummary.pricingSummary) score++;
  total++; if (Object.values(d.quoteTermsAssumptionsExclusions).some(Boolean)) score++;
  total++; if (d.quoteVersions.some(hasQuoteVersionContent)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcProposalDraftingReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (d.proposalTocSections.some(hasTocSectionContent)) score++;
  total++; if (d.proposalSourceMap.some(hasSourceMapContent)) score++;
  total++; if (d.proposalDraftBlocks.some(hasDraftBlockContent)) score++;
  total++; if (Object.values(d.proposalTechnicalVolume).some(Boolean)) score++;
  total++; if (Object.values(d.proposalCommercialVolume).some(Boolean)) score++;
  total++; if (d.proposalEvidenceItems.some(hasEvidenceItemContent) || Object.values(d.proposalAppendixNotes).some(Boolean)) score++;
  total++; if (Object.values(d.proposalFinalDraftReview).some(Boolean)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════

// AUDIT TRAIL — Proposal workspace activity logging
// ══════════════════════════════════════════════════════

export function calcProposalSentReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  const hasText = (value: string) => value.trim().length > 0;
  const hasRecipient = d.proposalRecipientContacts.some(contact =>
    [contact.contactName, contact.role, contact.company, contact.email, contact.phone, contact.notes].some(hasText)
  );
  const hasAttachment = d.proposalSentAttachments.some(attachment =>
    [attachment.documentName, attachment.category, attachment.versionLabel, attachment.documentRef, attachment.notes].some(hasText)
  );
  const hasAuditNote = d.proposalSentAuditNotes.some(note =>
    [note.eventDate, note.actor, note.action, note.notes].some(hasText)
  );
  total++; if (Object.values(d.proposalSentVersion).some(Boolean)) score++;
  total++; if (Object.values(d.proposalDeliveryRecord).some(Boolean)) score++;
  total++; if (hasRecipient) score++;
  total++; if (hasAttachment) score++;
  total++; if (Object.values(d.proposalCrmSyncRecord).some(Boolean)) score++;
  total++; if (hasAuditNote) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcNegotiationReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  const hasText = (value: string) => value.trim().length > 0;
  const hasFeedback = d.proposalCustomerFeedback.some(item =>
    [item.feedbackDate, item.contactName, item.feedbackType, item.feedbackSummary, item.sentiment, item.owner, item.nextAction].some(hasText)
  );
  const hasScopeChange = d.proposalRequestedScopeChanges.some(item =>
    [item.changeArea, item.requestedChange, item.operationalImpact, item.status, item.owner, item.notes].some(hasText)
  );
  const hasPricingChange = d.proposalPricingChanges.some(item =>
    [item.serviceLine, item.requestedChange, item.revisedPrice, item.commercialImpact, item.status, item.notes].some(hasText)
  );
  const hasRevisedVersion = d.proposalRevisedVersions.some(item =>
    [item.versionLabel, item.sourceVersion, item.changeSummary, item.documentRef, item.status, item.notes].some(hasText)
  );
  const hasNegotiationNote = d.proposalNegotiationNotes.some(item =>
    [item.noteDate, item.actor, item.discussionSummary, item.decision, item.nextAction].some(hasText)
  );
  total++; if (hasFeedback) score++;
  total++; if (hasScopeChange) score++;
  total++; if (hasPricingChange) score++;
  total++; if (Object.values(d.proposalNegotiationMarginImpact).some(Boolean)) score++;
  total++; if (hasRevisedVersion) score++;
  total++; if (hasNegotiationNote) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcCommercialApprovalReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (Object.values(d.proposalApprovalSummary).some(Boolean)) score++;
  total++; if (Object.values(d.proposalMarginTermsReview).some(Boolean)) score++;
  total++; if (Object.values(d.proposalRiskExceptionNotes).some(Boolean)) score++;
  total++; if (Object.values(d.proposalFinalCommercialPosition).some(Boolean)) score++;
  total++; if (Object.values(d.proposalApprovalRecord).some(Boolean)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcContractSignedReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (Object.values(d.proposalSignedContractReference).some(Boolean)) score++;
  total++; if (Object.values(d.proposalFinalContractScope).some(Boolean)) score++;
  total++; if (Object.values(d.proposalFinalContractPricing).some(Boolean)) score++;
  total++; if (Object.values(d.proposalFinalContractTerms).some(Boolean)) score++;
  total++; if (Object.values(d.proposalContractHandoverPrep).some(Boolean)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcGoLiveReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (Object.values(d.proposalGoLiveSummary).some(Boolean)) score++;
  total++; if (Object.values(d.proposalMobilizationTracker).some(Boolean)) score++;
  total++; if (Object.values(d.proposalOperationsHandover).some(Boolean)) score++;
  total++; if (Object.values(d.proposalSlaKpiSetup).some(Boolean)) score++;
  total++; if (Object.values(d.proposalOpenImplementationRisks).some(Boolean)) score++;
  total++; if (Object.values(d.proposalRenewalFutureMemory).some(Boolean)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export interface ProposalAuditEntry {
  id: string;
  workspaceId: string;
  timestamp: string;
  action: string;
  stage: string;
  tab: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  user: string;
  details: string;
}

// In-memory audit log only.
// Persistence belongs in Supabase after an approved schema/API path exists.
let _auditLog: ProposalAuditEntry[] = [];

export function getProposalAuditLog(workspaceId: string): ProposalAuditEntry[] {
  return _auditLog.filter(e => e.workspaceId === workspaceId);
}

export function logProposalAudit(entry: Omit<ProposalAuditEntry, "id" | "timestamp" | "user">) {
  const full: ProposalAuditEntry = {
    ...entry,
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    user: "Unknown user",
  };
  _auditLog.unshift(full);
  // Keep last 500 entries per workspace
  const wsEntries = _auditLog.filter(e => e.workspaceId === entry.workspaceId);
  if (wsEntries.length > 500) {
    const cutoff = wsEntries[499].timestamp;
    _auditLog = _auditLog.filter(e => e.workspaceId !== entry.workspaceId || e.timestamp >= cutoff);
  }
}

// Diff helper: detect which fields changed between old and new data
export function logDataChange(
  workspaceId: string,
  stage: string,
  tab: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
) {
  for (const key of Object.keys(newData)) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (typeof newVal === "object" && newVal !== null) continue; // Skip nested objects — log at leaf level
    if (oldVal !== newVal && (oldVal || newVal)) {
      logProposalAudit({
        workspaceId, action: "field_update", stage, tab,
        field: key,
        oldValue: String(oldVal ?? ""),
        newValue: String(newVal ?? ""),
        details: `${key} updated`,
      });
    }
  }
}
