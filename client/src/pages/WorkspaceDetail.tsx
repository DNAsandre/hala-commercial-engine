import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft, FileText, ShieldCheck, FileCheck, Clock, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, Undo2, Timer, ArrowRightLeft, ShieldAlert, ShieldOff, Info,
  FolderOpen, Upload, Eye, Edit, Download, FileSignature, RefreshCw, CalendarClock,
  User, BarChart3, Plus, ToggleLeft, ToggleRight, Link2, Archive, RotateCcw,
  FileUp, Filter, Search, Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  workspaces, customers, quotes, proposals, approvalRecords, signals, auditLog,
  formatSAR, formatPercent, getStageLabel, getStageColor, getApprovalRequirements,
  getRoleLabel, WORKSPACE_STAGES,
} from "@/lib/store";
import {
  advanceStage, getNextStage, getStageDisplayName, checkUndoEligibility, revertStage,
  getStageHistory, preflightValidation, getWorkspaceOverrides, getLatestOverride,
  getStrictMode, type TransitionResult, type ValidationFailure,
} from "@/lib/stage-transition";
import { toast } from "sonner";
import {
  getDocumentsByWorkspace, getFileTypeColor, getCategoryIcon,
  uploadDocument, hasRealFile, initializeMockFiles,
  type UnifiedDocument, type DocumentCategory,
} from "@/lib/document-vault";
import { DocumentViewer, UploadDialog } from "@/components/DocumentViewer";
import DocumentComposer, { type ComposerDocument } from "@/components/DocumentComposer";
import { resolveOrCreateDocInstance } from "@/lib/document-composer";
import { navigationV1 } from "@/components/DashboardLayout";
import {
  isWorkspaceIntegrationEnabled, getOrCreateCycle, startRenewal, updateRenewalOwner,
  getDaysToExpiry, isInRenewalWindow, getSupportingDocs, uploadSupportingDoc,
  toggleRequiredForContract, linkDocToCycle, archiveSupportingDoc, restoreSupportingDoc,
  seedWorkspaceIntegrationData, teamMembers, getContractReadyChecks,
  SUPPORT_DOC_CATEGORIES, type SupportingDoc, type SupportDocCategory, type ContractCycle,
} from "@/lib/workspace-integration";

// ─── SLA Mock Data (local to workspace) ─────────────────────
interface WorkspaceSLA {
  id: string;
  workspaceId: string;
  customerName: string;
  customerId: string;
  title: string;
  status: "active" | "draft" | "expired" | "under_review";
  version: number;
  effectiveDate: string;
  expiryDate: string;
}

const workspaceSLAs: WorkspaceSLA[] = [
  { id: "wsla1", workspaceId: "w2", customerName: "Sadara Chemical", customerId: "c4", title: "Sadara Warehousing SLA", status: "active", version: 2, effectiveDate: "2024-04-01", expiryDate: "2026-03-31" },
  { id: "wsla2", workspaceId: "w6", customerName: "Aramco Services", customerId: "c7", title: "Aramco VAS SLA", status: "active", version: 1, effectiveDate: "2024-01-01", expiryDate: "2026-12-31" },
  { id: "wsla3", workspaceId: "w7", customerName: "Nestlé KSA", customerId: "c5", title: "Nestlé Cold Chain SLA", status: "draft", version: 1, effectiveDate: "2025-09-20", expiryDate: "2026-09-30" },
  { id: "wsla4", workspaceId: "w8", customerName: "Bayer Middle East", customerId: "c10", title: "Bayer Pharma Logistics SLA", status: "active", version: 1, effectiveDate: "2024-06-01", expiryDate: "2026-06-30" },
];

