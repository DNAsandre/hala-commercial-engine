/**
 * Tender Pipeline Overview - /tenders-overview
 *
 * Intelligence overview for tender records only.
 * Data: commercial_tickets where ticket_type = tender.
 * Live tender data only. No proposal heuristics.
 * UX mirrors Proposal Pipeline Overview (/commercial-overview).
 */

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  Gavel,
  ChevronRight,
  ExternalLink,
  MapPin,
  User,
  RefreshCw,
  Loader2,
  Clock,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { fetchTenderPortfolioRows, type TenderPortfolioRow } from "@/lib/tender-ticket-adapter";
import { resolveReadState, describeRenderedCount } from "@/lib/pipeline-tickets";
import { cleanHref } from "@clean/lib/clean-routing";

type TenderRow = TenderPortfolioRow;

type TenderStageKey =
  | "identified"
  | "qualification"
  | "bid_no_bid"
  | "solution_design"
  | "pnl_pricing"
  | "tender_drafting"
  | "internal_review"
  | "approval_matrix"
  | "final_approved"
  | "submitted"
  | "clarification"
  | "client_evaluation"
  | "negotiation"
  | "awarded"
  | "lost_withdrawn"
  | "__not_captured";

const TENDER_STAGES: { key: TenderStageKey; label: string; tone: string; labelColor: string; border: string }[] = [
  { key: "identified", label: "Identified", tone: "bg-slate-50", labelColor: "text-slate-600", border: "border-l-slate-400" },
  { key: "qualification", label: "Qualification", tone: "bg-blue-50", labelColor: "text-blue-600", border: "border-l-blue-400" },
  { key: "bid_no_bid", label: "Bid / No-Bid", tone: "bg-cyan-50", labelColor: "text-cyan-700", border: "border-l-cyan-400" },
  { key: "solution_design", label: "Solution Design", tone: "bg-[#075eea]/10", labelColor: "text-[#075eea]", border: "border-l-[#5b9cff]" },
  { key: "pnl_pricing", label: "P&L / Pricing", tone: "bg-[#075eea]/10", labelColor: "text-[#075eea]", border: "border-l-[#5b9cff]" },
  { key: "tender_drafting", label: "Tender Drafting", tone: "bg-[#075eea]/10", labelColor: "text-[#075eea]", border: "border-l-[#5b9cff]" },
  { key: "internal_review", label: "Internal Review", tone: "bg-amber-50", labelColor: "text-amber-700", border: "border-l-amber-400" },
  { key: "approval_matrix", label: "Approval Matrix", tone: "bg-orange-50", labelColor: "text-orange-700", border: "border-l-orange-400" },
  { key: "final_approved", label: "Final Approved", tone: "bg-emerald-50", labelColor: "text-emerald-700", border: "border-l-emerald-400" },
  { key: "submitted", label: "Submitted", tone: "bg-teal-50", labelColor: "text-teal-700", border: "border-l-teal-400" },
  { key: "clarification", label: "Clarification", tone: "bg-yellow-50", labelColor: "text-yellow-700", border: "border-l-yellow-400" },
  { key: "client_evaluation", label: "Client Evaluation", tone: "bg-sky-50", labelColor: "text-sky-700", border: "border-l-sky-400" },
  { key: "negotiation", label: "Negotiation", tone: "bg-orange-50", labelColor: "text-orange-700", border: "border-l-orange-500" },
  { key: "awarded", label: "Awarded", tone: "bg-green-50", labelColor: "text-green-700", border: "border-l-green-500" },
  { key: "lost_withdrawn", label: "Lost / Withdrawn", tone: "bg-red-50", labelColor: "text-red-700", border: "border-l-red-400" },
  { key: "__not_captured", label: "Stage Not Captured", tone: "bg-gray-50", labelColor: "text-gray-500", border: "border-l-gray-300" },
];

const CLOSED_PHASES = new Set(["awarded", "lost_withdrawn"]);

function normalizePhase(phase: string | null): TenderStageKey {
  if (!phase) return "__not_captured";
  const key = phase.toLowerCase().trim().replace(/[\s-]+/g, "_") as TenderStageKey;
  return TENDER_STAGES.some(s => s.key === key) ? key : "__not_captured";
}

