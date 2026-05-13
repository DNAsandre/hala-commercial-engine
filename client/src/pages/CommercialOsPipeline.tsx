import { useState, useMemo } from "react";
import { AlertTriangle, Calendar, ChevronDown, ChevronRight, Scale, ShieldCheck } from "lucide-react";
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

// ─── Formatters ──────────────────────────────────────────────

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

function fmtDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function fmtVolume(value: number, unit: string) {
  return value ? `${fmt(value)} ${unit}` : "--";
}

function fmtMonth(month: string) {
  // "2026-07" → "Jul 26"
  const [y, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parseInt(m, 10) - 1] || m} ${y.slice(2)}`;
}

// ─── Phasing Data Model ──────────────────────────────────────

interface PhasingRow {
  month: string;
  revenue: number;
  weighted: number;
}

interface PhasingSummary {
  rows: PhasingRow[];
  cy2026Total: number;
  cy2027Total: number;
  grandTotal: number;
  weightedCy2026: number;
  weightedCy2027: number;
  weightedGrandTotal: number;
  goLiveMonth: string;
}

function buildPhasingMap(rawPhasing: any[]): Map<string, PhasingSummary> {
  // Group raw phasing rows by opportunity_id
  const grouped = new Map<string, PhasingRow[]>();
  for (const row of rawPhasing) {
    const oppId = row.opportunity_id || "";
    if (!grouped.has(oppId)) grouped.set(oppId, []);
    grouped.get(oppId)!.push({
      month: row.month || "",
      revenue: Number(row.revenue_amount) || 0,
      weighted: Number(row.weighted_amount) || 0,
    });
  }

  const result = new Map<string, PhasingSummary>();
  for (const [oppId, rows] of grouped) {
    const sorted = rows.sort((a, b) => a.month.localeCompare(b.month));
    const cy2026 = sorted.filter((r) => r.month.startsWith("2026"));
    const cy2027 = sorted.filter((r) => r.month.startsWith("2027"));
    result.set(oppId, {
      rows: sorted,
      cy2026Total: cy2026.reduce((s, r) => s + r.revenue, 0),
      cy2027Total: cy2027.reduce((s, r) => s + r.revenue, 0),
      grandTotal: sorted.reduce((s, r) => s + r.revenue, 0),
      weightedCy2026: cy2026.reduce((s, r) => s + r.weighted, 0),
      weightedCy2027: cy2027.reduce((s, r) => s + r.weighted, 0),
      weightedGrandTotal: sorted.reduce((s, r) => s + r.weighted, 0),
      goLiveMonth: sorted.length > 0 ? sorted[0].month : "",
    });
  }
  return result;
}

// ─── Phasing Expansion Row ───────────────────────────────────

function PhasingDetail({ phasing, goLiveDate, colSpan }: { phasing: PhasingSummary; goLiveDate: string; colSpan: number }) {
  const goLiveMonthStr = goLiveDate ? goLiveDate.slice(0, 7) : phasing.goLiveMonth;

  return (
    <tr>
      <td colSpan={colSpan} className="bg-slate-50/80 px-3 py-0">
        <div className="py-3">
          {/* Header */}
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-foreground">Monthly Phasing</span>
            <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-500">
              Go-live triggered · ACV/12 from {fmtMonth(goLiveMonthStr)} · Read-only
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">
              {phasing.rows.length} months
            </Badge>
          </div>

          {/* Summary Cards */}
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div className="rounded border bg-white px-2.5 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CY 2026</p>
              <p className="text-xs font-semibold text-foreground">{fmt(phasing.cy2026Total)}</p>
            </div>
            <div className="rounded border bg-white px-2.5 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CY 2027</p>
              <p className="text-xs font-semibold text-foreground">{fmt(phasing.cy2027Total)}</p>
            </div>
            <div className="rounded border bg-white px-2.5 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Grand Total</p>
              <p className="text-xs font-bold text-foreground">{fmt(phasing.grandTotal)}</p>
            </div>
            <div className="rounded border border-blue-100 bg-blue-50/50 px-2.5 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">Wtd CY 2026</p>
              <p className="text-xs font-semibold text-blue-700">{fmt(phasing.weightedCy2026)}</p>
            </div>
            <div className="rounded border border-blue-100 bg-blue-50/50 px-2.5 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">Wtd CY 2027</p>
              <p className="text-xs font-semibold text-blue-700">{fmt(phasing.weightedCy2027)}</p>
            </div>
            <div className="rounded border border-blue-100 bg-blue-50/50 px-2.5 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">Wtd Grand</p>
              <p className="text-xs font-bold text-blue-700">{fmt(phasing.weightedGrandTotal)}</p>
            </div>
          </div>

          {/* Month-by-Month Table */}
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Month</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {phasing.rows.map((row) => {
                  const isGoLive = row.month === goLiveMonthStr;
                  const isBeforeGoLive = row.month < goLiveMonthStr;
                  const isNewYear = row.month === "2027-01";
                  return (
                    <tr
                      key={row.month}
                      className={[
                        "border-b last:border-0",
                        isGoLive ? "bg-emerald-50/60" : "",
                        isBeforeGoLive ? "bg-zinc-50 text-muted-foreground" : "",
                        isNewYear ? "border-t-2 border-t-slate-300" : "",
                      ].join(" ")}
                    >
                      <td className="px-2 py-1 font-mono">
                        <span className="mr-1.5">{fmtMonth(row.month)}</span>
                        {isGoLive && (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700">
                            GO-LIVE
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-mono">{fmt(row.revenue)}</td>
                      <td className="px-2 py-1 text-right font-mono text-blue-700">{fmt(row.weighted)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-2 py-1.5">Grand Total</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(phasing.grandTotal)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-blue-700">{fmt(phasing.weightedGrandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── RECON-001: Cross-Layer Reconciliation ───────────────────

type ReconStatus = "match" | "rounding" | "warning" | "mismatch" | "no_phasing";

interface ReconRow {
  oppId: string;
  customerName: string;
  stage: string;
  probabilityPct: number;
  oppWeighted: number;
  phasingWeighted: number;
  weightedDelta: number;
  weightedDeltaPct: number;
  expectedCy: number;
  phasingCy: number;
  cyDelta: number;
  status: ReconStatus;
}

function classifyRecon(delta: number, base: number): ReconStatus {
  if (base === 0 && delta === 0) return "match";
  if (base === 0) return "mismatch";
  const pct = Math.abs(delta / base) * 100;
  if (Math.abs(delta) <= 1) return "match";
  if (pct <= 0.5) return "rounding";
  if (pct <= 1) return "warning";
  return "mismatch";
}

function reconBadge(status: ReconStatus) {
  switch (status) {
    case "match":
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Match</Badge>;
    case "rounding":
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">Rounding</Badge>;
    case "warning":
      return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">Warning</Badge>;
    case "mismatch":
      return <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">Mismatch</Badge>;
    case "no_phasing":
      return <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-500">No Phasing</Badge>;
  }
}

function buildReconRows(
  opportunities: { id: string; customerName: string; stage: string; probabilityPct: number; acvAnnual: number; weightedTotal: number; expectedRevenueCy: number }[],
  phasingMap: Map<string, PhasingSummary>,
): ReconRow[] {
  return opportunities.map((opp) => {
    const phasing = phasingMap.get(opp.id);
    if (!phasing || phasing.rows.length === 0) {
      return {
        oppId: opp.id,
        customerName: opp.customerName,
        stage: opp.stage,
        probabilityPct: opp.probabilityPct,
        oppWeighted: opp.weightedTotal,
        phasingWeighted: 0,
        weightedDelta: 0,
        weightedDeltaPct: 0,
        expectedCy: opp.expectedRevenueCy,
        phasingCy: 0,
        cyDelta: 0,
        status: "no_phasing" as ReconStatus,
      };
    }
    const phasingWeighted = phasing.weightedGrandTotal;
    const weightedDelta = phasingWeighted - opp.weightedTotal;
    const weightedDeltaPct = opp.weightedTotal !== 0 ? (weightedDelta / opp.weightedTotal) * 100 : 0;
    const phasingCy = phasing.weightedCy2026;
    const cyDelta = phasingCy - opp.expectedRevenueCy;
    const status = classifyRecon(weightedDelta, opp.weightedTotal);
    return {
      oppId: opp.id,
      customerName: opp.customerName,
      stage: opp.stage,
      probabilityPct: opp.probabilityPct,
      oppWeighted: opp.weightedTotal,
      phasingWeighted,
      weightedDelta,
      weightedDeltaPct: Math.round(weightedDeltaPct * 100) / 100,
      expectedCy: opp.expectedRevenueCy,
      phasingCy,
      cyDelta,
      status,
    };
  });
}

function fmtDelta(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${fmt(value)}`;
}

