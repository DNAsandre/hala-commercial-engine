/**
 * FinalApprovedStage — Stage 9: All internal approvals complete. Ready for submission.
 *
 * 4 Tabs (each with Qualification-pattern section tabs):
 *  1. Submission Readiness — sections: Stage Checklist, Readiness Signals
 *  2. Final Pack — sections: Approval Check Bot, Final Pack Assembly, Block Register
 *  3. Submission Checklist — sections: Required Documents
 *  4. Approval Record — sections: Final Approval, Approval Context, Sign-off Log, Human Control
 *
 * DATA SOURCE: ONLY from this tender's own type_details and workspace data in Supabase.
 * Missing data shows "Not captured yet". NO guessing. NO hardcoded fake data.
 *
 * Old document-generation tooling is discontinued. Final Pack is readiness-only.
 * AI cannot approve, sign, override, export, or delete. Advisory only.
 */
import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { cleanHref } from "@/lib/clean-routing";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, FileText,
  Loader2, Layers, BarChart3, ClipboardCheck,
  Clock, TrendingUp, Info, RefreshCw, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
// SC-01 Wave 02 boundary (deferred to Sprint X - SX-001/SX-011): AI generation is excluded.
function generateAIUnavailable(): { content: string; tokensInput: number; tokensOutput: number } {
  throw new Error("Final Approval AI check is not available in this build (deferred to Sprint X - SX-001/SX-011).");
}
import { supabase } from "@/lib/supabase";
import { updateTenderDraftingData, updateTenderFinalApprovedData } from "@/lib/supabase-tender-actions";
import { getCurrentUser } from "@/lib/auth-state";
import { normalizeSubmissionReadinessFacet } from "@/lib/tender-source-record";
import { countByStatus, DEPARTMENT_LABELS, DEPARTMENT_VOLUMES, type ReviewDepartment } from "@/lib/internal-review-types";
import { reportSaveOutcome, saveTenderSectionWithOutcome, wsRevisionToken } from "./tender-save-outcome";

// ─── Props ──────────────────────────────────────────────────

