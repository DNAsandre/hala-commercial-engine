/**
 * DepartmentalReviewTab — Generic Reviewer Interface (Ops / Finance / Legal)
 *
 * Filtered view of proposal blocks for a specific department.
 * Read-only block content with AI flag display and Approve/Reject actions.
 * AI Review Sweep loads bot from DB and calls generateAI() with correct signature.
 *
 * No hardcoded bots. No mock data.
 */
import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bot, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  AlertTriangle, Loader2, RotateCcw, Shield, DollarSign, Scale,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { generateAI } from "@/lib/ai-client";
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

export default function DepartmentalReviewTab({ ws, department, requiredVolumes, reload }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const Icon = DEPT_ICONS[department];

  const filteredBlocks = useMemo(() => {
    const all = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
    return all
      .filter((b: any) => requiredVolumes.includes(b.volume))
      .map(ensureReviewFields)
      .sort((a: any, b: any) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999));
  }, [drafting.proposal_blocks, requiredVolumes]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);

  const statusKey = `${department}_status`;
  const commentKey = `${department}_comment`;
  const reviewerKey = `${department}_reviewer`;
  const reviewedAtKey = `${department}_reviewed_at`;

  const handleApprove = useCallback(async (blockId: string) => {
    setSaving(blockId);
    const res = await updateBlockReviewStatus(tenderId, blockId, department, "Approved", "");
    if (res.success) {
      toast.success("Block approved.");
      reload();
    } else {
      toast.error(res.error || "Failed to approve.");
    }
    setSaving(null);
  }, [tenderId, department, reload]);

  const handleReject = useCallback(async (blockId: string) => {
    if (!rejectComment.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setSaving(blockId);
    const res = await updateBlockReviewStatus(tenderId, blockId, department, "Rejected", rejectComment.trim());
    if (res.success) {
      toast.success("Block rejected — sent to Exceptions inbox.");
      setRejectingId(null);
      setRejectComment("");
      reload();
    } else {
      toast.error(res.error || "Failed to reject.");
    }
    setSaving(null);
  }, [tenderId, department, rejectComment, reload]);

  const handleReset = useCallback(async (blockId: string) => {
    setSaving(blockId);
    const res = await updateBlockReviewStatus(tenderId, blockId, department, "Pending", "");
    if (res.success) {
      toast.success("Block reset to Pending.");
      reload();
    } else {
      toast.error(res.error || "Failed to reset.");
    }
    setSaving(null);
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

      // 2. Prepare blocks + FULL CONTEXT from previous stages for cross-referencing
      const t = ws.tender as any;
      const blocksForReview = filteredBlocks.map((b: any) => ({
        id: b.id,
        title: b.title,
        volume: b.volume,
        section_number: b.section_number,
        content: b.content || b.editor_content || "",
      }));

      if (blocksForReview.length === 0) {
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
        // Ops needs: Solution Design, SOW, Risk Snapshot, SLAs
        contextData.solution_design = t.solutionDesignData ?? {};
        contextData.sow_data = t.sowData ?? {};
        contextData.risk_snapshot = t.riskSnapshotData ?? {};
        contextData.technical_qualification = t.technicalQualificationData ?? {};
        contextData.sow_qualification = t.sowQualificationData ?? {};
      } else if (department === "finance") {
        // Finance needs: P&L/Pricing, Bid/No-Bid, Commercial terms
        contextData.pricing_data = t.pricingData ?? {};
        contextData.bid_no_bid_data = t.bidNoBidData ?? {};
        contextData.solution_design_cost_drivers = (t.solutionDesignData ?? {}).cost_drivers ?? {};
      } else if (department === "legal") {
        // Legal needs: Risk Snapshot, Customer Fit, Compliance, SOW terms
        contextData.risk_snapshot = t.riskSnapshotData ?? {};
        contextData.customer_fit = t.customerFitData ?? {};
        contextData.compliance_coverage = (t.tenderDraftingData ?? {}).compliance_coverage ?? {};
        contextData.pricing_commercial_terms = ((t.pricingData ?? {}).commercial_terms) ?? {};
      }

      // Include uploaded document metadata (names + types, not full content)
      const docs = ws.documents ?? [];
      contextData.uploaded_documents = docs.map((d: any) => ({
        name: d.document_name,
        type: d.document_type,
        category: d.document_category,
        status: d.status,
      }));

      const fullPayload = {
        proposal_blocks: blocksForReview,
        tender_context: contextData,
      };

      // 3. Call generateAI — all bot config comes from DB
      const result = await generateAI({
        provider: bot.provider || "openai",
        model: bot.model || "gpt-4o",
        systemPrompt: bot.system_prompt,
        userPrompt: JSON.stringify(fullPayload),
        temperature: 0.2,
        workspaceId: tenderId,
        action: `internal_review_${department}`,
        botId: bot.id,
        botName: bot.name,
      });

      // 4. Parse JSON response
      let flags: any[] = [];
      try {
        const cleaned = result.content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        flags = JSON.parse(cleaned);
      } catch {
        toast.error("AI returned invalid JSON. Check the bot's system prompt in Bot Builder.");
        setAiRunning(false);
        return;
      }

      // 5. Save flags to Supabase
      if (Array.isArray(flags) && flags.length > 0) {
        const res = await saveBlockAIFlags(tenderId, department, flags, bot.id);
        if (res.success) {
          toast.success(`AI found ${flags.length} issue(s). Review the flags below.`);
          reload();
        } else {
          toast.error(res.error || "Failed to save AI flags.");
        }
      } else {
        toast.success("AI review complete — no issues found.");
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

  const approvedCount = filteredBlocks.filter((b: any) => b[statusKey] === "Approved").length;
  const rejectedCount = filteredBlocks.filter((b: any) => b[statusKey] === "Rejected").length;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">{DEPARTMENT_LABELS[department]} Review</span>
              <Badge variant="outline" className="text-[8px]">{filteredBlocks.length} blocks</Badge>
              <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-600">{approvedCount} approved</Badge>
              {rejectedCount > 0 && (
                <Badge variant="outline" className="text-[8px] border-red-200 text-red-600">{rejectedCount} rejected</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] gap-1"
              disabled={aiRunning}
              onClick={handleRunAIReview}
            >
              {aiRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
              Run AI {DEPARTMENT_LABELS[department]} Review
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Block List */}
      {filteredBlocks.map((block: any) => {
        const isExpanded = expandedId === block.id;
        const blockStatus = block[statusKey] || "Pending";
        const deptFlags: AIReviewFlag[] = (block.ai_flags || []).filter((f: any) => f.department === department);
        const isRejecting = rejectingId === block.id;
        const isSaving = saving === block.id;

        return (
          <Card key={block.id} className="border-border shadow-none">
            <CardHeader
              className="py-2 px-4 cursor-pointer hover:bg-muted/10"
              onClick={() => setExpandedId(isExpanded ? null : block.id)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="text-xs font-mono text-muted-foreground">§{block.section_number || "?"}</span>
                <span className="text-xs font-semibold flex-1">{block.title || "Untitled"}</span>
                <Badge variant="outline" className="text-[8px]">{block.volume}</Badge>
                <Badge variant="outline" className={`text-[8px] ${statusBadge(blockStatus)}`}>{blockStatus}</Badge>
                {deptFlags.length > 0 && (
                  <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-600 gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> {deptFlags.length}
                  </Badge>
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-4 pt-0 space-y-3">
                {/* AI Flags for this department */}
                {deptFlags.length > 0 && (
                  <div className="space-y-1.5">
                    {deptFlags.map((f, i) => (
                      <div key={f.id || i} className={`flex items-start gap-2 text-[10px] rounded-md border px-3 py-2 ${severityColor(f.severity)}`}>
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{f.issue}</span>
                          {f.recommendation && <span className="text-muted-foreground ml-1">— {f.recommendation}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Read-only block content */}
                <div className="rounded-md border border-border bg-muted/10 p-3">
                  <div className="prose prose-sm max-w-none text-xs whitespace-pre-wrap">
                    {block.content || block.editor_content || "No content drafted yet."}
                  </div>
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
  );
}
