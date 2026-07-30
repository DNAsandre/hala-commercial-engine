/**
 * CRM Pipeline — Unified Kanban powered by commercial_tickets.
 *
 * Clicking a card opens a preview popup (NOT the workspace).
 * Drag-and-drop between columns to move stage.
 */

import { useState, useMemo, useEffect } from "react";
import { Kanban, RefreshCw, Plus, X, User, MapPin, Undo2, ArrowUpDown } from "lucide-react";
import UnifiedIntakeModal from "@/components/intake/UnifiedIntakeModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  deriveCommercialTicketPipelineTickets,
  CRM_PIPELINE_COLUMNS, CRM_TERMINAL,
  STAGE_COLORS, type CrmStageLabel, type PipelineTicket,
} from "@/lib/pipeline-tickets";
import { PipelineTicketCard } from "@/components/crm/PipelineCard";
import { changeStage, fetchOperationalTickets } from "@/lib/intake-save";

function formatSar(n: number): string {
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `SAR ${(n / 1_000).toFixed(0)}K`;
  return `SAR ${n.toLocaleString()}`;
}

// ─── SEARCH ICON ────────────────────────────────────────────
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="11" cy="11" r="8" strokeWidth="2" />
      <path strokeWidth="2" d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

// ─── COMPONENT ──────────────────────────────────────────────

