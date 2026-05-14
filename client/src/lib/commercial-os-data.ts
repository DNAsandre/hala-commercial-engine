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

// ─── GP-002: Per-Deal GP Confidence Detail (Read-Only) ───────

export interface GpDealDetail {
  id: string;
  customerName: string;
  stage: string;
  acv: number;
  weightedTotal: number;
  gpBasis: string;
  gpMarginPct: number;
  estimatedGp: number;
  gpConfidenceStatus: string;
  financeReviewRequired: boolean;
  dangerousDefault: boolean;
  riskLabel: string;
}

export interface GpV2Summary extends GpSummary {
  dealDetails: GpDealDetail[];
  dangerousDefaultCount: number;
  dangerousDefaultValue: number;
  defaultWarningMessage: string;
}

export function computeGpV2Summary(opportunities: CommercialOpportunity[]): GpV2Summary {
  const base = computeGpSummary(opportunities);

  const dealDetails: GpDealDetail[] = opportunities.map(opp => {
    const estimatedGp = opp.weightedTotal * (opp.gpMarginPct / 100);
    const financeReviewRequired = opp.gpConfidenceStatus === 'needs_finance_review';
    const dangerousDefault = opp.gpBasis === 'assumed_75pct' && opp.weightedTotal > 0;

    let riskLabel = 'Unknown';
    if (opp.gpBasis === 'actual_cost') riskLabel = 'Verified — actual cost';
    else if (opp.gpBasis === 'no_revenue') riskLabel = 'No revenue — GP n/a';
    else if (opp.gpBasis === 'assumed_75pct' && opp.weightedTotal > 1_000_000) riskLabel = 'High-value assumed — needs Finance';
    else if (opp.gpBasis === 'assumed_75pct') riskLabel = 'Assumed 25% GP — needs Finance';
    else riskLabel = `Basis: ${opp.gpBasis}`;

    return {
      id: opp.id,
      customerName: opp.customerName,
      stage: opp.stage,
      acv: opp.acvAnnual,
      weightedTotal: opp.weightedTotal,
      gpBasis: opp.gpBasis,
      gpMarginPct: opp.gpMarginPct,
      estimatedGp: estimatedGp,
      gpConfidenceStatus: opp.gpConfidenceStatus,
      financeReviewRequired,
      dangerousDefault,
      riskLabel,
    };
  });

  const dangerousDefaultCount = dealDetails.filter(d => d.dangerousDefault).length;
  const dangerousDefaultValue = dealDetails.filter(d => d.dangerousDefault).reduce((s, d) => s + d.estimatedGp, 0);

  let defaultWarningMessage = '';
  if (dangerousDefaultCount > 0) {
    defaultWarningMessage = `${dangerousDefaultCount} deal${dangerousDefaultCount > 1 ? 's' : ''} using dangerous 25% GP default (${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(dangerousDefaultValue)} SAR). Do not treat assumed GP as verified profit.`;
  }

  return {
    ...base,
    dealDetails: dealDetails.sort((a, b) => b.estimatedGp - a.estimatedGp),
    dangerousDefaultCount,
    dangerousDefaultValue,
    defaultWarningMessage,
  };
}

// ─── CAP-002: Capacity Risk Intelligence (Read-Only) ─────────

export type CapacityRiskStatus = 'available' | 'watch' | 'high_utilization' | 'constrained' | 'overcommitted';

export interface WarehouseRisk {
  warehouseLabel: string;
  region: string;
  totalCapacity: number;
  occupiedCapacity: number;
  utilizationPct: number;
  sellableCapacity: number;
  committedCapacity: number;
  shortfallCapacity: number;
  remainingCapacity: number;
  riskStatus: CapacityRiskStatus;
  riskReason: string;
  commercialImplication: string;
}

export interface CapacityRiskSummary {
  totalWarehouses: number;
  available: number;
  watch: number;
  highUtilization: number;
  constrained: number;
  overcommitted: number;
  totalShortfall: number;
  totalSellable: number;
  totalCommitted: number;
  totalRemaining: number;
  warehouses: WarehouseRisk[];
}

export function classifyWarehouseRisk(
  snap: WarehouseCapacitySnapshot,
  highThreshold = 90,
  watchThreshold = 75,
): WarehouseRisk {
  const remaining = snap.sellableCapacity - snap.committedCapacity;

  let riskStatus: CapacityRiskStatus = 'available';
  let riskReason = 'Utilization within acceptable range. Capacity available.';
  let commercialImplication = 'Normal operations — new deals can be accommodated.';

  if (snap.committedCapacity > snap.sellableCapacity) {
    riskStatus = 'overcommitted';
    riskReason = `Committed (${snap.committedCapacity.toLocaleString()}) exceeds sellable (${snap.sellableCapacity.toLocaleString()}).`;
    commercialImplication = 'Subcontracting risk — warehouse cannot fulfill committed volumes. Operations review required.';
  } else if (snap.shortfallCapacity > 0) {
    riskStatus = 'constrained';
    riskReason = `Shortfall of ${snap.shortfallCapacity.toLocaleString()} pallets detected.`;
    commercialImplication = 'Capacity constraint — new commitments risk breaking SLA. Promise risk for pipeline deals targeting this warehouse.';
  } else if (snap.utilizationPct >= highThreshold) {
    riskStatus = 'high_utilization';
    riskReason = `Utilization at ${snap.utilizationPct.toFixed(1)}% (>= ${highThreshold}% threshold).`;
    commercialImplication = 'High utilization — limited headroom for new deals. Warehouse review required before new commitments.';
  } else if (snap.utilizationPct >= watchThreshold) {
    riskStatus = 'watch';
    riskReason = `Utilization at ${snap.utilizationPct.toFixed(1)}% (>= ${watchThreshold}% watch threshold).`;
    commercialImplication = 'Approaching capacity threshold — monitor closely. No immediate risk.';
  }

  return {
    warehouseLabel: snap.warehouseLabel,
    region: snap.region,
    totalCapacity: snap.totalCapacity,
    occupiedCapacity: snap.occupiedCapacity,
    utilizationPct: snap.utilizationPct,
    sellableCapacity: snap.sellableCapacity,
    committedCapacity: snap.committedCapacity,
    shortfallCapacity: snap.shortfallCapacity,
    remainingCapacity: remaining,
    riskStatus,
    riskReason,
    commercialImplication,
  };
}

