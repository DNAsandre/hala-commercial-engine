import { supabase } from "./supabase";
import type {
  AssumptionsDependencies,
  CommercialTerms,
  CostInput,
  CustomerFit,
  CurrentPain,
  CustomerNeeds,
  MarginScenario,
  MeetingNote,
  OperationalFeasibility,
  OpportunityBrief,
  PnlLine,
  PnlVersion,
  ProposalAppendixNotes,
  ProposalApprovalRecord,
  ProposalApprovalSummary,
  ProposalCommercialVolume,
  ProposalContractHandoverPrep,
  ProposalCrmSyncRecord,
  ProposalCustomerFeedback,
  ProposalDeliveryRecord,
  ProposalDraftBlock,
  ProposalEvidenceItem,
  ProposalFinalDraftReview,
  ProposalFinalCommercialPosition,
  ProposalFinalContractPricing,
  ProposalFinalContractScope,
  ProposalFinalContractTerms,
  ProposalGoLiveSummary,
  ProposalMarginTermsReview,
  ProposalMobilizationTracker,
  ProposalNegotiationMarginImpact,
  ProposalNegotiationNote,
  ProposalOpenImplementationRisks,
  ProposalOperationsHandover,
  ProposalPricingChange,
  ProposalRecipientContact,
  ProposalRenewalFutureMemory,
  ProposalRequestedScopeChange,
  ProposalRiskExceptionNotes,
  ProposalRevisedVersion,
  ProposalSentAttachment,
  ProposalSentAuditNote,
  ProposalSentVersion,
  ProposalSignedContractReference,
  ProposalSlaKpiSetup,
  ProposalSourceMapItem,
  ProposalTechnicalVolume,
  ProposalTocSection,
  PricingAssumptionsExclusions,
  PricingLine,
  ProposalWorkspaceData,
  QualificationSummary,
  QuotePricingSummary,
  QuoteServiceScope,
  QuoteSummary,
  QuoteTermsAssumptionsExclusions,
  QuoteVersion,
  RequiredInfoItem,
  RisksAssumptions,
  ServiceScope,
  SolutionConfiguration,
  SystemsVisibility,
  TransportModel,
  VasHandling,
  VolumesLanesStorage,
  WarehouseModel,
} from "@/components/proposal-workspace/proposal-workspace-state";

export type ProposalQualifiedStageData = Pick<
  ProposalWorkspaceData,
  "qualificationSummary" | "customerFit" | "opportunityBrief" | "requiredInfo"
>;

export type ProposalDiscoveryStageData = Pick<
  ProposalWorkspaceData,
  "meetingNotes" | "customerNeeds" | "currentPain" | "volumesLanes" | "risksAssumptions"
>;

export type ProposalSolutionDesignStageData = Pick<
  ProposalWorkspaceData,
  | "solutionConfiguration"
  | "warehouseModel"
  | "transportModel"
  | "vasHandling"
  | "systemsVisibility"
  | "serviceScope"
  | "operationalFeasibility"
  | "assumptionsDependencies"
>;

export type ProposalPnlPricingStageData = Pick<
  ProposalWorkspaceData,
  | "pnlVersions"
  | "activePnlVersion"
  | "costInputs"
  | "pricingLines"
  | "marginScenarios"
  | "commercialTerms"
  | "pricingAssumptionsExclusions"
>;

export type ProposalQuoteStageData = Pick<
  ProposalWorkspaceData,
  | "quoteSummary"
  | "quoteServiceScope"
  | "quotePricingSummary"
  | "quoteTermsAssumptionsExclusions"
  | "quoteVersions"
>;

export type ProposalDraftingStageData = Pick<
  ProposalWorkspaceData,
  | "proposalTocSections"
  | "proposalSourceMap"
  | "proposalDraftBlocks"
  | "proposalTechnicalVolume"
  | "proposalCommercialVolume"
  | "proposalEvidenceItems"
  | "proposalAppendixNotes"
  | "proposalFinalDraftReview"
>;

export type ProposalSentStageData = Pick<
  ProposalWorkspaceData,
  | "proposalSentVersion"
  | "proposalDeliveryRecord"
  | "proposalRecipientContacts"
  | "proposalSentAttachments"
  | "proposalCrmSyncRecord"
  | "proposalSentAuditNotes"
>;

export type ProposalNegotiationStageData = Pick<
  ProposalWorkspaceData,
  | "proposalCustomerFeedback"
  | "proposalRequestedScopeChanges"
  | "proposalPricingChanges"
  | "proposalNegotiationMarginImpact"
  | "proposalRevisedVersions"
  | "proposalNegotiationNotes"
>;

export type ProposalCommercialApprovalStageData = Pick<
  ProposalWorkspaceData,
  | "proposalApprovalSummary"
  | "proposalMarginTermsReview"
  | "proposalRiskExceptionNotes"
  | "proposalFinalCommercialPosition"
  | "proposalApprovalRecord"
>;

export type ProposalContractSignedStageData = Pick<
  ProposalWorkspaceData,
  | "proposalSignedContractReference"
  | "proposalFinalContractScope"
  | "proposalFinalContractPricing"
  | "proposalFinalContractTerms"
  | "proposalContractHandoverPrep"
>;

export type ProposalGoLiveStageData = Pick<
  ProposalWorkspaceData,
  | "proposalGoLiveSummary"
  | "proposalMobilizationTracker"
  | "proposalOperationsHandover"
  | "proposalSlaKpiSetup"
  | "proposalOpenImplementationRisks"
  | "proposalRenewalFutureMemory"
>;

interface ProposalTicketRow {
  id: string;
  ticket_title: string | null;
  customer_name: string | null;
  company: string | null;
  region: string | null;
  industry: string | null;
  estimated_value: number | null;
  probability_percent: number | null;
  target_date: string | null;
  notes: string | null;
  source_type: string | null;
  source_reference: string | null;
  legacy_opportunity_id: string | null;
  type_details: Record<string, unknown> | null;
}

export interface ProposalQualifiedLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalQualifiedStageData>;
  savedData: Partial<ProposalQualifiedStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalDiscoveryLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalDiscoveryStageData>;
  savedData: Partial<ProposalDiscoveryStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalSolutionDesignLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalSolutionDesignStageData>;
  savedData: Partial<ProposalSolutionDesignStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalPnlPricingLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalPnlPricingStageData>;
  savedData: Partial<ProposalPnlPricingStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalQuoteLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalQuoteStageData>;
  savedData: Partial<ProposalQuoteStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalDraftingLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalDraftingStageData>;
  savedData: Partial<ProposalDraftingStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalSentLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalSentStageData>;
  savedData: Partial<ProposalSentStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalNegotiationLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalNegotiationStageData>;
  savedData: Partial<ProposalNegotiationStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalCommercialApprovalLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalCommercialApprovalStageData>;
  savedData: Partial<ProposalCommercialApprovalStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalContractSignedLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalContractSignedStageData>;
  savedData: Partial<ProposalContractSignedStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

export interface ProposalGoLiveLoadResult {
  ticketFound: boolean;
  baselineData: Partial<ProposalGoLiveStageData>;
  savedData: Partial<ProposalGoLiveStageData> | null;
  savedAt: string | null;
  source: "commercial_tickets";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function fitStatusValue(value: unknown): OperationalFeasibility["capacityFit"] {
  const normalized = text(value);
  return normalized === "fit" || normalized === "tight" || normalized === "gap" ? normalized : "";
}

function pickText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return "";
}

function normalizeRegion(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized.includes("riyadh")) return "riyadh";
  if (normalized.includes("jeddah")) return "jeddah";
  if (normalized.includes("dammam")) return "dammam";
  if (normalized.includes("central")) return "central";
  if (normalized.includes("western")) return "western";
  if (normalized.includes("eastern")) return "eastern";
  return normalized;
}

function normalizeServiceType(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("3pl") || normalized.includes("third party")) return "3pl";
  if (normalized.includes("warehouse") || normalized.includes("storage")) return "warehousing";
  if (normalized.includes("transport") || normalized.includes("fleet") || normalized.includes("lane")) return "transport";
  if (normalized.includes("cold")) return "cold_chain";
  if (normalized.includes("vas") || normalized.includes("value added")) return "vas";
  return value ? "custom" : "";
}

function normalizeLeadSource(value: string): QualificationSummary["leadSource"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("tender")) return "tender";
  if (normalized.includes("crm") || normalized.includes("opportunity")) return "existing";
  if (normalized.includes("customer") || normalized.includes("inbound")) return "inbound";
  if (normalized.includes("referral")) return "referral";
  if (normalized.includes("cold")) return "cold";
  return "";
}

function sanitizeQualificationSummary(value: unknown): Partial<QualificationSummary> {
  const source = asRecord(value);
  return {
    opportunityName: text(source.opportunityName),
    customer: text(source.customer),
    region: text(source.region),
    industry: text(source.industry),
    serviceType: text(source.serviceType),
    estimatedRevenue: numberValue(source.estimatedRevenue),
    estimatedPallets: numberValue(source.estimatedPallets),
    expectedCloseDate: text(source.expectedCloseDate),
    crmRef: text(source.crmRef),
    leadSource: text(source.leadSource),
    qualificationConfidence: numberValue(source.qualificationConfidence),
  };
}

function sanitizeCustomerFit(value: unknown): Partial<CustomerFit> {
  const source = asRecord(value);
  return {
    icpFit: text(source.icpFit) as CustomerFit["icpFit"],
    strategicFit: text(source.strategicFit) as CustomerFit["strategicFit"],
    regionFit: text(source.regionFit) as CustomerFit["regionFit"],
    capabilityFit: text(source.capabilityFit) as CustomerFit["capabilityFit"],
    relationshipStrength: text(source.relationshipStrength) as CustomerFit["relationshipStrength"],
    competitorPresence: text(source.competitorPresence) as CustomerFit["competitorPresence"],
    fitScore: text(source.fitScore) as CustomerFit["fitScore"],
    strategicFindings: text(source.strategicFindings),
  };
}

function sanitizeOpportunityBrief(value: unknown): Partial<OpportunityBrief> {
  const source = asRecord(value);
  return {
    customerNeed: text(source.customerNeed),
    whyNow: text(source.whyNow),
    scopeSummary: text(source.scopeSummary),
    keyStakeholders: text(source.keyStakeholders),
    decisionTimeline: text(source.decisionTimeline),
    knownConstraints: text(source.knownConstraints),
  };
}

function sanitizeRequiredInfo(value: unknown): RequiredInfoItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    const source = asRecord(item);
    return {
      label: text(source.label),
      key: text(source.key),
      complete: booleanValue(source.complete),
      notes: text(source.notes),
    };
  }).filter(item => item.label && item.key);
}

function sanitizeMeetingNotes(value: unknown): MeetingNote[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const notes = value.map((item, index) => {
    const source = asRecord(item);
    const id = text(source.id) || `meeting-note-${index + 1}`;
    const date = text(source.date);
    const attendees = text(source.attendees);
    const noteText = text(source.notes);
    const keyDecisions = text(source.keyDecisions);
    const openQuestions = text(source.openQuestions);
    const nextActions = text(source.nextActions);
    const hasContent = date || attendees || noteText || keyDecisions || openQuestions || nextActions;
    if (!hasContent) return null;
    return {
      id,
      date,
      attendees,
      notes: noteText,
      keyDecisions,
      openQuestions,
      nextActions,
    };
  }).filter((note): note is MeetingNote => Boolean(note));
  return notes.length > 0 ? notes : undefined;
}

function sanitizeCustomerNeeds(value: unknown): Partial<CustomerNeeds> {
  const source = asRecord(value);
  return {
    warehousing: text(source.warehousing),
    transport: text(source.transport),
    vas: text(source.vas),
    reporting: text(source.reporting),
    compliance: text(source.compliance),
    slaExpectations: text(source.slaExpectations),
  };
}

function sanitizeCurrentPain(value: unknown): Partial<CurrentPain> {
  const source = asRecord(value);
  return {
    currentProvider: text(source.currentProvider),
    costPain: text(source.costPain),
    servicePain: text(source.servicePain),
    speedPain: text(source.speedPain),
    compliancePain: text(source.compliancePain),
  };
}

function sanitizeVolumesLanes(value: unknown): Partial<VolumesLanesStorage> {
  const source = asRecord(value);
  return {
    skuCount: text(source.skuCount),
    inbound: text(source.inbound),
    outbound: text(source.outbound),
    pallets: text(source.pallets),
    locations: text(source.locations),
    laneMatrix: text(source.laneMatrix),
    tempZones: text(source.tempZones),
    peakSeasonality: text(source.peakSeasonality),
  };
}

function sanitizeRisksAssumptions(value: unknown): Partial<RisksAssumptions> {
  const source = asRecord(value);
  return {
    unknowns: text(source.unknowns),
    dataGaps: text(source.dataGaps),
    customerUncertainty: text(source.customerUncertainty),
    capacityAssumptions: text(source.capacityAssumptions),
    commercialAssumptions: text(source.commercialAssumptions),
  };
}

function sanitizeSolutionConfiguration(value: unknown): Partial<SolutionConfiguration> {
  const source = asRecord(value);
  return {
    solutionOverview: text(source.solutionOverview),
    operatingModel: text(source.operatingModel),
    serviceMix: text(source.serviceMix),
    geographicCoverage: text(source.geographicCoverage),
    designRationale: text(source.designRationale),
    handoverNotes: text(source.handoverNotes),
  };
}

function sanitizeWarehouseModel(value: unknown): Partial<WarehouseModel> {
  const source = asRecord(value);
  return {
    storageType: text(source.storageType),
    facilityType: text(source.facilityType),
    capacityEstimate: text(source.capacityEstimate),
    handlingAssumptions: text(source.handlingAssumptions),
    tempZones: text(source.tempZones),
    laborAssumptions: text(source.laborAssumptions),
  };
}

function sanitizeTransportModel(value: unknown): Partial<TransportModel> {
  const source = asRecord(value);
  return {
    laneStructure: text(source.laneStructure),
    vehicleTypes: text(source.vehicleTypes),
    frequency: text(source.frequency),
    sla: text(source.sla),
    routeComplexity: text(source.routeComplexity),
    vendorRequirements: text(source.vendorRequirements),
  };
}

function sanitizeVasHandling(value: unknown): Partial<VasHandling> {
  const source = asRecord(value);
  return {
    labeling: text(source.labeling),
    kitting: text(source.kitting),
    packaging: text(source.packaging),
    returns: text(source.returns),
    compliance: text(source.compliance),
    specializedHandling: text(source.specializedHandling),
  };
}

function sanitizeSystemsVisibility(value: unknown): Partial<SystemsVisibility> {
  const source = asRecord(value);
  return {
    wmsRequirements: text(source.wmsRequirements),
    tmsRequirements: text(source.tmsRequirements),
    reportingDashboards: text(source.reportingDashboards),
    integrationNeeds: text(source.integrationNeeds),
    customerPortal: text(source.customerPortal),
    dataExchange: text(source.dataExchange),
  };
}

