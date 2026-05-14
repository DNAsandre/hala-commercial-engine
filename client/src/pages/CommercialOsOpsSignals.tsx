import { AlertTriangle, Bell, Info, Radio, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  CommercialOsShell,
  EmptySourceState,
  ErrorState,
  LoadingState,
  MetricCard,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import {
  computeCapacityRiskSummary,
  computeGpV2Summary,
  computeSignalSummary,
  generateSignalsFromData,
  fetchOperationsSignals,
  type OperationsSignal,
  type SignalSeverity,
  type SignalType,
} from "@/lib/commercial-os-data";
import { useEffect, useState } from "react";

function severityBadge(severity: SignalSeverity) {
  const config: Record<SignalSeverity, { label: string; className: string }> = {
    critical: { label: "Critical", className: "border-red-300 bg-red-50 text-red-700" },
    high: { label: "High", className: "border-orange-300 bg-orange-50 text-orange-700" },
    medium: { label: "Medium", className: "border-amber-300 bg-amber-50 text-amber-700" },
    low: { label: "Low", className: "border-blue-200 bg-blue-50 text-blue-700" },
  };
  const cfg = config[severity] || config.medium;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function severityIcon(severity: SignalSeverity) {
  switch (severity) {
    case 'critical': return <ShieldAlert className="h-4 w-4 text-red-600" />;
    case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'medium': return <Bell className="h-4 w-4 text-amber-600" />;
    default: return <ShieldCheck className="h-4 w-4 text-blue-600" />;
  }
}

function typeBadge(signalType: SignalType) {
  const labels: Record<string, { label: string; className: string }> = {
    capacity_risk: { label: "Capacity Risk", className: "border-red-200 bg-red-50 text-red-600" },
    shortfall: { label: "Shortfall", className: "border-orange-200 bg-orange-50 text-orange-600" },
    high_utilization: { label: "High Utilization", className: "border-amber-200 bg-amber-50 text-amber-600" },
    finance_signal: { label: "Finance", className: "border-purple-200 bg-purple-50 text-purple-600" },
    complaint: { label: "Complaint", className: "border-red-200 bg-red-50 text-red-600" },
    sla_risk: { label: "SLA Risk", className: "border-red-200 bg-red-50 text-red-600" },
    promise_gap: { label: "Promise Gap", className: "border-amber-200 bg-amber-50 text-amber-600" },
    warehouse_issue: { label: "Warehouse", className: "border-slate-200 bg-slate-50 text-slate-600" },
  };
  const cfg = labels[signalType] || labels.warehouse_issue;
  return <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>;
}

function statusBadge(status: string) {
  const config: Record<string, string> = {
    open: "border-red-200 bg-red-50 text-red-700",
    monitoring: "border-blue-200 bg-blue-50 text-blue-700",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ignored: "border-slate-200 bg-slate-50 text-slate-500",
  };
  return <Badge variant="outline" className={`text-[10px] ${config[status] || config.open}`}>{status}</Badge>;
}

export default function CommercialOsOpsSignals() {
  const { data, loading, error } = useCommercialOsData();
  const [dbSignals, setDbSignals] = useState<OperationsSignal[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    fetchOperationsSignals().then(s => {
      setDbSignals(s);
      setDbLoading(false);
    });
  }, []);

  // Compute risk + GP summaries for client-side signal generation
  const latestSnapshots = Array.from(
    data.capacitySnapshots
      .reduce((latest, row) => {
        const key = row.warehouseLocationId || row.warehouseLabel || row.warehouseName || row.id;
        const current = latest.get(key);
        if (!current || row.snapshotDate.localeCompare(current.snapshotDate) >= 0) latest.set(key, row);
        return latest;
      }, new Map<string, (typeof data.capacitySnapshots)[number]>())
      .values()
  );

  const riskSummary = latestSnapshots.length > 0
    ? computeCapacityRiskSummary(latestSnapshots, data.dashboardThresholds)
    : null;

  const gpV2 = data.opportunities.length > 0
    ? computeGpV2Summary(data.opportunities)
    : null;

  // Use DB signals if available, otherwise generate from data
  const gpTotalDeals = gpV2 ? (gpV2.dealsVerified + gpV2.dealsAssumed + gpV2.dealsNoRevenue) : 0;
  const signals = !dbLoading && dbSignals.length > 0
    ? dbSignals
    : generateSignalsFromData(riskSummary, gpV2 ? {
        dangerousDefaultCount: gpV2.dangerousDefaultCount,
        totalDeals: gpTotalDeals,
        projectedGpAssumed: gpV2.projectedGpAssumed,
      } : null);

  const summary = computeSignalSummary(signals);
  const signalSource = !dbLoading && dbSignals.length > 0 ? 'Supabase (operations_signals)' : 'Client-side generated from capacity/GP data';

  return (
    <CommercialOsShell
      title="Operations Signal Inbox"
      description="Read-only operations signals surfaced from warehouse capacity, GP intelligence, and finance data."
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="operations signals" /> : error ? <ErrorState error={error} /> : null}

        {/* Summary Cards */}
        {!loading && !error && (
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-red-600" />
                  <p className="text-sm font-semibold text-foreground">Signal Summary</p>
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">OPS-001</Badge>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                  Read-only · {signalSource}
                </Badge>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <MetricCard label="Total Signals" value={String(summary.total)} helper={`${summary.open} open`} />
                <MetricCard label="Critical" value={String(summary.critical)} helper={summary.critical > 0 ? "Immediate action required" : "None detected"} />
                <MetricCard label="High" value={String(summary.high)} helper={summary.high > 0 ? "Finance/ops review needed" : "None detected"} />
                <MetricCard label="Medium" value={String(summary.medium)} helper="Monitor closely" />
                <MetricCard label="Capacity" value={String(summary.capacitySignals)} helper="Warehouse capacity signals" />
                <MetricCard label="Finance" value={String(summary.financeSignals)} helper="GP/revenue signals" />
              </div>

              {/* Signal Table */}
              {signals.length === 0 ? (
                <EmptySourceState label="Operations signals" />
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Active Signals</p>
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left">
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-8"></th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Severity</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Title</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Warehouse</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Commercial Impact</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended Action</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signals.map(signal => (
                          <tr
                            key={signal.id}
                            className={`border-b last:border-0 ${
                              signal.severity === 'critical' ? 'bg-red-50/40' :
                              signal.severity === 'high' ? 'bg-orange-50/20' : ''
                            }`}
                          >
                            <td className="px-2 py-2">{severityIcon(signal.severity)}</td>
                            <td className="px-2 py-2">{severityBadge(signal.severity)}</td>
                            <td className="px-2 py-2">{typeBadge(signal.signalType)}</td>
                            <td className="px-2 py-2">{statusBadge(signal.status)}</td>
                            <td className="px-2 py-2 font-medium max-w-48">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="line-clamp-2">{signal.title}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-sm text-xs">
                                    {signal.description}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">{signal.warehouseLabel || '--'}</td>
                            <td className="px-2 py-2 max-w-40 text-[11px] text-muted-foreground">
                              <span className="line-clamp-2">{signal.commercialImpact || '--'}</span>
                            </td>
                            <td className="px-2 py-2 max-w-40 text-[11px]">
                              <span className={`line-clamp-2 ${signal.severity === 'critical' ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
                                {signal.recommendedAction || '--'}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                              {signal.sourceLineage ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span>{signal.sourceArea || signal.sourceTable || '--'}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-sm text-xs">
                                      {signal.sourceLineage}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                signal.sourceArea || '--'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Methodology */}
                  <div className="mt-4 rounded border border-blue-100 bg-blue-50/50 px-4 py-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800">Signal Generation Rules</span>
                    </div>
                    <div className="space-y-1 text-xs text-blue-700">
                      <p>Signals are generated from verified warehouse capacity snapshots and GP intelligence data.</p>
                      <p>No customer complaints are invented. No SLA events are fabricated.</p>
                      <p className="font-semibold">All signals are read-only observations, not enforced workflow actions.</p>
                    </div>
                  </div>

                  {/* Source Labels */}
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    <span>• Signal source: {signalSource}</span>
                    <span>• Rule-generated from existing data only</span>
                    <span>• No workflow enforcement</span>
                    <span>• No CRM integration</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </CommercialOsShell>
  );
}
