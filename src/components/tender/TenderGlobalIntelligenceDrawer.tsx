/**
 * TenderGlobalIntelligenceDrawer
 *
 * Right-side sliding drawer for tender-wide intelligence that spans all stages.
 * Uses the same dark header + inner-tab architecture as stage task components.
 *
 * Tabs:
 * 1. Activity & Audit — the tender's audit history (ONE deduplicated feed) + note capture
 * 2. Executive Cognition — deadline, GP, and honestly-labelled readiness tiles
 * 3. Stage Intelligence — per-stage checks derived from the keys the stages actually store
 * 4. Customer Link — customer identity context
 *
 * TCW-T4 honesty contract for this file:
 *  - F5: `ws.activityEvents` and `ws.auditEntries` are two projections of the
 *    SAME `commercial_ticket_audit` rows. The timeline consumes ONE of them
 *    (the audit projection, which carries before/after) — every stored row
 *    appears once and every counter counts the real row set.
 *  - B13/B14: readiness tiles derive from real inputs or say "Not measured";
 *    the compliance signal states "nothing recorded" instead of a green
 *    "Ready" over an empty register.
 *  - B15/B16: stage checks derive from the keys the writers actually store
 *    (solution_design_data.configuration/hop/ham/hip/scope_matrix/sla_kpi,
 *    pricing sections, per-block review statuses, canonical-with-legacy
 *    approval matrix via projectTenderStageTruth) — no hardcoded `false`.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, ArrowRightLeft, BarChart3, Building2, CheckCircle2 as CheckStage,
  Clock, Layers, MessageSquare, MinusCircle, Pencil, Plus, TrendingUp, X, ZapOff,
} from "lucide-react";
import { toast } from "sonner";
import type { TenderAuditEntry, TenderWorkspace } from "@/lib/tender-workspace-data";
import { getTenderLocalCustomerLink, type TenderLocalCustomerLink } from "@/lib/tender-local-intelligence";
import { createActivityNote } from "@/lib/supabase-tender-actions";
import { normalizeTenderPricingData } from "@/lib/tender-pricing-types";
import { isMeaningfulTenderValue } from "@/lib/proposal-block-foundation";
import { projectTenderStageTruth } from "@/lib/tender-stage-source-truth";
import { deriveDepartmentalReviewProgress } from "./FinalApprovedStage";

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
// TAB 1: ACTIVITY & AUDIT (single deduplicated feed — F5)
// ═══════════════════════════════════════════════════════════

export type AuditEntryKind = "note" | "stage_move" | "update";

/**
 * Pure classifier over the REAL stored fields (`action` = commercial_ticket_audit
 * .action, `eventCode`/`eventName` = field_changed). Exported for tests.
 */
export function classifyAuditEntryKind(entry: Pick<TenderAuditEntry, "action" | "eventCode" | "eventName">): AuditEntryKind {
  const code = (entry.eventCode ?? entry.eventName ?? "").toLowerCase();
  const action = (entry.action ?? "").toLowerCase();
  if (code === "note") return "note";
  if (action === "stage_changed" || code.includes("stage") || code.includes("phase")) return "stage_move";
  return "update";
}

/**
 * F5 — the drawer timeline. `ws.activityEvents` and `ws.auditEntries` are two
 * projections of the SAME audit rows (one deduplicated read in the data
 * layer), so the timeline consumes ONLY the audit projection: each stored row
 * appears exactly once and `Total` is the real row count. Exported for tests.
 */