function sanitizeServiceScope(value: unknown): Partial<ServiceScope> {
  const source = asRecord(value);
  return {
    included: text(source.included),
    excluded: text(source.excluded),
    customerResponsibilities: text(source.customerResponsibilities),
    halaResponsibilities: text(source.halaResponsibilities),
    kpiScope: text(source.kpiScope),
  };
}

function sanitizeOperationalFeasibility(value: unknown): Partial<OperationalFeasibility> {
  const source = asRecord(value);
  return {
    capacityFit: fitStatusValue(source.capacityFit),
    equipmentFit: fitStatusValue(source.equipmentFit),
    regionFit: fitStatusValue(source.regionFit),
    opsComments: text(source.opsComments),
    riskFlags: text(source.riskFlags),
  };
}

function sanitizeAssumptionsDependencies(value: unknown): Partial<AssumptionsDependencies> {
  const source = asRecord(value);
  return {
    customerInputs: text(source.customerInputs),
    halaDependencies: text(source.halaDependencies),
    timingAssumptions: text(source.timingAssumptions),
    volumeAssumptions: text(source.volumeAssumptions),
    commercialDependencies: text(source.commercialDependencies),
    openDecisions: text(source.openDecisions),
  };
}

function sanitizePnlLines(value: unknown): PnlLine[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    const source = asRecord(item);
    return {
      label: text(source.label),
      amount: numberValue(source.amount),
    };
  }).filter(line => line.amount !== 0);
}

function sanitizePnlVersions(value: unknown): PnlVersion[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const versions = value.map((item, index) => {
    const source = asRecord(item);
    const revenue = sanitizePnlLines(source.revenue) ?? [];
    const costs = sanitizePnlLines(source.costs) ?? [];
    const overheadPercent = numberValue(source.overheadPercent ?? source.overhead_percent);
    const notes = text(source.notes);
    const isApproved = booleanValue(source.isApproved ?? source.is_approved);
    const hasContent = revenue.length > 0 || costs.length > 0 || overheadPercent !== 0 || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `pnl-version-${index + 1}`,
      name: text(source.name) || `Version ${index + 1}`,
      createdAt: text(source.createdAt) || text(source.created_at),
      revenue,
      costs,
      overheadPercent,
      notes,
      isApproved,
    };
  }).filter((version): version is PnlVersion => Boolean(version));
  return versions.length > 0 ? versions : undefined;
}

function sanitizeCostInputs(value: unknown): CostInput[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    const source = asRecord(item);
    return {
      category: text(source.category),
      description: text(source.description),
      amount: numberValue(source.amount),
      source: text(source.source),
      verified: booleanValue(source.verified),
    };
  }).filter(input => input.category || input.description || input.amount > 0 || input.source);
}

function sanitizePricingLines(value: unknown): PricingLine[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    const source = asRecord(item);
    const rate = numberValue(source.rate ?? source.unit_rate);
    const quantity = numberValue(source.quantity);
    const savedTotal = numberValue(source.total ?? source.subtotal);
    return {
      service: text(source.service ?? source.category ?? source.description),
      unit: text(source.unit),
      rate,
      quantity,
      frequency: text(source.frequency),
      total: savedTotal > 0 ? savedTotal : rate * quantity,
    };
  }).filter(line => line.service || line.unit || line.rate > 0 || line.quantity > 0 || line.total > 0);
}

function sanitizeMarginScenarios(value: unknown): MarginScenario[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const scenarios = value.map((item, index) => {
    const source = asRecord(item);
    const revenue = numberValue(source.revenue);
    const cost = numberValue(source.cost);
    const savedGp = numberValue(source.gp);
    const gp = savedGp !== 0 ? savedGp : revenue - cost;
    const savedGpPercent = numberValue(source.gpPercent ?? source.gp_percent);
    const gpPercent = savedGpPercent !== 0 ? savedGpPercent : revenue > 0 ? (gp / revenue) * 100 : 0;
    return {
      name: text(source.name) || `Scenario ${index + 1}`,
      revenue,
      cost,
      gp,
      gpPercent,
      notes: text(source.notes),
    };
  }).filter(scenario =>
    scenario.revenue > 0
    || scenario.cost > 0
    || scenario.gp !== 0
    || scenario.gpPercent !== 0
    || scenario.notes
  );
  return scenarios.length > 0 ? scenarios : undefined;
}

function sanitizeCommercialTerms(value: unknown): Partial<CommercialTerms> {
  const source = asRecord(value);
  return {
    vat: text(source.vat),
    paymentTerms: text(source.paymentTerms ?? source.payment_terms),
    proposalValidity: text(source.proposalValidity ?? source.proposal_validity ?? source.validity),
    contractDuration: text(source.contractDuration ?? source.contract_duration ?? source.contract_term),
    renewalNotice: text(source.renewalNotice ?? source.renewal_notice),
    mobilization: text(source.mobilization),
    workingDays: text(source.workingDays ?? source.working_days),
    workingHours: text(source.workingHours ?? source.working_hours),
    forecastNotice: text(source.forecastNotice ?? source.forecast_notice),
    loadingResponsibility: text(source.loadingResponsibility ?? source.loading_responsibility),
    offloadingResponsibility: text(source.offloadingResponsibility ?? source.offloading_responsibility),
    permits: text(source.permits ?? source.permits_responsibility),
    weightLimits: text(source.weightLimits ?? source.weight_limits),
    insurance: text(source.insurance),
    liabilityExclusions: text(source.liabilityExclusions ?? source.liability_exclusions),
    overtime: text(source.overtime),
    cancellation: text(source.cancellation),
    detention: text(source.detention),
    demurrage: text(source.demurrage),
    fuelSurcharge: text(source.fuelSurcharge ?? source.fuel_surcharge),
    policyChangeClause: text(source.policyChangeClause ?? source.policy_change_clause),
    additionalChargeApproval: text(source.additionalChargeApproval ?? source.additional_charge_approval),
  };
}

function sanitizePricingAssumptionsExclusions(value: unknown): Partial<PricingAssumptionsExclusions> {
  const source = asRecord(value);
  return {
    pricingAssumptions: text(source.pricingAssumptions ?? source.pricing_assumptions ?? source.assumptions),
    operationalAssumptions: text(source.operationalAssumptions ?? source.operational_assumptions),
    volumeAssumptions: text(source.volumeAssumptions ?? source.volume_assumptions),
    customerResponsibilities: text(source.customerResponsibilities ?? source.customer_responsibilities),
    halaResponsibilities: text(source.halaResponsibilities ?? source.hala_responsibilities),
    exclusions: text(source.exclusions),
    dependencies: text(source.dependencies),
    limitations: text(source.limitations),
    commercialRiskNotes: text(source.commercialRiskNotes ?? source.commercial_risk_notes),
    pricingApprovalNotes: text(source.pricingApprovalNotes ?? source.pricing_approval_notes),
  };
}

function sanitizeQuoteSummary(value: unknown): Partial<QuoteSummary> {
  const source = asRecord(value);
  return {
    quoteTitle: text(source.quoteTitle ?? source.quote_title),
    quoteDate: text(source.quoteDate ?? source.quote_date),
    quoteOwner: text(source.quoteOwner ?? source.quote_owner),
    quoteVersion: text(source.quoteVersion ?? source.quote_version),
    customerName: text(source.customerName ?? source.customer_name),
    quotedServices: text(source.quotedServices ?? source.quoted_services),
    quoteNarrative: text(source.quoteNarrative ?? source.quote_narrative ?? source.summary),
    internalNotes: text(source.internalNotes ?? source.internal_notes),
  };
}

function sanitizeQuoteServiceScope(value: unknown): Partial<QuoteServiceScope> {
  const source = asRecord(value);
  return {
    includedServices: text(source.includedServices ?? source.included_services ?? source.included),
    excludedServices: text(source.excludedServices ?? source.excluded_services ?? source.excluded),
    serviceLocations: text(source.serviceLocations ?? source.service_locations ?? source.locations),
    serviceLevels: text(source.serviceLevels ?? source.service_levels ?? source.sla),
    customerResponsibilities: text(source.customerResponsibilities ?? source.customer_responsibilities),
    halaResponsibilities: text(source.halaResponsibilities ?? source.hala_responsibilities),
  };
}

function sanitizeQuotePricingSummary(value: unknown): Partial<QuotePricingSummary> {
  const source = asRecord(value);
  return {
    linkedPnlVersionId: text(source.linkedPnlVersionId ?? source.linked_pnl_version_id),
    linkedPnlVersionName: text(source.linkedPnlVersionName ?? source.linked_pnl_version_name),
    totalRevenue: numberValue(source.totalRevenue ?? source.total_revenue),
    totalCost: numberValue(source.totalCost ?? source.total_cost),
    grossProfit: numberValue(source.grossProfit ?? source.gross_profit),
    grossProfitPercent: numberValue(source.grossProfitPercent ?? source.gross_profit_percent),
    pricingSummary: text(source.pricingSummary ?? source.pricing_summary),
    pricingTableNotes: text(source.pricingTableNotes ?? source.pricing_table_notes),
  };
}

function sanitizeQuoteTermsAssumptionsExclusions(value: unknown): Partial<QuoteTermsAssumptionsExclusions> {
  const source = asRecord(value);
  return {
    paymentTerms: text(source.paymentTerms ?? source.payment_terms),
    validity: text(source.validity),
    contractTerm: text(source.contractTerm ?? source.contract_term),
    vat: text(source.vat),
    assumptions: text(source.assumptions),
    exclusions: text(source.exclusions),
    dependencies: text(source.dependencies),
    riskNotes: text(source.riskNotes ?? source.risk_notes),
  };
}

function sanitizeQuoteVersions(value: unknown): QuoteVersion[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const versions = value.map((item, index) => {
    const source = asRecord(item);
    const versionLabel = text(source.versionLabel ?? source.version_label);
    const createdAt = text(source.createdAt ?? source.created_at);
    const status = text(source.status);
    const notes = text(source.notes);
    const hasContent = versionLabel || createdAt || status || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `quote-version-${index + 1}`,
      versionLabel,
      createdAt,
      status,
      notes,
    };
  }).filter((version): version is QuoteVersion => Boolean(version));
  return versions.length > 0 ? versions : undefined;
}

function sanitizeProposalTocSections(value: unknown): ProposalTocSection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sections = value.map((item, index) => {
    const source = asRecord(item);
    const sectionTitle = text(source.sectionTitle ?? source.section_title);
    const volume = text(source.volume);
    const purpose = text(source.purpose);
    const sourceStage = text(source.sourceStage ?? source.source_stage);
    const notes = text(source.notes);
    const hasContent = sectionTitle || volume || purpose || sourceStage || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `toc-${index + 1}`,
      sectionTitle,
      volume,
      purpose,
      sourceStage,
      includeInProposal: source.includeInProposal === false || source.include_in_proposal === false ? false : true,
      notes,
    };
  }).filter((section): section is ProposalTocSection => Boolean(section));
  return sections.length > 0 ? sections : undefined;
}

function sanitizeProposalSourceMap(value: unknown): ProposalSourceMapItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const mappings = value.map((item, index) => {
    const source = asRecord(item);
    const sourceStage = text(source.sourceStage ?? source.source_stage);
    const sourceTab = text(source.sourceTab ?? source.source_tab);
    const sourceField = text(source.sourceField ?? source.source_field);
    const targetSectionId = text(source.targetSectionId ?? source.target_section_id);
    const usageNotes = text(source.usageNotes ?? source.usage_notes);
    const hasContent = sourceStage || sourceTab || sourceField || targetSectionId || usageNotes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `source-map-${index + 1}`,
      sourceStage,
      sourceTab,
      sourceField,
      targetSectionId,
      usageNotes,
    };
  }).filter((mapping): mapping is ProposalSourceMapItem => Boolean(mapping));
  return mappings.length > 0 ? mappings : undefined;
}

function sanitizeProposalDraftBlocks(value: unknown): ProposalDraftBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks = value.map((item, index) => {
    const source = asRecord(item);
    const sectionId = text(source.sectionId ?? source.section_id);
    const blockTitle = text(source.blockTitle ?? source.block_title);
    const volume = text(source.volume);
    const owner = text(source.owner);
    const status = text(source.status);
    const sourceRefs = text(source.sourceRefs ?? source.source_refs);
    const content = text(source.content);
    const hasContent = sectionId || blockTitle || volume || owner || status || sourceRefs || content;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `block-${index + 1}`,
      sectionId,
      blockTitle,
      volume,
      owner,
      status,
      sourceRefs,
      content,
    };
  }).filter((block): block is ProposalDraftBlock => Boolean(block));
  return blocks.length > 0 ? blocks : undefined;
}

function sanitizeProposalTechnicalVolume(value: unknown): Partial<ProposalTechnicalVolume> {
  const source = asRecord(value);
  return {
    solutionOverview: text(source.solutionOverview ?? source.solution_overview),
    warehouseOperations: text(source.warehouseOperations ?? source.warehouse_operations),
    transportOperations: text(source.transportOperations ?? source.transport_operations),
    systemsVisibility: text(source.systemsVisibility ?? source.systems_visibility),
    serviceLevels: text(source.serviceLevels ?? source.service_levels),
    implementationNotes: text(source.implementationNotes ?? source.implementation_notes),
  };
}

function sanitizeProposalCommercialVolume(value: unknown): Partial<ProposalCommercialVolume> {
  const source = asRecord(value);
  return {
    pricingNarrative: text(source.pricingNarrative ?? source.pricing_narrative),
    commercialTerms: text(source.commercialTerms ?? source.commercial_terms),
    assumptionsExclusions: text(source.assumptionsExclusions ?? source.assumptions_exclusions),
    valueNarrative: text(source.valueNarrative ?? source.value_narrative),
    riskNotes: text(source.riskNotes ?? source.risk_notes),
  };
}

function sanitizeProposalEvidenceItems(value: unknown): ProposalEvidenceItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item, index) => {
    const source = asRecord(item);
    const evidenceTitle = text(source.evidenceTitle ?? source.evidence_title);
    const evidenceType = text(source.evidenceType ?? source.evidence_type);
    const sourceStage = text(source.sourceStage ?? source.source_stage);
    const linkedSectionId = text(source.linkedSectionId ?? source.linked_section_id);
    const documentRef = text(source.documentRef ?? source.document_ref);
    const notes = text(source.notes);
    const hasContent = evidenceTitle || evidenceType || sourceStage || linkedSectionId || documentRef || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `evidence-${index + 1}`,
      evidenceTitle,
      evidenceType,
      sourceStage,
      linkedSectionId,
      documentRef,
      notes,
    };
  }).filter((item): item is ProposalEvidenceItem => Boolean(item));
  return items.length > 0 ? items : undefined;
}

function sanitizeProposalAppendixNotes(value: unknown): Partial<ProposalAppendixNotes> {
  const source = asRecord(value);
  return {
    appendixPlan: text(source.appendixPlan ?? source.appendix_plan),
    evidenceGaps: text(source.evidenceGaps ?? source.evidence_gaps),
    formattingNotes: text(source.formattingNotes ?? source.formatting_notes),
  };
}

