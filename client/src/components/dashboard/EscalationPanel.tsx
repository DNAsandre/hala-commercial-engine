/**
 * Escalation Intelligence Panel — Severity pie chart, timeline, top risk workspaces
 */
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import type { Signal, Workspace } from "@/lib/store";

interface EscalationPanelProps {
  signals: Signal[];
  workspaces: Workspace[];
}

const SEVERITY_COLORS = {
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#10b981",
};

export default function EscalationPanel({ signals, workspaces }: EscalationPanelProps) {
  const severityData = useMemo(() => {
    const red = signals.filter(s => s.severity === "red").length;
    const amber = signals.filter(s => s.severity === "amber").length;
    const green = signals.filter(s => s.severity === "green").length;
    return [
      { name: "Critical", value: red, color: SEVERITY_COLORS.red },
      { name: "Warning", value: amber, color: SEVERITY_COLORS.amber },
      { name: "Info", value: green, color: SEVERITY_COLORS.green },
    ].filter(d => d.value > 0);
  }, [signals]);

  const timeline = useMemo(() => {
    return [...signals]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map(s => {
        const ws = workspaces.find(w => w.id === s.workspaceId);
        return { ...s, workspaceName: ws?.customerName || ws?.title || s.workspaceId };
      });
  }, [signals, workspaces]);

  const topRiskWS = useMemo(() => {
    const wsSignalCount = new Map<string, { red: number; amber: number; total: number }>();
    signals.forEach(s => {
      const prev = wsSignalCount.get(s.workspaceId) || { red: 0, amber: 0, total: 0 };
      if (s.severity === "red") prev.red++;
      if (s.severity === "amber") prev.amber++;
      prev.total++;
      wsSignalCount.set(s.workspaceId, prev);
    });
    return Array.from(wsSignalCount.entries())
      .map(([wsId, counts]) => {
        const ws = workspaces.find(w => w.id === wsId);
        return { wsId, name: ws?.customerName || wsId, title: ws?.title || "", ...counts };
      })
      .sort((a, b) => b.red - a.red || b.total - a.total)
      .slice(0, 5);
  }, [signals, workspaces]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Escalation Intelligence</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Signal severity, timeline & top risk workspaces</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Severity Pie */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Severity</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            {severityData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-muted-foreground">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Recent Events</p>
          <div className="space-y-2">
            {timeline.map(s => (
              <div key={s.id} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  s.severity === "red" ? "bg-red-500" : s.severity === "amber" ? "bg-amber-500" : "bg-emerald-500"
                }`} />
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground leading-tight truncate">{s.message.slice(0, 60)}…</p>
                  <p className="text-[10px] text-muted-foreground">{s.workspaceName} · {s.createdAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risk Workspaces */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Top Risk</p>
          <div className="space-y-1.5">
            {topRiskWS.map(ws => (
              <Link key={ws.wsId} href={`/workspaces/${ws.wsId}`}>
                <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ws.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{ws.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {ws.red > 0 && (
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">{ws.red}</span>
                    )}
                    {ws.amber > 0 && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">{ws.amber}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