interface Props {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

// ─── Required documents — recorded register only (TCW-T4 B17/B18/F4) ───
//
// The previous build rendered a hardcoded 14-item document list here and
// marked rows "Uploaded" when any uploaded document name contained the FIRST
// WORD of the requirement — a fabricated requirement set with fuzzy verdicts.
// The checklist now derives ONLY from the tender's recorded
// `type_details.submission_readiness.required_documents` register (the same
// rows `bundle.submissionReadiness.facet.required_documents` projects — both
// read the identical canonical facet on the tender row). No recorded register
// ⇒ an honest "no requirement set recorded" state, never a substitute list.

interface RequiredDocumentRegisterRow {
  id: string;
  document_name: string;
  status: string;
  linked_document_id?: string;
  owner?: string;
  due_date?: string;
  notes?: string;
}

export interface SubmissionChecklistRow extends RequiredDocumentRegisterRow {
  /** True when the recorded row is accounted for (see satisfiedBy). */
  satisfied: boolean;
  /**
   * How the requirement is satisfied:
   *  - 'status': the register itself records uploaded/approved
   *  - 'linked_document': linked_document_id matches an uploaded document id
   *  - 'name_match': the FULL recorded name appears in an uploaded document
   *    name (never a first-word/prefix match)
   */
  satisfiedBy: "status" | "linked_document" | "name_match" | null;
}

export interface SubmissionChecklistSummary {
  /** False ⇒ nothing recorded; render the honest empty state, no counts. */
  recorded: boolean;
  rows: SubmissionChecklistRow[];
  /** Rows counted toward completion (recorded rows minus 'na'). */
  required: number;
  satisfied: number;
  missing: number;
}

/** Reads the recorded required-documents register from the tender row's type_details. */
export function readRequiredDocumentsRegister(details: Record<string, any>): RequiredDocumentRegisterRow[] {
  const facet = normalizeSubmissionReadinessFacet(details?.submission_readiness);
  return facet.required_documents as unknown as RequiredDocumentRegisterRow[];
}

/**
 * TCW-T4 (B18): register-driven checklist. Matching is exact-id
 * (linked_document_id) or FULL-name containment — the entire recorded name
 * must appear in the uploaded document's name. First-word fuzzy matching is
 * deliberately not implemented (guard test re-introduces it to prove the
 * suite catches it).
 */
export function buildSubmissionChecklist(
  registerRows: RequiredDocumentRegisterRow[],
  uploadedDocuments: Array<{ id: string; document_name: string }>,
): SubmissionChecklistSummary {
  const rows = Array.isArray(registerRows) ? registerRows : [];
  if (rows.length === 0) {
    return { recorded: false, rows: [], required: 0, satisfied: 0, missing: 0 };
  }

  const uploadedIds = new Set(uploadedDocuments.map(d => d.id).filter(Boolean));
  const uploadedNames = uploadedDocuments
    .map(d => (d.document_name ?? "").toLowerCase().trim())
    .filter(Boolean);

  const checklist: SubmissionChecklistRow[] = rows.map(row => {
    let satisfiedBy: SubmissionChecklistRow["satisfiedBy"] = null;
    if (row.status === "uploaded" || row.status === "approved") {
      satisfiedBy = "status";
    } else if (row.linked_document_id && uploadedIds.has(row.linked_document_id)) {
      satisfiedBy = "linked_document";
    } else {
      const name = (row.document_name ?? "").toLowerCase().trim();
      if (name.length > 0 && uploadedNames.some(n => n.includes(name))) {
        satisfiedBy = "name_match";
      }
    }
    return { ...row, satisfied: satisfiedBy !== null, satisfiedBy };
  });

  // 'na' rows are declared not applicable — outside both counters (P1).
  const applicable = checklist.filter(row => row.status !== "na");
  const satisfied = applicable.filter(row => row.satisfied).length;
  return {
    recorded: true,
    rows: checklist,
    required: applicable.length,
    satisfied,
    // Never negative: the denominator is the recorded set itself.
    missing: Math.max(0, applicable.length - satisfied),
  };
}

// ─── Departmental review truth (TCW-T4 / P6) ────────────────
//
// `tender_drafting.departmental_reviews` is an ORPHAN facet: no code path has
// ever written it, so every reader that checked it ("departments reviewed")
// was permanently false. The data that actually exists is the per-block
// `<dept>_status` review fields written by updateBlockReviewStatus. This
// derivation reads THOSE, and is shared by the Stage-9 checklist, the global
// intelligence drawer and PreviousStageIntelligence. No new writer is
// invented.

export interface DepartmentalReviewProgress {
  /** Departments whose relevant blocks all carry a decision (none Pending). */
  fullyReviewed: ReviewDepartment[];
  fullyReviewedLabels: string[];
  /** True when at least one review decision is recorded anywhere. */
  anyDecision: boolean;
  /** Count of (block, department) pairs currently Rejected. */
  rejectedCount: number;
  /** True when there are blocks to review at all. */
  hasBlocks: boolean;
}

export function deriveDepartmentalReviewProgress(blocksRaw: unknown): DepartmentalReviewProgress {
  const blocks = Array.isArray(blocksRaw) ? blocksRaw : [];
  const departments: ReviewDepartment[] = ["ops", "finance", "legal"];
  const fullyReviewed: ReviewDepartment[] = [];
  let anyDecision = false;
  let rejectedCount = 0;
  for (const dept of departments) {
    const stats = countByStatus(blocks, dept, DEPARTMENT_VOLUMES[dept]);
    if (stats.approved + stats.rejected > 0) anyDecision = true;
    rejectedCount += stats.rejected;
    if (stats.total > 0 && stats.pending === 0) fullyReviewed.push(dept);
  }
  return {
    fullyReviewed,
    fullyReviewedLabels: fullyReviewed.map(dept => DEPARTMENT_LABELS[dept]),
    anyDecision,
    rejectedCount,
    hasBlocks: blocks.length > 0,
  };
}

// ─── Stage checklist derivation ─────────────────────────────

interface StageCheck {
  stage: string;
  label: string;
  complete: boolean;
  detail: string;
}

interface FinalApprovalRecord {
  decision: "pending" | "approved" | "not_approved";
  approved_by: string;
  approved_at: string;
  reference: string;
  notes: string;
}

/**
 * P4 (F2) — pure payload builder for the final approval record, exported for
 * the actor-truth test: `recorded_by` is exactly the SESSION user name passed
 * in (auth-state mirror), never the fabricated literal "Current User".
 */
export function buildFinalApprovalRecordPayload(
  record: { decision: string; approved_by: string; approved_at: string; reference: string; notes: string },
  recordedByName: string,
  recordedAtIso: string = new Date().toISOString(),
): Record<string, unknown> {
  return {
    ...record,
    approved_at: record.approved_at ? new Date(record.approved_at).toISOString() : "",
    recorded_at: recordedAtIso,
    recorded_by: recordedByName,
  };
}

function tenderDetails(t: any): Record<string, any> {
  const details = t.typeDetails ?? t.type_details;
  return details && typeof details === "object" && !Array.isArray(details) ? details : {};
}

function approvalMatrixFor(t: any): Record<string, any> {
  const details = tenderDetails(t);
  const canonical = details.approval_matrix;
  if (canonical && typeof canonical === "object" && !Array.isArray(canonical) && Object.keys(canonical).length > 0) return canonical;
  const legacy = t.tenderDraftingData?.approval_matrix;
  return legacy && typeof legacy === "object" && !Array.isArray(legacy) ? legacy : {};
}

function deriveStageChecklist(t: any, ws: TenderWorkspace): StageCheck[] {
  const checks: StageCheck[] = [];
  const td = t.tenderDraftingData ?? {};

  const hasQual = !!(t.sowQualificationData || t.technicalQualificationData || t.customerFitData);
  checks.push({
    stage: "qualification", label: "Qualification", complete: hasQual,
    detail: hasQual
      ? [t.sowQualificationData && "SOW", t.technicalQualificationData && "Technical", t.customerFitData && "Customer Fit"].filter(Boolean).join(", ")
      : "Not captured yet",
  });

  const bnd = t.bidNoBidData;
  const decision = bnd?.decision?.decision || bnd?.decision;
  const hasBid = !!decision && decision !== "Not Decided" && decision !== "not_decided";
  checks.push({
    stage: "bid_no_bid", label: "Bid / No-Bid", complete: hasBid,
    detail: hasBid ? `Decision: ${typeof decision === "string" ? decision : "Recorded"}` : "Not decided yet",
  });

  const sd = t.solutionDesignData;
  const hasSd = !!(sd && typeof sd === "object" && Object.keys(sd).length > 0);
  const sdModels = hasSd ? Object.keys(sd).filter(k => sd[k] && typeof sd[k] === "object" && Object.keys(sd[k]).length > 0).length : 0;
  checks.push({
    stage: "solution_design", label: "Solution Design", complete: hasSd,
    detail: hasSd ? `${sdModels} model${sdModels !== 1 ? "s" : ""} populated` : "Not captured yet",
  });

  const pricing = t.pricingData;
  const scenarios = Array.isArray(pricing?.scenarios) ? pricing.scenarios : [];
  const hasPricing = scenarios.length > 0 || !!(pricing?.summary);
  const gpVal = pricing?.summary?.lowest_gp_percent ?? t.targetGpPercent;
  checks.push({
    stage: "pnl_pricing", label: "P&L / Pricing", complete: hasPricing,
    detail: hasPricing
      ? `${scenarios.length} scenario${scenarios.length !== 1 ? "s" : ""}${gpVal ? `, GP ${Number(gpVal).toFixed(1)}%` : ""}`
      : "Not captured yet",
  });

  const blocks: any[] = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];
  const blocksApproved = blocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length;
  checks.push({
    stage: "tender_drafting", label: "Tender Drafting", complete: blocks.length > 0,
    detail: blocks.length > 0 ? `${blocks.length} blocks, ${blocksApproved} approved` : "No blocks drafted yet",
  });

