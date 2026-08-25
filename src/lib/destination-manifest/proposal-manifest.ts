/**
 * proposal-manifest.ts — PADW T02 (pins P1/P2): the canonical Proposal
 * destination manifest. Every editable leaf field, repeated collection, and
 * document reference across ALL 11 Proposal stages, derived exhaustively from:
 *
 *  - src/components/proposal-workspace/proposal-workspace-state.ts
 *    (ProposalWorkspaceData and every interface it references — the state
 *    model each stage component edits and each stage envelope persists);
 *  - src/components/proposal-workspace/proposal-stages.ts
 *    (stage keys + task/tab labels);
 *  - src/lib/proposal-workspace-persistence.ts (per-stage envelope contract:
 *    type_details.proposal_workspace.<stage> = {version, savedAt, source, data});
 *  - src/lib/final-pack-loader.ts normalizeCommercialTicketDetails
 *    (the ONLY current PDF consumers: proposal_drafting + pnl_pricing).
 *
 * Derivation notes (honest method record, pin P2):
 *  - persistencePath is proposal_workspace-rooted WITHOUT the ".data" envelope
 *    segment; the patch runtime (proposal-field-patch.ts) inserts it.
 *  - Repeated collections emit ONE row-upsert descriptor (path ending "[]",
 *    with rowIdentity) plus one descriptor per row leaf.
 *  - `label` values are derived from the state-model field names (humanized);
 *    where the stage component renders a materially different label the
 *    independent audit corrects it here — labels are display metadata only,
 *    ids/paths are the contract.
 *  - `sanitizer` names the per-stage envelope sanitize contract in
 *    proposal-workspace-persistence.ts ("proposalStageEnvelope:<stage>").
 *  - Generated row ids (Date.now()/nanoid style) are NOT identity: rowIdentity
 *    names content leaves per pin P5.
 *  - Trackers (commercial_tickets.internal_stage / crm_pipeline_stage) are
 *    EXCLUDED by design (pin P9) — they are columns, not destinations, and no
 *    patch may address them.
 *  - Supporting Documents panels persist through the document vault/register,
 *    not the stage envelope — they are register destinations (documents[]),
 *    covered by the Tender manifest's document model and PDS-14/15 lanes, not
 *    duplicated here.
 */
import type {
  FieldDescriptor,
  FieldType,
  ProcessManifest,
  RowIdentitySpec,
} from "./manifest-types";

const P = "proposal" as const;

interface LeafSpec {
  key: string;
  label?: string;
  type?: FieldType;
  unit?: string;
  enumValues?: readonly string[];
  nullBehavior?: FieldDescriptor["nullBehavior"];
  evidence?: FieldDescriptor["evidence"];
  pdfConsumer?: FieldDescriptor["pdfConsumer"];
  notes?: string;
}

function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function defaultNull(type: FieldType): FieldDescriptor["nullBehavior"] {
  switch (type) {
    case "number":
    case "integer":
    case "currency":
    case "percent":
    case "boolean":
      return "default";
    default:
      return "empty_string";
  }
}

interface GroupOptions {
  stage: string;
  tab: string;
  uiOwner: string;
  /** proposal_workspace-relative base path, e.g. "pnl_pricing.commercialTerms". */
  basePath: string;
  /** Row identity for a basePath containing "[]" (required then). */
  rowIdentity?: RowIdentitySpec;
  /** Extra descriptor for the row-upsert path itself (collections only). */
  collectionLabel?: string;
  collectionNotes?: string;
  collectionPdfConsumer?: FieldDescriptor["pdfConsumer"];
}

function group(options: GroupOptions, leaves: LeafSpec[]): FieldDescriptor[] {
  const stageKey = options.basePath.split(".")[0];
  const sanitizer = `proposalStageEnvelope:${stageKey}`;
  const isCollection = options.basePath.endsWith("[]");
  const fields: FieldDescriptor[] = [];

  if (isCollection) {
    if (!options.rowIdentity) {
      throw new Error(`Collection "${options.basePath}" requires rowIdentity`);
    }
    fields.push({
      id: `p:${options.basePath}`,
      process: P,
      stage: options.stage,
      tab: options.tab,
      label: options.collectionLabel ?? humanize(options.basePath.split(".").pop()!.replace("[]", "")),
      type: "object",
      nullBehavior: "omit",
      sanitizer,
      persistencePath: options.basePath,
      uiOwner: options.uiOwner,
      rowIdentity: options.rowIdentity,
      evidence: "sidecar",
      pdfConsumer: options.collectionPdfConsumer ?? "not_exported",
      notes: options.collectionNotes ?? "Row upsert target — value is the whole row; identity per rowIdentity (pin P5).",
    });
  }

  for (const leaf of leaves) {
    const type = leaf.type ?? "text";
    const path = `${options.basePath}.${leaf.key}`;
    fields.push({
      id: `p:${path}`,
      process: P,
      stage: options.stage,
      tab: options.tab,
      label: leaf.label ?? humanize(leaf.key),
      type,
      ...(leaf.unit ? { unit: leaf.unit } : {}),
      ...(leaf.enumValues ? { enumValues: leaf.enumValues } : {}),
      nullBehavior: leaf.nullBehavior ?? defaultNull(type),
      sanitizer,
      persistencePath: path,
      uiOwner: options.uiOwner,
      ...(isCollection ? { rowIdentity: options.rowIdentity } : {}),
      evidence: leaf.evidence ?? "sidecar",
      pdfConsumer: leaf.pdfConsumer ?? "not_exported",
      ...(leaf.notes ? { notes: leaf.notes } : {}),
    });
  }
  return fields;
}

