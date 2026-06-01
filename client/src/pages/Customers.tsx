/**
 * Customer Command Centre — Excel-style portfolio grid
 * Data: live commercial_tickets aggregated by customer
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Search, X, Download, Users, ChevronUp, ChevronDown, ExternalLink, Loader2, AlertTriangle } from "lucide-react";

const GLOW_KEYFRAMES_STYLE = `
@keyframes ledShimmer {
  0%   { opacity: 0.75; box-shadow: 0 0 3px 1px rgba(52, 211, 153, 0.5); }
  50%  { opacity: 1;    box-shadow: 0 0 8px 3px rgba(52, 211, 153, 1); }
  100% { opacity: 0.75; box-shadow: 0 0 3px 1px rgba(52, 211, 153, 0.5); }
}
.animate-pulse-slow { animation: ledShimmer 2.5s ease-in-out infinite; }
`;
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { fetchCustomers } from "@/lib/supabase-data";
import { deriveCustomerRowsFromTickets, type CustomerCommandRow } from "@/lib/customer-command-data";
import { useEffect } from "react";
import { fetchOperationalTickets } from "@/lib/intake-save";
import { deriveCommercialTicketPipelineTickets } from "@/lib/pipeline-tickets";

// ─── Helpers ────────────────────────────────────────────────
function fmtSar(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function gpColor(v: number) {
  return v >= 22 ? "text-emerald-600" : v >= 10 ? "text-amber-600" : "text-red-600";
}

function riskChip(r: string) {
  const c = r === "high" ? "bg-red-100 text-red-700 border-red-200"
    : r === "medium" ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${c}`}>{r}</span>;
}

function workspaceTypeChip(type: CustomerCommandRow["workspaceType"]) {
  const c = type === "Tender" ? "bg-violet-50 text-violet-700 border-violet-200"
    : type === "Proposal" ? "bg-indigo-50 text-indigo-700 border-indigo-200"
    : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${c}`}>{type}</span>;
}

function healthBar(score: number) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-mono w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Sort config ────────────────────────────────────────────
type SortKey = keyof CustomerCommandRow;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; w: string; frozen?: boolean }[] = [
  { key: "customerName", label: "Customer", w: "min-w-[160px]", frozen: true },
  { key: "region", label: "Region", w: "min-w-[80px]", frozen: true },
  { key: "owner", label: "Owner", w: "min-w-[110px]", frozen: true },
  { key: "workspaceType", label: "Type", w: "min-w-[90px]" },
  { key: "industry", label: "Industry", w: "min-w-[90px]" },
  { key: "serviceType", label: "Service", w: "min-w-[120px]" },
  { key: "totalPipelineValue", label: "Pipeline Value", w: "min-w-[100px]" },
  { key: "activeTickets", label: "Tickets", w: "min-w-[60px]" },
  { key: "wonRevenue", label: "Won Rev", w: "min-w-[90px]" },
  { key: "avgGpPct", label: "Avg GP%", w: "min-w-[70px]" },
  { key: "avgEcr", label: "ECR", w: "min-w-[50px]" },
  { key: "paymentRisk", label: "Pay Risk", w: "min-w-[70px]" },
  { key: "dso", label: "DSO", w: "min-w-[50px]" },
  { key: "contractStatus", label: "Contract", w: "min-w-[80px]" },
  { key: "nextRenewal", label: "Renewal", w: "min-w-[90px]" },
  { key: "openRisks", label: "Risks", w: "min-w-[50px]" },
  { key: "lastActivity", label: "Last Activity", w: "min-w-[95px]" },
  { key: "healthScore", label: "Health", w: "min-w-[100px]" },
];

// ─── CSV Export ─────────────────────────────────────────────
function exportCsv(rows: CustomerCommandRow[]) {
  const headers = ["Customer", "Type", "Region", "Owner", "Service", "Pipeline Value", "Tickets", "Proposals", "Tenders", "Won Revenue", "Avg GP%", "ECR", "Payment Risk", "DSO", "Contract", "Risks", "Last Activity", "Health"];
  const lines = rows.map(r => [
    r.customerName, r.workspaceType, r.region, r.owner, r.serviceType, r.totalPipelineValue, r.activeTickets, r.proposalTickets, r.tenderTickets,
    r.wonRevenue, r.avgGpPct, r.avgEcr, r.paymentRisk, r.dso, r.contractStatus,
    r.openRisks, r.lastActivity, r.healthScore,
  ].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "customer_command_centre.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function Customers() {
  const [, navigate] = useLocation();
  const [rows, setRows] = useState<CustomerCommandRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [regionF, setRegionF] = useState("all");
  const [ownerF, setOwnerF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [riskF, setRiskF] = useState("all");
  const [marginF, setMarginF] = useState("all");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("totalPipelineValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Drawer
  const [drawerRow, setDrawerRow] = useState<CustomerCommandRow | null>(null);

  // ─── Load (commercial_tickets + customers in parallel) ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchOperationalTickets(), fetchCustomers()])
      .then(([ticketResult, custs]) => {
        if (cancelled) return;
        if (ticketResult.error) throw new Error(ticketResult.error);
        const tickets = deriveCommercialTicketPipelineTickets(ticketResult.data);
        setRows(deriveCustomerRowsFromTickets(tickets, custs));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ─── Derived ────────────────────────────────────────────
  const regions = useMemo(() => [...new Set(rows.map(r => r.region).filter(Boolean))].sort(), [rows]);
  const owners = useMemo(() => [...new Set(rows.map(r => r.owner).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    let f = rows;
    if (regionF !== "all") f = f.filter(r => r.region === regionF);
    if (ownerF !== "all") f = f.filter(r => r.owner === ownerF);
    if (typeF === "Tender") f = f.filter(r => r.tenderTickets > 0);
    else if (typeF === "Proposal") f = f.filter(r => r.proposalTickets > 0);
    else if (typeF === "Mixed") f = f.filter(r => r.workspaceType === "Mixed");
    if (riskF !== "all") f = f.filter(r => r.paymentRisk === riskF);
    if (marginF === "low") f = f.filter(r => r.avgGpPct < 10);
    else if (marginF === "mid") f = f.filter(r => r.avgGpPct >= 10 && r.avgGpPct < 22);
    else if (marginF === "high") f = f.filter(r => r.avgGpPct >= 22);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(r =>
        r.customerName.toLowerCase().includes(q) ||
        r.crmId.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q)
      );
    }
    return f;
  }, [rows, regionF, ownerF, typeF, riskF, marginF, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const metrics = useMemo(() => ({
    total: rows.length,
    totalValue: rows.reduce((s, r) => s + r.totalPipelineValue, 0),
    avgGp: rows.length > 0 ? rows.reduce((s, r) => s + r.avgGpPct, 0) / rows.length : 0,
    atRisk: rows.filter(r => r.paymentRisk === "high").length,
  }), [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const activeFilters = (regionF !== "all" ? 1 : 0) + (ownerF !== "all" ? 1 : 0) + (typeF !== "all" ? 1 : 0) + (riskF !== "all" ? 1 : 0) + (marginF !== "all" ? 1 : 0) + (search ? 1 : 0);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{GLOW_KEYFRAMES_STYLE}</style>
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--color-hala-navy)]" />
              <h1 className="text-xl font-semibold">Customer Command Centre</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {metrics.total} customers · SAR {fmtSar(metrics.totalValue)} pipeline · Avg GP: {metrics.avgGp.toFixed(1)}% · <span className={metrics.atRisk > 0 ? "text-red-600 font-medium" : ""}>{metrics.atRisk} high risk</span>
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => exportCsv(sorted)}>
            <Download className="h-3 w-3" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Search customer, CRM ID, owner..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={regionF} onValueChange={setRegionF}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ownerF} onValueChange={setOwnerF}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeF} onValueChange={setTypeF}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Proposal">Proposal</SelectItem>
              <SelectItem value="Tender">Tender</SelectItem>
              <SelectItem value="Mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskF} onValueChange={setRiskF}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={marginF} onValueChange={setMarginF}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Margin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Margins</SelectItem>
              <SelectItem value="high">≥ 22%</SelectItem>
              <SelectItem value="mid">10-22%</SelectItem>
              <SelectItem value="low">&lt; 10%</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setRegionF("all"); setOwnerF("all"); setTypeF("all"); setRiskF("all"); setMarginF("all"); setSearch(""); }}>
              <X className="w-3 h-3 mr-1" /> Clear ({activeFilters})
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">{sorted.length} of {rows.length}</span>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {/* Grid */}
      {!loading && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`text-left px-3 py-2.5 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none border-b ${col.w} ${col.frozen ? "sticky left-0 bg-muted/90 z-20" : ""}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.crmId}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setDrawerRow(row)}
                >
                  <td className="px-3 py-2.5 font-semibold text-foreground sticky left-0 bg-card z-10 min-w-[160px]">{row.customerName}</td>
                  <td className="px-3 py-2.5 sticky left-[160px] bg-card z-10">{row.region}</td>
                  <td className="px-3 py-2.5 sticky left-[240px] bg-card z-10">{row.owner}</td>
                  <td className="px-3 py-2.5">{workspaceTypeChip(row.workspaceType)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.industry}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.serviceType}</td>
                  <td className="px-3 py-2.5 font-mono font-medium">SAR {fmtSar(row.totalPipelineValue)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{row.activeTickets}</Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{row.wonRevenue > 0 ? `SAR ${fmtSar(row.wonRevenue)}` : "—"}</td>
                  <td className={`px-3 py-2.5 font-mono font-bold ${gpColor(row.avgGpPct)}`}>{row.avgGpPct}%</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${row.avgEcr >= 70 ? "bg-emerald-500" : row.avgEcr >= 40 ? "bg-amber-500" : "bg-red-400"}`} />
                      <span className="font-mono">{row.avgEcr}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{riskChip(row.paymentRisk)}</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{row.dso > 0 ? `${row.dso}d` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${row.contractStatus === "Active" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : row.contractStatus === "Renewing" ? "border-amber-300 text-amber-700 bg-amber-50" : row.contractStatus === "Expired" ? "border-red-300 text-red-700 bg-red-50" : "border-border"}`}>
                      {row.contractStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.nextRenewal !== "—" ? row.nextRenewal.slice(0, 10) : "—"}</td>
                  <td className="px-3 py-2.5">
                    {row.openRisks > 0 ? (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-3 h-3" /> {row.openRisks}
                      </div>
                    ) : <span className="text-muted-foreground/50">0</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.lastActivity !== "—" ? row.lastActivity.slice(0, 10) : "—"}</td>
                  <td className="px-3 py-2.5">{healthBar(row.healthScore)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">No customers match filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Customer Command Drawer ─────────────────────── */}
      <Sheet open={!!drawerRow} onOpenChange={open => { if (!open) setDrawerRow(null); }}>
        <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto p-0">
          {drawerRow && <CustomerDrawer row={drawerRow} onOpenTicket={ticket => {
            setDrawerRow(null);
            navigate(ticket.ticketType === "tender" ? `/tenders/${ticket.id}` : `/workspaces/${ticket.id}`);
          }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CUSTOMER COMMAND DRAWER
// ═══════════════════════════════════════════════════════════

function CustomerDrawer({ row, onOpenTicket }: { row: CustomerCommandRow; onOpenTicket: (ticket: CustomerCommandRow["tickets"][number]) => void }) {
  return (
    <div>
      {/* Header */}
      <div className="px-6 py-5 border-b bg-muted/20">
        <SheetHeader className="mb-0">
          <SheetTitle className="text-lg">{row.customerName}</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>{row.region}</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{row.owner}</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{row.serviceType}</span>
        </div>
        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "Pipeline", value: `SAR ${fmtSar(row.totalPipelineValue)}` },
            { label: "Avg GP%", value: `${row.avgGpPct}%`, color: gpColor(row.avgGpPct), glow: row.avgGpPct >= 22 },
            { label: "Health", value: `${row.healthScore}/100` },
            { label: "Risk", value: row.paymentRisk, color: row.paymentRisk === "high" ? "text-red-600" : row.paymentRisk === "medium" ? "text-amber-600" : "text-emerald-600", glow: row.paymentRisk === "low" },
          ].map(kpi => (
            <div key={kpi.label} className={`relative rounded-lg border p-3 bg-card overflow-hidden ${kpi.glow ? "border-emerald-400/50" : ""}`}>
              {kpi.glow && (
                <span className="absolute inset-1 rounded-lg bg-emerald-400/20 animate-pulse-slow pointer-events-none" />
              )}
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground relative z-10">{kpi.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${kpi.color || ""} relative z-10`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-6 py-4 border-b">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Portfolio Summary</p>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Active Tickets</span><span className="font-medium">{row.activeTickets}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Won Revenue</span><span className="font-medium">SAR {fmtSar(row.wonRevenue)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Avg ECR</span><span className="font-medium">{row.avgEcr}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">DSO</span><span className="font-medium">{row.dso}d</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Contract</span><span className="font-medium">{row.contractStatus}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Open Risks</span><span className={`font-medium ${row.openRisks > 0 ? "text-red-600" : ""}`}>{row.openRisks}</span></div>
        </div>
      </div>

      {/* Ticket Portfolio */}
      <div className="px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Ticket Portfolio ({row.tickets.length})
        </p>
        {row.tickets.length === 0 && <p className="text-xs text-muted-foreground/50 py-4 text-center">No tickets linked</p>}
        <div className="space-y-2">
          {row.tickets.map(t => (
            <div key={t.id} className="rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold truncate flex-1">{t.opportunityName}</span>
                <Badge variant="outline" className={`text-[8px] h-4 px-1 ml-2 ${t.ticketType === "tender" ? "border-violet-300 text-violet-700 bg-violet-50" : "border-indigo-300 text-indigo-700 bg-indigo-50"}`}>
                  {t.ticketType === "tender" ? "Tender" : "Proposal"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>CRM: <strong className="text-foreground">{t.crmStage}</strong></span>
                <span>SAR {fmtSar(t.sarValue)}</span>
                <span className={gpColor(t.gpPct)}>{t.gpPct}%</span>
                <span>ECR {t.ecrScore}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-indigo-600 font-medium">→ {t.nextAction}</span>
                <Button size="sm" className="h-6 text-[10px] px-2 gap-1 bg-[#1B2A4A] text-white hover:bg-[#2A3F6A]" onClick={e => { e.stopPropagation(); onOpenTicket(t); }}>
                  <ExternalLink className="w-3 h-3" /> Open Workspace
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