export function computeCapacityRiskSummary(
  snapshots: WarehouseCapacitySnapshot[],
  thresholds?: DashboardThreshold[],
): CapacityRiskSummary {
  const highThreshold = thresholds?.find(t => t.thresholdKey === 'high_utilization_pct')?.thresholdValue ?? 90;
  const watchThreshold = thresholds?.find(t => t.thresholdKey === 'warning_utilization_pct')?.thresholdValue ?? 75;

  const warehouses = snapshots.map(snap => classifyWarehouseRisk(snap, highThreshold, watchThreshold));

  return {
    totalWarehouses: warehouses.length,
    available: warehouses.filter(w => w.riskStatus === 'available').length,
    watch: warehouses.filter(w => w.riskStatus === 'watch').length,
    highUtilization: warehouses.filter(w => w.riskStatus === 'high_utilization').length,
    constrained: warehouses.filter(w => w.riskStatus === 'constrained').length,
    overcommitted: warehouses.filter(w => w.riskStatus === 'overcommitted').length,
    totalShortfall: warehouses.reduce((s, w) => s + w.shortfallCapacity, 0),
    totalSellable: warehouses.reduce((s, w) => s + w.sellableCapacity, 0),
    totalCommitted: warehouses.reduce((s, w) => s + w.committedCapacity, 0),
    totalRemaining: warehouses.reduce((s, w) => s + w.remainingCapacity, 0),
    warehouses: warehouses.sort((a, b) => {
      const order: Record<CapacityRiskStatus, number> = { overcommitted: 0, constrained: 1, high_utilization: 2, watch: 3, available: 4 };
      return (order[a.riskStatus] ?? 5) - (order[b.riskStatus] ?? 5);
    }),
  };
}

// ─── CAP-003: Capacity Monetization Intelligence (Read-Only) ──

export interface WarehouseMonetization {
  warehouseLabel: string;
  region: string;
  riskStatus: CapacityRiskStatus;
  totalCapacity: number;
  sellableCapacity: number;
  committedCapacity: number;
  remainingCapacity: number;
  shortfallCapacity: number;
  utilizationPct: number;
  palletRateMonthly: number;
  monthlyPotential: number;
  annualizedPotential: number;
  monetizable: boolean;
  rateSource: string;
}

export interface CapacityMonetizationSummary {
  warehouses: WarehouseMonetization[];
  totalRemainingCapacity: number;
  totalMonthlyPotential: number;
  totalAnnualizedPotential: number;
  constrainedWarehouses: number;
  monetizableWarehouses: number;
  palletRateUsed: number;
  palletRateSource: string;
  palletRateAvailable: boolean;
}

const DEFAULT_PALLET_RATE = 48; // SAR/pallet/month — workbook assumption

export function computeCapacityMonetization(
  riskSummary: CapacityRiskSummary,
  assumptions: DefaultAssumption[],
): CapacityMonetizationSummary {
  // Resolve pallet rate from assumption registry
  const palletRateAssumption = assumptions.find(
    a => a.assumptionKey === 'pallet_rate_monthly_sar' ||
         a.assumptionKey === 'pallet_rate_sar' ||
         a.assumptionKey === 'pallet_rate' ||
         a.assumptionLabel.toLowerCase().includes('pallet rate')
  );

  const palletRateUsed = palletRateAssumption?.valueNumeric ?? DEFAULT_PALLET_RATE;
  const palletRateSource = palletRateAssumption
    ? `Assumption Registry: ${palletRateAssumption.assumptionLabel}`
    : 'Default 48 SAR/pallet/month (workbook assumption)';
  const palletRateAvailable = !!palletRateAssumption;

  const warehouses: WarehouseMonetization[] = riskSummary.warehouses.map(w => {
    const available = Math.max(0, w.remainingCapacity);
    const monetizable = available > 0;
    const monthlyPotential = monetizable ? available * palletRateUsed : 0;
    const annualizedPotential = monthlyPotential * 12;

    return {
      warehouseLabel: w.warehouseLabel,
      region: w.region,
      riskStatus: w.riskStatus,
      totalCapacity: w.totalCapacity,
      sellableCapacity: w.sellableCapacity,
      committedCapacity: w.committedCapacity,
      remainingCapacity: w.remainingCapacity,
      shortfallCapacity: w.shortfallCapacity,
      utilizationPct: w.utilizationPct,
      palletRateMonthly: palletRateUsed,
      monthlyPotential,
      annualizedPotential,
      monetizable,
      rateSource: palletRateSource,
    };
  });

  return {
    warehouses,
    totalRemainingCapacity: warehouses.reduce((s, w) => s + Math.max(0, w.remainingCapacity), 0),
    totalMonthlyPotential: warehouses.reduce((s, w) => s + w.monthlyPotential, 0),
    totalAnnualizedPotential: warehouses.reduce((s, w) => s + w.annualizedPotential, 0),
    constrainedWarehouses: warehouses.filter(w => w.riskStatus === 'constrained' || w.riskStatus === 'overcommitted').length,
    monetizableWarehouses: warehouses.filter(w => w.monetizable).length,
    palletRateUsed,
    palletRateSource,
    palletRateAvailable,
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

// ─── CUST-001: Customer Master (Read-Only) ────────────────────

export interface CustomerMasterRow {
  id: string;
  canonicalName: string;
  displayName: string;
  customerType: string;
  region: string;
  country: string;
  status: string;
  sourceConfidence: string;
  notes: string;
  active: boolean;
}

export interface CustomerAliasRow {
  id: string;
  customerId: string;
  aliasName: string;
  sourceTable: string;
  sourceField: string;
  sourceRecordId: string;
  confidenceStatus: string;
  matchReason: string;
  needsReview: boolean;
}

export interface CustomerSourceLinkRow {
  id: string;
  customerId: string;
  sourceSystem: string;
  sourceTable: string;
  sourceRecordId: string;
  sourceName: string;
  sourceType: string;
  active: boolean;
}

function mapCustomerMaster(row: any): CustomerMasterRow {
  return {
    id: text(row.id),
    canonicalName: text(row.canonical_name),
    displayName: text(row.display_name),
    customerType: text(row.customer_type) || 'warehouse',
    region: text(row.region),
    country: text(row.country) || 'Saudi Arabia',
    status: text(row.status) || 'active',
    sourceConfidence: text(row.source_confidence) || 'snapshot',
    notes: text(row.notes),
    active: row.active !== false,
  };
}

function mapCustomerAlias(row: any): CustomerAliasRow {
  return {
    id: text(row.id),
    customerId: text(row.customer_id),
    aliasName: text(row.alias_name),
    sourceTable: text(row.source_table),
    sourceField: text(row.source_field),
    sourceRecordId: text(row.source_record_id),
    confidenceStatus: text(row.confidence_status) || 'auto_matched',
    matchReason: text(row.match_reason),
    needsReview: row.needs_review === true,
  };
}

function mapCustomerSourceLink(row: any): CustomerSourceLinkRow {
  return {
    id: text(row.id),
    customerId: text(row.customer_id),
    sourceSystem: text(row.source_system),
    sourceTable: text(row.source_table),
    sourceRecordId: text(row.source_record_id),
    sourceName: text(row.source_name),
    sourceType: text(row.source_type) || 'warehouse',
    active: row.active !== false,
  };
}

export async function fetchCustomerMaster(): Promise<CustomerMasterRow[]> {
  const { data, error } = await supabase
    .from("customer_master")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) {
    console.error("[commercial-os] Failed to fetch customer master:", error.message);
    return [];
  }
  return (data ?? []).map(mapCustomerMaster);
}

export async function fetchCustomerAliases(): Promise<CustomerAliasRow[]> {
  const { data, error } = await supabase
    .from("customer_aliases")
    .select("*")
    .order("alias_name");
  if (error) {
    console.error("[commercial-os] Failed to fetch customer aliases:", error.message);
    return [];
  }
  return (data ?? []).map(mapCustomerAlias);
}

export async function fetchCustomerSourceLinks(): Promise<CustomerSourceLinkRow[]> {
  const { data, error } = await supabase
    .from("customer_source_links")
    .select("*")
    .eq("active", true)
    .order("source_table");
  if (error) {
    console.error("[commercial-os] Failed to fetch customer source links:", error.message);
    return [];
  }
  return (data ?? []).map(mapCustomerSourceLink);
}

// ─── TPT-001: Transportation Pipeline (Read-Only) ─────────────

export interface TransportationOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  opportunityName: string;
  pipelineType: string;
  owner: string;
  stage: string;
  probabilityPct: number;
  laneSummary: string;
  serviceType: string;
  origin: string;
  destination: string;
  expectedStartDate: string;
  expectedRevenue: number;
  expectedGp: number;
  volumeTrips: number;
  volumeTons: number;
  volumeUnits: number;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  sourceLineage: string;
  notes: string;
  active: boolean;
}