function sanitizeProposalFinalDraftReview(value: unknown): Partial<ProposalFinalDraftReview> {
  const source = asRecord(value);
  return {
    reviewOwner: text(source.reviewOwner ?? source.review_owner),
    reviewDate: text(source.reviewDate ?? source.review_date),
    readinessNotes: text(source.readinessNotes ?? source.readiness_notes),
    openIssues: text(source.openIssues ?? source.open_issues),
    nextAction: text(source.nextAction ?? source.next_action),
  };
}

function sanitizeProposalSentVersion(value: unknown): Partial<ProposalSentVersion> {
  const source = asRecord(value);
  return {
    sentVersionLabel: text(source.sentVersionLabel ?? source.sent_version_label),
    sourceDraftReference: text(source.sourceDraftReference ?? source.source_draft_reference),
    proposalTitle: text(source.proposalTitle ?? source.proposal_title),
    sentStatus: text(source.sentStatus ?? source.sent_status),
    sentDocumentRef: text(source.sentDocumentRef ?? source.sent_document_ref),
    notes: text(source.notes),
  };
}

function sanitizeProposalDeliveryRecord(value: unknown): Partial<ProposalDeliveryRecord> {
  const source = asRecord(value);
  return {
    sentDate: text(source.sentDate ?? source.sent_date),
    sentTime: text(source.sentTime ?? source.sent_time),
    channel: text(source.channel),
    sentBy: text(source.sentBy ?? source.sent_by),
    deliveryStatus: text(source.deliveryStatus ?? source.delivery_status),
    deliveryNotes: text(source.deliveryNotes ?? source.delivery_notes),
  };
}

function sanitizeProposalRecipientContacts(value: unknown): ProposalRecipientContact[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const contacts = value.map((item, index) => {
    const source = asRecord(item);
    const contactName = text(source.contactName ?? source.contact_name);
    const role = text(source.role);
    const company = text(source.company);
    const email = text(source.email);
    const phone = text(source.phone);
    const notes = text(source.notes);
    const included = booleanValue(source.included);
    const hasContent = contactName || role || company || email || phone || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `recipient-${index + 1}`,
      contactName,
      role,
      company,
      email,
      phone,
      included,
      notes,
    };
  }).filter((contact): contact is ProposalRecipientContact => Boolean(contact));
  return contacts.length > 0 ? contacts : undefined;
}

function sanitizeProposalSentAttachments(value: unknown): ProposalSentAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value.map((item, index) => {
    const source = asRecord(item);
    const documentName = text(source.documentName ?? source.document_name);
    const category = text(source.category);
    const versionLabel = text(source.versionLabel ?? source.version_label);
    const documentRef = text(source.documentRef ?? source.document_ref);
    const notes = text(source.notes);
    const included = booleanValue(source.included);
    const hasContent = documentName || category || versionLabel || documentRef || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `sent-attachment-${index + 1}`,
      documentName,
      category,
      versionLabel,
      documentRef,
      included,
      notes,
    };
  }).filter((attachment): attachment is ProposalSentAttachment => Boolean(attachment));
  return attachments.length > 0 ? attachments : undefined;
}

function sanitizeProposalCrmSyncRecord(value: unknown): Partial<ProposalCrmSyncRecord> {
  const source = asRecord(value);
  return {
    crmOpportunityRef: text(source.crmOpportunityRef ?? source.crm_opportunity_ref),
    crmStage: text(source.crmStage ?? source.crm_stage),
    syncStatus: text(source.syncStatus ?? source.sync_status),
    recordedBy: text(source.recordedBy ?? source.recorded_by),
    recordedAt: text(source.recordedAt ?? source.recorded_at),
    notes: text(source.notes),
  };
}

function sanitizeProposalSentAuditNotes(value: unknown): ProposalSentAuditNote[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const notes = value.map((item, index) => {
    const source = asRecord(item);
    const eventDate = text(source.eventDate ?? source.event_date);
    const actor = text(source.actor);
    const action = text(source.action);
    const noteText = text(source.notes);
    const hasContent = eventDate || actor || action || noteText;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `sent-audit-${index + 1}`,
      eventDate,
      actor,
      action,
      notes: noteText,
    };
  }).filter((note): note is ProposalSentAuditNote => Boolean(note));
  return notes.length > 0 ? notes : undefined;
}

function sanitizeProposalCustomerFeedback(value: unknown): ProposalCustomerFeedback[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const feedback = value.map((item, index) => {
    const source = asRecord(item);
    const feedbackDate = text(source.feedbackDate ?? source.feedback_date);
    const contactName = text(source.contactName ?? source.contact_name);
    const feedbackType = text(source.feedbackType ?? source.feedback_type);
    const feedbackSummary = text(source.feedbackSummary ?? source.feedback_summary);
    const sentiment = text(source.sentiment);
    const owner = text(source.owner);
    const nextAction = text(source.nextAction ?? source.next_action);
    const hasContent = feedbackDate || contactName || feedbackType || feedbackSummary || sentiment || owner || nextAction;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `customer-feedback-${index + 1}`,
      feedbackDate,
      contactName,
      feedbackType,
      feedbackSummary,
      sentiment,
      owner,
      nextAction,
    };
  }).filter((item): item is ProposalCustomerFeedback => Boolean(item));
  return feedback.length > 0 ? feedback : undefined;
}

function sanitizeProposalRequestedScopeChanges(value: unknown): ProposalRequestedScopeChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const changes = value.map((item, index) => {
    const source = asRecord(item);
    const changeArea = text(source.changeArea ?? source.change_area);
    const requestedChange = text(source.requestedChange ?? source.requested_change);
    const operationalImpact = text(source.operationalImpact ?? source.operational_impact);
    const status = text(source.status);
    const owner = text(source.owner);
    const notes = text(source.notes);
    const hasContent = changeArea || requestedChange || operationalImpact || status || owner || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `scope-change-${index + 1}`,
      changeArea,
      requestedChange,
      operationalImpact,
      status,
      owner,
      notes,
    };
  }).filter((item): item is ProposalRequestedScopeChange => Boolean(item));
  return changes.length > 0 ? changes : undefined;
}

function sanitizeProposalPricingChanges(value: unknown): ProposalPricingChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const changes = value.map((item, index) => {
    const source = asRecord(item);
    const serviceLine = text(source.serviceLine ?? source.service_line);
    const requestedChange = text(source.requestedChange ?? source.requested_change);
    const revisedPrice = text(source.revisedPrice ?? source.revised_price);
    const commercialImpact = text(source.commercialImpact ?? source.commercial_impact);
    const status = text(source.status);
    const notes = text(source.notes);
    const hasContent = serviceLine || requestedChange || revisedPrice || commercialImpact || status || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `pricing-change-${index + 1}`,
      serviceLine,
      requestedChange,
      revisedPrice,
      commercialImpact,
      status,
      notes,
    };
  }).filter((item): item is ProposalPricingChange => Boolean(item));
  return changes.length > 0 ? changes : undefined;
}

function sanitizeProposalNegotiationMarginImpact(value: unknown): Partial<ProposalNegotiationMarginImpact> {
  const source = asRecord(value);
  return {
    linkedPnlVersion: text(source.linkedPnlVersion ?? source.linked_pnl_version),
    revenueImpact: text(source.revenueImpact ?? source.revenue_impact),
    costImpact: text(source.costImpact ?? source.cost_impact),
    grossProfitImpact: text(source.grossProfitImpact ?? source.gross_profit_impact),
    marginNotes: text(source.marginNotes ?? source.margin_notes),
    approvalNotes: text(source.approvalNotes ?? source.approval_notes),
  };
}

function sanitizeProposalRevisedVersions(value: unknown): ProposalRevisedVersion[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const versions = value.map((item, index) => {
    const source = asRecord(item);
    const versionLabel = text(source.versionLabel ?? source.version_label);
    const sourceVersion = text(source.sourceVersion ?? source.source_version);
    const changeSummary = text(source.changeSummary ?? source.change_summary);
    const documentRef = text(source.documentRef ?? source.document_ref);
    const status = text(source.status);
    const notes = text(source.notes);
    const hasContent = versionLabel || sourceVersion || changeSummary || documentRef || status || notes;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `revised-version-${index + 1}`,
      versionLabel,
      sourceVersion,
      changeSummary,
      documentRef,
      status,
      notes,
    };
  }).filter((item): item is ProposalRevisedVersion => Boolean(item));
  return versions.length > 0 ? versions : undefined;
}

function sanitizeProposalNegotiationNotes(value: unknown): ProposalNegotiationNote[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const notes = value.map((item, index) => {
    const source = asRecord(item);
    const noteDate = text(source.noteDate ?? source.note_date);
    const actor = text(source.actor);
    const discussionSummary = text(source.discussionSummary ?? source.discussion_summary);
    const decision = text(source.decision);
    const nextAction = text(source.nextAction ?? source.next_action);
    const hasContent = noteDate || actor || discussionSummary || decision || nextAction;
    if (!hasContent) return null;
    return {
      id: text(source.id) || `negotiation-note-${index + 1}`,
      noteDate,
      actor,
      discussionSummary,
      decision,
      nextAction,
    };
  }).filter((item): item is ProposalNegotiationNote => Boolean(item));
  return notes.length > 0 ? notes : undefined;
}

function sanitizeProposalApprovalSummary(value: unknown): Partial<ProposalApprovalSummary> {
  const source = asRecord(value);
  return {
    reviewOwner: text(source.reviewOwner ?? source.review_owner),
    reviewDate: text(source.reviewDate ?? source.review_date),
    reviewStatus: text(source.reviewStatus ?? source.review_status),
    proposalVersion: text(source.proposalVersion ?? source.proposal_version),
    reviewScope: text(source.reviewScope ?? source.review_scope),
    summaryNotes: text(source.summaryNotes ?? source.summary_notes),
  };
}

function sanitizeProposalMarginTermsReview(value: unknown): Partial<ProposalMarginTermsReview> {
  const source = asRecord(value);
  return {
    linkedPnlVersion: text(source.linkedPnlVersion ?? source.linked_pnl_version),
    finalRevenue: text(source.finalRevenue ?? source.final_revenue),
    finalCost: text(source.finalCost ?? source.final_cost),
    finalGrossProfit: text(source.finalGrossProfit ?? source.final_gross_profit),
    finalGpPercent: text(source.finalGpPercent ?? source.final_gp_percent),
    marginPosition: text(source.marginPosition ?? source.margin_position),
    paymentTermsPosition: text(source.paymentTermsPosition ?? source.payment_terms_position),
    commercialTermsPosition: text(source.commercialTermsPosition ?? source.commercial_terms_position),
  };
}

function sanitizeProposalRiskExceptionNotes(value: unknown): Partial<ProposalRiskExceptionNotes> {
  const source = asRecord(value);
  return {
    riskSummary: text(source.riskSummary ?? source.risk_summary),
    exceptionSummary: text(source.exceptionSummary ?? source.exception_summary),
    mitigationNotes: text(source.mitigationNotes ?? source.mitigation_notes),
    unresolvedItems: text(source.unresolvedItems ?? source.unresolved_items),
    customerDependencies: text(source.customerDependencies ?? source.customer_dependencies),
  };
}

function sanitizeProposalFinalCommercialPosition(value: unknown): Partial<ProposalFinalCommercialPosition> {
  const source = asRecord(value);
  return {
    finalScopePosition: text(source.finalScopePosition ?? source.final_scope_position),
    finalPricingPosition: text(source.finalPricingPosition ?? source.final_pricing_position),
    finalTermsPosition: text(source.finalTermsPosition ?? source.final_terms_position),
    negotiationCarryForward: text(source.negotiationCarryForward ?? source.negotiation_carry_forward),
    valueJustification: text(source.valueJustification ?? source.value_justification),
    handoverNotes: text(source.handoverNotes ?? source.handover_notes),
  };
}

function sanitizeProposalApprovalRecord(value: unknown): Partial<ProposalApprovalRecord> {
  const source = asRecord(value);
  return {
    recordedDecision: text(source.recordedDecision ?? source.recorded_decision),
    recordedBy: text(source.recordedBy ?? source.recorded_by),
    recordedDate: text(source.recordedDate ?? source.recorded_date),
    reference: text(source.reference),
    conditions: text(source.conditions),
    nextAction: text(source.nextAction ?? source.next_action),
  };
}

function sanitizeProposalSignedContractReference(value: unknown): Partial<ProposalSignedContractReference> {
  const source = asRecord(value);
  return {
    contractTitle: text(source.contractTitle ?? source.contract_title),
    contractNumber: text(source.contractNumber ?? source.contract_number),
    finalCustomer: text(source.finalCustomer ?? source.final_customer),
    signedDate: text(source.signedDate ?? source.signed_date),
    customerSignatory: text(source.customerSignatory ?? source.customer_signatory),
    halaSignatory: text(source.halaSignatory ?? source.hala_signatory),
    contractDocumentRef: text(source.contractDocumentRef ?? source.contract_document_ref),
    notes: text(source.notes),
  };
}

function sanitizeProposalFinalContractScope(value: unknown): Partial<ProposalFinalContractScope> {
  const source = asRecord(value);
  return {
    finalServiceScope: text(source.finalServiceScope ?? source.final_service_scope),
    finalLocations: text(source.finalLocations ?? source.final_locations),
    finalVolumes: text(source.finalVolumes ?? source.final_volumes),
    halaResponsibilities: text(source.halaResponsibilities ?? source.hala_responsibilities),
    customerResponsibilities: text(source.customerResponsibilities ?? source.customer_responsibilities),
    exclusions: text(source.exclusions),
  };
}

function sanitizeProposalFinalContractPricing(value: unknown): Partial<ProposalFinalContractPricing> {
  const source = asRecord(value);
  return {
    linkedCommercialApproval: text(source.linkedCommercialApproval ?? source.linked_commercial_approval),
    finalRevenue: text(source.finalRevenue ?? source.final_revenue),
    finalCost: text(source.finalCost ?? source.final_cost),
    finalGrossProfit: text(source.finalGrossProfit ?? source.final_gross_profit),
    finalGpPercent: text(source.finalGpPercent ?? source.final_gp_percent),
    pricingNotes: text(source.pricingNotes ?? source.pricing_notes),
  };
}

function sanitizeProposalFinalContractTerms(value: unknown): Partial<ProposalFinalContractTerms> {
  const source = asRecord(value);
  return {
    paymentTerms: text(source.paymentTerms ?? source.payment_terms),
    contractTerm: text(source.contractTerm ?? source.contract_term),
    startDate: text(source.startDate ?? source.start_date),
    renewalNotice: text(source.renewalNotice ?? source.renewal_notice),
    liabilityPosition: text(source.liabilityPosition ?? source.liability_position),
    terminationTerms: text(source.terminationTerms ?? source.termination_terms),
    finalSlaKpiNotes: text(source.finalSlaKpiNotes ?? source.final_sla_kpi_notes),
    specialConditions: text(source.specialConditions ?? source.special_conditions),
  };
}