  // TCW-T4 (P6): derived from the per-block `<dept>_status` review decisions
  // that DepartmentalReviewTab actually persists — never from the orphan
  // `tender_drafting.departmental_reviews` facet nothing writes.
  const reviewProgress = deriveDepartmentalReviewProgress(blocks);
  checks.push({
    stage: "internal_review", label: "Internal Review", complete: reviewProgress.fullyReviewed.length === 3,
    detail: reviewProgress.fullyReviewed.length > 0
      ? `${reviewProgress.fullyReviewed.length}/3 departments fully reviewed (${reviewProgress.fullyReviewedLabels.join(", ")})${reviewProgress.rejectedCount > 0 ? `, ${reviewProgress.rejectedCount} rejected` : ""}`
      : reviewProgress.anyDecision
        ? `Review in progress${reviewProgress.rejectedCount > 0 ? ` — ${reviewProgress.rejectedCount} rejected` : ""}`
        : "No department review decisions recorded yet",
  });

  const matrix = approvalMatrixFor(t);
  const approvals: any[] = Array.isArray(matrix?.approvals) ? matrix.approvals : [];
  const approved = approvals.filter((a: any) => a.decision === "approved").length;
  const rejected = approvals.filter((a: any) => a.decision === "rejected").length;
  const allApproved = approvals.length > 0 && rejected === 0 && approved === approvals.length;
  checks.push({
    stage: "approval_matrix", label: "Approval Matrix", complete: allApproved,
    detail: approvals.length > 0
      ? `${approved}/${approvals.length} approved${rejected > 0 ? `, ${rejected} rejected` : ""}`
      : "No approvals recorded yet",
  });

  return checks;
}

// ─── Stage Menu Header (reusable) ────────────────────────

