/**
 * Executive Dashboard — "Precision Instrument" Design
 * The first thing Amin sees every morning.
 * Now powered by Supabase — live data from the database.
 */

import { Link } from "wouter";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Briefcase,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  DollarSign,
  Radio,
  ExternalLink,
  Truck,
  FileText,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatSAR,
  formatPercent,
  getStageLabel,
  getStageColor,
  WORKSPACE_STAGES,
} from "@/lib/store";
import { navigationV1 } from "@/components/DashboardLayout";
import CRMDashboardWidget from "@/components/CRMDashboardWidget";
import type { Workspace, Customer } from "@/lib/store";
import { useWorkspaces, useCustomers, useSignals, useApprovalRecords } from "@/hooks/useSupabase";

function StatCard({ title, value, subtitle, icon: Icon, accent }: {
  title: string; value: string; subtitle: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <Card className="border border-border shadow-none hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-serif font-bold mt-1 ${accent || "text-foreground"}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionItem({ workspace, allSignals }: { workspace: Workspace; allSignals: { workspaceId: string; severity: string; message: string }[] }) {
  const wsSignals = allSignals.filter(s => s.workspaceId === workspace.id);
  const worstSeverity = wsSignals.some(s => s.severity === "red") ? "red" : wsSignals.some(s => s.severity === "amber") ? "amber" : "green";

  return (
    <Link href={`/workspaces/${workspace.id}`}>
      <div className="flex items-center gap-4 p-3.5 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
        <div className={`rag-dot shrink-0 ${worstSeverity === "red" ? "rag-dot-red" : worstSeverity === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{workspace.customerName}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStageColor(workspace.stage)}`}>
              {getStageLabel(workspace.stage)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{workspace.title}</p>
          {wsSignals[0] && (
            <p className={`text-xs mt-1 ${worstSeverity === "red" ? "rag-red" : "rag-amber"}`}>
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

  const loading = wsLoading || custLoading || sigLoading || appLoading;

  // Compute stats from live data
  const activeWorkspaces = workspaces.filter(w => w.stage !== "go_live");
  const totalPipelineValue = activeWorkspaces.reduce((sum, w) => sum + w.estimatedValue, 0);
  const avgGP = activeWorkspaces.length > 0 ? activeWorkspaces.reduce((sum, w) => sum + w.gpPercent, 0) / activeWorkspaces.length : 0;
  const redSignals = signals.filter(s => s.severity === "red").length;
  const pendingApprovals = approvalRecords.filter(a => a.decision === "pending");
  const activeCustomers = customers.filter(c => c.status === "Active").length;
  const totalRevenue2025 = customers.reduce((sum, c) => sum + c.revenue2025, 0);

  const expiringContracts = customers.filter(c => {
    if (!c.contractExpiry) return false;
    const expiry = new Date(c.contractExpiry);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 90;
  }).slice(0, 5);

  const stageDistribution = WORKSPACE_STAGES.map(s => ({
    stage: s.label,
    count: workspaces.filter(w => w.stage === s.value).length,
    value: workspaces.filter(w => w.stage === s.value).reduce((sum, w) => sum + w.estimatedValue, 0),
  })).filter(s => s.count > 0);

  const gradeDistribution = (["A", "B", "C", "D", "F"] as const).map(g => ({
    grade: g,
    count: customers.filter(c => c.grade === g).length,
    revenue: customers.filter(c => c.grade === g).reduce((sum, c) => sum + c.revenue2025, 0),
  }));

  const attentionWorkspaces = workspaces
    .filter(w => w.ragStatus === "red" || w.ragStatus === "amber" || w.daysInStage > 10)
    .sort((a, b) => {
      if (a.ragStatus === "red" && b.ragStatus !== "red") return -1;
      if (b.ragStatus === "red" && a.ragStatus !== "red") return 1;
      return b.daysInStage - a.daysInStage;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Commercial Command</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Pipeline"
          value={formatSAR(totalPipelineValue)}
          subtitle={`${activeWorkspaces.length} active workspaces`}
          icon={Briefcase}
        />
        <StatCard
          title="Avg. Gross Profit"
          value={formatPercent(avgGP)}
          subtitle="Across active deals"
          icon={TrendingUp}
          accent={avgGP >= 22 ? "text-[var(--color-rag-green)]" : avgGP >= 15 ? "text-[var(--color-rag-amber)]" : "text-[var(--color-rag-red)]"}
        />
        <StatCard
          title="Active Customers"
          value={String(activeCustomers)}
          subtitle={`YTD Revenue: ${formatSAR(totalRevenue2025)}`}
          icon={Users}
        />
        <StatCard
          title="Pending Approvals"
          value={String(pendingApprovals.length)}
          subtitle={`${redSignals} critical signals`}
          icon={ShieldCheck}
          accent={pendingApprovals.length > 0 ? "text-[var(--color-rag-amber)]" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attention Required — 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-rag-amber)]" />
                  Attention Required
                </CardTitle>
                <Link href="/workspaces">
                  <span className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {attentionWorkspaces.map(ws => (
                  <AttentionItem key={ws.id} workspace={ws} allSignals={signals} />
                ))}
                {attentionWorkspaces.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">No items requiring attention</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pipeline by Stage */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-serif">Pipeline by Stage</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2.5">
                {stageDistribution.map(s => (
                  <div key={s.stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 text-right data-value">{s.count}</span>
                      <span className="text-sm text-foreground">{s.stage}</span>
                    </div>
                    <span className="text-xs data-value text-muted-foreground">{formatSAR(s.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer Grade Distribution */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-serif">Portfolio Health</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {gradeDistribution.map(g => {
                  const maxRevenue = Math.max(...gradeDistribution.map(d => d.revenue));
                  const width = maxRevenue > 0 ? (g.revenue / maxRevenue) * 100 : 0;
                  const gradeColors: Record<string, string> = {
                    A: "bg-[var(--color-rag-green)]",
                    B: "bg-blue-500",
                    C: "bg-[var(--color-rag-amber)]",
                    D: "bg-orange-500",
                    F: "bg-[var(--color-rag-red)]",
                  };
                  return (
                    <div key={g.grade}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold w-4">{g.grade}</span>
                          <span className="text-xs text-muted-foreground">{g.count} customers</span>
                        </div>
                        <span className="text-xs data-value text-muted-foreground">{formatSAR(g.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${gradeColors[g.grade] || "bg-muted-foreground"}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* CRM Sync Widget */}
          <CRMDashboardWidget />

          {/* Expiring Contracts */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--color-rag-amber)]" />
                  Expiring Contracts
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {expiringContracts.length > 0 ? (
                <div className="space-y-2.5">
                  {expiringContracts.map(c => {
                    const daysLeft = Math.ceil((new Date(c.contractExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <Link key={c.id} href={`/customers/${c.id}`}>
                        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                          <div>
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{c.contractExpiry}</span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${daysLeft <= 30 ? "border-[var(--color-rag-red)] text-[var(--color-rag-red)]" : "border-[var(--color-rag-amber)] text-[var(--color-rag-amber)]"}`}>
                            {daysLeft}d
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No contracts expiring within 90 days</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ QUICK ACCESS CARDS (navigationV1) ═══ */}
      {navigationV1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Link href="/approvals">
            <Card className="border border-border shadow-none hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Approvals</p>
                    <p className="text-xs text-muted-foreground">{pendingApprovals.length} pending</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/renewals">
            <Card className="border border-border shadow-none hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Renewals</p>
                    <p className="text-xs text-muted-foreground">{expiringContracts.length} expiring within 90d</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/revenue-exposure">
            <Card className="border border-border shadow-none hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Revenue Exposure</p>
                    <p className="text-xs text-muted-foreground">{formatSAR(expiringContracts.reduce((s, c) => s + c.revenue2025, 0))} at risk</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/signal-engine">
            <Card className="border border-border shadow-none hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Active Signals</p>
                    <p className="text-xs text-muted-foreground">{signals.filter(s => s.severity === "red").length} critical, {signals.filter(s => s.severity === "amber").length} warnings</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* ═══ QUICK LINKS ROW (navigationV1) ═══ */}
      {navigationV1 && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
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
