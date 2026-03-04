/**
 * Revenue Forecast Chart — 12-month projection with committed, forecast, and pipeline
 */
import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Workspace, Customer } from "@/lib/store";
import { formatSAR } from "@/lib/store";

interface RevenueForecastProps {
  workspaces: Workspace[];
  customers: Customer[];
}

export default function RevenueForecast({ workspaces, customers }: RevenueForecastProps) {
  const data = useMemo(() => {
    const now = new Date();
    const months: { month: string; committed: number; forecast: number; pipeline: number }[] = [];

    // Committed = signed contracts (monthly revenue from active customers)
    const signedWS = workspaces.filter(w => ["contract_signed", "go_live", "handover"].includes(w.stage));
    const monthlyCommitted = signedWS.reduce((s, w) => s + w.estimatedValue / 12, 0);

    // Forecast = deals in negotiation/approved (weighted by stage probability)
    const stageProbability: Record<string, number> = {
      negotiation: 0.5,
      commercial_approved: 0.7,
      sla_drafting: 0.8,
      contract_ready: 0.9,
      contract_sent: 0.95,
    };
    const forecastWS = workspaces.filter(w => Object.keys(stageProbability).includes(w.stage));
    const monthlyForecast = forecastWS.reduce((s, w) => {
      const prob = stageProbability[w.stage] || 0.5;
      return s + (w.estimatedValue / 12) * prob;
    }, 0);

    // Pipeline = earlier stage deals
    const pipelineWS = workspaces.filter(w =>
      ["qualified", "solution_design", "quoting", "proposal_active"].includes(w.stage)
    );
    const monthlyPipeline = pipelineWS.reduce((s, w) => s + (w.estimatedValue / 12) * 0.2, 0);

    // Active customer base revenue
    const activeCustomerMonthly = customers
      .filter(c => c.status === "Active")
      .reduce((s, c) => s + c.expectedMonthlyRevenue, 0);

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      // Committed grows slightly with renewals, forecast decays over time
      const decay = Math.max(0.3, 1 - i * 0.05);
      months.push({
        month: label,
        committed: Math.round(activeCustomerMonthly + monthlyCommitted),
        forecast: Math.round(monthlyForecast * decay),
        pipeline: Math.round(monthlyPipeline * decay * 0.8),
      });
    }
    return months;
  }, [workspaces, customers]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Revenue Forecast</h3>
        <p className="text-xs text-muted-foreground mt-0.5">12-month projection — committed, forecast & pipeline</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="grad-committed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-forecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-pipeline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              formatter={(value: number, name: string) => [formatSAR(value), name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingBottom: "8px" }}
            />
            <Area type="monotone" dataKey="committed" stroke="#10b981" strokeWidth={2} fill="url(#grad-committed)" dot={false} />
            <Area type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2} fill="url(#grad-forecast)" dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="pipeline" stroke="#f59e0b" strokeWidth={1.5} fill="url(#grad-pipeline)" dot={false} strokeDasharray="2 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
