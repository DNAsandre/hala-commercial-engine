import { AlertTriangle, DollarSign, Info, Shield, ShieldAlert, ShieldCheck, Eye } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import { computeCapacityRiskSummary, computeCapacityMonetization, type CapacityRiskStatus } from "@/lib/commercial-os-data";

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

function fmtDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function riskBadge(status: CapacityRiskStatus) {
  const config: Record<CapacityRiskStatus, { label: string; className: string }> = {
    overcommitted: { label: "Overcommitted", className: "border-red-300 bg-red-50 text-red-700" },
    constrained: { label: "Constrained", className: "border-orange-300 bg-orange-50 text-orange-700" },
    high_utilization: { label: "High Utilization", className: "border-amber-300 bg-amber-50 text-amber-700" },
    watch: { label: "Watch", className: "border-blue-200 bg-blue-50 text-blue-700" },
    available: { label: "Available", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  };
  const cfg = config[status] || config.available;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function riskIcon(status: CapacityRiskStatus) {
  switch (status) {
    case 'overcommitted': return <ShieldAlert className="h-4 w-4 text-red-600" />;
    case 'constrained': return <ShieldAlert className="h-4 w-4 text-orange-600" />;
    case 'high_utilization': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case 'watch': return <Eye className="h-4 w-4 text-blue-600" />;
    default: return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  }
}

export default function CommercialOsCapacity() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = Array.from(
    data.capacitySnapshots
      .reduce((latest, row) => {
        const key = row.warehouseLocationId || row.warehouseLabel || row.warehouseName || row.id;
        const current = latest.get(key);
        if (!current || row.snapshotDate.localeCompare(current.snapshotDate) >= 0) latest.set(key, row);
        return latest;
      }, new Map<string, (typeof data.capacitySnapshots)[number]>())
      .values()
  );

  const riskSummary = !loading && !error && rows.length > 0
    ? computeCapacityRiskSummary(rows, data.dashboardThresholds)
    : null;

  return (
    <CommercialOsShell
      title="Warehouse Capacity"
      description={`Live read-only capacity snapshots for import batch ${batchId}.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="capacity snapshots" /> : error ? <ErrorState error={error} /> : null}

        {/* CAP-002: Capacity Risk Intelligence */}
        {riskSummary && (
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-foreground">Capacity Risk Intelligence</p>
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">CAP-002</Badge>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                  Read-only capacity intelligence · Thresholds sourced from Assumption Registry · Capacity risks require operations confirmation
                </Badge>
              </div>

              {/* Risk Summary Cards */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard
                  label="Total Warehouses"
                  value={String(riskSummary.totalWarehouses)}
                  helper={`${riskSummary.available} available, ${riskSummary.watch} watch`}
                />
                <MetricCard
                  label="Available"
                  value={String(riskSummary.available)}
                  helper="Within acceptable utilization"
                />
                <MetricCard
                  label="Watch / High Util"
                  value={`${riskSummary.watch} / ${riskSummary.highUtilization}`}
                  helper="75–90% / 90%+ utilization"
                />
                <MetricCard
                  label="Constrained / Overcommitted"
                  value={`${riskSummary.constrained} / ${riskSummary.overcommitted}`}
                  helper={riskSummary.constrained + riskSummary.overcommitted > 0 ? "Operations review required" : "No constraints detected"}
                />
                <MetricCard
                  label="Total Shortfall"
                  value={fmt(riskSummary.totalShortfall)}
                  helper={riskSummary.totalShortfall > 0 ? "Pallets short across all warehouses" : "No shortfall detected"}
                />
              </div>

              {/* Capacity Totals */}
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Total Sellable" value={fmt(riskSummary.totalSellable)} helper="Sum of sellable capacity" />
                <MetricCard label="Total Committed" value={fmt(riskSummary.totalCommitted)} helper="Sum of committed capacity" />
                <MetricCard label="Remaining Capacity" value={fmt(riskSummary.totalRemaining)} helper="Sellable - Committed" />
              </div>

              {/* Risk Table with Commercial Impact */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Warehouse Risk Assessment</p>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Warehouse</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Region</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Risk</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Utilization</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sellable</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Committed</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Remaining</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shortfall</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Risk Reason</th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Commercial Implication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskSummary.warehouses.map((w) => (
                      <tr
                        key={w.warehouseLabel}
                        className={`border-b last:border-0 ${
                          w.riskStatus === 'overcommitted' ? 'bg-red-50/40' :
                          w.riskStatus === 'constrained' ? 'bg-orange-50/30' :
                          w.riskStatus === 'high_utilization' ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="px-2 py-1.5 font-medium">
                          <div className="flex items-center gap-1.5">
                            {riskIcon(w.riskStatus)}
                            {w.warehouseLabel}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">{w.region || "--"}</td>
                        <td className="px-2 py-1.5">{riskBadge(w.riskStatus)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{w.utilizationPct.toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmt(w.sellableCapacity)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmt(w.committedCapacity)}</td>
                        <td className={`px-2 py-1.5 text-right font-mono ${w.remainingCapacity < 0 ? 'text-red-700 font-semibold' : ''}`}>
                          {fmt(w.remainingCapacity)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {w.shortfallCapacity > 0 ? (
                            <span className="font-mono font-semibold text-red-700">{fmt(w.shortfallCapacity)}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="max-w-48 px-2 py-1.5 text-[11px] text-muted-foreground">{w.riskReason}</td>
                        <td className="max-w-56 px-2 py-1.5">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={`text-[11px] ${
                                  w.riskStatus === 'available' ? 'text-emerald-700' :
                                  w.riskStatus === 'watch' ? 'text-blue-700' :
                                  'text-amber-800 font-medium'
                                }`}>
                                  {w.riskStatus === 'overcommitted' ? '🔴 Subcontracting risk' :
                                   w.riskStatus === 'constrained' ? '🟠 Capacity constraint' :
                                   w.riskStatus === 'high_utilization' ? '🟡 Warehouse review required' :
                                   w.riskStatus === 'watch' ? '🔵 Monitor closely' :
                                   '🟢 Normal operations'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-sm text-xs">
                                {w.commercialImplication}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ CAP-003: Capacity Monetization Intelligence ═══ */}
        {riskSummary && (() => {
          const monetization = computeCapacityMonetization(riskSummary, data.defaultAssumptions);
          return (
            <Card className="shadow-none border-emerald-200">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-foreground">Capacity Monetization</p>
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">CAP-003</Badge>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">Opportunity cost / potential</Badge>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                    Read-only · {monetization.palletRateAvailable ? 'Rate from Assumption Registry' : 'Default rate assumption'}
                  </Badge>
                </div>

                {/* Summary Cards */}
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <MetricCard label="Available Capacity" value={fmt(monetization.totalRemainingCapacity)} helper="Sellable - Committed (pallets)" />
                  <MetricCard label="Monthly Potential" value={fmt(monetization.totalMonthlyPotential)} helper="Available × pallet rate" />
                  <MetricCard label="Annualized Potential" value={fmt(monetization.totalAnnualizedPotential)} helper="Monthly × 12" />
                  <MetricCard label="Constrained" value={String(monetization.constrainedWarehouses)} helper="Cannot accept new deals" />
                  <MetricCard label="Monetizable" value={String(monetization.monetizableWarehouses)} helper="Warehouses with available capacity" />
                  <MetricCard label="Pallet Rate" value={`${monetization.palletRateUsed} SAR`} helper={monetization.palletRateSource} />
                </div>

                {/* Warehouse Monetization Table */}
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Warehouse Revenue Potential</p>
                <div className="mb-4 overflow-x-auto rounded border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left">
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Warehouse</th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Region</th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Risk</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Utilization</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Available</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shortfall</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Monthly Potential</th>
                        <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Annualized</th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Rate Assumption</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monetization.warehouses.map(w => (
                        <tr
                          key={w.warehouseLabel}
                          className={`border-b last:border-0 ${
                            w.riskStatus === 'overcommitted' ? 'bg-red-50/40' :
                            w.riskStatus === 'constrained' ? 'bg-orange-50/30' :
                            w.monetizable && w.annualizedPotential > 1_000_000 ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <td className="px-2 py-1.5 font-medium">
                            <div className="flex items-center gap-1.5">
                              {riskIcon(w.riskStatus)}
                              {w.warehouseLabel}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">{w.region || '--'}</td>
                          <td className="px-2 py-1.5">{riskBadge(w.riskStatus)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{w.utilizationPct.toFixed(1)}%</td>
                          <td className={`px-2 py-1.5 text-right font-mono ${w.remainingCapacity < 0 ? 'text-red-700 font-semibold' : w.monetizable ? 'text-emerald-700' : ''}`}>
                            {fmt(Math.max(0, w.remainingCapacity))}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {w.shortfallCapacity > 0 ? (
                              <span className="font-mono font-semibold text-red-700">{fmt(w.shortfallCapacity)}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-mono ${w.monthlyPotential > 0 ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}`}>
                            {w.monthlyPotential > 0 ? fmt(w.monthlyPotential) : '--'}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-mono ${w.annualizedPotential > 0 ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}`}>
                            {w.annualizedPotential > 0 ? fmt(w.annualizedPotential) : '--'}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                            {w.palletRateMonthly} SAR/pallet/mo
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                      <tr>
                        <td className="px-2 py-2" colSpan={4}>Totals</td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(monetization.totalRemainingCapacity)}</td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(monetization.totalMonthlyPotential)}</td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(monetization.totalAnnualizedPotential)}</td>
                        <td className="px-2 py-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* TASK 4: Methodology Panel */}
                <div className="rounded border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-800">Methodology</span>
                  </div>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>Capacity revenue potential = available pallets × assumed pallet rate.</p>
                    <p>{monetization.palletRateUsed} SAR/pallet/month is an assumption, not verified sales price.</p>
                    <p className="font-semibold">This is commercial opportunity, not confirmed lost revenue.</p>
                  </div>
                </div>

                {/* Source Truth Labels */}
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>• Rate source: {monetization.palletRateSource}</span>
                  <span>• Capacity from latest warehouse snapshot</span>
                  <span>• Opportunity cost only — not lost revenue</span>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Existing Capacity Table */}
        {!loading && !error && rows.length === 0 ? (
          <EmptySourceState label="Warehouse capacity" />
        ) : (
          <DataTable
            columns={[
              "Warehouse",
              "Status",
              "Region",
              "Total Capacity",
              "Occupied Capacity",
              "Sellable Capacity",
              "Committed Capacity",
              "Remaining",
              "Utilization %",
              "Shortfall",
              "Snapshot",
              "Source",
            ]}
          >
            {rows.map((row) => {
              const remaining = row.sellableCapacity - row.committedCapacity;
              const highUtilization = row.utilizationPct > 90;
              const hasShortfall = row.shortfallCapacity > 0;
              const risk = riskSummary?.warehouses.find(w => w.warehouseLabel === row.warehouseLabel);
              const status = risk
                ? { label: riskBadge(risk.riskStatus), direct: true }
                : { label: "Available", direct: false };
              return (
                <tr key={row.id} className={highUtilization || hasShortfall ? "bg-amber-50/40" : undefined}>
                  <td className="px-3 py-3 font-medium">{row.warehouseLabel || row.warehouseName || "--"}</td>
                  <td className="px-3 py-3">
                    {status.direct ? status.label : riskBadge('available')}
                  </td>
                  <td className="px-3 py-3">{row.region || "--"}</td>
                  <td className="px-3 py-3">{fmt(row.totalCapacity)}</td>
                  <td className="px-3 py-3">{fmt(row.occupiedCapacity)}</td>
                  <td className="px-3 py-3">{fmt(row.sellableCapacity)}</td>
                  <td className="px-3 py-3">{fmt(row.committedCapacity)}</td>
                  <td className="px-3 py-3">{fmt(remaining)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span>{row.utilizationPct ? `${row.utilizationPct.toFixed(1)}%` : "--"}</span>
                      {highUtilization && <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">Utilization &gt; 90%</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span>{fmt(row.shortfallCapacity)}</span>
                      {hasShortfall && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Shortfall
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{fmtDate(row.snapshotDate)}</td>
                  <td className="px-3 py-3"><SourceCell {...row} /></td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </CommercialOsShell>
  );
}