function sanitizeProposalContractHandoverPrep(value: unknown): Partial<ProposalContractHandoverPrep> {
  const source = asRecord(value);
  return {
    handoverOwner: text(source.handoverOwner ?? source.handover_owner),
    operationsOwner: text(source.operationsOwner ?? source.operations_owner),
    handoverDate: text(source.handoverDate ?? source.handover_date),
    mobilisationNotes: text(source.mobilisationNotes ?? source.mobilisation_notes),
    openActions: text(source.openActions ?? source.open_actions),
    contractMemoryNotes: text(source.contractMemoryNotes ?? source.contract_memory_notes),
  };
}

function sanitizeProposalGoLiveSummary(value: unknown): Partial<ProposalGoLiveSummary> {
  const source = asRecord(value);
  return {
    goLiveDate: text(source.goLiveDate ?? source.go_live_date),
    goLiveStatus: text(source.goLiveStatus ?? source.go_live_status),
    commercialOwner: text(source.commercialOwner ?? source.commercial_owner),
    operationalOwner: text(source.operationalOwner ?? source.operational_owner),
    customerContact: text(source.customerContact ?? source.customer_contact),
    commercialPromiseSummary: text(source.commercialPromiseSummary ?? source.commercial_promise_summary),
  };
}

function sanitizeProposalMobilizationTracker(value: unknown): Partial<ProposalMobilizationTracker> {
  const source = asRecord(value);
  return {
    mobilizationStatus: text(source.mobilizationStatus ?? source.mobilization_status),
    mobilizationStartDate: text(source.mobilizationStartDate ?? source.mobilization_start_date),
    targetGoLiveDate: text(source.targetGoLiveDate ?? source.target_go_live_date),
    facilityReadiness: text(source.facilityReadiness ?? source.facility_readiness),
    resourceReadiness: text(source.resourceReadiness ?? source.resource_readiness),
    systemsReadiness: text(source.systemsReadiness ?? source.systems_readiness),
    customerReadiness: text(source.customerReadiness ?? source.customer_readiness),
    mobilizationNotes: text(source.mobilizationNotes ?? source.mobilization_notes),
  };
}

function sanitizeProposalOperationsHandover(value: unknown): Partial<ProposalOperationsHandover> {
  const source = asRecord(value);
  return {
    operationsOwner: text(source.operationsOwner ?? source.operations_owner),
    handoverDate: text(source.handoverDate ?? source.handover_date),
    handoverChecklist: text(source.handoverChecklist ?? source.handover_checklist),
    finalScopeReference: text(source.finalScopeReference ?? source.final_scope_reference),
    keyResponsibilities: text(source.keyResponsibilities ?? source.key_responsibilities),
    handoverNotes: text(source.handoverNotes ?? source.handover_notes),
  };
}

function sanitizeProposalSlaKpiSetup(value: unknown): Partial<ProposalSlaKpiSetup> {
  const source = asRecord(value);
  return {
    serviceLevelSummary: text(source.serviceLevelSummary ?? source.service_level_summary),
    kpiDefinitions: text(source.kpiDefinitions ?? source.kpi_definitions),
    measurementMethod: text(source.measurementMethod ?? source.measurement_method),
    reportingCadence: text(source.reportingCadence ?? source.reporting_cadence),
    exclusions: text(source.exclusions),
    openSlaKpiNotes: text(source.openSlaKpiNotes ?? source.open_sla_kpi_notes),
  };
}

function sanitizeProposalOpenImplementationRisks(value: unknown): Partial<ProposalOpenImplementationRisks> {
  const source = asRecord(value);
  return {
    riskSummary: text(source.riskSummary ?? source.risk_summary),
    customerDependencies: text(source.customerDependencies ?? source.customer_dependencies),
    operationalRisks: text(source.operationalRisks ?? source.operational_risks),
    commercialRisks: text(source.commercialRisks ?? source.commercial_risks),
    mitigationPlan: text(source.mitigationPlan ?? source.mitigation_plan),
    owner: text(source.owner),
    status: text(source.status),
  };
}

function sanitizeProposalRenewalFutureMemory(value: unknown): Partial<ProposalRenewalFutureMemory> {
  const source = asRecord(value);
  return {
    renewalBaselineNotes: text(source.renewalBaselineNotes ?? source.renewal_baseline_notes),
    noticePeriodMemory: text(source.noticePeriodMemory ?? source.notice_period_memory),
    futureOpportunityNotes: text(source.futureOpportunityNotes ?? source.future_opportunity_notes),
    expansionPotential: text(source.expansionPotential ?? source.expansion_potential),
    contractReviewNotes: text(source.contractReviewNotes ?? source.contract_review_notes),
    memoryOwner: text(source.memoryOwner ?? source.memory_owner),
  };
}

export function sanitizeQualifiedStageData(value: Partial<ProposalQualifiedStageData>): Partial<ProposalQualifiedStageData> {
  const next: Partial<ProposalQualifiedStageData> = {};
  if (value.qualificationSummary) next.qualificationSummary = sanitizeQualificationSummary(value.qualificationSummary) as QualificationSummary;
  if (value.customerFit) next.customerFit = sanitizeCustomerFit(value.customerFit) as CustomerFit;
  if (value.opportunityBrief) next.opportunityBrief = sanitizeOpportunityBrief(value.opportunityBrief) as OpportunityBrief;
  const requiredInfo = sanitizeRequiredInfo(value.requiredInfo);
  if (requiredInfo) next.requiredInfo = requiredInfo;
  return next;
}

export function sanitizeDiscoveryStageData(value: Partial<ProposalDiscoveryStageData>): Partial<ProposalDiscoveryStageData> {
  const next: Partial<ProposalDiscoveryStageData> = {};
  const meetingNotes = sanitizeMeetingNotes(value.meetingNotes);
  if (meetingNotes) next.meetingNotes = meetingNotes;
  if (value.customerNeeds) next.customerNeeds = sanitizeCustomerNeeds(value.customerNeeds) as CustomerNeeds;
  if (value.currentPain) next.currentPain = sanitizeCurrentPain(value.currentPain) as CurrentPain;
  if (value.volumesLanes) next.volumesLanes = sanitizeVolumesLanes(value.volumesLanes) as VolumesLanesStorage;
  if (value.risksAssumptions) next.risksAssumptions = sanitizeRisksAssumptions(value.risksAssumptions) as RisksAssumptions;
  return next;
}

export function sanitizeSolutionDesignStageData(value: Partial<ProposalSolutionDesignStageData>): Partial<ProposalSolutionDesignStageData> {
  const next: Partial<ProposalSolutionDesignStageData> = {};
  if (value.solutionConfiguration) next.solutionConfiguration = sanitizeSolutionConfiguration(value.solutionConfiguration) as SolutionConfiguration;
  if (value.warehouseModel) next.warehouseModel = sanitizeWarehouseModel(value.warehouseModel) as WarehouseModel;
  if (value.transportModel) next.transportModel = sanitizeTransportModel(value.transportModel) as TransportModel;
  if (value.vasHandling) next.vasHandling = sanitizeVasHandling(value.vasHandling) as VasHandling;
  if (value.systemsVisibility) next.systemsVisibility = sanitizeSystemsVisibility(value.systemsVisibility) as SystemsVisibility;
  if (value.serviceScope) next.serviceScope = sanitizeServiceScope(value.serviceScope) as ServiceScope;
  if (value.operationalFeasibility) next.operationalFeasibility = sanitizeOperationalFeasibility(value.operationalFeasibility) as OperationalFeasibility;
  if (value.assumptionsDependencies) next.assumptionsDependencies = sanitizeAssumptionsDependencies(value.assumptionsDependencies) as AssumptionsDependencies;
  return next;
}

export function sanitizePnlPricingStageData(value: Partial<ProposalPnlPricingStageData>): Partial<ProposalPnlPricingStageData> {
  const next: Partial<ProposalPnlPricingStageData> = {};
  const pnlVersions = sanitizePnlVersions(value.pnlVersions);
  const costInputs = sanitizeCostInputs(value.costInputs);
  const pricingLines = sanitizePricingLines(value.pricingLines);
  const marginScenarios = sanitizeMarginScenarios(value.marginScenarios);
  if (pnlVersions) next.pnlVersions = pnlVersions;
  if (typeof value.activePnlVersion === "string") next.activePnlVersion = text(value.activePnlVersion);
  if (costInputs) next.costInputs = costInputs;
  if (pricingLines) next.pricingLines = pricingLines;
  if (marginScenarios) next.marginScenarios = marginScenarios;
  if (value.commercialTerms) next.commercialTerms = sanitizeCommercialTerms(value.commercialTerms) as CommercialTerms;
  if (value.pricingAssumptionsExclusions) {
    next.pricingAssumptionsExclusions = sanitizePricingAssumptionsExclusions(value.pricingAssumptionsExclusions) as PricingAssumptionsExclusions;
  }
  return next;
}

export function sanitizeQuoteStageData(value: Partial<ProposalQuoteStageData>): Partial<ProposalQuoteStageData> {
  const next: Partial<ProposalQuoteStageData> = {};
  const quoteVersions = sanitizeQuoteVersions(value.quoteVersions);
  if (value.quoteSummary) next.quoteSummary = sanitizeQuoteSummary(value.quoteSummary) as QuoteSummary;
  if (value.quoteServiceScope) next.quoteServiceScope = sanitizeQuoteServiceScope(value.quoteServiceScope) as QuoteServiceScope;
  if (value.quotePricingSummary) next.quotePricingSummary = sanitizeQuotePricingSummary(value.quotePricingSummary) as QuotePricingSummary;
  if (value.quoteTermsAssumptionsExclusions) {
    next.quoteTermsAssumptionsExclusions = sanitizeQuoteTermsAssumptionsExclusions(value.quoteTermsAssumptionsExclusions) as QuoteTermsAssumptionsExclusions;
  }
  if (quoteVersions) next.quoteVersions = quoteVersions;
  return next;
}

export function sanitizeProposalDraftingStageData(value: Partial<ProposalDraftingStageData>): Partial<ProposalDraftingStageData> {
  const next: Partial<ProposalDraftingStageData> = {};
  const proposalTocSections = sanitizeProposalTocSections(value.proposalTocSections);
  const proposalSourceMap = sanitizeProposalSourceMap(value.proposalSourceMap);
  const proposalDraftBlocks = sanitizeProposalDraftBlocks(value.proposalDraftBlocks);
  const proposalEvidenceItems = sanitizeProposalEvidenceItems(value.proposalEvidenceItems);
  const proposalTechnicalVolume = value.proposalTechnicalVolume
    ? sanitizeProposalTechnicalVolume(value.proposalTechnicalVolume) as ProposalTechnicalVolume
    : undefined;
  const proposalCommercialVolume = value.proposalCommercialVolume
    ? sanitizeProposalCommercialVolume(value.proposalCommercialVolume) as ProposalCommercialVolume
    : undefined;
  const proposalAppendixNotes = value.proposalAppendixNotes
    ? sanitizeProposalAppendixNotes(value.proposalAppendixNotes) as ProposalAppendixNotes
    : undefined;
  const proposalFinalDraftReview = value.proposalFinalDraftReview
    ? sanitizeProposalFinalDraftReview(value.proposalFinalDraftReview) as ProposalFinalDraftReview
    : undefined;
  if (proposalTocSections) next.proposalTocSections = proposalTocSections;
  if (proposalSourceMap) next.proposalSourceMap = proposalSourceMap;
  if (proposalDraftBlocks) next.proposalDraftBlocks = proposalDraftBlocks;
  if (proposalTechnicalVolume && Object.values(proposalTechnicalVolume).some(Boolean)) next.proposalTechnicalVolume = proposalTechnicalVolume;
  if (proposalCommercialVolume && Object.values(proposalCommercialVolume).some(Boolean)) next.proposalCommercialVolume = proposalCommercialVolume;
  if (proposalEvidenceItems) next.proposalEvidenceItems = proposalEvidenceItems;
  if (proposalAppendixNotes && Object.values(proposalAppendixNotes).some(Boolean)) next.proposalAppendixNotes = proposalAppendixNotes;
  if (proposalFinalDraftReview && Object.values(proposalFinalDraftReview).some(Boolean)) next.proposalFinalDraftReview = proposalFinalDraftReview;
  return next;
}

export function sanitizeProposalSentStageData(value: Partial<ProposalSentStageData>): Partial<ProposalSentStageData> {
  const next: Partial<ProposalSentStageData> = {};
  const proposalSentVersion = value.proposalSentVersion
    ? sanitizeProposalSentVersion(value.proposalSentVersion) as ProposalSentVersion
    : undefined;
  const proposalDeliveryRecord = value.proposalDeliveryRecord
    ? sanitizeProposalDeliveryRecord(value.proposalDeliveryRecord) as ProposalDeliveryRecord
    : undefined;
  const proposalRecipientContacts = sanitizeProposalRecipientContacts(value.proposalRecipientContacts);
  const proposalSentAttachments = sanitizeProposalSentAttachments(value.proposalSentAttachments);
  const proposalCrmSyncRecord = value.proposalCrmSyncRecord
    ? sanitizeProposalCrmSyncRecord(value.proposalCrmSyncRecord) as ProposalCrmSyncRecord
    : undefined;
  const proposalSentAuditNotes = sanitizeProposalSentAuditNotes(value.proposalSentAuditNotes);
  if (proposalSentVersion && Object.values(proposalSentVersion).some(Boolean)) next.proposalSentVersion = proposalSentVersion;
  if (proposalDeliveryRecord && Object.values(proposalDeliveryRecord).some(Boolean)) next.proposalDeliveryRecord = proposalDeliveryRecord;
  if (proposalRecipientContacts) next.proposalRecipientContacts = proposalRecipientContacts;
  if (proposalSentAttachments) next.proposalSentAttachments = proposalSentAttachments;
  if (proposalCrmSyncRecord && Object.values(proposalCrmSyncRecord).some(Boolean)) next.proposalCrmSyncRecord = proposalCrmSyncRecord;
  if (proposalSentAuditNotes) next.proposalSentAuditNotes = proposalSentAuditNotes;
  return next;
}

export function sanitizeProposalNegotiationStageData(value: Partial<ProposalNegotiationStageData>): Partial<ProposalNegotiationStageData> {
  const next: Partial<ProposalNegotiationStageData> = {};
  const proposalCustomerFeedback = sanitizeProposalCustomerFeedback(value.proposalCustomerFeedback);
  const proposalRequestedScopeChanges = sanitizeProposalRequestedScopeChanges(value.proposalRequestedScopeChanges);
  const proposalPricingChanges = sanitizeProposalPricingChanges(value.proposalPricingChanges);
  const proposalNegotiationMarginImpact = value.proposalNegotiationMarginImpact
    ? sanitizeProposalNegotiationMarginImpact(value.proposalNegotiationMarginImpact) as ProposalNegotiationMarginImpact
    : undefined;
  const proposalRevisedVersions = sanitizeProposalRevisedVersions(value.proposalRevisedVersions);
  const proposalNegotiationNotes = sanitizeProposalNegotiationNotes(value.proposalNegotiationNotes);
  if (proposalCustomerFeedback) next.proposalCustomerFeedback = proposalCustomerFeedback;
  if (proposalRequestedScopeChanges) next.proposalRequestedScopeChanges = proposalRequestedScopeChanges;
  if (proposalPricingChanges) next.proposalPricingChanges = proposalPricingChanges;
  if (proposalNegotiationMarginImpact && Object.values(proposalNegotiationMarginImpact).some(Boolean)) {
    next.proposalNegotiationMarginImpact = proposalNegotiationMarginImpact;
  }
  if (proposalRevisedVersions) next.proposalRevisedVersions = proposalRevisedVersions;
  if (proposalNegotiationNotes) next.proposalNegotiationNotes = proposalNegotiationNotes;
  return next;
}