function formatSar(n: number | null): string {
  if (n == null) return "Not captured yet";
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `SAR ${(n / 1_000).toFixed(0)}K`;
  return `SAR ${n.toLocaleString()}`;
}

function formatSarCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatStage(s: string | null): string {
  if (!s) return "Not captured yet";
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function daysUntilDeadline(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function initials(name: string | null): string {
  if (!name) return "??";
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";
}

function getDeadlineLabel(tender: TenderRow): { label: string; tone: string } {
  const days = daysUntilDeadline(tender.submission_deadline);
  if (days == null) return { label: "Not captured yet", tone: "text-muted-foreground" };
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "text-red-600" };
  if (days === 0) return { label: "Today", tone: "text-red-600" };
  if (days <= 7) return { label: `${days}d`, tone: "text-red-600" };
  if (days <= 14) return { label: `${days}d`, tone: "text-amber-600" };
  return { label: `${days}d`, tone: "text-foreground" };
}

function getTenderAttention(tender: TenderRow): { level: "green" | "amber" | "red"; label: string } {
  const days = daysUntilDeadline(tender.submission_deadline);
  if (days != null && days <= 7) return { level: "red", label: days < 0 ? "Overdue" : "Urgent" };
  if ((tender.days_in_status ?? 0) > 14) return { level: "amber", label: "Stalled" };
  if (tender.target_gp_percent != null && tender.target_gp_percent < 22) return { level: "amber", label: "Tight GP" };
  return { level: "green", label: "On Track" };
}

function MetricsBar({ tenders }: { tenders: TenderRow[] }) {
  const active = tenders.filter(t => !CLOSED_PHASES.has(normalizePhase(t.phase)));
  const totalSar = active.reduce((sum, t) => sum + (t.estimated_value ?? 0), 0);
  const gpValues = active.map(t => t.target_gp_percent).filter((v): v is number => v != null);
  const avgGp = gpValues.length > 0 ? `${(gpValues.reduce((s, v) => s + v, 0) / gpValues.length).toFixed(1)}%` : "Not available";
  const stalled = active.filter(t => (t.days_in_status ?? 0) > 14).length;
  const awarded = tenders.filter(t => normalizePhase(t.phase) === "awarded").length;
  const lost = tenders.filter(t => normalizePhase(t.phase) === "lost_withdrawn").length;
  const decided = awarded + lost;
  const winRate = decided > 0 ? `${Math.round((awarded / decided) * 100)}%` : "Not available";

  const metrics = [
    { label: "Total Active", value: active.length.toString() },
    { label: "Pipeline SAR", value: formatSarCompact(totalSar) },
    { label: "Avg GP%", value: avgGp },
    { label: "Stalled", value: stalled.toString(), highlight: stalled > 0 },
    { label: "Win Rate", value: winRate },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {metrics.map(metric => (
        <div key={metric.label} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{metric.label}</p>
          <p className={`text-lg font-semibold mt-0.5 ${metric.highlight ? "text-amber-600" : ""}`}>{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function TenderSwimLaneCard({ tender, onClick }: { tender: TenderRow; onClick: () => void }) {
  const attention = getTenderAttention(tender);
  const deadline = getDeadlineLabel(tender);
  const gpTone = tender.target_gp_percent == null
    ? "text-muted-foreground"
    : tender.target_gp_percent >= 22
      ? "text-emerald-600"
      : tender.target_gp_percent >= 10
        ? "text-amber-600"
        : "text-red-600";

  return (
    <Card onClick={onClick} className="border shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
      <CardContent className="p-3.5 space-y-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold truncate flex-1">{tender.customer_name || "Not captured yet"}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 rounded shrink-0 border-red-300 text-red-700 bg-red-50">
              Tender
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground truncate leading-snug">{tender.title || tender.id}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{tender.region || "Region not captured"}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold">{formatSar(tender.estimated_value)}</span>
          <span className={`text-[11px] font-mono font-bold ${gpTone}`}>
            {tender.target_gp_percent != null ? `${tender.target_gp_percent.toFixed(1)}%` : "GP not captured"}
          </span>
          <span className={`text-[9px] ml-auto font-mono ${deadline.tone}`}>{deadline.label}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-border text-muted-foreground bg-muted/30">
            CRM: {formatStage(tender.crm_pipeline_stage)}
          </Badge>
          {tender.days_in_status != null && tender.days_in_status > 14 && (
            <span className="text-[8px] text-amber-600 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {tender.days_in_status}d
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
          {attention.level !== "green" && (
            <span className={`text-[8px] px-1 py-0.5 rounded border ${
              attention.level === "red"
                ? "border-red-300 text-red-700 bg-red-50"
                : "border-amber-300 text-amber-700 bg-amber-50"
            }`}>
              {attention.label}
            </span>
          )}
          <span className="text-[9px] text-[#075eea] truncate flex-1">Open tender workspace</span>
          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-[7px] font-bold text-muted-foreground">{initials(tender.assigned_owner)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TenderPreviewPopup({
  tender,
  open,
  onClose,
}: {
  tender: TenderRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  if (!tender) return null;

  const days = daysUntilDeadline(tender.submission_deadline);
  const facts = [
    { label: "SAR Value", value: formatSar(tender.estimated_value) },
    { label: "GP%", value: tender.target_gp_percent != null ? `${tender.target_gp_percent}%` : "Not captured yet" },
    { label: "Probability", value: tender.probability_percent != null ? `${tender.probability_percent}%` : "Not captured yet" },
    { label: "Owner", value: tender.assigned_owner || "Not captured yet" },
    { label: "Region", value: tender.region || "Not captured yet" },
    { label: "Source", value: tender.source || "Not captured yet" },
    { label: "Submission Deadline", value: tender.submission_deadline || "Not captured yet" },
    { label: "Days to Deadline", value: days != null ? (days > 0 ? `${days} days` : days === 0 ? "Today" : `${Math.abs(days)} days overdue`) : "Not available" },
    { label: "Days in Status", value: tender.days_in_status != null ? `${tender.days_in_status}d` : "Not captured yet" },
  ];

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="px-8 py-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl font-semibold">{tender.customer_name || "Not captured yet"}</span>
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-red-300 text-red-700 bg-red-50">Tender</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{tender.title || tender.id}</p>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="text-muted-foreground">CRM: <strong className="text-foreground">{formatStage(tender.crm_pipeline_stage)}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground">Internal: <strong className="text-foreground">{formatStage(tender.phase)}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-4 h-4" />{tender.assigned_owner || "Not captured yet"}</span>
          </div>
        </div>

        <div className="px-8 py-5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Facts</p>
          <div className="grid grid-cols-3 gap-3">
            {facts.map(fact => (
              <div key={fact.label} className="bg-muted/30 rounded-lg p-2.5">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">{fact.label}</span>
                <span className="text-xs font-semibold">{fact.value}</span>
              </div>
            ))}
          </div>
        </div>

        {tender.notes && (
          <div className="px-8 py-5 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
            <p className="text-xs text-muted-foreground">{tender.notes}</p>
          </div>
        )}

        <div className="px-8 py-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button
            size="sm"
            onClick={() => { onClose(); navigate(cleanHref(`/tenders/${tender.id}`)); }}
          >
            Open Tender Workspace <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TendersOverview() {
  const [, navigate] = useLocation();
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCrmStage, setFilterCrmStage] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [previewTender, setPreviewTender] = useState<TenderRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchTenderPortfolioRows()
      .then(rows => {
        if (!cancelled) setTenders(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A failed read is not "no tender records".
        const message = error instanceof Error ? error.message : "Tender load failed for an unknown reason";
        console.error("[Tender Overview] Load error:", message);
        setLoadError(message);
        setTenders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  const crmStages = useMemo(() => Array.from(new Set(tenders.map(t => t.crm_pipeline_stage).filter(Boolean))).sort() as string[], [tenders]);
  const phases = useMemo(() => Array.from(new Set(tenders.map(t => t.phase).filter(Boolean))).sort() as string[], [tenders]);
  const owners = useMemo(() => Array.from(new Set(tenders.map(t => t.assigned_owner).filter(Boolean))).sort() as string[], [tenders]);
  const regions = useMemo(() => Array.from(new Set(tenders.map(t => t.region).filter(Boolean))).sort() as string[], [tenders]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return tenders.filter(tender => {
      if (filterCrmStage !== "all" && tender.crm_pipeline_stage !== filterCrmStage) return false;
      if (filterPhase !== "all" && tender.phase !== filterPhase) return false;
      if (filterOwner !== "all" && tender.assigned_owner !== filterOwner) return false;
      if (filterRegion !== "all" && tender.region !== filterRegion) return false;
      if (s && !(tender.customer_name || "").toLowerCase().includes(s) && !(tender.title || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tenders, search, filterCrmStage, filterPhase, filterOwner, filterRegion]);

  const byStage = useMemo(() => {
    const map = new Map<TenderStageKey, TenderRow[]>();
    for (const stage of TENDER_STAGES) map.set(stage.key, []);
    for (const tender of filtered) {
      map.get(normalizePhase(tender.phase))?.push(tender);
    }
    return map;
  }, [filtered]);

  const totalValue = filtered.reduce((s, t) => s + (t.estimated_value ?? 0), 0);
  const hasFilters = search || filterCrmStage !== "all" || filterPhase !== "all" || filterOwner !== "all" || filterRegion !== "all";

  function clearFilters() {
    setSearch("");
    setFilterCrmStage("all");
    setFilterPhase("all");
    setFilterOwner("all");
    setFilterRegion("all");
  }

  const readState = resolveReadState({ loading, error: loadError, count: tenders.length });

  if (readState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading Tender Pipeline...</p>
      </div>
    );
  }

  if (readState === "error") {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mx-auto max-w-md rounded-xl border border-red-300 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-600" />
          <p className="text-sm font-semibold text-red-900">Tender pipeline could not be loaded</p>
          <p className="mt-1 text-xs text-red-800">
            The read of <span className="font-mono">commercial_tickets</span> failed. No stage lanes,
            counts or pipeline value can be shown. This is a failed read, not an empty pipeline.
          </p>
          <p className="mt-2 break-words font-mono text-[10px] text-red-700">{loadError}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="w-3 h-3 mr-1.5" /> Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
              <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-red-600" />
            <h1 className="text-2xl font-serif font-bold">Tender Pipeline Overview</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {describeRenderedCount(filtered.length, tenders.length, "tender")} · {formatSarCompact(totalValue)} pipeline value
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

      <MetricsBar tenders={filtered} />

      <div className="space-y-2 mb-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search customer or tender title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All Regions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All Owners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterCrmStage} onValueChange={setFilterCrmStage}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="CRM Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CRM Stages</SelectItem>
              {crmStages.map(s => <SelectItem key={s} value={s}>{formatStage(s)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterPhase} onValueChange={setFilterPhase}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="Tender Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tender Stages</SelectItem>
              {phases.map(s => <SelectItem key={s} value={s}>{formatStage(s)}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <Gavel className="w-10 h-10 mx-auto mb-3 opacity-20" />
          {tenders.length === 0 ? (
            <>
              <p className="text-sm">No tender records are visible to this account.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">The read succeeded and returned no rows.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
                <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">No tenders match the current filters.</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearFilters}>Clear filters</Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-0 rounded-xl border border-border overflow-hidden">
          {TENDER_STAGES.map(stage => {
            const cards = byStage.get(stage.key) ?? [];
            if (cards.length === 0) return null;
            const stageValue = cards.reduce((sum, tender) => sum + (tender.estimated_value ?? 0), 0);

            return (
              <div key={stage.key} className={`flex gap-0 border-b last:border-b-0 border-border ${stage.border} ${stage.tone}`}>
                <div className="w-52 shrink-0 px-4 py-4 border-r border-border/60 flex flex-col justify-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${stage.labelColor}`}>{stage.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {cards.length} tender{cards.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{formatSarCompact(stageValue)}</span>
                </div>

                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {cards.map(tender => (
                      <TenderSwimLaneCard
                        key={tender.id}
                        tender={tender}
                        onClick={() => setPreviewTender(tender)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TenderPreviewPopup
        tender={previewTender}
        open={!!previewTender}
        onClose={() => setPreviewTender(null)}
      />
    </div>
  );
}
