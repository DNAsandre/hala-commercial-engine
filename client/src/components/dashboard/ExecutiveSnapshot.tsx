/**
 * Executive Snapshot — Top Row KPI Cards
 * Large metric cards with trend arrows and mini sparklines
 * 
 * DESIGN: Contained KPI cards with overflow protection, responsive text sizing
 */
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, FileCheck, RefreshCw, ShieldAlert, DollarSign } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { Workspace, Customer, Signal } from "@/lib/store";
import { formatSAR, formatSARCompact } from "@/lib/store";

interface ExecutiveSnapshotProps {
  workspaces: Workspace[];
  customers: Customer[];
  signals: Signal[];
  escalationCount: number;
}

function generateSparkline(values: number[]): { v: number }[] {
  return values.map(v => ({ v }));
}

function TrendArrow({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (direction === "down") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function KPICard({ label, value, subtext, trend, sparkData, sparkColor, icon: Icon, accentClass }: {
  label: string;
  value: string;
  subtext: string;
  trend: "up" | "down" | "flat";
  sparkData: { v: number }[];
  sparkColor: string;
  icon: React.ElementType;
  accentClass: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:shadow-md transition-shadow overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{label}</span>
        </div>
        <TrendArrow direction={trend} />
      </div>
      <div className="flex items-end justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold tracking-tight text-foreground leading-none" title={value}>{value}</p>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{subtext}</p>
        </div>
        <div className="w-12 h-7 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={1.5}
                fill={`url(#spark-${label.replace(/\s/g, "")})`}
                dot={false}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveSnapshot({ workspaces, customers, signals, escalationCount }: ExecutiveSnapshotProps) {
  const metrics = useMemo(() => {
    const activeWS = workspaces.filter(w => !["go_live", "handover"].includes(w.stage) && (w.type !== "tender" || !["won", "lost", "withdrawn"].includes(w.tenderStage || "")));
    const totalPipeline = activeWS.reduce((s, w) => s + w.estimatedValue, 0);

    const negotiationWS = workspaces.filter(w => w.stage === "negotiation" || w.stage === "commercial_approved");
    const negotiationCount = negotiationWS.length;

    const redSignals = signals.filter(s => s.severity === "red");
    const revenueAtRisk = workspaces
      .filter(w => redSignals.some(s => s.workspaceId === w.id))
      .reduce((s, w) => s + w.estimatedValue, 0);

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const renewals = customers.filter(c => {
      if (!c.contractExpiry || c.status !== "Active") return false;
      const exp = new Date(c.contractExpiry);
      return exp >= now && exp <= in90Days;
    });
    const renewalRevenue = renewals.reduce((s, c) => s + c.contractValue2025, 0);

    return {
      pipeline: { value: totalPipeline, count: activeWS.length },
      negotiation: { count: negotiationCount, value: negotiationWS.reduce((s, w) => s + w.estimatedValue, 0) },
      atRisk: { value: revenueAtRisk, count: redSignals.length },
      renewals: { count: renewals.length, value: renewalRevenue },
      escalations: { count: escalationCount },
    };
  }, [workspaces, customers, signals, escalationCount]);

  // Simulated sparkline data based on real metrics (trending patterns)
  const pipelineSpark = generateSparkline([45, 52, 48, 61, 58, 72, 68, 75, metrics.pipeline.value / 1000000]);
  const negotiationSpark = generateSparkline([2, 3, 2, 4, 3, 5, 4, metrics.negotiation.count, metrics.negotiation.count]);
  const riskSpark = generateSparkline([8, 12, 6, 15, 10, 8, 14, 11, metrics.atRisk.value / 100000]);
  const renewalSpark = generateSparkline([1, 2, 3, 2, 4, 3, 5, metrics.renewals.count, metrics.renewals.count]);
  const escalationSpark = generateSparkline([0, 1, 2, 1, 3, 2, 4, 3, metrics.escalations.count]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KPICard
        label="Active Pipeline"
        value={formatSARCompact(metrics.pipeline.value)}
        subtext={`${metrics.pipeline.count} active workspaces`}
        trend="up"
        sparkData={pipelineSpark}
        sparkColor="#0d9488"
        icon={DollarSign}
        accentClass="bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
      />
      <KPICard
        label="In Negotiation"
        value={String(metrics.negotiation.count)}
        subtext={formatSARCompact(metrics.negotiation.value)}
        trend={metrics.negotiation.count > 2 ? "up" : "flat"}
        sparkData={negotiationSpark}
        sparkColor="#6366f1"
        icon={FileCheck}
        accentClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
      />
      <KPICard
        label="Revenue at Risk"
        value={formatSARCompact(metrics.atRisk.value)}
        subtext={`${metrics.atRisk.count} red signals`}
        trend={metrics.atRisk.count > 0 ? "down" : "flat"}
        sparkData={riskSpark}
        sparkColor="#ef4444"
        icon={AlertTriangle}
        accentClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      />
      <KPICard
        label="Renewals (90d)"
        value={String(metrics.renewals.count)}
        subtext={formatSARCompact(metrics.renewals.value)}
        trend={metrics.renewals.count > 0 ? "up" : "flat"}
        sparkData={renewalSpark}
        sparkColor="#f59e0b"
        icon={RefreshCw}
        accentClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
      />
      <KPICard
        label="Escalations Open"
        value={String(metrics.escalations.count)}
        subtext={metrics.escalations.count === 0 ? "All clear" : "Requires attention"}
        trend={metrics.escalations.count > 2 ? "down" : "flat"}
        sparkData={escalationSpark}
        sparkColor="#f97316"
        icon={ShieldAlert}
        accentClass="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
      />
    </div>
  );
}