export interface TransportationMetric {
  id: string;
  transportationOpportunityId: string;
  metricKey: string;
  metricLabel: string;
  metricValue: number;
  metricUnit: string;
  metricPeriod: string;
  sourceType: string;
  notes: string;
}

export interface TransportationCustomerLink {
  id: string;
  transportationOpportunityId: string;
  customerId: string;
  sourceCustomerName: string;
  matchStatus: string;
  matchConfidence: string;
  notes: string;
}

function mapTransportationOpportunity(row: any): TransportationOpportunity {
  return {
    id: text(row.id),
    customerId: text(row.customer_id),
    customerName: text(row.customer_name),
    opportunityName: text(row.opportunity_name),
    pipelineType: text(row.pipeline_type) || 'transportation',
    owner: text(row.owner),
    stage: text(row.stage),
    probabilityPct: num(row.probability_pct),
    laneSummary: text(row.lane_summary),
    serviceType: text(row.service_type),
    origin: text(row.origin),
    destination: text(row.destination),
    expectedStartDate: text(row.expected_start_date),
    expectedRevenue: num(row.expected_revenue),
    expectedGp: num(row.expected_gp),
    volumeTrips: num(row.volume_trips),
    volumeTons: num(row.volume_tons),
    volumeUnits: num(row.volume_units),
    sourceType: text(row.source_type) || 'manual',
    truthStatus: text(row.truth_status) || 'unverified',
    confidenceTier: num(row.confidence_tier) || 4,
    sourceLineage: text(row.source_lineage),
    notes: text(row.notes),
    active: row.active !== false,
  };
}

function mapTransportationMetric(row: any): TransportationMetric {
  return {
    id: text(row.id),
    transportationOpportunityId: text(row.transportation_opportunity_id),
    metricKey: text(row.metric_key),
    metricLabel: text(row.metric_label),
    metricValue: num(row.metric_value),
    metricUnit: text(row.metric_unit),
    metricPeriod: text(row.metric_period),
    sourceType: text(row.source_type),
    notes: text(row.notes),
  };
}

function mapTransportationCustomerLink(row: any): TransportationCustomerLink {
  return {
    id: text(row.id),
    transportationOpportunityId: text(row.transportation_opportunity_id),
    customerId: text(row.customer_id),
    sourceCustomerName: text(row.source_customer_name),
    matchStatus: text(row.match_status) || 'pending',
    matchConfidence: text(row.match_confidence) || 'auto',
    notes: text(row.notes),
  };
}

export async function fetchTransportationOpportunities(): Promise<TransportationOpportunity[]> {
  const { data, error } = await supabase
    .from("transportation_opportunities")
    .select("*")
    .eq("active", true)
    .order("expected_revenue", { ascending: false });
  if (error) {
    console.error("[commercial-os] Failed to fetch transportation opportunities:", error.message);
    return [];
  }
  return (data ?? []).map(mapTransportationOpportunity);
}

export async function fetchTransportationMetrics(): Promise<TransportationMetric[]> {
  const { data, error } = await supabase
    .from("transportation_opportunity_metrics")
    .select("*")
    .order("metric_key");
  if (error) {
    console.error("[commercial-os] Failed to fetch transportation metrics:", error.message);
    return [];
  }
  return (data ?? []).map(mapTransportationMetric);
}

export async function fetchTransportationCustomerLinks(): Promise<TransportationCustomerLink[]> {
  const { data, error } = await supabase
    .from("transportation_customer_links")
    .select("*")
    .order("source_customer_name");
  if (error) {
    console.error("[commercial-os] Failed to fetch transportation customer links:", error.message);
    return [];
  }
  return (data ?? []).map(mapTransportationCustomerLink);
}

// ─── TND-002: Tender Customer Links (Read-Only) ───────────────

export interface TenderCustomerLink {
  id: string;
  tenderWorkspaceId: string;
  customerId: string;
  tenderCustomerName: string;
  customerMasterName: string;
  matchStatus: string;
  matchConfidence: string;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  sourceLineage: string;
  notes: string;
  active: boolean;
}

function mapTenderCustomerLink(row: any): TenderCustomerLink {
  return {
    id: text(row.id),
    tenderWorkspaceId: text(row.tender_workspace_id),
    customerId: text(row.customer_id),
    tenderCustomerName: text(row.tender_customer_name),
    customerMasterName: text(row.customer_master_name),
    matchStatus: text(row.match_status) || 'needs_review',
    matchConfidence: text(row.match_confidence) || 'auto',
    sourceType: text(row.source_type) || 'tender_workspace',
    truthStatus: text(row.truth_status) || 'snapshot',
    confidenceTier: num(row.confidence_tier) || 3,
    sourceLineage: text(row.source_lineage),
    notes: text(row.notes),
    active: row.active !== false,
  };
}

export async function fetchTenderCustomerLinks(): Promise<TenderCustomerLink[]> {
  const { data, error } = await supabase
    .from("tender_customer_links")
    .select("*")
    .eq("active", true)
    .order("tender_customer_name");
  if (error) {
    console.error("[commercial-os] Failed to fetch tender customer links:", error.message);
    return [];
  }
  return (data ?? []).map(mapTenderCustomerLink);
}

export async function getTenderLinksForCustomer(customerId: string): Promise<TenderCustomerLink[]> {
  const { data, error } = await supabase
    .from("tender_customer_links")
    .select("*")
    .eq("customer_id", customerId)
    .eq("active", true);
  if (error) {
    console.error("[commercial-os] Failed to fetch tender links for customer:", error.message);
    return [];
  }
  return (data ?? []).map(mapTenderCustomerLink);
}

