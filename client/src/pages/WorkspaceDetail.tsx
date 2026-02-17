import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, FileText, ShieldCheck, FileCheck, Clock, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Undo2, Timer, ArrowRightLeft, ShieldAlert, ShieldOff, Info, FolderOpen, Upload, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { workspaces, customers, quotes, proposals, approvalRecords, signals, auditLog, formatSAR, formatPercent, getStageLabel, getStageColor, getApprovalRequirements, getRoleLabel, WORKSPACE_STAGES } from "@/lib/store";
import {
  advanceStage,
  getNextStage,
  getStageDisplayName,
  checkUndoEligibility,
  revertStage,
  getStageHistory,
  hasUndoRecord,
  preflightValidation,
  getWorkspaceOverrides,
  getLatestOverride,
  getStrictMode,
  type TransitionResult,
  type GovernanceOverride,
  type ValidationFailure,
} from "@/lib/stage-transition";
import { toast } from "sonner";
import {
  getDocumentsByWorkspace, getFileTypeColor, getCategoryIcon,
  uploadDocument, hasRealFile, initializeMockFiles,
  type UnifiedDocument, type DocumentCategory,
} from "@/lib/document-vault";
import { DocumentViewer, UploadDialog } from "@/components/DocumentViewer";

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, forceUpdate] = useState(0);
  const [transitionResult, setTransitionResult] = useState<TransitionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Document viewer state
  const [viewerDoc, setViewerDoc] = useState<UnifiedDocument | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);

  // Initialize mock files
  useState(() => { initializeMockFiles(); });

  const ws = workspaces.find(w => w.id === id);
  if (!ws) return <div className="p-6"><h1 className="text-xl font-serif">Workspace not found</h1><Link href="/workspaces"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link></div>;
  const customer = customers.find(c => c.id === ws.customerId);
  const wsQuotes = quotes.filter(q => q.workspaceId === ws.id);
  const wsProposals = proposals.filter(p => p.workspaceId === ws.id);
  const wsApprovals = approvalRecords.filter(a => a.workspaceId === ws.id);
  const wsSignals = signals.filter(s => s.workspaceId === ws.id);
  const wsAudit = auditLog.filter(a => a.entityId === ws.id || wsQuotes.some(q => q.id === a.entityId) || wsProposals.some(p => p.id === a.entityId));
  const approvalReqs = getApprovalRequirements(ws.gpPercent, ws.palletVolume);
  const currentStageIdx = WORKSPACE_STAGES.findIndex(s => s.value === ws.stage);
  const nextStage = getNextStage(ws.stage);
  const wsStageHistory = getStageHistory(ws.id);
  const wsOverrides = getWorkspaceOverrides(ws.id);
  const latestOverride = getLatestOverride(ws.id);

  // Pre-flight validation warnings (with rule names)
  const preflightFailures: ValidationFailure[] = nextStage ? preflightValidation(ws.id) : [];
  const hasWarnings = preflightFailures.length > 0;
  const isStrictMode = getStrictMode();

  // ── Hotkey protection: block single-key shortcuts from triggering stage movement ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !showConfirm) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        if (target.closest("[data-advance-stage-btn]")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [showConfirm]);

  // ── Undo countdown timer ──
  const startUndoTimer = useCallback(() => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setShowUndoBanner(true);
    const tick = () => {
      const eligibility = checkUndoEligibility(ws.id);
      if (eligibility.remainingMs <= 0 || !eligibility.eligible) {
        setShowUndoBanner(false);
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        return;
      }
      setUndoCountdown(Math.ceil(eligibility.remainingMs / 1000));
    };
    tick();
    undoTimerRef.current = setInterval(tick, 1000);
  }, [ws.id]);

  useEffect(() => {
    return () => { if (undoTimerRef.current) clearInterval(undoTimerRef.current); };
  }, []);

  // ── Handlers ──
  const handleAdvanceStage = () => {
    setTransitionResult(null);
    setConfirmInput("");
    setOverrideReason("");
    setShowConfirm(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const executeTransition = () => {
    setShowConfirm(false);
    const opts = hasWarnings && !isStrictMode && overrideReason.trim()
      ? { overrideReason: overrideReason.trim() }
      : undefined;
    const result = advanceStage(ws.id, opts);
    setTransitionResult(result);
    setConfirmInput("");
    setOverrideReason("");
    if (result.success) {
      if (result.governanceOverride) {
        toast.success("Stage advanced with governance override", {
          description: `${getStageDisplayName(result.fromStage)} → ${getStageDisplayName(result.nextStage!)}`,
        });
      } else {
        toast.success(result.message, {
          description: `${getStageDisplayName(result.fromStage)} → ${getStageDisplayName(result.nextStage!)}`,
        });
      }
      startUndoTimer();
      forceUpdate(n => n + 1);
    } else {
      toast.error("Stage advance blocked", { description: result.message });
    }
  };

  const handleUndo = () => {
    const result = revertStage(ws.id);
    if (result.success) {
      toast.success("Stage reverted", { description: result.message });
      setShowUndoBanner(false);
      setTransitionResult(null);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      forceUpdate(n => n + 1);
    } else {
      toast.error("Undo blocked", { description: result.message });
    }
  };

  const dismissResult = () => setTransitionResult(null);

  // The required confirmation text is the destination stage name
  const requiredConfirmText = nextStage ? getStageDisplayName(nextStage) : "";
  const confirmMatch = confirmInput.trim().toLowerCase() === requiredConfirmText.toLowerCase();

  // In soft mode with warnings, require override reason to enable Confirm
  // In strict mode with warnings, Confirm is always blocked (hard block)
  // No warnings → just need type-to-confirm
  const canConfirm = isStrictMode
    ? (confirmMatch && !hasWarnings)
    : (confirmMatch && (!hasWarnings || overrideReason.trim().length > 0));

  return (
    <TooltipProvider>
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/workspaces"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`rag-dot ${ws.ragStatus === "red" ? "rag-dot-red" : ws.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
              <h1 className="text-xl font-serif font-bold">{ws.customerName}</h1>
              <Badge variant="outline" className={`text-xs ${getStageColor(ws.stage)}`}>{getStageLabel(ws.stage)}</Badge>
              {ws.crmDealId && <span className="text-xs text-muted-foreground data-value">CRM: {ws.crmDealId}</span>}

              {/* ═══ Governance Override Badge ═══ */}
              {latestOverride && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] border-amber-400 bg-amber-50 text-amber-800 cursor-help gap-1">
                      <ShieldOff className="w-3 h-3" />
                      Governance Override Applied
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm p-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Override Details</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">Reason:</span>
                          <span className="font-medium">{latestOverride.overrideReason}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">Approver:</span>
                          <span className="font-medium">{latestOverride.userName}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">Transition:</span>
                          <span className="font-medium">{getStageDisplayName(latestOverride.fromStage)} → {getStageDisplayName(latestOverride.toStage)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">Rules:</span>
                          <span className="font-medium">{latestOverride.overriddenRules.join(", ")}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">When:</span>
                          <span className="font-medium">{new Date(latestOverride.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 ml-6">{ws.title}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdvanceStage}
            disabled={!nextStage}
            data-advance-stage-btn
          >
            <ChevronRight className="w-3.5 h-3.5 mr-1" />
            {nextStage ? `Advance to ${getStageDisplayName(nextStage)}` : "Final Stage"}
          </Button>
        </div>

        {/* ═══ Enhanced Confirmation Modal with Soft Governance ═══ */}
        {showConfirm && nextStage && (
          <div className="mb-4 rounded-lg border-2 border-amber-300/60 bg-amber-50/80 overflow-hidden">
            <div className="px-5 py-3 bg-amber-100/60 border-b border-amber-200/60 flex items-center gap-2.5">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-900">Stage Transition — Governance Check</span>
              {isStrictMode && (
                <Badge variant="outline" className="text-[9px] border-red-300 text-red-700 ml-auto">STRICT MODE</Badge>
              )}
              {!isStrictMode && hasWarnings && (
                <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700 ml-auto">SOFT GOVERNANCE</Badge>
              )}
            </div>
            <div className="p-5 space-y-4">
              {/* From → To display */}
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">From Stage</p>
                  <p className="text-sm font-semibold">{getStageDisplayName(ws.stage)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="flex-1 rounded-md border-2 border-dashed border-amber-300 bg-amber-50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-medium mb-1">To Stage</p>
                  <p className="text-sm font-semibold text-amber-900">{getStageDisplayName(nextStage)}</p>
                </div>
              </div>

              {/* Validation warnings with rule names */}
              {preflightFailures.length > 0 && (
                <div className={`rounded-md border p-3 ${isStrictMode ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50/60"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className={`w-3.5 h-3.5 ${isStrictMode ? "text-red-500" : "text-amber-600"}`} />
                    <span className={`text-xs font-semibold ${isStrictMode ? "text-red-800" : "text-amber-800"}`}>
                      {isStrictMode ? "Validation Errors (Hard Block)" : "Validation Warnings (Override Available)"}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {preflightFailures.map((f, i) => (
                      <li key={i} className={`text-xs flex items-start gap-1.5 ${isStrictMode ? "text-red-700" : "text-amber-800"}`}>
                        <span className={`mt-0.5 ${isStrictMode ? "text-red-400" : "text-amber-500"}`}>•</span>
                        <span>
                          <span className="font-medium">[{f.ruleName}]</span> {f.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!isStrictMode && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-100/60 rounded px-2 py-1.5">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Soft governance mode is active. You may override these warnings by providing a reason below. The override will be logged.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Override reason input — only shown in soft mode with warnings */}
              {hasWarnings && !isStrictMode && (
                <div>
                  <label className="text-xs font-medium text-amber-800 block mb-1.5">
                    Override Reason <span className="text-red-500">*</span>
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">(required to proceed with governance override)</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Provide justification for overriding the validation warnings..."
                    className="w-full h-16 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
                  />
                  {overrideReason.trim().length > 0 && (
                    <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                      <ShieldOff className="w-3 h-3" />
                      This transition will be logged as a governance override with your reason.
                    </p>
                  )}
                </div>
              )}

              {/* Type-to-confirm */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Type <span className="font-bold text-foreground">"{requiredConfirmText}"</span> to enable the Confirm button
                </label>
                <Input
                  ref={inputRef}
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={requiredConfirmText}
                  className="h-9 text-sm font-mono"
                  onKeyDown={e => {
                    if (e.key === "Enter" && canConfirm) {
                      e.preventDefault();
                      executeTransition();
                    }
                  }}
                />
                {confirmInput.length > 0 && !confirmMatch && (
                  <p className="text-[10px] text-red-500 mt-1">Text does not match. Please type the exact destination stage name.</p>
                )}
              </div>

              {/* Strict mode block message */}
              {isStrictMode && hasWarnings && confirmMatch && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    <span className="font-semibold">Strict governance mode is active.</span> Validation errors cannot be overridden. Resolve all issues before advancing.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setConfirmInput(""); setOverrideReason(""); }} className="text-xs h-8">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={executeTransition}
                  disabled={!canConfirm}
                  className={`text-xs h-8 ${hasWarnings && !isStrictMode && overrideReason.trim() ? "bg-amber-700 hover:bg-amber-800" : "bg-[#1B2A4A] hover:bg-[#2A3F6A]"} disabled:opacity-40`}
                >
                  {hasWarnings && !isStrictMode && overrideReason.trim() ? (
                    <><ShieldOff className="w-3.5 h-3.5 mr-1" />Confirm with Override</>
                  ) : (
                    <><ShieldCheck className="w-3.5 h-3.5 mr-1" />Confirm Advance</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Undo Banner ═══ */}
        {showUndoBanner && transitionResult?.success && (
          <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${transitionResult.governanceOverride ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 ${transitionResult.governanceOverride ? "text-amber-600" : "text-emerald-600"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${transitionResult.governanceOverride ? "text-amber-800" : "text-emerald-800"}`}>
                {transitionResult.governanceOverride ? "Stage Advanced (Governance Override)" : "Stage Advanced Successfully"}
              </p>
              <p className={`text-xs mt-0.5 ${transitionResult.governanceOverride ? "text-amber-700" : "text-emerald-700"}`}>{transitionResult.message}</p>
              {transitionResult.governanceOverride && transitionResult.overrideRecord && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Override reason: "{transitionResult.overrideRecord.overrideReason}" — Rules: {transitionResult.overrideRecord.overriddenRules.join(", ")}
                </p>
              )}
              <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                <span>From: {getStageDisplayName(transitionResult.fromStage)}</span>
                {transitionResult.nextStage && <span>To: {getStageDisplayName(transitionResult.nextStage)}</span>}
                <span>Result: {transitionResult.governanceOverride ? "override" : "success"}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`flex items-center gap-1.5 text-xs ${transitionResult.governanceOverride ? "text-amber-700" : "text-blue-700"}`}>
                <Timer className="w-3.5 h-3.5" />
                <span className="data-value font-medium">{Math.floor(undoCountdown / 60)}:{String(undoCountdown % 60).padStart(2, "0")}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndo}
                className={`text-xs h-8 ${transitionResult.governanceOverride ? "border-amber-300 text-amber-700 hover:bg-amber-100" : "border-blue-300 text-blue-700 hover:bg-blue-100"}`}
              >
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowUndoBanner(false); setTransitionResult(null); }} className="text-xs h-7">Dismiss</Button>
            </div>
          </div>
        )}

        {/* ═══ Blocked Transition Result ═══ */}
        {transitionResult && !transitionResult.success && (
          <div className="mb-4 p-4 rounded-lg border border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">Stage Advance Blocked</p>
                <p className="text-xs mt-0.5 text-red-700">{transitionResult.message}</p>
                {transitionResult.validationErrors.length > 1 && (
                  <ul className="mt-2 space-y-1">
                    {transitionResult.validationErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">•</span> {err}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span>From: {getStageDisplayName(transitionResult.fromStage)}</span>
                  {transitionResult.nextStage && <span>To: {getStageDisplayName(transitionResult.nextStage)}</span>}
                  <span>Result: blocked</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissResult} className="text-xs h-7 shrink-0">Dismiss</Button>
            </div>
          </div>
        )}

        <Card className="border border-border shadow-none mb-6"><CardContent className="py-4 px-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            {WORKSPACE_STAGES.slice(0, 8).map((s, i) => (
              <div key={s.value} className="flex items-center">
                <div className={`px-2.5 py-1 rounded text-[10px] font-medium whitespace-nowrap ${i <= currentStageIdx ? "bg-primary text-primary-foreground" : i === currentStageIdx + 1 ? "bg-muted text-muted-foreground border border-dashed border-primary/30" : "bg-muted text-muted-foreground/50"}`}>{s.label}</div>
                {i < 7 && <div className={`w-4 h-px mx-0.5 ${i < currentStageIdx ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>
        </CardContent></Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {[{ label: "Est. Value", value: formatSAR(ws.estimatedValue) }, { label: "GP%", value: formatPercent(ws.gpPercent), color: ws.gpPercent >= 22 ? "rag-green" : ws.gpPercent >= 10 ? "rag-amber" : "rag-red" }, { label: "Pallets", value: ws.palletVolume.toLocaleString() }, { label: "Days in Stage", value: String(ws.daysInStage), color: ws.daysInStage > 14 ? "rag-red" : ws.daysInStage > 7 ? "rag-amber" : undefined }, { label: "Region", value: ws.region }, { label: "Owner", value: ws.owner }].map(kpi => (
            <Card key={kpi.label} className="border border-border shadow-none"><CardContent className="p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`data-value text-lg font-semibold mt-0.5 ${kpi.color || ""}`}>{kpi.value}</p>
            </CardContent></Card>
          ))}
        </div>

        {wsSignals.length > 0 && <div className="mb-6 space-y-2">
          {wsSignals.map(sig => (
            <div key={sig.id} className={`flex items-start gap-3 p-3 rounded-lg border ${sig.severity === "red" ? "border-[var(--color-rag-red)]/20 bg-red-50" : sig.severity === "amber" ? "border-[var(--color-rag-amber)]/20 bg-amber-50" : "border-[var(--color-rag-green)]/20 bg-green-50"}`}>
              <div className={`rag-dot mt-1.5 shrink-0 ${sig.severity === "red" ? "rag-dot-red" : sig.severity === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
              <div>
                <p className="text-sm font-medium">{sig.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sig.message}</p>
              </div>
            </div>
          ))}
        </div>}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({wsQuotes.length})</TabsTrigger>
            <TabsTrigger value="proposals">Proposals ({wsProposals.length})</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Customer Info</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {customer && [{ l: "Code", v: customer.code }, { l: "Industry", v: customer.industry }, { l: "Grade", v: customer.grade }, { l: "Service Type", v: customer.serviceType }, { l: "Contract Expiry", v: customer.contractExpiry }, { l: "DSO", v: `${customer.dso} days` }, { l: "Payment Status", v: customer.paymentStatus }, { l: "Contact", v: customer.contactName }].map(r => (
                    <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="font-medium data-value">{r.v}</span></div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Approval Requirements</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">Based on GP% of {formatPercent(ws.gpPercent)} and {ws.palletVolume.toLocaleString()} pallets</p>
                  {approvalReqs.map((req, i) => {
                    const existing = wsApprovals.find(a => a.approverRole === req.role);
                    return <div key={i} className="flex items-center justify-between p-2 rounded border border-border">
                      <div><span className="text-sm font-medium">{getRoleLabel(req.role)}</span><span className="text-xs text-muted-foreground ml-2">({req.type})</span></div>
                      <Badge variant={existing?.decision === "approved" ? "default" : existing?.decision === "pending" ? "secondary" : "outline"} className="text-[10px]">{existing?.decision || "not started"}</Badge>
                    </div>;
                  })}
                </CardContent>
              </Card>
            </div>
            <Card className="border border-border shadow-none mt-6"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Notes</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-sm text-muted-foreground">{ws.notes}</p></CardContent></Card>
          </TabsContent>

          <TabsContent value="quotes">
            {wsQuotes.length > 0 ? <div className="space-y-3">{wsQuotes.map(q => (
              <Card key={q.id} className="border border-border shadow-none"><CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Quote v{q.version}</span><Badge variant="outline" className="text-[10px]">{q.state}</Badge></div>
                  <span className="text-xs text-muted-foreground">{q.createdAt}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[{ l: "Storage Rate", v: `SAR ${q.storageRate}/pallet/day` }, { l: "Monthly Revenue", v: formatSAR(q.monthlyRevenue) }, { l: "Annual Revenue", v: formatSAR(q.annualRevenue) }, { l: "GP%", v: formatPercent(q.gpPercent) }].map(kv => (
                    <div key={kv.l}><p className="text-[10px] text-muted-foreground uppercase">{kv.l}</p><p className="data-value text-sm font-medium mt-0.5">{kv.v}</p></div>
                  ))}
                </div>
              </CardContent></Card>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No quotes created yet</CardContent></Card>}
          </TabsContent>

          <TabsContent value="proposals">
            {wsProposals.length > 0 ? <div className="space-y-3">{wsProposals.map(p => (
              <Card key={p.id} className="border border-border shadow-none"><CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{p.title}</span><Badge variant="outline" className="text-[10px]">{p.state}</Badge></div>
                  <span className="text-xs text-muted-foreground">v{p.version} — {p.createdAt}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">{p.sections.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
              </CardContent></Card>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No proposals created yet</CardContent></Card>}
          </TabsContent>

          <TabsContent value="approvals">
            {wsApprovals.length > 0 ? <div className="space-y-2">{wsApprovals.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{a.approverName}</span><span className="text-xs text-muted-foreground">({getRoleLabel(a.approverRole)})</span></div>
                  {a.reason && <p className="text-xs text-muted-foreground mt-1 ml-6">{a.reason}</p>}
                </div>
                <div className="text-right">
                  <Badge variant={a.decision === "approved" ? "default" : a.decision === "rejected" ? "destructive" : "secondary"} className="text-[10px]">{a.decision}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No approval records yet</CardContent></Card>}
          </TabsContent>

          <TabsContent value="documents">
            {(() => {
              const wsDocs = getDocumentsByWorkspace(ws.id);
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5" /> Workspace Documents ({wsDocs.length})
                    </h4>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowDocUpload(true)}>
                      <Upload className="w-3 h-3" /> Upload
                    </Button>
                  </div>
                  {wsDocs.length > 0 ? (
                    <div className="space-y-2">
                      {wsDocs.map(doc => {
                        const isClickable = hasRealFile(doc);
                        return (
                          <div
                            key={doc.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${
                              isClickable ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"
                            }`}
                            onClick={() => { if (isClickable) setViewerDoc(doc); }}
                          >
                            <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                {doc.name}
                                {isClickable && <Eye className="w-3 h-3 text-muted-foreground" />}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.currentVersion} · {doc.uploadedBy} · {doc.uploadDate}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-[9px]">{getCategoryIcon(doc.category)} {doc.category}</Badge>
                              <Badge variant={doc.status === "Final" || doc.status === "Signed" ? "default" : "secondary"} className="text-[9px]">{doc.status}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Card className="border border-border shadow-none">
                      <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="mb-3">No documents linked to this workspace.</p>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDocUpload(true)}>
                          <Upload className="w-3 h-3" /> Upload First Document
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                  <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} />
                  <UploadDialog
                    open={showDocUpload}
                    onClose={() => setShowDocUpload(false)}
                    defaultCategory="Supporting"
                    suggestedName={`${customer?.name ?? ""} — ${ws.title}`}
                    onUpload={({ name, category, file, notes, tags }) => {
                      uploadDocument({
                        name,
                        category: category as DocumentCategory,
                        customerId: ws.customerId,
                        customerName: customer?.name ?? "Unknown",
                        workspaceId: ws.id,
                        workspaceName: ws.title,
                        file,
                        notes,
                        tags,
                      });
                      toast.success(`Document "${name}" uploaded.`);
                      forceUpdate(n => n + 1);
                    }}
                  />
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="audit">
            {/* ═══ Governance Override Summary ═══ */}
            {wsOverrides.length > 0 && (
              <Card className="border border-amber-200 bg-amber-50/30 shadow-none mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <ShieldOff className="w-4 h-4 text-amber-600" />
                    Governance Overrides ({wsOverrides.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-amber-200/60">
                    {wsOverrides.map((ov, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-1.5">
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                            {getStageDisplayName(ov.fromStage)} → {getStageDisplayName(ov.toStage)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{ov.userName}</span>
                          <span className="text-[10px] text-muted-foreground data-value ml-auto">{new Date(ov.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-amber-800 mb-1">
                          <span className="font-medium">Reason:</span> {ov.overrideReason}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {ov.overriddenRules.map((rule, j) => (
                            <Badge key={j} variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                              {rule}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stage History Section */}
            {wsStageHistory.length > 0 && (
              <Card className="border border-border shadow-none mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    Stage History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {wsStageHistory.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.action === "advanced" ? "bg-emerald-500" : entry.action === "advanced_with_override" ? "bg-amber-500" : "bg-orange-400"}`} />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="text-[10px] shrink-0">{getStageDisplayName(entry.fromStage)}</Badge>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <Badge variant={entry.action === "reverted" ? "secondary" : "default"} className="text-[10px] shrink-0">
                            {getStageDisplayName(entry.toStage)}
                          </Badge>
                          {entry.action === "reverted" && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                              <Undo2 className="w-2.5 h-2.5 mr-0.5" />Reverted
                            </Badge>
                          )}
                          {entry.action === "advanced_with_override" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 shrink-0 cursor-help">
                                  <ShieldOff className="w-2.5 h-2.5 mr-0.5" />Override
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs p-2">
                                {entry.overrideRecord && (
                                  <div className="text-xs space-y-1">
                                    <p><span className="font-medium">Reason:</span> {entry.overrideRecord.overrideReason}</p>
                                    <p><span className="font-medium">Rules:</span> {entry.overrideRecord.overriddenRules.join(", ")}</p>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{entry.userName}</span>
                        <span className="text-[10px] text-muted-foreground data-value shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* General Audit Trail */}
            <Card className="border border-border shadow-none"><CardContent className="p-0">
              <div className="divide-y divide-border">
                {wsAudit.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.userName}</span>
                        <span className="text-xs text-muted-foreground">{entry.action}</span>
                        {entry.action === "stage_advanced_override" && (
                          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">override</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground data-value shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                ))}
                {wsAudit.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No audit entries</div>}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
