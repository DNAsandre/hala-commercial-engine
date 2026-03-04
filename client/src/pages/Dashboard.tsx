/**
 * Executive Intelligence Dashboard — Command Center
 * Three-layer layout: KPI Snapshot -> Charts & Intelligence -> Activity Feed
 * Powered by Supabase live data + Recharts visualizations.
 *
 * DESIGN: Contained panels with overflow protection, pipeline drill-down filtering
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Loader2,
  RefreshCw,
  DollarSign,
  Radio,
  ExternalLink,
  Truck,
  FileText,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatSAR,
  formatPercent,
  getStageLabel,
  getStageColor,
} from "@/lib/store";
import type { Workspace, Signal, WorkspaceStage } from "@/lib/store";
import { navigationV1 } from "@/components/DashboardLayout";
import { useWorkspaces, useCustomers, useSignals, useApprovalRecords } from "@/hooks/useSupabase";

// Dashboard panels
import ExecutiveSnapshot from "@/components/dashboard/ExecutiveSnapshot";
import PipelineFunnel from "@/components/dashboard/PipelineFunnel";
import RevenueForecast from "@/components/dashboard/RevenueForecast";
import CustomerRiskMap from "@/components/dashboard/CustomerRiskMap";
import EscalationPanel from "@/components/dashboard/EscalationPanel";
import RenewalExposure from "@/components/dashboard/RenewalExposure";
import SLACompliance from "@/components/dashboard/SLACompliance";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import type { DashboardFilterState } from "@/components/dashboard/DashboardFilters";
import CRMDashboardWidget from "@/components/CRMDashboardWidget";

function AttentionItem({ workspace, allSignals }: { workspace: Workspace; allSignals: Signal[] }) {
  const wsSignals = allSignals.filter(s => s.workspaceId === workspace.id);
  const worstSeverity = wsSignals.some(s => s.severity === "red") ? "red" : wsSignals.some(s => s.severity === "amber") ? "amber" : "green";

  return (
    <Link href={`/workspaces/${workspace.id}`}>
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group min-w-0">
        <div className={`rag-dot shrink-0 ${worstSeverity === "red" ? "rag-dot-red" : worstSeverity === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{workspace.customerName}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${getStageColor(workspace.stage)}`}>
              {getStageLabel(workspace.stage)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{workspace.title}</p>
          {wsSignals[0] && (
            <p className={`text-xs mt-1 line-clamp-2 ${worstSeverity === "red" ? "rag-red" : "rag-amber"}`}>
              {wsSignals[0].message}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="data-value text-sm font-medium">{formatSAR(workspace.estimatedValue)}</div>
          <div className="data-value text-xs text-muted-foreground">{formatPercent(workspace.gpPercent)} GP</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: workspaces, loading: wsLoading } = useWorkspaces();
  const { data: customers, loading: custLoading } = useCustomers();
  const { data: signals, loading: sigLoading } = useSignals();
  const { data: approvalRecords, loading: appLoading } = useApprovalRecords();

  const [filters, setFilters] = useState<DashboardFilterState>({
    timeRange: "all",
    customerSegment: "all",
    workspaceType: "all",
  });

  // Pipeline drill-down state
  const [pipelineStageFilter, setPipelineStageFilter] = useState<WorkspaceStage | null>(null);

  const loading = wsLoading || custLoading || sigLoading || appLoading;

  // Apply filters
  const filteredWorkspaces = useMemo(() => {
    let ws = workspaces;
    if (filters.workspaceType === "commercial") ws = ws.filter(w => w.type !== "tender");
    if (filters.workspaceType === "tender") ws = ws.filter(w => w.type === "tender");
    if (filters.customerSegment !== "all") {
      const custIds = customers.filter(c => c.grade === filters.customerSegment).map(c => c.id);
      ws = ws.filter(w => custIds.includes(w.customerId));
    }
    return ws;
  }, [workspaces, customers, filters]);

  const filteredCustomers = useMemo(() => {
    let c = customers;
    if (filters.customerSegment !== "all") c = c.filter(cu => cu.grade === filters.customerSegment);
    return c;
  }, [customers, filters]);

  const filteredSignals = useMemo(() => {
    const wsIds = new Set(filteredWorkspaces.map(w => w.id));
    return signals.filter(s => wsIds.has(s.workspaceId));
  }, [signals, filteredWorkspaces]);

  // Attention workspaces — with optional pipeline stage filter
  const attentionWorkspaces = useMemo(() => {
    let candidates = filteredWorkspaces;

    // If a pipeline stage is selected, show ALL workspaces in that stage (not just attention-worthy ones)
    if (pipelineStageFilter) {
      return candidates
        .filter(w => w.stage === pipelineStageFilter)
        .sort((a, b) => {
          const aRed = a.ragStatus === "red" ? 0 : a.ragStatus === "amber" ? 1 : 2;
          const bRed = b.ragStatus === "red" ? 0 : b.ragStatus === "amber" ? 1 : 2;
          return aRed - bRed || b.estimatedValue - a.estimatedValue;
        })
        .slice(0, 12);
    }

    // Default: show workspaces needing attention
    return candidates
      .filter(w => w.ragStatus === "red" || w.ragStatus === "amber" || w.daysInStage > 10)
      .sort((a, b) => {
        if (a.ragStatus === "red" && b.ragStatus !== "red") return -1;
        if (b.ragStatus === "red" && a.ragStatus !== "red") return 1;
        return b.daysInStage - a.daysInStage;
      })
      .slice(0, 8);
  }, [filteredWorkspaces, pipelineStageFilter]);

  const pendingApprovals = approvalRecords.filter(a => a.decision === "pending");
  const escalationCount = filteredSignals.filter(s => s.severity === "red" || s.severity === "amber").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* HEADER + FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Commercial Command</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <DashboardFilters filters={filters} onChange={setFilters} />
      </div>

      {/* LAYER 1: EXECUTIVE SNAPSHOT (5 KPI Cards) */}
      <ExecutiveSnapshot
        workspaces={filteredWorkspaces}
        customers={filteredCustomers}
        signals={filteredSignals}
        escalationCount={escalationCount}
      />

      {/* LAYER 2: CHARTS & INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineFunnel
          workspaces={filteredWorkspaces}
          onStageClick={setPipelineStageFilter}
          activeStage={pipelineStageFilter}
        />
        <RevenueForecast workspaces={filteredWorkspaces} customers={filteredCustomers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CustomerRiskMap customers={filteredCustomers} signals={filteredSignals} workspaces={filteredWorkspaces} />
        </div>
        <SLACompliance signals={filteredSignals} workspaces={filteredWorkspaces} />
      </div>

      <EscalationPanel signals={filteredSignals} workspaces={filteredWorkspaces} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RenewalExposure customers={filteredCustomers} />
        <div className="lg:col-span-2">
          {/* Attention Required — with drill-down filter */}
          <Card className="border border-border shadow-none h-full overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">
                    {pipelineStageFilter
                      ? `${getStageLabel(pipelineStageFilter)} Stage`
                      : "Attention Required"
                    }
                  </span>
                  {pipelineStageFilter && (
                    <button
                      onClick={() => setPipelineStageFilter(null)}
                      className="ml-1 p-0.5 rounded-md hover:bg-muted transition-colors shrink-0"
                      title="Clear filter"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  {pipelineStageFilter && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                      Filtered
                    </Badge>
                  )}
                  <Link href="/workspaces">
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap">
                      View all <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
              </div>
              {pipelineStageFilter && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Showing workspaces in <strong>{getStageLabel(pipelineStageFilter)}</strong> stage. Click the bar again or press X to clear.
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {attentionWorkspaces.map(ws => (
                  <AttentionItem key={ws.id} workspace={ws} allSignals={filteredSignals} />
                ))}
                {attentionWorkspaces.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {pipelineStageFilter
                      ? `No workspaces in ${getStageLabel(pipelineStageFilter)} stage`
                      : "No items requiring attention"
                    }
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* LAYER 3: ACTIVITY FEED + CRM SYNC */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed workspaces={filteredWorkspaces} signals={filteredSignals} approvals={approvalRecords} />
        </div>
        <CRMDashboardWidget />
      </div>

      {/* QUICK ACCESS CARDS */}
      {navigationV1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/approvals">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group bg-card overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Approvals</p>
                <p className="text-[10px] text-muted-foreground truncate">{pendingApprovals.length} pending</p>
              </div>
            </div>
          </Link>
          <Link href="/renewals">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group bg-card overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Renewals</p>
                <p className="text-[10px] text-muted-foreground truncate">Contracts expiring</p>
              </div>
            </div>
          </Link>
          <Link href="/revenue-exposure">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group bg-card overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Revenue Exposure</p>
                <p className="text-[10px] text-muted-foreground truncate">At-risk revenue</p>
              </div>
            </div>
          </Link>
          <Link href="/signal-engine">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group bg-card overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Signals</p>
                <p className="text-[10px] text-muted-foreground truncate">{filteredSignals.filter(s => s.severity === "red").length} critical</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Quick links */}
      {navigationV1 && (
        <div className="flex items-center gap-3 flex-wrap pb-4">
          <span className="text-xs text-muted-foreground">Quick links:</span>
          <Link href="/handover"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><Truck className="w-3 h-3" /> Handover</Badge></Link>
          <Link href="/tender-board"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><FileText className="w-3 h-3" /> Tender Board</Badge></Link>
          <Link href="/crm-sync"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><ExternalLink className="w-3 h-3" /> CRM Sync</Badge></Link>
          <Link href="/documents"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><FileText className="w-3 h-3" /> Document Vault</Badge></Link>
          <Link href="/renewal-gates"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><RefreshCw className="w-3 h-3" /> Policy Gates</Badge></Link>
        </div>
      )}
    </div>
  );
}