export async function getCustomerLinkForTender(tenderWorkspaceId: string): Promise<TenderCustomerLink[]> {
  const { data, error } = await supabase
    .from("tender_customer_links")
    .select("*")
    .eq("tender_workspace_id", tenderWorkspaceId)
    .eq("active", true);
  if (error) {
    console.error("[commercial-os] Failed to fetch customer link for tender:", error.message);
    return [];
  }
  return (data ?? []).map(mapTenderCustomerLink);
}

// ─── FCST-001: Forecast Engine (Read-Only Formula Intelligence) ───

export interface ForecastComponents {
  // Revenue components
  baselineActuals: number;
  organicGrowth: number;
  shortlistedCy: number;
  contractNegotiationCy: number;
  closedWonCy: number;
  forecastTotal: number;
  budgetTarget: number;
  revenueGap: number;
  // GP components
  gpForecast: number;
  gpBudget: number;
  gpGap: number;
  // Breakdown by stage
  stageBreakdown: { stage: string; dealCount: number; acv: number; weighted: number; cyRevenue: number }[];
  // Reconciliation
  importedSnapshotValue: number;
  calculatedValue: number;
  variance: number;
  variancePct: number;
  parityStatus: 'match' | 'rounded_difference' | 'formula_drift' | 'missing_input';
  // Source notes
  sourceNotes: string[];
  confidenceStatus: 'verified' | 'calculated' | 'partial' | 'missing';
}

const STAGE_SHORTLISTED = ['shortlisted', 'short listed', 'short-listed'];
const STAGE_NEGOTIATION = ['contract negotiation', 'negotiation', 'contract_negotiation'];
const STAGE_CLOSED_WON = ['closed won', 'closed-won', 'closed_won', 'won'];

function stageInSet(stage: string, set: string[]): boolean {
  return set.includes(stage.toLowerCase().trim());
}

export function computeForecastComponents(data: CommercialOsData): ForecastComponents {
  const notes: string[] = [];

  // 1. Baseline Actuals — sum of revenue actuals
  const baselineActuals = data.revenueActuals.reduce((s, r) => s + r.amount, 0);
  notes.push(`Baseline actuals: ${data.revenueActuals.length} revenue rows summed`);

  // 2. Organic Growth — look for forecast rows with organic/growth category
  const organicRows = data.forecasts.filter(f =>
    f.category?.toLowerCase().includes('organic') || f.lineItem?.toLowerCase().includes('organic')
  );
  const organicGrowth = organicRows.reduce((s, f) => s + f.amount, 0);
  if (organicRows.length > 0) notes.push(`Organic growth: ${organicRows.length} forecast rows`);

  // 3. Pipeline CY contributions by stage (avoid double-counting closed won)
  const closedWonIds = new Set<string>();
  const closedWonDeals = data.closedWonDeals || [];

  // Closed Won CY from closed_won_deals
  const closedWonCy = closedWonDeals.reduce((s: number, d: any) => {
    const acv = Number(d.acv_annual || d.acvAnnual || d.expected_revenue_cy || 0);
    return s + acv;
  }, 0);

  // Map opportunities by stage (excl closed won to avoid double-count)
  let shortlistedCy = 0;
  let contractNegotiationCy = 0;

  const stageBreakdown: ForecastComponents['stageBreakdown'] = [];
  const stageMap = new Map<string, { count: number; acv: number; weighted: number; cy: number }>();

  for (const o of data.opportunities) {
    const stageLower = (o.stage || 'Unknown').toLowerCase().trim();
    const prev = stageMap.get(o.stage) || { count: 0, acv: 0, weighted: 0, cy: 0 };
    stageMap.set(o.stage, {
      count: prev.count + 1,
      acv: prev.acv + o.acvAnnual,
      weighted: prev.weighted + o.weightedTotal,
      cy: prev.cy + o.expectedRevenueCy,
    });

    if (stageInSet(stageLower, STAGE_CLOSED_WON)) {
      closedWonIds.add(o.id);
      // Already counted from closedWonDeals, skip to avoid double-count
    } else if (stageInSet(stageLower, STAGE_SHORTLISTED)) {
      shortlistedCy += o.expectedRevenueCy;
    } else if (stageInSet(stageLower, STAGE_NEGOTIATION)) {
      contractNegotiationCy += o.expectedRevenueCy;
    }
  }

  for (const [stage, v] of stageMap) {
    stageBreakdown.push({ stage, dealCount: v.count, acv: v.acv, weighted: v.weighted, cyRevenue: v.cy });
  }
  stageBreakdown.sort((a, b) => b.weighted - a.weighted);

  notes.push(`Shortlisted CY: ${shortlistedCy > 0 ? shortlistedCy.toLocaleString() : 'none'}`);
  notes.push(`Contract Negotiation CY: ${contractNegotiationCy > 0 ? contractNegotiationCy.toLocaleString() : 'none'}`);
  notes.push(`Closed Won CY: ${closedWonDeals.length} deals = ${closedWonCy.toLocaleString()}`);

  // 4. Forecast Total = baseline + organic + shortlisted + negotiation + closed won
  const forecastTotal = baselineActuals + organicGrowth + shortlistedCy + contractNegotiationCy + closedWonCy;

  // 5. Budget Target from dashboard metrics
  const budgetMetric = data.dashboardMetrics.find(m =>
    ['budget_target', 'fy26_revenue_budget', 'fy26_budget_target'].includes(m.metricKey)
  );
  const budgetTarget = budgetMetric?.metricValue ?? 0;

  // 6. Revenue Gap
  const revenueGap = forecastTotal - budgetTarget;

  // 7. GP — use GP basis data
  const gpForecastMetric = data.dashboardMetrics.find(m =>
    ['gp_forecast', 'fy26_gp_forecast', 'gp_total'].includes(m.metricKey)
  );
  const gpBudgetMetric = data.dashboardMetrics.find(m =>
    ['gp_budget', 'fy26_gp_budget'].includes(m.metricKey)
  );
  const gpForecast = gpForecastMetric?.metricValue ?? 0;
  const gpBudget = gpBudgetMetric?.metricValue ?? 0;
  const gpGap = gpForecast - gpBudget;

  // 8. Reconciliation — compare with imported snapshot
  const forecastSnapshotMetric = data.dashboardMetrics.find(m =>
    ['forecast_total', 'fy26_revenue_forecast', 'fy26_forecast_total'].includes(m.metricKey)
  );
  const importedSnapshotValue = forecastSnapshotMetric?.metricValue ?? 0;
  const calculatedValue = forecastTotal;
  const variance = calculatedValue - importedSnapshotValue;
  const variancePct = importedSnapshotValue > 0 ? (variance / importedSnapshotValue) * 100 : 0;

  let parityStatus: ForecastComponents['parityStatus'] = 'missing_input';
  if (importedSnapshotValue > 0 && calculatedValue > 0) {
    const absVarPct = Math.abs(variancePct);
    if (absVarPct < 0.1) parityStatus = 'match';
    else if (absVarPct < 2) parityStatus = 'rounded_difference';
    else parityStatus = 'formula_drift';
  } else if (calculatedValue > 0) {
    parityStatus = 'calculated';
  }

  // Confidence
  let confidenceStatus: ForecastComponents['confidenceStatus'] = 'missing';
  if (baselineActuals > 0 && budgetTarget > 0) {
    confidenceStatus = parityStatus === 'match' || parityStatus === 'rounded_difference' ? 'verified' : 'calculated';
  } else if (calculatedValue > 0) {
    confidenceStatus = 'partial';
  }

  notes.push(`Forecast formula: Baseline (${baselineActuals.toLocaleString()}) + Organic (${organicGrowth.toLocaleString()}) + Shortlisted (${shortlistedCy.toLocaleString()}) + Negotiation (${contractNegotiationCy.toLocaleString()}) + Closed Won (${closedWonCy.toLocaleString()}) = ${forecastTotal.toLocaleString()}`);

  return {
    baselineActuals,
    organicGrowth,
    shortlistedCy,
    contractNegotiationCy,
    closedWonCy,
    forecastTotal,
    budgetTarget,
    revenueGap,
    gpForecast,
    gpBudget,
    gpGap,
    stageBreakdown,
    importedSnapshotValue,
    calculatedValue,
    variance,
    variancePct,
    parityStatus,
    sourceNotes: notes,
    confidenceStatus,
  };
}