export function sanitizeProposalCommercialApprovalStageData(value: Partial<ProposalCommercialApprovalStageData>): Partial<ProposalCommercialApprovalStageData> {
  const next: Partial<ProposalCommercialApprovalStageData> = {};
  const proposalApprovalSummary = value.proposalApprovalSummary
    ? sanitizeProposalApprovalSummary(value.proposalApprovalSummary) as ProposalApprovalSummary
    : undefined;
  const proposalMarginTermsReview = value.proposalMarginTermsReview
    ? sanitizeProposalMarginTermsReview(value.proposalMarginTermsReview) as ProposalMarginTermsReview
    : undefined;
  const proposalRiskExceptionNotes = value.proposalRiskExceptionNotes
    ? sanitizeProposalRiskExceptionNotes(value.proposalRiskExceptionNotes) as ProposalRiskExceptionNotes
    : undefined;
  const proposalFinalCommercialPosition = value.proposalFinalCommercialPosition
    ? sanitizeProposalFinalCommercialPosition(value.proposalFinalCommercialPosition) as ProposalFinalCommercialPosition
    : undefined;
  const proposalApprovalRecord = value.proposalApprovalRecord
    ? sanitizeProposalApprovalRecord(value.proposalApprovalRecord) as ProposalApprovalRecord
    : undefined;
  if (proposalApprovalSummary && Object.values(proposalApprovalSummary).some(Boolean)) next.proposalApprovalSummary = proposalApprovalSummary;
  if (proposalMarginTermsReview && Object.values(proposalMarginTermsReview).some(Boolean)) next.proposalMarginTermsReview = proposalMarginTermsReview;
  if (proposalRiskExceptionNotes && Object.values(proposalRiskExceptionNotes).some(Boolean)) next.proposalRiskExceptionNotes = proposalRiskExceptionNotes;
  if (proposalFinalCommercialPosition && Object.values(proposalFinalCommercialPosition).some(Boolean)) next.proposalFinalCommercialPosition = proposalFinalCommercialPosition;
  if (proposalApprovalRecord && Object.values(proposalApprovalRecord).some(Boolean)) next.proposalApprovalRecord = proposalApprovalRecord;
  return next;
}

export function sanitizeProposalContractSignedStageData(value: Partial<ProposalContractSignedStageData>): Partial<ProposalContractSignedStageData> {
  const next: Partial<ProposalContractSignedStageData> = {};
  const proposalSignedContractReference = value.proposalSignedContractReference
    ? sanitizeProposalSignedContractReference(value.proposalSignedContractReference) as ProposalSignedContractReference
    : undefined;
  const proposalFinalContractScope = value.proposalFinalContractScope
    ? sanitizeProposalFinalContractScope(value.proposalFinalContractScope) as ProposalFinalContractScope
    : undefined;
  const proposalFinalContractPricing = value.proposalFinalContractPricing
    ? sanitizeProposalFinalContractPricing(value.proposalFinalContractPricing) as ProposalFinalContractPricing
    : undefined;
  const proposalFinalContractTerms = value.proposalFinalContractTerms
    ? sanitizeProposalFinalContractTerms(value.proposalFinalContractTerms) as ProposalFinalContractTerms
    : undefined;
  const proposalContractHandoverPrep = value.proposalContractHandoverPrep
    ? sanitizeProposalContractHandoverPrep(value.proposalContractHandoverPrep) as ProposalContractHandoverPrep
    : undefined;
  if (proposalSignedContractReference && Object.values(proposalSignedContractReference).some(Boolean)) next.proposalSignedContractReference = proposalSignedContractReference;
  if (proposalFinalContractScope && Object.values(proposalFinalContractScope).some(Boolean)) next.proposalFinalContractScope = proposalFinalContractScope;
  if (proposalFinalContractPricing && Object.values(proposalFinalContractPricing).some(Boolean)) next.proposalFinalContractPricing = proposalFinalContractPricing;
  if (proposalFinalContractTerms && Object.values(proposalFinalContractTerms).some(Boolean)) next.proposalFinalContractTerms = proposalFinalContractTerms;
  if (proposalContractHandoverPrep && Object.values(proposalContractHandoverPrep).some(Boolean)) next.proposalContractHandoverPrep = proposalContractHandoverPrep;
  return next;
}

export function sanitizeProposalGoLiveStageData(value: Partial<ProposalGoLiveStageData>): Partial<ProposalGoLiveStageData> {
  const next: Partial<ProposalGoLiveStageData> = {};
  const proposalGoLiveSummary = value.proposalGoLiveSummary
    ? sanitizeProposalGoLiveSummary(value.proposalGoLiveSummary) as ProposalGoLiveSummary
    : undefined;
  const proposalMobilizationTracker = value.proposalMobilizationTracker
    ? sanitizeProposalMobilizationTracker(value.proposalMobilizationTracker) as ProposalMobilizationTracker
    : undefined;
  const proposalOperationsHandover = value.proposalOperationsHandover
    ? sanitizeProposalOperationsHandover(value.proposalOperationsHandover) as ProposalOperationsHandover
    : undefined;
  const proposalSlaKpiSetup = value.proposalSlaKpiSetup
    ? sanitizeProposalSlaKpiSetup(value.proposalSlaKpiSetup) as ProposalSlaKpiSetup
    : undefined;
  const proposalOpenImplementationRisks = value.proposalOpenImplementationRisks
    ? sanitizeProposalOpenImplementationRisks(value.proposalOpenImplementationRisks) as ProposalOpenImplementationRisks
    : undefined;
  const proposalRenewalFutureMemory = value.proposalRenewalFutureMemory
    ? sanitizeProposalRenewalFutureMemory(value.proposalRenewalFutureMemory) as ProposalRenewalFutureMemory
    : undefined;
  if (proposalGoLiveSummary && Object.values(proposalGoLiveSummary).some(Boolean)) next.proposalGoLiveSummary = proposalGoLiveSummary;
  if (proposalMobilizationTracker && Object.values(proposalMobilizationTracker).some(Boolean)) next.proposalMobilizationTracker = proposalMobilizationTracker;
  if (proposalOperationsHandover && Object.values(proposalOperationsHandover).some(Boolean)) next.proposalOperationsHandover = proposalOperationsHandover;
  if (proposalSlaKpiSetup && Object.values(proposalSlaKpiSetup).some(Boolean)) next.proposalSlaKpiSetup = proposalSlaKpiSetup;
  if (proposalOpenImplementationRisks && Object.values(proposalOpenImplementationRisks).some(Boolean)) next.proposalOpenImplementationRisks = proposalOpenImplementationRisks;
  if (proposalRenewalFutureMemory && Object.values(proposalRenewalFutureMemory).some(Boolean)) next.proposalRenewalFutureMemory = proposalRenewalFutureMemory;
  return next;
}

export function extractQualifiedStageData(wsData: ProposalWorkspaceData): ProposalQualifiedStageData {
  return {
    qualificationSummary: { ...wsData.qualificationSummary },
    customerFit: { ...wsData.customerFit },
    opportunityBrief: { ...wsData.opportunityBrief },
    requiredInfo: wsData.requiredInfo.map(item => ({ ...item })),
  };
}

export function extractDiscoveryStageData(wsData: ProposalWorkspaceData): ProposalDiscoveryStageData {
  return {
    meetingNotes: wsData.meetingNotes.map(note => ({ ...note })),
    customerNeeds: { ...wsData.customerNeeds },
    currentPain: { ...wsData.currentPain },
    volumesLanes: { ...wsData.volumesLanes },
    risksAssumptions: { ...wsData.risksAssumptions },
  };
}

export function extractSolutionDesignStageData(wsData: ProposalWorkspaceData): ProposalSolutionDesignStageData {
  return {
    solutionConfiguration: { ...wsData.solutionConfiguration },
    warehouseModel: { ...wsData.warehouseModel },
    transportModel: { ...wsData.transportModel },
    vasHandling: { ...wsData.vasHandling },
    systemsVisibility: { ...wsData.systemsVisibility },
    serviceScope: { ...wsData.serviceScope },
    operationalFeasibility: { ...wsData.operationalFeasibility },
    assumptionsDependencies: { ...wsData.assumptionsDependencies },
  };
}

export function extractPnlPricingStageData(wsData: ProposalWorkspaceData): ProposalPnlPricingStageData {
  return {
    pnlVersions: wsData.pnlVersions.map(version => ({
      ...version,
      revenue: version.revenue.map(line => ({ ...line })),
      costs: version.costs.map(line => ({ ...line })),
    })),
    activePnlVersion: wsData.activePnlVersion,
    costInputs: wsData.costInputs.map(input => ({ ...input })),
    pricingLines: wsData.pricingLines.map(line => ({ ...line })),
    marginScenarios: wsData.marginScenarios.map(scenario => ({ ...scenario })),
    commercialTerms: { ...wsData.commercialTerms },
    pricingAssumptionsExclusions: { ...wsData.pricingAssumptionsExclusions },
  };
}

export function extractQuoteStageData(wsData: ProposalWorkspaceData): ProposalQuoteStageData {
  return {
    quoteSummary: { ...wsData.quoteSummary },
    quoteServiceScope: { ...wsData.quoteServiceScope },
    quotePricingSummary: { ...wsData.quotePricingSummary },
    quoteTermsAssumptionsExclusions: { ...wsData.quoteTermsAssumptionsExclusions },
    quoteVersions: wsData.quoteVersions.map(version => ({ ...version })),
  };
}

export function extractProposalDraftingStageData(wsData: ProposalWorkspaceData): ProposalDraftingStageData {
  return {
    proposalTocSections: wsData.proposalTocSections.map(section => ({ ...section })),
    proposalSourceMap: wsData.proposalSourceMap.map(mapping => ({ ...mapping })),
    proposalDraftBlocks: wsData.proposalDraftBlocks.map(block => ({ ...block })),
    proposalTechnicalVolume: { ...wsData.proposalTechnicalVolume },
    proposalCommercialVolume: { ...wsData.proposalCommercialVolume },
    proposalEvidenceItems: wsData.proposalEvidenceItems.map(item => ({ ...item })),
    proposalAppendixNotes: { ...wsData.proposalAppendixNotes },
    proposalFinalDraftReview: { ...wsData.proposalFinalDraftReview },
  };
}

export function extractProposalSentStageData(wsData: ProposalWorkspaceData): ProposalSentStageData {
  return {
    proposalSentVersion: { ...wsData.proposalSentVersion },
    proposalDeliveryRecord: { ...wsData.proposalDeliveryRecord },
    proposalRecipientContacts: wsData.proposalRecipientContacts.map(contact => ({ ...contact })),
    proposalSentAttachments: wsData.proposalSentAttachments.map(attachment => ({ ...attachment })),
    proposalCrmSyncRecord: { ...wsData.proposalCrmSyncRecord },
    proposalSentAuditNotes: wsData.proposalSentAuditNotes.map(note => ({ ...note })),
  };
}

export function extractProposalNegotiationStageData(wsData: ProposalWorkspaceData): ProposalNegotiationStageData {
  return {
    proposalCustomerFeedback: wsData.proposalCustomerFeedback.map(item => ({ ...item })),
    proposalRequestedScopeChanges: wsData.proposalRequestedScopeChanges.map(item => ({ ...item })),
    proposalPricingChanges: wsData.proposalPricingChanges.map(item => ({ ...item })),
    proposalNegotiationMarginImpact: { ...wsData.proposalNegotiationMarginImpact },
    proposalRevisedVersions: wsData.proposalRevisedVersions.map(item => ({ ...item })),
    proposalNegotiationNotes: wsData.proposalNegotiationNotes.map(item => ({ ...item })),
  };
}

export function extractProposalCommercialApprovalStageData(wsData: ProposalWorkspaceData): ProposalCommercialApprovalStageData {
  return {
    proposalApprovalSummary: { ...wsData.proposalApprovalSummary },
    proposalMarginTermsReview: { ...wsData.proposalMarginTermsReview },
    proposalRiskExceptionNotes: { ...wsData.proposalRiskExceptionNotes },
    proposalFinalCommercialPosition: { ...wsData.proposalFinalCommercialPosition },
    proposalApprovalRecord: { ...wsData.proposalApprovalRecord },
  };
}

export function extractProposalContractSignedStageData(wsData: ProposalWorkspaceData): ProposalContractSignedStageData {
  return {
    proposalSignedContractReference: { ...wsData.proposalSignedContractReference },
    proposalFinalContractScope: { ...wsData.proposalFinalContractScope },
    proposalFinalContractPricing: { ...wsData.proposalFinalContractPricing },
    proposalFinalContractTerms: { ...wsData.proposalFinalContractTerms },
    proposalContractHandoverPrep: { ...wsData.proposalContractHandoverPrep },
  };
}

export function extractProposalGoLiveStageData(wsData: ProposalWorkspaceData): ProposalGoLiveStageData {
  return {
    proposalGoLiveSummary: { ...wsData.proposalGoLiveSummary },
    proposalMobilizationTracker: { ...wsData.proposalMobilizationTracker },
    proposalOperationsHandover: { ...wsData.proposalOperationsHandover },
    proposalSlaKpiSetup: { ...wsData.proposalSlaKpiSetup },
    proposalOpenImplementationRisks: { ...wsData.proposalOpenImplementationRisks },
    proposalRenewalFutureMemory: { ...wsData.proposalRenewalFutureMemory },
  };
}

export function mergeQualifiedStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalQualifiedStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeQualifiedStageData(data);
  return {
    ...wsData,
    qualificationSummary: {
      ...wsData.qualificationSummary,
      ...(sanitized.qualificationSummary ?? {}),
    },
    customerFit: {
      ...wsData.customerFit,
      ...(sanitized.customerFit ?? {}),
    },
    opportunityBrief: {
      ...wsData.opportunityBrief,
      ...(sanitized.opportunityBrief ?? {}),
    },
    requiredInfo: sanitized.requiredInfo ?? wsData.requiredInfo,
  };
}

export function mergeDiscoveryStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalDiscoveryStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeDiscoveryStageData(data);
  return {
    ...wsData,
    meetingNotes: sanitized.meetingNotes ?? wsData.meetingNotes,
    customerNeeds: {
      ...wsData.customerNeeds,
      ...(sanitized.customerNeeds ?? {}),
    },
    currentPain: {
      ...wsData.currentPain,
      ...(sanitized.currentPain ?? {}),
    },
    volumesLanes: {
      ...wsData.volumesLanes,
      ...(sanitized.volumesLanes ?? {}),
    },
    risksAssumptions: {
      ...wsData.risksAssumptions,
      ...(sanitized.risksAssumptions ?? {}),
    },
  };
}

