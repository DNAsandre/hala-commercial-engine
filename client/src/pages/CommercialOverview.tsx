/**
 * Commercial Overview — Swimlane View by Commercial Milestone
 *
 * Structurally IDENTICAL to TendersOverview:
 *   - Vertical swimlanes: each row = one commercial milestone
 *   - Cards inside each lane are 2-wide max
 *   - Clicking a card navigates to Commercial workspace detail
 *
 * Only change: data source, milestone labels, card content (decision-first)
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Briefcase,
  Search,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatSAR,
  COMMERCIAL_MILESTONES,
  mapToCommercialMilestone,
  getWorkspaceType,
  type Workspace,
} from "@/lib/store";
import { useWorkspaces } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";

// ─── COMMERCIAL MILESTONE VALUES (for lane order) ────────────────

type CommercialMilestone = string;

const ALL_MILESTONES = COMMERCIAL_MILESTONES.map(m => m.value);
const MAIN_MILESTONES = ALL_MILESTONES.filter(v => v !== "closed_lost");

// ─── STAGE ACCENT COLORS (matching Tender swimlane aesthetic) ────

const MILESTONE_ACCENT: Record<string, string> = {
  qualified:           "border-l-blue-400 bg-blue-50 dark:bg-blue-900/20",
  solution_design:     "border-l-indigo-400 bg-indigo-50 dark:bg-indigo-900/20",
  quoting:             "border-l-violet-400 bg-violet-50 dark:bg-violet-900/20",
  proposal_active:     "border-l-purple-400 bg-purple-50 dark:bg-purple-900/20",
  negotiation:         "border-l-orange-400 bg-orange-50 dark:bg-orange-900/20",
  commercial_approved: "border-l-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  contract_signed:     "border-l-green-400 bg-green-50 dark:bg-green-900/20",
  go_live:             "border-l-green-500 bg-green-50 dark:bg-green-900/20",
  closed_lost:         "border-l-red-400 bg-red-50 dark:bg-red-900/20",
};

const MILESTONE_LABEL_COLOR: Record<string, string> = {
  qualified:           "text-blue-600 dark:text-blue-400",
  solution_design:     "text-indigo-600 dark:text-indigo-400",
  quoting:             "text-violet-600 dark:text-violet-400",
  proposal_active:     "text-purple-600 dark:text-purple-400",
  negotiation:         "text-orange-600 dark:text-orange-400",
  commercial_approved: "text-emerald-600 dark:text-emerald-400",
  contract_signed:     "text-green-600 dark:text-green-400",
  go_live:             "text-green-700 dark:text-green-400",
  closed_lost:         "text-red-600 dark:text-red-400",
};

// ─── DECISION SIGNALS (interpreted, not raw) ─────────────────────

function getMarginSignal(gpPercent: number): { label: string; color: string; textColor: string } {
  if (gpPercent >= 22) return { label: "Healthy", color: "bg-emerald-500", textColor: "text-emerald-600" };
  if (gpPercent >= 15) return { label: "Tight", color: "bg-amber-500", textColor: "text-amber-600" };
  return { label: "Critical", color: "bg-red-500", textColor: "text-red-600" };
}

function getTimeSignal(daysInStage: number): { label: string; color: string; textColor: string } {
  if (daysInStage <= 7) return { label: "On Track", color: "bg-emerald-500", textColor: "text-emerald-600" };
  if (daysInStage <= 14) return { label: "At Risk", color: "bg-amber-500", textColor: "text-amber-600" };
  return { label: "Overdue", color: "bg-red-500", textColor: "text-red-600" };
}

function getExecutionSignal(ws: Workspace): { label: string; textColor: string } {
  const stage = mapToCommercialMilestone(ws.stage);
  const stageIdx = ALL_MILESTONES.indexOf(stage);
  if (stageIdx >= ALL_MILESTONES.indexOf("commercial_approved")) return { label: "Ready", textColor: "text-emerald-600" };
  if (stageIdx >= ALL_MILESTONES.indexOf("proposal_active")) return { label: "In Progress", textColor: "text-blue-600" };
  return { label: "Not Started", textColor: "text-muted-foreground" };
}

// ─── MINI LIFECYCLE BAR (matching Tender bar exactly) ────────────

function MiniLifecycleBar({ current }: { current: string }) {
  const currentIdx = MAIN_MILESTONES.indexOf(current);
  const isTerminal = current === "closed_lost";

  return (
    <div className="flex items-center gap-0.5 mb-3">
      {MAIN_MILESTONES.map((stage, i) => {
        let color: string;
        if (stage === current) color = "bg-[var(--color-hala-navy)] h-2";
        else if (isTerminal) color = "bg-emerald-400 h-1.5";
        else if (i < currentIdx) color = "bg-emerald-400 h-1.5";
        else if (i === currentIdx + 1) color = "bg-border h-1.5 border border-dashed border-slate-300";
        else color = "bg-muted h-1.5";
        return (
          <div
            key={stage}
            title={COMMERCIAL_MILESTONES.find(m => m.value === stage)?.label || stage}
            className={`flex-1 rounded-sm transition-all ${color}`}
          />
        );
      })}
    </div>
  );
}

// ─── SWIMLANE CARD (matching Tender card, commercial content) ────

function SwimLaneCard({
  workspace,
  onClick,
}: {
  workspace: Workspace;
  onClick: () => void;
}) {
  const mapped = mapToCommercialMilestone(workspace.stage);
  const margin = getMarginSignal(workspace.gpPercent);
  const time = getTimeSignal(workspace.daysInStage);
  const execution = getExecutionSignal(workspace);
  const isCriticalMargin = workspace.gpPercent < 15;
  const isStalled = workspace.daysInStage > 14;

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group ${
        isCriticalMargin ? "border-red-300" : "border-border"
      }`}
    >
      <CardContent className="p-4">
        {/* Mini lifecycle bar */}
        <MiniLifecycleBar current={mapped} />

        {/* Company + deal */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold truncate">{workspace.customerName}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate leading-snug">
            {workspace.title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{workspace.region}</p>
        </div>

        {/* Decision signals row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Margin */}
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${margin.color}`} />
            <span className={`text-[10px] font-semibold ${margin.textColor}`}>{margin.label}</span>
          </div>
          {/* Execution */}
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium ${execution.textColor}`}>{execution.label}</span>
          </div>
          {/* Time */}
          <div className="flex items-center gap-1">
            {isStalled && <Clock className="w-2.5 h-2.5 text-red-500" />}
            <span className={`text-[10px] font-medium ${time.textColor}`}>{time.label}</span>
          </div>
        </div>

        {/* Footer — value + signal tag */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">VALUE</p>
            <p className="text-xs font-mono font-semibold">{formatSAR(workspace.estimatedValue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">MARGIN</p>
            <p className={`text-xs font-semibold ${margin.textColor}`}>
              {margin.label}
            </p>
          </div>
          <div className="text-right">
            {isCriticalMargin && (
              <div className="flex items-center gap-1 text-red-600">
                <TrendingDown className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Critical</span>
              </div>
            )}
            {!isCriticalMargin && isStalled && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Stalled</span>
              </div>
            )}
            {!isCriticalMargin && !isStalled && workspace.approvalState === "pending" && (
              <div className="flex items-center gap-1 text-amber-600">
                <ShieldAlert className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Approval</span>
              </div>
            )}
            {!isCriticalMargin && !isStalled && workspace.approvalState !== "pending" && (
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3 h-3" />
                <span className="text-[10px] font-semibold">On Track</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────

export default function CommercialOverview() {
  const [, navigate] = useLocation();
  const { data: workspaces, loading } = useWorkspaces();
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");

  // Only commercial workspaces
  const commercialWs = useMemo(
    () => workspaces.filter(w => getWorkspaceType(w) === "commercial"),
    [workspaces]
  );

  const regions = useMemo(
    () => Array.from(new Set(commercialWs.map(w => w.region))).sort(),
    [commercialWs]
  );

  const owners = useMemo(
    () => Array.from(new Set(commercialWs.map(w => w.owner))).sort(),
    [commercialWs]
  );

  const filtered = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return commercialWs.filter(w => {
      if (filterRegion !== "all" && w.region !== filterRegion) return false;
      if (filterOwner !== "all" && w.owner !== filterOwner) return false;
      if (
        search &&
        !w.customerName.toLowerCase().includes(search) &&
        !w.title.toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [commercialWs, filterSearch, filterRegion, filterOwner]);

  // Group by milestone — preserving milestone order
  const byMilestone = useMemo(() => {
    const map = new Map<string, Workspace[]>();
    for (const ms of ALL_MILESTONES) {
      const cards = filtered.filter(w => mapToCommercialMilestone(w.stage) === ms);
      if (cards.length > 0) map.set(ms, cards);
    }
    return map;
  }, [filtered]);

  const totalValue = filtered.reduce((s, w) => s + w.estimatedValue, 0);
  const stalledCount = filtered.filter(w => w.daysInStage > 14).length;

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  function getMilestoneLabel(value: string): string {
    return COMMERCIAL_MILESTONES.find(m => m.value === value)?.label || value;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header — matching Tender Overview exactly */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Commercial Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} deals · {byMilestone.size} active stages ·{" "}
            {formatSAR(totalValue)} pipeline value
            {stalledCount > 0 && <span className="text-amber-600"> · {stalledCount} stalled</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/commercial")}>
            <Briefcase className="w-4 h-4 mr-1.5" />
            Commercial Pipeline
          </Button>
        </div>
      </div>

      {/* Search + Filters — matching Tender layout */}
      <div className="space-y-2 mb-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
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
        <div className="flex items-center gap-2">
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterSearch || filterRegion !== "all" || filterOwner !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setFilterSearch(""); setFilterRegion("all"); setFilterOwner("all"); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Swimlane View — EXACT same structure as Tender Overview */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No deals match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl border border-border overflow-hidden">
          {ALL_MILESTONES.map(ms => {
            const cards = byMilestone.get(ms);
            if (!cards || cards.length === 0) return null;

            return (
              <div
                key={ms}
                className={`flex gap-0 border-b last:border-b-0 border-border ${MILESTONE_ACCENT[ms] || "bg-muted/20"} border-l-4`}
              >
                {/* Milestone label — left column */}
                <div className="w-44 shrink-0 px-4 py-4 border-r border-border/60 flex flex-col justify-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${MILESTONE_LABEL_COLOR[ms] || "text-muted-foreground"}`}>
                    {getMilestoneLabel(ms)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {cards.length} deal{cards.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatSAR(cards.reduce((s, w) => s + w.estimatedValue, 0))}
                  </span>
                </div>

                {/* Cards — 2-column grid */}
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {cards.map(w => (
                      <SwimLaneCard
                        key={w.id}
                        workspace={w}
                        onClick={() => navigate(`/workspaces/${w.id}`)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