// ─── FIN-002: Budget vs Actual Intelligence (Read-Only) ───

export interface BvaMonthRow {
  month: string;
  actual: number;
  budget: number;
  forecast: number;
  deltaActualVsBudget: number;
  deltaForecastVsBudget: number;
  actualAvailable: boolean;
  budgetAvailable: boolean;
  forecastAvailable: boolean;
}

export interface BudgetVsActualData {
  monthRows: BvaMonthRow[];
  // YTD (months with actuals only)
  ytdActual: number;
  ytdBudget: number;
  ytdDelta: number;
  ytdMonths: number;
  // Full year
  fullYearForecast: number;
  fullYearBudget: number;
  fullYearGap: number;
  // GP
  gpForecast: number;
  gpBudget: number;
  gpGap: number;
  gpAvailable: boolean;
  // Source notes
  sourceNotes: string[];
}

export function computeBudgetVsActual(data: CommercialOsData): BudgetVsActualData {
  const notes: string[] = [];

  // 1. Build month map from forecast rows (which have budget + forecast amounts)
  // Filter to "Revenue" category / "Total" line items for the aggregate view
  const forecastTotals = data.forecasts.filter(f =>
    (f.lineItem?.toLowerCase() === 'total' || f.category?.toLowerCase() === 'revenue') &&
    f.month
  );

  const monthMap = new Map<string, { forecast: number; budget: number; actual: number; hasActual: boolean; hasBudget: boolean; hasForecast: boolean }>();

  for (const f of forecastTotals) {
    const key = f.month;
    const prev = monthMap.get(key) || { forecast: 0, budget: 0, actual: 0, hasActual: false, hasBudget: false, hasForecast: false };
    // Use the first (highest-level) forecast row per month, don't sum duplicates
    if (!prev.hasForecast) {
      prev.forecast = f.amount;
      prev.hasForecast = true;
    }
    if (!prev.hasBudget && f.budgetAmount > 0) {
      prev.budget = f.budgetAmount;
      prev.hasBudget = true;
    }
    monthMap.set(key, prev);
  }

  // 2. Overlay actuals from revenue_actuals (sum per month)
  const actualByMonth = new Map<string, number>();
  for (const r of data.revenueActuals) {
    if (!r.month) continue;
    actualByMonth.set(r.month, (actualByMonth.get(r.month) || 0) + r.amount);
  }

  for (const [month, amount] of actualByMonth) {
    const prev = monthMap.get(month) || { forecast: 0, budget: 0, actual: 0, hasActual: false, hasBudget: false, hasForecast: false };
    prev.actual = amount;
    prev.hasActual = true;
    monthMap.set(month, prev);
  }

  // 3. Build sorted month rows
  const monthRows: BvaMonthRow[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      actual: v.actual,
      budget: v.budget,
      forecast: v.forecast,
      deltaActualVsBudget: v.hasActual && v.hasBudget ? v.actual - v.budget : 0,
      deltaForecastVsBudget: v.hasForecast && v.hasBudget ? v.forecast - v.budget : 0,
      actualAvailable: v.hasActual,
      budgetAvailable: v.hasBudget,
      forecastAvailable: v.hasForecast,
    }));

  // 4. YTD (only months with actuals)
  const ytdRows = monthRows.filter(r => r.actualAvailable);
  const ytdActual = ytdRows.reduce((s, r) => s + r.actual, 0);
  const ytdBudget = ytdRows.reduce((s, r) => s + r.budget, 0);
  const ytdDelta = ytdActual - ytdBudget;

  // 5. Full year totals
  const fullYearForecast = monthRows.reduce((s, r) => s + r.forecast, 0);
  const fullYearBudget = monthRows.reduce((s, r) => s + r.budget, 0);
  const fullYearGap = fullYearForecast - fullYearBudget;

  // 6. GP from dashboard metrics
  const gpFm = data.dashboardMetrics.find(m => ['gp_forecast', 'fy26_gp_forecast', 'gp_total'].includes(m.metricKey));
  const gpBm = data.dashboardMetrics.find(m => ['gp_budget', 'fy26_gp_budget'].includes(m.metricKey));
  const gpForecast = gpFm?.metricValue ?? 0;
  const gpBudget = gpBm?.metricValue ?? 0;
  const gpGap = gpForecast - gpBudget;
  const gpAvailable = gpForecast > 0 || gpBudget > 0;

  // Source notes
  notes.push(`Forecast months: ${monthRows.filter(r => r.forecastAvailable).length}`);
  notes.push(`Budget months: ${monthRows.filter(r => r.budgetAvailable).length}`);
  notes.push(`Actual months: ${ytdRows.length}`);
  if (ytdRows.length > 0) notes.push(`YTD actual: ${ytdActual.toLocaleString()} vs budget: ${ytdBudget.toLocaleString()} = ${ytdDelta >= 0 ? '+' : ''}${ytdDelta.toLocaleString()}`);
  if (gpAvailable) notes.push(`GP forecast: ${gpForecast.toLocaleString()} vs GP budget: ${gpBudget.toLocaleString()}`);

  return {
    monthRows,
    ytdActual,
    ytdBudget,
    ytdDelta,
    ytdMonths: ytdRows.length,
    fullYearForecast,
    fullYearBudget,
    fullYearGap,
    gpForecast,
    gpBudget,
    gpGap,
    gpAvailable,
    sourceNotes: notes,
  };
}

