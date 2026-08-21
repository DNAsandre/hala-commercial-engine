/**
 * DecisionRecordTab — Formal Bid / No-Bid Decision Record
 *
 * 2 Base Sub-Sections (sub-tabs) + 2 Conditional:
 *   1. Formal Decision Record
 *   2. Decision Evidence (repeatable)
 *   + If Bid → If Bid — Next Steps (only when final decision is "Bid")
 *   + If No-Bid → If No-Bid — Reason (only when final decision is "No-Bid")
 *   + Save Button
 *
 * Data: ws.tender.bidNoBidData.decision_record
 * Save: updateTenderBidNoBidData → merges decision_record only
 *
 * This is NOT an activity/audit feed.
 * This is a structured decision record.
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
  Loader2, Save, ChevronDown, Plus, X,
  Stamp, CheckCircle2, XCircle, FileText,
  FolderOpen, BarChart3, PanelRightOpen,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type FinalDecision = "Bid" | "No-Bid" | "Hold" | "Escalated" | "Not Decided";
type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Not Required" | "Not Assessed";
type NextStage = "Solution Design" | "P&L / Pricing" | "Tender Drafting" | "Other" | "Not Decided";
type YesNoNA = "Yes" | "No" | "Not Assessed";
type NoBidReason = "Poor Fit" | "Low Margin" | "Insufficient Capability" | "Risk Too High" | "Deadline Impossible" | "Missing Mandatory Requirement" | "Commercially Unattractive" | "Strategic Mismatch" | "Other" | "Not Assessed";
type EvidenceType = "Qualification Summary" | "Technical Evidence" | "Risk Evidence" | "Customer Fit Evidence" | "Commercial Evidence" | "Approval Evidence" | "Other";

interface FormalRecord {
  decision: FinalDecision;
  decision_date: string;
  decision_owner: string;
  approver: string;
  approval_status: ApprovalStatus;
  decision_summary: string;
  conditions: string;
  clarifications_required: string;
}

interface IfBidData {
  approved_next_stage: NextStage;
  approved_to_commit: YesNoNA;
  proposal_authorized: YesNoNA;
}

interface IfNoBidData {
  reason: NoBidReason;
  notes: string;
}

interface EvidenceRow {
  evidence_type: EvidenceType | "";
  description: string;
  source: string;
  document_reference: string;
  owner: string;
}

type DecisionRecordSectionKey = "formal" | "evidence" | "if_bid" | "if_no_bid";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const FINAL_DECISION_OPTIONS: FinalDecision[] = ["Bid", "No-Bid", "Hold", "Escalated", "Not Decided"];
const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = ["Pending", "Approved", "Rejected", "Not Required", "Not Assessed"];
const NEXT_STAGE_OPTIONS: NextStage[] = ["Solution Design", "P&L / Pricing", "Tender Drafting", "Other", "Not Decided"];
const YES_NO_OPTIONS: YesNoNA[] = ["Yes", "No", "Not Assessed"];
const NO_BID_REASON_OPTIONS: NoBidReason[] = [
  "Poor Fit", "Low Margin", "Insufficient Capability", "Risk Too High",
  "Deadline Impossible", "Missing Mandatory Requirement", "Commercially Unattractive",
  "Strategic Mismatch", "Other", "Not Assessed",
];
const EVIDENCE_TYPE_OPTIONS: EvidenceType[] = [
  "Qualification Summary", "Technical Evidence", "Risk Evidence",
  "Customer Fit Evidence", "Commercial Evidence", "Approval Evidence", "Other",
];

// ═══════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════

function emptyFormal(): FormalRecord {
  return { decision: "Not Decided", decision_date: "", decision_owner: "", approver: "", approval_status: "Not Assessed", decision_summary: "", conditions: "", clarifications_required: "" };
}
function emptyIfBid(): IfBidData {
  return { approved_next_stage: "Not Decided", approved_to_commit: "Not Assessed", proposal_authorized: "Not Assessed" };
}
function emptyIfNoBid(): IfNoBidData {
  return { reason: "Not Assessed", notes: "" };
}
function emptyEvidence(): EvidenceRow {
  return { evidence_type: "", description: "", source: "", document_reference: "", owner: "" };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusBtnClass(selected: boolean, status: string): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (status === "Bid" || status === "Yes" || status === "Approved") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (status === "Hold" || status === "Pending" || status === "Escalated") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (status === "No-Bid" || status === "No" || status === "Rejected") return "bg-red-100 border-red-300 text-red-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

/**
 * TCW-T3 (P2b) — this tab's patch carries ONLY its own bid_no_bid_data key
 * (decision_record). The write layer patch-merges, so sibling tabs' keys are
 * preserved by the STORED facet — never re-sent from a page-load copy.
 * Exported pure for direct testing.
 */
