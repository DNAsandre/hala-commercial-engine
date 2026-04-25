/**
 * Tender Board — Kanban View of Tenders by Milestone
 *
 * Drag-and-drop to any column — instant, no blocking, no governance modal.
 * Human-controlled milestone movement.
 */

import { useState, useCallback, useMemo } from "react";
import {
  Kanban,
  GripVertical,
  AlertTriangle,
  ShieldAlert,
  X,
  User,
  MapPin,
  DollarSign,
  Clock,
  ArrowRight,
  ExternalLink,
  Target,
  Undo2,
  Link2,
  FileText,
  CalendarDays,
  ArrowLeft } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { formatSAR } from "@/lib/store";
import { useWorkspaces } from "@/hooks/useSupabase";
import {
  tenders,
  type Tender,
  type TenderMilestone,
  TENDER_KANBAN_COLUMNS,
  TENDER_TERMINAL,
  getTenderStatusDisplayName,
  getTenderMilestoneShortLabel,
  getTenderStatusColor,
  moveTenderMilestone,
  revertTenderStatus,
  getTenderMetrics,
  type WorkspaceSuggestion,
} from "@/lib/tender-engine";

// ─── CONSTANTS ─────────────────────────────────────────────

const GP_THRESHOLD = 22;

const STATUS_COLUMN_COLORS: Record<TenderMilestone, string> = {
  identified: "border-t-slate-400",
  preparing_submission: "border-t-blue-400",
  submitted: "border-t-violet-400",
  clarification: "border-t-amber-400",
  technical_review: "border-t-cyan-400",
  commercial_review: "border-t-indigo-400",
  negotiation: "border-t-orange-400",
  awarded: "border-t-emerald-400",
  lost: "border-t-red-400",
  withdrawn: "border-t-gray-400",
};

const STATUS_HEADER_BG: Record<TenderMilestone, string> = {
  identified: "bg-slate-50 dark:bg-slate-900/30",
  preparing_submission: "bg-blue-50 dark:bg-blue-900/30",
  submitted: "bg-violet-50 dark:bg-violet-900/30",
  clarification: "bg-amber-50 dark:bg-amber-900/30",
  technical_review: "bg-cyan-50 dark:bg-cyan-900/30",
  commercial_review: "bg-indigo-50 dark:bg-indigo-900/30",
  negotiation: "bg-orange-50 dark:bg-orange-900/30",
  awarded: "bg-emerald-50 dark:bg-emerald-900/30",
  lost: "bg-red-50 dark:bg-red-900/30",
  withdrawn: "bg-gray-50 dark:bg-gray-900/30",
};

// ─── TYPES ─────────────────────────────────────────────────

interface DragState {
  tenderId: string;
  fromStatus: TenderMilestone;
}

// ─── COMPONENT ─────────────────────────────────────────────