// ─── CYCLE STATUS CONFIG ────────────────────────────────────
const cycleStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  active: { color: "bg-emerald-100 text-emerald-700", label: "Active" },
  expiring: { color: "bg-amber-100 text-amber-700", label: "Expiring" },
  renewal_window: { color: "bg-orange-100 text-orange-700", label: "Renewal Window" },
  renewal_in_progress: { color: "bg-blue-100 text-blue-700", label: "Renewal In Progress" },
  closed: { color: "bg-gray-100 text-gray-500", label: "Closed" },
};

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
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
  const [showDocArchived, setShowDocArchived] = useState(false);

  // Composer state — which artifact is being edited
  const [composerTarget, setComposerTarget] = useState<{
    type: "quote" | "proposal" | "sla";
    entityId: string;
    instanceId?: string;
    customerName: string;
    customerId: string;
    workspaceId: string;
  } | null>(null);

  // Supporting docs state
  const [supportDocFilter, setSupportDocFilter] = useState<string>("all");
  const [showSupportUpload, setShowSupportUpload] = useState(false);
  const [supportUploadName, setSupportUploadName] = useState("");
  const [supportUploadCategory, setSupportUploadCategory] = useState<SupportDocCategory>("Other");
  const [supportUploadRequired, setSupportUploadRequired] = useState(false);

  // Initialize
  useState(() => { initializeMockFiles(); });
  useState(() => { if (isWorkspaceIntegrationEnabled()) seedWorkspaceIntegrationData(); });

  const ws = workspaces.find(w => w.id === id);
  if (!ws) return (
    <div className="p-6">
      <h1 className="text-xl font-serif">Workspace not found</h1>
      <Link href="/workspaces"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link>
    </div>
  );

  const customer = customers.find(c => c.id === ws.customerId);
  const wsQuotes = quotes.filter(q => q.workspaceId === ws.id);
  const wsProposals = proposals.filter(p => p.workspaceId === ws.id);
  const wsApprovals = approvalRecords.filter(a => a.workspaceId === ws.id);
  const wsSignals = signals.filter(s => s.workspaceId === ws.id);
  const wsSLAs = workspaceSLAs.filter(s => s.workspaceId === ws.id);
  const wsAudit = auditLog.filter(a =>
    a.entityId === ws.id ||
    wsQuotes.some(q => q.id === a.entityId) ||
    wsProposals.some(p => p.id === a.entityId) ||
    a.entityId.startsWith(`cc-${ws.id}`) ||
    a.entityId.startsWith(`sd-${ws.id}`)
  );
  const approvalReqs = getApprovalRequirements(ws.gpPercent, ws.palletVolume);
  const currentStageIdx = WORKSPACE_STAGES.findIndex(s => s.value === ws.stage);
  const nextStage = getNextStage(ws.stage);
  const wsStageHistory = getStageHistory(ws.id);
  const wsOverrides = getWorkspaceOverrides(ws.id);
  const latestOverride = getLatestOverride(ws.id);
  const preflightFailures: ValidationFailure[] = nextStage ? preflightValidation(ws.id) : [];
  const hasWarnings = preflightFailures.length > 0;
  const isStrictMode = getStrictMode();

  // Contract cycle (v1 integration)
  const integrationEnabled = isWorkspaceIntegrationEnabled();
  const activeCycle = integrationEnabled ? getOrCreateCycle(ws.id) : undefined;
  const daysToExpiry = activeCycle ? getDaysToExpiry(activeCycle.endDate) : null;
  const inRenewalWindow = activeCycle ? isInRenewalWindow(activeCycle) : false;
  const contractReadyChecks = integrationEnabled ? getContractReadyChecks(ws.id) : [];

  // Supporting docs
  const wsSupportDocs = integrationEnabled ? getSupportingDocs(ws.id, showDocArchived) : [];

  // ── Hotkey protection ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !showConfirm) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        if (target.closest("[data-advance-stage-btn]")) { e.preventDefault(); e.stopPropagation(); }
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

  // ── Stage transition handlers ──
  const handleAdvanceStage = () => {
    setTransitionResult(null); setConfirmInput(""); setOverrideReason(""); setShowConfirm(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const executeTransition = () => {
    setShowConfirm(false);
    const opts = hasWarnings && !isStrictMode && overrideReason.trim()
      ? { overrideReason: overrideReason.trim() } : undefined;
    const result = advanceStage(ws.id, opts);
    setTransitionResult(result);
    setConfirmInput(""); setOverrideReason("");
    if (result.success) {
      toast.success(result.governanceOverride ? "Stage advanced with governance override" : result.message, {
        description: `${getStageDisplayName(result.fromStage)} → ${getStageDisplayName(result.nextStage!)}`,
      });
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
      setShowUndoBanner(false); setTransitionResult(null);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      forceUpdate(n => n + 1);
    } else {
      toast.error("Undo blocked", { description: result.message });
    }
  };

  const dismissResult = () => setTransitionResult(null);
  const requiredConfirmText = nextStage ? getStageDisplayName(nextStage) : "";
  const confirmMatch = confirmInput.trim().toLowerCase() === requiredConfirmText.toLowerCase();
  const canConfirm = isStrictMode
    ? (confirmMatch && !hasWarnings)
    : (confirmMatch && (!hasWarnings || overrideReason.trim().length > 0));

  // ── Open in Composer ──
  const openInComposer = (type: "quote" | "proposal" | "sla", entityId: string) => {
    try {
      const linkedType = type === "quote" ? "quote_version" as const : type === "proposal" ? "proposal_version" as const : "sla_version" as const;
      const instance = resolveOrCreateDocInstance({
        doc_type: type,
        linked_entity_type: linkedType,
        linked_entity_id: entityId,
        customer_id: ws.customerId,
        customer_name: ws.customerName,
        workspace_id: ws.id,
        workspace_name: ws.title,
      });
      setComposerTarget({
        type,
        entityId,
        instanceId: instance.id,
        customerName: ws.customerName,
        customerId: ws.customerId,
        workspaceId: ws.id,
      });
    } catch {
      setComposerTarget({
        type,
        entityId,
        customerName: ws.customerName,
        customerId: ws.customerId,
        workspaceId: ws.id,
      });
    }
  };

  // ── Handle supporting doc upload ──
  const handleSupportDocUpload = () => {
    if (!supportUploadName.trim()) { toast.error("Name is required"); return; }
    uploadSupportingDoc({
      workspaceId: ws.id,
      name: supportUploadName.trim(),
      fileName: `${supportUploadName.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`,
      category: supportUploadCategory,
      isRequired: supportUploadRequired,
      linkedCycleId: activeCycle?.id,
    });
    toast.success(`Supporting doc "${supportUploadName}" uploaded`);
    setSupportUploadName(""); setSupportUploadCategory("Other"); setSupportUploadRequired(false);
    setShowSupportUpload(false);
    forceUpdate(n => n + 1);
  };

  // ── If composer is open, show it full-screen ──
  if (composerTarget) {
    const backLabel = composerTarget.type === "quote" ? "Back to Workspace Quotes"
      : composerTarget.type === "proposal" ? "Back to Workspace Proposals"
      : "Back to Workspace SLAs";
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <DocumentComposer
          documentType={composerTarget.type}
          customerId={composerTarget.customerId}
          customerName={composerTarget.customerName}
          workspaceId={composerTarget.workspaceId}
          existingInstanceId={composerTarget.instanceId}
          onBack={() => setComposerTarget(null)}
          backLabel={backLabel}
          onSave={(doc: ComposerDocument) => {
            toast.success(`${composerTarget.type} saved — ${doc.title}`);
          }}
          onExportPDF={(doc: ComposerDocument) => {
            toast.success(`${composerTarget.type} PDF export initiated`);
          }}
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/workspaces"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`rag-dot ${ws.ragStatus === "red" ? "rag-dot-red" : ws.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
              <h1 className="text-xl font-serif font-bold">{ws.customerName}</h1>
              <Badge variant="outline" className={`text-xs ${getStageColor(ws.stage)}`}>{getStageLabel(ws.stage)}</Badge>
              {ws.crmDealId && <span className="text-xs text-muted-foreground data-value">CRM: {ws.crmDealId}</span>}
              {latestOverride && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] border-amber-400 bg-amber-50 text-amber-800 cursor-help gap-1">
                      <ShieldOff className="w-3 h-3" /> Governance Override Applied
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm p-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Override Details</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Reason:</span><span className="font-medium">{latestOverride.overrideReason}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Approver:</span><span className="font-medium">{latestOverride.userName}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Transition:</span><span className="font-medium">{getStageDisplayName(latestOverride.fromStage)} → {getStageDisplayName(latestOverride.toStage)}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Rules:</span><span className="font-medium">{latestOverride.overriddenRules.join(", ")}</span></div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{ws.title}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAdvanceStage} disabled={!nextStage} data-advance-stage-btn>
            <ChevronRight className="w-3.5 h-3.5 mr-1" />
            {nextStage ? `Advance to ${getStageDisplayName(nextStage)}` : "Final Stage"}
          </Button>
        </div>

        {/* ═══ CONFIRMATION MODAL ═══ */}
        {showConfirm && nextStage && (
          <div className="mb-4 rounded-lg border-2 border-amber-300/60 bg-amber-50/80 overflow-hidden">
            <div className="px-5 py-3 bg-amber-100/60 border-b border-amber-200/60 flex items-center gap-2.5">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-900">Stage Transition — Governance Check</span>
              {isStrictMode && <Badge variant="outline" className="text-[9px] border-red-300 text-red-700 ml-auto">STRICT MODE</Badge>}
              {!isStrictMode && hasWarnings && <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700 ml-auto">SOFT GOVERNANCE</Badge>}
            </div>
            <div className="p-5 space-y-4">
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

              {/* Contract Ready Checks */}
              {integrationEnabled && nextStage === "contract_ready" && contractReadyChecks.length > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Contract Ready Requirements</p>
                  <div className="space-y-1.5">
                    {contractReadyChecks.map((check, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {check.passed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span className={check.passed ? "text-emerald-700" : "text-red-700"}>{check.label}</span>
                        {!check.passed && check.cta && (
                          <Button variant="link" size="sm" className="text-[10px] h-auto p-0 text-blue-600">{check.cta}</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                        <span><span className="font-medium">[{f.ruleName}]</span> {f.error}</span>
                      </li>
                    ))}
                  </ul>
                  {!isStrictMode && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-100/60 rounded px-2 py-1.5">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Soft governance mode is active. You may override these warnings by providing a reason below.</span>
                    </div>
                  )}
                </div>
              )}

              {hasWarnings && !isStrictMode && (
                <div>
                  <label className="text-xs font-medium text-amber-800 block mb-1.5">
                    Override Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Provide justification for overriding the validation warnings..."
                    className="w-full h-16 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Type <span className="font-bold text-foreground">"{requiredConfirmText}"</span> to confirm
                </label>
                <Input ref={inputRef} value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
                  placeholder={requiredConfirmText} className="h-9 text-sm font-mono"
                  onKeyDown={e => { if (e.key === "Enter" && canConfirm) { e.preventDefault(); executeTransition(); } }} />
              </div>

              {isStrictMode && hasWarnings && confirmMatch && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700"><span className="font-semibold">Strict governance mode is active.</span> Resolve all issues before advancing.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setConfirmInput(""); setOverrideReason(""); }} className="text-xs h-8">Cancel</Button>
                <Button size="sm" onClick={executeTransition} disabled={!canConfirm}
                  className={`text-xs h-8 ${hasWarnings && !isStrictMode && overrideReason.trim() ? "bg-amber-700 hover:bg-amber-800" : "bg-[#1B2A4A] hover:bg-[#2A3F6A]"} disabled:opacity-40`}>
                  {hasWarnings && !isStrictMode && overrideReason.trim()
                    ? <><ShieldOff className="w-3.5 h-3.5 mr-1" />Confirm with Override</>
                    : <><ShieldCheck className="w-3.5 h-3.5 mr-1" />Confirm Advance</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ UNDO BANNER ═══ */}
        {showUndoBanner && transitionResult?.success && (
          <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${transitionResult.governanceOverride ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 ${transitionResult.governanceOverride ? "text-amber-600" : "text-emerald-600"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${transitionResult.governanceOverride ? "text-amber-800" : "text-emerald-800"}`}>
                {transitionResult.governanceOverride ? "Stage Advanced (Governance Override)" : "Stage Advanced Successfully"}
              </p>
              <p className={`text-xs mt-0.5 ${transitionResult.governanceOverride ? "text-amber-700" : "text-emerald-700"}`}>{transitionResult.message}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`flex items-center gap-1.5 text-xs ${transitionResult.governanceOverride ? "text-amber-700" : "text-blue-700"}`}>
                <Timer className="w-3.5 h-3.5" />
                <span className="data-value font-medium">{Math.floor(undoCountdown / 60)}:{String(undoCountdown % 60).padStart(2, "0")}</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleUndo}
                className={`text-xs h-8 ${transitionResult.governanceOverride ? "border-amber-300 text-amber-700 hover:bg-amber-100" : "border-blue-300 text-blue-700 hover:bg-blue-100"}`}>
                <Undo2 className="w-3.5 h-3.5 mr-1" /> Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowUndoBanner(false); setTransitionResult(null); }} className="text-xs h-7">Dismiss</Button>
            </div>
          </div>
        )}

        {/* ═══ BLOCKED RESULT ═══ */}
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
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">•</span> {err}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={dismissResult} className="text-xs h-7 shrink-0">Dismiss</Button>
            </div>
          </div>
        )}

        {/* ═══ STAGE PIPELINE ═══ */}
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

        {/* ═══ KPI CARDS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          {[
            { label: "Est. Value", value: formatSAR(ws.estimatedValue) },
            { label: "GP%", value: formatPercent(ws.gpPercent), color: ws.gpPercent >= 22 ? "rag-green" : ws.gpPercent >= 10 ? "rag-amber" : "rag-red" },
            { label: "Pallets", value: ws.palletVolume.toLocaleString() },
            { label: "Days in Stage", value: String(ws.daysInStage), color: ws.daysInStage > 14 ? "rag-red" : ws.daysInStage > 7 ? "rag-amber" : undefined },
            { label: "Region", value: ws.region },
            { label: "Owner", value: ws.owner },
          ].map(kpi => (
            <Card key={kpi.label} className="border border-border shadow-none"><CardContent className="p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`data-value text-lg font-semibold mt-0.5 ${kpi.color || ""}`}>{kpi.value}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* ═══ CONTRACT & RENEWAL STRIP ═══ */}
        {integrationEnabled && activeCycle && (
          <Card className={`border shadow-none mb-6 ${inRenewalWindow ? "border-orange-300 bg-orange-50/30" : daysToExpiry !== null && daysToExpiry <= 120 ? "border-amber-200 bg-amber-50/20" : "border-border"}`}>
            <CardContent className="py-3 px-5">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract Cycle</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">Cycle #{activeCycle.cycleNumber}</span>
                  <Badge variant="outline" className={`text-[10px] ${cycleStatusConfig[activeCycle.status]?.color || ""}`}>
                    {cycleStatusConfig[activeCycle.status]?.label || activeCycle.status}
                  </Badge>
                </div>

                {activeCycle.endDate && (
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">SLA Expiry</span>
                      <p className="text-sm font-medium data-value">{activeCycle.endDate}</p>
                    </div>
                    {daysToExpiry !== null && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase">Days Left</span>
                        <p className={`text-sm font-bold ${daysToExpiry <= 30 ? "text-red-600" : daysToExpiry <= 90 ? "text-amber-600" : "text-emerald-600"}`}>
                          {daysToExpiry > 0 ? daysToExpiry : "Expired"}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">Renewal Window</span>
                      <p className={`text-sm font-medium ${inRenewalWindow ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>
                        {inRenewalWindow ? "OPEN" : daysToExpiry !== null && daysToExpiry <= 0 ? "Expired" : "Closed"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Renewal Owner:</span>
                  <Select
                    value={activeCycle.renewalOwnerId || "unassigned"}
                    onValueChange={(val) => {
                      const member = teamMembers.find(m => m.id === val);
                      if (member) {
                        updateRenewalOwner(activeCycle.id, member.id, member.name);
                        forceUpdate(n => n + 1);
                        toast.success(`Renewal owner changed to ${member.name}`);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {inRenewalWindow && activeCycle.status !== "renewal_in_progress" && (
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-xs h-7 ml-auto"
                    onClick={() => {
                      startRenewal(ws.id);
                      forceUpdate(n => n + 1);
                      toast.success("Renewal started — Cycle #" + (activeCycle.cycleNumber + 1) + " created");
                    }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Start Renewal
                  </Button>
                )}
                {activeCycle.status === "renewal_in_progress" && (
                  <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 ml-auto">
                    <RefreshCw className="w-3 h-3 mr-1" /> Renewal In Progress
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ SIGNALS ═══ */}
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

        {/* ═══ TABS ═══ */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {navigationV1 ? (
              <TabsTrigger value="documents">Documents</TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="quotes">Quotes ({wsQuotes.length})</TabsTrigger>
                <TabsTrigger value="proposals">Proposals ({wsProposals.length})</TabsTrigger>
                <TabsTrigger value="slas">SLAs ({wsSLAs.length})</TabsTrigger>
              </>
            )}
            {navigationV1 && <TabsTrigger value="contracts">Contracts</TabsTrigger>}
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            {!navigationV1 && <TabsTrigger value="documents">{integrationEnabled ? "Supporting Docs" : "Documents"}</TabsTrigger>}
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          {/* ═══ OVERVIEW TAB ═══ */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Customer Info</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {customer && [
                    { l: "Code", v: customer.code }, { l: "Industry", v: customer.industry },
                    { l: "Grade", v: customer.grade }, { l: "Service Type", v: customer.serviceType },
                    { l: "Contract Expiry", v: customer.contractExpiry }, { l: "DSO", v: `${customer.dso} days` },
                    { l: "Payment Status", v: customer.paymentStatus }, { l: "Contact", v: customer.contactName },
                  ].map(r => (
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

          {/* ═══ UNIFIED DOCUMENTS TAB (navigationV1) ═══ */}
          {navigationV1 && (
            <TabsContent value="documents">
              {/* ── Document Type Sections ── */}
              <div className="space-y-8">
                {/* ── Quotes Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" /> Quotes
                      <Badge variant="secondary" className="text-[10px]">{wsQuotes.length}</Badge>
                    </h3>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInComposer("quote", `new-${ws.id}`)}>
                      <Plus className="w-3 h-3 mr-1" /> New Quote
                    </Button>
                  </div>
                  {wsQuotes.length > 0 ? <div className="space-y-2">{wsQuotes.map(q => (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Quote v{q.version}</span>
                            <Badge variant="outline" className="text-[10px]">{q.state}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatSAR(q.annualRevenue)}/yr · GP {formatPercent(q.gpPercent)} · {q.createdAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInComposer("quote", q.id)}>
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                          try {
                            const inst = resolveOrCreateDocInstance({ doc_type: "quote", linked_entity_type: "quote_version", linked_entity_id: q.id, customer_id: ws.customerId, customer_name: ws.customerName, workspace_id: ws.id });
                            navigate(`/composer/${inst.id}/view`);
                          } catch { toast.error("Could not open viewer"); }
                        }}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  ))}</div> : <p className="text-xs text-muted-foreground">No quotes yet. <Button variant="link" className="text-xs p-0" onClick={() => openInComposer("quote", `new-${ws.id}`)}>Create one</Button></p>}
                </div>

                <hr className="border-border" />

                {/* ── Proposals Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-muted-foreground" /> Proposals
                      <Badge variant="secondary" className="text-[10px]">{wsProposals.length}</Badge>
                    </h3>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInComposer("proposal", `new-${ws.id}`)}>
                      <Plus className="w-3 h-3 mr-1" /> New Proposal
                    </Button>
                  </div>
                  {wsProposals.length > 0 ? <div className="space-y-2">{wsProposals.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.title}</span>
                            <Badge variant="outline" className="text-[10px]">{p.state}</Badge>
                            <span className="text-xs text-muted-foreground">v{p.version}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">{p.sections.slice(0, 4).map(s => <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>)}{p.sections.length > 4 && <Badge variant="secondary" className="text-[9px]">+{p.sections.length - 4}</Badge>}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInComposer("proposal", p.id)}>
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                          try {
                            const inst = resolveOrCreateDocInstance({ doc_type: "proposal", linked_entity_type: "proposal_version", linked_entity_id: p.id, customer_id: ws.customerId, customer_name: ws.customerName, workspace_id: ws.id });
                            navigate(`/composer/${inst.id}/view`);
                          } catch { toast.error("Could not open viewer"); }
                        }}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  ))}</div> : <p className="text-xs text-muted-foreground">No proposals yet. <Button variant="link" className="text-xs p-0" onClick={() => openInComposer("proposal", `new-${ws.id}`)}>Create one</Button></p>}
                </div>

                <hr className="border-border" />

                {/* ── SLAs Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-muted-foreground" /> SLAs
                      <Badge variant="secondary" className="text-[10px]">{wsSLAs.length}</Badge>
                    </h3>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInComposer("sla", `new-${ws.id}`)}>
                      <Plus className="w-3 h-3 mr-1" /> New SLA
                    </Button>
                  </div>
                  {wsSLAs.length > 0 ? <div className="space-y-2">{wsSLAs.map(sla => {
                    const slaStatusColor = sla.status === "active" ? "bg-emerald-100 text-emerald-700" : sla.status === "draft" ? "bg-gray-100 text-gray-700" : sla.status === "expired" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
                    return (
                      <div key={sla.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileSignature className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{sla.title}</span>
                              <Badge variant="outline" className={`text-[10px] ${slaStatusColor}`}>{sla.status}</Badge>
                              <span className="text-xs text-muted-foreground">v{sla.version}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Effective: {sla.effectiveDate} · Expires: {sla.expiryDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInComposer("sla", sla.id)}>
                            <Edit className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                            try {
                              const inst = resolveOrCreateDocInstance({ doc_type: "sla", linked_entity_type: "sla_version", linked_entity_id: sla.id, customer_id: sla.customerId, customer_name: sla.customerName, workspace_id: ws.id });
                              navigate(`/composer/${inst.id}/view`);
                            } catch { toast.error("Could not open viewer"); }
                          }}>
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                        </div>
                      </div>
                    );
                  })}</div> : <p className="text-xs text-muted-foreground">No SLAs yet. <Button variant="link" className="text-xs p-0" onClick={() => openInComposer("sla", `new-${ws.id}`)}>Create one</Button></p>}
                </div>

                <hr className="border-border" />

                {/* ── Supporting Docs Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-muted-foreground" /> Supporting Documents
                      <Badge variant="secondary" className="text-[10px]">{wsSupportDocs.length}</Badge>
                    </h3>
                    <div className="flex items-center gap-2">
                      <Select value={supportDocFilter} onValueChange={setSupportDocFilter}>
                        <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {SUPPORT_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSupportUpload(true)}>
                        <Upload className="w-3 h-3 mr-1" /> Upload
                      </Button>
                    </div>
                  </div>

                  {/* Upload form */}
                  {showSupportUpload && (
                    <Card className="border border-blue-200 bg-blue-50/30 shadow-none mb-3">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold text-blue-800">Upload Supporting Document</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">Document Name</label>
                            <Input value={supportUploadName} onChange={e => setSupportUploadName(e.target.value)} placeholder="e.g. Trade License 2025" className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">Category</label>
                            <Select value={supportUploadCategory} onValueChange={v => setSupportUploadCategory(v as SupportDocCategory)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SUPPORT_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="text-xs h-7 bg-[#1B2A4A] hover:bg-[#2A3F6A]" onClick={handleSupportDocUpload}>
                            <FileUp className="w-3 h-3 mr-1" /> Upload
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSupportUpload(false)}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {(() => {
                    const filtered = supportDocFilter === "all" ? wsSupportDocs : wsSupportDocs.filter(d => d.category === supportDocFilter);
                    return filtered.length > 0 ? (
                      <div className="space-y-2">
                        {filtered.map(doc => (
                          <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors hover:bg-muted/30 ${doc.status === "archived" ? "opacity-60" : ""}`}>
                            <Badge variant="outline" className="text-[9px] shrink-0">{doc.category}</Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                {doc.name}
                                {doc.isRequiredForContractReady && <Badge variant="outline" className="text-[9px] border-emerald-300 bg-emerald-50 text-emerald-700">Required</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.version} · {doc.uploadedBy}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { toggleRequiredForContract(doc.id); forceUpdate(n => n + 1); }}>
                                {doc.isRequiredForContractReady ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                              </Button>
                              {doc.status === "active" ? (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { archiveSupportingDoc(doc.id); forceUpdate(n => n + 1); toast.success(`"${doc.name}" archived`); }}>
                                  <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { restoreSupportingDoc(doc.id); forceUpdate(n => n + 1); toast.success(`"${doc.name}" restored`); }}>
                                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">No supporting documents yet. <Button variant="link" className="text-xs p-0" onClick={() => setShowSupportUpload(true)}>Upload one</Button></p>;
                  })()}
                </div>
              </div>
            </TabsContent>
          )}

          {/* ═══ CONTRACTS TAB (navigationV1) ═══ */}
          {navigationV1 && (
            <TabsContent value="contracts">
              {activeCycle ? (
                <div className="space-y-4">
                  <Card className="border border-border shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-serif flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> Contract Cycle #{activeCycle.cycleNumber}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div><p className="text-[10px] text-muted-foreground uppercase">Status</p><Badge variant="outline" className={`mt-1 text-[10px] ${cycleStatusConfig[activeCycle.status]?.color || ""}`}>{cycleStatusConfig[activeCycle.status]?.label || activeCycle.status}</Badge></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Start Date</p><p className="text-sm font-medium mt-0.5 data-value">{activeCycle.startDate}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">End Date</p><p className="text-sm font-medium mt-0.5 data-value">{activeCycle.endDate}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Days to Expiry</p><p className={`text-sm font-medium mt-0.5 data-value ${daysToExpiry !== null && daysToExpiry < 90 ? "text-red-600" : ""}`}>{daysToExpiry ?? "N/A"}</p></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div><p className="text-[10px] text-muted-foreground uppercase">Annual Value</p><p className="text-sm font-medium mt-0.5 data-value">{formatSAR(wsQuotes[0]?.annualRevenue ?? 0)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Renewal Window</p><p className="text-sm font-medium mt-0.5">{activeCycle.renewalWindowDays} days</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Renewal Owner</p><p className="text-sm font-medium mt-0.5">{activeCycle.renewalOwnerName || "Unassigned"}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">In Renewal Window</p><p className="text-sm font-medium mt-0.5">{inRenewalWindow ? "Yes" : "No"}</p></div>
                      </div>
                      {/* Contract Ready Checks */}
                      {contractReadyChecks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold mb-2">Contract Ready Checklist</p>
                          <div className="space-y-1.5">
                            {contractReadyChecks.map((check, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {check.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                <span className={check.passed ? "text-muted-foreground" : "font-medium"}>{check.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* SLA Summary in Contracts */}
                  {wsSLAs.length > 0 && (
                    <Card className="border border-border shadow-none">
                      <CardHeader className="pb-3"><CardTitle className="text-sm font-serif">Linked SLAs</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border">
                          {wsSLAs.map(sla => {
                            const slaStatusColor = sla.status === "active" ? "bg-emerald-100 text-emerald-700" : sla.status === "draft" ? "bg-gray-100 text-gray-700" : sla.status === "expired" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
                            return (
                              <div key={sla.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <FileSignature className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{sla.title}</span>
                                  <Badge variant="outline" className={`text-[10px] ${slaStatusColor}`}>{sla.status}</Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">Expires: {sla.expiryDate}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card className="border border-border shadow-none">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    <CalendarClock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    No contract cycle created yet.
                    <p className="text-xs mt-1">Contract cycles are created when the workspace reaches the Contract Ready stage.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ═══ LEGACY QUOTES TAB (non-navigationV1) ═══ */}
          {!navigationV1 && <TabsContent value="quotes">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Quotes</h4>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInComposer("quote", `new-${ws.id}`)}>
                <Plus className="w-3 h-3 mr-1" /> New Quote
              </Button>
            </div>
            {wsQuotes.length > 0 ? <div className="space-y-3">{wsQuotes.map(q => (
              <Card key={q.id} className="border border-border shadow-none hover:shadow-sm transition-shadow"><CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Quote v{q.version}</span>
                    <Badge variant="outline" className="text-[10px]">{q.state}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInComposer("quote", q.id)}>
                      <Edit className="w-3 h-3 mr-1" /> Open in Composer
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                      try {
                        const inst = resolveOrCreateDocInstance({ doc_type: "quote", linked_entity_type: "quote_version", linked_entity_id: q.id, customer_id: ws.customerId, customer_name: ws.customerName, workspace_id: ws.id });
                        navigate(`/composer/${inst.id}/view`);
                      } catch { toast.error("Could not open viewer"); }
                    }}>
                      <Eye className="w-3 h-3 mr-1" /> View PDF
                    </Button>
                    <span className="text-xs text-muted-foreground ml-2">{q.createdAt}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { l: "Storage Rate", v: `SAR ${q.storageRate}/pallet/day` },
                    { l: "Monthly Revenue", v: formatSAR(q.monthlyRevenue) },
                    { l: "Annual Revenue", v: formatSAR(q.annualRevenue) },
                    { l: "GP%", v: formatPercent(q.gpPercent) },
                  ].map(kv => (
                    <div key={kv.l}><p className="text-[10px] text-muted-foreground uppercase">{kv.l}</p><p className="data-value text-sm font-medium mt-0.5">{kv.v}</p></div>
                  ))}
                </div>
              </CardContent></Card>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No quotes created yet. <Button variant="link" className="text-xs p-0 ml-1" onClick={() => openInComposer("quote", `new-${ws.id}`)}>Create one</Button></CardContent></Card>}
          </TabsContent>}

          {/* ═══ LEGACY PROPOSALS TAB (non-navigationV1) ═══ */}
          {!navigationV1 && <TabsContent value="proposals">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Proposals</h4>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInComposer("proposal", `new-${ws.id}`)}>
                <Plus className="w-3 h-3 mr-1" /> New Proposal
              </Button>
            </div>
            {wsProposals.length > 0 ? <div className="space-y-3">{wsProposals.map(p => (
              <Card key={p.id} className="border border-border shadow-none hover:shadow-sm transition-shadow"><CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.title}</span>
                    <Badge variant="outline" className="text-[10px]">{p.state}</Badge>
                    <span className="text-xs text-muted-foreground">v{p.version}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInComposer("proposal", p.id)}>
                      <Edit className="w-3 h-3 mr-1" /> Open in Composer
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                      try {
                        const inst = resolveOrCreateDocInstance({ doc_type: "proposal", linked_entity_type: "proposal_version", linked_entity_id: p.id, customer_id: ws.customerId, customer_name: ws.customerName, workspace_id: ws.id });
                        navigate(`/composer/${inst.id}/view`);
                      } catch { toast.error("Could not open viewer"); }
                    }}>
                      <Eye className="w-3 h-3 mr-1" /> View PDF
                    </Button>
                    <span className="text-xs text-muted-foreground ml-2">{p.createdAt}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">{p.sections.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
              </CardContent></Card>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No proposals created yet. <Button variant="link" className="text-xs p-0 ml-1" onClick={() => openInComposer("proposal", `new-${ws.id}`)}>Create one</Button></CardContent></Card>}
          </TabsContent>}

          {/* ═══ LEGACY SLAs TAB (non-navigationV1) ═══ */}
          {!navigationV1 && <TabsContent value="slas">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace SLAs</h4>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInComposer("sla", `new-${ws.id}`)}>
                <Plus className="w-3 h-3 mr-1" /> New SLA
              </Button>
            </div>
            {wsSLAs.length > 0 ? <div className="space-y-3">{wsSLAs.map(sla => {
              const slaStatusColor = sla.status === "active" ? "bg-emerald-100 text-emerald-700" : sla.status === "draft" ? "bg-gray-100 text-gray-700" : sla.status === "expired" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
              return (
                <Card key={sla.id} className="border border-border shadow-none hover:shadow-sm transition-shadow"><CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{sla.title}</span>
                      <Badge variant="outline" className={`text-[10px] ${slaStatusColor}`}>{sla.status}</Badge>
                      <span className="text-xs text-muted-foreground">v{sla.version}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInComposer("sla", sla.id)}>
                        <Edit className="w-3 h-3 mr-1" /> Open in Composer
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        try {
                          const inst = resolveOrCreateDocInstance({ doc_type: "sla", linked_entity_type: "sla_version", linked_entity_id: sla.id, customer_id: sla.customerId, customer_name: sla.customerName, workspace_id: ws.id });
                          navigate(`/composer/${inst.id}/view`);
                        } catch { toast.error("Could not open viewer"); }
                      }}>
                        <Eye className="w-3 h-3 mr-1" /> View PDF
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Effective: {sla.effectiveDate}</span>
                    <span className="text-gray-300">·</span>
                    <span className={sla.status === "expired" ? "text-red-600 font-medium" : ""}>Expires: {sla.expiryDate}</span>
                  </div>
                </CardContent></Card>
              );
            })}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No SLAs created yet. <Button variant="link" className="text-xs p-0 ml-1" onClick={() => openInComposer("sla", `new-${ws.id}`)}>Create one</Button></CardContent></Card>}
          </TabsContent>}

          {/* ═══ APPROVALS TAB ═══ */}
          <TabsContent value="approvals">
            {/* Missing approvals banner */}
            {wsApprovals.length > 0 && approvalReqs.some(req => !wsApprovals.find(a => a.approverRole === req.role && a.decision === "approved")) && (
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Required Approvals Missing</p>
                  <p className="text-xs text-amber-700 mt-0.5">Some required approvals are pending or not started. Stage advance may be blocked.</p>
                  <Button size="sm" variant="outline" className="text-xs h-6 mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => toast.info("Approval request sent to required approvers")}>
                    Request Approval
                  </Button>
                </div>
              </div>
            )}
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

          {/* ═══ SUPPORTING DOCS / DOCUMENTS TAB ═══ */}
          <TabsContent value="documents">
            {integrationEnabled ? (
              <>
                {/* Supporting Docs (v1 integration) */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" /> Supporting Documents ({wsSupportDocs.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Select value={supportDocFilter} onValueChange={setSupportDocFilter}>
                      <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {SUPPORT_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant={showDocArchived ? "default" : "outline"} className="text-xs h-7" onClick={() => { setShowDocArchived(!showDocArchived); forceUpdate(n => n + 1); }}>
                      {showDocArchived ? "Showing Archived" : "Show Archived"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSupportUpload(true)}>
                      <Upload className="w-3 h-3 mr-1" /> Upload
                    </Button>
                  </div>
                </div>

                {/* Upload dialog */}
                {showSupportUpload && (
                  <Card className="border border-blue-200 bg-blue-50/30 shadow-none mb-4">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-semibold text-blue-800">Upload Supporting Document</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Document Name</label>
                          <Input value={supportUploadName} onChange={e => setSupportUploadName(e.target.value)} placeholder="e.g. Trade License 2025" className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Category</label>
                          <Select value={supportUploadCategory} onValueChange={v => setSupportUploadCategory(v as SupportDocCategory)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SUPPORT_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <button type="button" onClick={() => setSupportUploadRequired(!supportUploadRequired)}
                            className={`w-8 h-4.5 rounded-full transition-colors ${supportUploadRequired ? "bg-emerald-500" : "bg-gray-300"} relative`}>
                            <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${supportUploadRequired ? "left-4" : "left-0.5"}`} />
                          </button>
                          Required for Contract Ready
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="text-xs h-7 bg-[#1B2A4A] hover:bg-[#2A3F6A]" onClick={handleSupportDocUpload}>
                          <FileUp className="w-3 h-3 mr-1" /> Upload
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSupportUpload(false)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Supporting docs list */}
                {(() => {
                  const filtered = supportDocFilter === "all" ? wsSupportDocs : wsSupportDocs.filter(d => d.category === supportDocFilter);
                  return filtered.length > 0 ? (
                    <div className="space-y-2">
                      {filtered.map(doc => (
                        <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors hover:bg-muted/30 ${doc.status === "archived" ? "opacity-60" : ""}`}>
                          <Badge variant="outline" className="text-[9px] shrink-0">{doc.category}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                              {doc.name}
                              {doc.isRequiredForContractReady && (
                                <Badge variant="outline" className="text-[9px] border-emerald-300 bg-emerald-50 text-emerald-700">Required</Badge>
                              )}
                              {doc.status === "archived" && <Badge variant="secondary" className="text-[9px]">Archived</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.version} · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                  toggleRequiredForContract(doc.id);
                                  forceUpdate(n => n + 1);
                                  toast.success(`"${doc.name}" ${!doc.isRequiredForContractReady ? "marked" : "unmarked"} as required`);
                                }}>
                                  {doc.isRequiredForContractReady ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Toggle required for contract</p></TooltipContent>
                            </Tooltip>
                            {activeCycle && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                    linkDocToCycle(doc.id, activeCycle.id);
                                    forceUpdate(n => n + 1);
                                    toast.success(`Linked to Cycle #${activeCycle.cycleNumber}`);
                                  }}>
                                    <Link2 className={`w-3.5 h-3.5 ${doc.linkedCycleId ? "text-blue-600" : "text-muted-foreground"}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">{doc.linkedCycleId ? "Linked to cycle" : "Link to cycle"}</p></TooltipContent>
                              </Tooltip>
                            )}
                            {doc.status === "active" ? (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                archiveSupportingDoc(doc.id);
                                forceUpdate(n => n + 1);
                                toast.success(`"${doc.name}" archived`);
                              }}>
                                <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                restoreSupportingDoc(doc.id);
                                forceUpdate(n => n + 1);
                                toast.success(`"${doc.name}" restored`);
                              }}>
                                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Card className="border border-border shadow-none">
                      <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        No supporting documents yet
                        <div className="mt-3">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSupportUpload(true)}>
                            <Upload className="w-3 h-3" /> Upload First Document
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Legacy documents section (below supporting docs) */}
                {(() => {
                  const wsDocs = getDocumentsByWorkspace(ws.id, showDocArchived);
                  if (wsDocs.length === 0) return null;
                  return (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legacy Documents</h4>
                      <div className="space-y-2">
                        {wsDocs.map(doc => {
                          const isClickable = hasRealFile(doc);
                          return (
                            <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${isClickable ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"}`}
                              onClick={() => { if (isClickable) setViewerDoc(doc); }}>
                              <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-1.5">{doc.name}{isClickable && <Eye className="w-3 h-3 text-muted-foreground" />}</p>
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
                    </div>
                  );
                })()}
                <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} onDocumentChanged={() => forceUpdate(n => n + 1)} />
              </>
            ) : (
              /* Legacy documents tab (feature flag OFF) */
              <>
                {(() => {
                  const wsDocs = getDocumentsByWorkspace(ws.id, showDocArchived);
                  return (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5" /> Workspace Documents ({wsDocs.length})
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant={showDocArchived ? "default" : "outline"} className="gap-1.5 text-xs" onClick={() => setShowDocArchived(!showDocArchived)}>
                            {showDocArchived ? "Showing Archived" : "Show Archived"}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowDocUpload(true)}>
                            <Upload className="w-3 h-3" /> Upload
                          </Button>
                        </div>
                      </div>
                      {wsDocs.length > 0 ? (
                        <div className="space-y-2">
                          {wsDocs.map(doc => {
                            const isClickable = hasRealFile(doc);
                            return (
                              <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${isClickable ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"}`}
                                onClick={() => { if (isClickable) setViewerDoc(doc); }}>
                                <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate flex items-center gap-1.5">{doc.name}{isClickable && <Eye className="w-3 h-3 text-muted-foreground" />}</p>
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
                            No documents yet
                            <div className="mt-3"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDocUpload(true)}><Upload className="w-3 h-3" /> Upload First Document</Button></div>
                          </CardContent>
                        </Card>
                      )}
                      <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} onDocumentChanged={() => forceUpdate(n => n + 1)} />
                      <UploadDialog open={showDocUpload} onClose={() => setShowDocUpload(false)} defaultCategory="Supporting"
                        suggestedName={`${customer?.name ?? ""} — ${ws.title}`}
                        onUpload={({ name, category, file, notes, tags }) => {
                          uploadDocument({ name, category: category as DocumentCategory, customerId: ws.customerId, customerName: customer?.name ?? "Unknown", workspaceId: ws.id, workspaceName: ws.title, file, notes, tags });
                          toast.success(`Document "${name}" uploaded.`);
                          forceUpdate(n => n + 1);
                        }} />
                    </>
                  );
                })()}
              </>
            )}
          </TabsContent>

          {/* ═══ AUDIT TAB ═══ */}
          <TabsContent value="audit">
            {wsOverrides.length > 0 && (
              <Card className="border border-amber-200 bg-amber-50/30 shadow-none mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <ShieldOff className="w-4 h-4 text-amber-600" /> Governance Overrides ({wsOverrides.length})
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
                        <p className="text-xs text-amber-800 mb-1"><span className="font-medium">Reason:</span> {ov.overrideReason}</p>
                        <div className="flex flex-wrap gap-1">
                          {ov.overriddenRules.map((rule, j) => (
                            <Badge key={j} variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">{rule}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {wsStageHistory.length > 0 && (
              <Card className="border border-border shadow-none mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" /> Stage History
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
                          <Badge variant={entry.action === "reverted" ? "secondary" : "default"} className="text-[10px] shrink-0">{getStageDisplayName(entry.toStage)}</Badge>
                          {entry.action === "reverted" && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0"><Undo2 className="w-2.5 h-2.5 mr-0.5" />Reverted</Badge>}
                          {entry.action === "advanced_with_override" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 shrink-0 cursor-help"><ShieldOff className="w-2.5 h-2.5 mr-0.5" />Override</Badge>
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

            <Card className="border border-border shadow-none"><CardContent className="p-0">
              <div className="divide-y divide-border">
                {wsAudit.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.userName}</span>
                        <span className="text-xs text-muted-foreground">{entry.action}</span>
                        {(entry.action === "stage_advanced_override" || entry.action.includes("override")) && (
                          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">override</Badge>
                        )}
                        {entry.action.startsWith("contract_cycle") && (
                          <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700">cycle</Badge>
                        )}
                        {entry.action.startsWith("renewal") && (
                          <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-700">renewal</Badge>
                        )}
                        {entry.action.startsWith("supporting_doc") && (
                          <Badge variant="outline" className="text-[9px] border-purple-300 text-purple-700">docs</Badge>
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
