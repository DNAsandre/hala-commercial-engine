/**
 * SLA Compliance Chart — Donut showing breaches, near-breach, and healthy SLAs
 *
 * DESIGN: Compact donut with contained legend, overflow-hidden
 */
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Signal, Workspace } from "@/lib/store";

interface SLAComplianceProps {
  signals: Signal[];
  workspaces: Workspace[];
}

const SLA_COLORS = {
  breached: "#ef4444",
  nearBreach: "#f59e0b",
  healthy: "#10b981",
};

export default function SLACompliance({ signals, workspaces }: SLAComplianceProps) {
  const data = useMemo(() => {
    // Derive SLA health from signals and workspace data
    const activeWS = workspaces.filter(w => w.stage !== "go_live" && (w.type !== "tender" || !["won", "lost", "withdrawn"].includes(w.tenderStage || "")));

    let breached = 0;
    let nearBreach = 0;
    let healthy = 0;

    activeWS.forEach(w => {
      const wsSignals = signals.filter(s => s.workspaceId === w.id);
      const hasRed = wsSignals.some(s => s.severity === "red");
      const hasAmber = wsSignals.some(s => s.severity === "amber");

      if (hasRed) breached++;
      else if (hasAmber) nearBreach++;
      else healthy++;
    });

    return [
      { name: "Breached", value: breached, color: SLA_COLORS.breached },
      { name: "Near Breach", value: nearBreach, color: SLA_COLORS.nearBreach },
      { name: "Healthy", value: healthy, color: SLA_COLORS.healthy },
    ].filter(d => d.value > 0);
  }, [signals, workspaces]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const healthyPct = total > 0 ? Math.round((data.find(d => d.name === "Healthy")?.value || 0) / total * 100) : 100;

  return (
    <div className="bg-card border border-border rounded-xl p-5 overflow-hidden">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">SLA Performance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Last 90 days compliance</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={58}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, i) => (
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
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{healthyPct}%</p>
              <p className="text-[10px] text-muted-foreground">Healthy</p>
            </div>
          </div>
        </div>
        <div className="space-y-2.5 flex-1 min-w-0">
          {data.map(d => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-foreground truncate">{d.name}</span>
              </div>
              <span className="text-sm font-bold text-foreground shrink-0">{d.value}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Workspaces</span>
              <span className="text-sm font-bold text-foreground">{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
