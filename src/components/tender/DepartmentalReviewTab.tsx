/**
 * DepartmentalReviewTab — Per-department block review.
 *
 * Each department gets:
 * - Department-specific briefing panel with context data availability
 * - Approve / Reject workflow per block (human decisions, persisted per block)
 *
 * Stored review flags and quality scores remain visible as read-only evidence.
 * Bot selection and execution belong to the Admin-configured bot runtime, not
 * to this tracker component.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, DollarSign, Scale, CheckCircle2, XCircle, AlertTriangle,
  Loader2, ChevronRight, ChevronDown, RotateCcw, Database, FileCheck2,
  Eye, Info,
} from "lucide-react";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
import { updateBlockReviewStatus } from "@/lib/supabase-tender-actions";
import { getCurrentUser } from "@/lib/auth-state";
import { reportSaveOutcome } from "./tender-save-outcome";
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

  type DeptSection = "briefing" | "blocks";
  const SECTION_TABS: TenderStageSectionTab<DeptSection>[] = [
    { key: "briefing", label: "Briefing Panel", icon: <Database className="w-3.5 h-3.5" /> },
    { key: "blocks", label: "Block Review", icon: <FileCheck2 className="w-3.5 h-3.5" /> },
  ];
  const [activeSection, setActiveSection] = useState<DeptSection>("briefing");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

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
  const intelMetrics: TenderStageMetric[] = [
    { label: "Department", value: DEPARTMENT_LABELS[department] },
    { label: "Review Progress", value: `${reviewPct}% (${approvedCount}/${filteredBlocks.length})` },
    { label: "Context Sources", value: `${availableCount}/${totalSources} available` },
    { label: "Stored Review Flags", value: `${deptFlags.length} (${highFlags} critical)` },
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

  // P4 (F1-F3): every review decision explicitly records the SESSION user as
  // the reviewer (auth-state mirror; signed-out records its honest
  // "Unauthenticated" literal) — never an omitted arg or a "System" default.
  const handleApprove = useCallback(async (blockId: string) => {
    setSaving(blockId);
    try {
      const res = await updateBlockReviewStatus(tenderId, blockId, department, "Approved", "", getCurrentUser().name);
      if (reportSaveOutcome(res, "Block approved.")) reload();
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve.");
    } finally {
      setSaving(null);
    }
  }, [tenderId, department, reload]);

  const handleReject = useCallback(async (blockId: string) => {
    setSaving(blockId);
    try {
      const res = await updateBlockReviewStatus(tenderId, blockId, department, "Rejected", rejectComment, getCurrentUser().name);
      if (reportSaveOutcome(res, "Block rejected — sent to Exceptions.")) {
        // Only a confirmed write clears the typed rejection reason; a stale or
        // failed save keeps it on screen for a non-destructive retry.
        setRejectingId(null);
        setRejectComment("");
        reload();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject.");
    } finally {
      setSaving(null);
    }
  }, [tenderId, department, rejectComment, reload]);

  const handleReset = useCallback(async (blockId: string) => {
    setSaving(blockId);
    try {
      const res = await updateBlockReviewStatus(tenderId, blockId, department, "Pending", "", getCurrentUser().name);
      if (reportSaveOutcome(res, "Review decision reset to pending.")) reload();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset.");
    } finally {
      setSaving(null);
    }
  }, [tenderId, department, reload]);

  if (filteredBlocks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Icon className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No {requiredVolumes.join(" / ")} blocks found.</p>
        <p className="text-xs mt-1">Complete the Tender Drafting stage to create proposal blocks.</p>
      </div>
    );
  }

  // TCW-T4 (B11): real badge state — decisions persist on click, so "Unsaved"
  // is exactly a typed-but-unconfirmed rejection reason; "Saved" requires at
  // least one stored review record for this department and no pending input;
  // an untouched review renders the grey "Not Saved".
  const pendingRejectInput = rejectingId !== null && rejectComment.trim() !== "";
  const hasStoredReviewData = approvedCount > 0 || rejectedCount > 0 || deptFlags.length > 0;

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
        saved={hasStoredReviewData && !pendingRejectInput}
        unsaved={pendingRejectInput}
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
                    <span className="text-[8px] text-muted-foreground mt-1">No quality score recorded</span>
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

      {/* ─── 2. Block List ─────────────────────────────────────────── */}
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
                      <Info className="w-3 h-3 text-amber-600" />
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">Stored Review Flags ({blockFlags.length})</span>
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
                    <span>No review flags are stored for this block.</span>
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
