import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Building2, FileSpreadsheet, Hash,
  LineChart, TrendingDown, TrendingUp,
} from "lucide-react";
import {
  CommercialOsShell,
  DataTable,
  EmptySourceState,
  ErrorState,
  LoadingState,
  MetricCard,
  SourceCell,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import {
  fetchCustomerMaster,
  type CustomerMasterRow,
  type RevenueActualRow,
} from "@/lib/commercial-os-data";

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);
}
function fmtMonth(v: string) {
  if (!v) return "--";
  const d = new Date(v.length === 7 ? `${v}-01T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d);
}

// ─── TASK 2: Summary helpers (all pure, read-only) ───

interface RevenueSummary {
  totalAmount: number;
  totalYtd: number;
  rowCount: number;
  uniqueCustomers: number;
  uniqueGlCodes: number;
  uniqueMonths: number;
  byCustomer: { name: string; amount: number; ytd: number; rows: number }[];
  byMonth: { month: string; amount: number; rows: number }[];
  byGlCode: { code: string; amount: number; rows: number }[];
  byRevenueType: { type: string; amount: number; rows: number }[];
  monthOverMonth: { month: string; amount: number; prevAmount: number; delta: number; deltaPct: number }[];
}

function computeRevenueSummary(rows: RevenueActualRow[]): RevenueSummary {
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalYtd = Math.max(...rows.map(r => r.ytdAmount || 0), 0);

  // By customer
  const custMap = new Map<string, { amount: number; ytd: number; rows: number }>();
  for (const r of rows) {
    const key = r.customerName || "Unknown";
    const prev = custMap.get(key) || { amount: 0, ytd: 0, rows: 0 };
    custMap.set(key, { amount: prev.amount + r.amount, ytd: Math.max(prev.ytd, r.ytdAmount || 0), rows: prev.rows + 1 });
  }
  const byCustomer = Array.from(custMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // By month
  const monthMap = new Map<string, { amount: number; rows: number }>();
  for (const r of rows) {
    const key = r.month || "Unknown";
    const prev = monthMap.get(key) || { amount: 0, rows: 0 };
    monthMap.set(key, { amount: prev.amount + r.amount, rows: prev.rows + 1 });
  }
  const byMonth = Array.from(monthMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // By GL code
  const glMap = new Map<string, { amount: number; rows: number }>();
  for (const r of rows) {
    const key = r.glCode || "Unknown";
    const prev = glMap.get(key) || { amount: 0, rows: 0 };
    glMap.set(key, { amount: prev.amount + r.amount, rows: prev.rows + 1 });
  }
  const byGlCode = Array.from(glMap.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // By revenue type
  const typeMap = new Map<string, { amount: number; rows: number }>();
  for (const r of rows) {
    const key = r.revenueType || "Unknown";
    const prev = typeMap.get(key) || { amount: 0, rows: 0 };
    typeMap.set(key, { amount: prev.amount + r.amount, rows: prev.rows + 1 });
  }
  const byRevenueType = Array.from(typeMap.entries())
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // Month-over-month
  const monthOverMonth: RevenueSummary['monthOverMonth'] = [];
  for (let i = 0; i < byMonth.length; i++) {
    const prev = i > 0 ? byMonth[i - 1]!.amount : 0;
    const delta = byMonth[i]!.amount - prev;
    const deltaPct = prev > 0 ? (delta / prev) * 100 : 0;
    monthOverMonth.push({ month: byMonth[i]!.month, amount: byMonth[i]!.amount, prevAmount: prev, delta, deltaPct });
  }

  return {
    totalAmount,
    totalYtd,
    rowCount: rows.length,
    uniqueCustomers: custMap.size,
    uniqueGlCodes: glMap.size,
    uniqueMonths: monthMap.size,
    byCustomer,
    byMonth,
    byGlCode,
    byRevenueType,
    monthOverMonth,
  };
}

// ─── Customer link readiness ───
interface CustomerLinkStatus {
  customerName: string;
  status: 'linked' | 'unmatched' | 'needs_review';
  masterName?: string;
}

function computeCustomerLinkReadiness(
  revenueCustomers: string[],
  masterRows: CustomerMasterRow[],
): CustomerLinkStatus[] {
  const masterNames = new Set(masterRows.map(m => m.canonicalName.toLowerCase()));
  const masterDisplay = new Map(masterRows.map(m => [m.canonicalName.toLowerCase(), m.displayName]));
  const needsReview = new Set(masterRows.filter(m => m.sourceConfidence === 'needs_review').map(m => m.canonicalName.toLowerCase()));

  return revenueCustomers.map(name => {
    const lower = name.toLowerCase().trim();
    if (needsReview.has(lower)) {
      return { customerName: name, status: 'needs_review' as const, masterName: masterDisplay.get(lower) };
    }
    if (masterNames.has(lower)) {
      return { customerName: name, status: 'linked' as const, masterName: masterDisplay.get(lower) };
    }
    // Partial match
    const partial = masterRows.find(m => m.canonicalName.toLowerCase().includes(lower) || lower.includes(m.canonicalName.toLowerCase()));
    if (partial) {
      return { customerName: name, status: 'needs_review' as const, masterName: partial.displayName };
    }
    return { customerName: name, status: 'unmatched' as const };
  });
}

export default function CommercialOsRevenue() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = data.revenueActuals;

  const [customerMaster, setCustomerMaster] = useState<CustomerMasterRow[]>([]);
  const [cmLoaded, setCmLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCustomerMaster()
      .then(cm => { if (mounted) { setCustomerMaster(cm); setCmLoaded(true); } })
      .catch(() => { if (mounted) setCmLoaded(true); });
    return () => { mounted = false; };
  }, []);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    return computeRevenueSummary(rows);
  }, [rows]);

  const linkReadiness = useMemo(() => {
    if (!cmLoaded || !summary) return [];
    const names = summary.byCustomer.map(c => c.name);
    return computeCustomerLinkReadiness(names, customerMaster);
  }, [summary, customerMaster, cmLoaded]);

  return (
    <CommercialOsShell
      title="Revenue Actuals Intelligence"
      description={`Historical imported actuals for batch ${batchId}. Future source: LFS / Finance API.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="revenue actuals" /> : error ? <ErrorState error={error} /> : null}

        {!loading && !error && rows.length === 0 && <EmptySourceState label="Revenue actuals" />}

        {!loading && !error && summary && (
          <>
            {/* Labels */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">FIN-001</Badge>
              <Badge variant="outline" className="text-[10px]">Historical imported actuals</Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">Future source: LFS / Finance</Badge>
              <span className="ml-auto text-[10px] text-muted-foreground">Read-only · No writes · No CRM</span>
            </div>

            {/* 1. Revenue Summary */}
            <Card className="shadow-none border-emerald-200">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold">Revenue Summary</p>
                  <Badge variant="outline" className="text-[10px]">{summary.rowCount} rows</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <MetricCard label="Total Revenue" value={fmt(summary.totalAmount)} helper="Sum of all monthly amounts" />
                  <MetricCard label="Peak YTD" value={fmt(summary.totalYtd)} helper="Highest YTD value across rows" />
                  <MetricCard label="Customers" value={String(summary.uniqueCustomers)} helper="Unique customer names" />
                  <MetricCard label="GL Codes" value={String(summary.uniqueGlCodes)} helper="Unique GL accounts" />
                  <MetricCard label="Months" value={String(summary.uniqueMonths)} helper="Months with data" />
                  <MetricCard label="Revenue Types" value={String(summary.byRevenueType.length)} helper="Distinct revenue categories" />
                </div>
              </CardContent>
            </Card>

            {/* 2. Monthly Revenue + MoM */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Monthly Revenue</p>
                  <Badge variant="outline" className="text-[10px]">{summary.byMonth.length} months</Badge>
                </div>
                <DataTable columns={["Month", "Amount", "Prev Month", "Delta", "MoM %", "Rows"]}>
                  {summary.monthOverMonth.map(m => (
                    <tr key={m.month} className="text-xs">
                      <td className="px-3 py-2 font-medium">{fmtMonth(m.month)}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(m.amount)}</td>
                      <td className="px-3 py-2 font-mono text-right text-muted-foreground">{m.prevAmount > 0 ? fmt(m.prevAmount) : "--"}</td>
                      <td className={`px-3 py-2 font-mono text-right ${m.delta < 0 ? 'text-red-700' : m.delta > 0 ? 'text-emerald-700' : ''}`}>
                        {m.prevAmount > 0 ? (m.delta >= 0 ? '+' : '') + fmt(m.delta) : "--"}
                      </td>
                      <td className={`px-3 py-2 font-mono text-right ${m.deltaPct < 0 ? 'text-red-700' : m.deltaPct > 0 ? 'text-emerald-700' : ''}`}>
                        {m.prevAmount > 0 ? `${m.deltaPct >= 0 ? '+' : ''}${m.deltaPct.toFixed(1)}%` : "--"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{summary.byMonth.find(b => b.month === m.month)?.rows ?? 0}</td>
                    </tr>
                  ))}
                </DataTable>
              </CardContent>
            </Card>

            {/* 3. Customer Revenue Ranking */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Customer Revenue Ranking</p>
                  <Badge variant="outline" className="text-[10px]">{summary.uniqueCustomers} customers</Badge>
                </div>
                <DataTable columns={["#", "Customer", "Total Revenue", "Peak YTD", "Rows", "Share %"]}>
                  {summary.byCustomer.slice(0, 20).map((c, i) => (
                    <tr key={c.name} className="text-xs">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(c.amount)}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(c.ytd)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{c.rows}</td>
                      <td className="px-3 py-2 font-mono text-right">{summary.totalAmount > 0 ? ((c.amount / summary.totalAmount) * 100).toFixed(1) + '%' : '--'}</td>
                    </tr>
                  ))}
                </DataTable>
                {summary.byCustomer.length > 20 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">Showing top 20 of {summary.byCustomer.length} customers</p>
                )}
              </CardContent>
            </Card>

            {/* 4. GL Code View */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">GL Code View</p>
                  <Badge variant="outline" className="text-[10px]">{summary.uniqueGlCodes} codes</Badge>
                </div>
                <DataTable columns={["GL Code", "Total Amount", "Rows", "Share %"]}>
                  {summary.byGlCode.map(g => (
                    <tr key={g.code} className="text-xs">
                      <td className="px-3 py-2 font-medium font-mono">{g.code}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(g.amount)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{g.rows}</td>
                      <td className="px-3 py-2 font-mono text-right">{summary.totalAmount > 0 ? ((g.amount / summary.totalAmount) * 100).toFixed(1) + '%' : '--'}</td>
                    </tr>
                  ))}
                </DataTable>
              </CardContent>
            </Card>

            {/* Revenue Type Breakdown */}
            {summary.byRevenueType.length > 1 && (
              <Card className="shadow-none">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-semibold">Revenue Type Breakdown</p>
                  </div>
                  <DataTable columns={["Revenue Type", "Total Amount", "Rows", "Share %"]}>
                    {summary.byRevenueType.map(t => (
                      <tr key={t.type} className="text-xs">
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{t.type}</Badge></td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(t.amount)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{t.rows}</td>
                        <td className="px-3 py-2 font-mono text-right">{summary.totalAmount > 0 ? ((t.amount / summary.totalAmount) * 100).toFixed(1) + '%' : '--'}</td>
                      </tr>
                    ))}
                  </DataTable>
                </CardContent>
              </Card>
            )}

            {/* TASK 4: Customer Link Readiness */}
            {cmLoaded && linkReadiness.length > 0 && (
              <Card className="shadow-none border-violet-200">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-violet-700" />
                    <p className="text-sm font-semibold">Customer Link Readiness</p>
                    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">
                      {linkReadiness.filter(l => l.status === 'linked').length} linked
                    </Badge>
                    {linkReadiness.filter(l => l.status === 'unmatched').length > 0 && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                        {linkReadiness.filter(l => l.status === 'unmatched').length} unmatched
                      </Badge>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">Read-only — does not force links</span>
                  </div>
                  <DataTable columns={["Revenue Customer", "Status", "Master Match"]}>
                    {linkReadiness.map(l => {
                      const cls: Record<string, string> = {
                        linked: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        unmatched: 'border-zinc-200 bg-zinc-50 text-zinc-500',
                        needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
                      };
                      return (
                        <tr key={l.customerName} className="text-xs">
                          <td className="px-3 py-2 font-medium">{l.customerName}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className={`text-[10px] ${cls[l.status]}`}>{l.status}</Badge></td>
                          <td className="px-3 py-2 text-muted-foreground">{l.masterName || "--"}</td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </CardContent>
              </Card>
            )}

            {/* 5. Source Traceability */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-semibold">Source Traceability</p>
                  <Badge variant="outline" className="text-[10px]">{summary.rowCount} rows</Badge>
                </div>
                <DataTable columns={["GL Code", "Customer", "Month", "Amount", "YTD", "Period Year", "Type", "Source"]}>
                  {rows.map(row => (
                    <tr key={row.id} className="text-xs">
                      <td className="px-3 py-2 font-mono">{row.glCode || "--"}</td>
                      <td className="px-3 py-2 font-medium">{row.customerName || "--"}</td>
                      <td className="px-3 py-2">{fmtMonth(row.month)}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(row.amount)}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(row.ytdAmount)}</td>
                      <td className="px-3 py-2">{row.periodYear ?? "--"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{row.revenueType || "--"}</Badge></td>
                      <td className="px-3 py-2"><SourceCell {...row} /></td>
                    </tr>
                  ))}
                </DataTable>
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>• Historical imported actuals — not formulas</span>
                  <span>• Future source: LFS / Finance API</span>
                  <span>• No values are inferred or interpolated</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