function ReconSection({ reconRows }: { reconRows: ReconRow[] }) {
  const [showRecon, setShowRecon] = useState(false);
  const matches = reconRows.filter((r) => r.status === "match").length;
  const rounding = reconRows.filter((r) => r.status === "rounding").length;
  const warnings = reconRows.filter((r) => r.status === "warning").length;
  const mismatches = reconRows.filter((r) => r.status === "mismatch").length;
  const noPhasing = reconRows.filter((r) => r.status === "no_phasing").length;
  const totalOppWeighted = reconRows.reduce((s, r) => s + r.oppWeighted, 0);
  const totalPhasingWeighted = reconRows.reduce((s, r) => s + r.phasingWeighted, 0);
  const totalDelta = totalPhasingWeighted - totalOppWeighted;

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-violet-600" />
            <p className="text-sm font-semibold text-foreground">Cross-Layer Reconciliation</p>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">RECON-001</Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
              Read-only · Opportunity layer vs phasing layer · Does not mutate data
            </Badge>
          </div>
          <button
            onClick={() => setShowRecon(!showRecon)}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {showRecon ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showRecon ? "Hide" : "Show"} per-deal detail
          </button>
        </div>

        {/* Summary Cards */}
        <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded border bg-emerald-50/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">Match</p>
            <p className="text-sm font-bold text-emerald-700">{matches}</p>
          </div>
          <div className="rounded border bg-blue-50/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">Rounding</p>
            <p className="text-sm font-bold text-blue-700">{rounding}</p>
          </div>
          <div className="rounded border bg-amber-50/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Warning</p>
            <p className="text-sm font-bold text-amber-700">{warnings}</p>
          </div>
          <div className="rounded border bg-red-50/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">Mismatch</p>
            <p className="text-sm font-bold text-red-700">{mismatches}</p>
          </div>
          <div className="rounded border bg-zinc-50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">No Phasing</p>
            <p className="text-sm font-bold text-zinc-600">{noPhasing}</p>
          </div>
          <div className="rounded border bg-violet-50/50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-violet-600">Net Delta</p>
            <p className={`text-sm font-bold ${totalDelta === 0 ? "text-emerald-700" : Math.abs(totalDelta) < 100 ? "text-blue-700" : "text-red-700"}`}>
              {fmtDelta(totalDelta)}
            </p>
          </div>
        </div>

        {/* Totals Row */}
        <div className="flex flex-wrap items-center gap-4 rounded border bg-slate-50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Checked: <strong className="text-foreground">{reconRows.length}</strong></span>
          <span className="text-muted-foreground">Opp Weighted Total: <strong className="font-mono text-foreground">{fmt(totalOppWeighted)}</strong></span>
          <span className="text-muted-foreground">Phasing Weighted Total: <strong className="font-mono text-foreground">{fmt(totalPhasingWeighted)}</strong></span>
          <span className="text-muted-foreground">
            Delta: <strong className={`font-mono ${totalDelta === 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtDelta(totalDelta)}</strong>
          </span>
        </div>

        {/* Per-Deal Detail Table */}
        {showRecon && (
          <div className="mt-3 overflow-x-auto rounded border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</th>
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prob</th>
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Opp Weighted</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Phasing Weighted</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Δ Weighted</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Δ %</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expected CY</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Phasing CY</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Δ CY</th>
                </tr>
              </thead>
              <tbody>
                {reconRows.map((r) => (
                  <tr key={r.oppId} className={`border-b last:border-0 ${r.status === "mismatch" ? "bg-red-50/40" : r.status === "warning" ? "bg-amber-50/30" : ""}`}>
                    <td className="max-w-48 truncate px-2 py-1.5 font-medium">{r.customerName}</td>
                    <td className="px-2 py-1.5"><Badge variant="outline" className="text-[9px]">{r.stage}</Badge></td>
                    <td className="px-2 py-1.5">{r.probabilityPct}%</td>
                    <td className="px-2 py-1.5">{reconBadge(r.status)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(r.oppWeighted)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(r.phasingWeighted)}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${r.weightedDelta === 0 ? "text-emerald-700" : Math.abs(r.weightedDeltaPct) <= 0.5 ? "text-blue-700" : "text-red-700"}`}>
                      {fmtDelta(r.weightedDelta)}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${Math.abs(r.weightedDeltaPct) <= 0.5 ? "text-blue-700" : r.weightedDeltaPct === 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {r.status === "no_phasing" ? "--" : `${r.weightedDeltaPct >= 0 ? "+" : ""}${r.weightedDeltaPct}%`}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(r.expectedCy)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(r.phasingCy)}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${r.cyDelta === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                      {r.status === "no_phasing" ? "--" : fmtDelta(r.cyDelta)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-2 py-2" colSpan={3}>Totals</td>
                  <td className="px-2 py-2">
                    <ShieldCheck className="inline h-3.5 w-3.5 text-emerald-600" />
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{fmt(totalOppWeighted)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmt(totalPhasingWeighted)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totalDelta === 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtDelta(totalDelta)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function CommercialOsPipeline() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = data.opportunities;

  const phasingMap = useMemo(() => buildPhasingMap(data.monthlyPhasing), [data.monthlyPhasing]);

  const totalAcv = rows.reduce((sum, row) => sum + row.acvAnnual, 0);
  const weightedPipeline = rows.reduce((sum, row) => sum + row.weightedTotal, 0);
  const materializing = rows.filter((row) => row.probabilityPct >= 75).reduce((sum, row) => sum + row.weightedTotal, 0);

  // Phasing summary metrics
  const phasingOpps = Array.from(phasingMap.keys()).length;
  const totalPhasingRows = data.monthlyPhasing.length;
  const totalPhasingRevenue = Array.from(phasingMap.values()).reduce((s, p) => s + p.grandTotal, 0);
  const totalPhasingWeighted = Array.from(phasingMap.values()).reduce((s, p) => s + p.weightedGrandTotal, 0);

  // Reconciliation
  const reconRows = useMemo(() => buildReconRows(rows, phasingMap), [rows, phasingMap]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const COL_COUNT = 16;

  return (
    <CommercialOsShell
      title="Warehouse Pipeline"
      description={`Live read-only opportunity table for import batch ${batchId}.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="pipeline rows" /> : error ? <ErrorState error={error} /> : null}

        {/* Pipeline KPI Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Opportunity Count" value={String(rows.length)} helper="commercial_opportunities" />
          <MetricCard label="Total ACV" value={fmt(totalAcv)} helper="Sum of acv_annual" />
          <MetricCard label="Weighted Pipeline" value={fmt(weightedPipeline)} helper="Sum of weighted totals" />
          <MetricCard label="Materializing 75%+" value={fmt(materializing)} helper="Probability >= 75%" />
        </div>

        {/* Monthly Phasing Summary Card */}
        {totalPhasingRows > 0 && (
          <Card className="shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-foreground">Monthly Phasing Summary</p>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  {totalPhasingRows} rows
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                  Read-only · Go-live triggered · ACV/12 per month
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Opps with Phasing" value={String(phasingOpps)} helper="Linked to monthly rows" />
                <MetricCard label="Total Phasing Revenue" value={fmt(totalPhasingRevenue)} helper="SUM(revenue_amount) grand total" />
                <MetricCard label="Total Weighted Phasing" value={fmt(totalPhasingWeighted)} helper="SUM(weighted_amount) grand total" />
                <MetricCard label="Phasing Rows" value={String(totalPhasingRows)} helper="commercial_opportunity_monthly_phasing" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cross-Layer Reconciliation */}
        {reconRows.length > 0 && <ReconSection reconRows={reconRows} />}

        {/* Pipeline Table */}
        {!loading && !error && rows.length === 0 ? (
          <EmptySourceState label="Warehouse pipeline" />
        ) : (
          <DataTable
            columns={[
              "",
              "Customer / Opportunity",
              "Owner",
              "Stage",
              "Probability",
              "Warehouse",
              "Go-Live Date",
              "ACV",
              "Expected Revenue CY",
              "Pallets",
              "SQM",
              "Region",
              "Weighted Total",
              "GP Basis",
              "Flags",
              "Source",
            ]}
          >
            {rows.map((row) => {
              const phasing = phasingMap.get(row.id);
              const isExpanded = expanded.has(row.id);
              const hasPhasing = !!phasing && phasing.rows.length > 0;
              return (
                <>
                  <tr
                    key={row.id}
                    className={[
                      "bg-background",
                      hasPhasing ? "cursor-pointer hover:bg-muted/30" : "",
                      isExpanded ? "bg-slate-50" : "",
                    ].join(" ")}
                    onClick={hasPhasing ? () => toggleExpand(row.id) : undefined}
                  >
                    <td className="w-8 px-2 py-3 text-center">
                      {hasPhasing ? (
                        isExpanded ? (
                          <ChevronDown className="inline h-4 w-4 text-blue-600" />
                        ) : (
                          <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground/30">·</span>
                      )}
                    </td>
                    <td className="min-w-64 px-3 py-3">
                      <p className="font-medium">{row.customerName || "--"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.opportunityName || "--"}</p>
                      {hasPhasing && !isExpanded && (
                        <p className="mt-1 text-[10px] text-blue-600">
                          📊 {phasing.rows.length} months · Grand: {fmt(phasing.grandTotal)} · Wtd: {fmt(phasing.weightedGrandTotal)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">{row.owner || "--"}</td>
                    <td className="px-3 py-3"><Badge variant="outline">{row.stage || "--"}</Badge></td>
                    <td className="px-3 py-3">{row.probabilityPct ? `${row.probabilityPct}%` : "--"}</td>
                    <td className="px-3 py-3">{row.warehouseLocation || row.warehouseRaw || "--"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(row.goLiveDate)}</td>
                    <td className="px-3 py-3">{fmt(row.acvAnnual)}</td>
                    <td className="px-3 py-3">{fmt(row.expectedRevenueCy)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtVolume(row.volumePallets, "pallets")}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtVolume(row.volumeSqm, "sqm")}</td>
                    <td className="px-3 py-3">{row.region || "--"}</td>
                    <td className="px-3 py-3">{fmt(row.weightedTotal)}</td>
                    <td className="px-3 py-3">
                      {(() => {
                        const gpAmount = row.weightedTotal * (row.gpMarginPct / 100);
                        const basisConfig: Record<string, { label: string; className: string }> = {
                          actual_cost: { label: 'Actual Cost', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                          assumed_75pct: { label: 'Assumed 75%', className: 'border-red-200 bg-red-50 text-red-700' },
                          no_revenue: { label: 'No Revenue', className: 'border-zinc-200 bg-zinc-50 text-zinc-500' },
                          unknown: { label: 'Unknown', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
                        };
                        const cfg = basisConfig[row.gpBasis] || basisConfig.unknown!;
                        return (
                          <div>
                            <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                            {gpAmount > 0 && <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">GP: {fmt(gpAmount)}</p>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="min-w-48 px-3 py-3">
                      {row.flags.length ? (
                        <div className="flex flex-wrap gap-1">
                          {row.flags.map((flag) => (
                            <Badge key={flag.id} variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {flag.flagMessage || flag.flagType}
                            </Badge>
                          ))}
                        </div>
                      ) : "--"}
                    </td>
                    <td className="px-3 py-3"><SourceCell {...row} /></td>
                  </tr>
                  {isExpanded && phasing && (
                    <PhasingDetail
                      key={`${row.id}-phasing`}
                      phasing={phasing}
                      goLiveDate={row.goLiveDate}
                      colSpan={COL_COUNT}
                    />
                  )}
                </>
              );
            })}
          </DataTable>
        )}
      </div>
    </CommercialOsShell>
  );
}
