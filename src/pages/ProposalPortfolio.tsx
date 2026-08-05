/**
 * Proposal Portfolio View — /commercial
 *
 * Portfolio access layer for proposal-type tickets only.
 * Data: commercial_tickets where ticket_type = proposal.
 * Live proposal data only. No trackers. No workspace duplication.
 */

import { useState, useMemo, useEffect } from "react";
import {
  Search, X, Briefcase, RefreshCw, ExternalLink, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import {
  deriveCommercialTicketPipelineTickets, resolveReadState, describeRenderedCount,
  type PipelineTicket, type CrmStageLabel,
} from "@/lib/pipeline-tickets";
import { PipelineTicketCard } from "@/components/crm/PipelineCard";
import { fetchOperationalTicketsByType } from "@/lib/intake-save";

// ─── HELPERS ────────────────────────────────────────────────

function formatSar(n: number): string {
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `SAR ${(n / 1_000).toFixed(0)}K`;
  return `SAR ${n.toLocaleString()}`;
}

// ─── TAB FILTER DEFINITIONS ─────────────────────────────────

type TabKey = "all" | "critical" | "needs_action" | "ready_to_send" | "negotiation" | "awaiting_approval" | "contract_golive";

interface TabDef {
  key: TabKey;
  label: string;
  filter: (t: PipelineTicket) => boolean;
}

const TABS: TabDef[] = [
  {
    key: "all",
    label: "All Proposals",
    filter: () => true,
  },
  {
    key: "critical",
    label: "Critical",
    filter: (t) => t.riskLevel === "red" || t.riskLabel === "Critical",
  },
  {
    key: "needs_action",
    label: "Needs Action",
    filter: (t) => t.daysInStage > 14 || t.riskLevel !== "green" || t.syncStatus === "none",
  },
  {
    key: "ready_to_send",
    label: "Ready to Send",
    filter: (t) =>
      t.internalStage === "quoting" ||
      t.internalStage === "proposal active" ||
      t.crmStage === "Proposal Sent",
  },
  {
    key: "negotiation",
    label: "In Negotiation",
    filter: (t) =>
      t.crmStage === "Contract Negotiation" ||
      t.internalStage === "negotiation" ||
      t.crmStage === "Shortlisted",
  },
  {
    key: "awaiting_approval",
    label: "Awaiting Approval",
    filter: (t) =>
      t.internalStage === "commercial approved" ||
      t.crmStage === "Closed Won",
  },
  {
    key: "contract_golive",
    label: "Contract / Go-Live",
    filter: (t) =>
      t.crmStage === "Contract Signed" ||
      t.crmStage === "Actual Go Live" ||
      t.internalStage === "contract signed" ||
      t.internalStage === "contract sent" ||
      t.internalStage === "go live" ||
      t.internalStage === "handover",
  },
];

// Card + Popup: Uses the exact same PipelineTicketCard from CRM Pipeline.
// No duplicate card or popup — single source of truth.

// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function Commercial() {
  const [, navigate] = useLocation();
  const [allTickets, setAllTickets] = useState<PipelineTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCrmStage, setFilterCrmStage] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Preview handled by PipelineTicketCard's built-in popup

  // ─── LOAD DATA ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchOperationalTicketsByType("proposal")
      .then((result) => {
        if (cancelled) return;
        if (result.error) throw new Error(result.error);
        setAllTickets(deriveCommercialTicketPipelineTickets(result.data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A failed read is not "no proposal tickets".
        console.error("Portfolio load error:", err);
        setLoadError(err instanceof Error ? err.message : "Proposal load failed for an unknown reason");
        setAllTickets([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── DERIVED FILTER OPTIONS ─────────────────────────────
  const crmStages = useMemo(() => Array.from(new Set(allTickets.map((t) => t.crmStage))).sort(), [allTickets]);
  const owners = useMemo(() => Array.from(new Set(allTickets.map((t) => t.owner).filter(Boolean))).sort(), [allTickets]);
  const regions = useMemo(() => Array.from(new Set(allTickets.map((t) => t.region).filter(Boolean))).sort(), [allTickets]);

  // ─── FILTER PIPELINE ────────────────────────────────────
  const dropdownFiltered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return allTickets.filter((t) => {
      if (filterCrmStage !== "all" && t.crmStage !== filterCrmStage) return false;
      if (filterOwner !== "all" && t.owner !== filterOwner) return false;
      if (filterRegion !== "all" && t.region !== filterRegion) return false;
      if (filterRisk !== "all" && t.riskLevel !== filterRisk) return false;
      if (s && !t.customerName.toLowerCase().includes(s) && !t.opportunityName.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [allTickets, search, filterCrmStage, filterOwner, filterRegion, filterRisk]);

  // Tab-filtered (applies on top of dropdown filters)
  const activeTabDef = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const tabFiltered = useMemo(() => dropdownFiltered.filter(activeTabDef.filter), [dropdownFiltered, activeTabDef]);

  // Tab counts (computed from dropdown-filtered data so counts respond to dropdown filters)
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {} as any;
    for (const tab of TABS) {
      counts[tab.key] = dropdownFiltered.filter(tab.filter).length;
    }
    return counts;
  }, [dropdownFiltered]);

  // Summary metrics — computed over the cards actually rendered (`tabFiltered`),
  // so the headline can never describe a larger set than the grid below it.
  const totalValue = tabFiltered.reduce((s, t) => s + t.sarValue, 0);
  const criticalCount = tabFiltered.filter((t) => t.riskLevel === "red").length;

  const hasFilters = search || filterCrmStage !== "all" || filterOwner !== "all" || filterRegion !== "all" || filterRisk !== "all";

  function clearFilters() {
    setSearch("");
    setFilterCrmStage("all");
    setFilterOwner("all");
    setFilterRegion("all");
    setFilterRisk("all");
    setActiveTab("all");
  }

  // ─── LOADING / ERROR ────────────────────────────────────
  const readState = resolveReadState({ loading, error: loadError, count: allTickets.length });

  if (readState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading proposal portfolio…</p>
      </div>
    );
  }

  if (readState === "error") {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="mx-auto max-w-md rounded-xl border border-red-300 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-600" />
          <p className="text-sm font-semibold text-red-900">Proposal portfolio could not be loaded</p>
          <p className="mt-1 text-xs text-red-800">
            The read of <span className="font-mono">commercial_tickets</span> failed. No proposal count
            or pipeline value can be shown. This is a failed read, not an empty portfolio.
          </p>
          <p className="mt-2 break-words font-mono text-[10px] text-red-700">{loadError}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
              <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-serif font-bold">Proposal Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Proposal tickets only · search, filter, compare, and review clean proposal records.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {describeRenderedCount(tabFiltered.length, allTickets.length, "proposal")} · {formatSar(totalValue)} pipeline
            {criticalCount > 0 && <span className="text-red-600 font-medium"> · {criticalCount} critical</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customer or opportunity name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              {crmStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="red">Critical</SelectItem>
              <SelectItem value="amber">Low GP</SelectItem>
              <SelectItem value="green">Healthy</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Portfolio Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mb-4">
        <TabsList className="h-9 bg-muted/40 rounded-lg p-0.5 gap-0.5 flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="rounded-md px-3 h-7 text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
            >
              {tab.label}
              <span className="ml-1 text-[9px] opacity-60">({tabCounts[tab.key]})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Portfolio Grid */}
      {tabFiltered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Briefcase className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          {allTickets.length === 0 ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">No proposal tickets are visible to this account.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">The read succeeded and returned no rows. Create or sync proposal tickets from the CRM Pipeline.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate(cleanHref("/crm-pipeline"))}>
                <ExternalLink className="w-3 h-3 mr-1.5" /> Go to CRM Pipeline
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">No proposals match current filters.</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            {tabFiltered.length} proposal{tabFiltered.length !== 1 ? "s" : ""}
            {hasFilters || activeTab !== "all" ? " (filtered)" : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tabFiltered.map((t) => (
              <PipelineTicketCard
                key={t.id}
                ticket={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
