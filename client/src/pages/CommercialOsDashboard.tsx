import { AlertTriangle, ArrowRight, BarChart3, Boxes, Calculator, ClipboardList, Database, Info, LineChart, TableProperties } from "lucide-react";
import { Link } from "wouter";
import {
  CommercialOsShell,
  EmptySourceState,
  ErrorState,
  LoadingState,
  MetricCard,
  SourceCell,
} from "@/components/commercial-os/CommercialOsShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import { computeStrategicTruths, type StrategicTruth, type ParityStatus } from "@/lib/commercial-os-formulas";
import { computeGpV2Summary, computeCapacityRiskSummary, computeForecastComponents, type KpiRegistryEntry } from "@/lib/commercial-os-data";

const metricDefinitions = [
  { label: "Weighted Pipeline", aliases: ["weighted_pipeline", "pipeline_weighted"] },
  { label: "Materializing 75%+", aliases: ["materializing_75plus", "materializing_75_plus", "materializing_75", "materializing_75_100"] },
  { label: "Projected GP Weighted", aliases: ["projected_gp_weighted", "weighted_gp"] },
  { label: "Free Capacity Baseline", aliases: ["free_capacity_baseline", "free_capacity"] },
  { label: "FY26 Revenue Gap", aliases: ["fy26_revenue_gap", "revenue_gap"] },
  { label: "FY26 GP Gap", aliases: ["fy26_gp_gap", "gp_gap"] },
  { label: "Forecast Total", aliases: ["fy26_revenue_forecast", "forecast_total", "fy26_forecast_total"] },
  { label: "Budget Target", aliases: ["fy26_revenue_budget", "budget_target", "fy26_budget_target"] },
  { label: "Unsold Capacity Value", aliases: ["unsold_capacity_value"] },
];

const sections = [
  { href: "/commercial-os/pipeline", label: "Warehouse Pipeline", icon: TableProperties, detail: "Opportunity rows, flags, weighted value, and source rows." },
  { href: "/commercial-os/capacity", label: "Warehouse Capacity", icon: Boxes, detail: "Capacity, utilization, shortfall, and remaining space." },
  { href: "/commercial-os/forecast", label: "Forecast", icon: LineChart, detail: "Monthly forecast, budget deltas, GP, and loss view." },
  { href: "/commercial-os/revenue", label: "Revenue Actuals", icon: Database, detail: "GL/customer monthly actuals and YTD shell." },
  { href: "/commercial-os/actions", label: "Leadership Actions", icon: ClipboardList, detail: "Read-only action/risk list for leadership follow-up." },
];

function fmt(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function numValue(row: any, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(row?.[key] ?? 0);
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return 0;
}

function textValue(row: any, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
  }
  return "";
}

function fmtMonth(value: string) {
  if (!value) return "--";
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(date);
}

function metricMatches(metricKey: string, metricLabel: string, aliases: string[]) {
  const normalizedLabel = metricLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return aliases.includes(metricKey) || aliases.includes(normalizedLabel);
}

function registryKeyForTruth(st: StrategicTruth) {
  if (st.label === "Weighted Pipeline") return "weighted_pipeline";
  if (st.label === "Materializing 75%+") return "materializing_75plus";
  if (st.label === "FY26 Revenue Gap") return "fy26_revenue_gap";
  if (st.label === "FY26 GP Gap") return "fy26_gp_gap";
  if (st.label === "Forecast Total") return "forecast_total";
  if (st.label === "Monthly Phasing Total (Weighted)") return "monthly_phasing";
  return st.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function titleizeSource(sourceType: string) {
  const labels: Record<string, string> = {
    formula_native: "Formula Native",
    excel_snapshot: "Excel Snapshot",
    d365: "D365",
    lfs: "LFS",
    finance_budget: "Finance Budget",
    manual_hanno: "Manual Hanno",
    assumption: "Assumption",
    dangerous_default: "Dangerous Default",
  };
  return labels[sourceType] ?? (sourceType || "--");
}

function sourceBadge(sourceType: string) {
  if (!sourceType) return <span className="text-xs text-muted-foreground">--</span>;
  const className =
    sourceType === "formula_native" ? "border-blue-200 bg-blue-50 text-blue-700" :
    sourceType === "excel_snapshot" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    sourceType === "dangerous_default" ? "border-red-200 bg-red-50 text-red-700" :
    sourceType === "assumption" ? "border-amber-200 bg-amber-50 text-amber-700" :
    sourceType === "finance_budget" ? "border-violet-200 bg-violet-50 text-violet-700" :
    sourceType === "manual_hanno" ? "border-slate-200 bg-slate-50 text-slate-700" :
    "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <Badge variant="outline" className={`${className} text-[10px]`}>
      {titleizeSource(sourceType)}
    </Badge>
  );
}

