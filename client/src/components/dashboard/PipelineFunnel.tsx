/**
 * Pipeline Funnel Chart — Deal count and revenue per stage
 * 
 * DESIGN: Contained bar chart with abbreviated x-axis labels, overflow-hidden container
 */
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Workspace, WorkspaceStage } from "@/lib/store";
import { WORKSPACE_STAGES, formatSAR } from "@/lib/store";

interface PipelineFunnelProps {
  workspaces: Workspace[];
  onStageClick?: (stage: WorkspaceStage | null) => void;
  activeStage?: WorkspaceStage | null;
}

const STAGE_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#f59e0b", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#22c55e", "#84cc16", "#65a30d",
];

// Short abbreviations for x-axis
const STAGE_ABBREV: Record<string, string> = {
  "Qualified": "Qual",
  "Solution Design": "Sol.Des",
  "Quoting": "Quote",
  "Proposal Active": "Prop",
  "Negotiation": "Nego",
  "Commercial Approved": "Apprvd",
  "SLA Drafting": "SLA",
  "Contract Ready": "Ready",
  "Contract Sent": "Sent",
  "Contract Signed": "Signed",
  "Go Live": "Live",
  "Handover": "H/O",
};

export default function PipelineFunnel({ workspaces, onStageClick, activeStage }: PipelineFunnelProps) {
  const data = useMemo(() => {
    const commercial = workspaces.filter(w => w.type !== "tender");
    return WORKSPACE_STAGES.map((s, i) => {
      const inStage = commercial.filter(w => w.stage === s.value);
      return {
        stage: s.label,
        stageValue: s.value,
        abbrev: STAGE_ABBREV[s.label] || s.label.slice(0, 5),
        count: inStage.length,
        revenue: inStage.reduce((sum, w) => sum + w.estimatedValue, 0),
        color: STAGE_COLORS[i % STAGE_COLORS.length],
      };
    }).filter(d => d.count > 0 || WORKSPACE_STAGES.findIndex(s => s.label === d.stage) < 6);
  }, [workspaces]);

  const [showRevenue, setShowRevenue] = useState(false);

  const handleBarClick = (entry: any) => {
    if (onStageClick) {
      if (activeStage === entry.stageValue) {
        onStageClick(null); // toggle off
      } else {
        onStageClick(entry.stageValue);
      }
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Deal Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Commercial workspace stages</p>
        </div>
        <button
          onClick={() => setShowRevenue(!showRevenue)}
          className="text-xs px-2.5 py-1 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          {showRevenue ? "Show Count" : "Show Revenue"}
        </button>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 30 }} barSize={28}>
            <XAxis
              dataKey="abbrev"
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              angle={-40}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
              height={45}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={40}
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
              labelFormatter={(label: string) => {
                const match = data.find(d => d.abbrev === label);
                return `Stage: ${match?.stage || label}`;
              }}
            />
            <Bar
              dataKey={showRevenue ? "revenue" : "count"}
              radius={[4, 4, 0, 0]}
              cursor={onStageClick ? "pointer" : undefined}
              onClick={(_: any, index: number) => handleBarClick(data[index])}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={activeStage && activeStage !== entry.stageValue ? 0.35 : 1}
                  stroke={activeStage === entry.stageValue ? "#1a1a1a" : "none"}
                  strokeWidth={activeStage === entry.stageValue ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Funnel summary — horizontal scroll with hidden scrollbar */}
      <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">
        {data.filter(d => d.count > 0).map((d, i, arr) => (
          <div key={d.stage} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onStageClick && handleBarClick(d)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors ${
                activeStage === d.stageValue
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-muted/50 hover:bg-muted"
              }`}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{d.stage}</span>
              <span className="text-[10px] font-bold text-foreground">{d.count}</span>
            </button>
            {i < arr.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
