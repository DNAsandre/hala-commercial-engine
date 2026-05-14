import { useMemo } from "react";
import {
  AlertTriangle, Calculator, ChevronRight, DollarSign, FileSpreadsheet,
  LineChart, Scale, Target, TrendingDown, TrendingUp,
} from "lucide-react";
import {
  CommercialOsShell,
  DataTable,
  EmptySourceState,
  ErrorState,
  LoadingState,
  MetricCard,
  SourceCell,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import { computeForecastComponents, computeBudgetVsActual, type ForecastComponents } from "@/lib/commercial-os-data";

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);
}
function fmtMonth(v: string) {
  if (!v) return "--";
  const d = new Date(v.length === 7 ? `${v}-01T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d);
}

function parityBadge(status: ForecastComponents['parityStatus']) {
  const m: Record<string, { label: string; cls: string }> = {
    match: { label: "Match", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    rounded_difference: { label: "Rounded Difference", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    formula_drift: { label: "Formula Drift", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    missing_input: { label: "Missing Input", cls: "border-red-200 bg-red-50 text-red-700" },
    calculated: { label: "Calculated", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  };
  const c = m[status] || m.missing_input!;
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

function confidenceBadge(status: ForecastComponents['confidenceStatus']) {
  const m: Record<string, { label: string; cls: string }> = {
    verified: { label: "Verified", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    calculated: { label: "Calculated", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    partial: { label: "Partial", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    missing: { label: "Missing", cls: "border-red-200 bg-red-50 text-red-700" },
  };
  const c = m[status] || m.missing!;
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

function FormulaRow({ label, value, note, indent }: { label: string; value: number; note?: string; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 text-xs ${indent ? 'pl-6' : ''}`}>
      <div className="flex items-center gap-1">
        {indent && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <span className={indent ? 'text-muted-foreground' : 'font-medium'}>{label}</span>
        {note && <span className="text-[10px] text-muted-foreground">({note})</span>}
      </div>
      <span className={`font-mono ${value < 0 ? 'text-red-700' : ''}`}>{fmt(value)}</span>
    </div>
  );
}

