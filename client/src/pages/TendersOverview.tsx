/**
 * Tenders Overview — Swimlane View by Lifecycle Stage
 *
 * Vertical swimlanes: each row = one pipeline stage.
 * Cards inside each lane are 2-wide max.
 * Clicking a card navigates to Tender Pipeline with that company pre-selected.
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Gavel,
  Search,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  Kanban,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSAR } from "@/lib/store";
import {
  tenders,
  type Tender,
  type TenderMilestone,
  TENDER_MILESTONE_ORDER,
  TENDER_TERMINAL,
  getTenderStatusDisplayName,
  getTenderStatusColor,
} from "@/lib/tender-engine";

// ─── FULL STAGE ORDER (main + terminal) ─────────────────────────

const ALL_STAGES: TenderMilestone[] = [
  ...TENDER_MILESTONE_ORDER,
  "lost",
  "withdrawn",
];

// ─── STAGE COLORS ────────────────────────────────────────────────

const STAGE_ACCENT: Record<TenderMilestone, string> = {
  identified:         "border-l-slate-400 bg-slate-50 dark:bg-slate-900/20",
  preparing_submission:"border-l-blue-400 bg-blue-50 dark:bg-blue-900/20",
  submitted:          "border-l-violet-400 bg-violet-50 dark:bg-violet-900/20",
  clarification:      "border-l-amber-400 bg-amber-50 dark:bg-amber-900/20",
  technical_review:   "border-l-cyan-400 bg-cyan-50 dark:bg-cyan-900/20",
  commercial_review:  "border-l-indigo-400 bg-indigo-50 dark:bg-indigo-900/20",
  negotiation:        "border-l-orange-400 bg-orange-50 dark:bg-orange-900/20",
  awarded:            "border-l-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  lost:               "border-l-red-400 bg-red-50 dark:bg-red-900/20",
  withdrawn:          "border-l-gray-300 bg-gray-50 dark:bg-gray-900/20",
};

const STAGE_LABEL_COLOR: Record<TenderMilestone, string> = {
  identified:         "text-slate-600 dark:text-slate-400",
  preparing_submission:"text-blue-600 dark:text-blue-400",
  submitted:          "text-violet-600 dark:text-violet-400",
  clarification:      "text-amber-600 dark:text-amber-400",
  technical_review:   "text-cyan-600 dark:text-cyan-400",
  commercial_review:  "text-indigo-600 dark:text-indigo-400",
  negotiation:        "text-orange-600 dark:text-orange-400",
  awarded:            "text-emerald-600 dark:text-emerald-400",
  lost:               "text-red-600 dark:text-red-400",
  withdrawn:          "text-gray-500 dark:text-gray-400",
};

// ─── MINI LIFECYCLE BAR ──────────────────────────────────────────

function MiniLifecycleBar({ current }: { current: TenderMilestone }) {
  const currentIdx = TENDER_MILESTONE_ORDER.indexOf(current);
  const isTerminal = TENDER_TERMINAL.includes(current);

  return (
    <div className="flex items-center gap-0.5 mb-3">
      {TENDER_MILESTONE_ORDER.map((stage, i) => {
        const stageIdx = i;
        let color: string;
        if (stage === current) color = "bg-[var(--color-hala-navy)] h-2";
        else if (isTerminal) color = "bg-emerald-400 h-1.5";
        else if (stageIdx < currentIdx) color = "bg-emerald-400 h-1.5";
        else if (stageIdx === currentIdx + 1) color = "bg-border h-1.5 border border-dashed border-slate-300";
        else color = "bg-muted h-1.5";
        return (
          <div
            key={stage}
            title={getTenderStatusDisplayName(stage)}
            className={`flex-1 rounded-sm transition-all ${color}`}
          />
        );
      })}
    </div>
  );
}

// ─── COMPANY CARD (compact for swimlane) ────────────────────────

function SwimLaneCard({
  tender,
  onClick,
}: {
  tender: Tender;
  onClick: () => void;
}) {
  const daysLeft = Math.ceil(
    (new Date(tender.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isTerminal = TENDER_TERMINAL.includes(tender.status);
  const isOverdue = daysLeft < 0 && !isTerminal;
  const isDue = daysLeft >= 0 && daysLeft <= 10 && !isTerminal;

  return (
    <Card
      onClick={onClick}
      className="border border-border shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
    >
      <CardContent className="p-4">
        {/* Mini lifecycle bar */}
        <MiniLifecycleBar current={tender.status} />

        {/* Company + title */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold truncate">{tender.customerName}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate leading-snug">
            {tender.title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{tender.region}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">VALUE</p>
            <p className="text-xs font-mono font-semibold">{formatSAR(tender.estimatedValue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">MARGIN</p>
            <p
              className={`text-xs font-semibold ${
                tender.targetGpPercent < 15
                  ? "text-red-600"
                  : tender.targetGpPercent < 22
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            >
              {tender.targetGpPercent.toFixed(0)}% GP
            </p>
          </div>
          <div className="text-right">
            {isOverdue && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Overdue</span>
              </div>
            )}
            {isDue && (
              <div className="flex items-center gap-1 text-amber-600">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Due in {daysLeft}d</span>
              </div>
            )}
            {!isOverdue && !isDue && (
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

export default function TendersOverview() {
  const [, navigate] = useLocation();
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");

  const regions = useMemo(
    () => Array.from(new Set(tenders.map(t => t.region))).sort(),
    []
  );

  const filtered = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return tenders.filter(t => {
      if (filterRegion !== "all" && t.region !== filterRegion) return false;
      if (
        search &&
        !t.customerName.toLowerCase().includes(search) &&
        !t.title.toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [filterSearch, filterRegion]);

  // Group by stage — preserving stage order
  const byStage = useMemo(() => {
    const map = new Map<TenderMilestone, Tender[]>();
    for (const stage of ALL_STAGES) {
      const cards = filtered.filter(t => t.status === stage);
      if (cards.length > 0) map.set(stage, cards);
    }
    return map;
  }, [filtered]);

  const totalValue = filtered.reduce((s, t) => s + t.estimatedValue, 0);

  function handleCardClick(tender: Tender) {
    // Navigate to Tender Pipeline with this company pre-selected via URL param
    navigate(`/tenders?company=${encodeURIComponent(tender.customerName)}`);
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Tenders Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} tenders · {byStage.size} active stages ·{" "}
            {formatSAR(totalValue)} pipeline value
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/tenders")}>
            <Gavel className="w-4 h-4 mr-1.5" />
            Tender Pipeline
          </Button>
          <Button variant="outline" onClick={() => navigate("/tender-board")}>
            <Kanban className="w-4 h-4 mr-1.5" />
            Board View
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2 mb-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search company or tender name..."
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
          {(filterSearch || filterRegion !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setFilterSearch(""); setFilterRegion("all"); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Swimlane View */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Gavel className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No tenders match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl border border-border overflow-hidden">
          {ALL_STAGES.map(stage => {
            const cards = byStage.get(stage);
            if (!cards || cards.length === 0) return null;

            return (
              <div
                key={stage}
                className={`flex gap-0 border-b last:border-b-0 border-border ${STAGE_ACCENT[stage]} border-l-4`}
              >
                {/* Stage label — left column */}
                <div className="w-44 shrink-0 px-4 py-4 border-r border-border/60 flex flex-col justify-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${STAGE_LABEL_COLOR[stage]}`}>
                    {getTenderStatusDisplayName(stage)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {cards.length} tender{cards.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatSAR(cards.reduce((s, t) => s + t.estimatedValue, 0))}
                  </span>
                </div>

                {/* Cards — 2-column grid */}
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {cards.map(t => (
                      <SwimLaneCard
                        key={t.id}
                        tender={t}
                        onClick={() => handleCardClick(t)}
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
