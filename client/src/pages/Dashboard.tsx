/*
 * Executive Dashboard — "Precision Instrument" Design
 * The first thing Amin sees every morning.
 * No raw tables. Executive-grade visual presentation.
 * RAG signals, attention-required items, pipeline overview.
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDashboardStats,
  workspaces,
  signals,
  customers,
  formatSAR,
  formatPercent,
  getStageLabel,
  getStageColor,
  approvalRecords,
} from "@/lib/store";
import type { Workspace } from "@/lib/store";

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

function AttentionItem({ workspace }: { workspace: Workspace }) {
  const wsSignals = signals.filter(s => s.workspaceId === workspace.id);
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
  const stats = getDashboardStats();
  const attentionWorkspaces = workspaces
    .filter(w => w.ragStatus === "red" || w.ragStatus === "amber" || w.daysInStage > 10)
    .sort((a, b) => {
      if (a.ragStatus === "red" && b.ragStatus !== "red") return -1;
      if (b.ragStatus === "red" && a.ragStatus !== "red") return 1;
      return b.daysInStage - a.daysInStage;
    });

  const pendingApprovals = approvalRecords.filter(a => a.decision === "pending");
  const expiringContracts = stats.expiringContracts.slice(0, 5);

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
          value={formatSAR(stats.totalPipelineValue)}
          subtitle={`${stats.activeWorkspaces} active workspaces`}
          icon={Briefcase}
        />
        <StatCard
          title="Avg. Gross Profit"
          value={formatPercent(stats.avgGP)}
          subtitle="Across active deals"
          icon={TrendingUp}
          accent={stats.avgGP >= 22 ? "text-[var(--color-rag-green)]" : stats.avgGP >= 15 ? "text-[var(--color-rag-amber)]" : "text-[var(--color-rag-red)]"}
        />
        <StatCard
          title="Active Customers"
          value={String(stats.activeCustomers)}
          subtitle={`YTD Revenue: ${formatSAR(stats.totalRevenue2025)}`}
          icon={Users}
        />
        <StatCard
          title="Pending Approvals"
          value={String(stats.pendingApprovals)}
          subtitle={`${stats.redSignals} critical signals`}
          icon={ShieldCheck}
          accent={stats.pendingApprovals > 0 ? "text-[var(--color-rag-amber)]" : undefined}
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
                  <AttentionItem key={ws.id} workspace={ws} />
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
                {stats.stageDistribution.map(s => (
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
                {stats.gradeDistribution.map(g => {
                  const maxRevenue = Math.max(...stats.gradeDistribution.map(d => d.revenue));
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
    </div>
  );
}