export default function CommercialOsForecast() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = data.forecasts;

  const fc = useMemo(() => {
    if (loading || error) return null;
    return computeForecastComponents(data);
  }, [data, loading, error]);

  const bva = useMemo(() => {
    if (loading || error) return null;
    return computeBudgetVsActual(data);
  }, [data, loading, error]);

  return (
    <CommercialOsShell
      title="Forecast Engine"
      description={`Formula-native forecast for import batch ${batchId}. Read-only — no writes.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="forecast engine" /> : error ? <ErrorState error={error} /> : null}

        {!loading && !error && fc && (
          <>
            {/* Labels */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">FCST-001</Badge>
              <Badge variant="outline" className="text-[10px]">Formula-native forecast</Badge>
              {confidenceBadge(fc.confidenceStatus)}
              <span className="ml-auto text-[10px] text-muted-foreground">Read-only · No writes · No CRM</span>
            </div>

            {/* Forecast Total Breakdown */}
            <Card className="shadow-none border-blue-200">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Forecast Total Breakdown</p>
                  <Badge variant="outline" className="text-[10px]">Formula-native</Badge>
                </div>
                <div className="rounded border divide-y">
                  <FormulaRow label="P&L Baseline Actuals" value={fc.baselineActuals} note="Imported historical source values" />
                  <FormulaRow label="Organic Known Growth" value={fc.organicGrowth} note="Forecast rows with organic category" indent />
                  <FormulaRow label="Shortlisted CY Contribution" value={fc.shortlistedCy} note="Pipeline contribution from phasing rows" indent />
                  <FormulaRow label="Contract Negotiation CY" value={fc.contractNegotiationCy} note="Pipeline contribution from phasing rows" indent />
                  <FormulaRow label="Closed Won CY Contribution" value={fc.closedWonCy} note={`${(data.closedWonDeals || []).length} deals — not double-counted`} indent />
                  <div className="flex items-center justify-between gap-2 py-2 px-0 text-xs bg-blue-50/50 font-semibold">
                    <span className="flex items-center gap-1 pl-1">
                      <TrendingUp className="h-3 w-3 text-blue-700" />
                      Forecast Total
                    </span>
                    <span className="font-mono pr-1">{fmt(fc.forecastTotal)}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span>• Actuals are imported historical source values</span>
                  <span>• Pipeline contribution comes from phasing rows</span>
                  <span>• Closed Won not double-counted</span>
                </div>
              </CardContent>
            </Card>

            {/* Revenue + GP Position */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <MetricCard label="Forecast Total" value={fmt(fc.forecastTotal)} helper="Formula-native" />
              <MetricCard label="Budget Target" value={fmt(fc.budgetTarget)} helper="Finance budget is governance input" />
              <MetricCard label="Revenue Gap" value={fmt(fc.revenueGap)} helper={`Forecast − Budget = ${fc.revenueGap >= 0 ? 'Ahead' : 'Behind'}`} />
              <MetricCard label="GP Forecast" value={fmt(fc.gpForecast)} helper="From dashboard metrics" />
              <MetricCard label="GP Budget" value={fmt(fc.gpBudget)} helper="Finance governance input" />
              <MetricCard label="GP Gap" value={fmt(fc.gpGap)} helper={`GP Forecast − GP Budget = ${fc.gpGap >= 0 ? 'Ahead' : 'Behind'}`} />
            </div>

            {/* Revenue Gap Formula */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold">Revenue Gap Formula</p>
                </div>
                <div className="rounded border bg-muted/30 p-3 text-xs font-mono">
                  <span className="text-blue-700">Revenue Gap</span> = <span className="text-emerald-700">Forecast Total ({fmt(fc.forecastTotal)})</span> − <span className="text-amber-700">Budget Target ({fmt(fc.budgetTarget)})</span> = <span className={fc.revenueGap >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{fmt(fc.revenueGap)}</span>
                </div>
                <div className="mt-2 rounded border bg-muted/30 p-3 text-xs font-mono">
                  <span className="text-blue-700">GP Gap</span> = <span className="text-emerald-700">GP Forecast ({fmt(fc.gpForecast)})</span> − <span className="text-amber-700">GP Budget ({fmt(fc.gpBudget)})</span> = <span className={fc.gpGap >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{fmt(fc.gpGap)}</span>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Finance budget is governance input — not a calculated value. Actuals are imported historical source values.</p>
              </CardContent>
            </Card>

            {/* Stage Contribution */}
            {fc.stageBreakdown.length > 0 && (
              <Card className="shadow-none">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-semibold">Contribution by Stage</p>
                    <Badge variant="outline" className="text-[10px]">{fc.stageBreakdown.length} stages</Badge>
                  </div>
                  <DataTable columns={["Stage", "Deals", "ACV", "Weighted", "CY Revenue"]}>
                    {fc.stageBreakdown.map(s => (
                      <tr key={s.stage} className="text-xs">
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.stage}</Badge></td>
                        <td className="px-3 py-2 font-mono text-right">{s.dealCount}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(s.acv)}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(s.weighted)}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(s.cyRevenue)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </CardContent>
              </Card>
            )}

            {/* Reconciliation */}
            <Card className="shadow-none border-amber-200">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold">Forecast Reconciliation</p>
                  {parityBadge(fc.parityStatus)}
                </div>
                <div className="rounded border divide-y text-xs">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Imported Snapshot</span>
                    <span className="font-mono">{fmt(fc.importedSnapshotValue)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Calculated Value</span>
                    <span className="font-mono">{fmt(fc.calculatedValue)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Delta</span>
                    <span className={`font-mono font-bold ${fc.variance === 0 ? '' : fc.variance > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(fc.variance)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Variance %</span>
                    <span className={`font-mono ${Math.abs(fc.variancePct) < 2 ? 'text-emerald-700' : 'text-amber-700'}`}>{fc.variancePct.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Status</span>
                    {parityBadge(fc.parityStatus)}
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Reconciliation compares the formula-native calculated forecast against the imported Excel snapshot value.
                </p>
              </CardContent>
            </Card>

            {/* Source Notes */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-semibold">Formula Source Notes</p>
                </div>
                <div className="space-y-1">
                  {fc.sourceNotes.map((note, i) => (
                    <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-blue-400 shrink-0">•</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Raw Forecast Rows */}

            {/* ═══ FIN-002: Budget vs Actual Intelligence ═══ */}
            {bva && bva.monthRows.length > 0 && (
              <>
                {/* BvA Labels */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">FIN-002</Badge>
                  <Badge variant="outline" className="text-[10px]">Budget vs Actual</Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">Read-only · No writes · No CRM</span>
                </div>

                {/* 1. YTD + Full-Year Summary Cards */}
                <Card className="shadow-none border-indigo-200">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-indigo-700" />
                      <p className="text-sm font-semibold">Budget vs Actual Summary</p>
                      <Badge variant="outline" className={`text-[10px] ${bva.ytdDelta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        {bva.ytdDelta >= 0 ? '▲ YTD Ahead' : '▼ YTD Behind'}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <MetricCard label="YTD Actual" value={fmt(bva.ytdActual)} helper={`${bva.ytdMonths} months with actuals`} />
                      <MetricCard label="YTD Budget" value={fmt(bva.ytdBudget)} helper="Finance governance input" />
                      <MetricCard label="YTD Variance" value={`${bva.ytdDelta >= 0 ? '+' : ''}${fmt(bva.ytdDelta)}`} helper={bva.ytdDelta >= 0 ? 'Favorable' : 'Unfavorable'} />
                      <MetricCard label="Full-Year Forecast" value={fmt(bva.fullYearForecast)} helper="Formula-native where available" />
                      <MetricCard label="Full-Year Budget" value={fmt(bva.fullYearBudget)} helper="Finance governance input" />
                      <MetricCard label="Full-Year Gap" value={`${bva.fullYearGap >= 0 ? '+' : ''}${fmt(bva.fullYearGap)}`} helper={bva.fullYearGap >= 0 ? 'Ahead of plan' : 'Behind plan'} />
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Monthly Variance Table */}
                <Card className="shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-700" />
                      <p className="text-sm font-semibold">Monthly Revenue Variance</p>
                      <Badge variant="outline" className="text-[10px]">{bva.monthRows.length} months</Badge>
                    </div>
                    <DataTable columns={["Month", "Actual", "Budget", "Actual vs Budget", "Forecast", "Forecast vs Budget", "Status"]}>
                      {bva.monthRows.map(r => {
                        const hasActual = r.actualAvailable;
                        const hasBudget = r.budgetAvailable;
                        const hasForecast = r.forecastAvailable;
                        return (
                          <tr key={r.month} className="text-xs">
                            <td className="px-3 py-2 font-medium">{fmtMonth(r.month)}</td>
                            <td className="px-3 py-2 font-mono text-right">{hasActual ? fmt(r.actual) : <span className="text-muted-foreground">--</span>}</td>
                            <td className="px-3 py-2 font-mono text-right">{hasBudget ? fmt(r.budget) : <span className="text-muted-foreground">--</span>}</td>
                            <td className={`px-3 py-2 font-mono text-right font-semibold ${hasActual && hasBudget ? (r.deltaActualVsBudget >= 0 ? 'text-emerald-700' : 'text-red-700') : ''}`}>
                              {hasActual && hasBudget ? `${r.deltaActualVsBudget >= 0 ? '+' : ''}${fmt(r.deltaActualVsBudget)}` : <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-right">{hasForecast ? fmt(r.forecast) : <span className="text-muted-foreground">--</span>}</td>
                            <td className={`px-3 py-2 font-mono text-right ${hasForecast && hasBudget ? (r.deltaForecastVsBudget >= 0 ? 'text-emerald-700' : 'text-red-700') : ''}`}>
                              {hasForecast && hasBudget ? `${r.deltaForecastVsBudget >= 0 ? '+' : ''}${fmt(r.deltaForecastVsBudget)}` : <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="px-3 py-2">
                              {hasActual && hasBudget ? (
                                <Badge variant="outline" className={`text-[10px] ${r.deltaActualVsBudget >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                  {r.deltaActualVsBudget >= 0 ? 'Favorable' : 'Unfavorable'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-zinc-200 bg-zinc-50 text-zinc-500">Forecast only</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="text-xs font-semibold bg-muted/30">
                        <td className="px-3 py-2">TOTAL</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(bva.monthRows.reduce((s, r) => s + r.actual, 0))}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(bva.fullYearBudget)}</td>
                        <td className={`px-3 py-2 font-mono text-right ${bva.ytdDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{bva.ytdDelta >= 0 ? '+' : ''}{fmt(bva.ytdDelta)}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(bva.fullYearForecast)}</td>
                        <td className={`px-3 py-2 font-mono text-right ${bva.fullYearGap >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{bva.fullYearGap >= 0 ? '+' : ''}{fmt(bva.fullYearGap)}</td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </DataTable>
                  </CardContent>
                </Card>

                {/* 3. GP Budget vs Forecast */}
                {bva.gpAvailable && (
                  <Card className="shadow-none">
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-amber-600" />
                        <p className="text-sm font-semibold">GP Budget vs Forecast</p>
                        <Badge variant="outline" className={`text-[10px] ${bva.gpGap >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                          {bva.gpGap >= 0 ? '▲ Ahead' : '▼ Behind'}
                        </Badge>
                      </div>
                      <div className="rounded border bg-muted/30 p-3 text-xs font-mono">
                        <span className="text-blue-700">GP Gap</span> = <span className="text-emerald-700">GP Forecast ({fmt(bva.gpForecast)})</span> − <span className="text-amber-700">GP Budget ({fmt(bva.gpBudget)})</span> = <span className={bva.gpGap >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{bva.gpGap >= 0 ? '+' : ''}{fmt(bva.gpGap)}</span>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">GP confidence depends on cost basis · 75% cost ratio is assumption until Finance validates</p>
                    </CardContent>
                  </Card>
                )}

                {/* 4. Source Truth Labels */}
                <Card className="shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                      <p className="text-sm font-semibold">Budget vs Actual Source Truth</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-indigo-400 shrink-0">•</span><span>Budget is Finance Governance Input</span></div>
                      <div className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-indigo-400 shrink-0">•</span><span>Actuals are historical imported values</span></div>
                      <div className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-indigo-400 shrink-0">•</span><span>Forecast is formula-native where available</span></div>
                      <div className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-indigo-400 shrink-0">•</span><span>No missing month is assumed unless explicitly present in source</span></div>
                      {bva.sourceNotes.map((n, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-blue-400 shrink-0">•</span><span>{n}</span></div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Raw Forecast Rows */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Raw Forecast Rows</p>
                  <Badge variant="outline" className="text-[10px]">{rows.length} rows</Badge>
                </div>
                {rows.length === 0 ? (
                  <EmptySourceState label="Forecast rows" />
                ) : (
                  <DataTable
                    columns={["Category", "Line Item", "Probability", "Month", "Amount", "Budget Amount", "Delta Amount", "Metric Type", "Source"]}
                  >
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-3"><Badge variant="outline">{row.category || "--"}</Badge></td>
                        <td className="px-3 py-3 font-medium">{row.lineItem || "--"}</td>
                        <td className="px-3 py-3">{row.probabilityPct !== null ? `${row.probabilityPct}%` : "--"}</td>
                        <td className="px-3 py-3">{row.month || "--"}</td>
                        <td className="px-3 py-3">{fmt(row.amount)}</td>
                        <td className="px-3 py-3">{fmt(row.budgetAmount)}</td>
                        <td className={row.deltaAmount < 0 ? "px-3 py-3 text-red-700" : "px-3 py-3"}>{fmt(row.deltaAmount)}</td>
                        <td className="px-3 py-3">{row.metricType || "--"}</td>
                        <td className="px-3 py-3"><SourceCell {...row} /></td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
