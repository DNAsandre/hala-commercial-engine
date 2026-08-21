/**
 * BidDecisionTab — Manual Bid / No-Bid Decision Capture
 *
 * 3 Sub-Sections (sub-tabs):
 *   1. Decision Status
 *   2. Decision Readiness Checklist
 *   3. Decision Recommendation
 *   + Save Button
 *
 * Data: ws.tender.bidNoBidData.decision / decision_checklist / recommendation
 * Save: updateTenderBidNoBidData → type_details.bid_no_bid_data (merge)
 *
 * Rules:
 * - No fake data, no AI generation, no hardcoded tender/customer facts.
 * - Manual capture only.
 * - No stage movement. No CRM change. No document-output touch.
 * - Saving merges only decision, decision_checklist, recommendation keys.
 */

import { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { runTenderTabSave, tenderRevisionTokenOf } from "./IdentifiedStageShared";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown,
  Scale, ClipboardCheck, ArrowRight,
  FolderOpen, BarChart3, PanelRightOpen,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

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

type BidSectionKey = "decision" | "checklist" | "recommendation";

const BID_SECTION_TABS: { key: BidSectionKey; label: string; icon: ReactNode }[] = [
  { key: "decision", label: "Decision Status", icon: <Scale className="w-3.5 h-3.5" /> },
  { key: "checklist", label: "Decision Readiness Checklist", icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "Decision Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

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
  if (status === "Escalate for Management Review" || status === "Escalate") return "bg-[#075eea]/15 border-[#075eea]/30 text-[#075eea] font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

/**
 * TCW-T3 (P2b) — this tab's patch carries ONLY its own bid_no_bid_data keys
 * (decision, decision_checklist, recommendation). The write layer patch-merges,
 * so sibling tabs' keys (win_strategy, resource_commitment, decision_record)
 * are preserved by the STORED facet — never re-sent from a page-load copy.
 * Exported pure for direct testing.
 */
export function buildBidDecisionPatch(
  decision: DecisionData,
  checklist: ChecklistRow[],
  recommendation: RecommendationData,
): Record<string, any> {
  return { decision, decision_checklist: checklist, recommendation };
}

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function BidDecisionTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
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
  const [activeSection, setActiveSection] = useState<BidSectionKey>("decision");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const updateChecklist = useCallback((idx: number, field: keyof ChecklistRow, value: any) => {
    setChecklist(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  // Stats for stage intel
  const stats = useMemo(() => {
    const yesCount = checklist.filter(r => r.status === "Yes").length;
    const noCount = checklist.filter(r => r.status === "No").length;
    const partialCount = checklist.filter(r => r.status === "Partial").length;
    const recSet = recommendation.next_step !== "Not Decided";
    return { yesCount, noCount, partialCount, recSet };
  }, [checklist, recommendation]);

  const staleRetryArmed = useRef(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderBidNoBidData(tenderId, buildBidDecisionPatch(decision, checklist, recommendation), {
            expectedRevision,
            reason: "Bid Decision tab saved",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Bid Decision saved.", failed: "Save failed" },
        onConfirmed: () => onSaved?.(),
        // Stale: local form state is untouched — the user's entry stays.
      });
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, decision, checklist, recommendation, onSaved, ws]);

  return (
    <div className="space-y-4">
      {/* ── Stage Menu + Sub-Tab Bar ───────────────────────── */}
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Bid / No-Bid Stage Menu
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                Stage 3
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {onOpenDocuments && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Documents
                </Button>
              )}
              {onOpenGlobalIntel && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  Global Intelligence
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                stageIntelOpen
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`} onClick={() => setStageIntelOpen(prev => !prev)}>
                <PanelRightOpen className="w-3.5 h-3.5" />
                {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
              </Button>
              {(existing?.decision || existing?.decision_checklist?.length || existing?.recommendation) && (
                <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>
              )}
            </div>
          </div>

          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <StageIntelMetric label="Decision" value={decision.decision} />
                <StageIntelMetric label="Decision Owner" value={decision.decision_owner || "Not set"} />
                <StageIntelMetric label="Checklist Yes" value={`${stats.yesCount}/${checklist.length}`} />
                <StageIntelMetric label="Checklist No" value={String(stats.noCount)} />
                <StageIntelMetric label="Recommendation" value={stats.recSet ? recommendation.next_step : "Not Decided"} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          <BidInnerTabs tabs={BID_SECTION_TABS} activeKey={activeSection} onSelect={setActiveSection} />
        </CardContent>
      </Card>

      {/* ── 1. Decision Status ──────────────────────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "decision" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <BidSectionHeader title="Decision Status" icon={<Scale className="w-3.5 h-3.5 text-[#075eea]" />} badge={decision.decision !== "Not Decided" ? decision.decision : "Not Decided"} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
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

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Reason</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter rationale for this decision..." value={decision.decision_reason} onChange={e => setDecision(prev => ({ ...prev, decision_reason: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Decision Readiness Checklist ─────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "checklist" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <BidSectionHeader title="Decision Readiness Checklist" icon={<ClipboardCheck className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${stats.yesCount}/${checklist.length} Yes`} />
        </CardHeader>
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
      </Card>

      {/* ── 3. Decision Recommendation ──────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <BidSectionHeader title="Decision Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.next_step !== "Not Decided" ? recommendation.next_step : "Not Decided"} />
        </CardHeader>
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
      </Card>

      {/* ── Save Button ────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="hala-save-button gap-1.5 h-9 text-xs px-5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Bid Decision
        </Button>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}

function BidSectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function BidInnerTabs<T extends string>({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: { key: T; label: string; icon: ReactNode }[];
  activeKey: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
      {tabs.map(section => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
            activeKey === section.key
              ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
              : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
          }`}
        >
          <span className={`mb-1 flex justify-center ${activeKey === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
          <span className="block whitespace-normal text-center">{section.label}</span>
        </button>
      ))}
    </div>
  );
}
