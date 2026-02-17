import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, FileText, ShieldCheck, FileCheck, Clock, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Undo2, Timer, ArrowRightLeft, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workspaces, customers, quotes, proposals, approvalRecords, signals, auditLog, formatSAR, formatPercent, getStageLabel, getStageColor, getApprovalRequirements, getRoleLabel, WORKSPACE_STAGES } from "@/lib/store";
import {
  advanceStage,
  getNextStage,
  getStageDisplayName,
  checkUndoEligibility,
  revertStage,
  getStageHistory,
  hasUndoRecord,
  type TransitionResult,
} from "@/lib/stage-transition";
import { toast } from "sonner";

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, forceUpdate] = useState(0);
  const [transitionResult, setTransitionResult] = useState<TransitionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // ── Hotkey protection: block single-key shortcuts from triggering stage movement ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block Enter key when the confirmation modal is NOT open
      // This prevents accidental stage advancement via keyboard shortcuts
      if (e.key === "Enter" && !showConfirm) {
        const target = e.target as HTMLElement;
        // Allow Enter in input fields and textareas
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        // Block Enter on the Advance Stage button itself
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
    setShowConfirm(true);
    // Focus the input after render
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const executeTransition = () => {
    setShowConfirm(false);
    setConfirmInput("");
    const result = advanceStage(ws.id);
    setTransitionResult(result);
    if (result.success) {
      toast.success(result.message, { description: `${getStageDisplayName(result.fromStage)} → ${getStageDisplayName(result.nextStage!)}` });
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

  // Validation warnings to display in the modal
  const validationWarnings: string[] = [];
  if (nextStage) {
    if (ws.stage === "quoting" && nextStage === "proposal_active") {
      const hasQuote = wsQuotes.length > 0;
      if (!hasQuote) validationWarnings.push("No quotes exist for this workspace.");
      if (ws.gpPercent < 22) validationWarnings.push(`GP% is ${ws.gpPercent.toFixed(1)}% — below 22% threshold. Director approval required.`);
    }
    if (ws.stage === "solution_design" && nextStage === "quoting" && ws.palletVolume <= 0) {
      validationWarnings.push("Pallet volume is zero.");
    }
    if (ws.stage === "negotiation" && nextStage === "commercial_approved") {
      const hasApproved = wsQuotes.some(q => q.state === "approved");
      if (!hasApproved) validationWarnings.push("No approved quote exists.");
    }
    if (ws.stage === "commercial_approved" && nextStage === "sla_drafting" && ws.approvalState !== "fully_approved") {
      validationWarnings.push("Not all required approvals are completed.");
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/workspaces"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`rag-dot ${ws.ragStatus === "red" ? "rag-dot-red" : ws.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
            <h1 className="text-xl font-serif font-bold">{ws.customerName}</h1>
            <Badge variant="outline" className={`text-xs ${getStageColor(ws.stage)}`}>{getStageLabel(ws.stage)}</Badge>
            {ws.crmDealId && <span className="text-xs text-muted-foreground data-value">CRM: {ws.crmDealId}</span>}
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

      {/* ═══ Enhanced Confirmation Modal ═══ */}
      {showConfirm && nextStage && (
        <div className="mb-4 rounded-lg border-2 border-amber-300/60 bg-amber-50/80 overflow-hidden">
          <div className="px-5 py-3 bg-amber-100/60 border-b border-amber-200/60 flex items-center gap-2.5">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-900">Stage Transition — Governance Check</span>
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

            {/* Validation warnings */}
            {validationWarnings.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-800">Validation Warnings</span>
                </div>
                <ul className="space-y-1">
                  {validationWarnings.map((w, i) => (
                    <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <span className="text-red-400 mt-0.5">•</span> {w}
                    </li>
                  ))}
                </ul>
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
                  if (e.key === "Enter" && confirmMatch) {
                    e.preventDefault();
                    executeTransition();
                  }
                }}
              />
              {confirmInput.length > 0 && !confirmMatch && (
                <p className="text-[10px] text-red-500 mt-1">Text does not match. Please type the exact destination stage name.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setConfirmInput(""); }} className="text-xs h-8">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={executeTransition}
                disabled={!confirmMatch}
                className="text-xs h-8 bg-[#1B2A4A] hover:bg-[#2A3F6A] disabled:opacity-40"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Confirm Advance
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Undo Banner ═══ */}
      {showUndoBanner && transitionResult?.success && (
        <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Stage Advanced Successfully</p>
            <p className="text-xs text-emerald-700 mt-0.5">{transitionResult.message}</p>
            <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
              <span>From: {getStageDisplayName(transitionResult.fromStage)}</span>
              {transitionResult.nextStage && <span>To: {getStageDisplayName(transitionResult.nextStage)}</span>}
              <span>Result: success</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-blue-700">
              <Timer className="w-3.5 h-3.5" />
              <span className="data-value font-medium">{Math.floor(undoCountdown / 60)}:{String(undoCountdown % 60).padStart(2, "0")}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              className="text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-100"
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

        <TabsContent value="audit">
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
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.action === "advanced" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="outline" className="text-[10px] shrink-0">{getStageDisplayName(entry.fromStage)}</Badge>
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <Badge variant={entry.action === "advanced" ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {getStageDisplayName(entry.toStage)}
                        </Badge>
                        {entry.action === "reverted" && (
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                            <Undo2 className="w-2.5 h-2.5 mr-0.5" />Reverted
                          </Badge>
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
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium">{entry.userName}</span><span className="text-xs text-muted-foreground">{entry.action}</span></div><p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p></div>
                  <span className="text-[10px] text-muted-foreground data-value shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {wsAudit.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No audit entries</div>}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
