/**
 * BidDecisionTab — Manual Bid / No-Bid Decision Capture
 *
 * Sections:
 *   1. Decision Status
 *   2. Decision Readiness Checklist
 *   3. Decision Recommendation Summary
 *   4. Save Button
 *
 * Data: ws.tender.bidNoBidData.decision / decision_checklist / recommendation
 * Save: updateTenderBidNoBidData → type_details.bid_no_bid_data (merge)
 *
 * Rules:
 * - No fake data, no AI generation, no hardcoded tender/customer facts.
 * - Manual capture only.
 * - No stage movement. No CRM change. No PDF Studio touch.
 * - Saving merges only decision, decision_checklist, recommendation keys.
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight,
  Scale, ClipboardCheck, ArrowRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type Decision = "Bid" | "No-Bid" | "Hold Pending Clarification" | "Escalate for Management Review" | "Not Decided";
type ApprovalRequired = "Yes" | "No" | "Not Assessed";
type ExecutiveApproval = "Pending" | "Approved" | "Rejected" | "Not Required" | "Not Assessed";
type ChecklistStatus = "Yes" | "No" | "Partial" | "Not Assessed";
type NextStep = "Proceed to Solution Design" | "Proceed to P&L / Pricing" | "Hold" | "Escalate" | "No-Bid" | "Not Decided";

interface DecisionData {
  decision: Decision;
  decision_owner: string;
  decision_date: string;
  approval_required: ApprovalRequired;
  executive_approval: ExecutiveApproval;
  decision_reason: string;
}

interface ChecklistRow {
  question: string;
  status: ChecklistStatus;
  evidence: string;
  owner: string;
}

interface RecommendationData {
  next_step: NextStep;
  conditions: string;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const DECISION_OPTIONS: Decision[] = ["Bid", "No-Bid", "Hold Pending Clarification", "Escalate for Management Review", "Not Decided"];
const APPROVAL_REQUIRED_OPTIONS: ApprovalRequired[] = ["Yes", "No", "Not Assessed"];
const EXECUTIVE_APPROVAL_OPTIONS: ExecutiveApproval[] = ["Pending", "Approved", "Rejected", "Not Required", "Not Assessed"];
const CHECKLIST_STATUS_OPTIONS: ChecklistStatus[] = ["Yes", "No", "Partial", "Not Assessed"];
const NEXT_STEP_OPTIONS: NextStep[] = ["Proceed to Solution Design", "Proceed to P&L / Pricing", "Hold", "Escalate", "No-Bid", "Not Decided"];

const CHECKLIST_QUESTIONS = [
  "SOW clear enough?",
  "Technical capability confirmed?",
  "Customer fit acceptable?",
  "Risk acceptable?",
  "Commercial opportunity attractive?",
  "Required documents available?",
  "Clarifications manageable?",
  "Submission deadline achievable?",
  "Pricing route clear?",
  "Approval path clear?",
];

// ═══════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════

function emptyDecision(): DecisionData {
  return { decision: "Not Decided", decision_owner: "", decision_date: "", approval_required: "Not Assessed", executive_approval: "Not Assessed", decision_reason: "" };
}

function emptyChecklist(): ChecklistRow[] {
  return CHECKLIST_QUESTIONS.map(q => ({ question: q, status: "Not Assessed" as ChecklistStatus, evidence: "", owner: "" }));
}

function emptyRecommendation(): RecommendationData {
  return { next_step: "Not Decided", conditions: "" };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusBtnClass(selected: boolean, status: string): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (status === "Yes" || status === "Bid" || status === "Approved") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (status === "Partial" || status === "Hold Pending Clarification" || status === "Pending") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (status === "No" || status === "No-Bid" || status === "Rejected") return "bg-red-100 border-red-300 text-red-700 font-medium";
  if (status === "Escalate for Management Review" || status === "Escalate") return "bg-violet-100 border-violet-300 text-violet-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
}

export default function BidDecisionTab({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.bidNoBidData as any;

  const [decision, setDecision] = useState<DecisionData>(() => {
    if (existing?.decision && typeof existing.decision === "object") return { ...emptyDecision(), ...existing.decision };
    return emptyDecision();
  });

  const [checklist, setChecklist] = useState<ChecklistRow[]>(() => {
    if (Array.isArray(existing?.decision_checklist) && existing.decision_checklist.length === CHECKLIST_QUESTIONS.length) {
      return existing.decision_checklist;
    }
    return emptyChecklist();
  });

  const [recommendation, setRecommendation] = useState<RecommendationData>(() => {
    if (existing?.recommendation && typeof existing.recommendation === "object") return { ...emptyRecommendation(), ...existing.recommendation };
    return emptyRecommendation();
  });

  const [saving, setSaving] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ decision: true, checklist: true, recommendation: true });

  const toggleSection = (key: string) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const updateChecklist = useCallback((idx: number, field: keyof ChecklistRow, value: any) => {
    setChecklist(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Merge only this tab's keys into bid_no_bid_data
      const patch: Record<string, any> = {
        ...(existing || {}),
        decision,
        decision_checklist: checklist,
        recommendation,
      };
      const result = await updateTenderBidNoBidData(tenderId, patch, "Bid Decision tab saved");
      if (result.success) {
        toast.success("Bid Decision saved");
      } else {
        toast.error("Save failed", { description: result.error });
      }
    } finally {
      setSaving(false);
    }
  }, [tenderId, decision, checklist, recommendation, existing]);

  // Checklist stats
  const yesCount = checklist.filter(r => r.status === "Yes").length;
  const noCount = checklist.filter(r => r.status === "No").length;
  const partialCount = checklist.filter(r => r.status === "Partial").length;

  return (
    <div className="space-y-4">
      {/* ── Section 1: Decision Status ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggleSection("decision")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.decision ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Scale className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Decision Status</span>
            <Badge variant="outline" className="text-[8px] ml-auto">
              {decision.decision !== "Not Decided" ? decision.decision : "Not Decided"}
            </Badge>
          </div>
        </CardHeader>
        {sectionsOpen.decision && (
          <CardContent className="p-4 space-y-4">
            {/* Decision */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Decision</label>
              <div className="flex flex-wrap gap-1.5">
                {DECISION_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(decision.decision === opt, opt)}`} onClick={() => setDecision(prev => ({ ...prev, decision: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Decision Owner + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Owner</label>
                <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Enter owner..." value={decision.decision_owner} onChange={e => setDecision(prev => ({ ...prev, decision_owner: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Date</label>
                <input type="date" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={decision.decision_date} onChange={e => setDecision(prev => ({ ...prev, decision_date: e.target.value }))} />
              </div>
            </div>

            {/* Approval Required + Executive Approval */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approval Required</label>
                <div className="flex flex-wrap gap-1.5">
                  {APPROVAL_REQUIRED_OPTIONS.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(decision.approval_required === opt, opt)}`} onClick={() => setDecision(prev => ({ ...prev, approval_required: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Executive Approval</label>
                <div className="flex flex-wrap gap-1.5">
                  {EXECUTIVE_APPROVAL_OPTIONS.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(decision.executive_approval === opt, opt)}`} onClick={() => setDecision(prev => ({ ...prev, executive_approval: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Decision Reason */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Reason</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter rationale for this decision..." value={decision.decision_reason} onChange={e => setDecision(prev => ({ ...prev, decision_reason: e.target.value }))} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 2: Decision Readiness Checklist ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggleSection("checklist")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.checklist ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Decision Readiness Checklist</span>
            <div className="ml-auto flex items-center gap-1.5">
              {yesCount > 0 && <Badge variant="outline" className="text-[8px] border-emerald-300 bg-emerald-50 text-emerald-700">{yesCount} Yes</Badge>}
              {partialCount > 0 && <Badge variant="outline" className="text-[8px] border-amber-300 bg-amber-50 text-amber-700">{partialCount} Partial</Badge>}
              {noCount > 0 && <Badge variant="outline" className="text-[8px] border-red-300 bg-red-50 text-red-700">{noCount} No</Badge>}
            </div>
          </div>
        </CardHeader>
        {sectionsOpen.checklist && (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[280px]">Question</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[200px]">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Evidence / Notes</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[120px]">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {checklist.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{row.question}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {CHECKLIST_STATUS_OPTIONS.map(opt => (
                            <button key={opt} type="button" className={`px-2 py-1 rounded border text-[10px] transition-colors ${statusBtnClass(row.status === opt, opt)}`} onClick={() => updateChecklist(idx, "status", opt)}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" className="w-full border border-border rounded px-2 py-1 text-xs bg-card" placeholder="Evidence..." value={row.evidence} onChange={e => updateChecklist(idx, "evidence", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" className="w-full border border-border rounded px-2 py-1 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateChecklist(idx, "owner", e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 3: Decision Recommendation ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggleSection("recommendation")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.recommendation ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Decision Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">
              {recommendation.next_step !== "Not Decided" ? recommendation.next_step : "Not Decided"}
            </Badge>
          </div>
        </CardHeader>
        {sectionsOpen.recommendation && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Recommended Next Step</label>
              <div className="flex flex-wrap gap-1.5">
                {NEXT_STEP_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(recommendation.next_step === opt, opt)}`} onClick={() => setRecommendation(prev => ({ ...prev, next_step: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Conditions Before Proceeding</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter conditions, prerequisites, or assumptions..." value={recommendation.conditions} onChange={e => setRecommendation(prev => ({ ...prev, conditions: e.target.value }))} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Save Button ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Bid Decision
        </Button>
      </div>
    </div>
  );
}
