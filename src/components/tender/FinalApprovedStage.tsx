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

// ─── Props ──────────────────────────────────────────────────

interface Props {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

// ─── Required Documents (from governance config) ────────────

const REQUIRED_DOCS = [
  { doc: "Final Tender Pack PDF", pack: "All", signed: false, stamp: false },
  { doc: "OBK Native Excel", pack: "Bulk / PGP", signed: false, stamp: false },
  { doc: "OBK Signed/Stamped PDF", pack: "Bulk / PGP", signed: true, stamp: true },
  { doc: "Bid Statement Signed/Stamped PDF", pack: "All", signed: true, stamp: true },
  { doc: "Transition Plan", pack: "All", signed: false, stamp: false },
  { doc: "Continuous Improvement Proposal Form", pack: "All", signed: false, stamp: false },
  { doc: "Compliance Pack", pack: "All", signed: false, stamp: false },
  { doc: "Commercial Registration", pack: "All", signed: true, stamp: false },
  { doc: "VAT Certificate", pack: "All", signed: true, stamp: false },
  { doc: "ISO Certificates", pack: "All", signed: true, stamp: false },
  { doc: "Insurance Certificates", pack: "All", signed: true, stamp: false },
  { doc: "ADR Class 2 Certifications", pack: "All", signed: true, stamp: false },
  { doc: "Reference Credentials", pack: "All", signed: false, stamp: false },
  { doc: "Performance Guarantee Confirmation", pack: "All", signed: true, stamp: true },
];

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

  const reviews = td.departmental_reviews ?? {};
  const depts = ["operations", "finance", "legal"];
  const submitted = depts.filter(d => reviews[d]?.submitted_at);
  checks.push({
    stage: "internal_review", label: "Internal Review", complete: submitted.length === 3,
    detail: submitted.length > 0
      ? `${submitted.length}/3 departments reviewed (${submitted.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")})`
      : "No departments reviewed yet",
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
  sections, activeSection, setActiveSection, stageIntelOpen, setStageIntelOpen, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved,
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
      const reviews = td.departmental_reviews ?? {};
      const matrix = approvalMatrixFor(t);
      const matrixApprovals: any[] = Array.isArray(matrix.approvals) ? matrix.approvals : [];

      const blockScores = blocks.map((b: any) => ({
        id: b.id, title: b.title || "Untitled", volume: b.volume || "—",
        section_number: b.section_number || "—", approval_status: b.approval_status || "Draft",
        draft_status: b.draft_status || "Not Ready",
        quality_score_ops: reviews.operations?.block_scores?.[b.id] ?? null,
        quality_score_finance: reviews.finance?.block_scores?.[b.id] ?? null,
        quality_score_legal: reviews.legal?.block_scores?.[b.id] ?? null,
      }));

      const countFlags = (dept: string, severity: string) => {
        const r = reviews[dept]?.report;
        if (!Array.isArray(r)) return 0;
        return r.reduce((sum: number, rep: any) => sum + (Array.isArray(rep.flags) ? rep.flags.filter((f: any) => f.severity === severity).length : 0), 0);
      };

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
            ops_review: { submitted: !!reviews.operations?.submitted_at, quality_score: reviews.operations?.average_score ?? null, high_flags: countFlags("operations", "high"), medium_flags: countFlags("operations", "medium"), low_flags: countFlags("operations", "low") },
            finance_review: { submitted: !!reviews.finance?.submitted_at, quality_score: reviews.finance?.average_score ?? null, high_flags: countFlags("finance", "high"), medium_flags: countFlags("finance", "medium"), low_flags: countFlags("finance", "low") },
            legal_review: { submitted: !!reviews.legal?.submitted_at, quality_score: reviews.legal?.average_score ?? null, high_flags: countFlags("legal", "high"), medium_flags: countFlags("legal", "medium"), low_flags: countFlags("legal", "low") },
          },
          approval_matrix: { required_approvers: matrixApprovals.length, approved_count: matrixApprovals.filter((a: any) => a.decision === "approved").length, rejected_count: matrixApprovals.filter((a: any) => a.decision === "rejected").length, pending_count: matrixApprovals.filter((a: any) => a.decision === "pending").length, all_approved: matrixApprovals.length > 0 && matrixApprovals.every((a: any) => a.decision === "approved") },
        },
        compliance: { total_items: ws.complianceItems.length, compliant: ws.complianceItems.filter(c => c.status === "compliant").length, non_compliant: ws.complianceItems.filter(c => c.status === "non_compliant").length, partial: ws.complianceItems.filter(c => c.status === "partial").length, clarification_required: ws.complianceItems.filter(c => c.status === "clarification_required").length },
        documents: { total_uploaded: ws.documents.length, required_count: REQUIRED_DOCS.length, missing_count: REQUIRED_DOCS.length - ws.documents.length },
        proposal_blocks: blockScores,
        departmental_flags_summary: { high_severity_total: countFlags("operations", "high") + countFlags("finance", "high") + countFlags("legal", "high"), medium_severity_total: countFlags("operations", "medium") + countFlags("finance", "medium") + countFlags("legal", "medium"), unresolved_discrepancies: 0, blocks_below_60_score: blockScores.filter(b => (b.quality_score_ops !== null && b.quality_score_ops < 60) || (b.quality_score_finance !== null && b.quality_score_finance < 60) || (b.quality_score_legal !== null && b.quality_score_legal < 60)).length },
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