const FIT = ["strong", "moderate", "weak"] as const;
const GAP_FIT = ["fit", "tight", "gap"] as const;

const WORKBENCH = "src/components/proposal-workspace/ProposalStageWorkbench.tsx";
const stages = (name: string) => `src/components/proposal-workspace/stages/${name}`;

// ═════════════════════════════════════════════════════════════
// Stage 1 — Qualified
// ═════════════════════════════════════════════════════════════

const QUALIFIED: FieldDescriptor[] = [
  ...group(
    { stage: "qualified", tab: "Qualification Summary", uiOwner: stages("QualifiedStage.tsx"), basePath: "qualified.qualificationSummary" },
    [
      { key: "opportunityName" },
      { key: "customer" },
      { key: "region" },
      { key: "industry" },
      { key: "serviceType" },
      { key: "estimatedRevenue", type: "currency", unit: "SAR" },
      { key: "estimatedPallets", type: "integer" },
      { key: "expectedCloseDate", type: "date" },
      { key: "crmRef", type: "id_ref", label: "CRM reference" },
      { key: "leadSource" },
      { key: "qualificationConfidence", type: "percent", unit: "%" },
    ],
  ),
  ...group(
    { stage: "qualified", tab: "Customer Fit", uiOwner: stages("QualifiedStage.tsx"), basePath: "qualified.customerFit" },
    [
      { key: "icpFit", type: "enum", enumValues: FIT, label: "ICP fit" },
      { key: "strategicFit", type: "enum", enumValues: FIT },
      { key: "regionFit", type: "enum", enumValues: FIT },
      { key: "capabilityFit", type: "enum", enumValues: FIT },
      { key: "relationshipStrength", type: "enum", enumValues: FIT },
      { key: "competitorPresence", type: "enum", enumValues: ["none", "low", "high", "incumbent"] },
      { key: "fitScore", type: "enum", enumValues: ["green", "amber", "red"] },
      { key: "strategicFindings", type: "richtext" },
    ],
  ),
  ...group(
    { stage: "qualified", tab: "Opportunity Details", uiOwner: stages("QualifiedStage.tsx"), basePath: "qualified.opportunityBrief" },
    [
      { key: "customerNeed" },
      { key: "whyNow" },
      { key: "scopeSummary" },
      { key: "keyStakeholders" },
      { key: "decisionTimeline" },
      { key: "knownConstraints" },
    ],
  ),
  ...group(
    {
      stage: "qualified", tab: "Required Info", uiOwner: stages("QualifiedStage.tsx"),
      basePath: "qualified.requiredInfo[]",
      rowIdentity: { fingerprintFields: ["key"], note: "Stable checklist key (volumes/site_info/…)." },
      collectionLabel: "Required info item",
    },
    [
      { key: "label" },
      { key: "key", type: "id_ref", evidence: "none", notes: "Checklist identity key — not extraction content." },
      { key: "complete", type: "boolean", evidence: "none", notes: "Human workflow state, not source content." },
      { key: "notes" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 2 — Discovery
// ═════════════════════════════════════════════════════════════

const DISCOVERY: FieldDescriptor[] = [
  ...group(
    {
      stage: "discovery", tab: "Meeting Notes", uiOwner: stages("DiscoveryStage.tsx"),
      basePath: "discovery.meetingNotes[]",
      rowIdentity: { fingerprintFields: ["date", "attendees"], note: "A meeting is identified by its date + attendees." },
      collectionLabel: "Meeting note",
    },
    [
      { key: "date", type: "date" },
      { key: "attendees" },
      { key: "notes", type: "richtext" },
      { key: "keyDecisions" },
      { key: "openQuestions" },
      { key: "nextActions" },
    ],
  ),
  ...group(
    { stage: "discovery", tab: "Customer Needs", uiOwner: stages("DiscoveryStage.tsx"), basePath: "discovery.customerNeeds" },
    [
      { key: "warehousing" },
      { key: "transport" },
      { key: "vas", label: "VAS" },
      { key: "reporting" },
      { key: "compliance" },
      { key: "slaExpectations", label: "SLA expectations" },
    ],
  ),
  ...group(
    { stage: "discovery", tab: "Pain Points / Risks", uiOwner: stages("DiscoveryStage.tsx"), basePath: "discovery.currentPain" },
    [
      { key: "currentProvider" },
      { key: "costPain" },
      { key: "servicePain" },
      { key: "speedPain" },
      { key: "compliancePain" },
    ],
  ),
  ...group(
    { stage: "discovery", tab: "Volumes / Lanes / Inventory", uiOwner: stages("DiscoveryStage.tsx"), basePath: "discovery.volumesLanes" },
    [
      { key: "skuCount", label: "SKU count" },
      { key: "inbound" },
      { key: "outbound" },
      { key: "pallets" },
      { key: "locations" },
      { key: "laneMatrix" },
      { key: "tempZones", label: "Temperature zones" },
      { key: "peakSeasonality" },
    ],
  ),
  ...group(
    { stage: "discovery", tab: "Pain Points / Risks", uiOwner: stages("DiscoveryStage.tsx"), basePath: "discovery.risksAssumptions" },
    [
      { key: "unknowns" },
      { key: "dataGaps" },
      { key: "customerUncertainty" },
      { key: "capacityAssumptions" },
      { key: "commercialAssumptions" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 3 — Solution Design
// ═════════════════════════════════════════════════════════════

const SOLUTION_DESIGN: FieldDescriptor[] = [
  ...group(
    { stage: "solution_design", tab: "Solution Configuration", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.solutionConfiguration" },
    [
      { key: "solutionOverview", type: "richtext" },
      { key: "operatingModel" },
      { key: "serviceMix" },
      { key: "geographicCoverage" },
      { key: "designRationale" },
      { key: "handoverNotes" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "Warehouse Model", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.warehouseModel" },
    [
      { key: "storageType" },
      { key: "facilityType" },
      { key: "capacityEstimate" },
      { key: "handlingAssumptions" },
      { key: "tempZones", label: "Temperature zones" },
      { key: "laborAssumptions" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "Transport Model", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.transportModel" },
    [
      { key: "laneStructure" },
      { key: "vehicleTypes" },
      { key: "frequency" },
      { key: "sla", label: "SLA" },
      { key: "routeComplexity" },
      { key: "vendorRequirements" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "VAS / Special Handling", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.vasHandling" },
    [
      { key: "labeling" },
      { key: "kitting" },
      { key: "packaging" },
      { key: "returns" },
      { key: "compliance" },
      { key: "specializedHandling" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "Systems & Visibility", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.systemsVisibility" },
    [
      { key: "wmsRequirements", label: "WMS requirements" },
      { key: "tmsRequirements", label: "TMS requirements" },
      { key: "reportingDashboards" },
      { key: "integrationNeeds" },
      { key: "customerPortal" },
      { key: "dataExchange" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "Service Scope Matrix", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.serviceScope" },
    [
      { key: "included" },
      { key: "excluded" },
      { key: "customerResponsibilities" },
      { key: "halaResponsibilities" },
      { key: "kpiScope", label: "KPI scope" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "Operational Feasibility", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.operationalFeasibility" },
    [
      { key: "capacityFit", type: "enum", enumValues: GAP_FIT },
      { key: "equipmentFit", type: "enum", enumValues: GAP_FIT },
      { key: "regionFit", type: "enum", enumValues: GAP_FIT },
      { key: "opsComments" },
      { key: "riskFlags" },
    ],
  ),
  ...group(
    { stage: "solution_design", tab: "Assumptions & Dependencies", uiOwner: stages("SolutionDesignStage.tsx"), basePath: "solution_design.assumptionsDependencies" },
    [
      { key: "customerInputs" },
      { key: "halaDependencies" },
      { key: "timingAssumptions" },
      { key: "volumeAssumptions" },
      { key: "commercialDependencies" },
      { key: "openDecisions" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 4 — P&L / Pricing
// ═════════════════════════════════════════════════════════════

const PNL_PDF = ["pricing_table_single", "pricing_table_multi", "totals_words"] as const;

const PNL_PRICING: FieldDescriptor[] = [
  ...group(
    {
      stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: stages("PnlPricingStage.tsx"),
      basePath: "pnl_pricing.pnlVersions[]",
      rowIdentity: { fingerprintFields: ["name"], note: "A P&L version is identified by its name." },
      collectionLabel: "P&L version",
      collectionPdfConsumer: [...PNL_PDF],
      collectionNotes: "Projected into pricing.scenarios.rows by normalizeCommercialTicketDetails (customer-facing projection only — PDS-01).",
    },
    [
      { key: "name", pdfConsumer: [...PNL_PDF] },
      { key: "createdAt", type: "datetime", evidence: "none" },
      { key: "overheadPercent", type: "percent", unit: "%", pdfConsumer: [...PNL_PDF] },
      { key: "notes", notes: "INTERNAL — projected as scenario notes but excluded from customer output by PDS-01." },
      { key: "isApproved", type: "boolean", evidence: "none", pdfConsumer: [...PNL_PDF], notes: "Working-scenario marker." },
    ],
  ),
  // Nested repeated leaves inside a P&L version (revenue/cost lines).
  ...group(
    {
      stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: stages("PnlPricingStage.tsx"),
      basePath: "pnl_pricing.pnlVersions[].revenue[]",
      rowIdentity: { fingerprintFields: ["label"], note: "Outer level: version name; inner level: line label." },
      collectionLabel: "P&L revenue line",
      collectionPdfConsumer: [...PNL_PDF],
    },
    [
      { key: "label", pdfConsumer: [...PNL_PDF] },
      { key: "amount", type: "currency", unit: "SAR", pdfConsumer: [...PNL_PDF] },
    ],
  ),
  ...group(
    {
      stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: stages("PnlPricingStage.tsx"),
      basePath: "pnl_pricing.pnlVersions[].costs[]",
      rowIdentity: { fingerprintFields: ["label"], note: "Outer level: version name; inner level: line label." },
      collectionLabel: "P&L cost line",
      collectionNotes: "INTERNAL cost model — never customer-facing (PDS-01).",
    },
    [
      { key: "label" },
      { key: "amount", type: "currency", unit: "SAR", notes: "INTERNAL cost — excluded from customer output (PDS-01)." },
    ],
  ),
  ...group(
    { stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: stages("PnlPricingStage.tsx"), basePath: "pnl_pricing" },
    [
      { key: "activePnlVersion", type: "id_ref", label: "Active P&L version", pdfConsumer: [...PNL_PDF], notes: "Selected-scenario id in the PDF projection." },
    ],
  ),
  ...group(
    {
      stage: "pnl_pricing", tab: "Cost Inputs", uiOwner: stages("PnlPricingStage.tsx"),
      basePath: "pnl_pricing.costInputs[]",
      rowIdentity: { fingerprintFields: ["category", "description"] },
      collectionLabel: "Cost input",
      collectionNotes: "INTERNAL cost basis — never customer-facing.",
    },
    [
      { key: "category" },
      { key: "description" },
      { key: "amount", type: "currency", unit: "SAR" },
      { key: "source" },
      { key: "verified", type: "boolean", evidence: "none" },
    ],
  ),
  ...group(
    {
      stage: "pnl_pricing", tab: "Pricing Lines", uiOwner: stages("PnlPricingStage.tsx"),
      basePath: "pnl_pricing.pricingLines[]",
      rowIdentity: { fingerprintFields: ["service", "unit"] },
      collectionLabel: "Pricing line",
    },
    [
      { key: "service" },
      { key: "unit" },
      { key: "rate", type: "currency", unit: "SAR" },
      { key: "quantity", type: "number" },
      { key: "frequency" },
      { key: "total", type: "currency", unit: "SAR", evidence: "none", notes: "Derived from rate × quantity in the UI." },
    ],
  ),
  ...group(
    {
      stage: "pnl_pricing", tab: "Margin Scenarios", uiOwner: stages("PnlPricingStage.tsx"),
      basePath: "pnl_pricing.marginScenarios[]",
      rowIdentity: { fingerprintFields: ["name"] },
      collectionLabel: "Margin scenario",
      collectionNotes: "INTERNAL margin analysis — never customer-facing.",
    },
    [
      { key: "name" },
      { key: "revenue", type: "currency", unit: "SAR" },
      { key: "cost", type: "currency", unit: "SAR" },
      { key: "gp", type: "currency", unit: "SAR", label: "Gross profit" },
      { key: "gpPercent", type: "percent", unit: "%", label: "GP %" },
      { key: "notes" },
    ],
  ),
  ...group(
    { stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: stages("PnlPricingStage.tsx"), basePath: "pnl_pricing.commercialTerms" },
    [
      { key: "vat", label: "VAT" },
      { key: "paymentTerms" },
      { key: "proposalValidity" },
      { key: "contractDuration" },
      { key: "renewalNotice" },
      { key: "mobilization" },
      { key: "workingDays" },
      { key: "workingHours" },
      { key: "forecastNotice" },
      { key: "loadingResponsibility" },
      { key: "offloadingResponsibility" },
      { key: "permits" },
      { key: "weightLimits" },
      { key: "insurance" },
      { key: "liabilityExclusions" },
      { key: "overtime" },
      { key: "cancellation" },
      { key: "detention" },
      { key: "demurrage" },
      { key: "fuelSurcharge" },
      { key: "policyChangeClause" },
      { key: "additionalChargeApproval" },
    ],
  ),
  ...group(
    { stage: "pnl_pricing", tab: "Assumptions / Exclusions", uiOwner: stages("PnlPricingStage.tsx"), basePath: "pnl_pricing.pricingAssumptionsExclusions" },
    [
      { key: "pricingAssumptions" },
      { key: "operationalAssumptions" },
      { key: "volumeAssumptions" },
      { key: "customerResponsibilities" },
      { key: "halaResponsibilities" },
      { key: "exclusions" },
      { key: "dependencies" },
      { key: "limitations" },
      { key: "commercialRiskNotes" },
      { key: "pricingApprovalNotes" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 5 — Quote
// ═════════════════════════════════════════════════════════════

const QUOTE: FieldDescriptor[] = [
  ...group(
    { stage: "quote", tab: "Quote Summary", uiOwner: stages("QuoteStage.tsx"), basePath: "quote.quoteSummary" },
    [
      { key: "quoteTitle" },
      { key: "quoteDate", type: "date" },
      { key: "quoteOwner" },
      { key: "quoteVersion" },
      { key: "customerName" },
      { key: "quotedServices" },
      { key: "quoteNarrative", type: "richtext" },
      { key: "internalNotes", notes: "INTERNAL — never customer-facing." },
    ],
  ),
  ...group(
    { stage: "quote", tab: "Service Scope", uiOwner: stages("QuoteStage.tsx"), basePath: "quote.quoteServiceScope" },
    [
      { key: "includedServices" },
      { key: "excludedServices" },
      { key: "serviceLocations" },
      { key: "serviceLevels" },
      { key: "customerResponsibilities" },
      { key: "halaResponsibilities" },
    ],
  ),
  ...group(
    { stage: "quote", tab: "Pricing Summary", uiOwner: stages("QuoteStage.tsx"), basePath: "quote.quotePricingSummary" },
    [
      { key: "linkedPnlVersionId", type: "id_ref", label: "Linked P&L version id" },
      { key: "linkedPnlVersionName", label: "Linked P&L version" },
      { key: "totalRevenue", type: "currency", unit: "SAR" },
      { key: "totalCost", type: "currency", unit: "SAR", notes: "INTERNAL — carried from the working P&L; never customer-facing." },
      { key: "grossProfit", type: "currency", unit: "SAR", notes: "INTERNAL." },
      { key: "grossProfitPercent", type: "percent", unit: "%", notes: "INTERNAL." },
      { key: "pricingSummary", type: "richtext" },
      { key: "pricingTableNotes" },
    ],
  ),
  ...group(
    { stage: "quote", tab: "Terms / Assumptions / Exclusions", uiOwner: stages("QuoteStage.tsx"), basePath: "quote.quoteTermsAssumptionsExclusions" },
    [
      { key: "paymentTerms" },
      { key: "validity" },
      { key: "contractTerm" },
      { key: "vat", label: "VAT" },
      { key: "assumptions" },
      { key: "exclusions" },
      { key: "dependencies" },
      { key: "riskNotes" },
    ],
  ),
  ...group(
    {
      stage: "quote", tab: "Quote Versions", uiOwner: stages("QuoteStage.tsx"),
      basePath: "quote.quoteVersions[]",
      rowIdentity: { fingerprintFields: ["versionLabel"] },
      collectionLabel: "Quote version",
    },
    [
      { key: "versionLabel" },
      { key: "createdAt", type: "datetime", evidence: "none" },
      { key: "status" },
      { key: "notes" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 6 — Proposal Drafting (PDF-consumed: PDS-06 structured ingestion)
// ═════════════════════════════════════════════════════════════

const DRAFT_PDF = ["narrative", "scope_list", "closing"] as const;

const PROPOSAL_DRAFTING: FieldDescriptor[] = [
  ...group(
    {
      stage: "proposal_drafting", tab: "TOC Planner", uiOwner: WORKBENCH,
      basePath: "proposal_drafting.proposalTocSections[]",
      rowIdentity: { fingerprintFields: ["sectionTitle"] },
      collectionLabel: "TOC section",
      collectionPdfConsumer: [...DRAFT_PDF],
    },
    [
      { key: "sectionTitle", pdfConsumer: [...DRAFT_PDF], notes: "Title-fallback slot matching in the loader." },
      { key: "volume" },
      { key: "purpose" },
      { key: "sourceStage" },
      { key: "includeInProposal", type: "boolean", evidence: "none" },
      { key: "notes" },
    ],
  ),
  ...group(
    {
      stage: "proposal_drafting", tab: "Source Map", uiOwner: WORKBENCH,
      basePath: "proposal_drafting.proposalSourceMap[]",
      rowIdentity: { fingerprintFields: ["sourceStage", "sourceField", "targetSectionId"] },
      collectionLabel: "Source map row",
    },
    [
      { key: "sourceStage" },
      { key: "sourceTab" },
      { key: "sourceField" },
      { key: "targetSectionId", type: "id_ref" },
      { key: "usageNotes" },
    ],
  ),
  ...group(
    {
      stage: "proposal_drafting", tab: "Block Editor", uiOwner: WORKBENCH,
      basePath: "proposal_drafting.proposalDraftBlocks[]",
      rowIdentity: { fingerprintFields: ["blockTitle", "sectionId"] },
      collectionLabel: "Draft block",
      collectionPdfConsumer: [...DRAFT_PDF],
      collectionNotes: "Projected into tender_drafting.proposal_blocks for the pack loader; unmatched blocks are ingested as extra sections (PDS-06).",
    },
    [
      { key: "sectionId", type: "id_ref" },
      { key: "blockTitle", pdfConsumer: [...DRAFT_PDF] },
      { key: "volume" },
      { key: "owner" },
      { key: "status" },
      { key: "sourceRefs" },
      { key: "content", type: "richtext", pdfConsumer: [...DRAFT_PDF], notes: "The drafted customer prose that reaches the pack." },
    ],
  ),
  ...group(
    { stage: "proposal_drafting", tab: "Technical / Operational Volume", uiOwner: WORKBENCH, basePath: "proposal_drafting.proposalTechnicalVolume" },
    [
      { key: "solutionOverview", type: "richtext" },
      { key: "warehouseOperations", type: "richtext" },
      { key: "transportOperations", type: "richtext" },
      { key: "systemsVisibility", type: "richtext" },
      { key: "serviceLevels", type: "richtext" },
      { key: "implementationNotes", type: "richtext" },
    ],
  ),
  ...group(
    { stage: "proposal_drafting", tab: "Commercial Volume", uiOwner: WORKBENCH, basePath: "proposal_drafting.proposalCommercialVolume" },
    [
      { key: "pricingNarrative", type: "richtext" },
      { key: "commercialTerms", type: "richtext" },
      { key: "assumptionsExclusions", type: "richtext" },
      { key: "valueNarrative", type: "richtext" },
      { key: "riskNotes", type: "richtext" },
    ],
  ),
  ...group(
    {
      stage: "proposal_drafting", tab: "Evidence Register", uiOwner: WORKBENCH,
      basePath: "proposal_drafting.proposalEvidenceItems[]",
      rowIdentity: { fingerprintFields: ["evidenceTitle", "linkedSectionId"] },
      collectionLabel: "Evidence item",
    },
    [
      { key: "evidenceTitle" },
      { key: "evidenceType" },
      { key: "sourceStage" },
      { key: "linkedSectionId", type: "id_ref" },
      { key: "documentRef", type: "id_ref", notes: "Document reference — exact stored document id." },
      { key: "notes" },
    ],
  ),
  ...group(
    { stage: "proposal_drafting", tab: "Appendix Notes", uiOwner: WORKBENCH, basePath: "proposal_drafting.proposalAppendixNotes" },
    [
      { key: "appendixPlan" },
      { key: "evidenceGaps" },
      { key: "formattingNotes" },
    ],
  ),
  ...group(
    { stage: "proposal_drafting", tab: "Final Draft Review", uiOwner: WORKBENCH, basePath: "proposal_drafting.proposalFinalDraftReview" },
    [
      { key: "reviewOwner" },
      { key: "reviewDate", type: "date" },
      { key: "readinessNotes" },
      { key: "openIssues" },
      { key: "nextAction" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 7 — Proposal Sent
// ═════════════════════════════════════════════════════════════

const PROPOSAL_SENT: FieldDescriptor[] = [
  ...group(
    { stage: "proposal_sent", tab: "Sent Version", uiOwner: WORKBENCH, basePath: "proposal_sent.proposalSentVersion" },
    [
      { key: "sentVersionLabel" },
      { key: "sourceDraftReference" },
      { key: "proposalTitle" },
      { key: "sentStatus" },
      { key: "sentDocumentRef", type: "id_ref" },
      { key: "notes" },
    ],
  ),
  ...group(
    { stage: "proposal_sent", tab: "Delivery Record", uiOwner: WORKBENCH, basePath: "proposal_sent.proposalDeliveryRecord" },
    [
      { key: "sentDate", type: "date" },
      { key: "sentTime" },
      { key: "channel" },
      { key: "sentBy" },
      { key: "deliveryStatus" },
      { key: "deliveryNotes" },
    ],
  ),
  ...group(
    {
      stage: "proposal_sent", tab: "Recipient / Contact Log", uiOwner: WORKBENCH,
      basePath: "proposal_sent.proposalRecipientContacts[]",
      rowIdentity: { fingerprintFields: ["contactName", "email"] },
      collectionLabel: "Recipient contact",
    },
    [
      { key: "contactName" },
      { key: "role" },
      { key: "company" },
      { key: "email" },
      { key: "phone" },
      { key: "included", type: "boolean", evidence: "none" },
      { key: "notes" },
    ],
  ),
  ...group(
    {
      stage: "proposal_sent", tab: "Attachments Register", uiOwner: WORKBENCH,
      basePath: "proposal_sent.proposalSentAttachments[]",
      rowIdentity: { fingerprintFields: ["documentName", "versionLabel"] },
      collectionLabel: "Sent attachment",
    },
    [
      { key: "documentName" },
      { key: "category" },
      { key: "versionLabel" },
      { key: "documentRef", type: "id_ref" },
      { key: "included", type: "boolean", evidence: "none" },
      { key: "notes" },
    ],
  ),
  ...group(
    { stage: "proposal_sent", tab: "CRM Sync", uiOwner: WORKBENCH, basePath: "proposal_sent.proposalCrmSyncRecord" },
    [
      { key: "crmOpportunityRef", type: "id_ref", label: "CRM opportunity reference" },
      { key: "crmStage", label: "CRM stage", notes: "A human-RECORDED fact about the external CRM — not the internal tracker (pin P9)." },
      { key: "syncStatus" },
      { key: "recordedBy" },
      { key: "recordedAt", type: "datetime" },
      { key: "notes" },
    ],
  ),
  ...group(
    {
      stage: "proposal_sent", tab: "Delivery Notes", uiOwner: WORKBENCH,
      basePath: "proposal_sent.proposalSentAuditNotes[]",
      rowIdentity: { fingerprintFields: ["eventDate", "action"] },
      collectionLabel: "Delivery note",
    },
    [
      { key: "eventDate", type: "date" },
      { key: "actor" },
      { key: "action" },
      { key: "notes" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 8 — Negotiation
// ═════════════════════════════════════════════════════════════

const NEGOTIATION: FieldDescriptor[] = [
  ...group(
    {
      stage: "negotiation", tab: "Customer Feedback", uiOwner: WORKBENCH,
      basePath: "negotiation.proposalCustomerFeedback[]",
      rowIdentity: { fingerprintFields: ["feedbackDate", "contactName", "feedbackSummary"] },
      collectionLabel: "Customer feedback",
    },
    [
      { key: "feedbackDate", type: "date" },
      { key: "contactName" },
      { key: "feedbackType" },
      { key: "feedbackSummary" },
      { key: "sentiment" },
      { key: "owner" },
      { key: "nextAction" },
    ],
  ),
  ...group(
    {
      stage: "negotiation", tab: "Requested Scope Changes", uiOwner: WORKBENCH,
      basePath: "negotiation.proposalRequestedScopeChanges[]",
      rowIdentity: { fingerprintFields: ["changeArea", "requestedChange"] },
      collectionLabel: "Requested scope change",
    },
    [
      { key: "changeArea" },
      { key: "requestedChange" },
      { key: "operationalImpact" },
      { key: "status" },
      { key: "owner" },
      { key: "notes" },
    ],
  ),
  ...group(
    {
      stage: "negotiation", tab: "Pricing Changes", uiOwner: WORKBENCH,
      basePath: "negotiation.proposalPricingChanges[]",
      rowIdentity: { fingerprintFields: ["serviceLine", "requestedChange"] },
      collectionLabel: "Pricing change",
    },
    [
      { key: "serviceLine" },
      { key: "requestedChange" },
      { key: "revisedPrice" },
      { key: "commercialImpact" },
      { key: "status" },
      { key: "notes" },
    ],
  ),
  ...group(
    { stage: "negotiation", tab: "Margin Impact", uiOwner: WORKBENCH, basePath: "negotiation.proposalNegotiationMarginImpact" },
    [
      { key: "linkedPnlVersion", type: "id_ref", label: "Linked P&L version" },
      { key: "revenueImpact" },
      { key: "costImpact", notes: "INTERNAL." },
      { key: "grossProfitImpact", notes: "INTERNAL." },
      { key: "marginNotes", notes: "INTERNAL." },
      { key: "approvalNotes" },
    ],
  ),
  ...group(
    {
      stage: "negotiation", tab: "Revised Versions", uiOwner: WORKBENCH,
      basePath: "negotiation.proposalRevisedVersions[]",
      rowIdentity: { fingerprintFields: ["versionLabel"] },
      collectionLabel: "Revised version",
    },
    [
      { key: "versionLabel" },
      { key: "sourceVersion" },
      { key: "changeSummary" },
      { key: "documentRef", type: "id_ref" },
      { key: "status" },
      { key: "notes" },
    ],
  ),
  ...group(
    {
      stage: "negotiation", tab: "Negotiation Notes", uiOwner: WORKBENCH,
      basePath: "negotiation.proposalNegotiationNotes[]",
      rowIdentity: { fingerprintFields: ["noteDate", "discussionSummary"] },
      collectionLabel: "Negotiation note",
    },
    [
      { key: "noteDate", type: "date" },
      { key: "actor" },
      { key: "discussionSummary" },
      { key: "decision" },
      { key: "nextAction" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 9 — Commercial Approval (human-recorded facts; no enforcement)
// ═════════════════════════════════════════════════════════════

const COMMERCIAL_APPROVAL: FieldDescriptor[] = [
  ...group(
    { stage: "commercial_approval", tab: "Approval Summary", uiOwner: WORKBENCH, basePath: "commercial_approval.proposalApprovalSummary" },
    [
      { key: "reviewOwner" },
      { key: "reviewDate", type: "date" },
      { key: "reviewStatus" },
      { key: "proposalVersion" },
      { key: "reviewScope" },
      { key: "summaryNotes" },
    ],
  ),
  ...group(
    { stage: "commercial_approval", tab: "Margin / Terms Review", uiOwner: WORKBENCH, basePath: "commercial_approval.proposalMarginTermsReview" },
    [
      { key: "linkedPnlVersion", type: "id_ref", label: "Linked P&L version" },
      { key: "finalRevenue", type: "currency", unit: "SAR" },
      { key: "finalCost", type: "currency", unit: "SAR", notes: "INTERNAL." },
      { key: "finalGrossProfit", type: "currency", unit: "SAR", notes: "INTERNAL." },
      { key: "finalGpPercent", type: "percent", unit: "%", label: "Final GP %", notes: "INTERNAL." },
      { key: "marginPosition", notes: "INTERNAL." },
      { key: "paymentTermsPosition" },
      { key: "commercialTermsPosition" },
    ],
  ),
  ...group(
    { stage: "commercial_approval", tab: "Risk / Exception Notes", uiOwner: WORKBENCH, basePath: "commercial_approval.proposalRiskExceptionNotes" },
    [
      { key: "riskSummary" },
      { key: "exceptionSummary" },
      { key: "mitigationNotes" },
      { key: "unresolvedItems" },
      { key: "customerDependencies" },
    ],
  ),
  ...group(
    { stage: "commercial_approval", tab: "Final Commercial Position", uiOwner: WORKBENCH, basePath: "commercial_approval.proposalFinalCommercialPosition" },
    [
      { key: "finalScopePosition" },
      { key: "finalPricingPosition" },
      { key: "finalTermsPosition" },
      { key: "negotiationCarryForward" },
      { key: "valueJustification" },
      { key: "handoverNotes" },
    ],
  ),
  ...group(
    { stage: "commercial_approval", tab: "Approval Record", uiOwner: WORKBENCH, basePath: "commercial_approval.proposalApprovalRecord" },
    [
      { key: "recordedDecision", notes: "Human-recorded decision fact — never an enforcement gate." },
      { key: "recordedBy" },
      { key: "recordedDate", type: "date" },
      { key: "reference" },
      { key: "conditions" },
      { key: "nextAction" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 10 — Contract Signed
// ═════════════════════════════════════════════════════════════

const CONTRACT_SIGNED: FieldDescriptor[] = [
  ...group(
    { stage: "contract_signed", tab: "Signed Contract Reference", uiOwner: WORKBENCH, basePath: "contract_signed.proposalSignedContractReference" },
    [
      { key: "contractTitle" },
      { key: "contractNumber" },
      { key: "finalCustomer" },
      { key: "signedDate", type: "date" },
      { key: "customerSignatory" },
      { key: "halaSignatory" },
      { key: "contractDocumentRef", type: "id_ref" },
      { key: "notes" },
    ],
  ),
  ...group(
    { stage: "contract_signed", tab: "Final Scope", uiOwner: WORKBENCH, basePath: "contract_signed.proposalFinalContractScope" },
    [
      { key: "finalServiceScope" },
      { key: "finalLocations" },
      { key: "finalVolumes" },
      { key: "halaResponsibilities" },
      { key: "customerResponsibilities" },
      { key: "exclusions" },
    ],
  ),
  ...group(
    { stage: "contract_signed", tab: "Final Pricing", uiOwner: WORKBENCH, basePath: "contract_signed.proposalFinalContractPricing" },
    [
      { key: "linkedCommercialApproval", type: "id_ref" },
      { key: "finalRevenue", type: "currency", unit: "SAR" },
      { key: "finalCost", type: "currency", unit: "SAR", notes: "INTERNAL." },
      { key: "finalGrossProfit", type: "currency", unit: "SAR", notes: "INTERNAL." },
      { key: "finalGpPercent", type: "percent", unit: "%", label: "Final GP %", notes: "INTERNAL." },
      { key: "pricingNotes" },
    ],
  ),
  ...group(
    { stage: "contract_signed", tab: "Final Terms", uiOwner: WORKBENCH, basePath: "contract_signed.proposalFinalContractTerms" },
    [
      { key: "paymentTerms" },
      { key: "contractTerm" },
      { key: "startDate", type: "date" },
      { key: "renewalNotice" },
      { key: "liabilityPosition" },
      { key: "terminationTerms" },
      { key: "finalSlaKpiNotes", label: "Final SLA/KPI notes" },
      { key: "specialConditions" },
    ],
  ),
  ...group(
    { stage: "contract_signed", tab: "Handover Prep", uiOwner: WORKBENCH, basePath: "contract_signed.proposalContractHandoverPrep" },
    [
      { key: "handoverOwner" },
      { key: "operationsOwner" },
      { key: "handoverDate", type: "date" },
      { key: "mobilisationNotes" },
      { key: "openActions" },
      { key: "contractMemoryNotes" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// Stage 11 — Go-Live
// ═════════════════════════════════════════════════════════════

const GO_LIVE: FieldDescriptor[] = [
  ...group(
    { stage: "go_live", tab: "Go-Live Summary", uiOwner: WORKBENCH, basePath: "go_live.proposalGoLiveSummary" },
    [
      { key: "goLiveDate", type: "date" },
      { key: "goLiveStatus" },
      { key: "commercialOwner" },
      { key: "operationalOwner" },
      { key: "customerContact" },
      { key: "commercialPromiseSummary" },
    ],
  ),
  ...group(
    { stage: "go_live", tab: "Mobilization Tracker", uiOwner: WORKBENCH, basePath: "go_live.proposalMobilizationTracker" },
    [
      { key: "mobilizationStatus" },
      { key: "mobilizationStartDate", type: "date" },
      { key: "targetGoLiveDate", type: "date" },
      { key: "facilityReadiness" },
      { key: "resourceReadiness" },
      { key: "systemsReadiness" },
      { key: "customerReadiness" },
      { key: "mobilizationNotes" },
    ],
  ),
  ...group(
    { stage: "go_live", tab: "Operations Handover", uiOwner: WORKBENCH, basePath: "go_live.proposalOperationsHandover" },
    [
      { key: "operationsOwner" },
      { key: "handoverDate", type: "date" },
      { key: "handoverChecklist" },
      { key: "finalScopeReference" },
      { key: "keyResponsibilities" },
      { key: "handoverNotes" },
    ],
  ),
  ...group(
    { stage: "go_live", tab: "SLA / KPI Setup", uiOwner: WORKBENCH, basePath: "go_live.proposalSlaKpiSetup" },
    [
      { key: "serviceLevelSummary" },
      { key: "kpiDefinitions", label: "KPI definitions" },
      { key: "measurementMethod" },
      { key: "reportingCadence" },
      { key: "exclusions" },
      { key: "openSlaKpiNotes", label: "Open SLA/KPI notes" },
    ],
  ),
  ...group(
    { stage: "go_live", tab: "Open Risks", uiOwner: WORKBENCH, basePath: "go_live.proposalOpenImplementationRisks" },
    [
      { key: "riskSummary" },
      { key: "customerDependencies" },
      { key: "operationalRisks" },
      { key: "commercialRisks" },
      { key: "mitigationPlan" },
      { key: "owner" },
      { key: "status" },
    ],
  ),
  ...group(
    { stage: "go_live", tab: "Renewal / Future Memory", uiOwner: WORKBENCH, basePath: "go_live.proposalRenewalFutureMemory" },
    [
      { key: "renewalBaselineNotes" },
      { key: "noticePeriodMemory" },
      { key: "futureOpportunityNotes" },
      { key: "expansionPotential" },
      { key: "contractReviewNotes" },
      { key: "memoryOwner" },
    ],
  ),
];

// ═════════════════════════════════════════════════════════════
// The manifest
// ═════════════════════════════════════════════════════════════

export const PROPOSAL_MANIFEST: ProcessManifest = {
  process: "proposal",
  stages: [
    "qualified",
    "discovery",
    "solution_design",
    "pnl_pricing",
    "quote",
    "proposal_drafting",
    "proposal_sent",
    "negotiation",
    "commercial_approval",
    "contract_signed",
    "go_live",
  ],
  fields: [
    ...QUALIFIED,
    ...DISCOVERY,
    ...SOLUTION_DESIGN,
    ...PNL_PRICING,
    ...QUOTE,
    ...PROPOSAL_DRAFTING,
    ...PROPOSAL_SENT,
    ...NEGOTIATION,
    ...COMMERCIAL_APPROVAL,
    ...CONTRACT_SIGNED,
    ...GO_LIVE,
  ],
};
