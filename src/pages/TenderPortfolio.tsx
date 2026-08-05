/**
 * Tender Portfolio Overview — /tenders
 *
 * Portfolio access layer for tender records only.
 * Data: commercial_tickets where ticket_type = tender.
 * Mirrors Proposal Portfolio View (/commercial).
 * Live tender data only. No hardcoding. No proposal heuristics.
 */

import { useState, useMemo, useEffect } from "react";
import {
  Search, X, Gavel, ChevronRight, ExternalLink,
  MapPin, User, RefreshCw, Loader2, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { fetchTenderPortfolioRead, type TenderPortfolioRow } from "@/lib/tender-ticket-adapter";
import {
  resolveReadState,
  describeEmptyReadCause,
  describeIsolationWithholding,
  sumCaptured,
} from "@/lib/pipeline-tickets";
import { cleanHref } from "@clean/lib/clean-routing";

// ─── TYPES ──────────────────────────────────────────────────

type TenderRow = TenderPortfolioRow;

// ─── HELPERS ────────────────────────────────────────────────

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

/**
 * W04-C1 defect D: an unparseable date must not reach the screen as "NaNd".
 * Same guard shape as tender-ticket-adapter.daysSince.
 */
function daysUntilDeadline(d: string | null): number | null {
  if (!d) return null;
  const ms = new Date(d).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}

// ─── TAB DEFINITIONS ────────────────────────────────────────

type TabKey = "all" | "active" | "solution" | "drafting" | "submitted" | "negotiation" | "closed";

interface TabDef { key: TabKey; label: string; filter: (t: TenderRow) => boolean; }

const ACTIVE_PHASES = new Set(["identified", "qualification", "bid_no_bid"]);
const SOLUTION_PHASES = new Set(["solution_design", "pnl_pricing"]);
const DRAFTING_PHASES = new Set(["tender_drafting", "internal_review", "approval_matrix"]);
const SUBMITTED_PHASES = new Set(["submitted", "clarification", "client_evaluation"]);
const NEGOTIATION_PHASES = new Set(["negotiation", "awarded"]);
const CLOSED_PHASES = new Set(["lost_withdrawn"]);

const TABS: TabDef[] = [
  { key: "all", label: "All Tenders", filter: () => true },
  { key: "active", label: "Active", filter: t => ACTIVE_PHASES.has(t.phase || "") },
  { key: "solution", label: "Solution & Pricing", filter: t => SOLUTION_PHASES.has(t.phase || "") },
  { key: "drafting", label: "Drafting / Review", filter: t => DRAFTING_PHASES.has(t.phase || "") },
  { key: "submitted", label: "Submitted", filter: t => SUBMITTED_PHASES.has(t.phase || "") },
  { key: "negotiation", label: "Negotiation / Awarded", filter: t => NEGOTIATION_PHASES.has(t.phase || "") },
  { key: "closed", label: "Closed", filter: t => CLOSED_PHASES.has(t.phase || "") },
];

const NON_ACTIVE = new Set([...CLOSED_PHASES, "awarded"]);

// ─── METRICS BAR ────────────────────────────────────────────

function MetricsBar({ tenders }: { tenders: TenderRow[] }) {
  const active = tenders.filter(t => !NON_ACTIVE.has(t.phase || ""));
  const totalSar = active.reduce((s, t) => s + (t.estimated_value ?? 0), 0);
  const gpVals = active.map(t => t.target_gp_percent).filter((v): v is number => v != null);
  const avgGp = gpVals.length > 0 ? `${(gpVals.reduce((s, v) => s + v, 0) / gpVals.length).toFixed(1)}%` : "Not available";
  const stalled = active.filter(t => (t.days_in_status ?? 0) > 14).length;
  const awarded = tenders.filter(t => t.phase === "awarded").length;
  const lost = tenders.filter(t => t.phase === "lost_withdrawn").length;
  const decided = awarded + lost;
  const winRate = decided > 0 ? `${Math.round((awarded / decided) * 100)}%` : "Not available";

  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {[
        { label: "Total Active", value: String(active.length) },
        { label: "Pipeline SAR", value: formatSarCompact(totalSar) },
        { label: "Avg GP%", value: avgGp },
        { label: "Stalled", value: String(stalled), highlight: stalled > 0 },
        { label: "Win Rate", value: winRate },
      ].map(m => (
        <div key={m.label} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
          <p className={`text-lg font-semibold mt-0.5 ${m.highlight ? "text-amber-600" : ""}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── TENDER CARD ────────────────────────────────────────────

function TenderCard({ tender: t, onClick }: { tender: TenderRow; onClick: () => void }) {
  const days = daysUntilDeadline(t.submission_deadline);
  const gpPct = t.target_gp_percent;
  const gpColor = gpPct != null ? (gpPct >= 22 ? "text-emerald-600" : gpPct >= 10 ? "text-amber-600" : "text-red-600") : "text-muted-foreground";

  return (
    <div onClick={onClick} className="group rounded-lg border bg-card hover:shadow-md cursor-pointer transition-all duration-150 p-4">
      {/* Row 1: Customer + Tender badge */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold truncate flex-1">{t.customer_name || "Customer not captured"}</span>
        <Badge variant="outline" className="text-[9px] border-red-300 text-red-700 bg-red-50 shrink-0">Tender</Badge>
      </div>

      {/* Row 2: Title */}
      <p className="text-xs text-muted-foreground truncate mb-2">{t.title || "Tender title not captured"}</p>

      {/* Row 3: Stage badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {t.crm_pipeline_stage ? (
          <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-700 bg-slate-50">{formatStage(t.crm_pipeline_stage)}</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] border-dashed border-slate-300 text-muted-foreground/70">No CRM stage captured</Badge>
        )}
        {t.phase ? (
          <Badge variant="outline" className="text-[9px] border-[#075eea]/30 text-[#075eea] bg-[#075eea]/10">{formatStage(t.phase)}</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] border-dashed border-slate-300 text-muted-foreground/70">No tender stage captured</Badge>
        )}
      </div>

      {/* Row 4: Metrics */}
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <div>
          <span className="text-muted-foreground uppercase tracking-wider block">Value</span>
          <span className="font-mono font-semibold text-xs">{formatSar(t.estimated_value)}</span>
        </div>
        <div>
          <span className="text-muted-foreground uppercase tracking-wider block">GP%</span>
          <span className={`font-mono font-semibold text-xs ${gpColor}`}>{gpPct != null ? `${gpPct}%` : "Not captured"}</span>
        </div>
        <div>
          <span className="text-muted-foreground uppercase tracking-wider block">Deadline</span>
          {days != null ? (
            <span className={`font-mono font-semibold text-xs ${days < 7 ? "text-red-600" : days < 14 ? "text-amber-600" : ""}`}>
              {days > 0 ? `${days}d` : days === 0 ? "Today" : `${Math.abs(days)}d overdue`}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No deadline set</span>
          )}
        </div>
      </div>

      {/* Row 5: Owner + Region */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[90px]">{t.assigned_owner || "Unassigned"}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{t.region || "No region captured"}</span>
        </div>
        {t.source && <span className="ml-auto italic text-muted-foreground/60">{t.source}</span>}
      </div>
    </div>
  );
}

// ─── PREVIEW POPUP ──────────────────────────────────────────

function TenderPreviewPopup({ tender: t, open, onClose }: { tender: TenderRow | null; open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  if (!t) return null;

  const days = daysUntilDeadline(t.submission_deadline);
  const facts: { label: string; value: string }[] = [
    { label: "SAR Value", value: formatSar(t.estimated_value) },
    { label: "GP%", value: t.target_gp_percent != null ? `${t.target_gp_percent}%` : "Not captured yet" },
    { label: "Probability", value: t.probability_percent != null ? `${t.probability_percent}%` : "Not captured yet" },
    { label: "Owner", value: t.assigned_owner || "Unassigned" },
    { label: "Region", value: t.region || "No region captured" },
    { label: "Source", value: t.source || "Not captured yet" },
    { label: "Submission Deadline", value: t.submission_deadline || "No deadline set" },
    { label: "Days to Deadline", value: days != null ? (days > 0 ? `${days} days` : days === 0 ? "Today" : `${Math.abs(days)} days overdue`) : "No deadline set" },
    { label: "Days in Status", value: t.days_in_status != null ? `${t.days_in_status}d` : "Not captured yet" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 gap-0">
        {/* Header */}
        <div className="p-5 border-b">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold">{t.customer_name || "Customer not captured"}</h3>
            <Badge variant="outline" className="text-[9px] border-red-300 text-red-700 bg-red-50">Tender</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t.title || "Tender title not captured"}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">{t.id}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {t.crm_pipeline_stage ? (
              <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-700 bg-slate-50">CRM: {formatStage(t.crm_pipeline_stage)}</Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-dashed text-muted-foreground/70">No CRM stage captured</Badge>
            )}
            {t.phase ? (
              <Badge variant="outline" className="text-[9px] border-[#075eea]/30 text-[#075eea] bg-[#075eea]/10">Phase: {formatStage(t.phase)}</Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-dashed text-muted-foreground/70">No tender stage captured</Badge>
            )}
          </div>
        </div>

        {/* Key Facts */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {facts.map(m => (
              <div key={m.label} className="bg-muted/30 rounded-lg p-2.5">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">{m.label}</span>
                <span className="text-xs font-semibold">{m.value}</span>
              </div>
            ))}
          </div>

          {/* Document status remains a clean empty state until linked readiness counts are available. */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tender Documents</p>
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">No document readiness summary captured yet.</p>
            </div>
          </div>

          {t.notes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-xs text-muted-foreground">{t.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Close</Button>
          <Button size="sm" className="text-xs" onClick={() => { onClose(); navigate(cleanHref(`/tenders/${t.id}`)); }}>
            Open Tender Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function Tenders() {
  const [, navigate] = useLocation();
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  /** Rows the database returned before client-side process isolation ran. */
  const [fetchedRowCount, setFetchedRowCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCrmStage, setFilterCrmStage] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Preview
  const [previewTender, setPreviewTender] = useState<TenderRow | null>(null);

  // ─── LOAD DATA ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchTenderPortfolioRead()
      .then(read => {
        if (cancelled) return;
        setFetchedRowCount(read.fetched);
        setTenders(read.rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A failed read is not "no tender records".
        const message = error instanceof Error ? error.message : "Tender load failed for an unknown reason";
        console.error("[Tender Portfolio] Load error:", message);
        setLoadError(message);
        setTenders([]);
        setFetchedRowCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── DERIVED FILTER OPTIONS ─────────────────────────────
  const crmStages = useMemo(() => Array.from(new Set(tenders.map(t => t.crm_pipeline_stage).filter(Boolean))).sort() as string[], [tenders]);
  const phases = useMemo(() => Array.from(new Set(tenders.map(t => t.phase).filter(Boolean))).sort() as string[], [tenders]);
  const owners = useMemo(() => Array.from(new Set(tenders.map(t => t.assigned_owner).filter(Boolean))).sort() as string[], [tenders]);
  const regions = useMemo(() => Array.from(new Set(tenders.map(t => t.region).filter(Boolean))).sort() as string[], [tenders]);

  // ─── FILTER PIPELINE ────────────────────────────────────
  const dropdownFiltered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return tenders.filter(t => {
      if (filterCrmStage !== "all" && t.crm_pipeline_stage !== filterCrmStage) return false;
      if (filterPhase !== "all" && t.phase !== filterPhase) return false;
      if (filterOwner !== "all" && t.assigned_owner !== filterOwner) return false;
      if (filterRegion !== "all" && t.region !== filterRegion) return false;
      if (s && !(t.customer_name || "").toLowerCase().includes(s) && !(t.title || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tenders, search, filterCrmStage, filterPhase, filterOwner, filterRegion]);

  const activeTabDef = TABS.find(t => t.key === activeTab) ?? TABS[0];
  const tabFiltered = useMemo(() => dropdownFiltered.filter(activeTabDef.filter), [dropdownFiltered, activeTabDef]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {} as any;
    for (const tab of TABS) counts[tab.key] = dropdownFiltered.filter(tab.filter).length;
    return counts;
  }, [dropdownFiltered]);

  // Summary
  const totalValue = sumCaptured(tenders.map(t => t.estimated_value));
  const hasFilters = search || filterCrmStage !== "all" || filterPhase !== "all" || filterOwner !== "all" || filterRegion !== "all";

  function clearFilters() {
    setSearch(""); setFilterCrmStage("all"); setFilterPhase("all"); setFilterOwner("all"); setFilterRegion("all"); setActiveTab("all");
  }

  const readState = resolveReadState({ loading, error: loadError, count: tenders.length });

  if (readState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading tender portfolio…</p>
      </div>
    );
  }

  if (readState === "error") {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="mx-auto max-w-md rounded-xl border border-red-300 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-600" />
          <p className="text-sm font-semibold text-red-900">Tender portfolio could not be loaded</p>
          <p className="mt-1 text-xs text-red-800">
            The read of <span className="font-mono">commercial_tickets</span> failed. No tender count,
            pipeline value or win rate can be shown. This is a failed read, not an empty portfolio.
          </p>
          <p className="mt-2 break-words font-mono text-[10px] text-red-700">{loadError}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="w-3 h-3 mr-1.5" /> Retry
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
              <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-red-600" />
            <h1 className="text-2xl font-serif font-bold">Tender Portfolio Overview</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tender tickets only · search, filter, compare, and open tender workspaces.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {tenders.length} tender{tenders.length !== 1 ? "s" : ""} · SAR {formatSarCompact(totalValue)} pipeline
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Rows the database returned that this client removed — disclosed, not hidden */}
      {describeIsolationWithholding(fetchedRowCount, tenders.length) && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <p className="text-xs font-medium text-amber-900">
            {describeIsolationWithholding(fetchedRowCount, tenders.length)}
          </p>
        </div>
      )}

      {/* Metrics */}
      <MetricsBar tenders={tenders} />

      {/* Search + Filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" placeholder="Search customer or tender title…" value={search}
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
          <Select value={filterCrmStage} onValueChange={setFilterCrmStage}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="CRM Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CRM Stages</SelectItem>
              {crmStages.map(s => <SelectItem key={s} value={s}>{formatStage(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPhase} onValueChange={setFilterPhase}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="Internal Phase" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Phases</SelectItem>
              {phases.map(s => <SelectItem key={s} value={s}>{formatStage(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>Clear all</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)} className="mb-4">
        <TabsList className="h-9 bg-muted/40 rounded-lg p-0.5 gap-0.5 flex-wrap">
          {TABS.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}
              className="rounded-md px-3 h-7 text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
            >
              {tab.label}<span className="ml-1 text-[9px] opacity-60">({tabCounts[tab.key]})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grid */}
      {tabFiltered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Gavel className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          {tenders.length === 0 ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">No tender records are shown.</p>
              {/*
                W04-C1 defect E: this claimed the read returned no rows even
                when rows were returned and then removed client-side by the
                process-isolation allowlist. It now states which happened.
              */}
              <p className="text-xs text-muted-foreground/60 mt-1">
                {describeEmptyReadCause(fetchedRowCount, tenders.length)} Tenders are managed via the CRM Pipeline or created directly.
              </p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
                <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">No tenders match current filters.</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearFilters}>Clear filters</Button>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            {tabFiltered.length} tender{tabFiltered.length !== 1 ? "s" : ""}
            {hasFilters || activeTab !== "all" ? " (filtered)" : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tabFiltered.map(t => (
              <TenderCard key={t.id} tender={t} onClick={() => setPreviewTender(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      <TenderPreviewPopup tender={previewTender} open={!!previewTender} onClose={() => setPreviewTender(null)} />
    </div>
  );
}