export function buildDrawerTimeline(auditEntries: TenderAuditEntry[]): Array<TenderAuditEntry & { kind: AuditEntryKind }> {
  const rows = Array.isArray(auditEntries) ? auditEntries : [];
  return rows
    .map(entry => ({ ...entry, kind: classifyAuditEntryKind(entry) }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function formatAuditState(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

const KIND_META: Record<AuditEntryKind, { label: string; icon: ReactNode; badge: string }> = {
  note: { label: "Note", icon: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />, badge: "border-blue-200 text-blue-700" },
  stage_move: { label: "Stage Move", icon: <ArrowRightLeft className="w-3.5 h-3.5 text-[#075eea]" />, badge: "border-[#075eea]/30 text-[#075eea]" },
  update: { label: "Update", icon: <Pencil className="w-3.5 h-3.5 text-slate-400" />, badge: "border-slate-200 text-slate-600" },
};

function ActivityLogPanel({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const timeline = useMemo(() => buildDrawerTimeline(ws.auditEntries), [ws.auditEntries]);
  const filtered = useMemo(
    () => timeline.filter(e => kindFilter === "all" || e.kind === kindFilter),
    [timeline, kindFilter],
  );

  const noteCount = timeline.filter(e => e.kind === "note").length;
  const stageMoveCount = timeline.filter(e => e.kind === "stage_move").length;
  const updateCount = timeline.filter(e => e.kind === "update").length;

  async function handleAddNote() {
    if (!noteTitle.trim()) { toast.error("Title is required."); return; }
    setNoteSubmitting(true);
    const r = await createActivityNote(tenderId, noteTitle, noteDesc);
    setNoteSubmitting(false);
    // W04-C4: createActivityNote confirms the stored commercial_ticket_audit row
    // before reporting success; a failure keeps the typed note in the inputs.
    if (r.success) { setNoteTitle(""); setNoteDesc(""); toast.success("Note added.", { description: "Confirmed stored in commercial_ticket_audit." }); reload(); }
    else toast.error("Note was NOT saved.", { description: r.error, duration: 10000 });
  }

  return (
    <div className="space-y-3">
      {/* Summary — every counter counts the SAME single feed. */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono">{timeline.length}</p>
          <p className="text-[9px] text-muted-foreground">Total Rows</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono text-blue-600">{noteCount}</p>
          <p className="text-[9px] text-muted-foreground">Notes</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono text-[#075eea]">{stageMoveCount}</p>
          <p className="text-[9px] text-muted-foreground">Stage Moves</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center">
          <p className="text-base font-bold font-mono">{updateCount}</p>
          <p className="text-[9px] text-muted-foreground">Updates</p>
        </div>
      </div>

      {/* Filter — over the REAL stored kind, not fabricated category/severity
          constants (the old category/severity dropdowns filtered on mapper
          constants no stored row actually carries). */}
      <div className="flex items-center gap-2">
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[160px] text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All entries</SelectItem>
            <SelectItem value="note" className="text-xs">Notes</SelectItem>
            <SelectItem value="stage_move" className="text-xs">Stage moves</SelectItem>
            <SelectItem value="update" className="text-xs">Updates</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">{filtered.length} of {timeline.length} shown</span>
      </div>

      {/* Add note */}
      <div className="rounded-lg border border-dashed p-2.5 space-y-2">
        <input type="text" placeholder="Note title..." value={noteTitle} onChange={e => setNoteTitle(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5 bg-background" />
        <textarea placeholder="Description (optional)..." value={noteDesc} onChange={e => setNoteDesc(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5 bg-background min-h-[40px] resize-none" />
        <Button size="sm" className="h-7 text-xs gap-1" disabled={noteSubmitting} onClick={handleAddNote}>
          <Plus className="w-3 h-3" /> Add Note
        </Button>
      </div>

      {/* Timeline — one entry per stored audit row. */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {timeline.length === 0 ? "No audit rows stored for this tender yet." : "No entries match the current filter."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className={`rounded-lg border p-2.5 ${e.kind === "stage_move" ? "border-[#075eea]/20 bg-[#075eea]/[0.03]" : ""}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{KIND_META[e.kind].icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{e.eventName || e.action}</p>
                  {e.details && <p className="text-[10px] text-muted-foreground mt-0.5">{e.details}</p>}
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
                    <span>{e.userName || "(no actor recorded)"}</span>
                    <span>·</span>
                    <span>{new Date(e.timestamp).toLocaleString()}</span>
                    <Badge variant="outline" className={`text-[8px] ml-1 ${KIND_META[e.kind].badge}`}>
                      {KIND_META[e.kind].label}
                    </Badge>
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
// TAB 2: EXECUTIVE COGNITION
// ═══════════════════════════════════════════════════════════

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
  const deadlineRisk = deadlineColor(daysLeft);
  // B14: readinessScore is a mean over pack readiness — with no packs
  // configured there is NOTHING to measure, which must never render as a red
  // "0% / Action Required" verdict.
  const packsConfigured = ws.packs.length > 0;
  const readinessPct = ws.readinessScore;
  const readinessColor = gaugeColor(readinessPct, [80, 50]);

  const docsReady = ws.packs.reduce((s, p) => s + p.documentsReady, 0);
  const docsTotal = ws.packs.reduce((s, p) => s + p.documentsTotal, 0);
  const placeholderTotal = ws.packs.reduce((s, p) => s + p.placeholdersTotal, 0);
  const placeholderPopulated = ws.packs.reduce((s, p) => s + p.placeholdersPopulated, 0);
  const total = docsTotal + placeholderTotal;
  const ready = docsReady + placeholderPopulated;
  const submissionPct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const submissionColor = gaugeColor(submissionPct, [80, 50]);
  // B13: an EMPTY compliance register carries no verdict — "Ready" is only
  // honest when compliance items are recorded and none signals a gap.
  const complianceRecorded = ws.complianceItems.length > 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Tender Readiness */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Tender Readiness</span>
        </div>
        {packsConfigured ? (
          <>
            <div className="flex items-end justify-between">
              <div className="flex-1 mr-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <div className={`h-2 rounded-full ${readinessPct >= 80 ? "bg-emerald-500" : readinessPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${readinessPct}%` }} />
                </div>
              </div>
              <span className={`text-sm font-bold font-mono ${readinessColor}`}>{readinessPct}%</span>
            </div>
            <span className={`text-[9px] ${readinessColor}`}>{readinessPct >= 80 ? "On Track" : readinessPct >= 50 ? "In Progress" : "Action Required"}</span>
          </>
        ) : (
          <>
            <span className="text-sm font-bold font-mono text-slate-400">—</span>
            <span className="text-[9px] text-muted-foreground">Not measured (no packs configured)</span>
          </>
        )}
      </div>

      {/* Deadline */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Deadline</span>
        </div>
        <div className="flex items-end justify-between">
          {/* TCW-AUD fix (defect 2): no captured deadline (NaN) renders an
              honest "Not set" — never a fabricated "Overdue" verdict. */}
          <span className={`text-sm font-bold font-mono ${Number.isNaN(daysLeft) ? "text-muted-foreground" : deadlineRisk}`}>
            {Number.isNaN(daysLeft) ? "Not set" : daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Today" : "Overdue"}
          </span>
          <Clock className={`w-4 h-4 ${Number.isNaN(daysLeft) ? "text-muted-foreground" : deadlineRisk}`} />
        </div>
        <span className={`text-[9px] ${Number.isNaN(daysLeft) ? "text-muted-foreground" : deadlineRisk}`}>
          {Number.isNaN(daysLeft) ? "No deadline recorded" : daysLeft > 14 ? "On Track" : daysLeft > 0 ? "Urgent" : "Overdue"}
        </span>
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

      {/* Submission signals */}
      <div className="rounded-lg border p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <ZapOff className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Submission</span>
        </div>
        {total > 0 ? (
          <div className="flex items-end justify-between">
            <div className="flex-1 mr-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div className={`h-2 rounded-full ${submissionPct >= 80 ? "bg-emerald-500" : submissionPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${submissionPct}%` }} />
              </div>
            </div>
            <span className={`text-sm font-bold font-mono ${submissionColor}`}>{submissionPct}%</span>
          </div>
        ) : (
          <span className="text-sm font-bold font-mono text-slate-400">—</span>
        )}
        {!complianceRecorded ? (
          <span className="text-[9px] text-muted-foreground">No compliance items recorded — no signal verdict</span>
        ) : (
          <span className={`text-[9px] ${signalCount > 3 ? "text-red-600" : signalCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {signalCount > 0 ? `${signalCount} compliance signal${signalCount === 1 ? "" : "s"}` : "No gap recorded in compliance register"}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: STAGE INTELLIGENCE (derived from real stored keys — B15/B16)
// ═══════════════════════════════════════════════════════════

export interface StageIntelligenceCheck {
  label: string;
  done: boolean;
}

export interface StageIntelligenceGroup {
  stage: string;
  checks: StageIntelligenceCheck[];
}

/**
 * Pure derivation over the tender's stored type_details — exported for tests.
 * Every check names the recorded fact it derives from; nothing is hardcoded.
 */
export function deriveStageIntelligenceChecks(t: any): StageIntelligenceGroup[] {
  const details = (t?.typeDetails ?? t?.type_details ?? {}) as Record<string, any>;
  const has = (v: unknown) => isMeaningfulTenderValue(v);

  const sowQualData = t?.sowQualificationData ?? {};
  const techQualData = t?.technicalQualificationData ?? {};
  const custFitData = t?.customerFitData ?? {};
  const riskData = t?.riskSnapshotData ?? {};
  const bidData = t?.bidNoBidData ?? {};
  const solData = t?.solutionDesignData ?? {};
  const pricing = normalizeTenderPricingData(t?.pricingData);
  const drafting = (t?.tenderDraftingData ?? {}) as Record<string, any>;
  const blocks: any[] = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];

  // Content-bearing drafting per volume (mirrors the volume tabs' filters and
  // the review tabs' >50-chars "drafted" rule).
  const drafted = (volumes: string[]) => blocks.some(b =>
    volumes.includes(b?.volume) && ((b?.content || b?.editor_content || b?.draft_content || "").trim().length > 50));

  // P6: departmental review truth from the per-block statuses that ARE written.
  const review = deriveDepartmentalReviewProgress(blocks);

  // Approval matrix: canonical type_details.approval_matrix with legacy
  // tender_drafting.approval_matrix fallback (projectTenderStageTruth rule).
  const stageTruth = projectTenderStageTruth(details);
  const approvals: any[] = Array.isArray((stageTruth.approval_matrix as any)?.approvals)
    ? (stageTruth.approval_matrix as any).approvals
    : [];
  const decided = approvals.filter(a => a?.decision === "approved" || a?.decision === "rejected").length;
  const pendingApprovals = approvals.filter(a => a?.decision !== "approved" && a?.decision !== "rejected").length;
  const allApproved = approvals.length > 0 && approvals.every(a => a?.decision === "approved");

  const approvedPricingStatus = String(pricing.approval.summary.approval_status ?? "");

  return [
    {
      stage: "Identified",
      checks: [
        { label: "Tender captured", done: has(t?.title) },
        { label: "Customer linked", done: has(t?.customerName) },
        { label: "Owner assigned", done: has(t?.assignedOwner) },
        { label: "Deadline set", done: has(t?.submissionDeadline) },
        { label: "Value estimated", done: Number(t?.estimatedValue) > 0 },
      ],
    },
    {
      stage: "Qualification",
      checks: [
        { label: "SOW qualified", done: has(sowQualData) },
        { label: "Technical fit assessed", done: has(techQualData) },
        { label: "Customer fit assessed", done: has(custFitData) },
        { label: "Risk snapshot recorded", done: has(riskData) },
      ],
    },
    {
      stage: "Bid / No-Bid",
      checks: [
        { label: "Bid decision recorded", done: has(bidData?.decision) },
        { label: "Win strategy documented", done: has(bidData?.win_strategy) },
        { label: "Resources committed", done: has(bidData?.resource_commitment) },
        { label: "Decision formally logged", done: has(bidData?.decision_record) },
      ],
    },
    {
      // B16: the writers store configuration/hop/ham/hip/scope_matrix/sla_kpi —
      // the old solution_configuration/hop_operations_model/... keys never
      // existed in the store.
      stage: "Solution Design",
      checks: [
        { label: "Solution configured", done: has(solData?.configuration) },
        { label: "Operations model set", done: has(solData?.hop) },
        { label: "Manpower model set", done: has(solData?.ham) },
        { label: "Systems model set", done: has(solData?.hip) },
        { label: "Scope matrix completed", done: has(solData?.scope_matrix) },
        { label: "SLA/KPI defined", done: has(solData?.sla_kpi) },
      ],
    },
    {
      // B15: derived from the pricing sections the tabs actually store.
      stage: "P&L Pricing",
      checks: [
        { label: "P&L snapshot recorded", done: has(pricing.pnl_snapshot.linked_pnl_record_id) || pricing.pnl_snapshot.snapshot_status !== "No Snapshot" },
        { label: "Pricing scenarios defined", done: pricing.scenarios.rows.length > 0 },
        { label: "Commercial terms set", done: has(pricing.commercial_terms) },
        { label: "Pricing approval recorded as approved", done: approvedPricingStatus.includes("Approved") },
      ],
    },
    {
      stage: "Tender Drafting",
      checks: [
        { label: "TOC defined", done: has(drafting.proposal_architecture) },
        { label: "Proposal blocks created", done: blocks.length > 0 },
        { label: "Technical volume content drafted", done: drafted(["Technical", "Shared"]) },
        { label: "Commercial volume content drafted", done: drafted(["Commercial", "Shared"]) },
      ],
    },
    {
      // B15/P6: real per-block review decisions, not hardcoded false / phantom
      // departmental_reviews facet.
      stage: "Internal Review",
      checks: [
        { label: "Ops review fully decided", done: review.fullyReviewed.includes("ops") },
        { label: "Finance review fully decided", done: review.fullyReviewed.includes("finance") },
        { label: "Legal review fully decided", done: review.fullyReviewed.includes("legal") },
        { label: "No rejected blocks outstanding", done: review.anyDecision && review.rejectedCount === 0 },
      ],
    },
    {
      // B15: canonical+legacy approval matrix; check labels state exactly what
      // is derivable from the stored decisions.
      stage: "Approval Matrix",
      checks: [
        { label: "Approval participants recorded", done: approvals.length > 0 },
        { label: "Decisions recorded", done: decided > 0 },
        { label: "No pending decisions", done: approvals.length > 0 && pendingApprovals === 0 },
        { label: "All participants approved", done: allApproved },
      ],
    },
  ];
}

function PreviousStagePanel({ ws }: { ws: TenderWorkspace }) {
  const groups = useMemo(() => deriveStageIntelligenceChecks(ws.tender), [ws.tender]);

  return (
    <div className="space-y-3">
      {groups.map(stage => {
        const completedCount = stage.checks.filter(c => c.done).length;
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
              {stage.checks.map(check => (
                <div key={check.label} className="flex items-center gap-1.5 text-[10px]">
                  {check.done ? (
                    <CheckStage className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <MinusCircle className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                  <span className={check.done ? "text-foreground" : "text-muted-foreground"}>{check.label}</span>
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
// TAB 4: CUSTOMER LINK
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