export default function CrmPipeline() {
  const [tickets, setTickets] = useState<PipelineTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"latest" | "revenue" | "alphabetical">("latest");

  // Intake modal
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Drag state
  const [dragTicketId, setDragTicketId] = useState<string | null>(null);
  const [dragFromStage, setDragFromStage] = useState<CrmStageLabel | null>(null);
  const [dropTarget, setDropTarget] = useState<CrmStageLabel | null>(null);

  // ─── LOAD DATA (canonical commercial tickets) ───────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchOperationalTickets()
      .then(intakeRes => {
        if (cancelled) return;
        if (intakeRes.error) console.warn("[CRM Pipeline] Intake ticket fetch error:", intakeRes.error);
        const intakeTickets = deriveCommercialTicketPipelineTickets((intakeRes.data ?? []) as any);
        setTickets(intakeTickets);
      })
      .catch(err => {
        console.error("Pipeline load error:", err);
        toast.error("Failed to load pipeline data");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── DERIVED DATA ───────────────────────────────────────
  const owners = useMemo(() => Array.from(new Set(tickets.map(t => t.owner).filter(Boolean))).sort(), [tickets]);
  const regions = useMemo(() => Array.from(new Set(tickets.map(t => t.region).filter(Boolean))).sort(), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (ownerFilter !== "all" && t.owner !== ownerFilter) return false;
      if (regionFilter !== "all" && t.region !== regionFilter) return false;
      if (typeFilter !== "all" && t.ticketType !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.customerName.toLowerCase().includes(s) && !t.opportunityName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [tickets, ownerFilter, regionFilter, typeFilter, search]);

  const columns = useMemo(() => {
    const map = new Map<CrmStageLabel, PipelineTicket[]>();
    for (const stage of CRM_PIPELINE_COLUMNS) map.set(stage, []);
    for (const t of filtered) {
      const col = map.get(t.crmStage);
      if (col) col.push(t);
      else {
        const fallback = map.get("Prospecting");
        fallback?.push(t);
      }
    }
    // Sort each column in-place based on sortMode
    for (const [, cards] of map) {
      cards.sort((a, b) => {
        if (sortMode === "latest") {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        }
        if (sortMode === "revenue") {
          const av = a.sarValue > 0 ? a.sarValue : -1;
          const bv = b.sarValue > 0 ? b.sarValue : -1;
          return bv - av;
        }
        // alphabetical
        return (
          a.customerName.localeCompare(b.customerName) ||
          a.opportunityName.localeCompare(b.opportunityName)
        );
      });
    }
    return map;
  }, [filtered, sortMode]);

  const metrics = useMemo(() => {
    const total = tickets.length;
    const totalValue = tickets.reduce((s, t) => s + t.sarValue, 0);
    const avgGp = tickets.length > 0 ? tickets.reduce((s, t) => s + t.gpPct, 0) / tickets.length : 0;
    return { total, totalValue, avgGp };
  }, [tickets]);

  // ─── DRAG HANDLERS ─────────────────────────────────────
  function handleDragStart(ticketId: string, fromStage: CrmStageLabel) {
    setDragTicketId(ticketId);
    setDragFromStage(fromStage);
  }

  function handleDragEnd() {
    setDragTicketId(null);
    setDragFromStage(null);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent, stage: CrmStageLabel) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(stage);
  }

  async function handleDrop(e: React.DragEvent, targetStage: CrmStageLabel) {
    e.preventDefault();
    setDropTarget(null);
    if (!dragTicketId || !dragFromStage || dragFromStage === targetStage) {
      handleDragEnd();
      return;
    }

    const ticket = tickets.find(t => t.id === dragTicketId);
    if (!ticket) { handleDragEnd(); return; }

    // Optimistic update — move client-side immediately
    setTickets(prev => prev.map(t => t.id === dragTicketId ? { ...t, crmStage: targetStage } : t));
    toast.success(`Moved to ${targetStage}`);

    const { error } = await changeStage(
      dragTicketId,
      "crm_pipeline_stage",
      dragFromStage,
      targetStage,
      "CRM Pipeline",
    );

    if (error) {
      // Rollback on failure
      setTickets(prev => prev.map(t => t.id === dragTicketId ? { ...t, crmStage: dragFromStage! } : t));
      toast.error(`Failed to update stage: ${error}`);
    }

    handleDragEnd();
  }

  const activeFilters = (ownerFilter !== "all" ? 1 : 0) + (regionFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (search ? 1 : 0);

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Kanban className="h-5 w-5 text-[var(--color-hala-navy)]" />
            <h1 className="text-xl font-semibold">CRM Pipeline</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {metrics.total} tickets &nbsp;·&nbsp;
            {formatSar(metrics.totalValue)} pipeline value &nbsp;·&nbsp;
            Avg GP: {metrics.avgGp.toFixed(1)}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIntakeOpen(true)} className="gap-1 bg-[#1B2A4A] hover:bg-[#1B2A4A]/90">
            <Plus className="h-3 w-3" /> Add Ticket
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        <UnifiedIntakeModal
          open={intakeOpen}
          onOpenChange={setIntakeOpen}
          onCreated={() => setRefreshKey(k => k + 1)}
        />
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Search customer or opportunity..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="tender">Tender</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><User className="w-3 h-3 mr-1 text-muted-foreground" /><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><MapPin className="w-3 h-3 mr-1 text-muted-foreground" /><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortMode} onValueChange={v => setSortMode(v as any)}>
            <SelectTrigger className="w-36 h-8 text-xs"><ArrowUpDown className="w-3 h-3 mr-1 text-muted-foreground" /><SelectValue placeholder="Order By" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest Created</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setOwnerFilter("all"); setRegionFilter("all"); setTypeFilter("all"); setSearch(""); }}>
              <X className="w-3 h-3 mr-1" /> Clear ({activeFilters})
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading pipeline data...</div>
      )}

      {/* Kanban Board */}
      {!loading && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full min-w-max px-6 py-4">
            {CRM_PIPELINE_COLUMNS.map(stage => {
              const cards = columns.get(stage) ?? [];
              const isDropping = dropTarget === stage && dragFromStage !== stage;
              const canDrop = dragTicketId ? dragFromStage !== stage && !CRM_TERMINAL.includes(dragFromStage!) : false;
              const colValue = cards.reduce((s, t) => s + t.sarValue, 0);
              const colors = STAGE_COLORS[stage];

              return (
                <div
                  key={stage}
                  className={`
                    w-[250px] shrink-0 rounded-lg border-t-[3px] flex flex-col
                    transition-all duration-150
                    ${colors.border} border-t-current
                    ${isDropping && canDrop ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/20"}
                  `}
                  style={{ borderTopColor: undefined }}
                  onDragOver={e => { if (canDrop || !dragTicketId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(stage); } }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={e => { if (canDrop) handleDrop(e, stage); }}
                >
                  {/* Column Header */}
                  <div className={`px-3 py-2.5 rounded-t-lg ${colors.headerBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold tracking-wide uppercase ${colors.text}`}>{stage}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">{cards.length}</Badge>
                    </div>
                    {colValue > 0 && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatSar(colValue)}</p>}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                    {cards.length === 0 && (
                      <div className="text-center py-6 text-[10px] text-muted-foreground/50">No Tickets</div>
                    )}
                    {cards.map(ticket => (
                      <PipelineTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onDragStart={() => handleDragStart(ticket.id, ticket.crmStage)}
                        onDragEnd={handleDragEnd}
                        isDragging={dragTicketId === ticket.id}
                      />
                    ))}
                  </div>

                  {/* Drop indicator */}
                  {isDropping && canDrop && (
                    <div className="mx-2 mb-2 h-8 rounded border-2 border-dashed border-primary/30 flex items-center justify-center">
                      <span className="text-[10px] text-primary/50">Drop here</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
