/**
 * Proposal Pipeline Overview — Swimlane View by CRM Pipeline Stage
 *
 * Portfolio visibility for isolated proposal tickets by CRM stage.
 * CRM Pipeline = Parent, Ticket = Child.
 * Data sourced from commercial_tickets, same canonical source as CRM Pipeline.
 * When a ticket moves in CRM Pipeline, it moves here too — single source of truth.
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import {
  Briefcase,
  Search,
  X,
  Clock,
  User,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
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
import {
  deriveCommercialTicketPipelineTickets,
  CRM_PIPELINE_COLUMNS,
  STAGE_COLORS,
  resolveReadState,
  describeRenderedCount,
  describeEmptyReadCause,
  describeIsolationWithholding,
  readOperationalTicketsWithIsolation,
  sumCaptured,
  averageCaptured,
  type CrmStageLabel,
  type PipelineTicket,
  type PipelineRiskLevel,
} from "@/lib/pipeline-tickets";
import { CRM_PIPELINE_STAGES } from "@/components/proposal-workspace/CrmPipelineStrip";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── STAGE COLORS ─────────────────────────────────────────────

const STAGE_COLORS_LIGHT: Record<CrmStageLabel, { bg: string; border: string; label: string }> = {
  "Prospecting":            { bg: "bg-slate-50",     border: "border-l-slate-400",   label: "text-slate-600" },
  "Qualified":              { bg: "bg-blue-50",      border: "border-l-blue-400",    label: "text-blue-600" },
  "Proposal Sent":          { bg: "bg-[#075eea]/10",    border: "border-l-[#5b9cff]",  label: "text-[#075eea]" },
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

/** A never-captured value is shown as such — never as "SAR 0" or "0%". */
function formatSarValue(n: number | null): string {
  return n == null ? "Not captured" : formatSar(n);
}

function formatPct(n: number | null): string {
  return n == null ? "Not captured" : `${n}%`;
}

function formatDays(n: number | null): string {
  return n == null ? "Not captured" : `${n}d`;
}

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";
}

/*
 * W04-C1 defect C: this file used to derive its own margin verdict from
 * `gpPct` with a local getRiskLevel(), so a never-captured GP arrived as 0 and
 * was labelled "Critical" — and the swimlane card (which used the local
 * verdict) disagreed with the preview popup (which used the ticket's own
 * riskLevel) about the same record. Both now read the single derived verdict
 * from pipeline-tickets, so they cannot disagree.
 */
const RISK_DOT: Record<PipelineRiskLevel, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  unknown: "bg-muted-foreground/30",
};

const RISK_TEXT: Record<PipelineRiskLevel, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  unknown: "text-muted-foreground",
};

// ─── METRICS BAR ──────────────────────────────────────────────

