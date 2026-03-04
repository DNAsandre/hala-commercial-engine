/**
 * Renewal Exposure Chart — Bar chart showing contract renewals by time bucket
 *
 * DESIGN: Compact bar chart with overflow-hidden container
 */
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Customer } from "@/lib/store";
import { formatSAR } from "@/lib/store";

interface RenewalExposureProps {
  customers: Customer[];
}

const BUCKET_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

export default function RenewalExposure({ customers }: RenewalExposureProps) {
  const data = useMemo(() => {
    const now = Date.now();
    const buckets = [
      { label: "0-30d", min: 0, max: 30, count: 0, revenue: 0 },
      { label: "30-60d", min: 30, max: 60, count: 0, revenue: 0 },
      { label: "60-90d", min: 60, max: 90, count: 0, revenue: 0 },
      { label: "90-180d", min: 90, max: 180, count: 0, revenue: 0 },
    ];

    customers.filter(c => c.status === "Active" && c.contractExpiry).forEach(c => {
      const days = (new Date(c.contractExpiry).getTime() - now) / (1000 * 60 * 60 * 24);
      if (days < 0) return; // already expired
      for (const b of buckets) {
        if (days >= b.min && days < b.max) {
          b.count++;
          b.revenue += c.contractValue2025;
          break;
        }
      }
    });

    return buckets;
  }, [customers]);

  const totalRenewals = data.reduce((s, d) => s + d.count, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Renewal Exposure</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{totalRenewals} contracts · {formatSAR(totalRevenue)}</p>
        </div>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }} barSize={36}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={40}
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
              formatter={(value: number) => [formatSAR(value), "Revenue"]}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={BUCKET_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: BUCKET_COLORS[i] }} />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d.label}: {d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
