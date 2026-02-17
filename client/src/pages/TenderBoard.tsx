/*
 * Tender Board — Kanban View of Workspaces by Stage
 * Swiss Precision Instrument Design
 *
 * Reuses the EXACT same stage transition engine, governance checks,
 * and audit logging from stage-transition.ts. No duplicated business logic.
 *
 * Drag-and-drop powered by native HTML5 drag events.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Kanban,
  GripVertical,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Filter,
  X,
  Building2,
  User,
  MapPin,
  DollarSign,
  Clock,
  ArrowRight,
  ExternalLink,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  type Workspace,
  type WorkspaceStage,
  workspaces,
  formatSAR,
  getStageLabel,
  getStageColor,
} from "@/lib/store";
import {
  STAGE_ORDER,
  getStageDisplayName,
  getStageIndex,
  preflightToStage,
  advanceToStage,
  advanceStage,
  getStrictMode,
  type ValidationFailure,
  type TransitionResult,
  type GovernanceOverride,
} from "@/lib/stage-transition";

// ─── CONSTANTS ─────────────────────────────────────────────

const GP_THRESHOLD = 22; // Same threshold used in workspace margin warning

const STAGE_COLUMN_COLORS: Record<string, string> = {
  qualified: "border-t-blue-400",
  solution_design: "border-t-indigo-400",
  quoting: "border-t-violet-400",
  proposal_active: "border-t-purple-400",
  negotiation: "border-t-amber-400",
  commercial_approved: "border-t-emerald-400",
  sla_drafting: "border-t-teal-400",
  contract_ready: "border-t-cyan-400",
};

const STAGE_HEADER_BG: Record<string, string> = {
  qualified: "bg-blue-50",
  solution_design: "bg-indigo-50",
  quoting: "bg-violet-50",
  proposal_active: "bg-purple-50",
  negotiation: "bg-amber-50",
  commercial_approved: "bg-emerald-50",
  sla_drafting: "bg-teal-50",
  contract_ready: "bg-cyan-50",
};

// ─── TYPES ─────────────────────────────────────────────────

interface DragState {
  workspaceId: string;
  fromStage: WorkspaceStage;
}

interface ConfirmationModal {
  open: boolean;
  workspace: Workspace | null;
  fromStage: WorkspaceStage;
  toStage: WorkspaceStage;
  warnings: ValidationFailure[];
}

// ─── COMPONENT ─────────────────────────────────────────────

export default function TenderBoard() {
  // Filters
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [riskOnly, setRiskOnly] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<WorkspaceStage | null>(null);

  // Confirmation modal
  const [modal, setModal] = useState<ConfirmationModal>({
    open: false,
    workspace: null,
    fromStage: "qualified",
    toStage: "qualified",
    warnings: [],
  });
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Get unique owners and regions from workspaces
  const owners = useMemo(() => {
    const set = new Set(workspaces.map(w => w.owner));
    return Array.from(set).sort();
  }, []);

  const regions = useMemo(() => {
    const set = new Set(workspaces.map(w => w.region));
    return Array.from(set).sort();
  }, []);

  // Filter workspaces
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter(w => {
      // Only show workspaces in the controlled stage order
      if (getStageIndex(w.stage) === -1) return false;
      if (ownerFilter !== "all" && w.owner !== ownerFilter) return false;
      if (regionFilter !== "all" && w.region !== regionFilter) return false;
      if (riskOnly && w.gpPercent >= GP_THRESHOLD) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, regionFilter, riskOnly, refreshKey]);

  // Group workspaces by stage
  const columns = useMemo(() => {
    const map = new Map<WorkspaceStage, Workspace[]>();
    for (const stage of STAGE_ORDER) {
      map.set(stage, []);
    }
    for (const ws of filteredWorkspaces) {
      const col = map.get(ws.stage);
      if (col) col.push(ws);
    }
    return map;
  }, [filteredWorkspaces]);

  // ─── DRAG HANDLERS ─────────────────────────────────────

  const handleDragStart = useCallback((ws: Workspace) => {
    setDragState({ workspaceId: ws.id, fromStage: ws.stage });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, stage: WorkspaceStage) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(stage);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStage: WorkspaceStage) => {
      e.preventDefault();
      setDropTarget(null);

      if (!dragState) return;
      const { workspaceId, fromStage } = dragState;
      setDragState(null);

      // Same column — no-op
      if (fromStage === targetStage) return;

      // Backward movement — reject immediately
      const fromIdx = getStageIndex(fromStage);
      const toIdx = getStageIndex(targetStage);
      if (toIdx < fromIdx) {
        toast.error("Backward stage movement is not permitted.", {
          description: "Only forward transitions are allowed on the Tender Board.",
        });
        return;
      }

      // Find workspace
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (!workspace) return;

      // Pre-flight validation
      const warnings = preflightToStage(workspaceId, targetStage);

      // If no warnings, check if it's a single-step advance
      if (warnings.length === 0) {
        // Single step — use advanceStage; multi-step — use advanceToStage
        const isNextStep = toIdx === fromIdx + 1;
        const result = isNextStep
          ? advanceStage(workspaceId)
          : advanceToStage(workspaceId, targetStage);

        if (result.success) {
          toast.success("Stage Advanced", {
            description: result.message,
          });
          setRefreshKey(k => k + 1);
        } else {
          toast.error("Transition Failed", {
            description: result.message,
          });
        }
        return;
      }

      // Warnings exist — open confirmation modal
      setModal({
        open: true,
        workspace,
        fromStage,
        toStage: targetStage,
        warnings,
      });
      setOverrideReason("");
      setConfirmText("");
    },
    [dragState]
  );

  // ─── MODAL HANDLERS ───────────────────────────────────

  const handleConfirmMove = useCallback(() => {
    if (!modal.workspace) return;

    const targetStageName = getStageDisplayName(modal.toStage);
    if (confirmText !== targetStageName) {
      toast.error("Type the destination stage name exactly to confirm.");
      return;
    }

    const isNextStep =
      getStageIndex(modal.toStage) === getStageIndex(modal.fromStage) + 1;

    const result = isNextStep
      ? advanceStage(modal.workspace.id, { overrideReason: overrideReason || undefined })
      : advanceToStage(modal.workspace.id, modal.toStage, {
          overrideReason: overrideReason || undefined,
        });

    if (result.success) {
      toast.success("Stage Advanced (Governance Override)", {
        description: result.message,
      });
      setModal({ open: false, workspace: null, fromStage: "qualified", toStage: "qualified", warnings: [] });
      setRefreshKey(k => k + 1);
    } else {
      toast.error("Transition Failed", {
        description: result.message,
      });
    }
  }, [modal, confirmText, overrideReason]);

  const handleCancelModal = useCallback(() => {
    setModal({ open: false, workspace: null, fromStage: "qualified", toStage: "qualified", warnings: [] });
    setOverrideReason("");
    setConfirmText("");
  }, []);

  // ─── STATS ─────────────────────────────────────────────

  const totalValue = filteredWorkspaces.reduce((s, w) => s + w.estimatedValue, 0);
  const riskCount = filteredWorkspaces.filter(w => w.gpPercent < GP_THRESHOLD).length;
  const activeFilters = (ownerFilter !== "all" ? 1 : 0) + (regionFilter !== "all" ? 1 : 0) + (riskOnly ? 1 : 0);

  return (
    <div className="p-4 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Kanban className="w-5 h-5 text-[var(--color-hala-navy)]" />
            <h1 className="text-xl font-serif font-bold">Tender Board</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredWorkspaces.length} workspaces · {formatSAR(totalValue)} pipeline
            {riskCount > 0 && (
              <span className="text-[var(--color-rag-amber)] ml-2">
                · {riskCount} at risk
              </span>
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
              Risk only
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

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {STAGE_ORDER.map(stage => {
            const cards = columns.get(stage) ?? [];
            const isDropping = dropTarget === stage && dragState?.fromStage !== stage;
            const stageIdx = getStageIndex(stage);
            const dragFromIdx = dragState ? getStageIndex(dragState.fromStage) : -1;
            const isValidTarget = dragState && stageIdx > dragFromIdx;
            const isInvalidTarget = dragState && stageIdx <= dragFromIdx && stage !== dragState.fromStage;
            const stageValue = cards.reduce((s, w) => s + w.estimatedValue, 0);

            return (
              <div
                key={stage}
                className={`
                  w-[220px] shrink-0 rounded-lg border-t-[3px] flex flex-col
                  transition-all duration-150
                  ${STAGE_COLUMN_COLORS[stage] ?? "border-t-gray-300"}
                  ${isDropping && isValidTarget ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"}
                  ${isInvalidTarget ? "opacity-40" : ""}
                `}
                onDragOver={(e) => isValidTarget ? handleDragOver(e, stage) : e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={(e) => isValidTarget ? handleDrop(e, stage) : undefined}
              >
                {/* Column Header */}
                <div className={`px-3 py-2.5 rounded-t-lg ${STAGE_HEADER_BG[stage] ?? "bg-muted/40"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide uppercase">
                      {getStageDisplayName(stage)}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                      {cards.length}
                    </Badge>
                  </div>
                  {stageValue > 0 && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {formatSAR(stageValue)}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                  {cards.length === 0 && (
                    <div className="text-center py-6 text-[10px] text-muted-foreground/50">
                      No workspaces
                    </div>
                  )}
                  {cards.map(ws => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={dragState?.workspaceId === ws.id}
                    />
                  ))}
                </div>

                {/* Drop indicator */}
                {isDropping && isValidTarget && (
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
      {modal.open && modal.workspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
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
                Confirm Stage Transition
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {modal.workspace.customerName} — {modal.workspace.title}
              </p>
            </div>

            {/* From → To */}
            <div className="px-5 py-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">From Stage</p>
                  <Badge variant="outline" className={`text-xs ${getStageColor(modal.fromStage)}`}>
                    {getStageDisplayName(modal.fromStage)}
                  </Badge>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">To Stage</p>
                  <Badge variant="outline" className={`text-xs ${getStageColor(modal.toStage)}`}>
                    {getStageDisplayName(modal.toStage)}
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
                  <div key={i} className="rounded border border-amber-200 bg-amber-50/50 p-2.5">
                    <p className="text-[10px] font-semibold text-amber-800 mb-0.5">{w.ruleName}</p>
                    <p className="text-[11px] text-amber-700">{w.error}</p>
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
                Type <span className="font-mono font-bold text-foreground">"{getStageDisplayName(modal.toStage)}"</span> to confirm
              </Label>
              <Input
                placeholder={getStageDisplayName(modal.toStage)}
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
                  overrideReason.trim().length > 0 && confirmText === getStageDisplayName(modal.toStage)
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }`}
                disabled={
                  overrideReason.trim().length === 0 ||
                  confirmText !== getStageDisplayName(modal.toStage)
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

// ─── WORKSPACE CARD ────────────────────────────────────────

interface WorkspaceCardProps {
  workspace: Workspace;
  onDragStart: (ws: Workspace) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function WorkspaceCard({ workspace, onDragStart, onDragEnd, isDragging }: WorkspaceCardProps) {
  const isRisk = workspace.gpPercent < GP_THRESHOLD;
  const isCritical = workspace.gpPercent < 10;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", workspace.id);
        onDragStart(workspace);
      }}
      onDragEnd={onDragEnd}
      className={`
        group rounded-md border bg-card shadow-sm hover:shadow-md
        transition-all duration-150 cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-40 scale-95 ring-2 ring-primary/30" : ""}
        ${isRisk ? "border-l-2 border-l-[var(--color-rag-amber)]" : "border-border"}
        ${isCritical ? "border-l-[var(--color-rag-red)]" : ""}
      `}
    >
      <div className="p-2.5">
        {/* Drag handle + Customer */}
        <div className="flex items-start gap-1.5 mb-1.5">
          <GripVertical className="w-3 h-3 text-muted-foreground/30 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-semibold truncate">
                {workspace.customerName}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate pl-4">
              {workspace.title}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pl-4">
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Value</p>
            <p className="text-[11px] font-mono font-medium">{formatSAR(workspace.estimatedValue)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">GP%</p>
            <p className={`text-[11px] font-mono font-bold ${
              isCritical ? "text-[var(--color-rag-red)]" :
              isRisk ? "text-[var(--color-rag-amber)]" :
              "text-[var(--color-rag-green)]"
            }`}>
              {workspace.gpPercent.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Days</p>
            <p className={`text-[11px] font-mono ${workspace.daysInStage > 10 ? "text-[var(--color-rag-amber)]" : ""}`}>
              {workspace.daysInStage}d
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase">Region</p>
            <p className="text-[11px]">{workspace.region}</p>
          </div>
        </div>

        {/* Footer: Owner + Risk Badge */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50 pl-4">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            {workspace.owner}
          </span>
          <div className="flex items-center gap-1">
            {isRisk && (
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1 ${
                  isCritical
                    ? "border-red-300 text-red-700 bg-red-50"
                    : "border-amber-300 text-amber-700 bg-amber-50"
                }`}
              >
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                {isCritical ? "Critical" : "Low Margin"}
              </Badge>
            )}
            <Link href={`/workspaces/${workspace.id}`}>
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
