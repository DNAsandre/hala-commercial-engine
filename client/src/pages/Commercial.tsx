/*
 * Commercial Pipeline — Hala Commercial Engine
 *
 * Exact same UI flow as Tenders:
 *   - Pipeline list with filters (company, owner, region, stage)
 *   - Click a workspace → detail panel with tabs at TOP
 *   - Tabs: Overview · Commercial · Delivery · Risk & Signals · Customer · Documents · Activity · Audit Trail
 *
 * Data: commercial workspaces from Supabase (type = "commercial" or undefined)
 */

import { useState, useMemo, useEffect } from "react";
import {
  Briefcase,
  Plus,
  ChevronRight,
  Users,
  DollarSign,
  Clock,
  Building2,
  AlertTriangle,
  Target,
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Zap,
  TrendingDown,
  Activity,
  MapPin,
  Kanban,
  Link2,
  ExternalLink,
  History,
  CheckCircle,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  formatSAR, formatPercent,
  COMMERCIAL_MILESTONES,
  getWorkspaceType,
  customers,
  type Workspace,
} from "@/lib/store";
import { useWorkspaces, useCustomers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import { WorkspaceRiskSignalsTab } from "@/components/WorkspaceRiskSignalsTab";
import { useLocation } from "wouter";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";

// ─── MILESTONE STRIP ────────────────────────────────────────

const STRIP_STAGES = COMMERCIAL_MILESTONES.filter(s => s.value !== "closed_lost");

function LifecycleStrip({ current }: { current: string }) {
  const currentIdx = STRIP_STAGES.findIndex(s => s.value === current);
  const isTerminal = ["go_live", "closed_lost"].includes(current);

  return (
    <div>
      <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
        {STRIP_STAGES.map((s, i) => {
          const isCurrent = s.value === current;
          const isPast = !isTerminal && i < currentIdx;
          const isFuture = !isCurrent && !isPast;

          return (
            <div key={s.value} className="flex items-center shrink-0">
              <div className={`
                relative flex flex-col items-center px-3 py-2 rounded-lg
                ${isCurrent
                  ? "bg-[var(--color-hala-navy)] text-white shadow-md"
                  : isPast
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground/50"
                }
              `}>
                <div className={`w-2 h-2 rounded-full mb-1.5 ${
                  isCurrent ? "bg-white" :
                  isPast ? "bg-emerald-500" :
                  "bg-muted-foreground/20"
                }`} />
                <span className={`text-[10px] font-medium whitespace-nowrap leading-none ${isCurrent ? "text-white font-semibold" : ""}`}>
                  {s.label}
                </span>
              </div>
              {i < STRIP_STAGES.length - 1 && (
                <div className={`h-px w-4 shrink-0 ${i < currentIdx ? "bg-emerald-400" : "bg-muted-foreground/15"}`} />
              )}
            </div>
          );
        })}

        {/* Terminal: Closed Lost */}
        <div className="ml-3 flex items-center gap-1">
          <div className="h-4 w-px bg-border mx-1" />
          <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
            current === "closed_lost"
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : "text-muted-foreground/40"
          }`}>
            Closed Lost
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
        Commercial lifecycle tracker — separate from internal working board.
      </p>
    </div>
  );
}

// ─── SIGNAL BAR ────────────────────────────────────────────

function getMarginSignal(gp: number): { label: string; color: "green" | "amber" | "red" } {
  if (gp < 10) return { label: "Critical", color: "red" };
  if (gp < 22) return { label: "Tight", color: "amber" };
  return { label: "Healthy", color: "green" };
}

function getStageSignal(stage: string, daysInStage: number): string {
  if (daysInStage > 21) return `Stalled ${daysInStage}d in ${getStageName(stage)}`;
  if (daysInStage > 14) return `${daysInStage}d — monitor closely`;
  return `${daysInStage}d in stage — on track`;
}

function getStageName(stage: string): string {
  return COMMERCIAL_MILESTONES.find(s => s.value === stage)?.label ?? stage.replace(/_/g, " ");
}

function getStageColor(stage: string): string {
  return COMMERCIAL_MILESTONES.find(s => s.value === stage)?.color ?? "";
}

function ragDot(color: "green" | "amber" | "red") {
  return color === "green" ? "bg-emerald-500" : color === "amber" ? "bg-amber-500" : "bg-red-500";
}
function ragText(color: "green" | "amber" | "red") {
  return color === "green" ? "text-emerald-700" : color === "amber" ? "text-amber-700" : "text-red-700";
}

function WorkspaceSignalBar({ ws }: { ws: Workspace }) {
  const margin = getMarginSignal(ws.gpPercent);
  const stageSignal = getStageSignal(ws.stage, ws.daysInStage);
  const isStalled = ws.daysInStage > 21;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Value */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Value
        </span>
        <span className="text-base font-bold font-mono text-foreground leading-tight">
          {formatSAR(ws.estimatedValue)}
        </span>
      </div>

      {/* Margin */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> Margin
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${ragDot(margin.color)}`} />
          <span className={`text-sm font-semibold ${ragText(margin.color)}`}>{margin.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{ws.gpPercent}% GP</span>
      </div>

      {/* Stage */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Activity className="w-3 h-3" /> Status
        </span>
        <span className={`text-xs font-medium leading-snug mt-0.5 ${isStalled ? "text-amber-600" : "text-foreground"}`}>
          {stageSignal}
        </span>
      </div>

      {/* Pallets */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Target className="w-3 h-3" /> Pallets
        </span>
        <span className="text-base font-bold leading-tight">{ws.palletVolume.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground">contracted</span>
      </div>

      {/* Owner */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Users className="w-3 h-3" /> Owner
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-5 h-5 rounded-full bg-[var(--color-hala-navy)] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {ws.owner.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium truncate">{ws.owner}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{ws.region}</span>
      </div>
    </div>
  );
}

// ─── LIST CARD ─────────────────────────────────────────────

function WorkspaceListCard({
  ws,
  selected,
  onClick,
}: {
  ws: Workspace;
  selected: boolean;
  onClick: () => void;
}) {
  const margin = getMarginSignal(ws.gpPercent);
  const isStalled = ws.daysInStage > 21;
  const ragColor =
    margin.color === "red" || isStalled ? "bg-red-500" :
    margin.color === "amber" ? "bg-amber-500" :
    "bg-emerald-500";

  const stageInfo = COMMERCIAL_MILESTONES.find(s => s.value === ws.stage);

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-sm transition-all cursor-pointer ${
        selected ? "border-primary ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ragColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium leading-snug line-clamp-2">{ws.customerName}</span>
              <Badge
                variant="outline"
                className={`text-[9px] shrink-0 whitespace-nowrap ${stageInfo?.color ?? ""}`}
              >
                {stageInfo?.label ?? ws.stage}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{ws.title} · {ws.region}</p>

            {/* Mini stage bar */}
            <div className="flex items-center gap-0.5 mb-2">
              {STRIP_STAGES.map((s, i) => {
                const idx = STRIP_STAGES.findIndex(x => x.value === ws.stage);
                const isCur = s.value === ws.stage;
                const isPast = i < idx && idx !== -1;
                return (
                  <div
                    key={s.value}
                    className={`h-1 rounded-full flex-1 transition-all ${
                      isCur ? "bg-[var(--color-hala-navy)]" :
                      isPast ? "bg-emerald-400" :
                      "bg-muted-foreground/10"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground uppercase">Value</span>
              <span className="text-xs font-bold font-mono">{formatSAR(ws.estimatedValue)}</span>
              <span className={`text-[10px] font-medium ml-auto ${
                isStalled ? "text-amber-600" :
                margin.color === "red" ? "text-red-600" :
                "text-muted-foreground"
              }`}>
                {isStalled ? `${ws.daysInStage}d stalled` : `GP ${ws.gpPercent}%`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function Commercial() {
  const { data: allWorkspaces, loading: wsLoading, refetch } = useWorkspaces();
  const { data: customerList } = useCustomers();
  const [, navigate] = useLocation();

  // Only commercial workspaces
  const workspaces = useMemo(
    () => (allWorkspaces || []).filter(w => getWorkspaceType(w) === "commercial"),
    [allWorkspaces]
  );

  // Filters
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  // Auto-select first workspace once loaded
  useEffect(() => {
    if (!selectedId && workspaces.length > 0) {
      setSelectedId(workspaces[0].id);
    }
  }, [workspaces, selectedId]);

  // Read ?company= URL param (from Commercial Overview navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get("company");
    if (company) {
      const decoded = decodeURIComponent(company);
      setFilterCompany(decoded);
      const match = workspaces.find(w => w.customerName === decoded);
      if (match) setSelectedId(match.id);
      const url = new URL(window.location.href);
      url.searchParams.delete("company");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [workspaces]);

  const owners = useMemo(() => Array.from(new Set(workspaces.map(w => w.owner))).sort(), [workspaces]);
  const regions = useMemo(() => Array.from(new Set(workspaces.map(w => w.region))).sort(), [workspaces]);
  const companies = useMemo(() => Array.from(new Set(workspaces.map(w => w.customerName))).sort(), [workspaces]);

  const filteredWorkspaces = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return workspaces.filter(w => {
      if (filterCompany !== "all" && w.customerName !== filterCompany) return false;
      if (filterOwner !== "all" && w.owner !== filterOwner) return false;
      if (filterRegion !== "all" && w.region !== filterRegion) return false;
      if (filterStage !== "all" && w.stage !== filterStage) return false;
      if (search && !w.customerName.toLowerCase().includes(search) && !w.title.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [filterCompany, filterSearch, filterOwner, filterRegion, filterStage, workspaces]);

  const selectedWs = workspaces.find(w => w.id === selectedId) ?? null;
  const selectedCustomer = selectedWs ? (customerList || customers).find(c => c.id === selectedWs.customerId) : null;

  // Pipeline metrics
  const totalValue = workspaces.reduce((s, w) => s + w.estimatedValue, 0);
  const stalledCount = workspaces.filter(w => w.daysInStage > 21).length;
  const openCount = workspaces.filter(w => !["go_live", "closed_lost"].includes(w.stage)).length;

  function clearFilters() {
    setFilterCompany("all");
    setFilterSearch("");
    setFilterOwner("all");
    setFilterRegion("all");
    setFilterStage("all");
  }

  const hasFilters = filterCompany !== "all" || filterSearch || filterOwner !== "all" || filterRegion !== "all" || filterStage !== "all";

  if (wsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Commercial Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openCount} active · SAR {(totalValue / 1_000_000).toFixed(1)}M pipeline · {stalledCount} stalled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/commercial-overview")}>
            <Kanban className="w-4 h-4 mr-1.5" />
            Overview
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Workspace
          </Button>
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search company or workspace name..."
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); setSelectedId(null); }}
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
          <Select value={filterCompany} onValueChange={v => { setFilterCompany(v); setSelectedId(null); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-[165px] h-8 text-xs">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {COMMERCIAL_MILESTONES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="space-y-6">

        {/* ── Workspace Detail — shown when a workspace is selected ── */}
        {selectedWs && (
          <div className="space-y-4">
            <Tabs defaultValue="overview">
              <div className="border border-border rounded-xl overflow-hidden shadow-none">

                {/* ── Tab Bar (at the TOP — same as Tenders) ── */}
                <div className="border-b border-border bg-muted/20 px-3 pt-2 pb-0">
                  <TabsList className="h-9 bg-muted/40 rounded-lg p-0.5 gap-0.5">
                    {[
                      { value: "overview", label: "Overview" },
                      { value: "commercial", label: "Commercial" },
                      { value: "delivery", label: "Delivery" },
                      { value: "risk", label: "Risk & Signals" },
                      { value: "customer", label: "Customer" },
                      { value: "documents", label: "Documents" },
                      { value: "activity", label: "Activity" },
                      { value: "audit", label: "Audit Trail" },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="rounded-md px-3 h-7 text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* ═══════════════════════════════════════════════
                    1. OVERVIEW
                ═══════════════════════════════════════════════ */}
                <TabsContent value="overview" className="mt-0">
                  {/* Lifecycle strip */}
                  <div className="px-4 pt-4 pb-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Lifecycle Tracker
                      </span>
                      <Button
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => navigate(`/workspaces/${selectedWs.id}`)}
                      >
                        Open Full Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                    <LifecycleStrip current={selectedWs.stage} />
                  </div>

                  {/* Identity row */}
                  <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setSelectedId(workspaces[0]?.id ?? null)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate">{selectedWs.customerName}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">Commercial</Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] shrink-0 font-semibold ${getStageColor(selectedWs.stage)}`}
                        >
                          {getStageName(selectedWs.stage)}
                        </Badge>
                        {selectedWs.crmDealId && (
                          <Badge variant="outline" className="text-[9px] shrink-0 border-emerald-300 text-emerald-600">
                            CRM: {selectedWs.crmDealId}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedWs.title}</p>
                    </div>
                  </div>

                  {/* Signal cards + quick actions */}
                  <div className="p-4 space-y-4">
                    <WorkspaceSignalBar ws={selectedWs} />

                    {/* Stall alert */}
                    {selectedWs.daysInStage > 14 && (
                      <div className={`p-3 rounded-lg border ${selectedWs.daysInStage > 21 ? "border-red-300 bg-red-50 dark:bg-red-900/20" : "border-amber-300 bg-amber-50 dark:bg-amber-900/20"}`}>
                        <div className="flex items-center gap-2">
                          <Zap className={`w-4 h-4 ${selectedWs.daysInStage > 21 ? "text-red-600" : "text-amber-600"}`} />
                          <span className={`text-xs font-medium ${selectedWs.daysInStage > 21 ? "text-red-700" : "text-amber-700"}`}>
                            {selectedWs.daysInStage > 21
                              ? `Stalled ${selectedWs.daysInStage} days in ${getStageName(selectedWs.stage)} — action required`
                              : `${selectedWs.daysInStage} days in ${getStageName(selectedWs.stage)} — monitor closely`
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Open full workspace CTA */}
                    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary">Commercial Workspace</span>
                        <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">
                          {getStageName(selectedWs.stage)}
                        </Badge>
                      </div>
                      <Button size="sm" className="text-xs h-7" onClick={() => navigate(`/workspaces/${selectedWs.id}`)}>
                        Open Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    2. COMMERCIAL
                ═══════════════════════════════════════════════ */}
                <TabsContent value="commercial" className="mt-0 p-4 space-y-5">
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Commercial Summary
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Est. Value</span>
                        <p className="text-lg font-bold font-mono">{formatSAR(selectedWs.estimatedValue)}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">GP%</span>
                        <p className="text-lg font-bold">{selectedWs.gpPercent}%</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Est. Gross Profit</span>
                        <p className="text-lg font-bold font-mono">
                          {formatSAR(Math.round(selectedWs.estimatedValue * selectedWs.gpPercent / 100))}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Pallet Volume</span>
                        <p className="text-lg font-bold">{selectedWs.palletVolume.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" /> Margin Analysis
                    </h4>
                    {(() => {
                      const margin = getMarginSignal(selectedWs.gpPercent);
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Target GP%</span>
                            <p className="text-lg font-bold">{selectedWs.gpPercent}%</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Margin Signal</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${ragDot(margin.color)}`} />
                              <span className="text-sm font-semibold">{margin.label}</span>
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Approval Status</span>
                            <p className="text-sm font-semibold mt-1">
                              {selectedWs.approvalState === "fully_approved" ? "✓ Approved" :
                               selectedWs.approvalState === "pending" ? "⏳ Pending" :
                               selectedWs.approvalState === "rejected" ? "✗ Rejected" :
                               "—"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Commercial Versions / Quotes
                    </h4>
                    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/10 text-center">
                      <p className="text-xs text-muted-foreground">Open the full workspace to manage quotes and proposals.</p>
                      <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => navigate(`/workspaces/${selectedWs.id}`)}>
                        Open Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    3. DELIVERY
                ═══════════════════════════════════════════════ */}
                <TabsContent value="delivery" className="mt-0 p-4 space-y-5">
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Account Owner
                    </h4>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {selectedWs.owner.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{selectedWs.owner}</p>
                        <p className="text-[10px] text-muted-foreground">Account Owner · {selectedWs.region} Region</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">Owner</Badge>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Operational Context
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Region</span>
                        <p className="text-sm font-semibold">{selectedWs.region}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Stage Duration</span>
                        <p className="text-sm font-semibold">{selectedWs.daysInStage}d</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">RAG Status</span>
                        <p className="text-sm font-semibold capitalize">{selectedWs.ragStatus}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    4. RISK & SIGNALS
                ═══════════════════════════════════════════════ */}
                <TabsContent value="risk" className="mt-0 p-4">
                  <WorkspaceRiskSignalsTab
                    workspaceId={selectedWs.id}
                    customerId={selectedWs.customerId}
                    contextLabel={selectedWs.customerName}
                    derivedSignals={((): import("@/components/WorkspaceRiskSignalsTab").DerivedSignal[] => {
                      const s: import("@/components/WorkspaceRiskSignalsTab").DerivedSignal[] = [];
                      const margin = getMarginSignal(selectedWs.gpPercent);
                      s.push(margin.color !== "green"
                        ? { label: "Margin Risk", detail: `GP ${selectedWs.gpPercent}% — ${margin.label}`, severity: margin.color }
                        : { label: "Margin", detail: `GP ${selectedWs.gpPercent}% — healthy`, severity: "green" }
                      );
                      if (selectedWs.daysInStage > 21) s.push({ label: "Stage Stall", detail: `${selectedWs.daysInStage}d in ${getStageName(selectedWs.stage)} — action required`, severity: "red" });
                      else if (selectedWs.daysInStage > 14) s.push({ label: "Stage Velocity", detail: `${selectedWs.daysInStage}d in ${getStageName(selectedWs.stage)} — monitor`, severity: "amber" });
                      if (!selectedWs.crmDealId) s.push({ label: "CRM Not Linked", detail: "Workspace not linked to a CRM deal", severity: "amber" });
                      return s;
                    })()}
                  />
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    5. CUSTOMER
                ═══════════════════════════════════════════════ */}
                <TabsContent value="customer" className="mt-0 p-4 space-y-5">
                  {selectedCustomer ? (
                    <>
                      <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Customer Identity
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Customer</span>
                            <p className="text-sm font-bold">{selectedCustomer.name}</p>
                            <p className="text-[10px] text-muted-foreground">{selectedCustomer.group}</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Code</span>
                            <p className="text-sm font-mono font-semibold">{selectedCustomer.code}</p>
                            <p className="text-[10px] text-muted-foreground">{selectedCustomer.city}, {selectedCustomer.region}</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Industry</span>
                            <p className="text-sm font-semibold">{selectedCustomer.industry}</p>
                            <p className="text-[10px] text-muted-foreground">{selectedCustomer.serviceType}</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Grade</span>
                            <p className="text-sm font-bold">{selectedCustomer.grade}</p>
                            <p className="text-[10px] text-muted-foreground">{selectedCustomer.paymentStatus}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" /> Financial Health
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Contract Value</span>
                            <p className="text-sm font-bold font-mono">{formatSAR(selectedCustomer.contractValue2025)}</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">DSO</span>
                            <p className={`text-sm font-bold ${selectedCustomer.dso > 60 ? "text-red-600" : selectedCustomer.dso > 45 ? "text-amber-600" : "text-emerald-600"}`}>
                              {selectedCustomer.dso}d
                            </p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Payment</span>
                            <p className={`text-sm font-semibold ${selectedCustomer.paymentStatus === "Good" ? "text-emerald-600" : selectedCustomer.paymentStatus === "Acceptable" ? "text-amber-600" : "text-red-600"}`}>
                              {selectedCustomer.paymentStatus}
                            </p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Contract Expiry</span>
                            <p className="text-sm font-semibold">{selectedCustomer.contractExpiry}</p>
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/customers/${selectedCustomer.id}`)}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Full Customer Profile
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Customer not found in system.</p>
                    </div>
                  )}
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    6. DOCUMENTS
                ═══════════════════════════════════════════════ */}
                <TabsContent value="documents" className="mt-0 p-4">
                  <div className="p-6 rounded-xl border border-dashed border-border bg-muted/10 text-center space-y-2">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">Documents managed in full workspace</p>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/workspaces/${selectedWs.id}`)}>
                      Open Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    7. ACTIVITY
                ═══════════════════════════════════════════════ */}
                <TabsContent value="activity" className="mt-0 p-4">
                  <div className="p-6 rounded-xl border border-dashed border-border bg-muted/10 text-center space-y-2">
                    <Activity className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">Activity log available in full workspace</p>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/workspaces/${selectedWs.id}`)}>
                      Open Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    8. AUDIT TRAIL
                ═══════════════════════════════════════════════ */}
                <TabsContent value="audit" className="mt-0 p-4">
                  <div className="p-6 rounded-xl border border-dashed border-border bg-muted/10 text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">Full audit trail in workspace</p>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/workspaces/${selectedWs.id}`)}>
                      Open Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        )}

        {/* ── Pipeline List ── */}
        <div>
          {filteredWorkspaces.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Briefcase className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No commercial workspaces match filters</p>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? "s" : ""}
                {hasFilters ? " (filtered)" : ""}
              </p>
              {filteredWorkspaces.map(ws => (
                <WorkspaceListCard
                  key={ws.id}
                  ws={ws}
                  selected={ws.id === selectedId}
                  onClick={() => setSelectedId(ws.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create workspace dialog */}
      {showCreate && (
        <CreateWorkspaceDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          defaultMode="commercial"
          onCreated={() => {
            refetch();
            toast.success("Workspace created.");
          }}
        />
      )}
    </div>
  );
}
