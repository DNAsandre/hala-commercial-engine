/**
 * Proposal Pipeline Overview — Swimlane View by CRM Pipeline Stage
 *
 * Portfolio visibility across all clients by CRM stage.
 * CRM Pipeline = Parent, Ticket = Child.
 * Data sourced from commercial_tickets, same canonical source as CRM Pipeline.
 * When a ticket moves in CRM Pipeline, it moves here too — single source of truth.
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Briefcase,
  Search,
  X,
  Clock,
  User,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  deriveCommercialTicketPipelineTickets,
  CRM_PIPELINE_COLUMNS,
  STAGE_COLORS,
  type CrmStageLabel,
  type PipelineTicket,
} from "@/lib/pipeline-tickets";
import { fetchOperationalTicketsByType } from "@/lib/intake-save";
import { CRM_PIPELINE_STAGES } from "@/components/proposal-workspace/CrmPipelineStrip";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── STAGE COLORS ─────────────────────────────────────────────

const STAGE_COLORS_LIGHT: Record<CrmStageLabel, { bg: string; border: string; label: string }> = {
  "Prospecting":            { bg: "bg-slate-50",     border: "border-l-slate-400",   label: "text-slate-600" },
  "Qualified":              { bg: "bg-blue-50",      border: "border-l-blue-400",    label: "text-blue-600" },
  "Proposal Sent":          { bg: "bg-violet-50",    border: "border-l-violet-400",  label: "text-violet-600" },
  "Shortlisted":            { bg: "bg-amber-50",     border: "border-l-amber-400",   label: "text-amber-600" },
  "Contract Negotiation":   { bg: "bg-orange-50",    border: "border-l-orange-400",  label: "text-orange-600" },
  "Closed Won":             { bg: "bg-emerald-50",   border: "border-l-emerald-400", label: "text-emerald-600" },
  "Contract Signed":        { bg: "bg-teal-50",     border: "border-l-teal-400",    label: "text-teal-600" },
  "Actual Go Live":         { bg: "bg-green-50",    border: "border-l-green-400",   label: "text-green-600" },
  "Closed Lost":            { bg: "bg-red-50",       border: "border-l-red-400",     label: "text-red-600" },
  "Discontinued":           { bg: "bg-gray-100",     border: "border-l-gray-400",    label: "text-gray-500" },
};

// ─── HELPERS ───────────────────────────────────────────────────

function formatSar(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";
}

function getRiskLevel(gpPct: number): { level: "green" | "amber" | "red"; label: string } {
  if (gpPct < 10) return { level: "red", label: "Critical" };
  if (gpPct < 22) return { level: "amber", label: "Tight" };
  return { level: "green", label: "Healthy" };
}

function getEcrBand(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

// ─── METRICS BAR ──────────────────────────────────────────────

function MetricsBar({ tickets }: { tickets: PipelineTicket[] }) {
  const totalSar = tickets.reduce((s, t) => s + t.sarValue, 0);
  const totalActive = tickets.length;
  const avgGp = tickets.length > 0
    ? tickets.reduce((s, t) => s + t.gpPct, 0) / tickets.length
    : 0;
  const stalledCount = tickets.filter(t => t.daysInStage > 14).length;
  const closedWonCount = tickets.filter(t => t.crmStage === "Closed Won").length;
  const closedLostCount = tickets.filter(t => t.crmStage === "Closed Lost").length;
  const totalClosed = closedWonCount + closedLostCount;
  const winRate = totalClosed > 0 ? Math.round((closedWonCount / totalClosed) * 100) : 0;

  const metrics = [
    { label: "Total Active", value: totalActive },
    { label: "Pipeline SAR", value: formatSar(totalSar) },
    { label: "Avg GP%", value: `${avgGp.toFixed(1)}%` },
    { label: "Stalled", value: stalledCount, highlight: stalledCount > 0 },
    { label: "Win Rate", value: totalClosed > 0 ? `${winRate}%` : "—" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {metrics.map(m => (
        <div key={m.label} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
          <p className={`text-lg font-semibold mt-0.5 ${m.highlight ? "text-amber-600" : ""}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── GAUGE MINI ────────────────────────────────────────────────

function GaugeMini({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  const textColor = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500";
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-sm font-bold ${textColor}`}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ─── PREVIEW POPUP ─────────────────────────────────────────────

function TicketPreviewPopup({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: PipelineTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [, navigate] = useLocation();
  if (!ticket) return null;

  const marginHealth = ticket.gpPct >= 22 ? 85 : ticket.gpPct >= 15 ? 50 : 15;
  const timePressure = ticket.daysInStage <= 7 ? 80 : ticket.daysInStage <= 14 ? 50 : 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="px-8 py-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl font-semibold">{ticket.customerName}</span>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${ticket.ticketType === "tender" ? "border-violet-300 text-violet-700 bg-violet-50" : "border-indigo-300 text-indigo-700 bg-indigo-50"}`}>
              {ticket.ticketType === "tender" ? "Tender" : "Proposal"}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-emerald-300 text-emerald-700 bg-emerald-50">
              {ticket.crmStage}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{ticket.opportunityName}</p>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="text-muted-foreground">CRM: <strong className="text-foreground">{ticket.crmStage}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground">Internal: <strong className="text-foreground">{ticket.internalStage}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-4 h-4" />{ticket.owner}</span>
          </div>
        </div>

        <div className="px-8 py-5 border-b border-border">
          <div className="grid grid-cols-4 gap-4">
            <GaugeMini label="ECR Score" value={ticket.ecrScore} />
            <GaugeMini label="Margin Health" value={marginHealth} />
            <GaugeMini label="Time Pressure" value={timePressure} />
            <GaugeMini label="Win Probability" value={ticket.probabilityPct} />
          </div>
        </div>

        <div className="px-8 py-5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Facts</p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            {[
              { l: "SAR Value", v: `SAR ${ticket.sarValue.toLocaleString()}` },
              { l: "GP%", v: ticket.gpPct > 0 ? `${ticket.gpPct}%` : "—" },
              { l: "Region", v: ticket.region || "—" },
              { l: "ECR Band", v: getEcrBand(ticket.ecrScore) },
              { l: "Pallets", v: ticket.volumePallets > 0 ? ticket.volumePallets.toLocaleString() : "—" },
              { l: "Expected Close", v: ticket.goLiveDate || "—" },
              { l: "Owner", v: ticket.owner },
              { l: "Probability", v: `${ticket.probabilityPct}%` },
              { l: "Days in Stage", v: `${ticket.daysInStage}d` },
            ].map(f => (
              <div key={f.l} className="flex justify-between">
                <span className="text-xs text-muted-foreground">{f.l}</span>
                <span className="text-xs font-medium">{f.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risk Status</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${ticket.riskLevel === "green" ? "bg-emerald-500" : ticket.riskLevel === "amber" ? "bg-amber-500" : "bg-red-500"}`} />
            <span className="text-xs font-medium capitalize">{ticket.riskLabel}</span>
            {ticket.daysInStage > 14 && (
              <span className="text-xs text-red-600 ml-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Overdue {ticket.daysInStage}d
              </span>
            )}
          </div>
        </div>

        <div className="px-8 py-4 flex items-center gap-3">
          <Button
            className="gap-2 h-9"
            onClick={() => { onOpenChange(false); navigate("/crm_pipeline"); }}
          >
            <ExternalLink className="w-4 h-4" />
            View in CRM Pipeline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SWIMLANE CARD ─────────────────────────────────────────────

function SwimLaneCard({
  ticket,
  onClick,
}: {
  ticket: PipelineTicket;
  onClick: () => void;
}) {
  const risk = getRiskLevel(ticket.gpPct);
  const ecrBand = getEcrBand(ticket.ecrScore);
  const isStalled = ticket.daysInStage > 14;
  const isCriticalMargin = ticket.gpPct < 15;

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group ${
        isCriticalMargin ? "border-red-300" : "border-border"
      }`}
    >
      <CardContent className="p-3.5 space-y-2">
        {/* TOP: Customer Name + Opportunity + Ticket Type + Region */}
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold truncate flex-1">{ticket.customerName}</span>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${ticket.ticketType === "tender" ? "border-violet-300 text-violet-700 bg-violet-50" : "border-indigo-300 text-indigo-700 bg-indigo-50"}`}>
              {ticket.ticketType === "tender" ? "Tender" : "Proposal"}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground truncate leading-snug">{ticket.opportunityName}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{ticket.region}</p>
        </div>

        {/* MIDDLE: SAR Value + GP% + ECR Score */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold">{formatSar(ticket.sarValue)}</span>
          <span className={`text-[11px] font-mono font-bold ${ticket.gpPct >= 22 ? "text-emerald-600" : ticket.gpPct >= 15 ? "text-amber-600" : "text-red-600"}`}>
            {ticket.gpPct > 0 ? `${ticket.gpPct.toFixed(1)}%` : "—"}
          </span>
          <div className="flex items-center gap-0.5 ml-auto">
            <div className={`w-1.5 h-1.5 rounded-full ${ticket.ecrScore >= 70 ? "bg-emerald-500" : ticket.ecrScore >= 40 ? "bg-amber-500" : "bg-red-400"}`} />
            <span className="text-[9px] text-muted-foreground">ECR {ecrBand}</span>
          </div>
        </div>

        {/* Internal tracker stage — subordinate sub-label */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[8px] h-3.5 px-1 border-border text-muted-foreground bg-muted/30"
          >
            {ticket.internalStage}
          </Badge>
          {ticket.crmStage !== ticket.internalStage && (
            <span className="text-[8px] text-emerald-600 font-medium">
              → {ticket.crmStage}
            </span>
          )}
        </div>

        {/* BOTTOM: Risk Status + Next Action + Owner + Sync */}
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
          {risk.level !== "green" && (
            <span className={`text-[8px] px-1 py-0.5 rounded border ${risk.level === "red" ? "border-red-300 text-red-700 bg-red-50" : "border-amber-300 text-amber-700 bg-amber-50"}`}>
              {risk.label}
            </span>
          )}
          {isStalled && (
            <span className="text-[8px] text-red-600 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {ticket.daysInStage}d
            </span>
          )}
          <span className="text-[9px] text-indigo-600 truncate flex-1">→ {ticket.nextAction}</span>
          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-[7px] font-bold text-muted-foreground">{initials(ticket.owner)}</span>
          </div>
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ticket.syncStatus === "synced" ? "bg-emerald-500" : ticket.syncStatus === "pending" ? "bg-amber-500" : "bg-muted-foreground/30"}`} title={ticket.syncStatus} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────

const ALL_SWIMLANE_STAGES: CrmStageLabel[] = [
  "Prospecting", "Qualified", "Proposal Sent", "Shortlisted", "Contract Negotiation",
  "Closed Won", "Contract Signed", "Actual Go Live", "Closed Lost", "Discontinued",
];

export default function CommercialOverview() {
  const [, navigate] = useLocation();
  const [tickets, setTickets] = useState<PipelineTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterCrmStage, setFilterCrmStage] = useState<CrmStageLabel | "all">("all");
  const [filterTicketType, setFilterTicketType] = useState<"all" | "proposal" | "tender">("all");
  const [filterRisk, setFilterRisk] = useState<"all" | "green" | "amber" | "red">("all");
  const [filterEcr, setFilterEcr] = useState<"all" | "A" | "B" | "C" | "D" | "F">("all");
  const [previewTicket, setPreviewTicket] = useState<PipelineTicket | null>(null);

  // ─── LOAD DATA ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOperationalTicketsByType("proposal")
      .then(result => {
        if (cancelled) return;
        if (result.error) throw new Error(result.error);
        setTickets(deriveCommercialTicketPipelineTickets(result.data));
      })
      .catch(err => {
        console.error("Proposal Pipeline load error:", err);
        toast.error("Failed to load CRM data");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── DERIVED ────────────────────────────────────────────────
  const regions = useMemo(
    () => Array.from(new Set(tickets.map(t => t.region).filter(Boolean))).sort(),
    [tickets]
  );
  const owners = useMemo(
    () => Array.from(new Set(tickets.map(t => t.owner).filter(Boolean))).sort(),
    [tickets]
  );

  const filtered = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return tickets.filter(t => {
      if (filterRegion !== "all" && t.region !== filterRegion) return false;
      if (filterOwner !== "all" && t.owner !== filterOwner) return false;
      if (filterCrmStage !== "all" && t.crmStage !== filterCrmStage) return false;
      if (filterTicketType !== "all" && t.ticketType !== filterTicketType) return false;
      if (search && !t.customerName.toLowerCase().includes(search) && !t.opportunityName.toLowerCase().includes(search)) return false;

      const risk = getRiskLevel(t.gpPct);
      if (filterRisk !== "all" && risk.level !== filterRisk) return false;

      const ecrBand = getEcrBand(t.ecrScore);
      if (filterEcr !== "all" && ecrBand !== filterEcr) return false;

      return true;
    });
  }, [tickets, filterSearch, filterRegion, filterOwner, filterCrmStage, filterTicketType, filterRisk, filterEcr]);

  // Group by CRM stage — all 10 stages shown
  const byCrmStage = useMemo(() => {
    const map = new Map<CrmStageLabel, PipelineTicket[]>();
    for (const stage of ALL_SWIMLANE_STAGES) {
      map.set(stage, []);
    }
    for (const t of filtered) {
      const existing = map.get(t.crmStage as CrmStageLabel);
      if (existing) existing.push(t);
    }
    return map;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading Proposal Pipeline…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Proposal Pipeline Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} tickets · {formatSar(filtered.reduce((s, t) => s + t.sarValue, 0))} pipeline value
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => navigate("/commercial")}>
            <Briefcase className="w-4 h-4 mr-1.5" />
            CRM Pipeline
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <MetricsBar tickets={filtered} />

      {/* Filters */}
      <div className="space-y-2 mb-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search company or deal name..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterRegion} onValueChange={v => setFilterRegion(v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={v => setFilterOwner(v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCrmStage} onValueChange={v => setFilterCrmStage(v as CrmStageLabel | "all")}>
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue placeholder="CRM Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CRM Stages</SelectItem>
              {ALL_SWIMLANE_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTicketType} onValueChange={v => setFilterTicketType(v as "all" | "proposal" | "tender")}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Ticket Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="tender">Tender</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRisk} onValueChange={v => setFilterRisk(v as "all" | "green" | "amber" | "red")}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="green">Healthy</SelectItem>
              <SelectItem value="amber">Tight</SelectItem>
              <SelectItem value="red">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEcr} onValueChange={v => setFilterEcr(v as "all" | "A" | "B" | "C" | "D" | "F")}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue placeholder="ECR Band" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ECR</SelectItem>
              <SelectItem value="A">Band A</SelectItem>
              <SelectItem value="B">Band B</SelectItem>
              <SelectItem value="C">Band C</SelectItem>
              <SelectItem value="D">Band D</SelectItem>
              <SelectItem value="F">Band F</SelectItem>
            </SelectContent>
          </Select>
          {(filterSearch || filterRegion !== "all" || filterOwner !== "all" || filterCrmStage !== "all" || filterTicketType !== "all" || filterRisk !== "all" || filterEcr !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setFilterSearch(""); setFilterRegion("all"); setFilterOwner("all"); setFilterCrmStage("all"); setFilterTicketType("all"); setFilterRisk("all"); setFilterEcr("all"); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Swimlane View */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No tickets match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl border border-border overflow-hidden">
          {ALL_SWIMLANE_STAGES.map(stage => {
            const cards = byCrmStage.get(stage) ?? [];
            if (cards.length === 0) return null;
            const colors = STAGE_COLORS_LIGHT[stage];

            return (
              <div
                key={stage}
                className={`flex gap-0 border-b last:border-b-0 border-border ${colors.border} ${colors.bg}`}
              >
                {/* Stage label — left column */}
                <div className="w-52 shrink-0 px-4 py-4 border-r border-border/60 flex flex-col justify-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>
                    {stage}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {cards.length} ticket{cards.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatSar(cards.reduce((s, t) => s + t.sarValue, 0))}
                  </span>
                </div>

                {/* Cards — 2-column grid */}
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {cards.map(ticket => (
                      <SwimLaneCard
                        key={ticket.id}
                        ticket={ticket}
                        onClick={() => setPreviewTicket(ticket)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Popup */}
      <TicketPreviewPopup
        ticket={previewTicket}
        open={!!previewTicket}
        onOpenChange={v => { if (!v) setPreviewTicket(null); }}
      />
    </div>
  );
}