export function mergeSolutionDesignStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalSolutionDesignStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeSolutionDesignStageData(data);
  return {
    ...wsData,
    solutionConfiguration: {
      ...wsData.solutionConfiguration,
      ...(sanitized.solutionConfiguration ?? {}),
    },
    warehouseModel: {
      ...wsData.warehouseModel,
      ...(sanitized.warehouseModel ?? {}),
    },
    transportModel: {
      ...wsData.transportModel,
      ...(sanitized.transportModel ?? {}),
    },
    vasHandling: {
      ...wsData.vasHandling,
      ...(sanitized.vasHandling ?? {}),
    },
    systemsVisibility: {
      ...wsData.systemsVisibility,
      ...(sanitized.systemsVisibility ?? {}),
    },
    serviceScope: {
      ...wsData.serviceScope,
      ...(sanitized.serviceScope ?? {}),
    },
    operationalFeasibility: {
      ...wsData.operationalFeasibility,
      ...(sanitized.operationalFeasibility ?? {}),
    },
    assumptionsDependencies: {
      ...wsData.assumptionsDependencies,
      ...(sanitized.assumptionsDependencies ?? {}),
    },
  };
}

export function mergePnlPricingStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalPnlPricingStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizePnlPricingStageData(data);
  const marginScenarios = sanitized.marginScenarios
    ? wsData.marginScenarios.map(existing =>
        sanitized.marginScenarios?.find(saved => saved.name === existing.name) ?? existing
      ).concat(sanitized.marginScenarios.filter(saved =>
        !wsData.marginScenarios.some(existing => existing.name === saved.name)
      ))
    : wsData.marginScenarios;
  return {
    ...wsData,
    pnlVersions: sanitized.pnlVersions ?? wsData.pnlVersions,
    activePnlVersion: sanitized.activePnlVersion ?? wsData.activePnlVersion,
    costInputs: sanitized.costInputs ?? wsData.costInputs,
    pricingLines: sanitized.pricingLines ?? wsData.pricingLines,
    marginScenarios,
    commercialTerms: {
      ...wsData.commercialTerms,
      ...(sanitized.commercialTerms ?? {}),
    },
    pricingAssumptionsExclusions: {
      ...wsData.pricingAssumptionsExclusions,
      ...(sanitized.pricingAssumptionsExclusions ?? {}),
    },
  };
}

export function mergeQuoteStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalQuoteStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeQuoteStageData(data);
  return {
    ...wsData,
    quoteSummary: {
      ...wsData.quoteSummary,
      ...(sanitized.quoteSummary ?? {}),
    },
    quoteServiceScope: {
      ...wsData.quoteServiceScope,
      ...(sanitized.quoteServiceScope ?? {}),
    },
    quotePricingSummary: {
      ...wsData.quotePricingSummary,
      ...(sanitized.quotePricingSummary ?? {}),
    },
    quoteTermsAssumptionsExclusions: {
      ...wsData.quoteTermsAssumptionsExclusions,
      ...(sanitized.quoteTermsAssumptionsExclusions ?? {}),
    },
    quoteVersions: sanitized.quoteVersions ?? wsData.quoteVersions,
  };
}

export function mergeProposalDraftingStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalDraftingStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeProposalDraftingStageData(data);
  return {
    ...wsData,
    proposalTocSections: sanitized.proposalTocSections ?? wsData.proposalTocSections,
    proposalSourceMap: sanitized.proposalSourceMap ?? wsData.proposalSourceMap,
    proposalDraftBlocks: sanitized.proposalDraftBlocks ?? wsData.proposalDraftBlocks,
    proposalTechnicalVolume: {
      ...wsData.proposalTechnicalVolume,
      ...(sanitized.proposalTechnicalVolume ?? {}),
    },
    proposalCommercialVolume: {
      ...wsData.proposalCommercialVolume,
      ...(sanitized.proposalCommercialVolume ?? {}),
    },
    proposalEvidenceItems: sanitized.proposalEvidenceItems ?? wsData.proposalEvidenceItems,
    proposalAppendixNotes: {
      ...wsData.proposalAppendixNotes,
      ...(sanitized.proposalAppendixNotes ?? {}),
    },
    proposalFinalDraftReview: {
      ...wsData.proposalFinalDraftReview,
      ...(sanitized.proposalFinalDraftReview ?? {}),
    },
  };
}

export function mergeProposalSentStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalSentStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeProposalSentStageData(data);
  return {
    ...wsData,
    proposalSentVersion: {
      ...wsData.proposalSentVersion,
      ...(sanitized.proposalSentVersion ?? {}),
    },
    proposalDeliveryRecord: {
      ...wsData.proposalDeliveryRecord,
      ...(sanitized.proposalDeliveryRecord ?? {}),
    },
    proposalRecipientContacts: sanitized.proposalRecipientContacts ?? wsData.proposalRecipientContacts,
    proposalSentAttachments: sanitized.proposalSentAttachments ?? wsData.proposalSentAttachments,
    proposalCrmSyncRecord: {
      ...wsData.proposalCrmSyncRecord,
      ...(sanitized.proposalCrmSyncRecord ?? {}),
    },
    proposalSentAuditNotes: sanitized.proposalSentAuditNotes ?? wsData.proposalSentAuditNotes,
  };
}

export function mergeProposalNegotiationStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalNegotiationStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeProposalNegotiationStageData(data);
  return {
    ...wsData,
    proposalCustomerFeedback: sanitized.proposalCustomerFeedback ?? wsData.proposalCustomerFeedback,
    proposalRequestedScopeChanges: sanitized.proposalRequestedScopeChanges ?? wsData.proposalRequestedScopeChanges,
    proposalPricingChanges: sanitized.proposalPricingChanges ?? wsData.proposalPricingChanges,
    proposalNegotiationMarginImpact: {
      ...wsData.proposalNegotiationMarginImpact,
      ...(sanitized.proposalNegotiationMarginImpact ?? {}),
    },
    proposalRevisedVersions: sanitized.proposalRevisedVersions ?? wsData.proposalRevisedVersions,
    proposalNegotiationNotes: sanitized.proposalNegotiationNotes ?? wsData.proposalNegotiationNotes,
  };
}

export function mergeProposalCommercialApprovalStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalCommercialApprovalStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeProposalCommercialApprovalStageData(data);
  return {
    ...wsData,
    proposalApprovalSummary: {
      ...wsData.proposalApprovalSummary,
      ...(sanitized.proposalApprovalSummary ?? {}),
    },
    proposalMarginTermsReview: {
      ...wsData.proposalMarginTermsReview,
      ...(sanitized.proposalMarginTermsReview ?? {}),
    },
    proposalRiskExceptionNotes: {
      ...wsData.proposalRiskExceptionNotes,
      ...(sanitized.proposalRiskExceptionNotes ?? {}),
    },
    proposalFinalCommercialPosition: {
      ...wsData.proposalFinalCommercialPosition,
      ...(sanitized.proposalFinalCommercialPosition ?? {}),
    },
    proposalApprovalRecord: {
      ...wsData.proposalApprovalRecord,
      ...(sanitized.proposalApprovalRecord ?? {}),
    },
  };
}

export function mergeProposalContractSignedStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalContractSignedStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeProposalContractSignedStageData(data);
  return {
    ...wsData,
    proposalSignedContractReference: {
      ...wsData.proposalSignedContractReference,
      ...(sanitized.proposalSignedContractReference ?? {}),
    },
    proposalFinalContractScope: {
      ...wsData.proposalFinalContractScope,
      ...(sanitized.proposalFinalContractScope ?? {}),
    },
    proposalFinalContractPricing: {
      ...wsData.proposalFinalContractPricing,
      ...(sanitized.proposalFinalContractPricing ?? {}),
    },
    proposalFinalContractTerms: {
      ...wsData.proposalFinalContractTerms,
      ...(sanitized.proposalFinalContractTerms ?? {}),
    },
    proposalContractHandoverPrep: {
      ...wsData.proposalContractHandoverPrep,
      ...(sanitized.proposalContractHandoverPrep ?? {}),
    },
  };
}

export function mergeProposalGoLiveStageData(
  wsData: ProposalWorkspaceData,
  data: Partial<ProposalGoLiveStageData> | null | undefined,
): ProposalWorkspaceData {
  if (!data) return wsData;
  const sanitized = sanitizeProposalGoLiveStageData(data);
  return {
    ...wsData,
    proposalGoLiveSummary: {
      ...wsData.proposalGoLiveSummary,
      ...(sanitized.proposalGoLiveSummary ?? {}),
    },
    proposalMobilizationTracker: {
      ...wsData.proposalMobilizationTracker,
      ...(sanitized.proposalMobilizationTracker ?? {}),
    },
    proposalOperationsHandover: {
      ...wsData.proposalOperationsHandover,
      ...(sanitized.proposalOperationsHandover ?? {}),
    },
    proposalSlaKpiSetup: {
      ...wsData.proposalSlaKpiSetup,
      ...(sanitized.proposalSlaKpiSetup ?? {}),
    },
    proposalOpenImplementationRisks: {
      ...wsData.proposalOpenImplementationRisks,
      ...(sanitized.proposalOpenImplementationRisks ?? {}),
    },
    proposalRenewalFutureMemory: {
      ...wsData.proposalRenewalFutureMemory,
      ...(sanitized.proposalRenewalFutureMemory ?? {}),
    },
  };
}

export function getQualifiedStageDataSignature(data: ProposalQualifiedStageData): string {
  return JSON.stringify(sanitizeQualifiedStageData(data));
}

export function getDiscoveryStageDataSignature(data: ProposalDiscoveryStageData): string {
  return JSON.stringify(sanitizeDiscoveryStageData(data));
}

export function getSolutionDesignStageDataSignature(data: ProposalSolutionDesignStageData): string {
  return JSON.stringify(sanitizeSolutionDesignStageData(data));
}

export function getPnlPricingStageDataSignature(data: ProposalPnlPricingStageData): string {
  return JSON.stringify(sanitizePnlPricingStageData(data));
}

export function getQuoteStageDataSignature(data: ProposalQuoteStageData): string {
  return JSON.stringify(sanitizeQuoteStageData(data));
}

export function getProposalDraftingStageDataSignature(data: ProposalDraftingStageData): string {
  return JSON.stringify(sanitizeProposalDraftingStageData(data));
}

export function getProposalSentStageDataSignature(data: ProposalSentStageData): string {
  return JSON.stringify(sanitizeProposalSentStageData(data));
}

export function getProposalNegotiationStageDataSignature(data: ProposalNegotiationStageData): string {
  return JSON.stringify(sanitizeProposalNegotiationStageData(data));
}

export function getProposalCommercialApprovalStageDataSignature(data: ProposalCommercialApprovalStageData): string {
  return JSON.stringify(sanitizeProposalCommercialApprovalStageData(data));
}

export function getProposalContractSignedStageDataSignature(data: ProposalContractSignedStageData): string {
  return JSON.stringify(sanitizeProposalContractSignedStageData(data));
}

export function getProposalGoLiveStageDataSignature(data: ProposalGoLiveStageData): string {
  return JSON.stringify(sanitizeProposalGoLiveStageData(data));
}

function buildBaselineFromTicket(row: ProposalTicketRow): Partial<ProposalQualifiedStageData> {
  const details = asRecord(row.type_details);
  const serviceSource = pickText(details, [
    "service_type",
    "serviceType",
    "solution_type",
    "solutionType",
    "service",
    "scope_type",
    "scopeType",
  ]);

  return {
    qualificationSummary: {
      opportunityName: text(row.ticket_title),
      customer: text(row.customer_name) || text(row.company),
      region: normalizeRegion(text(row.region)),
      industry: text(row.industry),
      serviceType: normalizeServiceType(serviceSource),
      estimatedRevenue: numberValue(row.estimated_value),
      estimatedPallets: 0,
      expectedCloseDate: text(row.target_date),
      crmRef: text(row.source_reference) || text(row.legacy_opportunity_id) || row.id,
      leadSource: normalizeLeadSource(text(row.source_type)),
      qualificationConfidence: numberValue(row.probability_percent),
    },
    opportunityBrief: {
      customerNeed: pickText(details, ["customer_need", "customerNeed", "need", "requirement_summary"]),
      whyNow: "",
      scopeSummary: pickText(details, ["scope_summary", "scopeSummary", "scope", "solution_scope"]) || text(row.notes),
      keyStakeholders: "",
      decisionTimeline: "",
      knownConstraints: pickText(details, ["known_constraints", "knownConstraints", "constraints"]),
    },
  };
}

function buildDiscoveryBaselineFromTicket(row: ProposalTicketRow): Partial<ProposalDiscoveryStageData> {
  const details = asRecord(row.type_details);
  const needs = asRecord(details.customer_needs ?? details.customerNeeds);
  const volumes = asRecord(details.volumes_lanes ?? details.volumesLanes ?? details.volumes);
  const risks = asRecord(details.risks_assumptions ?? details.risksAssumptions ?? details.risks);
  return sanitizeDiscoveryStageData({
    customerNeeds: {
      warehousing: pickText(needs, ["warehousing", "warehouse", "storage"]),
      transport: pickText(needs, ["transport", "transportation", "distribution"]),
      vas: pickText(needs, ["vas", "value_added_services", "valueAddedServices"]),
      reporting: pickText(needs, ["reporting", "visibility", "dashboard"]),
      compliance: pickText(needs, ["compliance", "regulatory", "quality"]),
      slaExpectations: pickText(needs, ["slaExpectations", "sla_expectations", "sla"]),
    },
    volumesLanes: {
      skuCount: pickText(volumes, ["skuCount", "sku_count", "skus"]),
      inbound: pickText(volumes, ["inbound", "inbound_volume"]),
      outbound: pickText(volumes, ["outbound", "outbound_volume"]),
      pallets: pickText(volumes, ["pallets", "pallet_positions", "palletPositions"]),
      locations: pickText(volumes, ["locations", "sites", "cities"]),
      laneMatrix: pickText(volumes, ["laneMatrix", "lane_matrix", "lanes"]),
      tempZones: pickText(volumes, ["tempZones", "temp_zones", "temperature"]),
      peakSeasonality: pickText(volumes, ["peakSeasonality", "peak_seasonality", "seasonality"]),
    },
    risksAssumptions: {
      unknowns: pickText(risks, ["unknowns", "unknown"]),
      dataGaps: pickText(risks, ["dataGaps", "data_gaps"]),
      customerUncertainty: pickText(risks, ["customerUncertainty", "customer_uncertainty"]),
      capacityAssumptions: pickText(risks, ["capacityAssumptions", "capacity_assumptions"]),
      commercialAssumptions: pickText(risks, ["commercialAssumptions", "commercial_assumptions"]),
    },
  });
}