// ─── OPS-001: Operations Signal Inbox (Read-Only) ─────────────

export type SignalType = 'capacity_risk' | 'shortfall' | 'high_utilization' | 'complaint' | 'sla_risk' | 'promise_gap' | 'warehouse_issue' | 'finance_signal';
export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SignalStatus = 'open' | 'monitoring' | 'resolved' | 'ignored';

export interface OperationsSignal {
  id: string;
  signalCode: string;
  signalType: SignalType;
  sourceArea: string;
  sourceTable: string;
  sourceRecordId: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseLabel: string;
  severity: SignalSeverity;
  status: SignalStatus;
  title: string;
  description: string;
  commercialImpact: string;
  recommendedAction: string;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  sourceLineage: string;
  createdFromRule: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignalSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  monitoring: number;
  resolved: number;
  capacitySignals: number;
  financeSignals: number;
  warehouseSignals: number;
  signals: OperationsSignal[];
}

function mapSignal(row: any): OperationsSignal {
  return {
    id: text(row.id, row.signal_code),
    signalCode: text(row.signal_code),
    signalType: (text(row.signal_type) || 'warehouse_issue') as SignalType,
    sourceArea: text(row.source_area),
    sourceTable: text(row.source_table),
    sourceRecordId: text(row.source_record_id),
    customerId: text(row.customer_id),
    customerName: text(row.customer_name),
    warehouseId: text(row.warehouse_id),
    warehouseLabel: text(row.warehouse_label),
    severity: (text(row.severity) || 'medium') as SignalSeverity,
    status: (text(row.status) || 'open') as SignalStatus,
    title: text(row.title),
    description: text(row.description),
    commercialImpact: text(row.commercial_impact),
    recommendedAction: text(row.recommended_action),
    sourceType: text(row.source_type),
    truthStatus: text(row.truth_status),
    confidenceTier: num(row.confidence_tier),
    sourceLineage: text(row.source_lineage),
    createdFromRule: row.created_from_rule === true,
    active: row.active !== false,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function fetchOperationsSignals(): Promise<OperationsSignal[]> {
  const { data, error } = await supabase
    .from("operations_signals")
    .select("*")
    .eq("active", true)
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[commercial-os] Failed to fetch operations signals:", error.message);
    return [];
  }
  return (data ?? []).map(mapSignal);
}

/**
 * Generate client-side signals from existing capacity/GP data.
 * Used as fallback when DB signals are empty (migration not applied).
 */
export function generateSignalsFromData(
  riskSummary: CapacityRiskSummary | null,
  gpSummary: { dangerousDefaultCount: number; totalDeals: number; projectedGpAssumed: number } | null,
): OperationsSignal[] {
  const signals: OperationsSignal[] = [];
  const now = new Date().toISOString();

  if (riskSummary) {
    for (const w of riskSummary.warehouses) {
      if (w.riskStatus === 'overcommitted') {
        signals.push({
          id: `gen-overcommit-${w.warehouseLabel}`,
          signalCode: `OPS-CAP-OVERCOMMIT-${w.warehouseLabel}`,
          signalType: 'capacity_risk',
          sourceArea: 'warehouse_capacity',
          sourceTable: 'warehouse_capacity_snapshots',
          sourceRecordId: '',
          customerId: '',
          customerName: '',
          warehouseId: '',
          warehouseLabel: w.warehouseLabel,
          severity: 'critical',
          status: 'open',
          title: `Overcommitted: ${w.warehouseLabel}`,
          description: `Committed (${w.committedCapacity.toLocaleString()}) exceeds sellable (${w.sellableCapacity.toLocaleString()}). Shortfall of ${w.shortfallCapacity.toLocaleString()} pallets.`,
          commercialImpact: 'Subcontracting risk — warehouse cannot fulfill committed volumes. New deals will fail SLA.',
          recommendedAction: `Freeze new commitments to ${w.warehouseLabel}. Review subcontracting options.`,
          sourceType: 'verified_snapshot',
          truthStatus: 'verified_snapshot',
          confidenceTier: 1,
          sourceLineage: 'warehouse_capacity_snapshots → committed > sellable',
          createdFromRule: true,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (w.shortfallCapacity > 0) {
        signals.push({
          id: `gen-shortfall-${w.warehouseLabel}`,
          signalCode: `OPS-CAP-SHORTFALL-${w.warehouseLabel}`,
          signalType: 'shortfall',
          sourceArea: 'warehouse_capacity',
          sourceTable: 'warehouse_capacity_snapshots',
          sourceRecordId: '',
          customerId: '',
          customerName: '',
          warehouseId: '',
          warehouseLabel: w.warehouseLabel,
          severity: 'high',
          status: 'open',
          title: `Shortfall: ${w.warehouseLabel} (${w.shortfallCapacity.toLocaleString()} pallets)`,
          description: `Shortfall of ${w.shortfallCapacity.toLocaleString()} pallets at ${w.warehouseLabel}. Utilization ${w.utilizationPct.toFixed(1)}%.`,
          commercialImpact: 'Capacity constraint — new commitments risk breaking SLA.',
          recommendedAction: 'Review capacity allocation. Do not promise additional volume without operations confirmation.',
          sourceType: 'verified_snapshot',
          truthStatus: 'verified_snapshot',
          confidenceTier: 1,
          sourceLineage: 'warehouse_capacity_snapshots → shortfall > 0',
          createdFromRule: true,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (w.riskStatus === 'high_utilization') {
        signals.push({
          id: `gen-highutil-${w.warehouseLabel}`,
          signalCode: `OPS-CAP-HIGHUTIL-${w.warehouseLabel}`,
          signalType: 'high_utilization',
          sourceArea: 'warehouse_capacity',
          sourceTable: 'warehouse_capacity_snapshots',
          sourceRecordId: '',
          customerId: '',
          customerName: '',
          warehouseId: '',
          warehouseLabel: w.warehouseLabel,
          severity: 'medium',
          status: 'open',
          title: `High utilization: ${w.warehouseLabel} (${w.utilizationPct.toFixed(1)}%)`,
          description: `${w.warehouseLabel} at ${w.utilizationPct.toFixed(1)}% utilization. Limited headroom for new deals.`,
          commercialImpact: 'Limited headroom — warehouse review required before new commitments.',
          recommendedAction: 'Conduct capacity review before committing new deals. Monitor weekly.',
          sourceType: 'verified_snapshot',
          truthStatus: 'verified_snapshot',
          confidenceTier: 2,
          sourceLineage: 'warehouse_capacity_snapshots → utilization >= 90%',
          createdFromRule: true,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  if (gpSummary && gpSummary.dangerousDefaultCount > 0) {
    signals.push({
      id: 'gen-gp-assumption',
      signalCode: 'OPS-FIN-GP-ASSUMED',
      signalType: 'finance_signal',
      sourceArea: 'gp_intelligence',
      sourceTable: 'commercial_opportunity_gp_basis',
      sourceRecordId: '',
      customerId: '',
      customerName: '',
      warehouseId: '',
      warehouseLabel: '',
      severity: 'high',
      status: 'open',
      title: `GP assumption risk: ${gpSummary.dangerousDefaultCount}/${gpSummary.totalDeals} deals using 25% default`,
      description: `${gpSummary.dangerousDefaultCount} pipeline deals use the 25% GP / 75% cost assumption. Assumed GP: ${gpSummary.projectedGpAssumed.toLocaleString()} SAR.`,
      commercialImpact: 'Entire pipeline GP projection is assumed, not verified. Cannot rely on GP figures for budgeting.',
      recommendedAction: 'Request Finance to provide actual cost data per deal. Do not treat assumed GP as verified profit.',
      sourceType: 'assumption',
      truthStatus: 'assumption',
      confidenceTier: 3,
      sourceLineage: 'commercial_opportunity_gp_basis → all gp_basis = assumed_margin',
      createdFromRule: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Sort: critical first, then high, medium, low
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  signals.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return signals;
}

export function computeSignalSummary(signals: OperationsSignal[]): SignalSummary {
  return {
    total: signals.length,
    critical: signals.filter(s => s.severity === 'critical').length,
    high: signals.filter(s => s.severity === 'high').length,
    medium: signals.filter(s => s.severity === 'medium').length,
    low: signals.filter(s => s.severity === 'low').length,
    open: signals.filter(s => s.status === 'open').length,
    monitoring: signals.filter(s => s.status === 'monitoring').length,
    resolved: signals.filter(s => s.status === 'resolved').length,
    capacitySignals: signals.filter(s => ['capacity_risk', 'shortfall', 'high_utilization'].includes(s.signalType)).length,
    financeSignals: signals.filter(s => s.signalType === 'finance_signal').length,
    warehouseSignals: signals.filter(s => s.warehouseLabel !== '').length,
    signals,
  };
}

// ─── ESC-001: Commercial Escalation Workspace (Read-Only) ─────

export type EscalationType = 'capacity' | 'finance' | 'gp' | 'customer' | 'tender' | 'operational' | 'leadership';
export type EscalationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EscalationStatus = 'open' | 'monitoring' | 'under_review' | 'mitigated' | 'resolved' | 'ignored';

export interface CommercialEscalation {
  id: string;
  escalationCode: string;
  sourceSignalId: string;
  escalationType: EscalationType;
  title: string;
  description: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseLabel: string;
  tenderWorkspaceId: string;
  ownerRole: string;
  governanceOwner: string;
  commercialImpact: string;
  financialExposure: number | null;
  recommendedAction: string;
  sourceType: string;
  truthStatus: string;
  confidenceTier: number;
  sourceLineage: string;
  createdFromRule: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  monitoring: number;
  underReview: number;
  mitigated: number;
  resolved: number;
  capacityEscalations: number;
  financeEscalations: number;
  gpEscalations: number;
  operationalEscalations: number;
  totalFinancialExposure: number;
  escalations: CommercialEscalation[];
}

function mapEscalation(row: any): CommercialEscalation {
  return {
    id: text(row.id, row.escalation_code),
    escalationCode: text(row.escalation_code),
    escalationType: (text(row.escalation_type) || 'operational') as EscalationType,
    sourceSignalId: text(row.source_signal_id),
    title: text(row.title),
    description: text(row.description),
    severity: (text(row.severity) || 'medium') as EscalationSeverity,
    status: (text(row.status) || 'open') as EscalationStatus,
    customerId: text(row.customer_id),
    customerName: text(row.customer_name),
    warehouseId: text(row.warehouse_id),
    warehouseLabel: text(row.warehouse_label),
    tenderWorkspaceId: text(row.tender_workspace_id),
    ownerRole: text(row.owner_role),
    governanceOwner: text(row.governance_owner),
    commercialImpact: text(row.commercial_impact),
    financialExposure: row.financial_exposure != null ? Number(row.financial_exposure) : null,
    recommendedAction: text(row.recommended_action),
    sourceType: text(row.source_type),
    truthStatus: text(row.truth_status),
    confidenceTier: num(row.confidence_tier),
    sourceLineage: text(row.source_lineage),
    createdFromRule: row.created_from_rule === true,
    active: row.active !== false,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function fetchCommercialEscalations(): Promise<CommercialEscalation[]> {
  const { data, error } = await supabase
    .from("commercial_escalations")
    .select("*")
    .eq("active", true)
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[commercial-os] Failed to fetch escalations:", error.message);
    return [];
  }
  return (data ?? []).map(mapEscalation);
}

/**
 * Generate client-side escalations from existing capacity/GP data.
 * Used as fallback when DB escalations are empty (migration not applied).
 */
export function generateEscalationsFromData(
  riskSummary: CapacityRiskSummary | null,
  gpSummary: { dangerousDefaultCount: number; totalDeals: number; projectedGpAssumed: number } | null,
): CommercialEscalation[] {
  const escalations: CommercialEscalation[] = [];
  const now = new Date().toISOString();

  if (riskSummary) {
    for (const w of riskSummary.warehouses) {
      if (w.riskStatus === 'overcommitted') {
        escalations.push({
          id: `gen-esc-overcommit-${w.warehouseLabel}`,
          escalationCode: `ESC-CAP-OVERCOMMIT-${w.warehouseLabel}`,
          sourceSignalId: '',
          escalationType: 'capacity',
          title: `Escalation: Overcommitted capacity at ${w.warehouseLabel}`,
          description: `Committed (${w.committedCapacity.toLocaleString()}) exceeds sellable (${w.sellableCapacity.toLocaleString()}). Shortfall of ${w.shortfallCapacity.toLocaleString()} pallets.`,
          severity: 'critical',
          status: 'open',
          customerId: '',
          customerName: '',
          warehouseId: '',
          warehouseLabel: w.warehouseLabel,
          tenderWorkspaceId: '',
          ownerRole: 'Operations + Commercial Leadership',
          governanceOwner: 'COO / Commercial Director',
          commercialImpact: 'Subcontracting risk — warehouse cannot fulfill committed volumes. Customer escalation likely.',
          financialExposure: w.shortfallCapacity * 48,
          recommendedAction: `Freeze new commitments to ${w.warehouseLabel}. Review subcontracting options. Notify affected customers.`,
          sourceType: 'verified_snapshot',
          truthStatus: 'verified_snapshot',
          confidenceTier: 1,
          sourceLineage: 'warehouse_capacity_snapshots → committed > sellable → signal → escalation',
          createdFromRule: true,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (w.shortfallCapacity > 0) {
        escalations.push({
          id: `gen-esc-shortfall-${w.warehouseLabel}`,
          escalationCode: `ESC-OPS-SHORTFALL-${w.warehouseLabel}`,
          sourceSignalId: '',
          escalationType: 'operational',
          title: `Escalation: Capacity shortfall at ${w.warehouseLabel} (${w.shortfallCapacity.toLocaleString()} pallets)`,
          description: `Shortfall of ${w.shortfallCapacity.toLocaleString()} pallets at ${w.warehouseLabel}. Utilization ${w.utilizationPct.toFixed(1)}%.`,
          severity: 'high',
          status: 'open',
          customerId: '',
          customerName: '',
          warehouseId: '',
          warehouseLabel: w.warehouseLabel,
          tenderWorkspaceId: '',
          ownerRole: 'Operations Leadership',
          governanceOwner: 'COO',
          commercialImpact: 'Capacity constraint — new commitments risk breaking SLA. Customer churn risk.',
          financialExposure: w.shortfallCapacity * 48,
          recommendedAction: `Review capacity allocation at ${w.warehouseLabel}. Do not promise additional volume.`,
          sourceType: 'verified_snapshot',
          truthStatus: 'verified_snapshot',
          confidenceTier: 1,
          sourceLineage: 'warehouse_capacity_snapshots → shortfall > 0 → signal → escalation',
          createdFromRule: true,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      // Note: high_utilization doesn't escalate — only overcommitted + shortfall
    }
  }

  if (gpSummary && gpSummary.dangerousDefaultCount > 0) {
    escalations.push({
      id: 'gen-esc-gp-assumption',
      escalationCode: 'ESC-FIN-GP-ASSUMED',
      sourceSignalId: '',
      escalationType: 'gp',
      title: `Escalation: ${gpSummary.dangerousDefaultCount}/${gpSummary.totalDeals} deals using 25% GP default`,
      description: `All pipeline deals use the 25% GP assumption. Projected GP of ${gpSummary.projectedGpAssumed.toLocaleString()} SAR is entirely assumed.`,
      severity: 'high',
      status: 'open',
      customerId: '',
      customerName: '',
      warehouseId: '',
      warehouseLabel: '',
      tenderWorkspaceId: '',
      ownerRole: 'Finance + Commercial Leadership',
      governanceOwner: 'CFO / Commercial Director',
      commercialImpact: 'Entire pipeline GP projection is assumed. Board reporting at risk.',
      financialExposure: gpSummary.projectedGpAssumed,
      recommendedAction: 'Request Finance to provide actual cost data. Do not present assumed GP as verified profit.',
      sourceType: 'assumption',
      truthStatus: 'assumption',
      confidenceTier: 3,
      sourceLineage: 'commercial_opportunities → gp_basis = assumed → signal → escalation',
      createdFromRule: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Sort: critical first, then high, medium, low
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  escalations.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return escalations;
}

export function computeEscalationSummary(escalations: CommercialEscalation[]): EscalationSummary {
  return {
    total: escalations.length,
    critical: escalations.filter(e => e.severity === 'critical').length,
    high: escalations.filter(e => e.severity === 'high').length,
    medium: escalations.filter(e => e.severity === 'medium').length,
    low: escalations.filter(e => e.severity === 'low').length,
    open: escalations.filter(e => e.status === 'open').length,
    monitoring: escalations.filter(e => e.status === 'monitoring').length,
    underReview: escalations.filter(e => e.status === 'under_review').length,
    mitigated: escalations.filter(e => e.status === 'mitigated').length,
    resolved: escalations.filter(e => e.status === 'resolved').length,
    capacityEscalations: escalations.filter(e => e.escalationType === 'capacity').length,
    financeEscalations: escalations.filter(e => ['finance', 'gp'].includes(e.escalationType)).length,
    gpEscalations: escalations.filter(e => e.escalationType === 'gp').length,
    operationalEscalations: escalations.filter(e => e.escalationType === 'operational').length,
    totalFinancialExposure: escalations.reduce((sum, e) => sum + (e.financialExposure ?? 0), 0),
    escalations,
  };
}

// ─── DOC-001: Document Vault (Read-Only) ─────────────────────
export interface DocumentVaultRow {
  id: string;
  documentType: string;
  documentTitle: string;
  relatedEntityType: string;
  relatedEntityId: string;
  sourceBatchId: string;
  sourceSystem: string;
  sourceFileName: string;
  storageReference: string;
  versionNumber: number;
  versionStatus: string;
  truthStatus: string;
  confidenceTier: number;
  sourceLineage: string;
  generatedAt: string;
  createdBy: string;
  notes: string;
  active: boolean;
}

function mapDocumentVault(row: any): DocumentVaultRow {
  return {
    id: text(row.id),
    documentType: text(row.document_type),
    documentTitle: text(row.document_title),
    relatedEntityType: text(row.related_entity_type),
    relatedEntityId: text(row.related_entity_id),
    sourceBatchId: text(row.source_batch_id),
    sourceSystem: text(row.source_system),
    sourceFileName: text(row.source_file_name),
    storageReference: text(row.storage_reference),
    versionNumber: num(row.version_number) || 1,
    versionStatus: text(row.version_status) || 'active',
    truthStatus: text(row.truth_status) || 'snapshot',
    confidenceTier: num(row.confidence_tier) || 4,
    sourceLineage: text(row.source_lineage),
    generatedAt: text(row.generated_at),
    createdBy: text(row.created_by) || 'system',
    notes: text(row.notes),
    active: row.active !== false,
  };
}

export async function fetchDocumentVault(): Promise<DocumentVaultRow[]> {
  const { data, error } = await supabase
    .from("document_vault")
    .select("*")
    .eq("active", true)
    .order("document_type")
    .order("generated_at", { ascending: false });
  if (error) {
    console.error("[commercial-os] Failed to fetch document vault:", error.message);
    return [];
  }
  return (data ?? []).map(mapDocumentVault);
}

export async function fetchDocumentsByEntity(entityType: string, entityId?: string): Promise<DocumentVaultRow[]> {
  let q = supabase
    .from("document_vault")
    .select("*")
    .eq("active", true)
    .eq("related_entity_type", entityType);
  if (entityId) q = q.eq("related_entity_id", entityId);
  const { data, error } = await q.order("generated_at", { ascending: false });
  if (error) {
    console.error("[commercial-os] Failed to fetch documents by entity:", error.message);
    return [];
  }
  return (data ?? []).map(mapDocumentVault);
}

export async function fetchDocumentsByType(docType: string): Promise<DocumentVaultRow[]> {
  const { data, error } = await supabase
    .from("document_vault")
    .select("*")
    .eq("active", true)
    .eq("document_type", docType)
    .order("generated_at", { ascending: false });
  if (error) {
    console.error("[commercial-os] Failed to fetch documents by type:", error.message);
    return [];
  }
  return (data ?? []).map(mapDocumentVault);
}
