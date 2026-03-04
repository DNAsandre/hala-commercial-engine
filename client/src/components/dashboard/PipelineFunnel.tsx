/**
 * Pipeline Funnel Chart — Deal count and revenue per stage
 */
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Workspace } from "@/lib/store";
import { WORKSPACE_STAGES, formatSAR } from "@/lib/store";

interface PipelineFunnelProps {
  workspaces: Workspace[];
}

const STAGE_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#f59e0b", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#22c55e", "#84cc16", "#65a30d",
];

export default function PipelineFunnel({ workspaces }: PipelineFunnelProps) {
  const data = useMemo(() => {
    const commercial = workspaces.filter(w => w.type !== "tender");
    return WORKSPACE_STAGES.map((s, i) => {
      const inStage = commercial.filter(w => w.stage === s.value);
      return {
        stage: s.label,
        shortLabel: s.label.length > 12 ? s.label.slice(0, 10) + "…" : s.label,
        count: inStage.length,
        revenue: inStage.reduce((sum, w) => sum + w.estimatedValue, 0),
        color: STAGE_COLORS[i % STAGE_COLORS.length],
      };
    }).filter(d => d.count > 0 || WORKSPACE_STAGES.findIndex(s => s.label === d.stage) < 6);
  }, [workspaces]);

  const [showRevenue, setShowRevenue] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Deal Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Commercial workspace stages</p>
        </div>
        <button
          onClick={() => setShowRevenue(!showRevenue)}
          className="text-xs px-2.5 py-1 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
        >
          {showRevenue ? "Show Count" : "Show Revenue"}
        </button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 40 }} barSize={32}>
            <XAxis
              dataKey="shortLabel"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              angle={-35}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={showRevenue ? (v: number) => `${(v / 1000000).toFixed(1)}M` : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              formatter={(value: number, name: string) => {
                if (showRevenue) return [formatSAR(value), "Revenue"];
                return [value, "Deals"];
              }}
              labelFormatter={(label: string) => `Stage: ${label}`}
            />
            <Bar dataKey={showRevenue ? "revenue" : "count"} radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Funnel summary */}
      <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
        {data.filter(d => d.count > 0).map((d, i, arr) => (
          <div key={d.stage} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{d.stage}</span>
              <span className="text-[10px] font-bold text-foreground">{d.count}</span>
            </div>
            {i < arr.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

