import { AlertTriangle, Bell, Flame, Info, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
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
  fetchCommercialEscalations,
  computeEscalationSummary,
  generateEscalationsFromData,
  type CommercialEscalation,
  type EscalationSeverity,
  type EscalationType,
} from "@/lib/commercial-os-data";
import { useEffect, useState } from "react";

function severityBadge(severity: EscalationSeverity) {
  const config: Record<EscalationSeverity, { label: string; className: string }> = {
    critical: { label: "Critical", className: "border-red-300 bg-red-50 text-red-700" },
    high: { label: "High", className: "border-orange-300 bg-orange-50 text-orange-700" },
    medium: { label: "Medium", className: "border-amber-300 bg-amber-50 text-amber-700" },
    low: { label: "Low", className: "border-blue-200 bg-blue-50 text-blue-700" },
  };
  const cfg = config[severity] || config.medium;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function severityIcon(severity: EscalationSeverity) {
  switch (severity) {
    case 'critical': return <ShieldAlert className="h-4 w-4 text-red-600" />;
    case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'medium': return <Bell className="h-4 w-4 text-amber-600" />;
    default: return <ShieldCheck className="h-4 w-4 text-blue-600" />;
  }
}

function typeBadge(escalationType: EscalationType) {
  const labels: Record<string, { label: string; className: string }> = {
    capacity: { label: "Capacity", className: "border-red-200 bg-red-50 text-red-600" },
    finance: { label: "Finance", className: "border-purple-200 bg-purple-50 text-purple-600" },
    gp: { label: "GP", className: "border-violet-200 bg-violet-50 text-violet-600" },
    customer: { label: "Customer", className: "border-blue-200 bg-blue-50 text-blue-600" },
    tender: { label: "Tender", className: "border-teal-200 bg-teal-50 text-teal-600" },
    operational: { label: "Operational", className: "border-orange-200 bg-orange-50 text-orange-600" },
    leadership: { label: "Leadership", className: "border-indigo-200 bg-indigo-50 text-indigo-600" },
  };
  const cfg = labels[escalationType] || labels.operational;
  return <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>;
}

function statusBadge(status: string) {
  const config: Record<string, string> = {
    open: "border-red-200 bg-red-50 text-red-700",
    monitoring: "border-blue-200 bg-blue-50 text-blue-700",
    under_review: "border-amber-200 bg-amber-50 text-amber-700",
    mitigated: "border-emerald-200 bg-emerald-50 text-emerald-700",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ignored: "border-slate-200 bg-slate-50 text-slate-500",
  };
  const label = status === 'under_review' ? 'Under Review' : status;
  return <Badge variant="outline" className={`text-[10px] ${config[status] || config.open}`}>{label}</Badge>;
}

function fmtSar(value: number | null | undefined) {
  if (!value) return '--';
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) + ' SAR';
}