function StageMenuHeader<T extends string>({
  sections, activeSection, setActiveSection, stageIntelOpen, setStageIntelOpen, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved, unsaved,
}: {
  sections: TenderStageSectionTab<T>[];
  activeSection: T;
  setActiveSection: (section: T) => void;
  stageIntelOpen: boolean;
  setStageIntelOpen: (fn: (prev: boolean) => boolean) => void;
  intelMetrics: TenderStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  saved?: boolean;
  unsaved?: boolean;
}) {
  return (
    <TenderStageTaskShell
      stageTitle="Final Approved Stage Menu"
      stageBadge="Stage 9"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={sections}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={(open) => setStageIntelOpen(() => open)}
      metrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
      unsaved={unsaved}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: SUBMISSION READINESS
// ═══════════════════════════════════════════════════════════

type ReadinessSection = "checklist" | "signals";
const READINESS_SECTIONS: { key: ReadinessSection; label: string; icon: ReactNode }[] = [
  { key: "checklist", label: "Stage Checklist", icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  { key: "signals", label: "Readiness Signals", icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

function SubmissionReadinessTab({ ws, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void }) {
  const t = ws.tender as any;
  const checks = useMemo(() => deriveStageChecklist(t, ws), [t, ws]);
  const completedCount = checks.filter(c => c.complete).length;
  const pct = checks.length > 0 ? Math.round((completedCount / checks.length) * 100) : 0;
  const [activeSection, setActiveSection] = useState<ReadinessSection>("checklist");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const complianceTotal = ws.complianceItems.length;
  const complianceCompliant = ws.complianceItems.filter(c => c.status === "compliant").length;
  const complianceGaps = ws.complianceItems.filter(c => c.status === "non_compliant" || c.status === "clarification_required").length;
  const docsTotal = ws.packs.reduce((s, p) => s + p.documentsTotal, 0);
  const docsReady = ws.packs.reduce((s, p) => s + p.documentsReady, 0);

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B9): read-only projection of stored stage data — nothing on
          this tab can hold unsaved edits, so "Saved" (view ≡ store) is the
          truthful constant, not a fabricated save event. */}
      <StageMenuHeader sections={READINESS_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      {/* ── 1. Stage Checklist ── */}
      <div className={activeSection !== "checklist" ? "hidden" : "space-y-4"}>
        <Card className="border-border shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {(() => {
                const circ = 2 * Math.PI * 26;
                const allDone = pct === 100;
                return (
                  <div className={`flex flex-col items-center justify-center p-2 rounded-lg border min-w-[80px] ${allDone ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200" />
                      <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5"
                        className={allDone ? "stroke-emerald-500" : pct > 0 ? "stroke-blue-500" : "stroke-slate-300"}
                        strokeDasharray={`${circ}`} strokeDashoffset={`${circ - (pct / 100) * circ}`}
                        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }} />
                    </svg>
                    <span className={`text-lg font-bold -mt-11 ${allDone ? "text-emerald-600" : "text-slate-700"}`}>{pct}%</span>
                    <span className="text-[8px] text-muted-foreground mt-5">Readiness</span>
                  </div>
                );
              })()}
              <div className="flex-1">
                <h4 className="text-sm font-semibold">Stage Completion Checklist</h4>
                <p className="text-[10px] text-muted-foreground">{completedCount}/{checks.length} stages complete — data sourced from this tender only</p>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-1.5">
          {checks.map(c => (
            <div key={c.stage} className={`flex items-center gap-3 p-3 rounded-lg border ${c.complete ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-border"}`}>
              {c.complete ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold">{c.label}</span>
                <p className={`text-[10px] ${c.complete ? "text-emerald-700" : "text-muted-foreground"}`}>{c.detail}</p>
              </div>
              <Badge variant="outline" className={`text-[8px] ${c.complete ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500"}`}>
                {c.complete ? "Complete" : "Pending"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Readiness Signals ── */}
      <div className={activeSection !== "signals" ? "hidden" : ""}>
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Additional Readiness Signals</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className={`p-3 rounded-lg border text-center ${complianceGaps > 0 ? "bg-red-50 border-red-200" : complianceTotal > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-border"}`}>
            <p className="text-sm font-bold">{complianceTotal > 0 ? `${complianceCompliant}/${complianceTotal}` : "—"}</p>
            <p className="text-[9px] text-muted-foreground">Compliance</p>
          </div>
          <div className={`p-3 rounded-lg border text-center ${docsTotal > 0 && docsReady < docsTotal ? "bg-amber-50 border-amber-200" : docsTotal > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-border"}`}>
            <p className="text-sm font-bold">{docsTotal > 0 ? `${docsReady}/${docsTotal}` : "—"}</p>
            <p className="text-[9px] text-muted-foreground">Documents</p>
          </div>
          <div className="p-3 rounded-lg border text-center bg-slate-50 border-border">
            <p className="text-sm font-bold">{ws.packs.length}</p>
            <p className="text-[9px] text-muted-foreground">Packs</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: FINAL PACK
// ═══════════════════════════════════════════════════════════

type PackSection = "bot_check" | "assembly_readiness" | "block_register";
const PACK_SECTIONS: { key: PackSection; label: string; icon: ReactNode }[] = [
  { key: "bot_check", label: "Approval Check Bot", icon: <Shield className="w-3.5 h-3.5" /> },
  { key: "assembly_readiness", label: "Final Pack Assembly", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "block_register", label: "Block Register", icon: <Layers className="w-3.5 h-3.5" /> },
];

function sanitizeDiscontinuedOutputRefs(value: any): any {
  if (typeof value === "string") {
    return value
      .replace(/PDF\s*Studio/gi, "final document assembly")
      .replace(/export(?:ing|ed)?\s+to\s+final document assembly/gi, "preparing the final pack");
  }
  if (Array.isArray(value)) return value.map(sanitizeDiscontinuedOutputRefs);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, sanitizeDiscontinuedOutputRefs(val)]));
  }
  return value;
}

function FinalPackTab({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void }) {
  const t = ws.tender as any;
  const tenderId = t.id;
  const td = t.tenderDraftingData ?? {};
  const blocks: any[] = useMemo(() => Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [], [td.proposal_blocks]);
  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999)), [blocks]);

  const counts = useMemo(() => ({
    total: blocks.length,
    technical: blocks.filter((b: any) => b.volume === "Technical").length,
    commercial: blocks.filter((b: any) => b.volume === "Commercial").length,
    shared: blocks.filter((b: any) => b.volume === "Shared").length,
    appendix: blocks.filter((b: any) => b.volume === "Appendix").length,
    approved: blocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length,
  }), [blocks]);

  const botResult = useMemo(() => td.final_approval_check ?? null, [td.final_approval_check]);
  const botReadyForAssembly = botResult?.status === "READY_FOR_SUBMISSION" || botResult?.ready_for_final_pack === true;
  const assemblyReady = botReadyForAssembly && counts.total > 0 && counts.approved > 0;
  const [running, setRunning] = useState(false);

  const [activeSection, setActiveSection] = useState<PackSection>("bot_check");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  // Run the Final Approval Check Bot
  const runFinalCheck = useCallback(async () => {
    setRunning(true);
    try {
      const pricing = t.pricingData ?? {};
      const scenarios = Array.isArray(pricing?.scenarios) ? pricing.scenarios : [];
      const gps = scenarios.map((s: any) => Number(s.gp_percent)).filter((n: number) => !isNaN(n));
      const matrix = approvalMatrixFor(t);
      const matrixApprovals: any[] = Array.isArray(matrix.approvals) ? matrix.approvals : [];

      // TCW-T4 (P6): review facts derive from the per-block review fields the
      // app actually writes (quality_scores / ai_flags / <dept>_status) — the
      // `departmental_reviews` facet read here previously has no writer.
      const reviewProgress = deriveDepartmentalReviewProgress(blocks);
      const deptScoreOf = (b: any, dept: ReviewDepartment): number | null => {
        const score = b?.quality_scores?.[dept]?.score;
        return typeof score === "number" ? score : null;
      };

      const blockScores = blocks.map((b: any) => ({
        id: b.id, title: b.title || "Untitled", volume: b.volume || "—",
        section_number: b.section_number || "—", approval_status: b.approval_status || "Draft",
        draft_status: b.draft_status || "Not Ready",
        quality_score_ops: deptScoreOf(b, "ops"),
        quality_score_finance: deptScoreOf(b, "finance"),
        quality_score_legal: deptScoreOf(b, "legal"),
      }));

      const countFlags = (dept: ReviewDepartment, severity: string) =>
        blocks.reduce((sum: number, b: any) => {
          const flags = Array.isArray(b?.ai_flags) ? b.ai_flags : [];
          return sum + flags.filter((f: any) => f?.department === dept && f?.severity === severity).length;
        }, 0);

      const deptAverage = (dept: ReviewDepartment): number | null => {
        const scores = blocks
          .map((b: any) => deptScoreOf(b, dept))
          .filter((n: number | null): n is number => n !== null);
        return scores.length > 0 ? Math.round(scores.reduce((s: number, n: number) => s + n, 0) / scores.length) : null;
      };
      const deptFullyReviewed = (dept: ReviewDepartment) => reviewProgress.fullyReviewed.includes(dept);

      const payload = {
        tender_identity: {
          id: t.id, title: t.title || "Untitled", customer_name: t.customerName || "Unknown",
          estimated_value: t.estimatedValue || 0, target_gp_percent: t.targetGpPercent || null,
          submission_deadline: t.submissionDeadline || null, region: t.region || "Unknown", source: t.source || "Unknown",
        },
        stage_completion: {
          qualification: { sow_qualification: !!t.sowQualificationData, technical_qualification: !!t.technicalQualificationData, customer_fit: !!t.customerFitData, risk_snapshot: !!t.riskSnapshotData },
          bid_no_bid: { decision: t.bidNoBidData?.decision?.decision || t.bidNoBidData?.decision || "Not Decided", decision_owner: t.bidNoBidData?.decision?.decided_by || "", win_strategy_exists: !!t.bidNoBidData?.win_strategy, resource_commitment_exists: !!t.bidNoBidData?.resource_commitment },
          solution_design: { configuration: !!t.solutionDesignData?.configuration, hop: !!t.solutionDesignData?.hop, ham: !!t.solutionDesignData?.ham, hip: !!t.solutionDesignData?.hip, scope_matrix: !!t.solutionDesignData?.scope_matrix, sla_kpi: !!t.solutionDesignData?.sla_kpi, assumptions: !!t.solutionDesignData?.assumptions },
          pnl_pricing: { scenarios_count: scenarios.length, gp_percent_lowest: gps.length > 0 ? Math.min(...gps) : null, gp_percent_highest: gps.length > 0 ? Math.max(...gps) : null, target_gp_percent: t.targetGpPercent || null, variance: gps.length > 0 && t.targetGpPercent ? Math.min(...gps) - t.targetGpPercent : null },
          tender_drafting: { blocks_total: blocks.length, blocks_approved: counts.approved, blocks_rejected: blocks.filter((b: any) => b.approval_status === "Rejected").length, blocks_pending: blocks.filter((b: any) => !b.approval_status || b.approval_status === "Draft" || b.approval_status === "Pending").length, volumes_covered: [...new Set(blocks.map((b: any) => b.volume).filter(Boolean))] },
          internal_review: {
            ops_review: { fully_reviewed: deptFullyReviewed("ops"), quality_score: deptAverage("ops"), high_flags: countFlags("ops", "high"), medium_flags: countFlags("ops", "medium"), low_flags: countFlags("ops", "low") },
            finance_review: { fully_reviewed: deptFullyReviewed("finance"), quality_score: deptAverage("finance"), high_flags: countFlags("finance", "high"), medium_flags: countFlags("finance", "medium"), low_flags: countFlags("finance", "low") },
            legal_review: { fully_reviewed: deptFullyReviewed("legal"), quality_score: deptAverage("legal"), high_flags: countFlags("legal", "high"), medium_flags: countFlags("legal", "medium"), low_flags: countFlags("legal", "low") },
          },
          approval_matrix: { required_approvers: matrixApprovals.length, approved_count: matrixApprovals.filter((a: any) => a.decision === "approved").length, rejected_count: matrixApprovals.filter((a: any) => a.decision === "rejected").length, pending_count: matrixApprovals.filter((a: any) => a.decision === "pending").length, all_approved: matrixApprovals.length > 0 && matrixApprovals.every((a: any) => a.decision === "approved") },
        },
        compliance: { total_items: ws.complianceItems.length, compliant: ws.complianceItems.filter(c => c.status === "compliant").length, non_compliant: ws.complianceItems.filter(c => c.status === "non_compliant").length, partial: ws.complianceItems.filter(c => c.status === "partial").length, clarification_required: ws.complianceItems.filter(c => c.status === "clarification_required").length },
        // TCW-T4 (F4): denominator is the RECORDED requirement register, never
        // a hardcoded list; missing_count can no longer go negative.
        documents: (() => {
          const checklist = buildSubmissionChecklist(readRequiredDocumentsRegister(tenderDetails(t)), ws.documents);
          return {
            total_uploaded: ws.documents.length,
            requirement_set_recorded: checklist.recorded,
            required_count: checklist.required,
            missing_count: checklist.missing,
          };
        })(),
        proposal_blocks: blockScores,
        departmental_flags_summary: { high_severity_total: countFlags("ops", "high") + countFlags("finance", "high") + countFlags("legal", "high"), medium_severity_total: countFlags("ops", "medium") + countFlags("finance", "medium") + countFlags("legal", "medium"), unresolved_discrepancies: 0, blocks_below_60_score: blockScores.filter(b => (b.quality_score_ops !== null && b.quality_score_ops < 60) || (b.quality_score_finance !== null && b.quality_score_finance < 60) || (b.quality_score_legal !== null && b.quality_score_legal < 60)).length },
      };

      const { data: botRow, error: botErr } = await supabase.from("ai_bots").select("id, model, current_version_id").eq("id", "bot-final-approval").single();
      if (botErr || !botRow) { toast.error("Final Approval Check bot not found. Please run the SQL seed first."); setRunning(false); return; }

      const { data: versionRow, error: verErr } = await supabase.from("ai_bot_versions").select("system_instruction, custom_instruction, temperature, max_tokens").eq("id", botRow.current_version_id).single();
      if (verErr || !versionRow) { toast.error("Final Approval Check bot version not found."); setRunning(false); return; }

      const discontinuedOutputNotice = [
        "IMPORTANT UPDATE: the previous document-output engine is discontinued.",
        "Assess final pack readiness only.",
        "Do not mention old document tools, external exports, or transfer gates.",
        "If the tender is ready, return ready_for_final_pack = true.",
      ].join(" ");

      const aiResponse = generateAIUnavailable();

      let result: any;
      try { result = typeof aiResponse.content === "string" ? JSON.parse(aiResponse.content) : aiResponse.content; }
      catch { result = { final_readiness_score: 0, status: "NOT_READY", status_reason: "Bot response could not be parsed.", ready_for_final_pack: false, stage_checklist: [], critical_issues: [], warnings: [], strengths: [], advice: "Please try running the check again." }; }

      const sanitizedResult = sanitizeDiscontinuedOutputRefs(result);
      const legacyExportKey = ["can", "export", "to", "pdf", "studio"].join("_");
      delete sanitizedResult[legacyExportKey];
      sanitizedResult.ready_for_final_pack = sanitizedResult.status === "READY_FOR_SUBMISSION" || sanitizedResult.ready_for_final_pack === true;

      // P4 (F2): the recorded runner is the SESSION user (auth-state mirror),
      // never the literal "Current User".
      const saveResult = await updateTenderDraftingData(
        tenderId,
        "final_approval_check",
        { ...sanitizedResult, ran_at: new Date().toISOString(), ran_by: getCurrentUser().name },
        "Advisory final approval check saved",
        wsRevisionToken(ws),
      );
      if (reportSaveOutcome(saveResult, `Final Approval Check: ${sanitizedResult.status || "Complete"}`)) reload();
    } catch (err: any) { toast.error(err.message || "Final Approval Check failed."); }
    setRunning(false);
  }, [t, ws, blocks, counts, td, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "Approved" || s === "Locked") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "Human Edited" || s === "Manual Draft") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B9): this tab holds no draft interval — the only write is the
          immediate check-save above, so the rendered content is always the
          stored content. "Saved" here states that in-sync fact. */}
      <StageMenuHeader sections={PACK_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      {/* ── 1. Approval Check Bot ── */}
      <div className={activeSection !== "bot_check" ? "hidden" : "space-y-4"}>
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Pack source blocks can be revised in Tender Drafting → Proposal Block Workbench.</span>
        </div>
        <Card className={`shadow-none ${botResult ? (botReadyForAssembly ? "border-emerald-300 bg-emerald-50/30" : botResult.status === "NEEDS_ATTENTION" ? "border-amber-300 bg-amber-50/30" : "border-red-300 bg-red-50/30") : "border-border"}`}>
          <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--color-hala-navy)]" />
                <span className="text-xs font-semibold">Final Approval Check Bot</span>
                {botResult && <Badge variant="outline" className={`text-[8px] ${botReadyForAssembly ? "border-emerald-300 text-emerald-700 bg-emerald-50" : botResult.status === "NEEDS_ATTENTION" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-red-300 text-red-700 bg-red-50"}`}>{botResult.status?.replace(/_/g, " ") || "Unknown"}</Badge>}
              </div>
              <Button size="sm" className="h-8 text-[10px] gap-1.5" disabled={running} onClick={runFinalCheck}>
                {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {botResult ? "Re-run Check" : "Run Final Check"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* TCW-T4 honesty: the check itself is refused in this build; say so
                up front instead of presenting a working control. */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
              <Info className="w-3 h-3 shrink-0" />
              <span>AI final approval check is not available in this build (Sprint X) — running it reports the refusal.</span>
            </div>
            {!botResult ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="w-3.5 h-3.5 shrink-0" /><span>No advisory check result is stored for this tender.</span></div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold font-mono ${botReadyForAssembly ? "text-emerald-600" : botResult.final_readiness_score >= 50 ? "text-amber-600" : "text-red-600"}`}>{botResult.final_readiness_score ?? 0}%</div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{botResult.status_reason || "Assessment complete"}</p>
                    {botResult.ran_at && <p className="text-[9px] text-muted-foreground">Last run: {new Date(botResult.ran_at).toLocaleString()}</p>}
                  </div>
                </div>
                {botResult.advice && <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-md border border-border p-2.5">{botResult.advice}</div>}
                {Array.isArray(botResult.critical_issues) && botResult.critical_issues.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-red-700">Critical Issues:</p>
                    {botResult.critical_issues.map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <div><span className="font-semibold">{issue.area}: </span><span>{issue.issue}</span>{issue.recommendation && <p className="text-red-600 mt-0.5">→ {issue.recommendation}</p>}</div>
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(botResult.strengths) && botResult.strengths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-emerald-700">Strengths:</p>
                    {botResult.strengths.map((s: string, i: number) => (<div key={i} className="flex items-center gap-1.5 text-[10px] text-emerald-700"><CheckCircle2 className="w-3 h-3 shrink-0" /><span>{s}</span></div>))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Final Pack Assembly Readiness ── */}
      <div className={activeSection !== "assembly_readiness" ? "hidden" : "space-y-4"}>
        <Card className={`shadow-none ${assemblyReady ? "border-emerald-300 bg-emerald-50/20" : "border-border"}`}>
          <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--color-hala-navy)]" />
              <span className="text-xs font-semibold">Final Pack Assembly Readiness</span>
              {assemblyReady && <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Ready for Assembly</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              {[
                { label: "Final Approval Check Bot run", met: !!botResult },
                { label: "Bot status: READY_FOR_SUBMISSION", met: botReadyForAssembly },
                { label: "Proposal blocks drafted", met: counts.total > 0 },
                { label: "At least 1 block approved", met: counts.approved > 0 },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  {c.met ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-400 shrink-0" />}
                  <span className={c.met ? "text-emerald-700" : "text-muted-foreground"}>{c.label}</span>
                </div>
              ))}
            </div>
            <Link
              href={cleanHref(`/tenders/${tenderId}/final-pack`)}
              className="flex items-center justify-center gap-2 rounded-md border border-[var(--color-hala-navy)] bg-[var(--color-hala-navy)] px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <FileText className="w-3.5 h-3.5" />
              Open Final Pack Studio
            </Link>
          </CardContent>
        </Card>
        <div className="grid grid-cols-5 gap-2">
          {[["Total", counts.total], ["Technical", counts.technical], ["Commercial", counts.commercial], ["Shared", counts.shared], ["Approved", counts.approved]].map(([label, val]) => (
            <div key={label as string} className="rounded-md border border-border p-2 text-center">
              <p className="text-lg font-bold">{val}</p><p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Block Register ── */}
      <div className={activeSection !== "block_register" ? "hidden" : ""}>
        <Card className="border-border shadow-none">
          <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#075eea]" />
              <span className="text-xs font-semibold">Final Block Register</span>
              <Badge variant="outline" className="text-[8px]">{sortedBlocks.length} block{sortedBlocks.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No proposal blocks to show. Complete Tender Drafting first.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50 border-b"><tr>
                    <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Volume</th>
                    <th className="px-3 py-2 text-left font-semibold">Draft</th>
                    <th className="px-3 py-2 text-left font-semibold">Approval</th>
                  </tr></thead>
                  <tbody>
                    {sortedBlocks.map((b: any, i: number) => (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{b.section_number || i + 1}</td>
                        <td className="px-3 py-2 font-medium">{b.title || "Untitled"}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{b.volume}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.draft_status || "Not Ready")}`}>{b.draft_status || "Not Ready"}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.approval_status || "Draft")}`}>{b.approval_status || "Draft"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: SUBMISSION CHECKLIST
// ═══════════════════════════════════════════════════════════

type ChecklistSection = "required_docs";
const CHECKLIST_SECTIONS: { key: ChecklistSection; label: string; icon: ReactNode }[] = [
  { key: "required_docs", label: "Required Documents", icon: <FileText className="w-3.5 h-3.5" /> },
];

const REGISTER_STATUS_BADGE: Record<string, string> = {
  missing: "border-red-300 text-red-700 bg-red-50",
  in_progress: "border-amber-300 text-amber-700 bg-amber-50",
  uploaded: "border-emerald-300 text-emerald-700 bg-emerald-50",
  approved: "border-emerald-300 text-emerald-700 bg-emerald-50",
  na: "border-slate-200 text-slate-500 bg-slate-50",
};

function SubmissionChecklistTab({ ws, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void }) {
  const t = ws.tender as any;
  // TCW-T4 (B17/B18/F4): derived ONLY from the tender's recorded
  // submission_readiness.required_documents register — the same canonical rows
  // ws.submissionReadiness.facet.required_documents projects. No hardcoded
  // list; matching is linked-document-id or FULL-name containment.
  const checklist = useMemo(
    () => buildSubmissionChecklist(readRequiredDocumentsRegister(tenderDetails(t)), ws.documents),
    [t, ws.documents],
  );
  const [activeSection, setActiveSection] = useState<ChecklistSection>("required_docs");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B9): read-only projection of the stored register — nothing on
          this tab can hold unsaved edits, so "Saved" states the in-sync fact. */}
      <StageMenuHeader sections={CHECKLIST_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      <div className={activeSection !== "required_docs" ? "hidden" : "space-y-4"}>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Required Documents for Submission</span>
          {checklist.recorded && (
            <Badge variant="outline" className="text-[8px]">{checklist.satisfied}/{checklist.required} accounted for</Badge>
          )}
        </div>
        {!checklist.recorded ? (
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-4 rounded-lg border border-border bg-slate-50">
            <Inbox className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">No requirement set recorded for this tender.</p>
              <p className="text-[10px] mt-1">
                The submission checklist derives from the tender's own required-documents register
                (Submission Readiness → Required Documents). Nothing is recorded there yet, so there is
                no list to check against — this screen does not substitute a template list.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b"><tr>
                  <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Document</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                  <th className="px-3 py-2 text-left font-semibold">Recorded Status</th>
                  <th className="px-3 py-2 text-center font-semibold">Accounted For</th>
                </tr></thead>
                <tbody>
                  {checklist.rows.map((row, i) => (
                    <tr key={row.id} className={`border-t border-border hover:bg-muted/20 ${!row.satisfied && row.status !== "na" ? "bg-red-50/30" : ""}`}>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.document_name || "(unnamed requirement)"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.owner || "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[8px] ${REGISTER_STATUS_BADGE[row.status] ?? "border-slate-200 text-slate-600"}`}>
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.status === "na"
                          ? <span className="text-muted-foreground text-[10px]">Not applicable</span>
                          : row.satisfied
                            ? <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />{row.satisfiedBy === "status" ? "Recorded" : row.satisfiedBy === "linked_document" ? "Linked upload" : "Name match"}</Badge>
                            : <Badge variant="outline" className="text-[8px] border-red-300 text-red-700 bg-red-50 gap-0.5"><XCircle className="w-2.5 h-2.5" />Outstanding</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>A requirement counts as accounted for when its register status is uploaded/approved, its linked document id matches an uploaded document, or its FULL recorded name appears in an uploaded document's name. Partial or first-word matching is never used.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: APPROVAL RECORD
