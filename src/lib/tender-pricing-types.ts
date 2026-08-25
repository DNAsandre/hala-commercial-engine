export const NOT_CAPTURED = "Not Captured" as const;
export const NOT_ASSESSED = "Not Assessed" as const;
export const NOT_SUBMITTED = "Not Submitted" as const;

export type TenderPricingSectionKey =
  | "pnl_snapshot"
  | "cost_inputs"
  | "scenarios"
  | "commercial_terms"
  | "approval";

export type PnlSnapshotStatus =
  | "No Snapshot"
  | "Draft Snapshot"
  | "Submitted for Review"
  | "Finance Approved"
  | "Commercial Approved"
  | "Management Approved"
  | "Rejected"
  | "Revision Required"
  | "Not Captured";

export type CalculatorSource = "Existing /pnl calculator" | "Not linked";

export interface PnlSnapshotData {
  linked_pnl_record_id: string;
  snapshot_status: PnlSnapshotStatus;
  last_snapshot_date: string;
  last_updated_by: string;
  calculator_source: CalculatorSource;
  monthly_revenue: string;
  annual_revenue: string;
  monthly_opex: string;
  annual_opex: string;
  gross_profit_sar: string;
  gp_percent: string;
  target_gp_percent: string;
  variance_to_target_gp: string;
  approval_chain_required: string;
  notes: string;
}

export type CostInputSource =
  | "Existing P&L Calculator"
  | "Manual Tender Estimate"
  | "Imported Pricing Sheet"
  | "Not Captured";

export interface CostInputSourceData {
  cost_input_source: CostInputSource;
  source_reference: string;
  owner: string;
  last_updated: string;
  notes: string;
}

export interface CostInputsData {
  source: CostInputSourceData;
  warehouse_operations: Record<string, string>;
  transport: Record<string, string>;
  manpower: Record<string, string>;
  systems_hip: Record<string, string>;
  risk_contingency: Record<string, string>;
  notes: {
    cost_assumptions: string;
    source_notes: string;
    pricing_dependencies: string;
    finance_comments: string;
  };
}

export type ScenarioType =
  | "Base Case"
  | "Dedicated Model"
  | "Shared Model"
  | "Per Trip Model"
  | "Monthly Retainer"
  | "Aggressive Pricing"
  | "Target Margin Pricing"
  | "Alternative Option"
  | "Other";

export type YesNoNotAssessed = "Yes" | "No" | "Not Assessed";

export interface PricingScenarioRow {
  id: string;
  scenario_name: string;
  scenario_type: ScenarioType;
  linked_pnl_snapshot_reference: string;
  revenue: string;
  cost: string;
  gp_percent: string;
  target_gp_percent: string;
  variance: string;
  operational_assumption: string;
  commercial_risk: string;
  recommended: YesNoNotAssessed;
  notes: string;
}

export interface SelectedPricingScenario {
  selected_scenario_id: string;
  selected_scenario_name: string;
  reason_for_selection: string;
  approval_required: YesNoNotAssessed;
}

export interface PricingScenarioSummary {
  number_of_scenarios: number;
  highest_gp_percent: string;
  lowest_gp_percent: string;
  selected_scenario: string;
  scenarios_below_target_gp: number;
}

export interface PricingScenariosData {
  rows: PricingScenarioRow[];
  selected_scenario: SelectedPricingScenario;
  summary: PricingScenarioSummary;
}

export type PaymentTerms =
  | "30 days"
  | "45 days"
  | "60 days"
  | "Advance"
  | "Milestone"
  | "Other"
  | "Not Captured";

export type VatTreatment =
  | "VAT Exclusive"
  | "VAT Inclusive"
  | "Not Applicable"
  | "Not Captured";

export type InsuranceTreatment =
  | "Included"
  | "Optional"
  | "Excluded"
  | "Customer Responsibility"
  | "Not Captured";

export type ChargeType =
  | "Fuel Surcharge"
  | "Overtime"
  | "Cancellation Charge"
  | "Detention"
  | "Demurrage"
  | "Overweight Penalty"
  | "Permit Cost"
  | "Additional Handling"
  | "Insurance"
  | "Other";

