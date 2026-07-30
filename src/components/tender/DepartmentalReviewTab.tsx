/**
 * DepartmentalReviewTab — Per-department block review with AI cross-referencing.
 *
 * Each department gets:
 * - Department-specific briefing panel with context data availability
 * - AI review that cross-references proposal blocks against previous stage data
 * - Findings summary card after AI runs
 * - Approve / Reject workflow per block
 *
 * ONE SOURCE OF TRUTH: bots come from Bot Builder (ai_bots table).
 * No hardcoded bots. No mock data.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, DollarSign, Scale, CheckCircle2, XCircle, AlertTriangle, Bot,
  Loader2, ChevronRight, ChevronDown, RotateCcw, Database, FileCheck2,
  TrendingUp, Eye, Info,
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
  throw new Error("AI departmental review is not available in this build (deferred to Sprint X - SX-001/SX-011).");
}
import { loadGovernedBotByName } from "@/lib/ai-runs";
import { updateBlockReviewStatus, saveBlockAIFlags } from "@/lib/supabase-tender-actions";
import {
  ensureReviewFields,
  DEPARTMENT_LABELS,
  type ReviewDepartment,
  type AIReviewFlag,
} from "@/lib/internal-review-types";

interface Props {
  ws: TenderWorkspace;
  department: ReviewDepartment;
  requiredVolumes: string[];
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

// Bot names must match display_name in ai_bots table (Bot Builder).
// ONE SOURCE OF TRUTH: all bots come from Bot Builder → ai_bots.
const BOT_NAMES: Record<ReviewDepartment, string> = {
  ops: "Operations Technical Reviewer",
  finance: "Finance & Commercial Reviewer",
  legal: "Legal Risk & Compliance Reviewer",
};

const DEPT_ICONS: Record<ReviewDepartment, typeof Shield> = {
  ops: Shield,
  finance: DollarSign,
  legal: Scale,
};

const DEPT_COLORS: Record<ReviewDepartment, { bg: string; border: string; text: string; light: string }> = {
  ops: { bg: "bg-blue-600", border: "border-blue-200", text: "text-blue-700", light: "bg-blue-50" },
  finance: { bg: "bg-emerald-600", border: "border-emerald-200", text: "text-emerald-700", light: "bg-emerald-50" },
  legal: { bg: "bg-[#075eea]", border: "border-[#075eea]/20", text: "text-[#075eea]", light: "bg-[#075eea]/10" },
};

const DEPT_DESCRIPTIONS: Record<ReviewDepartment, string> = {
  ops: "Validates operational feasibility — cross-references proposal blocks against Solution Design (HOP/HAM/HIP), SOW data, Risk Snapshot, and Technical Qualification to flag mismatches, unrealistic commitments, and missing coverage.",
  finance: "Protects margins — cross-references proposal blocks against P&L pricing model, commercial terms, bid strategy, cost drivers, and target GP% to flag hidden costs, payment term mismatches, and financial exposure.",
  legal: "Assesses legal exposure — cross-references all proposal blocks against risk snapshot, compliance matrix, commercial terms, and KSA law requirements to flag liabilities, missing protections, and compliance gaps.",
};

// What context data each department needs and checks for
const DEPT_CONTEXT_SOURCES: Record<ReviewDepartment, { label: string; key: string; nested?: string }[]> = {
  ops: [
    { label: "Solution Design (HOP/HAM/HIP)", key: "solutionDesignData" },
    { label: "SOW Data", key: "sowData" },
    { label: "Risk Snapshot", key: "riskSnapshotData" },
    { label: "Technical Qualification", key: "technicalQualificationData" },
    { label: "SOW Qualification", key: "sowQualificationData" },
  ],
  finance: [
    { label: "P&L / Pricing Model", key: "pricingData" },
    { label: "Bid / No-Bid Decision", key: "bidNoBidData" },
    { label: "Solution Design Cost Drivers", key: "solutionDesignData", nested: "cost_drivers" },
    { label: "Target GP%", key: "targetGpPercent" },
    { label: "Estimated Value", key: "estimatedValue" },
  ],
  legal: [
    { label: "Risk Snapshot", key: "riskSnapshotData" },
    { label: "Customer Fit", key: "customerFitData" },
    { label: "Compliance Coverage", key: "tenderDraftingData", nested: "compliance_coverage" },
    { label: "Commercial Terms", key: "pricingData", nested: "commercial_terms" },
  ],
};

const severityColor = (s: string) => {
  if (s === "high") return "border-red-300 text-red-700 bg-red-50";
  if (s === "medium") return "border-amber-300 text-amber-700 bg-amber-50";
  return "border-slate-200 text-slate-600 bg-slate-50";
};

const statusBadge = (status: string) => {
  if (status === "Approved") return "border-emerald-300 text-emerald-700 bg-emerald-50";
  if (status === "Rejected") return "border-red-300 text-red-700 bg-red-50";
  return "border-slate-200 text-slate-600 bg-slate-50";
};

export default function DepartmentalReviewTab({ ws, department, requiredVolumes, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const t = ws.tender as any;
  const Icon = DEPT_ICONS[department];
  const colors = DEPT_COLORS[department];

  const filteredBlocks = useMemo(() => {
    const all = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
    return all
      .filter((b: any) => requiredVolumes.includes(b.volume))
      .map(ensureReviewFields)
      .sort((a: any, b: any) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999));
  }, [drafting.proposal_blocks, requiredVolumes]);

  type DeptSection = "briefing" | "findings" | "blocks";
  const SECTION_TABS: TenderStageSectionTab<DeptSection>[] = [
    { key: "briefing", label: "Briefing Panel", icon: <Database className="w-3.5 h-3.5" /> },
    { key: "findings", label: "AI Findings", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: "blocks", label: "Block Review", icon: <FileCheck2 className="w-3.5 h-3.5" /> },
  ];
  const [activeSection, setActiveSection] = useState<DeptSection>("briefing");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);

  const statusKey = `${department}_status`;
  const commentKey = `${department}_comment`;
  const reviewerKey = `${department}_reviewer`;
  const reviewedAtKey = `${department}_reviewed_at`;

  // Context data availability check
  const contextAvailability = useMemo(() => {
    const sources = DEPT_CONTEXT_SOURCES[department];
    return sources.map(s => {
      let raw = t[s.key];
      if (s.nested && raw && typeof raw === "object") raw = raw[s.nested];
      const hasData = raw !== undefined && raw !== null && raw !== "" &&
        !(typeof raw === "object" && Object.keys(raw).length === 0) &&
        !(Array.isArray(raw) && raw.length === 0);
      return { label: s.label, available: hasData };
    });
  }, [t, department]);

  const availableCount = contextAvailability.filter(c => c.available).length;
  const totalSources = contextAvailability.length;

  // Aggregate stats
  const approvedCount = filteredBlocks.filter((b: any) => b[statusKey] === "Approved").length;
  const rejectedCount = filteredBlocks.filter((b: any) => b[statusKey] === "Rejected").length;
  const pendingCount = filteredBlocks.length - approvedCount - rejectedCount;
  const reviewPct = filteredBlocks.length > 0 ? Math.round((approvedCount / filteredBlocks.length) * 100) : 0;

  // All AI flags for this department across all blocks
  const deptFlags = useMemo(() => {
    const flags: (AIReviewFlag & { blockTitle: string; blockSection: string })[] = [];
    for (const b of filteredBlocks) {
      if (Array.isArray(b.ai_flags)) {
        for (const f of b.ai_flags) {
          if (f.department === department) {
            flags.push({ ...f, blockTitle: b.title || "Untitled", blockSection: b.section_number || "?" });
          }
        }
      }
    }
    return flags;
  }, [filteredBlocks, department]);

  const highFlags = deptFlags.filter(f => f.severity === "high").length;
  const mediumFlags = deptFlags.filter(f => f.severity === "medium").length;
  const lowFlags = deptFlags.filter(f => f.severity === "low").length;
  const intelMetrics: TenderStageMetric[] = [
    { label: "Department", value: DEPARTMENT_LABELS[department] },
    { label: "Review Progress", value: `${reviewPct}% (${approvedCount}/${filteredBlocks.length})` },
    { label: "Context Sources", value: `${availableCount}/${totalSources} available` },
    { label: "AI Flags", value: `${deptFlags.length} (${highFlags} critical)` },
  ];

  // ─── Quality Scores ────────────────────────────────────────
  const blockQualityScores = useMemo(() => {
    const scores: { blockId: string; score: number; rationale: string; title: string }[] = [];
    for (const b of filteredBlocks) {
      const qs = b.quality_scores;
      if (qs && typeof qs === "object" && qs[department]) {
        scores.push({
          blockId: b.id,
          score: qs[department].score ?? 0,
          rationale: qs[department].rationale || "",
          title: b.title || "Untitled",
        });
      }
    }
    return scores;
  }, [filteredBlocks, department]);

  const avgQualityScore = blockQualityScores.length > 0
    ? Math.round(blockQualityScores.reduce((sum, s) => sum + s.score, 0) / blockQualityScores.length)
    : null;

  const scoreColor = (score: number) => {
    if (score >= 90) return { ring: "stroke-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", label: "Excellent" };
    if (score >= 70) return { ring: "stroke-blue-500", text: "text-blue-600", bg: "bg-blue-50", label: "Good" };
    if (score >= 50) return { ring: "stroke-amber-500", text: "text-amber-600", bg: "bg-amber-50", label: "Fair" };
    if (score >= 30) return { ring: "stroke-orange-500", text: "text-orange-600", bg: "bg-orange-50", label: "Poor" };
    return { ring: "stroke-red-500", text: "text-red-600", bg: "bg-red-50", label: "Critical" };
  };

  const handleApprove = useCallback(async (blockId: string) => {
    setSaving(blockId);
    try {
      const res = await updateBlockReviewStatus(tenderId, blockId, department, "Approved", "");
      if (res.success) {
        toast.success("Block approved.");
        reload();
      } else {
        toast.error(res.error || "Failed to approve.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve.");
    } finally {
      setSaving(null);
    }
  }, [tenderId, department, reload]);

  const handleReject = useCallback(async (blockId: string) => {
    setSaving(blockId);
    try {
      const res = await updateBlockReviewStatus(tenderId, blockId, department, "Rejected", rejectComment);
    if (res.success) {
      toast.success("Block rejected — sent to Exceptions.");
      reload();
    } else {
      toast.error(res.error || "Failed to reject.");
    }
      setRejectingId(null);
      setRejectComment("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject.");
    } finally {
      setSaving(null);
    }
  }, [tenderId, department, rejectComment, reload]);

  const handleReset = useCallback(async (blockId: string) => {
    setSaving(blockId);
    try {
      const res = await updateBlockReviewStatus(tenderId, blockId, department, "Pending", "");
      if (res.success) {
        reload();
      } else {
        toast.error(res.error || "Failed to reset.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset.");
    } finally {
      setSaving(null);
    }
  }, [tenderId, department, reload]);

  // ─── AI Review Sweep ─────────────────────────────────────────
  const handleRunAIReview = useCallback(async () => {
    setAiRunning(true);
    try {
      // 1. Load bot from ai_bots (Bot Builder) — ONE SOURCE OF TRUTH
      const botName = BOT_NAMES[department];
      const bot = await loadGovernedBotByName(botName);
      if (!bot) {
        toast.error(`Review bot "${botName}" not found in Bot Builder. Create it in Admin → Bot Registry → Create New Bot.`);
        setAiRunning(false);
        return;
      }

      // 2. Split blocks: only blocks WITH actual content can be AI-reviewed.
      //    Empty blocks get auto-flagged as NOT DRAFTED.
      const allBlocks = filteredBlocks.map((b: any) => ({
        id: b.id,
        title: b.title,
        volume: b.volume,
        section_number: b.section_number,
        content: (b.content || b.editor_content || "").trim(),
      }));

      const draftedBlocks = allBlocks.filter((b: any) => b.content.length > 50); // needs meaningful content
      const emptyBlocks = allBlocks.filter((b: any) => b.content.length <= 50);

      // Auto-flag empty blocks — the system does NOT lie about these
      const emptyFlags: any[] = emptyBlocks.map((b: any) => ({
        block_id: b.id,
        severity: "high",
        issue: `BLOCK NOT DRAFTED — this block has no content (or less than 50 characters). Cannot perform cross-reference review on empty blocks.`,
        recommendation: `Draft this block in the Tender Drafting stage before running the ${DEPARTMENT_LABELS[department]} review. Without content, no validation is possible.`,
        department,
      }));

      if (draftedBlocks.length === 0 && emptyBlocks.length > 0) {
        // ALL blocks are empty — save empty-flags and warn user
        const res = await saveBlockAIFlags(tenderId, department, emptyFlags, bot.id);
        if (res.success) {
          toast.warning(`${emptyBlocks.length} block(s) have NO content — flagged as NOT DRAFTED. Draft blocks first, then run the AI review.`);
          reload();
        }
        setAiRunning(false);
        return;
      }

      if (draftedBlocks.length === 0) {
        toast.error("No blocks to review.");
        setAiRunning(false);
        return;
      }

      // Build department-specific context from previous stages
      const contextData: Record<string, any> = {
        tender_name: t.name || t.title || "",
        customer: t.customerName || "",
        estimated_value: t.estimatedValue || 0,
        target_gp_percent: t.targetGpPercent || 0,
        submission_deadline: t.submissionDeadline || "",
      };

      if (department === "ops") {
        contextData.solution_design = t.solutionDesignData ?? {};
        contextData.sow_data = t.sowData ?? {};
        contextData.risk_snapshot = t.riskSnapshotData ?? {};
        contextData.technical_qualification = t.technicalQualificationData ?? {};
        contextData.sow_qualification = t.sowQualificationData ?? {};
      } else if (department === "finance") {
        contextData.pricing_data = t.pricingData ?? {};
        contextData.bid_no_bid_data = t.bidNoBidData ?? {};
        contextData.solution_design_cost_drivers = (t.solutionDesignData ?? {}).cost_drivers ?? {};
      } else if (department === "legal") {
        contextData.risk_snapshot = t.riskSnapshotData ?? {};
        contextData.customer_fit = t.customerFitData ?? {};
        contextData.compliance_coverage = (t.tenderDraftingData ?? {}).compliance_coverage ?? {};
        contextData.pricing_commercial_terms = ((t.pricingData ?? {}).commercial_terms) ?? {};
      }

      const docs = ws.documents ?? [];
      contextData.uploaded_documents = docs.map((d: any) => ({
        name: d.document_name,
        type: d.document_type,
        category: d.document_category,
        status: d.status,
      }));

      // ONLY send blocks WITH content to the AI — never empty blocks
      const fullPayload = {
        proposal_blocks: draftedBlocks,
        tender_context: contextData,
      };

      console.info(`[DeptReview] ${department}: Bot "${bot.name}" (id: ${bot.id}), system_prompt length: ${bot.system_prompt.length}, sending ${draftedBlocks.length} drafted blocks`);
      if (bot.system_prompt.length < 50) {
        toast.error(`Bot "${bot.name}" has NO system prompt (${bot.system_prompt.length} chars). Update the Custom Instruction in Bot Builder.`);
        setAiRunning(false);
        return;
      }

      // 3. Call generateAI — all bot config comes from DB
      const result = generateAIUnavailable();

      console.info(`[DeptReview] ${department}: AI response length: ${result.content?.length || 0}`);
      console.info(`[DeptReview] ${department}: AI raw response (first 500 chars):`, result.content?.substring(0, 500));

      // 4. Parse JSON response — new format: array of per-block reports with quality_score + flags[]
      let aiReports: any[] = [];
      try {
        const cleaned = result.content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        aiReports = JSON.parse(cleaned);
      } catch {
        toast.error("AI returned invalid JSON. Check the bot's system prompt in Bot Builder.");
        setAiRunning(false);
        return;
      }

      console.info(`[DeptReview] ${department}: Parsed ${Array.isArray(aiReports) ? aiReports.length : 0} block report(s)`);

      // 5. Extract quality scores + flatten flags from new format
      const blockScores: Array<{ block_id: string; quality_score: number; score_rationale: string }> = [];
      let aiFlags: any[] = [];

      if (Array.isArray(aiReports)) {
        for (const report of aiReports) {
          if (report.block_id && typeof report.quality_score === 'number') {
            // New format: { block_id, quality_score, score_rationale, flags: [...] }
            blockScores.push({
              block_id: report.block_id,
              quality_score: report.quality_score,
              score_rationale: report.score_rationale || '',
            });
            // Flatten flags from nested array
            if (Array.isArray(report.flags)) {
              for (const flag of report.flags) {
                aiFlags.push({
                  block_id: report.block_id,
                  severity: flag.severity || 'medium',
                  type: flag.type || 'general',
                  issue: flag.issue || '',
                  recommendation: flag.recommendation || '',
                  source_field: flag.source_field || '',
                  source_value: flag.source_value || '',
                  block_value: flag.block_value || '',
                });
              }
            }
          } else if (report.block_id && report.severity) {
            // Old format fallback: { block_id, severity, issue, recommendation }
            aiFlags.push(report);
          }
        }
      }

      console.info(`[DeptReview] ${department}: ${blockScores.length} quality scores, ${aiFlags.length} flags extracted`);

      // 6. Merge: AI flags for drafted blocks + auto-flags for empty blocks
      const allFlags = [...aiFlags, ...emptyFlags];

      // Add score 0 for empty blocks
      for (const eb of emptyBlocks) {
        blockScores.push({
          block_id: eb.id,
          quality_score: 0,
          score_rationale: 'Block has no content — cannot be scored',
        });
      }

      if (allFlags.length > 0 || blockScores.length > 0) {
        const res = await saveBlockAIFlags(tenderId, department, allFlags, bot.id, blockScores);
        if (res.success) {
          const avgScore = blockScores.length > 0
            ? Math.round(blockScores.reduce((sum, s) => sum + s.quality_score, 0) / blockScores.length)
            : null;
          const parts: string[] = [];
          if (avgScore !== null) parts.push(`Average quality: ${avgScore}%`);
          if (aiFlags.length > 0) parts.push(`${aiFlags.length} issue(s) in ${draftedBlocks.length} block(s)`);
          if (emptyBlocks.length > 0) parts.push(`${emptyBlocks.length} block(s) NOT DRAFTED`);
          toast.success(parts.join(" · "));
          reload();
        } else {
          toast.error(res.error || "Failed to save AI flags.");
        }
      } else {
        toast.success(`AI reviewed ${draftedBlocks.length} drafted block(s) — no issues found.`);
      }
    } catch (err: any) {
      toast.error(err.message || "AI review failed.");
    }
    setAiRunning(false);
  }, [department, filteredBlocks, tenderId, reload]);

  if (filteredBlocks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Icon className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No {requiredVolumes.join(" / ")} blocks found.</p>
        <p className="text-xs mt-1">Complete the Tender Drafting stage to create proposal blocks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TenderStageTaskShell
        stageTitle="Internal Review Stage Menu"
        stageBadge="Stage 7"
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        sectionTabs={SECTION_TABS}
        stageIntelOpen={stageIntelOpen}
        onStageIntelOpenChange={setStageIntelOpen}
        metrics={intelMetrics}
        onOpenDocuments={onOpenDocuments}
        onOpenGlobalIntel={onOpenGlobalIntel}
        saved
      />
      {/* ─── 1. Department Briefing Panel ──────────────────────────── */}
      <Card className={`border ${colors.border} shadow-none overflow-hidden ${activeSection !== "briefing" ? "hidden" : ""}`}>
        <div className={`${colors.bg} px-4 py-3 flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">{DEPARTMENT_LABELS[department]} Review</h3>
            <p className="text-[10px] text-white/80">{DEPT_DESCRIPTIONS[department]}</p>
          </div>
          <Button
            size="sm"
            className="h-8 text-[11px] gap-1.5 bg-white/20 hover:bg-white/30 text-white border-white/30"
            variant="outline"
            disabled={aiRunning}
            onClick={handleRunAIReview}
          >
            {aiRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            {aiRunning ? "Analyzing..." : `Run AI ${DEPARTMENT_LABELS[department]} Review`}
          </Button>
        </div>

        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Context Data Availability */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Context Sources ({availableCount}/{totalSources} available)
                </span>
              </div>
              <div className="space-y-1">
                {contextAvailability.map(c => (
                  <div key={c.label} className="flex items-center gap-2 text-[10px]">
                    {c.available ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                    )}
                    <span className={c.available ? "text-foreground" : "text-muted-foreground line-through"}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
              {availableCount < totalSources && (
                <div className="mt-2 flex items-start gap-1.5 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Missing context data limits cross-referencing accuracy. Complete earlier stages for better results.</span>
                </div>
              )}
            </div>

            {/* Right: Review Progress + Quality Gauge */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Review Progress
                </span>
              </div>

              <div className="flex gap-3">
                {/* Quality Gauge */}
                {avgQualityScore !== null ? (() => {
                  const sc = scoreColor(avgQualityScore);
                  const circumference = 2 * Math.PI * 30;
                  const offset = circumference - (avgQualityScore / 100) * circumference;
                  return (
                    <div className={`flex flex-col items-center justify-center p-2 rounded-lg border ${sc.bg} border-slate-200 min-w-[80px]`}>
                      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200" />
                        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5"
                          className={sc.ring}
                          strokeDasharray={`${2 * Math.PI * 26}`}
                          strokeDashoffset={`${(2 * Math.PI * 26) - (avgQualityScore / 100) * (2 * Math.PI * 26)}`}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
                        />
                      </svg>
                      <span className={`text-lg font-bold ${sc.text} -mt-11`}>{avgQualityScore}%</span>
                      <span className={`text-[8px] font-semibold uppercase mt-5 ${sc.text}`}>{sc.label}</span>
                      <span className="text-[8px] text-muted-foreground">Quality Score</span>
                    </div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg border bg-slate-50 border-slate-200 min-w-[80px]">
                    <span className="text-lg font-bold text-slate-400">—</span>
                    <span className="text-[8px] text-muted-foreground mt-1">Run AI Review</span>
                    <span className="text-[8px] text-muted-foreground">to get score</span>
                  </div>
                )}

                {/* Block Status Counts */}
                <div className="flex-1 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="text-center p-1.5 rounded-md bg-slate-50 border border-slate-200">
                      <span className="text-sm font-bold text-slate-700">{pendingCount}</span>
                      <p className="text-[8px] text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-emerald-50 border border-emerald-200">
                      <span className="text-sm font-bold text-emerald-700">{approvedCount}</span>
                      <p className="text-[8px] text-muted-foreground">Approved</p>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-red-50 border border-red-200">
                      <span className="text-sm font-bold text-red-700">{rejectedCount}</span>
                      <p className="text-[8px] text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${reviewPct}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-muted-foreground text-right">{reviewPct}% reviewed</p>

                  {/* Scored blocks count */}
                  {blockQualityScores.length > 0 && (
                    <p className="text-[8px] text-muted-foreground text-right">{blockQualityScores.length}/{filteredBlocks.length} blocks scored</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 2. AI Findings Summary ─────────── */}
      <div className={activeSection !== "findings" ? "hidden" : ""}>
      {deptFlags.length > 0 ? (
        <Card className="border-amber-200 shadow-none">
          <CardHeader className="py-2 px-4 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-800">AI Findings Summary</span>
                <Badge variant="outline" className="text-[8px] border-amber-300 text-amber-700">{deptFlags.length} total</Badge>
              </div>
              <div className="flex gap-2">
                {highFlags > 0 && (
                  <Badge variant="outline" className="text-[8px] border-red-300 text-red-700 bg-red-50 gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> {highFlags} Critical
                  </Badge>
                )}
                {mediumFlags > 0 && (
                  <Badge variant="outline" className="text-[8px] border-amber-300 text-amber-700 bg-amber-50">{mediumFlags} Medium</Badge>
                )}
                {lowFlags > 0 && (
                  <Badge variant="outline" className="text-[8px] border-slate-200 text-slate-600">{lowFlags} Improvements</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {deptFlags.map((f, i) => (
                <div key={f.id || i} className={`flex items-start gap-2 text-[10px] rounded-md border px-3 py-2 ${severityColor(f.severity)}`}>
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">{f.blockTitle}:</span>{" "}
                    <span>{f.issue}</span>
                    {f.recommendation && <span className="text-muted-foreground ml-1">→ {f.recommendation}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No AI flags for this department yet.</p>
          <p className="text-xs mt-1">Run the AI review from the Briefing Panel to analyze.</p>
        </div>
      )}
      </div>

      {/* ─── 3. Block List ─────────────────────────────────────────── */}
      <div className={activeSection !== "blocks" ? "hidden" : ""}>
      {(() => {
        const drafted = filteredBlocks.filter((b: any) => ((b.content || b.editor_content || "").trim()).length > 50).length;
        const empty = filteredBlocks.length - drafted;
        return (
          <div className="flex items-center gap-2 px-1">
            <FileCheck2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Proposal Blocks ({filteredBlocks.length})
            </span>
            <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-600">{drafted} drafted</Badge>
            {empty > 0 && <Badge variant="outline" className="text-[8px] border-red-200 text-red-600">{empty} empty</Badge>}
          </div>
        );
      })()}

      {filteredBlocks.map((block: any) => {
        const isExpanded = expandedId === block.id;
        const blockStatus = block[statusKey] || "Pending";
        const blockFlags: AIReviewFlag[] = (block.ai_flags || []).filter((f: any) => f.department === department);
        const isRejecting = rejectingId === block.id;
        const isSaving = saving === block.id;
        const contentLen = ((block.content || block.editor_content || "").trim()).length;
        const isDrafted = contentLen > 50;
        const hasNotDraftedFlag = blockFlags.some(f => f.issue?.includes("NOT DRAFTED"));

        // Per-block quality score
        const blockQS = block.quality_scores?.[department];
        const blockScore = blockQS?.score ?? null;
        const blockRationale = blockQS?.rationale || "";
        const blockSC = blockScore !== null ? scoreColor(blockScore) : null;

        return (
          <Card key={block.id} className="border-border shadow-none">
            <CardHeader
              className="py-2 px-4 cursor-pointer hover:bg-muted/10"
              onClick={() => setExpandedId(isExpanded ? null : block.id)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="text-xs font-mono text-muted-foreground">{block.section_number || ""}</span>
                <span className="text-xs font-semibold flex-1">{block.title || "Untitled"}</span>
                <Badge variant="outline" className="text-[8px]">{block.volume}</Badge>
                {isDrafted ? (
                  <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-600 gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Drafted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] border-red-300 text-red-600 bg-red-50 gap-0.5">
                    <XCircle className="w-2.5 h-2.5" /> Empty
                  </Badge>
                )}
                {/* Per-block quality score badge */}
                {blockScore !== null && blockSC && (
                  <Badge variant="outline" className={`text-[8px] gap-0.5 ${blockSC.bg} ${blockSC.text} border-current/20`}>
                    {blockScore}% {blockSC.label}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[8px] ${statusBadge(blockStatus)}`}>{blockStatus}</Badge>
                {blockFlags.length > 0 && (
                  <Badge variant="outline" className={`text-[8px] gap-0.5 ${hasNotDraftedFlag ? 'border-red-300 text-red-600 bg-red-50' : 'border-amber-200 text-amber-600'}`}>
                    <AlertTriangle className="w-2.5 h-2.5" /> {blockFlags.length}
                  </Badge>
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-4 pt-0 space-y-3">
                {/* ─── Quality Score Panel ─────────────────────────── */}
                {blockScore !== null && blockSC && (
                  <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${blockSC.bg}`}>
                    {/* Mini circular gauge */}
                    <div className="relative shrink-0">
                      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/50" />
                        <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3"
                          className={blockSC.ring}
                          strokeDasharray={`${2 * Math.PI * 16}`}
                          strokeDashoffset={`${(2 * Math.PI * 16) - (blockScore / 100) * (2 * Math.PI * 16)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${blockSC.text}`}>{blockScore}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase ${blockSC.text}`}>Quality: {blockSC.label}</span>
                      </div>
                      {blockRationale && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{blockRationale}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Flags for this department */}
                {blockFlags.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot className="w-3 h-3 text-amber-600" />
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">AI Flags ({blockFlags.length})</span>
                    </div>
                    {blockFlags.map((f, i) => (
                      <div key={f.id || i} className={`flex items-start gap-2 text-[10px] rounded-md border px-3 py-2 ${severityColor(f.severity)}`}>
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{f.issue}</span>
                          {f.recommendation && <span className="text-muted-foreground ml-1">→ {f.recommendation}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {blockFlags.length === 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
                    <Info className="w-3 h-3 shrink-0" />
                    <span>No AI flags for this block. Run the AI review to analyze.</span>
                  </div>
                )}

                {/* Read-only block content */}
                <div className="rounded-md border border-border bg-muted/10 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Block Content</div>
                  {(block.content || block.editor_content) ? (
                    <div
                      className="prose prose-sm max-w-none text-xs leading-relaxed max-h-64 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: block.content || block.editor_content }}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No content drafted yet.</div>
                  )}
                </div>

                {/* Previous review info */}
                {blockStatus !== "Pending" && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>Reviewed by: <strong>{block[reviewerKey] || "Unknown"}</strong></span>
                    <span>·</span>
                    <span>{block[reviewedAtKey] ? new Date(block[reviewedAtKey]).toLocaleString() : "—"}</span>
                    {block[commentKey] && <span>· "{block[commentKey]}"</span>}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  {blockStatus === "Pending" ? (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={isSaving}
                        onClick={() => handleApprove(block.id)}
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve Block
                      </Button>
                      {isRejecting ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Textarea
                            className="h-8 text-[10px] flex-1"
                            placeholder="Reason for rejection (required)..."
                            value={rejectComment}
                            onChange={e => setRejectComment(e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[10px] gap-1"
                            disabled={isSaving || !rejectComment.trim()}
                            onClick={() => handleReject(block.id)}
                          >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Confirm Reject
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setRejectingId(null); setRejectComment(""); }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] gap-1 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setRejectingId(block.id)}
                        >
                          <XCircle className="w-3 h-3" /> Reject (Needs Rework)
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] gap-1"
                      disabled={isSaving}
                      onClick={() => handleReset(block.id)}
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Undo — Reset to Pending
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
    </div>
  );
}