function buildSolutionDesignBaselineFromTicket(row: ProposalTicketRow): Partial<ProposalSolutionDesignStageData> {
  const details = asRecord(row.type_details);
  const solution = asRecord(details.solution_design ?? details.solutionDesign);
  const solutionConfiguration = asRecord(solution.solutionConfiguration ?? solution.solution_configuration ?? details.solution_configuration);
  const warehouseModel = asRecord(solution.warehouseModel ?? solution.warehouse_model ?? details.warehouse_model);
  const transportModel = asRecord(solution.transportModel ?? solution.transport_model ?? details.transport_model);
  const vasHandling = asRecord(solution.vasHandling ?? solution.vas_handling ?? details.vas_handling);
  const systemsVisibility = asRecord(solution.systemsVisibility ?? solution.systems_visibility ?? details.systems_visibility);
  const serviceScope = asRecord(solution.serviceScope ?? solution.service_scope ?? details.service_scope);
  const operationalFeasibility = asRecord(solution.operationalFeasibility ?? solution.operational_feasibility ?? details.operational_feasibility);
  const assumptionsDependencies = asRecord(solution.assumptionsDependencies ?? solution.assumptions_dependencies ?? details.assumptions_dependencies);

  return sanitizeSolutionDesignStageData({
    solutionConfiguration: {
      solutionOverview: pickText(solutionConfiguration, ["solutionOverview", "solution_overview", "overview"]),
      operatingModel: pickText(solutionConfiguration, ["operatingModel", "operating_model", "model"]),
      serviceMix: pickText(solutionConfiguration, ["serviceMix", "service_mix", "services"]),
      geographicCoverage: pickText(solutionConfiguration, ["geographicCoverage", "geographic_coverage", "coverage", "geography"]),
      designRationale: pickText(solutionConfiguration, ["designRationale", "design_rationale", "rationale"]),
      handoverNotes: pickText(solutionConfiguration, ["handoverNotes", "handover_notes", "notes"]),
    },
    warehouseModel: {
      storageType: pickText(warehouseModel, ["storageType", "storage_type"]),
      facilityType: pickText(warehouseModel, ["facilityType", "facility_type"]),
      capacityEstimate: pickText(warehouseModel, ["capacityEstimate", "capacity_estimate", "capacity"]),
      handlingAssumptions: pickText(warehouseModel, ["handlingAssumptions", "handling_assumptions", "handling"]),
      tempZones: pickText(warehouseModel, ["tempZones", "temp_zones", "temperature"]),
      laborAssumptions: pickText(warehouseModel, ["laborAssumptions", "labor_assumptions", "labor"]),
    },
    transportModel: {
      laneStructure: pickText(transportModel, ["laneStructure", "lane_structure", "lanes"]),
      vehicleTypes: pickText(transportModel, ["vehicleTypes", "vehicle_types", "vehicles"]),
      frequency: pickText(transportModel, ["frequency"]),
      sla: pickText(transportModel, ["sla", "service_level"]),
      routeComplexity: pickText(transportModel, ["routeComplexity", "route_complexity", "complexity"]),
      vendorRequirements: pickText(transportModel, ["vendorRequirements", "vendor_requirements", "vendors"]),
    },
    vasHandling: {
      labeling: pickText(vasHandling, ["labeling"]),
      kitting: pickText(vasHandling, ["kitting"]),
      packaging: pickText(vasHandling, ["packaging"]),
      returns: pickText(vasHandling, ["returns", "reverse_logistics"]),
      compliance: pickText(vasHandling, ["compliance"]),
      specializedHandling: pickText(vasHandling, ["specializedHandling", "specialized_handling", "special_handling"]),
    },
    systemsVisibility: {
      wmsRequirements: pickText(systemsVisibility, ["wmsRequirements", "wms_requirements", "wms"]),
      tmsRequirements: pickText(systemsVisibility, ["tmsRequirements", "tms_requirements", "tms"]),
      reportingDashboards: pickText(systemsVisibility, ["reportingDashboards", "reporting_dashboards", "reporting"]),
      integrationNeeds: pickText(systemsVisibility, ["integrationNeeds", "integration_needs", "integrations"]),
      customerPortal: pickText(systemsVisibility, ["customerPortal", "customer_portal", "portal"]),
      dataExchange: pickText(systemsVisibility, ["dataExchange", "data_exchange", "data_flow"]),
    },
    serviceScope: {
      included: pickText(serviceScope, ["included", "included_services"]),
      excluded: pickText(serviceScope, ["excluded", "excluded_services"]),
      customerResponsibilities: pickText(serviceScope, ["customerResponsibilities", "customer_responsibilities"]),
      halaResponsibilities: pickText(serviceScope, ["halaResponsibilities", "hala_responsibilities"]),
      kpiScope: pickText(serviceScope, ["kpiScope", "kpi_scope", "kpis"]),
    },
    operationalFeasibility: {
      capacityFit: fitStatusValue(pickText(operationalFeasibility, ["capacityFit", "capacity_fit"])),
      equipmentFit: fitStatusValue(pickText(operationalFeasibility, ["equipmentFit", "equipment_fit"])),
      regionFit: fitStatusValue(pickText(operationalFeasibility, ["regionFit", "region_fit"])),
      opsComments: pickText(operationalFeasibility, ["opsComments", "ops_comments", "comments"]),
      riskFlags: pickText(operationalFeasibility, ["riskFlags", "risk_flags", "risks"]),
    },
    assumptionsDependencies: {
      customerInputs: pickText(assumptionsDependencies, ["customerInputs", "customer_inputs"]),
      halaDependencies: pickText(assumptionsDependencies, ["halaDependencies", "hala_dependencies"]),
      timingAssumptions: pickText(assumptionsDependencies, ["timingAssumptions", "timing_assumptions", "timing"]),
      volumeAssumptions: pickText(assumptionsDependencies, ["volumeAssumptions", "volume_assumptions", "volumes"]),
      commercialDependencies: pickText(assumptionsDependencies, ["commercialDependencies", "commercial_dependencies", "commercial"]),
      openDecisions: pickText(assumptionsDependencies, ["openDecisions", "open_decisions", "decisions"]),
    },
  });
}

function buildPnlPricingBaselineFromTicket(row: ProposalTicketRow): Partial<ProposalPnlPricingStageData> {
  const details = asRecord(row.type_details);
  const pricing = asRecord(details.pnl_pricing ?? details.pnlPricing ?? details.pricing);
  const commercialTerms = asRecord(pricing.commercialTerms ?? pricing.commercial_terms ?? details.commercial_terms);
  const assumptionsExclusions = asRecord(
    pricing.pricingAssumptionsExclusions
      ?? pricing.pricing_assumptions_exclusions
      ?? pricing.assumptions_exclusions
      ?? details.assumptions_exclusions
  );

  return sanitizePnlPricingStageData(({
    pnlVersions: pricing.pnlVersions ?? pricing.pnl_versions,
    activePnlVersion: text(pricing.activePnlVersion ?? pricing.active_pnl_version),
    costInputs: pricing.costInputs ?? pricing.cost_inputs,
    pricingLines: pricing.pricingLines ?? pricing.pricing_lines,
    marginScenarios: pricing.marginScenarios ?? pricing.margin_scenarios,
    commercialTerms,
    pricingAssumptionsExclusions: assumptionsExclusions,
  } as unknown) as Partial<ProposalPnlPricingStageData>);
}

function buildQuoteBaselineFromTicket(row: ProposalTicketRow): Partial<ProposalQuoteStageData> {
  const details = asRecord(row.type_details);
  const quote = asRecord(details.quote);
  const quoteSummary = asRecord(quote.quoteSummary ?? quote.quote_summary ?? details.quote_summary);
  const quoteServiceScope = asRecord(quote.quoteServiceScope ?? quote.quote_service_scope ?? details.quote_service_scope);
  const quotePricingSummary = asRecord(quote.quotePricingSummary ?? quote.quote_pricing_summary ?? details.quote_pricing_summary);
  const quoteTerms = asRecord(
    quote.quoteTermsAssumptionsExclusions
      ?? quote.quote_terms_assumptions_exclusions
      ?? quote.terms_assumptions_exclusions
      ?? details.quote_terms_assumptions_exclusions
  );

  return sanitizeQuoteStageData(({
    quoteSummary: {
      ...quoteSummary,
      quoteTitle: pickText(quoteSummary, ["quoteTitle", "quote_title"]) || text(row.ticket_title),
      customerName: pickText(quoteSummary, ["customerName", "customer_name"]) || text(row.customer_name) || text(row.company),
    },
    quoteServiceScope,
    quotePricingSummary,
    quoteTermsAssumptionsExclusions: quoteTerms,
    quoteVersions: quote.quoteVersions ?? quote.quote_versions,
  } as unknown) as Partial<ProposalQuoteStageData>);
}

function readSavedQualifiedData(details: Record<string, unknown>): {
  data: Partial<ProposalQualifiedStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const qualified = asRecord(workspace.qualified);
  const payload = asRecord(qualified.data);
  const legacyPayload = qualified.qualificationSummary || qualified.customerFit || qualified.opportunityBrief || qualified.requiredInfo
    ? qualified
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeQualifiedStageData(rawData as Partial<ProposalQualifiedStageData>),
    savedAt: text(qualified.savedAt) || text(qualified.updatedAt) || null,
  };
}

function readSavedDiscoveryData(details: Record<string, unknown>): {
  data: Partial<ProposalDiscoveryStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const discovery = asRecord(workspace.discovery);
  const payload = asRecord(discovery.data);
  const legacyPayload = discovery.meetingNotes || discovery.customerNeeds || discovery.currentPain || discovery.volumesLanes || discovery.risksAssumptions
    ? discovery
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeDiscoveryStageData(rawData as Partial<ProposalDiscoveryStageData>),
    savedAt: text(discovery.savedAt) || text(discovery.updatedAt) || null,
  };
}

function readSavedSolutionDesignData(details: Record<string, unknown>): {
  data: Partial<ProposalSolutionDesignStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const solutionDesign = asRecord(workspace.solution_design ?? workspace.solutionDesign);
  const payload = asRecord(solutionDesign.data);
  const legacyPayload = solutionDesign.solutionConfiguration
    || solutionDesign.warehouseModel
    || solutionDesign.transportModel
    || solutionDesign.vasHandling
    || solutionDesign.systemsVisibility
    || solutionDesign.serviceScope
    || solutionDesign.operationalFeasibility
    || solutionDesign.assumptionsDependencies
    ? solutionDesign
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeSolutionDesignStageData(rawData as Partial<ProposalSolutionDesignStageData>),
    savedAt: text(solutionDesign.savedAt) || text(solutionDesign.updatedAt) || null,
  };
}

function readSavedPnlPricingData(details: Record<string, unknown>): {
  data: Partial<ProposalPnlPricingStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const pnlPricing = asRecord(workspace.pnl_pricing ?? workspace.pnlPricing);
  const payload = asRecord(pnlPricing.data);
  const legacyPayload = pnlPricing.pnlVersions
    || pnlPricing.activePnlVersion
    || pnlPricing.costInputs
    || pnlPricing.pricingLines
    || pnlPricing.marginScenarios
    || pnlPricing.commercialTerms
    || pnlPricing.pricingAssumptionsExclusions
    ? pnlPricing
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizePnlPricingStageData(rawData as Partial<ProposalPnlPricingStageData>),
    savedAt: text(pnlPricing.savedAt) || text(pnlPricing.updatedAt) || null,
  };
}

function readSavedQuoteData(details: Record<string, unknown>): {
  data: Partial<ProposalQuoteStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const quote = asRecord(workspace.quote);
  const payload = asRecord(quote.data);
  const legacyPayload = quote.quoteSummary
    || quote.quoteServiceScope
    || quote.quotePricingSummary
    || quote.quoteTermsAssumptionsExclusions
    || quote.quoteVersions
    ? quote
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeQuoteStageData(rawData as Partial<ProposalQuoteStageData>),
    savedAt: text(quote.savedAt) || text(quote.updatedAt) || null,
  };
}

function readSavedProposalDraftingData(details: Record<string, unknown>): {
  data: Partial<ProposalDraftingStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const drafting = asRecord(workspace.proposal_drafting ?? workspace.proposalDrafting);
  const payload = asRecord(drafting.data);
  const legacyPayload = drafting.proposalTocSections
    || drafting.proposalSourceMap
    || drafting.proposalDraftBlocks
    || drafting.proposalTechnicalVolume
    || drafting.proposalCommercialVolume
    || drafting.proposalEvidenceItems
    || drafting.proposalAppendixNotes
    || drafting.proposalFinalDraftReview
    ? drafting
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeProposalDraftingStageData(rawData as Partial<ProposalDraftingStageData>),
    savedAt: text(drafting.savedAt) || text(drafting.updatedAt) || null,
  };
}

function readSavedProposalSentData(details: Record<string, unknown>): {
  data: Partial<ProposalSentStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const proposalSent = asRecord(workspace.proposal_sent ?? workspace.proposalSent);
  const payload = asRecord(proposalSent.data);
  const legacyPayload = proposalSent.proposalSentVersion
    || proposalSent.proposalDeliveryRecord
    || proposalSent.proposalRecipientContacts
    || proposalSent.proposalSentAttachments
    || proposalSent.proposalCrmSyncRecord
    || proposalSent.proposalSentAuditNotes
    ? proposalSent
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeProposalSentStageData(rawData as Partial<ProposalSentStageData>),
    savedAt: text(proposalSent.savedAt) || text(proposalSent.updatedAt) || null,
  };
}

function readSavedProposalNegotiationData(details: Record<string, unknown>): {
  data: Partial<ProposalNegotiationStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const negotiation = asRecord(workspace.negotiation ?? workspace.proposal_negotiation ?? workspace.proposalNegotiation);
  const payload = asRecord(negotiation.data);
  const legacyPayload = negotiation.proposalCustomerFeedback
    || negotiation.proposalRequestedScopeChanges
    || negotiation.proposalPricingChanges
    || negotiation.proposalNegotiationMarginImpact
    || negotiation.proposalRevisedVersions
    || negotiation.proposalNegotiationNotes
    ? negotiation
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeProposalNegotiationStageData(rawData as Partial<ProposalNegotiationStageData>),
    savedAt: text(negotiation.savedAt) || text(negotiation.updatedAt) || null,
  };
}

function readSavedProposalCommercialApprovalData(details: Record<string, unknown>): {
  data: Partial<ProposalCommercialApprovalStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const commercialApproval = asRecord(workspace.commercial_approval ?? workspace.commercialApproval);
  const payload = asRecord(commercialApproval.data);
  const legacyPayload = commercialApproval.proposalApprovalSummary
    || commercialApproval.proposalMarginTermsReview
    || commercialApproval.proposalRiskExceptionNotes
    || commercialApproval.proposalFinalCommercialPosition
    || commercialApproval.proposalApprovalRecord
    ? commercialApproval
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeProposalCommercialApprovalStageData(rawData as Partial<ProposalCommercialApprovalStageData>),
    savedAt: text(commercialApproval.savedAt) || text(commercialApproval.updatedAt) || null,
  };
}

