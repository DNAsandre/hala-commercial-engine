/**
 * RiskSnapshot — Structured Manual Qualification Risk Capture
 *
 * Replaces old auto-generated "Risk Snapshot" tab in the Qualification stage.
 *
 * 7 Sections:
 *   1. Risk Summary (auto-calculated from user-entered risks only)
 *   2. Qualification Risk Register (repeatable manual rows)
 *   3. Risk Assessment Buttons (8 click-toggle rows)
 *   4. Mitigation Actions (repeatable rows)
 *   5. Risk Clarifications (repeatable rows)
 *   6. Risk Recommendation (manual)
 *   7. Save Button
 *
 * Data: ws.tender.riskSnapshotData → emptyRiskSnapshotData() fallback
 * Save: updateTenderRiskSnapshotData() → type_details.risk_snapshot_data
 *
 * Rules:
 * - No fake data, no AI-generated risks, no auto-derived severity.
 * - Manual capture only.
 * - No stage movement. No CRM change. No PDF Studio touch.
 * - No localStorage.
 * - Empty state shows "No risks recorded yet."
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderRiskSnapshotData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  ShieldAlert, Target, MessageSquare,
  BarChart3, Wrench, ArrowRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type RiskSeverity = "Low" | "Medium" | "High" | "Critical" | "Not Assessed";
type RiskStatus = "Open" | "In Progress" | "Mitigated" | "Accepted" | "Resolved" | "Escalated";
type RiskCategory = "Scope" | "Commercial" | "Technical" | "Operational" | "Compliance" | "HSE" | "Resource" | "Submission" | "Contractual" | "Customer" | "Financial" | "Systems / Integration" | "Other";
type AssessmentLevel = "Low" | "Medium" | "High" | "Not Assessed";
type MitigationStatus = "Open" | "In Progress" | "Done" | "Blocked" | "Deferred";
type ClarificationImpact = "Low" | "Medium" | "High" | "Bid Blocker";
type ClarificationStatus = "Draft" | "Submitted" | "Answered" | "Closed" | "Accepted as Assumption";
type RecommendationOutcome =
  | "Risk acceptable to proceed"
  | "Proceed with mitigation"
  | "Hold pending clarification"
  | "Escalate to management"
  | "Do not proceed"
  | "Not decided";

interface RiskRow {
  title: string;
  category: RiskCategory;
  severity: RiskSeverity;
  evidence: string;
  recommended_action: string;
  owner: string;
  status: RiskStatus;
  bid_blocker: boolean;
}

interface RiskAssessment {
  scope_risk: AssessmentLevel;
  deadline_risk: AssessmentLevel;
  commercial_risk: AssessmentLevel;
  technical_risk: AssessmentLevel;
  submission_risk: AssessmentLevel;
  compliance_risk: AssessmentLevel;
  resource_risk: AssessmentLevel;
  contractual_risk: AssessmentLevel;
}

interface MitigationRow {
  action: string;
  related_risk: string;
  owner: string;
  due_date: string;
  status: MitigationStatus;
  notes: string;
}

interface RiskClarificationRow {
  question: string;
  related_risk: string;
  source_reference: string;
  impact: ClarificationImpact;
  owner: string;
  status: ClarificationStatus;
  buyer_response: string;
}

interface RiskRecommendation {
  outcome: RecommendationOutcome;
  reason: string;
  reviewer: string;
}

interface RiskSnapshotData {
  register: RiskRow[];
  assessment: RiskAssessment;
  mitigation_actions: MitigationRow[];
  clarifications: RiskClarificationRow[];
  recommendation: RiskRecommendation;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const SEVERITY_OPTIONS: RiskSeverity[] = ["Low", "Medium", "High", "Critical", "Not Assessed"];
const STATUS_OPTIONS: RiskStatus[] = ["Open", "In Progress", "Mitigated", "Accepted", "Resolved", "Escalated"];
const CATEGORY_OPTIONS: RiskCategory[] = [
  "Scope", "Commercial", "Technical", "Operational", "Compliance", "HSE",
  "Resource", "Submission", "Contractual", "Customer", "Financial",
  "Systems / Integration", "Other",
];
const ASSESSMENT_OPTIONS: AssessmentLevel[] = ["Low", "Medium", "High", "Not Assessed"];
const MITIGATION_STATUS_OPTIONS: MitigationStatus[] = ["Open", "In Progress", "Done", "Blocked", "Deferred"];
const CLARIFICATION_IMPACT_OPTIONS: ClarificationImpact[] = ["Low", "Medium", "High", "Bid Blocker"];
const CLARIFICATION_STATUS_OPTIONS: ClarificationStatus[] = ["Draft", "Submitted", "Answered", "Closed", "Accepted as Assumption"];
const RECOMMENDATION_OPTIONS: RecommendationOutcome[] = [
  "Risk acceptable to proceed", "Proceed with mitigation",
  "Hold pending clarification", "Escalate to management",
  "Do not proceed", "Not decided",
];

const ASSESSMENT_ROWS: { key: keyof RiskAssessment; label: string }[] = [
  { key: "scope_risk", label: "Scope Risk" },
  { key: "deadline_risk", label: "Deadline Risk" },
  { key: "commercial_risk", label: "Commercial Risk" },
  { key: "technical_risk", label: "Technical Risk" },
  { key: "submission_risk", label: "Submission Risk" },
  { key: "compliance_risk", label: "Compliance Risk" },
  { key: "resource_risk", label: "Resource Risk" },
  { key: "contractual_risk", label: "Contractual Risk" },
];

const FUTURE_WIRING = [
  { source: "Risk Register", output: "Risk Register / Bid-No-Bid pack" },
  { source: "Mitigation Actions", output: "Risk Mitigation section" },
  { source: "Risk Clarifications", output: "Clarification Log" },
  { source: "Risk Recommendation", output: "Executive decision support" },
  { source: "Bid Blockers", output: "Management escalation" },
];

// ═══════════════════════════════════════════════════════════
// DEFAULT DATA
// ═══════════════════════════════════════════════════════════

function emptyRiskSnapshotData(): RiskSnapshotData {
  return {
    register: [],
    assessment: {
      scope_risk: "Not Assessed", deadline_risk: "Not Assessed",
      commercial_risk: "Not Assessed", technical_risk: "Not Assessed",
      submission_risk: "Not Assessed", compliance_risk: "Not Assessed",
      resource_risk: "Not Assessed", contractual_risk: "Not Assessed",
    },
    mitigation_actions: [],
    clarifications: [],
    recommendation: { outcome: "Not decided", reason: "", reviewer: "" },
  };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function sevColor(s: RiskSeverity): string {
  if (s === "Critical") return "border-red-400 bg-red-100 text-red-800 font-semibold";
  if (s === "High") return "border-red-300 bg-red-50 text-red-700";
  if (s === "Medium") return "border-amber-300 bg-amber-50 text-amber-700";
  if (s === "Low") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function assessBtnClass(selected: boolean, level: AssessmentLevel): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (level === "Low") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (level === "Medium") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (level === "High") return "bg-red-100 border-red-300 text-red-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
}

export default function RiskSnapshot({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;

  // ── State ─────────────────────────────────────────────────
  const [data, setData] = useState<RiskSnapshotData>(() => {
    if (t.riskSnapshotData && typeof t.riskSnapshotData === "object") {
      const saved = t.riskSnapshotData as any;
      return {
        register: Array.isArray(saved.register) ? saved.register : [],
        assessment: { ...emptyRiskSnapshotData().assessment, ...(saved.assessment || {}) },
        mitigation_actions: Array.isArray(saved.mitigation_actions) ? saved.mitigation_actions : [],
        clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : [],
        recommendation: { ...emptyRiskSnapshotData().recommendation, ...(saved.recommendation || {}) },
      };
    }
    return emptyRiskSnapshotData();
  });

  const [initial, setInitial] = useState(() => JSON.stringify(data));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(data) !== initial;

  useEffect(() => {
    if (t.riskSnapshotData && typeof t.riskSnapshotData === "object") {
      const saved = t.riskSnapshotData as any;
      const loaded: RiskSnapshotData = {
        register: Array.isArray(saved.register) ? saved.register : [],
        assessment: { ...emptyRiskSnapshotData().assessment, ...(saved.assessment || {}) },
        mitigation_actions: Array.isArray(saved.mitigation_actions) ? saved.mitigation_actions : [],
        clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : [],
        recommendation: { ...emptyRiskSnapshotData().recommendation, ...(saved.recommendation || {}) },
      };
      const loadedStr = JSON.stringify(loaded);
      setData(prev => {
        if (JSON.stringify(prev) === initial) return loaded;
        return prev;
      });
      setInitial(() => loadedStr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.riskSnapshotData]);

  // ── Collapsible ───────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true, register: true, assessment: true,
    mitigation: false, clarifications: false, recommendation: true, wiring: false,
  });
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Updaters ──────────────────────────────────────────────
  const addRisk = useCallback(() => {
    setData(prev => ({
      ...prev,
      register: [...prev.register, {
        title: "", category: "Other" as RiskCategory, severity: "Not Assessed" as RiskSeverity,
        evidence: "", recommended_action: "", owner: "",
        status: "Open" as RiskStatus, bid_blocker: false,
      }],
    }));
  }, []);
  const updateRisk = useCallback((idx: number, patch: Partial<RiskRow>) => {
    setData(prev => {
      const rows = [...prev.register]; rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, register: rows };
    });
  }, []);
  const removeRisk = useCallback((idx: number) => {
    setData(prev => ({ ...prev, register: prev.register.filter((_, i) => i !== idx) }));
  }, []);

  const updateAssessment = useCallback((key: keyof RiskAssessment, value: AssessmentLevel) => {
    setData(prev => ({
      ...prev,
      assessment: { ...prev.assessment, [key]: value },
    }));
  }, []);

  const addMitigation = useCallback(() => {
    setData(prev => ({
      ...prev,
      mitigation_actions: [...prev.mitigation_actions, {
        action: "", related_risk: "", owner: "", due_date: "",
        status: "Open" as MitigationStatus, notes: "",
      }],
    }));
  }, []);
  const updateMitigation = useCallback((idx: number, patch: Partial<MitigationRow>) => {
    setData(prev => {
      const rows = [...prev.mitigation_actions]; rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, mitigation_actions: rows };
    });
  }, []);
  const removeMitigation = useCallback((idx: number) => {
    setData(prev => ({ ...prev, mitigation_actions: prev.mitigation_actions.filter((_, i) => i !== idx) }));
  }, []);

  const addClarification = useCallback(() => {
    setData(prev => ({
      ...prev,
      clarifications: [...prev.clarifications, {
        question: "", related_risk: "", source_reference: "",
        impact: "Medium" as ClarificationImpact, owner: "",
        status: "Draft" as ClarificationStatus, buyer_response: "",
      }],
    }));
  }, []);
  const updateClarification = useCallback((idx: number, patch: Partial<RiskClarificationRow>) => {
    setData(prev => {
      const rows = [...prev.clarifications]; rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, clarifications: rows };
    });
  }, []);
  const removeClarification = useCallback((idx: number) => {
    setData(prev => ({ ...prev, clarifications: prev.clarifications.filter((_, i) => i !== idx) }));
  }, []);

  const updateRecommendation = useCallback((patch: Partial<RiskRecommendation>) => {
    setData(prev => ({ ...prev, recommendation: { ...prev.recommendation, ...patch } }));
  }, []);

  // ── Calculated stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const total = data.register.length;
    const critical = data.register.filter(r => r.severity === "Critical").length;
    const high = data.register.filter(r => r.severity === "High").length;
    const bidBlockers = data.register.filter(r => r.bid_blocker).length;
    const open = data.register.filter(r => r.status === "Open" || r.status === "In Progress" || r.status === "Escalated").length;
    const resolved = data.register.filter(r => r.status === "Resolved" || r.status === "Mitigated" || r.status === "Accepted").length;
    const assessedCount = Object.values(data.assessment).filter(v => v !== "Not Assessed").length;
    return { total, critical, high, bidBlockers, open, resolved, assessedCount, assessTotal: 8 };
  }, [data]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateTenderRiskSnapshotData(tenderId, data);
      if (result.success) {
        toast.success("Risk Snapshot saved.");
        setInitial(JSON.stringify(data));
      } else {
        toast.error(result.error || "Save failed.");
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, data]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">

      {/* ── 1. Risk Summary ────────────────────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Risk Summary" icon={<BarChart3 className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.summary} onToggle={() => toggle("summary")} />
        </CardHeader>
        {openSections.summary && (
          <CardContent className="p-4">
            <div className="grid grid-cols-6 gap-3 text-center">
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className="text-lg font-bold font-mono">{stats.total}</p>
                <p className="text-[9px] text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.critical > 0 ? "text-red-700" : ""}`}>{stats.critical}</p>
                <p className="text-[9px] text-muted-foreground">Critical</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.high > 0 ? "text-red-600" : ""}`}>{stats.high}</p>
                <p className="text-[9px] text-muted-foreground">High</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.bidBlockers > 0 ? "text-red-600" : ""}`}>{stats.bidBlockers}</p>
                <p className="text-[9px] text-muted-foreground">Bid Blockers</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.open > 0 ? "text-amber-600" : ""}`}>{stats.open}</p>
                <p className="text-[9px] text-muted-foreground">Open</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.resolved > 0 ? "text-emerald-600" : ""}`}>{stats.resolved}</p>
                <p className="text-[9px] text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── 2. Qualification Risk Register ─────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Qualification Risk Register" icon={<ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.register} onToggle={() => toggle("register")}
            badge={data.register.length > 0 ? `${data.register.length} risks` : undefined}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Short evidence-backed risk register for qualification-stage bid risks, blockers, mitigations, and owners.
          </p>
        </CardHeader>
        {openSections.register && (
          <CardContent className="p-4 space-y-2">
            {data.register.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-3 text-center">No risks recorded yet.</p>
            )}
            {data.register.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeRisk(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-muted-foreground">Risk Title</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.title} onChange={e => updateRisk(idx, { title: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Category</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.category} onChange={e => updateRisk(idx, { category: e.target.value as RiskCategory })}>
                      {CATEGORY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Severity</label>
                    <select className={`w-full text-[10px] border rounded px-1.5 py-0.5 ${sevColor(row.severity)}`}
                      value={row.severity} onChange={e => updateRisk(idx, { severity: e.target.value as RiskSeverity })}>
                      {SEVERITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Owner</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.owner} onChange={e => updateRisk(idx, { owner: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Status</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.status} onChange={e => updateRisk(idx, { status: e.target.value as RiskStatus })}>
                      {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-1.5 pb-0.5">
                    <label className="text-[9px] text-muted-foreground whitespace-nowrap">Bid Blocker</label>
                    <button type="button"
                      className={`w-5 h-5 rounded border text-[9px] font-bold transition-colors ${
                        row.bid_blocker
                          ? "bg-red-100 border-red-400 text-red-700"
                          : "bg-card border-border text-muted-foreground/40 hover:bg-muted/30"
                      }`}
                      onClick={() => updateRisk(idx, { bid_blocker: !row.bid_blocker })}
                    >
                      {row.bid_blocker ? "Y" : "N"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Evidence / Source</label>
                    <textarea className="w-full text-[10px] border border-border rounded px-2 py-1 bg-card min-h-[28px]" rows={1}
                      value={row.evidence} onChange={e => updateRisk(idx, { evidence: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Recommended Action</label>
                    <textarea className="w-full text-[10px] border border-border rounded px-2 py-1 bg-card min-h-[28px]" rows={1}
                      value={row.recommended_action} onChange={e => updateRisk(idx, { recommended_action: e.target.value })} placeholder="" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={addRisk}>
              <Plus className="w-3 h-3" /> Add Risk
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── 3. Risk Assessment Buttons ─────────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Risk Assessment" icon={<Target className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.assessment} onToggle={() => toggle("assessment")}
            badge={`${stats.assessedCount}/${stats.assessTotal} assessed`}
          />
        </CardHeader>
        {openSections.assessment && (
          <CardContent className="p-4">
            <div className="space-y-3">
              {ASSESSMENT_ROWS.map(dim => (
                <div key={dim.key} className="grid grid-cols-[180px_1fr] gap-3 items-center">
                  <label className="text-xs font-medium text-muted-foreground">{dim.label}</label>
                  <div className="flex gap-1.5">
                    {ASSESSMENT_OPTIONS.map(opt => (
                      <button key={opt} type="button"
                        className={`text-[10px] px-3 py-1 rounded-full border transition-colors ${
                          assessBtnClass(data.assessment[dim.key] === opt, opt)
                        }`}
                        onClick={() => updateAssessment(dim.key, data.assessment[dim.key] === opt ? "Not Assessed" : opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60 mt-3">
              Click to select. Click same button again to clear.
            </p>
          </CardContent>
        )}
      </Card>

      {/* ── 4. Mitigation Actions ──────────────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Mitigation Actions" icon={<Wrench className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.mitigation} onToggle={() => toggle("mitigation")}
            badge={data.mitigation_actions.length > 0 ? `${data.mitigation_actions.length} actions` : undefined}
          />
        </CardHeader>
        {openSections.mitigation && (
          <CardContent className="p-4 space-y-2">
            {data.mitigation_actions.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No mitigation actions captured yet.</p>
            )}
            {data.mitigation_actions.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeMitigation(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-muted-foreground">Action</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.action} onChange={e => updateMitigation(idx, { action: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Related Risk</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.related_risk} onChange={e => updateMitigation(idx, { related_risk: e.target.value })} placeholder="" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Owner</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.owner} onChange={e => updateMitigation(idx, { owner: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Due Date</label>
                    <input type="date" className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.due_date} onChange={e => updateMitigation(idx, { due_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Status</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.status} onChange={e => updateMitigation(idx, { status: e.target.value as MitigationStatus })}>
                      {MITIGATION_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Notes</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.notes} onChange={e => updateMitigation(idx, { notes: e.target.value })} placeholder="" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={addMitigation}>
              <Plus className="w-3 h-3" /> Add Mitigation Action
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── 5. Risk Clarifications ─────────────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Risk Clarifications" icon={<MessageSquare className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.clarifications} onToggle={() => toggle("clarifications")}
            badge={data.clarifications.length > 0 ? `${data.clarifications.length} questions` : undefined}
          />
        </CardHeader>
        {openSections.clarifications && (
          <CardContent className="p-4 space-y-2">
            {data.clarifications.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No risk clarifications captured yet.</p>
            )}
            {data.clarifications.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeClarification(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-muted-foreground">Clarification Question</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.question} onChange={e => updateClarification(idx, { question: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Related Risk</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.related_risk} onChange={e => updateClarification(idx, { related_risk: e.target.value })} placeholder="" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Source Reference</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.source_reference} onChange={e => updateClarification(idx, { source_reference: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Impact</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.impact} onChange={e => updateClarification(idx, { impact: e.target.value as ClarificationImpact })}>
                      {CLARIFICATION_IMPACT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Owner</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.owner} onChange={e => updateClarification(idx, { owner: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Status</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.status} onChange={e => updateClarification(idx, { status: e.target.value as ClarificationStatus })}>
                      {CLARIFICATION_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-1">
                  <label className="text-[9px] text-muted-foreground">Buyer Response</label>
                  <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                    value={row.buyer_response} onChange={e => updateClarification(idx, { buyer_response: e.target.value })} placeholder="" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={addClarification}>
              <Plus className="w-3 h-3" /> Add Risk Clarification
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── 6. Risk Recommendation ─────────────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Risk Recommendation" icon={<ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.recommendation} onToggle={() => toggle("recommendation")} />
        </CardHeader>
        {openSections.recommendation && (
          <CardContent className="p-4">
            <div className="border border-border rounded-lg p-3 bg-card space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Qualification Outcome</label>
                <select className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5"
                  value={data.recommendation.outcome}
                  onChange={e => updateRecommendation({ outcome: e.target.value as RecommendationOutcome })}>
                  {RECOMMENDATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <p className="text-[9px] text-muted-foreground mt-0.5">Advisory only — does not move tender stage.</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason / Notes</label>
                <textarea className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5 min-h-[48px]" rows={2}
                  value={data.recommendation.reason}
                  onChange={e => updateRecommendation({ reason: e.target.value })} placeholder="" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reviewer</label>
                <input className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5"
                  value={data.recommendation.reviewer}
                  onChange={e => updateRecommendation({ reviewer: e.target.value })} placeholder="" />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Future Output Use ──────────────────────────────── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <SectionToggle title="Future Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-slate-400" />} open={openSections.wiring} onToggle={() => toggle("wiring")} />
        </CardHeader>
        {openSections.wiring && (
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="text-left p-2 font-semibold text-muted-foreground">Source</th>
                  <th className="text-left p-2 font-semibold text-muted-foreground">→ Future Output</th>
                </tr>
              </thead>
              <tbody>
                {FUTURE_WIRING.map(w => (
                  <tr key={w.source} className="border-b border-border/50">
                    <td className="p-2 text-muted-foreground">{w.source}</td>
                    <td className="p-2 font-medium">{w.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </Card>

      {/* ── 7. Save Button ─────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" className="gap-1.5 h-9 text-xs px-5" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Risk Snapshot
        </Button>
        {dirty && <span className="text-[10px] text-amber-600">You have unsaved changes.</span>}
        {!dirty && stats.total > 0 && <span className="text-[10px] text-emerald-600">✓ Saved</span>}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function SectionToggle({ title, icon, open, onToggle, badge }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button type="button" className="flex items-center gap-2 w-full text-left group" onClick={onToggle}>
      {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </button>
  );
}
