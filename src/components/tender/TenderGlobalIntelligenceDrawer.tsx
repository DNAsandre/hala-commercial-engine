/**
 * TenderGlobalIntelligenceDrawer
 * 
 * Right-side sliding drawer for tender-wide intelligence that spans all stages.
 * Uses the same dark header + inner-tab architecture as stage task components.
 * 
 * Tabs:
 * 1. Activity Log — full tender audit timeline
 * 2. Audit Trail — formal audit entries (stage moves, saves, before/after)
 * 3. Executive Cognition — readiness, deadline, GP, signals
 * 4. Previous Stage Intelligence — cross-stage save status
 */
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, BarChart3, Layers, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TenderWorkspace } from "@/lib/tender-workspace-data";
import { getTenderLocalCustomerLink, type TenderLocalCustomerLink } from "@/lib/tender-local-intelligence";

// ═══════════════════════════════════════════════════════════
// INNER TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════

type IntelTabKey = "activity" | "cognition" | "prev_stage" | "customer_link";

const INTEL_TABS: { key: IntelTabKey; label: string; icon: ReactNode }[] = [
  { key: "activity", label: "Activity & Audit", icon: <Activity className="w-3.5 h-3.5" /> },
  { key: "cognition", label: "Executive Cognition", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "prev_stage", label: "Stage Intelligence", icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "customer_link", label: "Customer Link", icon: <Building2 className="w-3.5 h-3.5" /> },
];

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
  /** Pre-computed values from parent */
  daysLeft: number;
  targetGp: number;
  signalCount: number;
}