export type AssumptionCategory =
  | "Operational"
  | "Commercial"
  | "Technical"
  | "Customer Dependency"
  | "Legal / Contractual"
  | "HSE / Compliance"
  | "Pricing"
  | "Submission"
  | "Other";

export type CommercialAssumptionStatus =
  | "Draft"
  | "Confirmed"
  | "Needs Clarification"
  | "Accepted"
  | "Removed";

export interface CommercialTermsData {
  payment_tax_validity: {
    payment_terms: PaymentTerms;
    vat_treatment: VatTreatment;
    vat_percent: string;
    proposal_validity: string;
    contract_term: string;
    extension_option: string;
  };
  mobilization_notice_forecast: {
    mobilization_period: string;
    movement_notice_period: string;
    forecast_notice_period: string;
    asn_requirement: string;
    customer_forecast_responsibility: string;
    notes: string;
  };
  insurance_liability: {
    insurance_treatment: InsuranceTreatment;
    coverage_limit: string;
    liability_notes: string;
    force_majeure_treatment: string;
    damage_responsibility_notes: string;
  };
  surcharges: SurchargeRow[];
  customer_responsibilities: CustomerResponsibilityRow[];
  exclusions: ExclusionRow[];
  assumptions: CommercialAssumptionRow[];
}

export interface SurchargeRow {
  id: string;
  charge_type: ChargeType;
  trigger: string;
  rate_formula: string;
  applies_to: string;
  notes: string;
  include_in_proposal: YesNoNotAssessed;
}

export interface CustomerResponsibilityRow {
  id: string;
  responsibility: string;
  applies_to: string;
  source_evidence: string;
  commercial_impact: string;
  include_in_proposal: YesNoNotAssessed;
}

export interface ExclusionRow {
  id: string;
  exclusion: string;
  reason: string;
  commercial_impact: string;
  include_in_proposal: YesNoNotAssessed;
  notes: string;
}

export interface CommercialAssumptionRow {
  id: string;
  assumption: string;
  category: AssumptionCategory;
  impact: string;
  owner: string;
  source: string;
  status: CommercialAssumptionStatus;
  include_in_proposal: YesNoNotAssessed;
}

export type PricingApprovalStatus =
  | "Not Submitted"
  | "Pending Finance Review"
  | "Finance Approved"
  | "Commercial Approved"
  | "Operations Approved"
  | "Management Approved"
  | "Rejected"
  | "Revision Required"
  | "Not Captured";

export type ApprovalRole =
  | "Regional Sales Head"
  | "Regional Ops Head"
  | "Finance"
  | "Commercial Director"
  | "Operations Director"
  | "Legal"
  | "CEO / CFO"
  | "Other";

export type ApprovalChainStatus =
  | "Not Started"
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Revision Required"
  | "Not Required";

export type ApprovalCheckStatus = "Yes" | "No" | "Partial" | "Not Assessed";

export type ApprovalConditionStatus =
  | "Open"
  | "In Progress"
  | "Done"
  | "Blocked"
  | "Waived";

export interface PricingApprovalData {
  summary: {
    approval_status: PricingApprovalStatus;
    approval_level_required: string;
    current_approver: string;
    submitted_date: string;
    approved_date: string;
    rejection_revision_reason: string;
  };
  approval_chain: ApprovalChainRow[];
  approval_checks: ApprovalCheckRow[];
  conditions: ApprovalConditionRow[];
}

export interface ApprovalChainRow {
  id: string;
  approval_role: ApprovalRole;
  approver: string;
  required: YesNoNotAssessed;
  status: ApprovalChainStatus;
  date: string;
  notes: string;
}

export interface ApprovalCheckRow {
  id: string;
  check: string;
  status: ApprovalCheckStatus;
  evidence_notes: string;
  owner: string;
}

export interface ApprovalConditionRow {
  id: string;
  condition: string;
  owner: string;
  due_date: string;
  status: ApprovalConditionStatus;
  notes: string;
}

export interface TenderPricingData {
  pnl_snapshot: PnlSnapshotData;
  cost_inputs: CostInputsData;
  scenarios: PricingScenariosData;
  commercial_terms: CommercialTermsData;
  approval: PricingApprovalData;
}