function truthStatusBadge(status: string) {
  if (!status || status === 'unresolved') return <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-500">unresolved</Badge>;
  const styles: Record<string, string> = {
    verified_formula: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    verified_snapshot: 'border-blue-200 bg-blue-50 text-blue-700',
    rounded_snapshot: 'border-sky-200 bg-sky-50 text-sky-700',
    governance_input: 'border-violet-200 bg-violet-50 text-violet-700',
    assumption: 'border-amber-200 bg-amber-50 text-amber-700',
    disputed: 'border-red-200 bg-red-50 text-red-700',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant="outline" className={`${styles[status] || 'border-zinc-200 bg-zinc-50 text-zinc-700'} text-[10px]`}>{label}</Badge>;
}

function confidenceTierBadge(tier: number) {
  const labels: Record<number, { label: string; className: string }> = {
    1: { label: 'T1 API', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    2: { label: 'T2 Formula', className: 'border-blue-200 bg-blue-50 text-blue-700' },
    3: { label: 'T3 Snapshot', className: 'border-sky-200 bg-sky-50 text-sky-700' },
    4: { label: 'T4 Assumption', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    5: { label: 'T5 Default', className: 'border-red-200 bg-red-50 text-red-700' },
  };
  const item = labels[tier] || labels[5]!;
  return <Badge variant="outline" className={`${item.className} text-[10px]`}>{item.label}</Badge>;
}

function registryTolerance(entry?: KpiRegistryEntry) {
  if (!entry) return "--";
  if (entry.toleranceType === "exact") return "exact";
  return `${entry.toleranceValue} ${entry.toleranceType}`;
}

function registryRisk(entry?: KpiRegistryEntry, fallback?: string) {
  const risk = entry?.riskLevel || fallback || "";
  if (!risk) return <span className="text-xs text-muted-foreground">--</span>;
  const normalized = risk.toLowerCase();
  const className =
    normalized === "critical" ? "border-red-200 bg-red-50 text-red-700" :
    normalized === "high" ? "border-orange-200 bg-orange-50 text-orange-700" :
    normalized === "medium" ? "border-amber-200 bg-amber-50 text-amber-700" :
    "border-zinc-200 bg-zinc-50 text-zinc-500";
  return <Badge variant="outline" className={className}>{risk}</Badge>;
}

function futureApiLabel(entry?: KpiRegistryEntry) {
  const candidate = entry?.externalSourceSystem || "";
  return candidate ? `Future API candidate: ${candidate}` : "Future API candidate: not registered";
}

function parityBadge(status: ParityStatus) {
  switch (status) {
    case "match":
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">MATCH</Badge>;
    case "minor_variance":
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">ROUNDING</Badge>;
    case "material_variance":
      return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">AUDIT</Badge>;
    case "no_imported_value":
      return <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-500 text-[10px]">NO IMPORT</Badge>;
  }
}

function formulaStatus(st: StrategicTruth) {
  const absPct = Math.abs(st.variance_pct);
  const absVariance = Math.abs(st.variance);

  if (st.imported_value === null) {
    return {
      label: "Needs Row Audit",
      className: "border-red-200 bg-red-50 text-red-700",
      helper: "Imported dashboard value is unavailable, so parity cannot be confirmed.",
      expected: false,
    };
  }

  if (absVariance === 0 || st.parity_status === "match") {
    return {
      label: "Exact Formula Match",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      helper: "Imported value and calculated workbook formula truth are aligned.",
      expected: true,
    };
  }

  if (st.label === "Weighted Pipeline" && absPct <= 1) {
    return {
      label: "Acceptable Rounding",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      helper: "Within 1%; pending per-deal rounding audit.",
      expected: true,
    };
  }

  if (st.label === "Forecast Total" && absPct <= 1) {
    return {
      label: "Rounded Dashboard Difference",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      helper: "Formula fixed: baseline + pipeline 75%+ structure.",
      expected: true,
    };
  }

  if (st.parity_status === "minor_variance" || absPct <= 5) {
    return {
      label: "Rounded Dashboard Difference",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      helper: "Imported value is rounded dashboard shorthand. Calculated value is workbook formula truth.",
      expected: true,
    };
  }

  return {
    label: "Needs Row Audit",
    className: "border-red-200 bg-red-50 text-red-700",
    helper: "Variance is larger than expected rounding and should be traced back to source rows.",
    expected: false,
  };
}

function varianceClass(st: StrategicTruth) {
  const status = formulaStatus(st);
  if (status.expected) {
    return st.variance === 0 ? "text-emerald-700" : "text-blue-700";
  }
  return "text-red-700";
}

export default function CommercialOsDashboard() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const truths = !loading && !error ? computeStrategicTruths(data) : [];

  const cards = metricDefinitions.map((definition) => {
    const metric = data.dashboardMetrics.find((m) => metricMatches(m.metricKey, m.metricLabel, definition.aliases));
    const truth = truths.find((t) => t.label === definition.label);
    return { definition, metric, truth };
  });
  const registryByKey = new Map(data.kpiRegistry.map((entry) => [entry.kpiKey, entry]));
  const sourceTypes = ["formula_native", "excel_snapshot", "d365", "lfs", "finance_budget", "manual_hanno", "assumption", "dangerous_default"];
  const phasingMonths = Array.from(new Set(data.monthlyPhasing.map((row) => textValue(row, "month", "phasing_month")).filter(Boolean))).sort();
  const phasingOpportunityCount = new Set(data.monthlyPhasing.map((row) => textValue(row, "opportunity_id", "commercial_opportunity_id")).filter(Boolean)).size;
  const phasingRevenue = data.monthlyPhasing.reduce((sum, row) => sum + numValue(row, "revenue_amount", "amount"), 0);
  const phasingWeighted = data.monthlyPhasing.reduce((sum, row) => sum + numValue(row, "weighted_amount", "weighted_total"), 0);

  // EXEC-001: Executive computed values
  const gp = !loading && !error && data.opportunities.length > 0 ? computeGpV2Summary(data.opportunities) : null;
  const capRisk = !loading && !error && data.capacitySnapshots.length > 0 ? computeCapacityRiskSummary(data.capacitySnapshots, data.dashboardThresholds) : null;
  const mv = (key: string) => {
    const m = data.dashboardMetrics.find((x) => metricMatches(x.metricKey, x.metricLabel, [key]));
    return m?.metricValue ?? 0;
  };
  const forecastTotal = mv('forecast_total') || mv('fy26_revenue_forecast') || mv('fy26_forecast_total');
  const budgetTarget = mv('budget_target') || mv('fy26_revenue_budget') || mv('fy26_budget_target');
  // FCST-001: Use computeForecastComponents for formula-native fallback
  const fc = !loading && !error ? computeForecastComponents(data) : null;
  const effectiveForecast = forecastTotal || fc?.forecastTotal || 0;
  const effectiveBudget = budgetTarget || fc?.budgetTarget || 0;
  const revenueGap = mv('fy26_revenue_gap') || mv('revenue_gap') || (effectiveForecast && effectiveBudget ? effectiveForecast - effectiveBudget : 0);
  const gpGap = mv('fy26_gp_gap') || mv('gp_gap') || fc?.gpGap || 0;
  const weightedPipeline = mv('weighted_pipeline') || mv('pipeline_weighted');
  const materializing = mv('materializing_75plus') || mv('materializing_75_plus') || mv('materializing_75') || mv('materializing_75_100');
  const gapStatus = revenueGap > 0 ? 'ahead' : revenueGap === 0 ? 'on_track' : 'behind';
  const stageMap = new Map<string, { count: number; weighted: number }>();
  for (const o of data.opportunities) {
    const s = o.stage || 'Unknown';
    const prev = stageMap.get(s) || { count: 0, weighted: 0 };
    stageMap.set(s, { count: prev.count + 1, weighted: prev.weighted + o.weightedTotal });
  }
  const stageDistribution = Array.from(stageMap.entries()).map(([stage, v]) => ({ stage, ...v })).sort((a, b) => b.weighted - a.weighted);
  const topDeals = [...data.opportunities].sort((a, b) => b.weightedTotal - a.weightedTotal).slice(0, 5);
  const kpiTiers = { t2: 0, t3: 0, t4: 0, t5: 0 };
  for (const k of data.kpiRegistry) {
    if (k.confidenceTier === 2) kpiTiers.t2++;
    else if (k.confidenceTier === 3) kpiTiers.t3++;
    else if (k.confidenceTier === 4) kpiTiers.t4++;
    else if (k.confidenceTier === 5) kpiTiers.t5++;
  }

  return (
    <CommercialOsShell
      title="Commercial OS Dashboard"
      description={`Live read-only dashboard for Excel import batch ${batchId}.`}
    >
      <div className="space-y-6">
        {loading ? <LoadingState label="dashboard metrics" /> : error ? <ErrorState error={error} /> : null}

        {/* ═══ EXEC-001: Executive Command Center ═══ */}
        {!loading && !error && (
          <>
            {/* 1. Revenue Position */}
            <Card className="shadow-none border-emerald-200">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold">Revenue Position</p>
                  <Badge variant="outline" className={`text-[10px] ${
                    gapStatus === 'ahead' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    gapStatus === 'on_track' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                    'border-red-200 bg-red-50 text-red-700'
                  }`}>{gapStatus === 'ahead' ? '▲ Ahead' : gapStatus === 'on_track' ? '● On Track' : '▼ Behind'}</Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">Formula-native where available · Finance budget is governance input</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Forecast Total" value={fmt(effectiveForecast)} helper={forecastTotal ? 'Imported snapshot' : 'Formula-native (FCST-001)'} />
                  <MetricCard label="Budget Target" value={fmt(effectiveBudget)} helper="Finance governance input" />
                  <MetricCard label="FY26 Revenue Gap" value={fmt(revenueGap)} helper="Forecast − Budget" />
                  <MetricCard label="FY26 GP Gap" value={fmt(gpGap)} helper="GP forecast − GP budget" />
                </div>
              </CardContent>
            </Card>

            {/* 2. GP / Profit Position */}
            {gp && (
              <Card className={`shadow-none ${gp.assumedGpPctOfTotal > 50 ? 'border-amber-200' : 'border-emerald-200'}`}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold">GP / Profit Position</p>
                    <Badge variant="outline" className={`text-[10px] ${gp.assumedGpPctOfTotal > 50 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                      {gp.assumedGpPctOfTotal > 50 ? '⚠ GP not verified' : '✓ GP verified'}
                    </Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">GP confidence depends on cost basis · 75% cost ratio is assumption until Finance validates</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <MetricCard label="Projected GP Weighted" value={fmt(gp.projectedGpTotal)} helper="Sum of weighted × GP margin %" />
                    <MetricCard label="Verified GP" value={fmt(gp.projectedGpVerified)} helper={`${gp.dealsVerified} deals`} />
                    <MetricCard label="Assumed GP" value={fmt(gp.projectedGpAssumed)} helper={`${gp.dealsAssumed} deals at 25% default`} />
                    <MetricCard label="% Assumed" value={`${gp.assumedGpPctOfTotal}%`} helper={gp.assumedGpPctOfTotal > 50 ? 'Majority on dangerous default' : 'Majority verified'} />
                    <MetricCard label="Finance Review" value={String(gp.dealsNeedingReview)} helper="Deals needing cost validation" />
                  </div>
                  {gp.dangerousDefaultCount > 0 && (
                    <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-semibold">⚠ Dangerous Default: </span>{gp.defaultWarningMessage}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 3. Pipeline Position */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TableProperties className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Pipeline Position</p>
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">{data.opportunities.length} opportunities</Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">Materializing includes high-probability deals · Closed Won shown separately</span>
                </div>
                <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Weighted Pipeline" value={fmt(weightedPipeline)} helper="Sum of ACV × probability" />
                  <MetricCard label="Materializing 75%+" value={fmt(materializing)} helper="Shortlisted + Contract Negotiation + Closed Won" />
                  <MetricCard label="Opportunity Count" value={String(data.opportunities.length)} helper="Active pipeline deals" />
                  <MetricCard label="Phasing Revenue" value={fmt(phasingRevenue)} helper={`${data.monthlyPhasing.length} monthly rows`} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {topDeals.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top 5 Weighted Deals</p>
                      <div className="space-y-1">
                        {topDeals.map((d, i) => (
                          <div key={d.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                            <span className="truncate font-medium">{i + 1}. {d.customerName}</span>
                            <span className="whitespace-nowrap font-mono text-blue-700">{fmt(d.weightedTotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {stageDistribution.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stage Distribution</p>
                      <div className="space-y-1">
                        {stageDistribution.map(({ stage, count, weighted }) => (
                          <div key={stage} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                            <span><Badge variant="outline" className="text-[10px]">{stage}</Badge> <span className="text-muted-foreground">×{count}</span></span>
                            <span className="font-mono">{fmt(weighted)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 4. Capacity Position */}
            {capRisk && (
              <Card className={`shadow-none ${capRisk.constrained + capRisk.overcommitted > 0 ? 'border-orange-200' : 'border-emerald-200'}`}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-semibold">Capacity Position</p>
                    {capRisk.constrained + capRisk.overcommitted > 0 && (
                      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 text-[10px]">
                        {capRisk.constrained + capRisk.overcommitted} warehouses at risk
                      </Badge>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">Capacity risk from warehouse snapshot · Thresholds from Assumption Registry</span>
                  </div>
                  <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <MetricCard label="Total Sellable" value={fmt(capRisk.totalSellable)} helper="Sum of sellable capacity" />
                    <MetricCard label="Total Committed" value={fmt(capRisk.totalCommitted)} helper="Sum of committed capacity" />
                    <MetricCard label="Remaining" value={fmt(capRisk.totalRemaining)} helper="Sellable − Committed" />
                    <MetricCard label="Constrained" value={String(capRisk.constrained)} helper="Warehouses with shortfall" />
                    <MetricCard label="Overcommitted" value={String(capRisk.overcommitted)} helper="Committed > sellable" />
                  </div>
                  {capRisk.warehouses.filter(w => w.riskStatus !== 'available').slice(0, 3).length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top Warehouse Risks</p>
                      <div className="space-y-1">
                        {capRisk.warehouses.filter(w => w.riskStatus !== 'available').slice(0, 3).map(w => (
                          <div key={w.warehouseLabel} className="flex items-center justify-between gap-2 rounded border border-orange-100 bg-orange-50/20 px-2 py-1 text-xs">
                            <span className="font-medium">{w.warehouseLabel}</span>
                            <span className="text-muted-foreground">{w.riskReason}</span>
                            <Badge variant="outline" className={`text-[10px] ${
                              w.riskStatus === 'overcommitted' ? 'border-red-200 bg-red-50 text-red-700' :
                              w.riskStatus === 'constrained' ? 'border-orange-200 bg-orange-50 text-orange-700' :
                              'border-amber-200 bg-amber-50 text-amber-700'
                            }`}>{w.riskStatus.replace('_', ' ')}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 5. Source Confidence */}
            {data.kpiRegistry.length > 0 && (
              <Card className="shadow-none">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4 text-violet-700" />
                    <p className="text-sm font-semibold">Source Confidence</p>
                    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">{data.kpiRegistry.length} KPIs registered</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="T2 Formula Verified" value={String(kpiTiers.t2)} helper="Formula-native calculations" />
                    <MetricCard label="T3 Snapshot / Governance" value={String(kpiTiers.t3)} helper="Verified snapshots & governance inputs" />
                    <MetricCard label="T4 Assumptions" value={String(kpiTiers.t4)} helper="Unverified assumptions" />
                    <MetricCard label="T5 Dangerous Defaults" value={String(kpiTiers.t5)} helper="Must be replaced with verified data" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 6. Leadership Actions */}
            {data.leadershipActions.length > 0 && (
              <Card className="shadow-none">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-semibold">Leadership Actions</p>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-[10px]">{data.leadershipActions.length} items</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">Read-only · No workflow enforcement</span>
                  </div>
                  <div className="space-y-1">
                    {[...data.leadershipActions]
                      .sort((a: any, b: any) => {
                        const sev = { critical: 0, high: 1, medium: 2, low: 3 };
                        return (sev[(a.severity || 'low') as keyof typeof sev] ?? 4) - (sev[(b.severity || 'low') as keyof typeof sev] ?? 4);
                      })
                      .slice(0, 8)
                      .map((action: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                          <Badge variant="outline" className={`text-[10px] ${
                            action.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' :
                            action.severity === 'high' ? 'border-orange-200 bg-orange-50 text-orange-700' :
                            'border-slate-200 bg-slate-50 text-slate-500'
                          }`}>{action.severity || 'medium'}</Badge>
                          <span className="font-medium truncate flex-1">{action.title || action.action_title || action.actionTitle || '--'}</span>
                          <span className="text-muted-foreground truncate max-w-48">{action.owner || action.action_owner || '--'}</span>
                          <Badge variant="outline" className="text-[10px]">{action.status || action.action_status || 'open'}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ═══ Detailed Technical Sections (existing) ═══ */}

        {!loading && !error && data.dashboardMetrics.length === 0 ? (
          <EmptySourceState label="Commercial OS dashboard metrics" />
        ) : !loading && !error ? (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
              ▸ Detailed Metric Values ({data.dashboardMetrics.length} metrics)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cards.map(({ definition, metric, truth }) => (
                <MetricCard
                  key={definition.label}
                  label={definition.label}
                  value={metric ? fmt(metric.metricValue) : "--"}
                  helper={
                    truth
                      ? `${formulaStatus(truth).label}: ${formulaStatus(truth).helper}`
                      : metric
                        ? `${metric.sourceSheet || "Source"}${metric.sourceRow ? ` row ${metric.sourceRow}` : ""}`
                        : "Metric not present in batch"
                  }
                />
              ))}
            </div>
          </details>
        ) : null}

        {/* GP-001: GP Confidence Panel */}
        {!loading && !error && data.opportunities.length > 0 && (() => {
          const gp = computeGpV2Summary(data.opportunities);
          return (
            <Card className="shadow-none border-amber-200">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-foreground">GP Confidence Analysis</p>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">GP-001</Badge>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    gp.assumedGpPctOfTotal > 50
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}>
                    {gp.assumedGpPctOfTotal > 50 ? '⚠ GP is NOT fully verified' : '✓ Majority GP verified'}
                  </Badge>
                </div>

                <div className="mb-3 rounded border border-amber-100 bg-amber-50/30 px-3 py-2 text-xs text-amber-800">
                  75% cost ratio / 25% GP default may materially affect forecast. Finance review required for {gp.dealsNeedingReview} deals.
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard label="Projected GP (Weighted)" value={fmt(gp.projectedGpTotal)} helper="Sum of weighted pipeline × GP margin %" />
                  <MetricCard label="Verified GP" value={fmt(gp.projectedGpVerified)} helper={`${gp.dealsVerified} deals with actual cost basis`} />
                  <MetricCard label="Assumed GP (25% default)" value={fmt(gp.projectedGpAssumed)} helper={`${gp.dealsAssumed} deals using 75% cost / 25% GP assumption`} />
                  <MetricCard label="% Assumed" value={`${gp.assumedGpPctOfTotal}%`} helper={gp.assumedGpPctOfTotal > 50 ? 'WARNING: Majority of GP is based on dangerous default' : 'Acceptable — majority verified'} />
                  <MetricCard label="Finance Review" value={String(gp.dealsNeedingReview)} helper="Deals with gp_confidence_status = needs_finance_review" />
                </div>

                {gp.highValueAssumedDeals.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">High-Value Assumed GP Deals (&gt; 500K SAR)</p>
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-red-50/50 text-left">
                            <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                            <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Weighted Pipeline</th>
                            <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assumed GP</th>
                            <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Basis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gp.highValueAssumedDeals.map((deal, i) => (
                            <tr key={i} className="border-b bg-red-50/20 last:border-0">
                              <td className="px-2 py-1.5 font-medium">{deal.customerName}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{fmt(deal.weightedTotal)}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-semibold text-red-700">{fmt(deal.assumedGp)}</td>
                              <td className="px-2 py-1.5">
                                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">Assumed 75%</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {!loading && !error && (
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Monthly Phasing Summary</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Read-only rollup of imported monthly phasing rows. No formula changes are applied here.
                  </p>
                </div>
                {sourceBadge(registryByKey.get("monthly_phasing")?.sourceType || "formula_native")}
              </div>
              {data.monthlyPhasing.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                  No monthly phasing rows returned.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard label="Phasing Rows" value={fmt(data.monthlyPhasing.length)} helper="commercial_opportunity_monthly_phasing" />
                  <MetricCard label="Opportunities" value={fmt(phasingOpportunityCount)} helper="Distinct opportunity_id values" />
                  <MetricCard label="Month Range" value={`${fmtMonth(phasingMonths[0])} - ${fmtMonth(phasingMonths[phasingMonths.length - 1])}`} helper={`${fmt(phasingMonths.length)} monthly buckets`} />
                  <MetricCard label="Revenue Phased" value={fmt(phasingRevenue)} helper="Sum of revenue_amount" />
                  <MetricCard label="Weighted Phased" value={fmt(phasingWeighted)} helper="Sum of weighted_amount" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {truths.length > 0 && (
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-foreground">Strategic Truth - Formula Parity (P1)</p>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">FORMULA-002D</Badge>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Live app-native formulas vs imported Excel snapshot values. Rounded dashboard shorthand is expected on summary cards; calculated values remain workbook formula truth.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2">ID</th>
                      <th className="px-2 py-2">KPI</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2 text-right">Imported</th>
                      <th className="px-2 py-2 text-right">Calculated</th>
                      <th className="px-2 py-2 text-right">Delta</th>
                      <th className="px-2 py-2">Parity</th>
                      <th className="px-2 py-2">Explanation</th>
                      <th className="px-2 py-2">Classification</th>
                      <th className="px-2 py-2">Source</th>
                      <th className="px-2 py-2">Tolerance</th>
                      <th className="px-2 py-2">Rounding</th>
                      <th className="px-2 py-2">Owner</th>
                      <th className="px-2 py-2">Risk</th>
                      <th className="px-2 py-2">Truth</th>
                      <th className="px-2 py-2">Tier</th>
                      <th className="px-2 py-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truths.map((st) => {
                      const status = formulaStatus(st);
                      const registry = registryByKey.get(registryKeyForTruth(st));
                      return (
                        <tr key={st.id} className="border-b last:border-0">
                          <td className="px-2 py-2 font-mono text-xs font-bold text-blue-700">{st.id}</td>
                          <td className="px-2 py-2 font-medium">{st.label}</td>
                          <td className="px-2 py-2">
                            <Badge variant="outline" className={`${status.className} text-[10px]`}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-right font-mono">{st.imported_value !== null ? fmt(st.imported_value) : "--"}</td>
                          <td className="px-2 py-2 text-right font-mono font-semibold">{fmt(st.calculated_value)}</td>
                          <td className="px-2 py-2 text-right font-mono text-xs">
                            <span className={varianceClass(st)}>
                              {st.variance >= 0 ? "+" : ""}{fmt(st.variance)} ({st.variance_pct}%)
                            </span>
                          </td>
                          <td className="px-2 py-2">{parityBadge(st.parity_status)}</td>
                          <td className="max-w-xs px-2 py-2 text-xs text-muted-foreground">{status.helper}</td>
                          <td className="px-2 py-2 text-xs">{registry?.classification || "--"}</td>
                          <td className="px-2 py-2">{sourceBadge(registry?.sourceType || st.source_type)}</td>
                          <td className="px-2 py-2 text-xs">{registryTolerance(registry)}</td>
                          <td className="px-2 py-2 text-xs">{registry?.roundingPolicy || "--"}</td>
                          <td className="px-2 py-2 text-xs">{registry?.governanceOwner || st.governance_owner}</td>
                          <td className="px-2 py-2">
                            {registryRisk(registry, st.risk_level)}
                          </td>
                          <td className="px-2 py-2">{truthStatusBadge(registry?.truthStatus || '')}</td>
                          <td className="px-2 py-2">{confidenceTierBadge(registry?.confidenceTier || 5)}</td>
                          <td className="px-2 py-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-sm text-xs">
                                  <div className="space-y-1">
                                    <p>{registry?.formulaDetail || st.source_detail}</p>
                                    {registry?.sourceLineage ? <p className="font-mono text-[10px] text-emerald-700">{registry.sourceLineage}</p> : null}
                                    <p className="font-medium text-blue-700">{futureApiLabel(registry)}</p>
                                    {registry?.notes ? <p className="text-muted-foreground">{registry.notes}</p> : null}
                                  </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Source Truth Legend</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registry-backed source trust labels. This panel is display-only and does not change formulas or data.
                </p>
              </div>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">commercial_kpi_registry</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceTypes.map((sourceType) => (
                <TooltipProvider key={sourceType}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{sourceBadge(sourceType)}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Future API candidate: D365/LFS/Finance/etc.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.sourceRegistry.length > 0 ? data.sourceRegistry.map((source) => (
                <div key={source.id} className="rounded-md border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{source.sourceLabel}</p>
                    {sourceBadge(source.sourceType)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{source.currentIngestionMethod || "--"}</p>
                  <p className="mt-2 text-[11px] font-medium text-blue-700">
                    {source.futureApiCandidate ? `Future API candidate: ${source.systemName || source.sourceLabel}` : "Future API candidate: not registered"}
                  </p>
                </div>
              )) : (
                <div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                  No source registry rows returned.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ASSUMP-001: Assumption Registry */}
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-foreground">Assumption Registry</p>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">ASSUMP-001</Badge>
              </div>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                Read-only · Assumptions are not verified truth · Dangerous defaults may materially affect forecasts
              </Badge>
            </div>

            {/* Section 1: Commercial Assumptions */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Commercial Assumptions</p>
            {data.defaultAssumptions.length > 0 ? (
              <div className="mb-4 overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assumption</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Value</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unit</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Truth</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tier</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Owner</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Risk</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.defaultAssumptions.map((a) => (
                      <tr key={a.id} className={`border-b last:border-0 ${
                        a.riskLevel === 'critical' ? 'bg-red-50/40' :
                        a.riskLevel === 'high' ? 'bg-amber-50/30' : ''
                      }`}>
                        <td className="px-2 py-1.5 font-medium">{a.assumptionLabel}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">
                          {a.valueNumeric ? String(a.valueNumeric) : a.valueText || '--'}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{a.unit}</td>
                        <td className="px-2 py-1.5">{sourceBadge(a.sourceType)}</td>
                        <td className="px-2 py-1.5">{truthStatusBadge(a.truthStatus)}</td>
                        <td className="px-2 py-1.5">{confidenceTierBadge(a.confidenceTier)}</td>
                        <td className="px-2 py-1.5">{a.governanceOwner}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant="outline" className={`text-[10px] ${
                            a.riskLevel === 'critical' ? 'border-red-200 bg-red-50 text-red-700' :
                            a.riskLevel === 'high' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                            a.riskLevel === 'medium' ? 'border-yellow-200 bg-yellow-50 text-yellow-700' :
                            'border-zinc-200 bg-zinc-50 text-zinc-700'
                          }`}>{a.riskLevel}</Badge>
                        </td>
                        <td className="max-w-xs px-2 py-1.5 text-[11px] text-muted-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-sm text-xs">
                                <div className="space-y-1">
                                  <p>{a.notes}</p>
                                  {a.sourceLineage ? <p className="font-mono text-[10px] text-emerald-700">{a.sourceLineage}</p> : null}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                No assumption rows returned. Run ASSUMP-001 migration.
              </div>
            )}

            {/* Section 2: Stage Probability Doctrine */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Stage Probability Doctrine</p>
            {data.stageProbabilities.length > 0 ? (
              <div className="mb-4 overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Probability</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Truth</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Owner</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stageProbabilities.map((sp) => (
                      <tr key={sp.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5 font-medium">{sp.stageName}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">{sp.probabilityPct}%</td>
                        <td className="px-2 py-1.5">{truthStatusBadge(sp.truthStatus)}</td>
                        <td className="px-2 py-1.5">{sp.governanceOwner}</td>
                        <td className="max-w-xs px-2 py-1.5 text-[11px] text-muted-foreground">{sp.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                No stage probability rows returned. Run ASSUMP-001 migration.
              </div>
            )}

            {/* Section 3: Dashboard Threshold Doctrine */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Dashboard Threshold Doctrine</p>
            {data.dashboardThresholds.length > 0 ? (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Threshold</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Value</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unit</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Owner</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dashboardThresholds.map((dt) => (
                      <tr key={dt.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5 font-medium">{dt.thresholdLabel}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">{dt.thresholdValue}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{dt.unit}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant="outline" className="text-[10px]">{dt.category}</Badge>
                        </td>
                        <td className="px-2 py-1.5">{dt.governanceOwner}</td>
                        <td className="max-w-xs px-2 py-1.5 text-[11px] text-muted-foreground">{dt.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                No threshold rows returned. Run ASSUMP-001 migration.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Commercial OS Modules</p>
                  <p className="mt-1 text-xs text-muted-foreground">Live Supabase reads only. No import execution, CRM sync, gates, or enforcement.</p>
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Batch {batchId}</Badge>
              </div>
              <div className="grid gap-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Link key={section.href} href={section.href}>
                      <div className="flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3 transition-colors hover:bg-muted/50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{section.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{section.detail}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-semibold text-foreground">Live Tables Read</p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Opportunities</span><span className="font-medium">{data.opportunities.length}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Capacity snapshots</span><span className="font-medium">{data.capacitySnapshots.length}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Forecast rows</span><span className="font-medium">{data.forecasts.length}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Revenue actuals</span><span className="font-medium">{data.revenueActuals.length}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Monthly phasing</span><span className="font-medium">{data.monthlyPhasing.length}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Actions</span><span className="font-medium">{data.leadershipActions.length}</span></div>
              </div>
              {data.dashboardMetrics[0] && (
                <div className="mt-4 border-t pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">First source</p>
                  <SourceCell {...data.dashboardMetrics[0]} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CommercialOsShell>
  );
}