export default function TenderBoard() {
  const [, navigate] = useLocation();

  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [riskOnly, setRiskOnly] = useState(false);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<TenderMilestone | null>(null);

  const [undoBanner, setUndoBanner] = useState<{ tenderId: string; title: string } | null>(null);
  const [wsSuggestion, setWsSuggestion] = useState<WorkspaceSuggestion | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Unique owners and regions
  const owners = useMemo(() => {
    return Array.from(new Set(tenders.map(t => t.assignedOwner))).sort();
  }, []);

  const regions = useMemo(() => {
    return Array.from(new Set(tenders.map(t => t.region))).sort();
  }, []);

  const filteredTenders = useMemo(() => {
    return tenders.filter(t => {
      if (ownerFilter !== "all" && t.assignedOwner !== ownerFilter) return false;
      if (regionFilter !== "all" && t.region !== regionFilter) return false;
      if (riskOnly && t.targetGpPercent >= GP_THRESHOLD) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, regionFilter, riskOnly, refreshKey]);

  const columns = useMemo(() => {
    const map = new Map<TenderMilestone, Tender[]>();
    for (const status of TENDER_KANBAN_COLUMNS) {
      map.set(status, []);
    }
    for (const t of filteredTenders) {
      const col = map.get(t.status);
      if (col) col.push(t);
    }
    return map;
  }, [filteredTenders]);

  const metrics = useMemo(() => getTenderMetrics(), [refreshKey, tenders.length]);

  // ─── DRAG HANDLERS ─────────────────────────────────────

  const handleDragStart = useCallback((tender: Tender) => {
    setDragState({ tenderId: tender.id, fromStatus: tender.status });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, status: TenderMilestone) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(status);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetMilestone: TenderMilestone) => {
      e.preventDefault();
      setDropTarget(null);

      if (!dragState) return;
      const { tenderId, fromStatus } = dragState;
      setDragState(null);

      if (fromStatus === targetMilestone) return;

      const tender = tenders.find(t => t.id === tenderId);
      if (!tender) return;

      // Instant move — no blocking
      const result = moveTenderMilestone(tenderId, targetMilestone);
      if (result.success) {
        toast.success(result.message);
        setUndoBanner({ tenderId, title: tender.title });
        setTimeout(() => setUndoBanner(b => b?.tenderId === tenderId ? null : b), 5 * 60 * 1000);
        if (result.workspaceSuggestion) {
          setWsSuggestion(result.workspaceSuggestion);
        }
        setRefreshKey(k => k + 1);
      } else {
        toast.error(result.message);
      }
    },
    [dragState]
  );

  // ─── UNDO ──────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (!undoBanner) return;
    const result = revertTenderStatus(undoBanner.tenderId);
    if (result.success) {
      toast.success(result.message);
      setUndoBanner(null);
      setRefreshKey(k => k + 1);
    } else {
      toast.error(result.message);
    }
  }, [undoBanner]);

  // ─── STATS ─────────────────────────────────────────────

  const totalValue = filteredTenders.reduce((s, t) => s + t.estimatedValue, 0);
  const riskCount = filteredTenders.filter(t => t.targetGpPercent < GP_THRESHOLD).length;
  const activeFilters = (ownerFilter !== "all" ? 1 : 0) + (regionFilter !== "all" ? 1 : 0) + (riskOnly ? 1 : 0);

  return (
    <div className="p-4 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <Link href="/tenders">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Tenders
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Kanban className="w-5 h-5 text-[var(--color-hala-navy)]" />
            <h1 className="text-xl font-serif font-bold">Tender Board</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredTenders.length} tenders · {formatSAR(totalValue)} pipeline
            · Win rate: {metrics.winRate.toFixed(0)}%
            {riskCount > 0 && (
              <span className="text-[var(--color-rag-amber)] ml-2">· {riskCount} low GP</span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <User className="w-3 h-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <MapPin className="w-3 h-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="East">East</SelectItem>
              <SelectItem value="Central">Central</SelectItem>
              <SelectItem value="West">West</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <Switch
              id="risk-filter"
              checked={riskOnly}
              onCheckedChange={setRiskOnly}
              className="scale-75"
            />
            <Label htmlFor="risk-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Low GP only
            </Label>
          </div>

          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => {
                setOwnerFilter("all");
                setRegionFilter("all");
                setRiskOnly(false);
              }}
            >
              <X className="w-3 h-3 mr-1" />
              Clear ({activeFilters})
            </Button>
          )}
        </div>
      </div>

      {/* Undo Banner */}
      {undoBanner && (
        <div className="mb-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Undo2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">
              "{undoBanner.title}" moved. Undo available for 5 minutes.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleUndo} className="text-blue-700 border-blue-300 h-7 text-xs">
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Workspace Suggestion Banner */}
      {wsSuggestion && (
        <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Link2 className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-amber-800 dark:text-amber-200">{wsSuggestion.message}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 h-7 text-xs"
              onClick={() => {
                navigate(`/workspaces/${wsSuggestion.workspaceId}`);
                setWsSuggestion(null);
              }}
            >
              Go to Workspace
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWsSuggestion(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {TENDER_KANBAN_COLUMNS.map(status => {
            const cards = columns.get(status) ?? [];
            const isDropping = dropTarget === status && dragState?.fromStatus !== status;
            const canDrop = dragState ? dragState.fromStatus !== status && !TENDER_TERMINAL.includes(dragState.fromStatus) : false;
            const isInvalidTarget = dragState && !canDrop && status !== dragState.fromStatus;
            const colValue = cards.reduce((s, t) => s + t.estimatedValue, 0);

            return (
              <div
                key={status}
                className={`
                  w-[230px] shrink-0 rounded-lg border-t-[3px] flex flex-col
                  transition-all duration-150
                  ${STATUS_COLUMN_COLORS[status]}
                  ${isDropping && canDrop ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"}
                  ${isInvalidTarget ? "opacity-40" : ""}
                `}
                onDragOver={(e) => { if (canDrop) handleDragOver(e, status); else e.preventDefault(); }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => { if (canDrop) handleDrop(e, status); }}
              >
                {/* Column Header */}
                <div className={`px-3 py-2.5 rounded-t-lg ${STATUS_HEADER_BG[status]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide uppercase">
                      {getTenderMilestoneShortLabel(status)}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                      {cards.length}
                    </Badge>
                  </div>
                  {colValue > 0 && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {formatSAR(colValue)}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                  {cards.length === 0 && (
                    <div className="text-center py-6 text-[10px] text-muted-foreground/50">
                      No tenders
                    </div>
                  )}
                  {cards.map(tender => (
                    <TenderCard
                      key={tender.id}
                      tender={tender}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={dragState?.tenderId === tender.id}
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

    </div>
  );
}

// ─── TENDER CARD ──────────────────────────────────────────

interface TenderCardProps {
  tender: Tender;
  onDragStart: (t: Tender) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function TenderCard({ tender, onDragStart, onDragEnd, isDragging }: TenderCardProps) {
  const isRisk = tender.targetGpPercent < GP_THRESHOLD;
  const isCritical = tender.targetGpPercent < 15;
  const daysLeft = Math.ceil((new Date(tender.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isTerminal = TENDER_TERMINAL.includes(tender.status);

  return (
    <div
      draggable={!isTerminal}
      onDragStart={(e) => {
        if (isTerminal) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", tender.id);
        onDragStart(tender);
      }}
      onDragEnd={onDragEnd}
      className={`
        group rounded-md border bg-card shadow-sm hover:shadow-md
        transition-all duration-150
        ${isTerminal ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
        ${isDragging ? "opacity-40 scale-95 ring-2 ring-primary/30" : ""}
        ${isRisk && !isTerminal ? "border-l-2 border-l-[var(--color-rag-amber)]" : "border-border"}
        ${isCritical && !isTerminal ? "border-l-[var(--color-rag-red)]" : ""}
      `}
    >
      <div className="p-2.5">
        {/* Drag handle + Customer */}
        <div className="flex items-start gap-1.5 mb-1.5">
          {!isTerminal && (
            <GripVertical className="w-3 h-3 text-muted-foreground/30 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[11px] font-semibold truncate">
                {tender.customerName}
              </span>
              {tender.linkedWorkspaceId && (
                <Link2 className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate" style={{ paddingLeft: isTerminal ? 0 : "1rem" }}>
              {tender.title}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2" style={{ paddingLeft: isTerminal ? 0 : "1rem" }}>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Value</p>
            <p className="text-[11px] font-mono font-medium">{formatSAR(tender.estimatedValue)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Target GP%</p>
            <p className={`text-[11px] font-mono font-bold ${
              isCritical ? "text-[var(--color-rag-red)]" :
              isRisk ? "text-[var(--color-rag-amber)]" :
              "text-[var(--color-rag-green)]"
            }`}>
              {tender.targetGpPercent.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Deadline</p>
            <p className={`text-[11px] font-mono ${daysLeft <= 14 ? "text-[var(--color-rag-red)]" : daysLeft <= 30 ? "text-[var(--color-rag-amber)]" : ""}`}>
              {daysLeft > 0 ? `${daysLeft}d` : "Passed"}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Prob.</p>
            <p className="text-[11px] font-mono">{tender.probabilityPercent}%</p>
          </div>
        </div>

        {/* Footer: Owner + Risk Badge */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50" style={{ paddingLeft: isTerminal ? 0 : "1rem" }}>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            {tender.assignedOwner}
          </span>
          <div className="flex items-center gap-1">
            {isRisk && !isTerminal && (
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1 ${
                  isCritical
                    ? "border-red-300 text-red-700 bg-red-50"
                    : "border-amber-300 text-amber-700 bg-amber-50"
                }`}
              >
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                {isCritical ? "Critical" : "Low GP"}
              </Badge>
            )}
            <Link href="/tenders">
              <span className="text-muted-foreground/40 hover:text-primary transition-colors">
                <ExternalLink className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