// ═══════════════════════════════════════════════════════════

type RecordSection = "final_approval" | "context" | "signoffs" | "governance";
const RECORD_SECTIONS: { key: RecordSection; label: string; icon: ReactNode }[] = [
  { key: "final_approval", label: "Final Approval", icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  { key: "context", label: "Approval Context", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "signoffs", label: "Sign-off Log", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "governance", label: "Human Control", icon: <Shield className="w-3.5 h-3.5" /> },
];

function ApprovalRecordTab({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void }) {
  const t = ws.tender as any;
  const details = tenderDetails(t);
  const matrix = approvalMatrixFor(t);
  const approvals: any[] = Array.isArray(matrix.approvals) ? matrix.approvals : [];
  const gpPercent = t.pricingData?.summary?.lowest_gp_percent ?? t.targetGpPercent ?? null;
  const palletVolume = t.solutionDesignData?.hop?.warehouse?.pallet_positions ?? t.solutionDesignData?.configuration?.pallet_volume ?? null;
  const storedRecord = useMemo<FinalApprovalRecord>(() => {
    const record = details.final_approved?.approval_record ?? {};
    return {
      decision: record.decision === "approved" || record.decision === "not_approved" ? record.decision : "pending",
      approved_by: record.approved_by || "",
      approved_at: typeof record.approved_at === "string" ? record.approved_at.slice(0, 16) : "",
      reference: record.reference || "",
      notes: record.notes || "",
    };
  }, [details.final_approved]);

  const [activeSection, setActiveSection] = useState<RecordSection>("final_approval");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [record, setRecord] = useState<FinalApprovalRecord>(storedRecord);
  const [savingRecord, setSavingRecord] = useState(false);

  useEffect(() => {
    setRecord(storedRecord);
  }, [storedRecord]);

  // TCW-T4 (B9): real save state — amber while the form differs from the
  // stored record, green only when a stored record exists and matches the form.
  const dirty = useMemo(
    () => (Object.keys(record) as Array<keyof FinalApprovalRecord>).some(key => record[key] !== storedRecord[key]),
    [record, storedRecord],
  );
  const hasStoredRecord = useMemo(() => {
    const stored = details.final_approved?.approval_record;
    return !!(stored && typeof stored === "object" && Object.keys(stored).length > 0);
  }, [details.final_approved]);

  const saveFinalApproval = useCallback(async () => {
    setSavingRecord(true);
    try {
      // P4 (F2): the recorder is the SESSION user, never a literal.
      // P2a: threaded through saveTenderSectionWithOutcome (unit-tested path).
      const result = await saveTenderSectionWithOutcome(
        updateTenderFinalApprovedData,
        t.id,
        "approval_record",
        buildFinalApprovalRecordPayload(record, getCurrentUser().name),
        "Manual final approval record",
        ws,
        "Final approval record saved.",
      );
      // Stale outcome keeps the form entry on screen — no reload.
      if (!result.success) return;
      reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to save final approval.");
    } finally {
      setSavingRecord(false);
    }
  }, [record, reload, t.id, ws]);

  return (
    <div className="space-y-4">
      <StageMenuHeader sections={RECORD_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
        saved={hasStoredRecord && !dirty} unsaved={dirty} />

      {/* ── 1. Final Approval ── */}
      <div className={activeSection !== "final_approval" ? "hidden" : "space-y-4"}>
        <div className="grid gap-4 border border-border p-4 md:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium">
            <span>Human decision</span>
            <Select value={record.decision} onValueChange={(decision: FinalApprovalRecord["decision"]) => setRecord((current) => ({ ...current, decision }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="not_approved">Not approved</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Approved or reviewed by</span>
            <Input value={record.approved_by} onChange={(event) => setRecord((current) => ({ ...current, approved_by: event.target.value }))} placeholder="Person or role" />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Decision date and time</span>
            <Input type="datetime-local" value={record.approved_at} onChange={(event) => setRecord((current) => ({ ...current, approved_at: event.target.value }))} />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Reference</span>
            <Input value={record.reference} onChange={(event) => setRecord((current) => ({ ...current, reference: event.target.value }))} placeholder="Email, meeting, or document reference" />
          </label>
          <label className="space-y-1.5 text-xs font-medium md:col-span-2">
            <span>Notes</span>
            <Textarea value={record.notes} onChange={(event) => setRecord((current) => ({ ...current, notes: event.target.value }))} placeholder="Record the human decision and any supporting context" className="min-h-[90px]" />
          </label>
          <div className="flex items-center justify-between gap-3 md:col-span-2">
            <p className="text-[10px] text-muted-foreground">Saving this record does not move the Tender stage or change access to any stage.</p>
            <Button onClick={saveFinalApproval} disabled={savingRecord}>
              {savingRecord ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />}
              Save Final Approval
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. Approval Context ── */}
      <div className={activeSection !== "context" ? "hidden" : ""}>
        <Card className="border-border shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tender facts shown as context</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-2">
                <p className="text-[9px] text-muted-foreground">GP%</p>
                <p className="text-sm font-bold">{gpPercent !== null ? `${Number(gpPercent).toFixed(1)}%` : "Not captured"}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-[9px] text-muted-foreground">Pallet Volume</p>
                <p className="text-sm font-bold">{palletVolume !== null ? Number(palletVolume).toLocaleString() : "Not captured"}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">These figures do not assign approvers or determine the human decision.</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Sign-off Log ── */}
      <div className={activeSection !== "signoffs" ? "hidden" : ""}>
        {approvals.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-4 rounded-lg border border-border bg-slate-50">
            <Info className="w-3.5 h-3.5 shrink-0" /><span>No approval records found. Complete the Approval Matrix stage first.</span>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50 border-b"><tr>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-center font-semibold">Decision</th>
                <th className="px-3 py-2 text-left font-semibold">Decided By</th>
                <th className="px-3 py-2 text-left font-semibold">Comment</th>
                <th className="px-3 py-2 text-left font-semibold">Timestamp</th>
              </tr></thead>
              <tbody>
                {approvals.map((a: any) => (
                  <tr key={a.id} className={`border-t border-border hover:bg-muted/20 ${a.decision === "rejected" ? "bg-red-50/30" : a.decision === "approved" ? "bg-emerald-50/30" : ""}`}>
                    <td className="px-3 py-2 font-medium">{a.role_label || a.role}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.type === "feasibility" ? "Feasibility" : "Approval"}</td>
                    <td className="px-3 py-2 text-center">
                      {a.decision === "approved" && <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Approved</Badge>}
                      {a.decision === "rejected" && <Badge variant="outline" className="text-[8px] border-red-300 text-red-700 bg-red-50 gap-0.5"><XCircle className="w-2.5 h-2.5" />Rejected</Badge>}
                      {a.decision === "pending" && <Badge variant="outline" className="text-[8px] border-slate-200 text-slate-500 gap-0.5"><Clock className="w-2.5 h-2.5" />Pending</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.decided_by || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{a.comment || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-[10px] font-mono whitespace-nowrap">{a.decided_at ? new Date(a.decided_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. Human Control ── */}
      <div className={activeSection !== "governance" ? "hidden" : ""}>
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2.5">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Final approval remains a human-maintained fact.</p>
            <p className="mt-0.5">Stage 8 participant decisions are shown here for context and remain editable in Approval Matrix. Neither those decisions nor the final approval record change the stage, disable editing, or prevent browsing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function FinalApprovedStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender as any;
  const td = t.tenderDraftingData ?? {};
  const checks = deriveStageChecklist(t, ws);
  const completedCount = checks.filter(c => c.complete).length;
  const pct = checks.length > 0 ? Math.round((completedCount / checks.length) * 100) : 0;
  const botResult = td.final_approval_check ?? null;
  const blocks: any[] = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];

  // TCW-T4 (B17): the documents metric measures against the RECORDED
  // requirement register only; with no register there is no denominator.
  const docChecklist = buildSubmissionChecklist(readRequiredDocumentsRegister(tenderDetails(t)), ws.documents);
  const intelMetrics = [
    { label: "Stage Readiness", value: `${pct}% (${completedCount}/${checks.length} stages)` },
    { label: "Bot Check", value: botResult ? (botResult.status || "Run") : "Not run" },
    { label: "Blocks", value: `${blocks.length} total, ${blocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length} approved` },
    {
      label: "Required Documents",
      value: docChecklist.recorded
        ? `${docChecklist.satisfied}/${docChecklist.required} accounted for`
        : "No requirement set recorded",
    },
  ];

  if (activeTab === "submission_readiness") return <SubmissionReadinessTab ws={ws} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "final_pack") return <FinalPackTab ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "submission_checklist") return <SubmissionChecklistTab ws={ws} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "approval_record") return <ApprovalRecordTab ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;

  return <SubmissionReadinessTab ws={ws} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
}