      const saveResult = await updateTenderDraftingData(
        tenderId,
        "final_approval_check",
        { ...sanitizedResult, ran_at: new Date().toISOString(), ran_by: "Current User" },
        "Advisory final approval check saved",
      );
      if (!saveResult.success) { toast.error(`Save failed: ${saveResult.error || "Unknown error"}`); }
      else { toast.success(`Final Approval Check: ${sanitizedResult.status || "Complete"}`); reload(); }
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
            {!botResult ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="w-3.5 h-3.5 shrink-0" /><span>Run the Final Approval Check to assess tender readiness before final pack assembly.</span></div>
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

function SubmissionChecklistTab({ ws, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void }) {
  const uploadedNames = useMemo(() => ws.documents.map(d => d.document_name.toLowerCase()), [ws.documents]);
  const [activeSection, setActiveSection] = useState<ChecklistSection>("required_docs");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  return (
    <div className="space-y-4">
      <StageMenuHeader sections={CHECKLIST_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      <div className={activeSection !== "required_docs" ? "hidden" : "space-y-4"}>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Required Documents for Submission</span>
          <Badge variant="outline" className="text-[8px]">{REQUIRED_DOCS.length} items</Badge>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/50 border-b"><tr>
              <th className="px-3 py-2 text-left font-semibold w-8">#</th>
              <th className="px-3 py-2 text-left font-semibold">Document</th>
              <th className="px-3 py-2 text-left font-semibold">Pack</th>
              <th className="px-3 py-2 text-center font-semibold">Signed</th>
              <th className="px-3 py-2 text-center font-semibold">Stamped</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr></thead>
            <tbody>
              {REQUIRED_DOCS.map((doc, i) => {
                const isUploaded = uploadedNames.some(n => n.includes(doc.doc.toLowerCase().split(" ")[0]));
                return (
                  <tr key={i} className={`border-t border-border hover:bg-muted/20 ${!isUploaded ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{doc.doc}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.pack}</td>
                    <td className="px-3 py-2 text-center">{doc.signed ? <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-700 bg-amber-50">Required</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-center">{doc.stamp ? <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-700 bg-amber-50">Required</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-center">{isUploaded ? <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Uploaded</Badge> : <Badge variant="outline" className="text-[8px] border-red-300 text-red-700 bg-red-50 gap-0.5"><XCircle className="w-2.5 h-2.5" />Missing</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Document matching is based on document names in the Document Library. Upload documents via the Document Library drawer to update statuses.</span>
        </div>
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

  const saveFinalApproval = useCallback(async () => {
    setSavingRecord(true);
    try {
      const result = await updateTenderFinalApprovedData(
        t.id,
        "approval_record",
        {
          ...record,
          approved_at: record.approved_at ? new Date(record.approved_at).toISOString() : "",
          recorded_at: new Date().toISOString(),
          recorded_by: "Current User",
        },
        "Manual final approval record",
      );
      if (!result.success) {
        toast.error(`Failed to save final approval: ${result.error || "Unknown error"}`);
        return;
      }
      toast.success("Final approval record saved.");
      reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to save final approval.");
    } finally {
      setSavingRecord(false);
    }
  }, [record, reload, t.id]);

  return (
    <div className="space-y-4">
      <StageMenuHeader sections={RECORD_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

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
  const docsUploaded = ws.documents.length;

  const intelMetrics = [
    { label: "Stage Readiness", value: `${pct}% (${completedCount}/${checks.length} stages)` },
    { label: "Bot Check", value: botResult ? (botResult.status || "Run") : "Not run" },
    { label: "Blocks", value: `${blocks.length} total, ${blocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length} approved` },
    { label: "Documents", value: `${docsUploaded}/${REQUIRED_DOCS.length} uploaded` },
  ];

  if (activeTab === "submission_readiness") return <SubmissionReadinessTab ws={ws} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "final_pack") return <FinalPackTab ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "submission_checklist") return <SubmissionChecklistTab ws={ws} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "approval_record") return <ApprovalRecordTab ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;

  return <SubmissionReadinessTab ws={ws} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
}