export default function TenderGlobalIntelligenceDrawer({
  open, onOpenChange, ws, tenderId, reload,
  daysLeft, targetGp, signalCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<IntelTabKey>("activity");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] gap-0 overflow-hidden p-0 sm:max-w-[520px] [&>button]:hidden">
        {/* Accessible title (visually hidden) */}
        <SheetTitle className="sr-only">Tender Global Intelligence</SheetTitle>
        <SheetDescription className="sr-only">Global intelligence across all tender stages</SheetDescription>

        {/* Full-height flex container */}
        <div className="flex h-full flex-col">
          {/* ── Dark Header (fixed, never scrolls) ──────────── */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Tender Global Intelligence
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                All Stages
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-3.5 h-3.5" />
              Close
            </Button>
          </div>

          {/* ── Inner Tab Bar (fixed, never scrolls) ─────────── */}
          <div className="shrink-0 flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {INTEL_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-16 min-w-[118px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
                  activeTab === tab.key
                    ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
                    : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
                }`}
              >
                <span className={`mb-1 flex justify-center ${activeTab === tab.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{tab.icon}</span>
                <span className="block whitespace-normal text-center">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab Content (this is the ONLY scrollable area) ── */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {activeTab === "activity" && <ActivityLogPanel ws={ws} tenderId={tenderId} reload={reload} />}
            {activeTab === "cognition" && <CognitionPanel ws={ws} daysLeft={daysLeft} targetGp={targetGp} signalCount={signalCount} />}
            {activeTab === "prev_stage" && <PreviousStagePanel ws={ws} />}
            {activeTab === "customer_link" && <CustomerLinkPanel ws={ws} />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: ACTIVITY LOG
// ═══════════════════════════════════════════════════════════

import { createActivityNote } from "@/lib/supabase-tender-actions";
import {
  ACTIVITY_CATEGORIES,
  SEVERITY_OPTIONS,
  getSeverityColor,
  getActivityCategoryLabel,
  type ActivityCategory,
  type EventSeverity,
} from "@/lib/tender-workspace-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, CheckCircle2, Info, Plus, Database } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

function severityIcon(s?: EventSeverity) {
  if (s === "critical") return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
  if (s === "high") return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
  if (s === "warning") return <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
}

function formatAuditState(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

function ActivityLogPanel({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [catFilter, setCatFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Merge activity events + audit entries into one unified timeline
  type UnifiedEntry = { type: "activity" | "audit"; id: string; timestamp: string; title: string; description?: string; userName?: string; category?: string; severity?: string; beforeState?: unknown; afterState?: unknown };

  const unified = useMemo(() => {
    const activityItems: UnifiedEntry[] = ws.activityEvents.map(e => ({
      type: "activity" as const, id: e.id, timestamp: e.timestamp,
      title: e.title || e.eventType, description: e.description,
      userName: e.userName, category: e.category, severity: e.severity,
    }));
    const auditItems: UnifiedEntry[] = ws.auditEntries.map(e => ({
      type: "audit" as const, id: `audit-${e.id}`, timestamp: e.timestamp,
      title: e.eventName || e.action, description: e.details,
      userName: e.userName, category: e.category,
      beforeState: e.beforeState, afterState: e.afterState,
    }));
    return [...activityItems, ...auditItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [ws.activityEvents, ws.auditEntries]);

  const filtered = useMemo(() => unified.filter(e => {
    if (catFilter !== "all" && e.category !== catFilter) return false;
    if (sevFilter !== "all" && e.severity !== sevFilter) return false;
    return true;
  }), [unified, catFilter, sevFilter]);

  const warningCount = ws.activityEvents.filter(e => e.severity === "warning").length;
  const highCritCount = ws.activityEvents.filter(e => e.severity === "high" || e.severity === "critical").length;

  async function handleAddNote() {
    if (!noteTitle.trim()) { toast.error("Title is required."); return; }
    setNoteSubmitting(true);
    const r = await createActivityNote(tenderId, noteTitle, noteDesc);
    setNoteSubmitting(false);
    if (r.success) { setNoteTitle(""); setNoteDesc(""); toast.success("Note added."); reload(); }
    else toast.error("Failed to add note.", { description: r.error });
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono">{unified.length}</p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono">{ws.auditEntries.length}</p>
          <p className="text-[9px] text-muted-foreground">Audit</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono text-amber-600">{warningCount}</p>
          <p className="text-[9px] text-muted-foreground">Warnings</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono text-red-600">{highCritCount}</p>
          <p className="text-[9px] text-muted-foreground">High / Crit</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[140px] text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{ACTIVITY_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-[120px] text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{SEVERITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Add note */}
      <div className="rounded-lg border border-dashed p-2.5 space-y-2">
        <input type="text" placeholder="Note title..." value={noteTitle} onChange={e => setNoteTitle(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5 bg-background" />
        <textarea placeholder="Description (optional)..." value={noteDesc} onChange={e => setNoteDesc(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5 bg-background min-h-[40px] resize-none" />
        <Button size="sm" className="h-7 text-xs gap-1" disabled={noteSubmitting} onClick={handleAddNote}>
          <Plus className="w-3 h-3" /> Add Note
        </Button>
      </div>

      {/* Unified timeline */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No events found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className={`rounded-lg border p-2.5 ${e.type === "audit" ? "border-[#075eea]/20 bg-[#075eea]/[0.03]" : ""}`}>
              <div className="flex items-start gap-2">
                {e.type === "audit"
                  ? <Clock className="w-3.5 h-3.5 text-[#075eea] mt-0.5 shrink-0" />
                  : severityIcon(e.severity as any)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{e.title}</p>
                  {e.description && <p className="text-[10px] text-muted-foreground mt-0.5">{e.description}</p>}
                  {e.beforeState !== undefined && e.beforeState !== null && (
                    <div className="mt-1 p-1.5 rounded bg-red-50 border border-red-100">
                      <p className="text-[9px] text-red-700"><strong>Before:</strong> {formatAuditState(e.beforeState)}</p>
                    </div>
                  )}
                  {e.afterState !== undefined && e.afterState !== null && (
                    <div className="mt-1 p-1.5 rounded bg-emerald-50 border border-emerald-100">
                      <p className="text-[9px] text-emerald-700"><strong>After:</strong> {formatAuditState(e.afterState)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                    <span>{e.userName || "System"}</span>
                    <span>·</span>
                    <span>{new Date(e.timestamp).toLocaleString()}</span>
                    <Badge variant="outline" className={`text-[8px] ml-1 ${e.type === "audit" ? "border-[#075eea]/30 text-[#075eea]" : ""}`}>
                      {e.type === "audit" ? "Audit" : (e.category ? getActivityCategoryLabel(e.category as any) : "Activity")}
                    </Badge>
                    {e.severity && <Badge variant="outline" className={`text-[8px] ${getSeverityColor(e.severity as any)}`}>{e.severity}</Badge>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// ═══════════════════════════════════════════════════════════
// TAB 3: EXECUTIVE COGNITION
// ═══════════════════════════════════════════════════════════

import { TrendingUp, ZapOff } from "lucide-react";

function gaugeColor(pct: number, thresholds: [number, number]) {
  if (pct >= thresholds[0]) return "text-emerald-600";
  if (pct >= thresholds[1]) return "text-amber-600";
  return "text-red-600";
}

function deadlineColor(days: number) {
  if (days > 14) return "text-emerald-600";
  if (days > 0) return "text-amber-600";
  return "text-red-600";
}

function CognitionPanel({ ws, daysLeft, targetGp, signalCount }: { ws: TenderWorkspace; daysLeft: number; targetGp: number; signalCount: number }) {
  const readinessPct = ws.readinessScore;
  const readinessColor = gaugeColor(readinessPct, [80, 50]);
  const deadlineRisk = deadlineColor(daysLeft);
  const docsReady = ws.packs.reduce((s, p) => s + p.documentsReady, 0);
  const docsTotal = ws.packs.reduce((s, p) => s + p.documentsTotal, 0);
  const placeholderTotal = ws.packs.reduce((s, p) => s + p.placeholdersTotal, 0);
  const placeholderPopulated = ws.packs.reduce((s, p) => s + p.placeholdersPopulated, 0);
  const total = docsTotal + placeholderTotal;
  const ready = docsReady + placeholderPopulated;
  const submissionPct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const submissionColor = gaugeColor(submissionPct, [80, 50]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Tender Readiness */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Tender Readiness</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div className={`h-2 rounded-full ${readinessPct >= 80 ? "bg-emerald-500" : readinessPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${readinessPct}%` }} />
            </div>
          </div>
          <span className={`text-sm font-bold font-mono ${readinessColor}`}>{readinessPct}%</span>
        </div>
        <span className={`text-[9px] ${readinessColor}`}>{readinessPct >= 80 ? "On Track" : readinessPct >= 50 ? "In Progress" : "Action Required"}</span>
      </div>

      {/* Deadline */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Deadline</span>
        </div>
        <div className="flex items-end justify-between">
          <span className={`text-sm font-bold font-mono ${deadlineRisk}`}>
            {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Today" : "Overdue"}
          </span>
          <Clock className={`w-4 h-4 ${deadlineRisk}`} />
        </div>
        <span className={`text-[9px] ${deadlineRisk}`}>{daysLeft > 14 ? "On Track" : daysLeft > 0 ? "Urgent" : "Overdue"}</span>
      </div>

      {/* Margin Health */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Margin Health</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div className={`h-2 rounded-full ${targetGp >= 25 ? "bg-emerald-500" : targetGp >= 18 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(targetGp, 40) / 40 * 100}%` }} />
            </div>
          </div>
          <span className={`text-sm font-bold font-mono ${gaugeColor(targetGp, [25, 18])}`}>{targetGp}%</span>
        </div>
        <span className={`text-[9px] ${gaugeColor(targetGp, [25, 18])}`}>{targetGp >= 25 ? "Healthy" : targetGp >= 18 ? "Tight" : "Review"}</span>
      </div>

      {/* Submission Readiness */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <ZapOff className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Submission</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div className={`h-2 rounded-full ${submissionPct >= 80 ? "bg-emerald-500" : submissionPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${submissionPct}%` }} />
            </div>
          </div>
          <span className={`text-sm font-bold font-mono ${submissionColor}`}>{submissionPct}%</span>
        </div>
        <span className={`text-[9px] ${signalCount > 3 ? "text-red-600" : signalCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
          {signalCount > 0 ? `${signalCount} signals` : "Ready"}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: PREVIOUS STAGE INTELLIGENCE
// ═══════════════════════════════════════════════════════════

import { CheckCircle2 as CheckStage, XCircle, MinusCircle } from "lucide-react";

const STAGE_INTELLIGENCE_ITEMS = [
  { stage: "Identified", checks: ["Tender captured", "Customer linked", "Owner assigned", "Deadline set", "Value estimated"] },
  { stage: "Qualification", checks: ["SOW qualified", "Technical fit assessed", "Customer fit scored", "Risk snapshot completed"] },
  { stage: "Bid / No-Bid", checks: ["Bid decision recorded", "Win strategy documented", "Resources committed", "Decision formally logged"] },
  { stage: "Solution Design", checks: ["Solution configured", "Operations model set", "Manpower model set", "Systems model set", "Scope matrix completed", "SLA/KPI defined"] },
  { stage: "P&L Pricing", checks: ["P&L calculated", "Pricing scenarios defined", "Commercial terms set", "Pricing approved"] },
  { stage: "Tender Drafting", checks: ["TOC defined", "Proposal blocks created", "Technical volume drafted", "Commercial volume drafted"] },
  { stage: "Internal Review", checks: ["Ops review done", "Finance review done", "Legal review done", "Exceptions cleared"] },
  { stage: "Approval Matrix", checks: ["Approvals collected", "Signoffs tracked", "Exceptions noted", "Governance logged"] },
];

function PreviousStagePanel({ ws }: { ws: TenderWorkspace }) {
  const t = ws.tender;
  const sowData = ((t as any).sowData || {}) as any;
  const bidData = ((t as any).bidNoBidData || {}) as any;
  const solData = ((t as any).solutionDesignData || {}) as any;
  const sowQualData = ((t as any).sowQualificationData || {}) as any;
  const techQualData = ((t as any).technicalQualificationData || {}) as any;
  const riskData = ((t as any).riskSnapshotData || {}) as any;
  const custFitData = ((t as any).customerFitData || {}) as any;

  // Simple heuristic checks per stage
  function hasValue(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return Number.isFinite(v);
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  }

  const stageChecks: Record<string, boolean[]> = {
    "Identified": [
      hasValue(t.title),
      hasValue(t.customerName),
      hasValue(t.assignedOwner),
      hasValue(t.submissionDeadline),
      hasValue(t.estimatedValue) && t.estimatedValue > 0,
    ],
    "Qualification": [
      hasValue(sowQualData) && Object.keys(sowQualData).length > 0,
      hasValue(techQualData) && Object.keys(techQualData).length > 0,
      hasValue(custFitData) && Object.keys(custFitData).length > 0,
      hasValue(riskData) && Object.keys(riskData).length > 0,
    ],
    "Bid / No-Bid": [
      hasValue(bidData?.decision),
      hasValue(bidData?.win_strategy),
      hasValue(bidData?.resource_commitment),
      hasValue(bidData?.decision_record),
    ],
    "Solution Design": [
      hasValue(solData?.solution_configuration),
      hasValue(solData?.hop_operations_model),
      hasValue(solData?.ham_manpower_model),
      hasValue(solData?.hip_systems_ip_model),
      hasValue(solData?.scope_matrix),
      hasValue(solData?.sla_kpi_model),
    ],
    "P&L Pricing": [
      hasValue((t as any).pricingData),
      false, false, false,
    ],
    "Tender Drafting": [
      hasValue(((t as any).tenderDraftingData as any)?.proposal_architecture),
      hasValue(((t as any).tenderDraftingData as any)?.proposal_blocks) && Array.isArray(((t as any).tenderDraftingData as any)?.proposal_blocks),
      false, false,
    ],
    "Internal Review": [false, false, false, false],
    "Approval Matrix": [false, false, false, false],
  };

  return (
    <div className="space-y-3">
      {STAGE_INTELLIGENCE_ITEMS.map(stage => {
        const checks = stageChecks[stage.stage] || stage.checks.map(() => false);
        const completedCount = checks.filter(Boolean).length;
        const totalCount = stage.checks.length;
        const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const color = pct >= 100 ? "border-emerald-200 bg-emerald-50/50" : pct > 0 ? "border-amber-200 bg-amber-50/30" : "border-border";

        return (
          <div key={stage.stage} className={`rounded-lg border p-3 ${color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">{stage.stage}</span>
              <Badge variant="outline" className={`text-[9px] ${pct >= 100 ? "border-emerald-300 text-emerald-700" : pct > 0 ? "border-amber-300 text-amber-700" : "text-muted-foreground"}`}>
                {completedCount}/{totalCount}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
              <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-1">
              {stage.checks.map((check, i) => (
                <div key={check} className="flex items-center gap-1.5 text-[10px]">
                  {checks[i] ? (
                    <CheckStage className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <MinusCircle className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                  <span className={checks[i] ? "text-foreground" : "text-muted-foreground"}>{check}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 5: CUSTOMER LINK
// ═══════════════════════════════════════════════════════════

function CustomerLinkPanel({ ws }: { ws: TenderWorkspace }) {
  const customerLink = getTenderLocalCustomerLink(ws);

  const matchCls: Record<TenderLocalCustomerLink["matchStatus"], string> = {
    tender_record: "border-emerald-200 bg-emerald-50 text-emerald-700",
    customer_name: "border-blue-200 bg-blue-50 text-blue-700",
    unmatched: "border-zinc-200 bg-zinc-50 text-zinc-500",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-4 h-4 text-[#075eea]" />
        <span className="text-xs font-semibold">Customer Link Intelligence</span>
        <Badge variant="outline" className="border-[#244f96]/40 bg-[#075eea]/10 text-[#075eea] text-[9px]">TND-002</Badge>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Current tender customer identity and source context. Read-only for tender workflow traceability.
      </p>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] font-medium ${matchCls[customerLink.matchStatus]}`}>
            {customerLink.matchStatusLabel}
          </Badge>
          <span className="text-xs font-semibold">{customerLink.tenderCustomerName}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-muted-foreground">Customer ID</span>
            <p className="font-medium font-mono">{customerLink.tenderCustomerId || "Not stored"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Confidence Tier</span>
            <p className="font-medium">T{customerLink.confidenceTier}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Source</span>
            <p className="font-medium">{customerLink.source}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Region</span>
            <p className="font-medium">{customerLink.region}</p>
          </div>
        </div>

        <div className="pt-1 border-t border-border text-[10px] text-muted-foreground">
          {customerLink.matchConfidence}
        </div>
      </div>
    </div>
  );
}
