/**
 * Tender Board — Kanban View of Tenders by Status
 * Swiss Precision Instrument Design
 *
 * Uses the SAME centralized tender transition handler from tender-engine.ts.
 * No duplicate logic paths. All governance checks, audit logging, and undo
 * flow through advanceTenderStatus().
 *
 * Drag-and-drop powered by native HTML5 drag events.
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { formatSAR } from "@/lib/store";
import { useWorkspaces } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import {
  tenders,
  type Tender,
  type TenderStatus,
  TENDER_KANBAN_COLUMNS,
  getTenderStatusDisplayName,
  getTenderStatusColor,
  getTenderStatusIndex,
  advanceTenderStatus,
  preflightTenderValidation,
  checkTenderUndoEligibility,
  revertTenderStatus,
  getTenderMetrics,
  type TenderValidationFailure,
  type WorkspaceSuggestion,
} from "@/lib/tender-engine";

// ─── CONSTANTS ─────────────────────────────────────────────

const GP_THRESHOLD = 22;

const STATUS_COLUMN_COLORS: Record<TenderStatus, string> = {
  draft: "border-t-slate-400",
  in_preparation: "border-t-blue-400",
  submitted: "border-t-violet-400",
  under_evaluation: "border-t-amber-400",
  won: "border-t-emerald-400",
  lost: "border-t-red-400",
  withdrawn: "border-t-gray-400",
};

const STATUS_HEADER_BG: Record<TenderStatus, string> = {
  draft: "bg-slate-50 dark:bg-slate-900/30",
  in_preparation: "bg-blue-50 dark:bg-blue-900/30",
  submitted: "bg-violet-50 dark:bg-violet-900/30",
  under_evaluation: "bg-amber-50 dark:bg-amber-900/30",
  won: "bg-emerald-50 dark:bg-emerald-900/30",
  lost: "bg-red-50 dark:bg-red-900/30",
  withdrawn: "bg-gray-50 dark:bg-gray-900/30",
};

// Valid forward transitions map
function isValidForwardMove(from: TenderStatus, to: TenderStatus): boolean {
  // Terminal statuses cannot move
  if (from === "won" || from === "lost" || from === "withdrawn") return false;
  // Won/Lost can be reached from under_evaluation (or with override from submitted)
  if (to === "won" || to === "lost") {
    return from === "under_evaluation" || from === "submitted";
  }
  const fromIdx = getTenderStatusIndex(from);
  const toIdx = getTenderStatusIndex(to);
  // Only forward, and only to the next status (no skipping in normal flow)
  return toIdx > fromIdx && toIdx <= fromIdx + 1;
}

// ─── TYPES ─────────────────────────────────────────────────

interface DragState {
  tenderId: string;
  fromStatus: TenderStatus;
}

interface ConfirmationModal {
  open: boolean;
  tender: Tender | null;
  fromStatus: TenderStatus;
  toStatus: TenderStatus;
  warnings: TenderValidationFailure[];
}

// ─── COMPONENT ─────────────────────────────────────────────

export default function TenderBoard() {
  const [, navigate] = useLocation();

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [riskOnly, setRiskOnly] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<TenderStatus | null>(null);

  // Confirmation modal
  const [modal, setModal] = useState<ConfirmationModal>({
    open: false,
    tender: null,
    fromStatus: "draft",
    toStatus: "draft",
    warnings: [],
  });
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  // Undo banner
  const [undoBanner, setUndoBanner] = useState<{ tenderId: string; title: string } | null>(null);

  // Workspace suggestion
  const [wsSuggestion, setWsSuggestion] = useState<WorkspaceSuggestion | null>(null);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Unique owners and regions
  const owners = useMemo(() => {
    return Array.from(new Set(tenders.map(t => t.assignedOwner))).sort();
  }, []);

  const regions = useMemo(() => {
    return Array.from(new Set(tenders.map(t => t.region))).sort();
  }, []);

  // Filter tenders
  const filteredTenders = useMemo(() => {
    return tenders.filter(t => {
      if (t.status === "withdrawn") return false;
      if (ownerFilter !== "all" && t.assignedOwner !== ownerFilter) return false;
      if (regionFilter !== "all" && t.region !== regionFilter) return false;
      if (riskOnly && t.targetGpPercent >= GP_THRESHOLD) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, regionFilter, riskOnly, refreshKey]);

  // Group tenders by status
  const columns = useMemo(() => {
    const map = new Map<TenderStatus, Tender[]>();
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
    (e: React.DragEvent, status: TenderStatus) => {
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
    (e: React.DragEvent, targetStatus: TenderStatus) => {
      e.preventDefault();
      setDropTarget(null);

      if (!dragState) return;
      const { tenderId, fromStatus } = dragState;
      setDragState(null);

      // Same column — no-op
      if (fromStatus === targetStatus) return;

      const tender = tenders.find(t => t.id === tenderId);
      if (!tender) return;

      // Pre-flight validation
      const warnings = preflightTenderValidation(tenderId, targetStatus);

      if (warnings.length === 0) {
        // No warnings — attempt direct transition
        const result = advanceTenderStatus(tenderId, targetStatus);
        if (result.success) {
          toast.success("Status Advanced", { description: result.message });
          setUndoBanner({ tenderId, title: tender.title });
          setTimeout(() => setUndoBanner(b => b?.tenderId === tenderId ? null : b), 5 * 60 * 1000);
          if (result.workspaceSuggestion) {
            setWsSuggestion(result.workspaceSuggestion);
          }
          setRefreshKey(k => k + 1);
        } else {
          toast.error("Transition Failed", { description: result.message });
        }
        return;
      }

      // Warnings exist — open confirmation modal (no silent transitions)
      setModal({
        open: true,
        tender,
        fromStatus,
        toStatus: targetStatus,
        warnings,
      });
      setOverrideReason("");
      setConfirmText("");
    },
    [dragState]
  );

  // ─── MODAL HANDLERS ───────────────────────────────────

  const handleConfirmMove = useCallback(() => {
    if (!modal.tender) return;

    const targetName = getTenderStatusDisplayName(modal.toStatus);
    if (confirmText !== targetName) {
      toast.error("Type the destination status name exactly to confirm.");
      return;
    }

    const result = advanceTenderStatus(modal.tender.id, modal.toStatus, {
      overrideReason: overrideReason || undefined,
    });

    if (result.success) {
      toast.success("Status Advanced (Governance Override)", { description: result.message });
      setModal({ open: false, tender: null, fromStatus: "draft", toStatus: "draft", warnings: [] });
      setUndoBanner({ tenderId: modal.tender.id, title: modal.tender.title });
      setTimeout(() => setUndoBanner(b => b?.tenderId === modal.tender?.id ? null : b), 5 * 60 * 1000);
      if (result.workspaceSuggestion) {
        setWsSuggestion(result.workspaceSuggestion);
      }
      setRefreshKey(k => k + 1);
    } else {
      toast.error("Transition Failed", { description: result.message });
    }
  }, [modal, confirmText, overrideReason]);

  const handleCancelModal = useCallback(() => {
    setModal({ open: false, tender: null, fromStatus: "draft", toStatus: "draft", warnings: [] });
    setOverrideReason("");
    setConfirmText("");
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoBanner) return;
    const eligibility = checkTenderUndoEligibility(undoBanner.tenderId);
    if (eligibility.requiresReason) {
      toast.info("Undo window expired. Use the Tender detail page to revert with a reason.");
      return;
    }
    const result = revertTenderStatus(undoBanner.tenderId);
    if (result.success) {
      toast.success("Transition Undone", { description: result.message });
      setUndoBanner(null);
      setRefreshKey(k => k + 1);
    } else {
      toast.error("Undo Failed", { description: result.message });
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
            const canDrop = dragState ? isValidForwardMove(dragState.fromStatus, status) || status === "won" || status === "lost" : false;
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
                onDragOver={(e) => canDrop ? handleDragOver(e, status) : e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={(e) => canDrop ? handleDrop(e, status) : undefined}
              >
                {/* Column Header */}
                <div className={`px-3 py-2.5 rounded-t-lg ${STATUS_HEADER_BG[status]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide uppercase">
                      {getTenderStatusDisplayName(status)}
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

      {/* Governance Confirmation Modal */}
      {modal.open && modal.tender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-lg shadow-xl border border-border w-[520px] max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-[var(--color-rag-amber)]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-rag-amber)]">
                  Governance Check — Soft Mode
                </span>
              </div>
              <h3 className="text-base font-serif font-bold">
                Confirm Tender Transition
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {modal.tender.customerName} — {modal.tender.title}
              </p>
            </div>

            {/* From → To */}
            <div className="px-5 py-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">From Status</p>
                  <Badge variant="outline" className={`text-xs ${getTenderStatusColor(modal.fromStatus)}`}>
                    {getTenderStatusDisplayName(modal.fromStatus)}
                  </Badge>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">To Status</p>
                  <Badge variant="outline" className={`text-xs ${getTenderStatusColor(modal.toStatus)}`}>
                    {getTenderStatusDisplayName(modal.toStatus)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Validation Warnings */}
            <div className="px-5 py-3">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-rag-amber)]" />
                Validation Warnings ({modal.warnings.length})
              </p>
              <div className="space-y-2">
                {modal.warnings.map((w, i) => (
                  <div key={i} className="rounded border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-2.5">
                    <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-200 mb-0.5">{w.ruleName}</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">{w.error}</p>
                    <Badge variant="outline" className="mt-1 text-[9px] border-amber-300 text-amber-600">
                      Override Available
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Override Reason */}
            <div className="px-5 py-3 border-t border-border">
              <Label className="text-xs font-semibold mb-1.5 block">
                Override Reason <span className="text-muted-foreground font-normal">(required)</span>
              </Label>
              <Textarea
                placeholder="Provide justification for overriding governance warnings..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="text-xs h-16 resize-none"
              />
            </div>

            {/* Type to Confirm */}
            <div className="px-5 py-3 border-t border-border">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Type <span className="font-mono font-bold text-foreground">"{getTenderStatusDisplayName(modal.toStatus)}"</span> to confirm
              </Label>
              <Input
                placeholder={getTenderStatusDisplayName(modal.toStatus)}
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="text-xs h-8 font-mono"
              />
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelModal}>
                Cancel
              </Button>
              <Button
                size="sm"
                className={`${
                  overrideReason.trim().length > 0 && confirmText === getTenderStatusDisplayName(modal.toStatus)
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }`}
                disabled={
                  overrideReason.trim().length === 0 ||
                  confirmText !== getTenderStatusDisplayName(modal.toStatus)
                }
                onClick={handleConfirmMove}
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Confirm with Override
              </Button>
            </div>
          </div>
        </div>
      )}
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
  const isTerminal = tender.status === "won" || tender.status === "lost";

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