function MetricsBar({ tickets }: { tickets: PipelineTicket[] }) {
  // W04-C1 defect G: every figure here is computed over `tickets`, which is the
  // exact set the swimlanes below render. The first tile used to be labelled
  // "Total Active" while those lanes include Closed Lost and Discontinued; it
  // now says what it counts.
  const totalSar = sumCaptured(tickets.map(t => t.sarValue));
  const avgGp = averageCaptured(tickets.map(t => t.gpPct));
  const stalledCount = tickets.filter(t => t.daysInStage != null && t.daysInStage > 14).length;
  const closedWonCount = tickets.filter(t => t.crmStage === "Closed Won").length;
  const closedLostCount = tickets.filter(t => t.crmStage === "Closed Lost").length;
  const totalClosed = closedWonCount + closedLostCount;
  const winRate = totalClosed > 0 ? Math.round((closedWonCount / totalClosed) * 100) : 0;

  const metrics = [
    { label: "Tickets Shown", value: tickets.length },
    { label: "Pipeline SAR", value: formatSar(totalSar) },
    { label: "Avg GP%", value: avgGp == null ? "Not captured" : `${avgGp.toFixed(1)}%` },
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

/**
 * MEASURE MINI — W04-C1 defect A.
 *
 * Replaces a gauge whose value came from a three-way bucket
 * (`gpPct >= 22 ? 85 : gpPct >= 15 ? 50 : 15`) and was printed as the literal
 * text "85%". Nothing measured 85. The text shown here is always the real
 * measured figure; `fill` only scales the bar and is never printed as a number.
 * A never-captured measure gets a dashed empty bar and no colour verdict.
 */
function MeasureMini({
  label, text, fill, tone, scaleNote,
}: {
  label: string;
  text: string;
  fill: number | null;
  tone: "green" | "amber" | "red" | "none";
  scaleNote?: string;
}) {
  const barColor = tone === "green" ? "bg-emerald-500"
    : tone === "amber" ? "bg-amber-500"
    : tone === "red" ? "bg-red-400"
    : "bg-muted-foreground/20";
  const textColor = tone === "green" ? "text-emerald-600"
    : tone === "amber" ? "text-amber-600"
    : tone === "red" ? "text-red-500"
    : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-3">
        {fill == null ? (
          <div className="flex-1 h-2 rounded-full border border-dashed border-border" />
        ) : (
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, fill))}%` }} />
          </div>
        )}
        <span className={`text-sm font-bold ${textColor}`}>{text}</span>
      </div>
      {scaleNote && <p className="mt-1 text-[9px] text-muted-foreground/60">{scaleNote}</p>}
    </div>
  );
}

export interface ProposalMeasure {
  label: string;
  /** Exactly what is printed. Always a real figure or "Not captured". */
  text: string;
  /** Bar scale only, never printed. null = no bar. */
  fill: number | null;
  tone: "green" | "amber" | "red" | "none";
  scaleNote: string;
}

/**
 * The proposal preview strip, as data. Exported so a test can assert that every
 * printed figure comes from the record and not from a bucket constant.
 */
export function proposalMeasures(t: PipelineTicket): ProposalMeasure[] {
  return [
    {
      label: "Margin — Target GP%",
      text: formatPct(t.gpPct),
      fill: t.gpPct,
      tone: t.riskLevel === "unknown" ? "none" : t.riskLevel,
      scaleNote: "Healthy ≥ 22% · Low GP 10–22% · Critical < 10%",
    },
    {
      label: "Age — Days in Stage",
      text: formatDays(t.daysInStage),
      fill: t.daysInStage == null ? null : (t.daysInStage / 30) * 100,
      tone: t.daysInStage == null ? "none"
        : t.daysInStage <= 7 ? "green"
        : t.daysInStage <= 14 ? "amber"
        : "red",
      scaleNote: "Bar scaled over 30 days · stalled after 14",
    },
    {
      label: "Win Probability",
      text: formatPct(t.probabilityPct),
      fill: t.probabilityPct,
      tone: t.probabilityPct == null ? "none"
        : t.probabilityPct >= 70 ? "green"
        : t.probabilityPct >= 40 ? "amber"
        : "red",
      scaleNote: "As captured on the ticket",
    },
  ];
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="px-8 py-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl font-semibold">{ticket.customerName}</span>
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-[#075eea]/30 text-[#075eea] bg-[#075eea]/10">
              Proposal
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
          <div className="grid grid-cols-3 gap-4">
            {proposalMeasures(ticket).map(m => <MeasureMini key={m.label} {...m} />)}
          </div>
        </div>

        <div className="px-8 py-5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Facts</p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            {[
              { l: "SAR Value", v: ticket.sarValue == null ? "Not captured" : `SAR ${ticket.sarValue.toLocaleString()}` },
              { l: "GP%", v: formatPct(ticket.gpPct) },
              { l: "Region", v: ticket.region || "—" },
              { l: "Pallets", v: ticket.volumePallets > 0 ? ticket.volumePallets.toLocaleString() : "—" },
              { l: "Expected Close", v: ticket.goLiveDate || "—" },
              { l: "Owner", v: ticket.owner },
              { l: "Probability", v: formatPct(ticket.probabilityPct) },
              { l: "Days in Stage", v: formatDays(ticket.daysInStage) },
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
            <div className={`w-2 h-2 rounded-full ${RISK_DOT[ticket.riskLevel]}`} />
            <span className="text-xs font-medium">{ticket.riskLabel}</span>
            {ticket.daysInStage != null && ticket.daysInStage > 14 && (
              <span className="text-xs text-red-600 ml-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Overdue {ticket.daysInStage}d
              </span>
            )}
          </div>
        </div>

        <div className="px-8 py-4 flex items-center gap-3">
          {/* Primary action keeps the proposal's identity: /proposals/:id. */}
          <Button
            className="gap-2 h-9"
            onClick={() => { onOpenChange(false); navigate(cleanHref(`/proposals/${ticket.id}`)); }}
          >
            <ExternalLink className="w-4 h-4" />
            Open Proposal Workspace
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-9"
            onClick={() => { onOpenChange(false); navigate(cleanHref("/crm-pipeline")); }}
          >
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
  // Single derived verdict — the same one the preview popup shows.
  const risk = { level: ticket.riskLevel, label: ticket.riskLabel };
  const isStalled = ticket.daysInStage != null && ticket.daysInStage > 14;
  const isCriticalMargin = ticket.riskLevel === "red";

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group ${
        isCriticalMargin ? "border-red-300" : "border-border"
      }`}
    >
      <CardContent className="p-3.5 space-y-2">
        {/* TOP: Customer Name + Opportunity + Proposal badge + Region */}
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold truncate flex-1">{ticket.customerName}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 rounded shrink-0 border-[#075eea]/30 text-[#075eea] bg-[#075eea]/10">
              Proposal
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground truncate leading-snug">{ticket.opportunityName}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{ticket.region}</p>
        </div>

        {/* MIDDLE: SAR Value + GP% + local risk */}
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono font-semibold ${ticket.sarValue == null ? "text-muted-foreground" : ""}`}>
            {formatSarValue(ticket.sarValue)}
          </span>
          <span className={`text-[11px] font-mono font-bold ${RISK_TEXT[ticket.riskLevel]}`}>
            {ticket.gpPct == null ? "Not captured" : `${ticket.gpPct.toFixed(1)}%`}
          </span>
          <div className="flex items-center gap-0.5 ml-auto">
            <div className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[risk.level]}`} />
            <span className="text-[9px] text-muted-foreground">{risk.label}</span>
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
            <span className={`text-[8px] px-1 py-0.5 rounded border ${
              risk.level === "red" ? "border-red-300 text-red-700 bg-red-50"
                : risk.level === "amber" ? "border-amber-300 text-amber-700 bg-amber-50"
                : "border-dashed border-border text-muted-foreground"
            }`}>
              {risk.label}
            </span>
          )}
          {isStalled && (
            <span className="text-[8px] text-red-600 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {ticket.daysInStage}d
            </span>
          )}
          <span className="text-[9px] text-[#075eea] truncate flex-1">→ {ticket.nextAction}</span>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  /** Rows the database returned before client-side process isolation ran. */
  const [fetchedRowCount, setFetchedRowCount] = useState(0);

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterCrmStage, setFilterCrmStage] = useState<CrmStageLabel | "all">("all");
  const [filterRisk, setFilterRisk] = useState<"all" | PipelineRiskLevel>("all");
  const [previewTicket, setPreviewTicket] = useState<PipelineTicket | null>(null);

  // ─── LOAD DATA ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readOperationalTicketsWithIsolation("proposal")
      .then(read => {
        if (cancelled) return;
        if (read.error) throw new Error(read.error);
        // Keep the pre-isolation count so the empty state can say how many rows
        // the database returned and how many this client withheld.
        setFetchedRowCount(read.fetched);
        setTickets(deriveCommercialTicketPipelineTickets(read.rows));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A failed read is not "no tickets match the filters".
        console.error("Proposal Pipeline load error:", err);
        setLoadError(err instanceof Error ? err.message : "Proposal load failed for an unknown reason");
        setTickets([]);
        setFetchedRowCount(0);
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
      if (search && !t.customerName.toLowerCase().includes(search) && !t.opportunityName.toLowerCase().includes(search)) return false;

      if (filterRisk !== "all" && t.riskLevel !== filterRisk) return false;

      return true;
    });
  }, [tickets, filterSearch, filterRegion, filterOwner, filterCrmStage, filterRisk]);

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

  const readState = resolveReadState({ loading, error: loadError, count: tickets.length });
  const withheldNotice = readState === "ready"
    ? describeIsolationWithholding(fetchedRowCount, tickets.length)
    : null;

  if (readState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading Proposal Pipeline…</p>
      </div>
    );
  }

  if (readState === "error") {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mx-auto max-w-md rounded-xl border border-red-300 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-600" />
          <p className="text-sm font-semibold text-red-900">Proposal pipeline could not be loaded</p>
          <p className="mt-1 text-xs text-red-800">
            The read of <span className="font-mono">commercial_tickets</span> failed. No stage lanes,
            counts or pipeline value can be shown. This is a failed read, not an empty pipeline.
          </p>
          <p className="mt-2 break-words font-mono text-[10px] text-red-700">{loadError}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="w-3 h-3 mr-1.5" /> Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
              <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
            </Button>
          </div>
        </div>
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
            {describeRenderedCount(filtered.length, tickets.length, "ticket")} · {formatSar(sumCaptured(filtered.map(t => t.sarValue)))} pipeline value
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
            <Briefcase className="w-4 h-4 mr-1.5" />
            CRM Pipeline
          </Button>
        </div>
      </div>

      {/* Rows the database returned that this client removed — disclosed, not hidden */}
      {withheldNotice && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <p className="text-xs font-medium text-amber-900">{withheldNotice}</p>
        </div>
      )}

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
          <Select value={filterRisk} onValueChange={v => setFilterRisk(v as "all" | PipelineRiskLevel)}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="green">Healthy</SelectItem>
              <SelectItem value="amber">Low GP</SelectItem>
              <SelectItem value="red">Critical</SelectItem>
              <SelectItem value="unknown">GP not captured</SelectItem>
            </SelectContent>
          </Select>
          {(filterSearch || filterRegion !== "all" || filterOwner !== "all" || filterCrmStage !== "all" || filterRisk !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setFilterSearch(""); setFilterRegion("all"); setFilterOwner("all"); setFilterCrmStage("all"); setFilterRisk("all"); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Swimlane View */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" />
          {tickets.length === 0 ? (
            <>
              <p className="text-sm">No proposal tickets are shown.</p>
              {/*
                W04-C1 defect E: this claimed the read returned no rows even
                when rows were returned and then removed client-side by the
                process-isolation allowlist. It now states which happened.
              */}
              <p className="text-xs text-muted-foreground/70 mt-1">
                {describeEmptyReadCause(fetchedRowCount, tickets.length)}
              </p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
                <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">No tickets match the current filters ({tickets.length} loaded).</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => { setFilterSearch(""); setFilterRegion("all"); setFilterOwner("all"); setFilterCrmStage("all"); setFilterRisk("all"); }}
              >
                Clear filters
              </Button>
            </>
          )}
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
                    {formatSar(sumCaptured(cards.map(t => t.sarValue)))}
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