export function buildDecisionRecordPatch(
  formal: FormalRecord,
  ifBid: IfBidData,
  ifNoBid: IfNoBidData,
  evidence: EvidenceRow[],
): Record<string, any> {
  return { decision_record: { formal, if_bid: ifBid, if_no_bid: ifNoBid, evidence } };
}

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function DecisionRecordTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.bidNoBidData as any;
  const dr = existing?.decision_record;

  const [formal, setFormal] = useState<FormalRecord>(() => {
    if (dr?.formal && typeof dr.formal === "object") return { ...emptyFormal(), ...dr.formal };
    return emptyFormal();
  });

  const [ifBid, setIfBid] = useState<IfBidData>(() => {
    if (dr?.if_bid && typeof dr.if_bid === "object") return { ...emptyIfBid(), ...dr.if_bid };
    return emptyIfBid();
  });

  const [ifNoBid, setIfNoBid] = useState<IfNoBidData>(() => {
    if (dr?.if_no_bid && typeof dr.if_no_bid === "object") return { ...emptyIfNoBid(), ...dr.if_no_bid };
    return emptyIfNoBid();
  });

  const [evidence, setEvidence] = useState<EvidenceRow[]>(() => {
    return Array.isArray(dr?.evidence) ? dr.evidence : [];
  });

  const [saving, setSaving] = useState(false);
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const showIfBid = formal.decision === "Bid";
  const showIfNoBid = formal.decision === "No-Bid";

  // Default to "formal" unless conditional tabs apply
  const [activeSection, setActiveSection] = useState<DecisionRecordSectionKey>("formal");

  // Build sub-tab list dynamically based on decision
  const sectionTabs: { key: DecisionRecordSectionKey; label: string; icon: ReactNode }[] = useMemo(() => {
    const tabs: { key: DecisionRecordSectionKey; label: string; icon: ReactNode }[] = [
      { key: "formal", label: "Formal Decision Record", icon: <Stamp className="w-3.5 h-3.5" /> },
      { key: "evidence", label: "Decision Evidence", icon: <FileText className="w-3.5 h-3.5" /> },
    ];
    if (showIfBid) tabs.push({ key: "if_bid", label: "If Bid — Next Steps", icon: <CheckCircle2 className="w-3.5 h-3.5" /> });
    if (showIfNoBid) tabs.push({ key: "if_no_bid", label: "If No-Bid — Reason", icon: <XCircle className="w-3.5 h-3.5" /> });
    return tabs;
  }, [showIfBid, showIfNoBid]);

  const addEvidence = () => setEvidence(p => [...p, emptyEvidence()]);
  const removeEvidence = (i: number) => setEvidence(p => p.filter((_, idx) => idx !== i));
  const updateEvidence = (i: number, f: keyof EvidenceRow, v: any) => setEvidence(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  // Stats for stage intel
  const stats = useMemo(() => {
    return {
      decisionSet: formal.decision !== "Not Decided",
      approverSet: !!formal.approver && formal.approver.trim().length > 0,
      conditionsSet: !!formal.conditions && formal.conditions.trim().length > 0,
      evidenceCount: evidence.length,
    };
  }, [formal, evidence]);

  const staleRetryArmed = useRef(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderBidNoBidData(tenderId, buildDecisionRecordPatch(formal, ifBid, ifNoBid, evidence), {
            expectedRevision,
            reason: "Decision Record tab saved",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Decision Record saved.", failed: "Save failed" },
        onConfirmed: () => onSaved?.(),
      });
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, formal, ifBid, ifNoBid, evidence, onSaved, ws]);

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
              {(existing?.decision_record?.formal || existing?.decision_record?.evidence?.length) && (
                <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>
              )}
            </div>
          </div>

          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <StageIntelMetric label="Final Decision" value={formal.decision} />
                <StageIntelMetric label="Approver" value={stats.approverSet ? formal.approver : "Not set"} />
                <StageIntelMetric label="Conditions" value={stats.conditionsSet ? "Set" : "Not set"} />
                <StageIntelMetric label="Evidence" value={`${stats.evidenceCount} item${stats.evidenceCount === 1 ? "" : "s"}`} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          <DecInnerTabs tabs={sectionTabs} activeKey={activeSection} onSelect={setActiveSection} />
        </CardContent>
      </Card>

      {/* ── 1. Formal Decision Record ──────────────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "formal" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <DecSectionHeader title="Formal Decision Record" icon={<Stamp className="w-3.5 h-3.5 text-[#075eea]" />} badge={formal.decision !== "Not Decided" ? formal.decision : "Not Decided"} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Final Decision</label>
            <div className="flex flex-wrap gap-1.5">
              {FINAL_DECISION_OPTIONS.map(opt => (
                <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(formal.decision === opt, opt)}`} onClick={() => setFormal(p => ({ ...p, decision: opt }))}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Date</label>
              <input type="date" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={formal.decision_date} onChange={e => setFormal(p => ({ ...p, decision_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Owner</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Owner..." value={formal.decision_owner} onChange={e => setFormal(p => ({ ...p, decision_owner: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Approver</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Approver..." value={formal.approver} onChange={e => setFormal(p => ({ ...p, approver: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approval Status</label>
            <div className="flex flex-wrap gap-1.5">
              {APPROVAL_STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(formal.approval_status === opt, opt)}`} onClick={() => setFormal(p => ({ ...p, approval_status: opt }))}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Summary</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Summary of the decision and its basis..." value={formal.decision_summary} onChange={e => setFormal(p => ({ ...p, decision_summary: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Conditions / Assumptions</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" placeholder="Enter conditions or assumptions..." value={formal.conditions} onChange={e => setFormal(p => ({ ...p, conditions: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Clarifications Required Before Proceeding</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" placeholder="Outstanding clarifications..." value={formal.clarifications_required} onChange={e => setFormal(p => ({ ...p, clarifications_required: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Decision Evidence ───────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "evidence" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <DecSectionHeader title="Decision Evidence" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${evidence.length} item${evidence.length === 1 ? "" : "s"}`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {evidence.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No decision evidence added yet.</p>
          )}
          {evidence.map((row, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeEvidence(idx)}>
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Evidence Type</label>
                  <select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.evidence_type} onChange={e => updateEvidence(idx, "evidence_type", e.target.value)}>
                    <option value="">Select...</option>
                    {EVIDENCE_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Source</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Source..." value={row.source} onChange={e => updateEvidence(idx, "source", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateEvidence(idx, "owner", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Description</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Describe the evidence..." value={row.description} onChange={e => updateEvidence(idx, "description", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Document Reference</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Doc ref..." value={row.document_reference} onChange={e => updateEvidence(idx, "document_reference", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addEvidence}>
            <Plus className="w-3 h-3" /> Add Decision Evidence
          </Button>
        </CardContent>
      </Card>

      {/* ── 3. If Bid — Next Steps (conditional) ───────────── */}
      {showIfBid && (
        <Card className={`gap-0 overflow-hidden rounded-lg border-emerald-200 py-0 shadow-none ${activeSection !== "if_bid" ? "hidden" : ""}`}>
          <CardHeader className="p-0">
            <DecSectionHeader title="If Bid — Next Steps" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />} badge="Bid" />
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approved Next Stage</label>
              <div className="flex flex-wrap gap-1.5">
                {NEXT_STAGE_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifBid.approved_next_stage === opt, opt === "Not Decided" ? "Not Assessed" : "Bid")}`} onClick={() => setIfBid(p => ({ ...p, approved_next_stage: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approved to Commit Resources</label>
                <div className="flex gap-1.5">
                  {YES_NO_OPTIONS.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifBid.approved_to_commit === opt, opt)}`} onClick={() => setIfBid(p => ({ ...p, approved_to_commit: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Proposal Production Authorized</label>
                <div className="flex gap-1.5">
                  {YES_NO_OPTIONS.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifBid.proposal_authorized === opt, opt)}`} onClick={() => setIfBid(p => ({ ...p, proposal_authorized: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 4. If No-Bid — Reason (conditional) ────────────── */}
      {showIfNoBid && (
        <Card className={`gap-0 overflow-hidden rounded-lg border-red-200 py-0 shadow-none ${activeSection !== "if_no_bid" ? "hidden" : ""}`}>
          <CardHeader className="p-0">
            <DecSectionHeader title="If No-Bid — Reason" icon={<XCircle className="w-3.5 h-3.5 text-red-600" />} badge="No-Bid" />
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">No-Bid Reason</label>
              <div className="flex flex-wrap gap-1.5">
                {NO_BID_REASON_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifNoBid.reason === opt, opt === "Not Assessed" ? "Not Assessed" : "No-Bid")}`} onClick={() => setIfNoBid(p => ({ ...p, reason: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">No-Bid Notes</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter no-bid rationale and notes..." value={ifNoBid.notes} onChange={e => setIfNoBid(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Save Button ────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="hala-save-button gap-1.5 h-9 text-xs px-5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Decision Record
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

function DecSectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function DecInnerTabs<T extends string>({
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