export const PNL_SNAPSHOT_STATUS_OPTIONS: PnlSnapshotStatus[] = [
  "No Snapshot",
  "Draft Snapshot",
  "Submitted for Review",
  "Finance Approved",
  "Commercial Approved",
  "Management Approved",
  "Rejected",
  "Revision Required",
  "Not Captured",
];

export const CALCULATOR_SOURCE_OPTIONS: CalculatorSource[] = ["Existing /pnl calculator", "Not linked"];
export const COST_INPUT_SOURCE_OPTIONS: CostInputSource[] = ["Existing P&L Calculator", "Manual Tender Estimate", "Imported Pricing Sheet", "Not Captured"];
export const SCENARIO_TYPE_OPTIONS: ScenarioType[] = ["Base Case", "Dedicated Model", "Shared Model", "Per Trip Model", "Monthly Retainer", "Aggressive Pricing", "Target Margin Pricing", "Alternative Option", "Other"];
export const YES_NO_NOT_ASSESSED_OPTIONS: YesNoNotAssessed[] = ["Yes", "No", "Not Assessed"];
export const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = ["30 days", "45 days", "60 days", "Advance", "Milestone", "Other", "Not Captured"];
export const VAT_TREATMENT_OPTIONS: VatTreatment[] = ["VAT Exclusive", "VAT Inclusive", "Not Applicable", "Not Captured"];
export const INSURANCE_TREATMENT_OPTIONS: InsuranceTreatment[] = ["Included", "Optional", "Excluded", "Customer Responsibility", "Not Captured"];
export const CHARGE_TYPE_OPTIONS: ChargeType[] = ["Fuel Surcharge", "Overtime", "Cancellation Charge", "Detention", "Demurrage", "Overweight Penalty", "Permit Cost", "Additional Handling", "Insurance", "Other"];
export const RESPONSIBILITY_LABEL_OPTIONS = ["loading", "offloading", "permits", "packing", "labelling", "site access", "ASN", "forecast", "productivity schedules"];
export const ASSUMPTION_CATEGORY_OPTIONS: AssumptionCategory[] = ["Operational", "Commercial", "Technical", "Customer Dependency", "Legal / Contractual", "HSE / Compliance", "Pricing", "Submission", "Other"];
export const COMMERCIAL_ASSUMPTION_STATUS_OPTIONS: CommercialAssumptionStatus[] = ["Draft", "Confirmed", "Needs Clarification", "Accepted", "Removed"];
export const PRICING_APPROVAL_STATUS_OPTIONS: PricingApprovalStatus[] = ["Not Submitted", "Pending Finance Review", "Finance Approved", "Commercial Approved", "Operations Approved", "Management Approved", "Rejected", "Revision Required", "Not Captured"];
export const APPROVAL_ROLE_OPTIONS: ApprovalRole[] = ["Regional Sales Head", "Regional Ops Head", "Finance", "Commercial Director", "Operations Director", "Legal", "CEO / CFO", "Other"];
export const APPROVAL_CHAIN_STATUS_OPTIONS: ApprovalChainStatus[] = ["Not Started", "Pending", "Approved", "Rejected", "Revision Required", "Not Required"];
export const APPROVAL_CHECK_STATUS_OPTIONS: ApprovalCheckStatus[] = ["Yes", "No", "Partial", "Not Assessed"];
export const APPROVAL_CONDITION_STATUS_OPTIONS: ApprovalConditionStatus[] = ["Open", "In Progress", "Done", "Blocked", "Waived"];