function readSavedProposalContractSignedData(details: Record<string, unknown>): {
  data: Partial<ProposalContractSignedStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const contractSigned = asRecord(workspace.contract_signed ?? workspace.contractSigned);
  const payload = asRecord(contractSigned.data);
  const legacyPayload = contractSigned.proposalSignedContractReference
    || contractSigned.proposalFinalContractScope
    || contractSigned.proposalFinalContractPricing
    || contractSigned.proposalFinalContractTerms
    || contractSigned.proposalContractHandoverPrep
    ? contractSigned
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeProposalContractSignedStageData(rawData as Partial<ProposalContractSignedStageData>),
    savedAt: text(contractSigned.savedAt) || text(contractSigned.updatedAt) || null,
  };
}

function readSavedProposalGoLiveData(details: Record<string, unknown>): {
  data: Partial<ProposalGoLiveStageData> | null;
  savedAt: string | null;
} {
  const workspace = asRecord(details.proposal_workspace);
  const goLive = asRecord(workspace.go_live ?? workspace.goLive);
  const payload = asRecord(goLive.data);
  const legacyPayload = goLive.proposalGoLiveSummary
    || goLive.proposalMobilizationTracker
    || goLive.proposalOperationsHandover
    || goLive.proposalSlaKpiSetup
    || goLive.proposalOpenImplementationRisks
    || goLive.proposalRenewalFutureMemory
    ? goLive
    : {};
  const rawData = Object.keys(payload).length > 0 ? payload : legacyPayload;
  if (Object.keys(rawData).length === 0) return { data: null, savedAt: null };
  return {
    data: sanitizeProposalGoLiveStageData(rawData as Partial<ProposalGoLiveStageData>),
    savedAt: text(goLive.savedAt) || text(goLive.updatedAt) || null,
  };
}

export async function loadProposalQualifiedStageData(proposalId: string): Promise<ProposalQualifiedLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,ticket_title,customer_name,company,region,industry,estimated_value,probability_percent,target_date,notes,source_type,source_reference,legacy_opportunity_id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedQualifiedData(details);

  return {
    ticketFound: true,
    baselineData: buildBaselineFromTicket(row),
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalDiscoveryStageData(proposalId: string): Promise<ProposalDiscoveryLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedDiscoveryData(details);

  return {
    ticketFound: true,
    baselineData: buildDiscoveryBaselineFromTicket(row),
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalSolutionDesignStageData(proposalId: string): Promise<ProposalSolutionDesignLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedSolutionDesignData(details);

  return {
    ticketFound: true,
    baselineData: buildSolutionDesignBaselineFromTicket(row),
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalPnlPricingStageData(proposalId: string): Promise<ProposalPnlPricingLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedPnlPricingData(details);

  return {
    ticketFound: true,
    baselineData: buildPnlPricingBaselineFromTicket(row),
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalQuoteStageData(proposalId: string): Promise<ProposalQuoteLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,ticket_title,customer_name,company,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedQuoteData(details);

  return {
    ticketFound: true,
    baselineData: buildQuoteBaselineFromTicket(row),
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalDraftingStageData(proposalId: string): Promise<ProposalDraftingLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedProposalDraftingData(details);

  return {
    ticketFound: true,
    baselineData: {},
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalSentStageData(proposalId: string): Promise<ProposalSentLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedProposalSentData(details);

  return {
    ticketFound: true,
    baselineData: {},
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalNegotiationStageData(proposalId: string): Promise<ProposalNegotiationLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedProposalNegotiationData(details);

  return {
    ticketFound: true,
    baselineData: {},
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalCommercialApprovalStageData(proposalId: string): Promise<ProposalCommercialApprovalLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedProposalCommercialApprovalData(details);

  return {
    ticketFound: true,
    baselineData: {},
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalContractSignedStageData(proposalId: string): Promise<ProposalContractSignedLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedProposalContractSignedData(details);

  return {
    ticketFound: true,
    baselineData: {},
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function loadProposalGoLiveStageData(proposalId: string): Promise<ProposalGoLiveLoadResult> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ticketFound: false,
      baselineData: {},
      savedData: null,
      savedAt: null,
      source: "commercial_tickets",
    };
  }

  const row = data as ProposalTicketRow;
  const details = asRecord(row.type_details);
  const saved = readSavedProposalGoLiveData(details);

  return {
    ticketFound: true,
    baselineData: {},
    savedData: saved.data,
    savedAt: saved.savedAt,
    source: "commercial_tickets",
  };
}

export async function saveProposalQualifiedStageData(
  proposalId: string,
  data: ProposalQualifiedStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      qualified: {
        version: 1,
        savedAt,
        source: "proposal_qualified_stage",
        data: sanitizeQualifiedStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Qualified stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalDiscoveryStageData(
  proposalId: string,
  data: ProposalDiscoveryStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      discovery: {
        version: 1,
        savedAt,
        source: "proposal_discovery_stage",
        data: sanitizeDiscoveryStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Discovery stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalSolutionDesignStageData(
  proposalId: string,
  data: ProposalSolutionDesignStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      solution_design: {
        version: 1,
        savedAt,
        source: "proposal_solution_design_stage",
        data: sanitizeSolutionDesignStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Solution Design stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalPnlPricingStageData(
  proposalId: string,
  data: ProposalPnlPricingStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      pnl_pricing: {
        version: 1,
        savedAt,
        source: "proposal_pnl_pricing_stage",
        data: sanitizePnlPricingStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("P&L / Pricing stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalQuoteStageData(
  proposalId: string,
  data: ProposalQuoteStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      quote: {
        version: 1,
        savedAt,
        source: "proposal_quote_stage",
        data: sanitizeQuoteStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Quote stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalDraftingStageData(
  proposalId: string,
  data: ProposalDraftingStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      proposal_drafting: {
        version: 1,
        savedAt,
        source: "proposal_drafting_stage",
        data: sanitizeProposalDraftingStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Proposal Drafting stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalSentStageData(
  proposalId: string,
  data: ProposalSentStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      proposal_sent: {
        version: 1,
        savedAt,
        source: "proposal_sent_stage",
        data: sanitizeProposalSentStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Proposal Sent stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalNegotiationStageData(
  proposalId: string,
  data: ProposalNegotiationStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      negotiation: {
        version: 1,
        savedAt,
        source: "proposal_negotiation_stage",
        data: sanitizeProposalNegotiationStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Negotiation stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalCommercialApprovalStageData(
  proposalId: string,
  data: ProposalCommercialApprovalStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      commercial_approval: {
        version: 1,
        savedAt,
        source: "proposal_commercial_approval_stage",
        data: sanitizeProposalCommercialApprovalStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Commercial Approval stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalContractSignedStageData(
  proposalId: string,
  data: ProposalContractSignedStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      contract_signed: {
        version: 1,
        savedAt,
        source: "proposal_contract_signed_stage",
        data: sanitizeProposalContractSignedStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Contract Signed stage save did not update an active proposal ticket.");
  return { savedAt };
}

export async function saveProposalGoLiveStageData(
  proposalId: string,
  data: ProposalGoLiveStageData,
): Promise<{ savedAt: string }> {
  const { data: existing, error: readError } = await supabase
    .from("commercial_tickets")
    .select("id,type_details")
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Active proposal ticket was not found.");

  const currentDetails = asRecord((existing as { type_details?: unknown }).type_details);
  const currentWorkspace = asRecord(currentDetails.proposal_workspace);
  const savedAt = new Date().toISOString();
  const nextDetails = {
    ...currentDetails,
    proposal_workspace: {
      ...currentWorkspace,
      go_live: {
        version: 1,
        savedAt,
        source: "proposal_go_live_stage",
        data: sanitizeProposalGoLiveStageData(data),
      },
    },
  };

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({
      type_details: nextDetails,
      updated_at: savedAt,
    })
    .eq("id", proposalId)
    .eq("ticket_type", "proposal")
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (writeError) throw new Error(writeError.message);
  if (!updated) throw new Error("Go-Live stage save did not update an active proposal ticket.");
  return { savedAt };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPOSAL TRACKER STAGES (SC-01 Wave 04, T08-B)
//
// The proposal workspace shows TWO independent trackers backed by TWO
// established columns on the SAME commercial_tickets row:
//   - crm_pipeline_stage  — where the opportunity is commercially
//   - internal_stage      — what internal work stage the proposal is in
// Neither reads or writes the other.
//
// WHY THESE HELPERS EXIST
// lib/intake-save.ts#changeStage issues .update(...).eq("id", …) with no
// .select(), so it reports { error: null } even when the statement matched
// ZERO rows. That is not a theoretical hole: probed live on 2026-08-05 against
// commercial_tickets, an unauthorised PATCH of an existing, readable row
// returned HTTP 200 with an empty row set and left the stored value untouched
// — "no error" while nothing was written. Announcing success (and writing an
// audit entry) from that outcome would put a fabricated state change in front
// of the user. Everything below therefore CONFIRMS the stored value from the
// returned row before anything is reported, and writes the audit entry only
// after that confirmation.
//
// These helpers scope, they do not gate: they never block stage movement,
// never hide a stage and never require an approval.
// ═══════════════════════════════════════════════════════════════════════════

export type ProposalTrackerStageColumn = "crm_pipeline_stage" | "internal_stage";

export interface ProposalTrackerStages {
  /** true only when the ticket row itself was read back. */
  found: boolean;
  /** Raw stored value — null means the column is genuinely not recorded. */
  internalStage: string | null;
  crmPipelineStage: string | null;
  /** Set only when the READ failed. A failed read is not an empty result. */
  error: string | null;
}

/**
 * Read both tracker columns for one ticket, by exact id.
 *
 * The three outcomes stay distinguishable for the caller:
 *   - read failed               → { found: false, error: "<message>" }
 *   - ticket not visible/absent → { found: false, error: null }
 *   - read succeeded            → { found: true, …raw column values }
 * A null column is reported as null; it is never defaulted to a stage name.
 */
export async function readProposalTrackerStages(
  ticketId: string,
): Promise<ProposalTrackerStages> {
  const id = text(ticketId);
  if (!id) {
    return { found: false, internalStage: null, crmPipelineStage: null, error: "No commercial ticket id was supplied." };
  }

  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("id,internal_stage,crm_pipeline_stage")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { found: false, internalStage: null, crmPipelineStage: null, error: error.message };
  }
  if (!data) {
    return { found: false, internalStage: null, crmPipelineStage: null, error: null };
  }

  const row = data as Record<string, unknown>;
  return {
    found: true,
    internalStage: text(row.internal_stage) || null,
    crmPipelineStage: text(row.crm_pipeline_stage) || null,
    error: null,
  };
}

export interface ProposalTrackerStageChangeResult {
  /** true ONLY when the database returned the new value on the target row. */
  ok: boolean;
  /** The value the database actually holds now, as returned by the write. */
  persistedValue: string | null;
  /** true when the audit entry was accepted; only ever attempted after ok. */
  auditWritten: boolean;
  /** Human-facing explanation. Always populated. */
  message: string;
}

/**
 * Move ONE tracker column on ONE ticket and prove it landed.
 *
 * Order of operations is the whole point:
 *   1. UPDATE … .select("id,<column>").maybeSingle()   ← returns the stored row
 *   2. no returned row               → NOT saved, report the failure, stop
 *   3. returned value !== requested  → NOT saved as asked, report it, stop
 *   4. only now write the audit entry
 * The caller may move local state, open an Undo window or show success only
 * when ok is true.
 */
export async function changeProposalTrackerStage(input: {
  ticketId: string;
  column: ProposalTrackerStageColumn;
  oldValue: string | null;
  newValue: string;
  userName: string;
}): Promise<ProposalTrackerStageChangeResult> {
  const ticketId = text(input.ticketId);
  const newValue = text(input.newValue);
  if (!ticketId) {
    return { ok: false, persistedValue: null, auditWritten: false, message: "No commercial ticket is linked to this workspace." };
  }
  if (!newValue) {
    return { ok: false, persistedValue: null, auditWritten: false, message: "No stage was supplied." };
  }

  const { data: updated, error: writeError } = await supabase
    .from("commercial_tickets")
    .update({ [input.column]: newValue })
    .eq("id", ticketId)
    .select("id," + input.column)
    .maybeSingle();

  if (writeError) {
    return { ok: false, persistedValue: null, auditWritten: false, message: writeError.message };
  }
  if (!updated) {
    return {
      ok: false,
      persistedValue: null,
      auditWritten: false,
      message: "The database accepted the request but updated no row, so the stage was NOT saved. The displayed stage is unchanged.",
    };
  }

  const persistedValue = text((updated as unknown as Record<string, unknown>)[input.column]) || null;
  if (persistedValue !== newValue) {
    return {
      ok: false,
      persistedValue,
      auditWritten: false,
      message: "The stage was not stored as requested — the ticket now holds " + (persistedValue ?? "no value") + ".",
    };
  }

  // Confirmed persisted. Only now is there something true to record.
  const { error: auditError } = await supabase
    .from("commercial_ticket_audit")
    .insert({
      ticket_id: ticketId,
      action: "stage_changed",
      field_changed: input.column,
      old_value: text(input.oldValue) || null,
      new_value: newValue,
      user_name: input.userName,
      notes: null,
    });

  return {
    ok: true,
    persistedValue,
    auditWritten: !auditError,
    message: auditError
      ? "Saved to the commercial ticket, but the audit entry was not recorded (" + auditError.message + ")."
      : "Saved to the commercial ticket.",
  };
}

export type StageAdvanceOutcome =
  /** The write itself failed or changed nothing. Database truth is untouched. */
  | { status: "not_persisted"; message: string }
  /**
   * The write landed but the workspace could NOT be re-read. The display is
   * stale, so no success is claimed, no audit is written and the Undo window
   * stays shut — Undo must never act on a stage it cannot see.
   */
  | { status: "persisted_not_refreshed"; message: string }
  /** Persisted AND rehydrated: safe to report success and open Undo. */
  | { status: "confirmed"; message: string };

/**
 * Sequence a workspace stage advance: persist, then rehydrate, then report.
 *
 * `persist` must resolve true only on a confirmed write; `refetch` must resolve
 * true only when the record was actually re-read. `refetch` is never called
 * when the write did not land.
 */
export async function finalizeStageAdvance(deps: {
  persist: () => Promise<boolean>;
  refetch: () => Promise<boolean>;
}): Promise<StageAdvanceOutcome> {
  let persisted: boolean;
  try {
    persisted = await deps.persist();
  } catch (err: any) {
    return { status: "not_persisted", message: err?.message || "Database write failed. The workspace stage is unchanged." };
  }
  if (!persisted) {
    return {
      status: "not_persisted",
      message: "The database did not confirm the update (possibly a concurrent edit). The workspace stage is unchanged.",
    };
  }

  let refreshed: boolean;
  try {
    refreshed = await deps.refetch();
  } catch {
    refreshed = false;
  }
  if (!refreshed) {
    return {
      status: "persisted_not_refreshed",
      message: "The change IS persisted, but the page could not re-read it. Reload to see the current stage. Undo stays unavailable until the display reflects the saved stage.",
    };
  }

  return { status: "confirmed", message: "Stage change persisted and re-read." };
}
