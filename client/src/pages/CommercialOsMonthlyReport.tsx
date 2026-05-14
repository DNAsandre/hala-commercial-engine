import { AlertTriangle, BarChart3, Boxes, Calculator, ClipboardList, Database, FileText, Info, Radio, Shield } from "lucide-react";
import {
  CommercialOsShell,
  ErrorState,
  LoadingState,
  MetricCard,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import {
  computeGpV2Summary,
  computeCapacityRiskSummary,
  computeForecastComponents,
  computeSignalSummary,
  generateSignalsFromData,
  computeEscalationSummary,
  generateEscalationsFromData,
} from "@/lib/commercial-os-data";

function fmt(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function fmtSar(value: number) {
  if (!value) return "0 SAR";
  return fmt(value) + " SAR";
}

function SectionHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b pb-2">
      <Icon className="h-4 w-4 text-indigo-600" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {badge && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">{badge}</Badge>}
    </div>
  );
}

function ReportRow({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-dashed border-slate-100 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-semibold ${warn ? 'text-red-700' : 'text-foreground'}`}>{value}</span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function metricMatches(key: string, label: string, aliases: string[]): boolean {
  const k = key.toLowerCase().replace(/[\s-]/g, "_");
  const l = label.toLowerCase().replace(/[\s-]/g, "_");
  return aliases.some((a) => k.includes(a) || l.includes(a));
}

export default function CommercialOsMonthlyReport() {
  const { data, loading, error, batchId } = useCommercialOsData();

  const mv = (key: string) => {
    const m = data.dashboardMetrics.find((x) => metricMatches(x.metricKey, x.metricLabel, [key]));
    return m?.metricValue ?? 0;
  };

  const gp = !loading && !error && data.opportunities.length > 0 ? computeGpV2Summary(data.opportunities) : null;
  const capRisk = !loading && !error && data.capacitySnapshots.length > 0
    ? computeCapacityRiskSummary(data.capacitySnapshots, data.dashboardThresholds) : null;
  const fc = !loading && !error ? computeForecastComponents(data) : null;

  const forecastTotal = mv('forecast_total') || mv('fy26_revenue_forecast') || fc?.forecastTotal || 0;
  const budgetTarget = mv('budget_target') || mv('fy26_revenue_budget') || fc?.budgetTarget || 0;
  const revenueGap = mv('fy26_revenue_gap') || mv('revenue_gap') || (forecastTotal && budgetTarget ? forecastTotal - budgetTarget : 0);
  const gpGap = mv('fy26_gp_gap') || mv('gp_gap') || fc?.gpGap || 0;
  const weightedPipeline = mv('weighted_pipeline') || mv('pipeline_weighted');
  const materializing = mv('materializing_75plus') || mv('materializing_75_plus') || mv('materializing_75');

  const stageMap = new Map<string, { count: number; weighted: number }>();
  for (const o of data.opportunities) {
    const s = o.stage || 'Unknown';
    const prev = stageMap.get(s) || { count: 0, weighted: 0 };
    stageMap.set(s, { count: prev.count + 1, weighted: prev.weighted + o.weightedTotal });
  }
  const stageDistribution = Array.from(stageMap.entries()).map(([stage, v]) => ({ stage, ...v })).sort((a, b) => b.weighted - a.weighted);
  const topDeals = [...data.opportunities].sort((a, b) => b.weightedTotal - a.weightedTotal).slice(0, 5);
  const closedWonCount = data.closedWonDeals?.length || 0;

  // Revenue actuals
  const revenueByCustomer = new Map<string, number>();
  let ytdTotal = 0;
  for (const r of data.revenueActuals) {
    ytdTotal += r.amount;
    revenueByCustomer.set(r.customerName, (revenueByCustomer.get(r.customerName) || 0) + r.amount);
  }
  const topRevenueCustomers = Array.from(revenueByCustomer.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // KPI confidence
  const kpiTiers = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 };
  for (const k of data.kpiRegistry) {
    if (k.confidenceTier === 1) kpiTiers.t1++;
    else if (k.confidenceTier === 2) kpiTiers.t2++;
    else if (k.confidenceTier === 3) kpiTiers.t3++;
    else if (k.confidenceTier === 4) kpiTiers.t4++;
    else if (k.confidenceTier === 5) kpiTiers.t5++;
  }

  // Signals + Escalations
  const gpTotalDeals = gp ? (gp.dealsVerified + gp.dealsAssumed + gp.dealsNoRevenue) : 0;
  const signalData = generateSignalsFromData(capRisk, gp ? {
    dangerousDefaultCount: gp.dangerousDefaultCount, totalDeals: gpTotalDeals, projectedGpAssumed: gp.projectedGpAssumed,
  } : null);
  const signalSummary = computeSignalSummary(signalData);
  const escalationData = generateEscalationsFromData(capRisk, gp ? {
    dangerousDefaultCount: gp.dangerousDefaultCount, totalDeals: gpTotalDeals, projectedGpAssumed: gp.projectedGpAssumed,
  } : null);
  const escalationSummary = computeEscalationSummary(escalationData);

  const now = new Date();
  const reportMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <CommercialOsShell
      title="Monthly Commercial Report"
      description="Read-only internal leadership report generated from Commercial OS data."
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="report data" /> : error ? <ErrorState error={error} /> : null}

        {!loading && !error && (
          <>
            {/* Report Header */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-semibold text-foreground">Commercial Report — {reportMonth}</p>
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">RPT-001</Badge>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                    Read-only · Internal · Batch {batchId}
                  </Badge>
                </div>
                <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-3 mb-3">
                  <span className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Read-only internal report
                  </span>
                  <span className="text-[10px] text-amber-700">• Not for external distribution</span>
                  <span className="text-[10px] text-amber-700">• Generated from live Commercial OS data</span>
                  <span className="text-[10px] text-amber-700">• No CRM or workflow</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <MetricCard label="Forecast Total" value={fmtSar(forecastTotal)} helper="FY26 projection" />
                  <MetricCard label="Budget Target" value={fmtSar(budgetTarget)} helper="Finance governance input" />
                  <MetricCard label="Revenue Gap" value={fmtSar(revenueGap)} helper={revenueGap < 0 ? 'Behind target' : 'On/ahead'} />
                  <MetricCard label="GP Gap" value={fmtSar(gpGap)} helper={gpGap < 0 ? 'Below GP budget' : 'On track'} />
                </div>
              </CardContent>
            </Card>

            {/* Section 1: Executive Summary */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={BarChart3} title="1. Executive Summary" badge="Source: Dashboard Metrics" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Forecast Total" value={fmtSar(forecastTotal)} sub="Imported snapshot" />
                    <ReportRow label="Budget Target" value={fmtSar(budgetTarget)} sub="Finance governance" />
                    <ReportRow label="Revenue Gap" value={fmtSar(revenueGap)} warn={revenueGap < 0} sub={revenueGap < 0 ? 'Shortfall' : 'Surplus'} />
                    <ReportRow label="GP Gap" value={fmtSar(gpGap)} warn={gpGap < 0} />
                    <ReportRow label="Weighted Pipeline" value={fmtSar(weightedPipeline)} />
                    <ReportRow label="Materializing (75%+)" value={fmtSar(materializing)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Source Confidence</p>
                    <ReportRow label="Tier 1 (Verified)" value={String(kpiTiers.t1)} />
                    <ReportRow label="Tier 2 (Formula)" value={String(kpiTiers.t2)} />
                    <ReportRow label="Tier 3 (Snapshot)" value={String(kpiTiers.t3)} />
                    <ReportRow label="Tier 4 (Assumption)" value={String(kpiTiers.t4)} />
                    <ReportRow label="Tier 5 (Dangerous)" value={String(kpiTiers.t5)} warn={kpiTiers.t5 > 0} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Pipeline */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={ClipboardList} title="2. Pipeline Summary" badge={`${data.opportunities.length} deals`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Total Deals" value={String(data.opportunities.length)} />
                    <ReportRow label="Weighted Pipeline" value={fmtSar(weightedPipeline)} />
                    <ReportRow label="Materializing 75%+" value={fmtSar(materializing)} />
                    <ReportRow label="Closed Won" value={String(closedWonCount)} />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mt-3 mb-1">Stage Mix</p>
                    {stageDistribution.map(s => (
                      <ReportRow key={s.stage} label={`${s.stage} (×${s.count})`} value={fmtSar(s.weighted)} />
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Top 5 Weighted Deals</p>
                    {topDeals.map((d, i) => (
                      <ReportRow key={d.id} label={`${i + 1}. ${d.customerName}`} value={fmtSar(d.weightedTotal)} sub={d.stage} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Capacity */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Boxes} title="3. Capacity Summary" badge={capRisk ? `${capRisk.constrained + capRisk.overcommitted} at risk` : undefined} />
                {capRisk ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <ReportRow label="Total Sellable" value={fmt(capRisk.totalSellable) + ' pallets'} />
                      <ReportRow label="Total Committed" value={fmt(capRisk.totalCommitted) + ' pallets'} />
                      <ReportRow label="Remaining" value={fmt(capRisk.totalRemaining) + ' pallets'} />
                      <ReportRow label="Avg Utilization" value={(capRisk.totalSellable > 0 ? ((capRisk.totalCommitted / capRisk.totalSellable) * 100).toFixed(1) : '0') + '%'} warn={capRisk.totalSellable > 0 && (capRisk.totalCommitted / capRisk.totalSellable) > 0.85} />
                      <ReportRow label="Constrained" value={String(capRisk.constrained)} warn={capRisk.constrained > 0} />
                      <ReportRow label="Overcommitted" value={String(capRisk.overcommitted)} warn={capRisk.overcommitted > 0} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Top Warehouse Risks</p>
                      {capRisk.warehouses.filter(w => w.riskStatus !== 'available').slice(0, 5).map(w => (
                        <ReportRow
                          key={w.warehouseLabel}
                          label={w.warehouseLabel}
                          value={w.riskStatus}
                          sub={`Shortfall: ${fmt(w.shortfallCapacity)} pallets`}
                          warn={w.riskStatus === 'overcommitted'}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No capacity data available.</p>
                )}
              </CardContent>
            </Card>

            {/* Section 4: Revenue Actuals */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Database} title="4. Revenue Actuals" badge={`${data.revenueActuals.length} records`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Total Revenue Records" value={String(data.revenueActuals.length)} />
                    <ReportRow label="YTD Revenue Sum" value={fmtSar(ytdTotal)} />
                    <ReportRow label="Unique Customers" value={String(revenueByCustomer.size)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Top 5 Revenue Customers</p>
                    {topRevenueCustomers.map(([name, amount], i) => (
                      <ReportRow key={name} label={`${i + 1}. ${name}`} value={fmtSar(amount)} />
                    ))}
                    {topRevenueCustomers.length === 0 && (
                      <p className="text-xs text-muted-foreground">No revenue actuals loaded.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: GP Summary */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Calculator} title="5. GP / Profit Summary" badge={gp ? `${gp.assumedGpPctOfTotal}% assumed` : undefined} />
                {gp ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <ReportRow label="Total Deals" value={String(gpTotalDeals)} />
                      <ReportRow label="Projected GP (Weighted)" value={fmtSar(gp.projectedGpTotal)} />
                      <ReportRow label="Verified GP" value={fmtSar(gp.projectedGpVerified)} sub={`${gp.dealsVerified} deals`} />
                      <ReportRow label="Assumed GP" value={fmtSar(gp.projectedGpAssumed)} warn={gp.projectedGpAssumed > 0} sub="Using 25% default" />
                    </div>
                    <div>
                      <ReportRow label="Dangerous Default Count" value={String(gp.dangerousDefaultCount)} warn={gp.dangerousDefaultCount > 0} sub="Deals using 25% assumption" />
                      <ReportRow label="% Assumed" value={gp.assumedGpPctOfTotal + '%'} warn={gp.assumedGpPctOfTotal > 50} />
                      <ReportRow label="Finance Review Required" value={gp.assumedGpPctOfTotal > 50 ? 'YES' : 'No'} warn={gp.assumedGpPctOfTotal > 50} sub="Cost data not verified" />
                      <ReportRow label="Deals Needing Review" value={String(gp.dealsNeedingReview)} warn={gp.dealsNeedingReview > 0} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No GP data available.</p>
                )}
              </CardContent>
            </Card>

            {/* Section 6: Assumptions */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={AlertTriangle} title="6. Assumptions & Dangerous Defaults" badge={`${data.defaultAssumptions.length} assumptions`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    {data.defaultAssumptions.length > 0 ? data.defaultAssumptions.map((a) => (
                      <ReportRow
                        key={a.id || a.assumptionKey}
                        label={a.assumptionLabel || a.assumptionKey || 'Unknown'}
                        value={a.valueNumeric ? `${a.valueNumeric}${a.unit ? ' ' + a.unit : ''}` : (a.valueText || '--')}
                        sub={a.sourceType || 'assumption'}
                        warn={a.riskLevel === 'dangerous' || a.confidenceTier >= 4}
                      />
                    )) : (
                      <>
                        <ReportRow label="Default GP Margin" value="25%" sub="Dangerous default — not verified by Finance" warn />
                        <ReportRow label="Default Cost Ratio" value="75%" sub="Dangerous default — assumed across all deals" warn />
                        <ReportRow label="Default Pallet Rate" value="48 SAR" sub="Assumption — used for capacity monetization" />
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Threshold Config</p>
                    {data.dashboardThresholds.slice(0, 6).map((t) => (
                      <ReportRow
                        key={t.id || t.thresholdKey}
                        label={t.thresholdLabel || t.thresholdKey || 'Unknown'}
                        value={String(t.thresholdValue ?? '--')}
                        sub={t.sourceType || ''}
                      />
                    ))}
                    {data.dashboardThresholds.length === 0 && (
                      <p className="text-xs text-muted-foreground">No thresholds configured.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 7: Ops Signals + Escalations */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Radio} title="7. Operations Signals & Escalations" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Operations Signals (OPS-001)</p>
                    <ReportRow label="Total Signals" value={String(signalSummary.total)} />
                    <ReportRow label="Critical" value={String(signalSummary.critical)} warn={signalSummary.critical > 0} />
                    <ReportRow label="High" value={String(signalSummary.high)} warn={signalSummary.high > 0} />
                    <ReportRow label="Capacity Signals" value={String(signalSummary.capacitySignals)} />
                    <ReportRow label="Finance Signals" value={String(signalSummary.financeSignals)} />
                    {signalData.filter(s => s.severity === 'critical').slice(0, 3).map(s => (
                      <div key={s.id} className="mt-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 border border-red-100">
                        ⚠ {s.title}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Escalations (ESC-001)</p>
                    <ReportRow label="Total Escalations" value={String(escalationSummary.total)} />
                    <ReportRow label="Critical" value={String(escalationSummary.critical)} warn={escalationSummary.critical > 0} />
                    <ReportRow label="High" value={String(escalationSummary.high)} warn={escalationSummary.high > 0} />
                    <ReportRow label="Financial Exposure" value={fmtSar(escalationSummary.totalFinancialExposure)} warn={escalationSummary.totalFinancialExposure > 0} />
                    {escalationData.filter(e => e.severity === 'critical').slice(0, 3).map(e => (
                      <div key={e.id} className="mt-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 border border-red-100">
                        🔥 {e.title}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Footer */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <div className="rounded border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-800">Report Methodology</span>
                  </div>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>This report is generated from live Commercial OS data (batch: {batchId}).</p>
                    <p>All values are read-only snapshots. No numbers are manipulated or adjusted.</p>
                    <p>GP figures are based on available cost data. Where cost data is missing, a 25% default GP margin is used (flagged as "assumed").</p>
                    <p className="font-semibold">This report is for internal leadership review only. Not for external distribution.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>• Source batch: {batchId}</span>
                  <span>• Generated: {now.toISOString().split('T')[0]}</span>
                  <span>• Read-only internal report</span>
                  <span>• No CRM integration</span>
                  <span>• No workflow enforcement</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