export const COST_INPUT_GROUPS = {
  warehouse_operations: [
    ["storage_cost", "Storage cost"],
    ["handling_cost", "Handling cost"],
    ["vas_cost", "VAS cost"],
    ["equipment_mhe_cost", "Equipment / MHE cost"],
    ["overtime_cost", "Overtime cost"],
    ["facility_space_cost", "Facility / space cost"],
  ],
  transport: [
    ["vehicle_cost", "Vehicle cost"],
    ["trip_cost", "Trip cost"],
    ["monthly_dedicated_fleet_cost", "Monthly dedicated fleet cost"],
    ["fuel", "Fuel"],
    ["driver", "Driver"],
    ["maintenance", "Maintenance"],
    ["insurance", "Insurance"],
    ["gps", "GPS"],
    ["permits", "Permits"],
    ["detention_demurrage_exposure", "Detention / demurrage exposure"],
  ],
  manpower: [
    ["supervisors", "Supervisors"],
    ["coordinators", "Coordinators"],
    ["warehouse_operators", "Warehouse operators"],
    ["drivers", "Drivers"],
    ["control_tower_customer_service", "Control tower / customer service"],
    ["overtime", "Overtime"],
  ],
  systems_hip: [
    ["wms_tms", "WMS / TMS"],
    ["reporting", "Reporting"],
    ["integration", "Integration"],
    ["dashboard", "Dashboard"],
    ["epod_gps", "ePOD / GPS"],
  ],
  risk_contingency: [
    ["fuel_escalation", "Fuel escalation"],
    ["penalties_ld_exposure", "Penalties / LD exposure"],
    ["capacity_buffer", "Capacity buffer"],
    ["mobilization", "Mobilization"],
    ["insurance", "Insurance"],
  ],
} as const;

export const APPROVAL_CHECK_LABELS = [
  "GP target met?",
  "Cost inputs complete?",
  "VAT treatment confirmed?",
  "Commercial terms confirmed?",
  "LD / penalty exposure reviewed?",
  "Fuel escalation covered?",
  "Insurance treatment confirmed?",
  "Customer responsibilities captured?",
  "Pricing scenario selected?",
  "Approval chain confirmed?",
];

export function makePricingRowId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function pickOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? value as T : fallback;
}

function normalizeRecord(raw: unknown, keys: readonly (readonly [string, string])[]): Record<string, string> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return Object.fromEntries(keys.map(([key]) => [key, asString(source[key])]));
}

function normalizeArray<T>(raw: unknown, normalizer: (row: any) => T): T[] {
  return Array.isArray(raw) ? raw.map(normalizer) : [];
}

function emptyPnlSnapshot(): PnlSnapshotData {
  return {
    linked_pnl_record_id: "",
    snapshot_status: "No Snapshot",
    last_snapshot_date: "",
    last_updated_by: "",
    calculator_source: "Not linked",
    monthly_revenue: "",
    annual_revenue: "",
    monthly_opex: "",
    annual_opex: "",
    gross_profit_sar: "",
    gp_percent: "",
    target_gp_percent: "",
    variance_to_target_gp: "",
    approval_chain_required: "",
    notes: "",
  };
}

function emptyCostInputs(): CostInputsData {
  return {
    source: {
      cost_input_source: "Not Captured",
      source_reference: "",
      owner: "",
      last_updated: "",
      notes: "",
    },
    warehouse_operations: normalizeRecord({}, COST_INPUT_GROUPS.warehouse_operations),
    transport: normalizeRecord({}, COST_INPUT_GROUPS.transport),
    manpower: normalizeRecord({}, COST_INPUT_GROUPS.manpower),
    systems_hip: normalizeRecord({}, COST_INPUT_GROUPS.systems_hip),
    risk_contingency: normalizeRecord({}, COST_INPUT_GROUPS.risk_contingency),
    notes: {
      cost_assumptions: "",
      source_notes: "",
      pricing_dependencies: "",
      finance_comments: "",
    },
  };
}

export function emptyPricingScenario(): PricingScenarioRow {
  return {
    id: makePricingRowId("scenario"),
    scenario_name: "",
    scenario_type: "Base Case",
    linked_pnl_snapshot_reference: "",
    revenue: "",
    cost: "",
    gp_percent: "",
    target_gp_percent: "",
    variance: "",
    operational_assumption: "",
    commercial_risk: "",
    recommended: "Not Assessed",
    notes: "",
  };
}

function emptySelectedScenario(): SelectedPricingScenario {
  return {
    selected_scenario_id: "",
    selected_scenario_name: "",
    reason_for_selection: "",
    approval_required: "Not Assessed",
  };
}

