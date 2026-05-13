import { supabase } from "./supabase";

export const COMMERCIAL_OS_DEFAULT_BATCH_ID = "data002b-20260511";

export interface CommercialOpportunity {
  id: string;
  customerName: string;
  opportunityName: string;
  owner: string;
  stage: string;
  probabilityPct: number;
  warehouseRaw: string;
  warehouseLocation: string;
  goLiveDate: string;
  acvAnnual: number;
  expectedRevenueCy: number;
  volumePallets: number;
  volumeSqm: number;
  region: string;
  notes: string;
  weightedTotal: number;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
  flags: CommercialOpportunityFlag[];
  gpBasis: string;
  gpMarginPct: number;
  gpConfidenceStatus: string;
}

export interface CommercialOpportunityFlag {
  id: string;
  opportunityId: string;
  flagType: string;
  flagMessage: string;
  severity: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export interface WarehouseLocation {
  id: string;
  warehouseName: string;
  warehouseLabel: string;
  region: string;
}

export interface WarehouseCapacitySnapshot {
  id: string;
  warehouseLocationId: string;
  warehouseName: string;
  warehouseLabel: string;
  region: string;
  snapshotDate: string;
  totalCapacity: number;
  occupiedCapacity: number;
  utilizationPct: number;
  sellableCapacity: number;
  committedCapacity: number;
  shortfallCapacity: number;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export interface ForecastMonthlyRow {
  id: string;
  category: string;
  lineItem: string;
  probabilityPct: number | null;
  month: string;
  amount: number;
  budgetAmount: number;
  deltaAmount: number;
  metricType: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export interface RevenueActualRow {
  id: string;
  glCode: string;
  customerName: string;
  month: string;
  amount: number;
  ytdAmount: number;
  periodYear: number | null;
  revenueType: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export interface DashboardMetric {
  id: string;
  metricKey: string;
  metricLabel: string;
  metricValue: number;
  formulaComparison: FormulaComparison | null;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export type FormulaParityStatus = "Match" | "Warning" | "Drift" | "Unavailable";

export type FormulaSourceType =
  | "formula_native"
  | "excel_snapshot"
  | "d365"
  | "lfs"
  | "finance_budget"
  | "manual_hanno"
  | "assumption"
  | "dangerous_default";

export interface FormulaComparison {
  imported_value: number | null;
  calculated_value: number | null;
  variance: number | null;
  variance_pct: number | null;
  parity_status: FormulaParityStatus;
  source_type: FormulaSourceType | "";
  source_detail: string;
  governance_owner: string;
  risk_level: string;
}

export interface LeadershipAction {
  id: string;
  actionCode: string;
  actionTitle: string;
  impact: string;
  owner: string;
  status: string;
  severity: string;
  sourceArea: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export interface CommercialOsData {
  opportunities: CommercialOpportunity[];
  capacitySnapshots: WarehouseCapacitySnapshot[];
  forecasts: ForecastMonthlyRow[];
  revenueActuals: RevenueActualRow[];
  dashboardMetrics: DashboardMetric[];
  leadershipActions: LeadershipAction[];
  closedWonDeals: any[];
  monthlyPhasing: any[];
  warehouseChambers: any[];
  kpiRegistry: KpiRegistryEntry[];
  sourceRegistry: SourceRegistryEntry[];
  defaultAssumptions: DefaultAssumption[];
  stageProbabilities: StageProbability[];
  dashboardThresholds: DashboardThreshold[];
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
  }
  return "";
}

function sourceRow(row: any): number | null {
  return nullableNum(row.source_row ?? row.excel_row_number ?? row.row_number);
}

function objectValue(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T | ""): T | "" {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function formulaComparison(row: any): FormulaComparison | null {
  const metadata = objectValue(row.metadata);
  const candidate = objectValue(metadata.formula_result ?? metadata.formulaComparison ?? metadata.formula_comparison);
  const source = { ...metadata, ...candidate, ...row };
  const hasClaudeFields = [
    "imported_value",
    "calculated_value",
    "variance",
    "variance_pct",
    "parity_status",
    "source_type",
    "source_detail",
    "governance_owner",
    "risk_level",
  ].some((field) => source[field] !== undefined && source[field] !== null && source[field] !== "");

  if (!hasClaudeFields) return null;

  const parityStatuses = ["Match", "Warning", "Drift", "Unavailable"] as const;
  const sourceTypes = [
    "formula_native",
    "excel_snapshot",
    "d365",
    "lfs",
    "finance_budget",
    "manual_hanno",
    "assumption",
    "dangerous_default",
  ] as const;

  return {
    imported_value: nullableNum(source.imported_value),
    calculated_value: nullableNum(source.calculated_value),
    variance: nullableNum(source.variance),
    variance_pct: nullableNum(source.variance_pct),
    parity_status: oneOf(source.parity_status, parityStatuses, "Unavailable"),
    source_type: oneOf(source.source_type, sourceTypes, ""),
    source_detail: text(source.source_detail),
    governance_owner: text(source.governance_owner),
    risk_level: text(source.risk_level),
  };
}

async function readBatchTable<T = any>(table: string, batchId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("import_batch_id", batchId);

  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

async function readAllTable<T = any>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

function mapFlag(row: any): CommercialOpportunityFlag {
  return {
    id: text(row.id, `${row.opportunity_id}-${row.flag_type}-${row.source_row}`),
    opportunityId: text(row.opportunity_id, row.commercial_opportunity_id),
    flagType: text(row.flag_type, row.type, "Flag"),
    flagMessage: text(row.flag_message, row.message, row.notes),
    severity: text(row.severity, "warning").toLowerCase(),
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
  };
}

function mapOpportunity(row: any, flags: CommercialOpportunityFlag[]): CommercialOpportunity {
  const probabilityPct = num(row.probability_pct ?? row.probability_percent);
  const acvAnnual = num(row.acv_annual ?? row.annual_contract_value);
  const weightedTotal = num(row.weighted_total ?? row.weighted_pipeline ?? acvAnnual * (probabilityPct / 100));

  return {
    id: text(row.id, row.opportunity_id, `${row.customer_name}-${row.opportunity_name}`),
    customerName: text(row.customer_name, row.account_customer, row.account_name),
    opportunityName: text(row.opportunity_name, row.customer_opportunity, row.title),
    owner: text(row.owner, row.opportunity_owner),
    stage: text(row.stage),
    probabilityPct,
    warehouseRaw: text(row.warehouse_raw),
    warehouseLocation: text(row.warehouse_location, row.warehouse_label, row.warehouse_raw),
    goLiveDate: text(row.go_live_date, row.ops_go_live_date),
    acvAnnual,
    expectedRevenueCy: num(row.expected_revenue_cy ?? row.source_exp_cy),
    volumePallets: num(row.volume_pallets ?? row.pallets),
    volumeSqm: num(row.volume_sqm ?? row.sqm),
    region: text(row.region),
    notes: text(row.notes),
    weightedTotal,
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
    flags,
    gpBasis: text(row.gp_basis) || 'assumed_75pct',
    gpMarginPct: num(row.gp_margin_pct) || 25,
    gpConfidenceStatus: text(row.gp_confidence_status) || 'needs_finance_review',
  };
}

// ─── GP-001: GP Visibility Helpers ───────────────────────────

export interface GpSummary {
  projectedGpTotal: number;
  projectedGpVerified: number;
  projectedGpAssumed: number;
  assumedGpPctOfTotal: number;
  verifiedGpPctOfTotal: number;
  dealsNeedingReview: number;
  dealsVerified: number;
  dealsAssumed: number;
  dealsNoRevenue: number;
  highValueAssumedDeals: { customerName: string; weightedTotal: number; assumedGp: number }[];
}

export function computeGpSummary(opportunities: CommercialOpportunity[]): GpSummary {
  let projectedGpVerified = 0;
  let projectedGpAssumed = 0;
  let dealsNeedingReview = 0;
  let dealsVerified = 0;
  let dealsAssumed = 0;
  let dealsNoRevenue = 0;
  const highValueAssumedDeals: GpSummary['highValueAssumedDeals'] = [];

  for (const opp of opportunities) {
    const gpAmount = opp.weightedTotal * (opp.gpMarginPct / 100);

    if (opp.gpBasis === 'actual_cost') {
      projectedGpVerified += gpAmount;
      dealsVerified++;
    } else if (opp.gpBasis === 'no_revenue') {
      dealsNoRevenue++;
    } else {
      // assumed_75pct or unknown
      projectedGpAssumed += gpAmount;
      dealsAssumed++;
    }

    if (opp.gpConfidenceStatus === 'needs_finance_review') {
      dealsNeedingReview++;
    }

    // Flag high-value assumed deals (GP > 500K SAR)
    if (opp.gpBasis !== 'actual_cost' && opp.gpBasis !== 'no_revenue' && gpAmount > 500000) {
      highValueAssumedDeals.push({
        customerName: opp.customerName,
        weightedTotal: opp.weightedTotal,
        assumedGp: gpAmount,
      });
    }
  }

  const projectedGpTotal = projectedGpVerified + projectedGpAssumed;
  return {
    projectedGpTotal,
    projectedGpVerified,
    projectedGpAssumed,
    assumedGpPctOfTotal: projectedGpTotal > 0 ? Math.round((projectedGpAssumed / projectedGpTotal) * 1000) / 10 : 0,
    verifiedGpPctOfTotal: projectedGpTotal > 0 ? Math.round((projectedGpVerified / projectedGpTotal) * 1000) / 10 : 0,
    dealsNeedingReview,
    dealsVerified,
    dealsAssumed,
    dealsNoRevenue,
    highValueAssumedDeals: highValueAssumedDeals.sort((a, b) => b.assumedGp - a.assumedGp),
  };
}

function mapLocation(row: any): WarehouseLocation {
  return {
    id: text(row.id, row.warehouse_location_id),
    warehouseName: text(row.warehouse_name, row.name, row.warehouse_label),
    warehouseLabel: text(row.warehouse_label, row.report_label, row.warehouse_name, row.name),
    region: text(row.region),
  };
}

function mapCapacity(row: any, location?: WarehouseLocation): WarehouseCapacitySnapshot {
  return {
    id: text(row.id),
    warehouseLocationId: text(row.warehouse_location_id),
    warehouseName: text(row.warehouse_name, row.warehouse, location?.warehouseName, location?.warehouseLabel),
    warehouseLabel: text(row.warehouse_label, row.report_label, location?.warehouseLabel, location?.warehouseName),
    region: text(row.region, location?.region),
    snapshotDate: text(row.snapshot_date, row.as_of_date, row.created_at, row.imported_at),
    totalCapacity: num(row.total_capacity),
    occupiedCapacity: num(row.occupied_capacity),
    utilizationPct: num(row.utilization_pct ?? row.utilization_percent),
    sellableCapacity: num(row.sellable_capacity),
    committedCapacity: num(row.committed_capacity),
    shortfallCapacity: num(row.shortfall_capacity),
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
  };
}

function mapForecast(row: any): ForecastMonthlyRow {
  return {
    id: text(row.id, `${row.category}-${row.line_item}-${row.month}`),
    category: text(row.category),
    lineItem: text(row.line_item),
    probabilityPct: nullableNum(row.probability_pct),
    month: text(row.month, row.forecast_month),
    amount: num(row.amount),
    budgetAmount: num(row.budget_amount),
    deltaAmount: num(row.delta_amount),
    metricType: text(row.metric_type),
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
  };
}

function mapRevenue(row: any): RevenueActualRow {
  return {
    id: text(row.id, `${row.gl_code}-${row.customer_name}-${row.month}`),
    glCode: text(row.gl_code),
    customerName: text(row.customer_name, row.description),
    month: text(row.month, row.revenue_month),
    amount: num(row.amount),
    ytdAmount: num(row.ytd_amount),
    periodYear: nullableNum(row.period_year),
    revenueType: text(row.revenue_type),
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
  };
}

function mapDashboardMetric(row: any): DashboardMetric {
  const metricLabel = text(row.metric_label, row.metric_name, row.label, row.metric_key);
  return {
    id: text(row.id, row.metric_key, metricLabel),
    metricKey: text(row.metric_key, metricLabel).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    metricLabel,
    metricValue: num(row.metric_value ?? row.value ?? row.amount),
    formulaComparison: formulaComparison(row),
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
  };
}

function mapLeadershipAction(row: any): LeadershipAction {
  return {
    id: text(row.id, row.action_code),
    actionCode: text(row.action_code),
    actionTitle: text(row.action_title, row.risk_action, row.title),
    impact: text(row.impact),
    owner: text(row.owner),
    status: text(row.status),
    severity: text(row.severity),
    sourceArea: text(row.source_area),
    sourceFile: text(row.source_file),
    sourceSheet: text(row.source_sheet),
    sourceRow: sourceRow(row),
  };
}

export async function fetchCommercialOsData(batchId = COMMERCIAL_OS_DEFAULT_BATCH_ID): Promise<CommercialOsData> {
  const [
    opportunitiesRaw,
    monthlyPhasing,
    flagsRaw,
    locationsRaw,
    chambersRaw,
    capacityRaw,
    closedWonDeals,
    revenueRaw,
    forecastRaw,
    dashboardRaw,
    actionsRaw,
    kpiRegistry,
    sourceRegistry,
    defaultAssumptions,
    stageProbabilities,
    dashboardThresholds,
  ] = await Promise.all([
    readBatchTable("commercial_opportunities", batchId),
    readAllTable("commercial_opportunity_monthly_phasing"),
    readAllTable("commercial_opportunity_flags"),
    readAllTable("warehouse_locations"),
    readAllTable("warehouse_chambers"),
    readAllTable("warehouse_capacity_snapshots"),
    readBatchTable("closed_won_deals", batchId),
    readBatchTable("warehouse_revenue_actuals", batchId),
    readBatchTable("forecast_monthly", batchId),
    readBatchTable("commercial_dashboard_snapshots", batchId),
    readBatchTable("leadership_actions", batchId),
    fetchKpiRegistry(),
    fetchSourceRegistry(),
    fetchDefaultAssumptions(),
    fetchStageProbabilities(),
    fetchDashboardThresholds(),
  ]);

  const flags = flagsRaw.map(mapFlag);
  const flagsByOpportunity = new Map<string, CommercialOpportunityFlag[]>();
  for (const flag of flags) {
    if (!flagsByOpportunity.has(flag.opportunityId)) flagsByOpportunity.set(flag.opportunityId, []);
    flagsByOpportunity.get(flag.opportunityId)!.push(flag);
  }

  const locations = locationsRaw.map(mapLocation);
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  return {
    opportunities: opportunitiesRaw.map((row: any) => {
      const id = text(row.id, row.opportunity_id);
      return mapOpportunity(row, flagsByOpportunity.get(id) ?? []);
    }),
    capacitySnapshots: capacityRaw.map((row: any) => mapCapacity(row, locationsById.get(text(row.warehouse_location_id)))),
    forecasts: forecastRaw.map(mapForecast),
    revenueActuals: revenueRaw.map(mapRevenue),
    dashboardMetrics: dashboardRaw.map(mapDashboardMetric),
    leadershipActions: actionsRaw.map(mapLeadershipAction),
    closedWonDeals,
    monthlyPhasing,
    warehouseChambers: chambersRaw,
    kpiRegistry,
    sourceRegistry,
    defaultAssumptions,
    stageProbabilities,
    dashboardThresholds,
  };
}

// ─── DATA-003B: KPI + Source Registry (Read-Only) ────────────

export interface KpiRegistryEntry {
  id: string;
  kpiKey: string;
  kpiLabel: string;
  classification: string;
  sourceType: string;
  formulaDetail: string;
  externalSourceSystem: string;
  currentSource: string;
  governanceOwner: string;
  toleranceType: string;
  toleranceValue: number;
  roundingPolicy: string;
  riskLevel: string;
  active: boolean;
  notes: string;
  truthStatus: string;
  confidenceTier: number;
  sourceLineage: string;
}

export interface SourceRegistryEntry {
  id: string;
  sourceKey: string;
  sourceLabel: string;
  sourceType: string;
  systemName: string;
  futureApiCandidate: boolean;
  currentIngestionMethod: string;
  owner: string;
  refreshFrequency: string;
  trustLevel: string;
  notes: string;
  active: boolean;
}

function mapKpiRegistry(row: any): KpiRegistryEntry {
  return {
    id: text(row.id),
    kpiKey: text(row.kpi_key),
    kpiLabel: text(row.kpi_label),
    classification: text(row.classification),
    sourceType: text(row.source_type),
    formulaDetail: text(row.formula_detail),
    externalSourceSystem: text(row.external_source_system),
    currentSource: text(row.current_source),
    governanceOwner: text(row.governance_owner),
    toleranceType: text(row.tolerance_type),
    toleranceValue: num(row.tolerance_value),
    roundingPolicy: text(row.rounding_policy),
    riskLevel: text(row.risk_level),
    active: row.active ?? true,
    notes: text(row.notes),
    truthStatus: text(row.truth_status) || 'unresolved',
    confidenceTier: num(row.confidence_tier) || 5,
    sourceLineage: text(row.source_lineage),
  };
}

function mapSourceRegistry(row: any): SourceRegistryEntry {
  return {
    id: text(row.id),
    sourceKey: text(row.source_key),
    sourceLabel: text(row.source_label),
    sourceType: text(row.source_type),
    systemName: text(row.system_name),
    futureApiCandidate: row.future_api_candidate ?? false,
    currentIngestionMethod: text(row.current_ingestion_method),
    owner: text(row.owner),
    refreshFrequency: text(row.refresh_frequency),
    trustLevel: text(row.trust_level),
    notes: text(row.notes),
    active: row.active ?? true,
  };
}

export async function fetchKpiRegistry(): Promise<KpiRegistryEntry[]> {
  const { data, error } = await supabase
    .from("commercial_kpi_registry")
    .select("*")
    .eq("active", true)
    .order("kpi_key");
  if (error) {
    console.error("[commercial-os] Failed to fetch KPI registry:", error.message);
    return [];
  }
  return (data ?? []).map(mapKpiRegistry);
}

export async function fetchSourceRegistry(): Promise<SourceRegistryEntry[]> {
  const { data, error } = await supabase
    .from("commercial_source_registry")
    .select("*")
    .eq("active", true)
    .order("source_key");
  if (error) {
    console.error("[commercial-os] Failed to fetch source registry:", error.message);
    return [];
  }
  return (data ?? []).map(mapSourceRegistry);
}

// ─── ASSUMP-001: Assumption Registry (Read-Only) ─────────────

export interface DefaultAssumption {
  id: string;
  assumptionKey: string;
  assumptionLabel: string;
  category: string;
  valueNumeric: number;
  valueText: string;
  unit: string;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  governanceOwner: string;
  sourceLineage: string;
  riskLevel: string;
  notes: string;
  active: boolean;
}

export interface StageProbability {
  id: string;
  stageName: string;
  probabilityPct: number;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  governanceOwner: string;
  sourceLineage: string;
  notes: string;
  active: boolean;
}

export interface DashboardThreshold {
  id: string;
  thresholdKey: string;
  thresholdLabel: string;
  thresholdValue: number;
  unit: string;
  category: string;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  governanceOwner: string;
  notes: string;
  active: boolean;
}

function mapDefaultAssumption(row: any): DefaultAssumption {
  return {
    id: text(row.id),
    assumptionKey: text(row.assumption_key),
    assumptionLabel: text(row.assumption_label),
    category: text(row.category),
    valueNumeric: num(row.value_numeric),
    valueText: text(row.value_text),
    unit: text(row.unit),
    sourceType: text(row.source_type),
    truthStatus: text(row.truth_status) || 'assumption',
    confidenceTier: num(row.confidence_tier) || 4,
    governanceOwner: text(row.governance_owner),
    sourceLineage: text(row.source_lineage),
    riskLevel: text(row.risk_level),
    notes: text(row.notes),
    active: row.active ?? true,
  };
}

function mapStageProbability(row: any): StageProbability {
  return {
    id: text(row.id),
    stageName: text(row.stage_name),
    probabilityPct: num(row.probability_pct),
    sourceType: text(row.source_type),
    truthStatus: text(row.truth_status) || 'assumption',
    confidenceTier: num(row.confidence_tier) || 4,
    governanceOwner: text(row.governance_owner),
    sourceLineage: text(row.source_lineage),
    notes: text(row.notes),
    active: row.active ?? true,
  };
}

function mapDashboardThreshold(row: any): DashboardThreshold {
  return {
    id: text(row.id),
    thresholdKey: text(row.threshold_key),
    thresholdLabel: text(row.threshold_label),
    thresholdValue: num(row.threshold_value),
    unit: text(row.unit),
    category: text(row.category),
    sourceType: text(row.source_type),
    truthStatus: text(row.truth_status) || 'assumption',
    confidenceTier: num(row.confidence_tier) || 4,
    governanceOwner: text(row.governance_owner),
    notes: text(row.notes),
    active: row.active ?? true,
  };
}

export async function fetchDefaultAssumptions(): Promise<DefaultAssumption[]> {
  const { data, error } = await supabase
    .from("default_assumptions")
    .select("*")
    .eq("active", true)
    .order("assumption_key");
  if (error) {
    console.error("[commercial-os] Failed to fetch assumptions:", error.message);
    return [];
  }
  return (data ?? []).map(mapDefaultAssumption);
}

export async function fetchStageProbabilities(): Promise<StageProbability[]> {
  const { data, error } = await supabase
    .from("stage_probabilities")
    .select("*")
    .eq("active", true)
    .order("probability_pct", { ascending: true });
  if (error) {
    console.error("[commercial-os] Failed to fetch stage probabilities:", error.message);
    return [];
  }
  return (data ?? []).map(mapStageProbability);
}

export async function fetchDashboardThresholds(): Promise<DashboardThreshold[]> {
  const { data, error } = await supabase
    .from("dashboard_thresholds")
    .select("*")
    .eq("active", true)
    .order("threshold_key");
  if (error) {
    console.error("[commercial-os] Failed to fetch thresholds:", error.message);
    return [];
  }
  return (data ?? []).map(mapDashboardThreshold);
}