export default function CommercialOsEscalations() {
  const { data, loading, error } = useCommercialOsData();
  const [dbEscalations, setDbEscalations] = useState<CommercialEscalation[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    fetchCommercialEscalations().then(e => {
      setDbEscalations(e);
      setDbLoading(false);
    });
  }, []);

  // Compute risk + GP summaries for client-side generation
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

  // Use DB escalations if available, otherwise generate from data
  const gpTotalDeals = gpV2 ? (gpV2.dealsVerified + gpV2.dealsAssumed + gpV2.dealsNoRevenue) : 0;
  const escalations = !dbLoading && dbEscalations.length > 0
    ? dbEscalations
    : generateEscalationsFromData(riskSummary, gpV2 ? {
        dangerousDefaultCount: gpV2.dangerousDefaultCount,
        totalDeals: gpTotalDeals,
        projectedGpAssumed: gpV2.projectedGpAssumed,
      } : null);

  const summary = computeEscalationSummary(escalations);
  const escalationSource = !dbLoading && dbEscalations.length > 0
    ? 'Supabase (commercial_escalations)'
    : 'Client-side generated from signals + capacity/GP data';

  return (
    <CommercialOsShell
      title="Escalation Workspace"
      description="Read-only commercial escalation workspace — signals requiring leadership visibility and human review."
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="escalations" /> : error ? <ErrorState error={error} /> : null}

        {!loading && !error && (
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-5">
              {/* Header */}
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-600" />
                  <p className="text-sm font-semibold text-foreground">Escalation Summary</p>
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">ESC-001</Badge>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                  Read-only · {escalationSource}
                </Badge>
              </div>

              {/* Summary Cards */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <MetricCard label="Total Escalations" value={String(summary.total)} helper={`${summary.open} open`} />
                <MetricCard label="Critical" value={String(summary.critical)} helper={summary.critical > 0 ? "Immediate leadership attention" : "None"} />
                <MetricCard label="High" value={String(summary.high)} helper={summary.high > 0 ? "Review within 48h" : "None"} />
                <MetricCard label="Capacity" value={String(summary.capacityEscalations)} helper="Warehouse capacity risks" />
                <MetricCard label="Finance" value={String(summary.financeEscalations)} helper="Revenue/GP risks" />
                <MetricCard label="Operational" value={String(summary.operationalEscalations)} helper="Shortfall/ops risks" />
                <MetricCard
                  label="Financial Exposure"
                  value={fmtSar(summary.totalFinancialExposure)}
                  helper="Estimated risk value"
                />
              </div>

              {/* Doctrine Labels */}
              <div className="mb-4 rounded border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-3">
                <span className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Read-only commercial escalation workspace
                </span>
                <span className="text-[10px] text-amber-700">• Signals do not enforce workflow</span>
                <span className="text-[10px] text-amber-700">• Escalations require human review</span>
                <span className="text-[10px] text-amber-700">• No automated approvals or hard gates</span>
              </div>

              {/* Escalation Table */}
              {escalations.length === 0 ? (
                <EmptySourceState label="Commercial escalations" />
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Active Escalations</p>
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
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Owner</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Financial Exposure</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Commercial Impact</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended Action</th>
                          <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escalations.map(esc => (
                          <tr
                            key={esc.id}
                            className={`border-b last:border-0 ${
                              esc.severity === 'critical' ? 'bg-red-50/40' :
                              esc.severity === 'high' ? 'bg-orange-50/20' : ''
                            }`}
                          >
                            <td className="px-2 py-2">{severityIcon(esc.severity)}</td>
                            <td className="px-2 py-2">{severityBadge(esc.severity)}</td>
                            <td className="px-2 py-2">{typeBadge(esc.escalationType)}</td>
                            <td className="px-2 py-2">{statusBadge(esc.status)}</td>
                            <td className="px-2 py-2 font-medium max-w-48">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="line-clamp-2">{esc.title}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-sm text-xs">
                                    {esc.description}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">{esc.warehouseLabel || '--'}</td>
                            <td className="px-2 py-2 text-[11px] whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="text-muted-foreground">{esc.ownerRole || '--'}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                                    Governance: {esc.governanceOwner || 'Not assigned'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap font-mono text-[11px]">
                              {esc.financialExposure ? (
                                <span className={esc.severity === 'critical' ? 'text-red-700 font-semibold' : 'text-orange-700'}>
                                  {fmtSar(esc.financialExposure)}
                                </span>
                              ) : '--'}
                            </td>
                            <td className="px-2 py-2 max-w-36 text-[11px] text-muted-foreground">
                              <span className="line-clamp-2">{esc.commercialImpact || '--'}</span>
                            </td>
                            <td className="px-2 py-2 max-w-40 text-[11px]">
                              <span className={`line-clamp-2 ${esc.severity === 'critical' ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
                                {esc.recommendedAction || '--'}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                              {esc.sourceLineage ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span>{esc.sourceType || '--'}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-sm text-xs">
                                      {esc.sourceLineage}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                esc.sourceType || '--'
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
                      <span className="text-xs font-semibold text-blue-800">Escalation Workspace Rules</span>
                    </div>
                    <div className="space-y-1 text-xs text-blue-700">
                      <p>Escalations are derived from critical/high operations signals and verified capacity/finance data.</p>
                      <p>No customer complaints are invented. No escalations are auto-created from normal operations.</p>
                      <p>Only signals exceeding severity thresholds generate escalation candidates.</p>
                      <p className="font-semibold">All escalations are read-only observations for leadership visibility. They do not enforce any workflow, approval, or governance action.</p>
                    </div>
                  </div>

                  {/* Source Labels */}
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    <span>• Escalation source: {escalationSource}</span>
                    <span>• Signal-linked from OPS-001 data</span>
                    <span>• No workflow enforcement</span>
                    <span>• No CRM integration</span>
                    <span>• No automated approvals</span>
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