export function calculatePricingScenarioSummary(data: Pick<PricingScenariosData, "rows" | "selected_scenario">): PricingScenarioSummary {
  const gpValues = data.rows
    .map(row => Number(row.gp_percent))
    .filter(value => Number.isFinite(value));
  const belowTarget = data.rows.filter(row => {
    const gp = Number(row.gp_percent);
    const target = Number(row.target_gp_percent);
    return Number.isFinite(gp) && Number.isFinite(target) && gp < target;
  }).length;

  return {
    number_of_scenarios: data.rows.length,
    highest_gp_percent: gpValues.length ? String(Math.max(...gpValues)) : "",
    lowest_gp_percent: gpValues.length ? String(Math.min(...gpValues)) : "",
    selected_scenario: data.selected_scenario.selected_scenario_name,
    scenarios_below_target_gp: belowTarget,
  };
}

function emptyScenarios(): PricingScenariosData {
  const selected = emptySelectedScenario();
  return {
    rows: [],
    selected_scenario: selected,
    summary: calculatePricingScenarioSummary({ rows: [], selected_scenario: selected }),
  };
}

export function emptySurcharge(): SurchargeRow {
  return {
    id: makePricingRowId("surcharge"),
    charge_type: "Fuel Surcharge",
    trigger: "",
    rate_formula: "",
    applies_to: "",
    notes: "",
    include_in_proposal: "Not Assessed",
  };
}

export function emptyCustomerResponsibility(): CustomerResponsibilityRow {
  return {
    id: makePricingRowId("responsibility"),
    responsibility: "",
    applies_to: "",
    source_evidence: "",
    commercial_impact: "",
    include_in_proposal: "Not Assessed",
  };
}

export function emptyExclusion(): ExclusionRow {
  return {
    id: makePricingRowId("exclusion"),
    exclusion: "",
    reason: "",
    commercial_impact: "",
    include_in_proposal: "Not Assessed",
    notes: "",
  };
}

export function emptyCommercialAssumption(): CommercialAssumptionRow {
  return {
    id: makePricingRowId("assumption"),
    assumption: "",
    category: "Operational",
    impact: "",
    owner: "",
    source: "",
    status: "Draft",
    include_in_proposal: "Not Assessed",
  };
}

function emptyCommercialTerms(): CommercialTermsData {
  return {
    payment_tax_validity: {
      payment_terms: "Not Captured",
      vat_treatment: "Not Captured",
      vat_percent: "",
      proposal_validity: "",
      contract_term: "",
      extension_option: "",
    },
    mobilization_notice_forecast: {
      mobilization_period: "",
      movement_notice_period: "",
      forecast_notice_period: "",
      asn_requirement: "",
      customer_forecast_responsibility: "",
      notes: "",
    },
    insurance_liability: {
      insurance_treatment: "Not Captured",
      coverage_limit: "",
      liability_notes: "",
      force_majeure_treatment: "",
      damage_responsibility_notes: "",
    },
    surcharges: [],
    customer_responsibilities: [],
    exclusions: [],
    assumptions: [],
  };
}

export function emptyApprovalChainRow(): ApprovalChainRow {
  return {
    id: makePricingRowId("approval"),
    approval_role: "Finance",
    approver: "",
    required: "Not Assessed",
    status: "Not Started",
    date: "",
    notes: "",
  };
}

export function emptyApprovalCheckRow(check = ""): ApprovalCheckRow {
  return {
    id: check ? `check-${check.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : makePricingRowId("check"),
    check,
    status: "Not Assessed",
    evidence_notes: "",
    owner: "",
  };
}

export function emptyApprovalConditionRow(): ApprovalConditionRow {
  return {
    id: makePricingRowId("condition"),
    condition: "",
    owner: "",
    due_date: "",
    status: "Open",
    notes: "",
  };
}

function emptyApproval(): PricingApprovalData {
  return {
    summary: {
      approval_status: "Not Submitted",
      approval_level_required: "",
      current_approver: "",
      submitted_date: "",
      approved_date: "",
      rejection_revision_reason: "",
    },
    approval_chain: [],
    approval_checks: APPROVAL_CHECK_LABELS.map(emptyApprovalCheckRow),
    conditions: [],
  };
}

export function emptyTenderPricingData(): TenderPricingData {
  return {
    pnl_snapshot: emptyPnlSnapshot(),
    cost_inputs: emptyCostInputs(),
    scenarios: emptyScenarios(),
    commercial_terms: emptyCommercialTerms(),
    approval: emptyApproval(),
  };
}

function normalizePnlSnapshot(raw: any): PnlSnapshotData {
  const base = emptyPnlSnapshot();
  const snapshots = Array.isArray(raw?.snapshots)
    ? raw.snapshots.filter((row: unknown) => row && typeof row === "object")
    : [];
  const activeSnapshot = snapshots.find((row: any) => row.id && row.id === raw?.active_snapshot_id)
    ?? snapshots[snapshots.length - 1];
  const summary = activeSnapshot?.summary && typeof activeSnapshot.summary === "object"
    ? activeSnapshot.summary
    : null;
  const activeStatus: PnlSnapshotStatus | undefined = activeSnapshot
    ? activeSnapshot.status === "Snapshot Created"
      ? "Draft Snapshot"
      : activeSnapshot.status === "Submitted for Pricing Approval"
        ? "Submitted for Review"
        : PNL_SNAPSHOT_STATUS_OPTIONS.includes(activeSnapshot.status)
          ? activeSnapshot.status
          : "Not Captured"
    : undefined;

  return {
    ...base,
    ...raw,
    linked_pnl_record_id: asString(raw?.linked_pnl_record_id) || asString(activeSnapshot?.id),
    snapshot_status: activeStatus
      ?? pickOption(raw?.snapshot_status, PNL_SNAPSHOT_STATUS_OPTIONS, base.snapshot_status),
    last_snapshot_date: asString(activeSnapshot?.created_at) || asString(raw?.last_snapshot_date),
    last_updated_by: asString(activeSnapshot?.updated_by || activeSnapshot?.created_by) || asString(raw?.last_updated_by),
    calculator_source: activeSnapshot
      ? "Existing /pnl calculator"
      : pickOption(raw?.calculator_source, CALCULATOR_SOURCE_OPTIONS, base.calculator_source),
    monthly_revenue: summary ? asString(summary.monthly_revenue) : asString(raw?.monthly_revenue),
    annual_revenue: summary ? asString(summary.annual_revenue) : asString(raw?.annual_revenue),
    monthly_opex: summary ? asString(summary.monthly_opex) : asString(raw?.monthly_opex),
    annual_opex: summary ? asString(summary.annual_opex) : asString(raw?.annual_opex),
    gross_profit_sar: summary ? asString(summary.gross_profit) : asString(raw?.gross_profit_sar),
    gp_percent: summary ? asString(summary.gp_percent) : asString(raw?.gp_percent),
    target_gp_percent: summary ? asString(summary.target_gp_percent) : asString(raw?.target_gp_percent),
    variance_to_target_gp: summary ? asString(summary.variance_to_target) : asString(raw?.variance_to_target_gp),
    approval_chain_required: summary ? asString(summary.approval_chain_required) : asString(raw?.approval_chain_required),
    notes: asString(activeSnapshot?.notes) || asString(raw?.notes),
  };
}

function normalizeCostInputs(raw: any): CostInputsData {
  const base = emptyCostInputs();
  return {
    source: {
      ...base.source,
      ...(raw?.source && typeof raw.source === "object" ? raw.source : {}),
      cost_input_source: pickOption(raw?.source?.cost_input_source, COST_INPUT_SOURCE_OPTIONS, "Not Captured"),
    },
    warehouse_operations: normalizeRecord(raw?.warehouse_operations, COST_INPUT_GROUPS.warehouse_operations),
    transport: normalizeRecord(raw?.transport, COST_INPUT_GROUPS.transport),
    manpower: normalizeRecord(raw?.manpower, COST_INPUT_GROUPS.manpower),
    systems_hip: normalizeRecord(raw?.systems_hip, COST_INPUT_GROUPS.systems_hip),
    risk_contingency: normalizeRecord(raw?.risk_contingency, COST_INPUT_GROUPS.risk_contingency),
    notes: {
      ...base.notes,
      ...(raw?.notes && typeof raw.notes === "object" ? raw.notes : {}),
    },
  };
}

function normalizeScenarioRow(raw: any): PricingScenarioRow {
  const base = emptyPricingScenario();
  return {
    ...base,
    ...raw,
    id: asString(raw?.id) || base.id,
    scenario_type: pickOption(raw?.scenario_type, SCENARIO_TYPE_OPTIONS, "Base Case"),
    recommended: pickOption(raw?.recommended, YES_NO_NOT_ASSESSED_OPTIONS, "Not Assessed"),
  };
}

function normalizeScenarios(raw: any): PricingScenariosData {
  const rows = normalizeArray(raw?.rows, normalizeScenarioRow);
  const selectedBase = emptySelectedScenario();
  const selected: SelectedPricingScenario = {
    ...selectedBase,
    ...(raw?.selected_scenario && typeof raw.selected_scenario === "object" ? raw.selected_scenario : {}),
    approval_required: pickOption(raw?.selected_scenario?.approval_required, YES_NO_NOT_ASSESSED_OPTIONS, selectedBase.approval_required),
  };
  return {
    rows,
    selected_scenario: selected,
    summary: calculatePricingScenarioSummary({ rows, selected_scenario: selected }),
  };
}

function normalizeCommercialTerms(raw: any): CommercialTermsData {
  const base = emptyCommercialTerms();
  return {
    payment_tax_validity: {
      ...base.payment_tax_validity,
      ...(raw?.payment_tax_validity && typeof raw.payment_tax_validity === "object" ? raw.payment_tax_validity : {}),
      payment_terms: pickOption(raw?.payment_tax_validity?.payment_terms, PAYMENT_TERMS_OPTIONS, "Not Captured"),
      vat_treatment: pickOption(raw?.payment_tax_validity?.vat_treatment, VAT_TREATMENT_OPTIONS, "Not Captured"),
    },
    mobilization_notice_forecast: {
      ...base.mobilization_notice_forecast,
      ...(raw?.mobilization_notice_forecast && typeof raw.mobilization_notice_forecast === "object" ? raw.mobilization_notice_forecast : {}),
    },
    insurance_liability: {
      ...base.insurance_liability,
      ...(raw?.insurance_liability && typeof raw.insurance_liability === "object" ? raw.insurance_liability : {}),
      insurance_treatment: pickOption(raw?.insurance_liability?.insurance_treatment, INSURANCE_TREATMENT_OPTIONS, "Not Captured"),
    },
    surcharges: normalizeArray(raw?.surcharges, row => ({
      ...emptySurcharge(),
      ...row,
      id: asString(row?.id) || makePricingRowId("surcharge"),
      charge_type: pickOption(row?.charge_type, CHARGE_TYPE_OPTIONS, "Fuel Surcharge"),
      include_in_proposal: pickOption(row?.include_in_proposal, YES_NO_NOT_ASSESSED_OPTIONS, "Not Assessed"),
    })),
    customer_responsibilities: normalizeArray(raw?.customer_responsibilities, row => ({
      ...emptyCustomerResponsibility(),
      ...row,
      id: asString(row?.id) || makePricingRowId("responsibility"),
      include_in_proposal: pickOption(row?.include_in_proposal, YES_NO_NOT_ASSESSED_OPTIONS, "Not Assessed"),
    })),
    exclusions: normalizeArray(raw?.exclusions, row => ({
      ...emptyExclusion(),
      ...row,
      id: asString(row?.id) || makePricingRowId("exclusion"),
      include_in_proposal: pickOption(row?.include_in_proposal, YES_NO_NOT_ASSESSED_OPTIONS, "Not Assessed"),
    })),
    assumptions: normalizeArray(raw?.assumptions, row => ({
      ...emptyCommercialAssumption(),
      ...row,
      id: asString(row?.id) || makePricingRowId("assumption"),
      category: pickOption(row?.category, ASSUMPTION_CATEGORY_OPTIONS, "Operational"),
      status: pickOption(row?.status, COMMERCIAL_ASSUMPTION_STATUS_OPTIONS, "Draft"),
      include_in_proposal: pickOption(row?.include_in_proposal, YES_NO_NOT_ASSESSED_OPTIONS, "Not Assessed"),
    })),
  };
}

function normalizeApproval(raw: any): PricingApprovalData {
  const base = emptyApproval();
  const chain = normalizeArray(raw?.approval_chain, row => ({
    ...emptyApprovalChainRow(),
    ...row,
    id: asString(row?.id) || makePricingRowId("approval"),
    approval_role: pickOption(row?.approval_role, APPROVAL_ROLE_OPTIONS, "Finance"),
    required: pickOption(row?.required, YES_NO_NOT_ASSESSED_OPTIONS, "Not Assessed"),
    status: pickOption(row?.status, APPROVAL_CHAIN_STATUS_OPTIONS, "Not Started"),
  }));
  const savedChecks = normalizeArray(raw?.approval_checks, row => ({
    ...emptyApprovalCheckRow(),
    ...row,
    id: asString(row?.id) || makePricingRowId("check"),
    status: pickOption(row?.status, APPROVAL_CHECK_STATUS_OPTIONS, "Not Assessed"),
  }));
  const checks = savedChecks.length > 0 ? savedChecks : base.approval_checks;
  return {
    summary: {
      ...base.summary,
      ...(raw?.summary && typeof raw.summary === "object" ? raw.summary : {}),
      approval_status: pickOption(raw?.summary?.approval_status, PRICING_APPROVAL_STATUS_OPTIONS, "Not Submitted"),
    },
    approval_chain: chain,
    approval_checks: checks,
    conditions: normalizeArray(raw?.conditions, row => ({
      ...emptyApprovalConditionRow(),
      ...row,
      id: asString(row?.id) || makePricingRowId("condition"),
      status: pickOption(row?.status, APPROVAL_CONDITION_STATUS_OPTIONS, "Open"),
    })),
  };
}

export function normalizeTenderPricingData(raw: unknown): TenderPricingData {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, any> : {};
  return {
    pnl_snapshot: normalizePnlSnapshot(source.pnl_snapshot),
    cost_inputs: normalizeCostInputs(source.cost_inputs),
    scenarios: normalizeScenarios(source.scenarios),
    commercial_terms: normalizeCommercialTerms(source.commercial_terms),
    approval: normalizeApproval(source.approval),
  };
}

export function summarizePricingSection(section: TenderPricingSectionKey, value: any): string {
  if (section === "pnl_snapshot") {
    const snapshot = normalizePnlSnapshot(value);
    return snapshot.linked_pnl_record_id || snapshot.snapshot_status;
  }
  if (section === "cost_inputs") {
    const costInputs = normalizeCostInputs(value);
    return costInputs.source.cost_input_source;
  }
  if (section === "scenarios") {
    const scenarios = normalizeScenarios(value);
    return `${scenarios.rows.length} scenario${scenarios.rows.length === 1 ? "" : "s"}`;
  }
  if (section === "commercial_terms") {
    const terms = normalizeCommercialTerms(value);
    return terms.payment_tax_validity.payment_terms;
  }
  if (section === "approval") {
    const approval = normalizeApproval(value);
    return approval.summary.approval_status;
  }
  return "";
}

export function hasPricingData(raw: unknown): boolean {
  const pricing = normalizeTenderPricingData(raw);
  return Boolean(
    pricing.pnl_snapshot.linked_pnl_record_id ||
    pricing.pnl_snapshot.snapshot_status !== "No Snapshot" ||
    pricing.cost_inputs.source.cost_input_source !== "Not Captured" ||
    pricing.scenarios.rows.length ||
    pricing.commercial_terms.surcharges.length ||
    pricing.commercial_terms.customer_responsibilities.length ||
    pricing.commercial_terms.exclusions.length ||
    pricing.commercial_terms.assumptions.length ||
    pricing.approval.approval_chain.length ||
    pricing.approval.conditions.length ||
    pricing.approval.summary.approval_status !== "Not Submitted"
  );
}
