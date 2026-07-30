/**
 * SowQualification — Structured Manual SOW Qualification Capture
 *
 * Replaces old mock/AI-driven "SOW Qualification" tab in the Qualification stage.
 *
 * 6 Sections:
 *   1. Tender Intake Snapshot (read-only from tender data)
 *   2. SOW Coverage Matrix (manual assessment table — 11 rows)
 *   3. SOW Clarity Assessment (5 button-click rows)
 *   4. SOW Clarification Questions (repeatable rows)
 *   5. SOW Qualification Outcome (calculated + manual recommendation)
 *   6. Save Button
 *
 * Data: ws.tender.sowQualificationData → emptySowQualificationData() fallback
 * Save: updateTenderSowQualificationData() → type_details.sow_qualification_data
 *
 * Rules:
 * - No fake data, no AI generation, no hardcoded tender/customer facts.
 * - Manual capture only.
 * - No stage movement. No CRM change. No document-output touch.
 * - No localStorage.
 * - All fields empty or "Not Assessed" by default.
 * - Outcome stats calculated only from user-entered data.
 */

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSowQualificationData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, Plus, X,
  ClipboardList, FileText, Target, MessageSquare, BarChart3,
  Building2, MapPin, CalendarClock, DollarSign, ArrowRight,
  FolderOpen, PanelRightOpen, Maximize2, Minimize2, ChevronDown,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type CoverageStatus = "Clear" | "Partial" | "Unclear" | "Not Assessed";
type RiskLevel = "Low" | "Medium" | "High" | "Bid Blocker" | "Not Assessed";
type ClarityLevel = "Strong" | "Moderate" | "Weak" | "Not Assessed";
type ClarificationImpact = "Low" | "Medium" | "High" | "Bid Blocker";
type ClarificationStatus = "Draft" | "Submitted" | "Answered" | "Closed" | "Accepted as Assumption";
type RecommendationOutcome =
  | "Scope clear enough to proceed"
  | "Proceed with assumptions"
  | "Hold pending clarification"
  | "Escalate for management review"
  | "Do not proceed"
  | "Not decided";

interface CoverageRow {
  area: string;
  status: CoverageStatus;
  evidence: string;
  owner: string;
  risk: RiskLevel;
  clarification_needed: boolean;
}

interface ClarityAssessment {
  scope_clarity: ClarityLevel;
  volume_clarity: ClarityLevel;
  submission_instruction_clarity: ClarityLevel;
  pricing_format_clarity: ClarityLevel;
  mobilization_clarity: ClarityLevel;
}

interface ClarificationRow {
  question: string;
  sow_area: string;
  source_reference: string;
  impact: ClarificationImpact;
  owner: string;
  status: ClarificationStatus;
  buyer_response: string;
}

interface SowOutcome {
  recommendation: RecommendationOutcome;
  reason: string;
}

interface SowQualificationData {
  coverage_matrix: CoverageRow[];
  clarity_assessment: ClarityAssessment;
  clarifications: ClarificationRow[];
  outcome: SowOutcome;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS — Generic reusable options. NOT tender/customer facts.
// ═══════════════════════════════════════════════════════════

const COVERAGE_STATUS_OPTIONS: CoverageStatus[] = ["Clear", "Partial", "Unclear", "Not Assessed"];
const RISK_OPTIONS: RiskLevel[] = ["Low", "Medium", "High", "Bid Blocker", "Not Assessed"];
const CLARITY_OPTIONS: ClarityLevel[] = ["Strong", "Moderate", "Weak", "Not Assessed"];
const CLARIFICATION_IMPACT_OPTIONS: ClarificationImpact[] = ["Low", "Medium", "High", "Bid Blocker"];
const CLARIFICATION_STATUS_OPTIONS: ClarificationStatus[] = ["Draft", "Submitted", "Answered", "Closed", "Accepted as Assumption"];
const RECOMMENDATION_OPTIONS: RecommendationOutcome[] = [
  "Scope clear enough to proceed", "Proceed with assumptions",
  "Hold pending clarification", "Escalate for management review",
  "Do not proceed", "Not decided",
];

const SOW_AREA_LABELS = [
  "Warehouse Scope", "Transport Scope", "Handling / VAS",
  "Geographic Coverage", "Volume / Pallets / SQM", "SLA / KPI Requirements",
  "Insurance Requirements", "Mobilization Requirements",
  "Submission Instructions", "Pricing Format", "Contract Terms",
];

const CLARITY_ROWS: { key: keyof ClarityAssessment; label: string }[] = [
  { key: "scope_clarity", label: "Scope Clarity" },
  { key: "volume_clarity", label: "Volume Clarity" },
  { key: "submission_instruction_clarity", label: "Submission Instruction Clarity" },
  { key: "pricing_format_clarity", label: "Pricing Format Clarity" },
  { key: "mobilization_clarity", label: "Mobilization Clarity" },
];

const FUTURE_WIRING = [
  { source: "SOW Coverage Matrix", output: "Compliance Matrix / Scope Understanding" },
  { source: "Clarification Questions", output: "Clarification Log" },
  { source: "Outcome Notes", output: "Assumptions & Dependencies" },
  { source: "Submission Instruction Clarity", output: "Submission Checklist" },
];

type SowSectionKey = "snapshot" | "coverage" | "clarity" | "clarifications" | "outcome" | "wiring";

const SOW_SECTION_TABS: { key: SowSectionKey; label: string; icon: ReactNode }[] = [
  { key: "snapshot", label: "Tender Intake Snapshot", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "coverage", label: "SOW Coverage Matrix", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "clarity", label: "SOW Clarity Assessment", icon: <Target className="w-3.5 h-3.5" /> },
  { key: "clarifications", label: "SOW Clarification Questions", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "outcome", label: "SOW Qualification Outcome", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

// ═══════════════════════════════════════════════════════════
// DEFAULT DATA — All empty / "Not Assessed" only.
// ═══════════════════════════════════════════════════════════

function emptySowQualificationData(): SowQualificationData {
  return {
    coverage_matrix: SOW_AREA_LABELS.map(area => ({
      area, status: "Not Assessed" as CoverageStatus, evidence: "",
      owner: "", risk: "Not Assessed" as RiskLevel, clarification_needed: false,
    })),
    clarity_assessment: {
      scope_clarity: "Not Assessed",
      volume_clarity: "Not Assessed",
      submission_instruction_clarity: "Not Assessed",
      pricing_format_clarity: "Not Assessed",
      mobilization_clarity: "Not Assessed",
    },
    clarifications: [],
    outcome: { recommendation: "Not decided", reason: "" },
  };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusColor(s: CoverageStatus): string {
  if (s === "Clear") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (s === "Partial") return "border-amber-300 bg-amber-50 text-amber-700";
  if (s === "Unclear") return "border-red-300 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function riskColor(r: RiskLevel): string {
  if (r === "Low") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (r === "Medium") return "border-amber-300 bg-amber-50 text-amber-700";
  if (r === "High") return "border-red-300 bg-red-50 text-red-700";
  if (r === "Bid Blocker") return "border-red-400 bg-red-100 text-red-800 font-semibold";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function clarityBtnClass(selected: boolean, level: ClarityLevel): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (level === "Strong") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (level === "Moderate") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (level === "Weak") return "bg-red-100 border-red-300 text-red-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function SowQualification({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const t = ws.tender;
  const tenderId = t.id;

  // ── State ─────────────────────────────────────────────────
  const [data, setData] = useState<SowQualificationData>(() => {
    if (t.sowQualificationData && typeof t.sowQualificationData === "object") {
      const saved = t.sowQualificationData as any;
      return {
        coverage_matrix: Array.isArray(saved.coverage_matrix) && saved.coverage_matrix.length === 11
          ? saved.coverage_matrix
          : emptySowQualificationData().coverage_matrix,
        clarity_assessment: { ...emptySowQualificationData().clarity_assessment, ...(saved.clarity_assessment || {}) },
        clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : [],
        outcome: { ...emptySowQualificationData().outcome, ...(saved.outcome || {}) },
      };
    }
    return emptySowQualificationData();
  });

  const [initial, setInitial] = useState(() => JSON.stringify(data));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(data) !== initial;

  // Reload if tender changes — but only if user hasn't made local edits
  useEffect(() => {
    if (t.sowQualificationData && typeof t.sowQualificationData === "object") {
      const saved = t.sowQualificationData as any;
      const loaded: SowQualificationData = {
        coverage_matrix: Array.isArray(saved.coverage_matrix) && saved.coverage_matrix.length === 11
          ? saved.coverage_matrix
          : emptySowQualificationData().coverage_matrix,
        clarity_assessment: { ...emptySowQualificationData().clarity_assessment, ...(saved.clarity_assessment || {}) },
        clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : [],
        outcome: { ...emptySowQualificationData().outcome, ...(saved.outcome || {}) },
      };
      const loadedStr = JSON.stringify(loaded);
      setData(prev => {
        if (JSON.stringify(prev) === initial) return loaded;
        return prev;
      });
      setInitial(() => loadedStr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.sowQualificationData]);

  // ── Inner SOW workspace controls ──────────────────────────
  const [activeSection, setActiveSection] = useState<SowSectionKey>("snapshot");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [tableFocus, setTableFocus] = useState(false);

  // ── Updaters ──────────────────────────────────────────────
  const updateCoverage = useCallback((idx: number, patch: Partial<CoverageRow>) => {
    setData(prev => {
      const rows = [...prev.coverage_matrix];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, coverage_matrix: rows };
    });
  }, []);

  const updateClarity = useCallback((key: keyof ClarityAssessment, value: ClarityLevel) => {
    setData(prev => ({
      ...prev,
      clarity_assessment: { ...prev.clarity_assessment, [key]: value },
    }));
  }, []);

  const addClarification = useCallback(() => {
    setData(prev => ({
      ...prev,
      clarifications: [...prev.clarifications, {
        question: "", sow_area: "", source_reference: "",
        impact: "Medium" as ClarificationImpact, owner: "",
        status: "Draft" as ClarificationStatus, buyer_response: "",
      }],
    }));
  }, []);

  const updateClarification = useCallback((idx: number, patch: Partial<ClarificationRow>) => {
    setData(prev => {
      const rows = [...prev.clarifications];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, clarifications: rows };
    });
  }, []);

  const removeClarification = useCallback((idx: number) => {
    setData(prev => ({ ...prev, clarifications: prev.clarifications.filter((_, i) => i !== idx) }));
  }, []);

  const updateOutcome = useCallback((patch: Partial<SowOutcome>) => {
    setData(prev => ({ ...prev, outcome: { ...prev.outcome, ...patch } }));
  }, []);

  // ── Calculated stats (from user data only) ────────────────
  const stats = useMemo(() => {
    const assessed = data.coverage_matrix.filter(r => r.status !== "Not Assessed").length;
    const gaps = data.coverage_matrix.filter(r => r.status === "Partial" || r.status === "Unclear").length;
    const clarNeeded = data.coverage_matrix.filter(r => r.clarification_needed).length;
    const bidBlockers = data.coverage_matrix.filter(r => r.risk === "Bid Blocker").length
      + data.clarifications.filter(c => c.impact === "Bid Blocker").length;
    const clarityAssessed = Object.values(data.clarity_assessment).filter(v => v !== "Not Assessed").length;
    return { assessed, gaps, clarNeeded, bidBlockers, clarityAssessed, total: data.coverage_matrix.length, clarityTotal: 5 };
  }, [data]);

  const hasTableFocus = activeSection === "coverage" || activeSection === "wiring";

  useEffect(() => {
    if (!hasTableFocus) setTableFocus(false);
  }, [hasTableFocus]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateTenderSowQualificationData(tenderId, data);
      if (result.success) {
        toast.success("SOW Qualification saved.");
        setInitial(JSON.stringify(data));
        onSaved?.();
      } else {
        toast.error(result.error || "Save failed.");
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, data, onSaved]);

  // ── Tender snapshot helpers ───────────────────────────────
  const daysLeft = t.submissionDeadline
    ? Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / 86400000)
    : null;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Qualification Stage Menu
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                Stage 2
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
            {hasTableFocus && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                tableFocus
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`}
              onClick={() => setTableFocus(prev => !prev)}
            >
              {tableFocus ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              Table Focus
            </Button>
            )}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                stageIntelOpen
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`}
              onClick={() => setStageIntelOpen(prev => !prev)}
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
            </Button>
            {!dirty && stats.assessed > 0 && <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>}
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <StageIntelMetric label="Coverage Assessed" value={`${stats.assessed}/${stats.total}`} />
                <StageIntelMetric label="Partial / Unclear" value={String(stats.gaps)} />
                <StageIntelMetric label="Clarifications" value={String(stats.clarNeeded + data.clarifications.length)} />
                <StageIntelMetric label="Bid Blockers" value={String(stats.bidBlockers)} />
                <StageIntelMetric label="Recommendation" value={data.outcome.recommendation} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {SOW_SECTION_TABS.map(section => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
                  activeSection === section.key
                    ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
                    : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
                }`}
              >
                <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
                <span className="block whitespace-normal text-center">{section.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 1. Tender Intake Snapshot ───────────────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "snapshot" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SowSectionHeader title="Tender Intake Snapshot" icon={<ClipboardList className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Customer", value: t.customerName, icon: <Building2 className="w-3.5 h-3.5" /> },
                { label: "Tender", value: t.title },
                { label: "Source", value: t.source || "Not captured" },
                { label: "Region", value: t.region || "Not captured", icon: <MapPin className="w-3.5 h-3.5" /> },
                { label: "Deadline", value: t.submissionDeadline ? t.submissionDeadline.slice(0, 10) : "Not captured", icon: <CalendarClock className="w-3.5 h-3.5" /> },
                { label: "Est. Value", value: t.estimatedValue ? `SAR ${t.estimatedValue.toLocaleString()}` : "Not captured", icon: <DollarSign className="w-3.5 h-3.5" /> },
                { label: "Target GP", value: t.targetGpPercent ? `${t.targetGpPercent}%` : "Not captured" },
                { label: "Owner", value: t.assignedOwner || "Not captured" },
                { label: "Readiness", value: `${ws.readinessScore}%` },
                { label: "Days Left", value: daysLeft !== null ? `${daysLeft} days` : "Not captured" },
              ].map(f => (
                <div key={f.label} className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                  <div className="flex items-center gap-1.5">
                    {f.icon && <span className="text-slate-400">{f.icon}</span>}
                    <span className="text-xs font-medium px-2 py-1 rounded bg-muted/30">{f.value}</span>
                  </div>
                </div>
              ))}
            </div>
        </CardContent>
      </Card>

      {/* ── 2. SOW Coverage Matrix ──────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "coverage" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SowSectionHeader title="SOW Coverage Matrix" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${stats.assessed}/${stats.total} assessed`} />
        </CardHeader>
        <CardContent className="p-0">
            <div className={`overflow-x-auto ${tableFocus ? "mx-[-12px]" : ""}`}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left p-2 font-semibold text-muted-foreground">SOW Area</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground w-28">Status</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground">Evidence / Source</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground w-24">Owner</th>
                    <th className="text-center p-2 font-semibold text-muted-foreground w-28">Risk</th>
                    <th className="text-center p-2 font-semibold text-muted-foreground w-16">Clarif.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage_matrix.map((row, idx) => (
                    <tr key={row.area} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="p-2 font-medium">{row.area}</td>
                      <td className="p-2">
                        <select className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-card w-full"
                          value={row.status} onChange={e => updateCoverage(idx, { status: e.target.value as CoverageStatus })}>
                          {COVERAGE_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                          value={row.evidence} onChange={e => updateCoverage(idx, { evidence: e.target.value })} placeholder="" />
                      </td>
                      <td className="p-2">
                        <input className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                          value={row.owner} onChange={e => updateCoverage(idx, { owner: e.target.value })} placeholder="" />
                      </td>
                      <td className="p-2 text-center">
                        <select className={`text-[10px] border rounded px-1.5 py-0.5 w-full ${riskColor(row.risk)}`}
                          value={row.risk} onChange={e => updateCoverage(idx, { risk: e.target.value as RiskLevel })}>
                          {RISK_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button type="button"
                          className={`w-5 h-5 rounded border text-[9px] font-bold transition-colors ${
                            row.clarification_needed
                              ? "bg-amber-100 border-amber-400 text-amber-700"
                              : "bg-card border-border text-muted-foreground/40 hover:bg-muted/30"
                          }`}
                          onClick={() => updateCoverage(idx, { clarification_needed: !row.clarification_needed })}
                          title={row.clarification_needed ? "Clarification needed" : "No clarification needed"}
                        >
                          {row.clarification_needed ? "Y" : "N"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </CardContent>
      </Card>

      {/* ── 3. SOW Clarity Assessment ──────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "clarity" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SowSectionHeader title="SOW Clarity Assessment" icon={<Target className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${stats.clarityAssessed}/${stats.clarityTotal} assessed`} />
        </CardHeader>
        <CardContent className="p-4">
            <div className="space-y-3">
              {CLARITY_ROWS.map(dim => (
                <div key={dim.key} className="grid grid-cols-[180px_1fr] gap-3 items-center">
                  <label className="text-xs font-medium text-muted-foreground">{dim.label}</label>
                  <div className="flex gap-1.5">
                    {CLARITY_OPTIONS.map(opt => (
                      <button key={opt} type="button"
                        className={`text-[10px] px-3 py-1 rounded-full border transition-colors ${
                          clarityBtnClass(data.clarity_assessment[dim.key] === opt, opt)
                        }`}
                        onClick={() => updateClarity(dim.key, data.clarity_assessment[dim.key] === opt ? "Not Assessed" : opt)}
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
      </Card>

      {/* ── 4. SOW Clarification Questions ─────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "clarifications" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SowSectionHeader title="SOW Clarification Questions" icon={<MessageSquare className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${data.clarifications.length} questions`} />
        </CardHeader>
        <CardContent className="p-4 space-y-2">
            {data.clarifications.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No clarification questions captured yet.</p>
            )}
            {data.clarifications.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeClarification(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-muted-foreground">Question</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.question} onChange={e => updateClarification(idx, { question: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">SOW Area</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.sow_area} onChange={e => updateClarification(idx, { sow_area: e.target.value })}>
                      <option value="">Select...</option>
                      {SOW_AREA_LABELS.map(o => <option key={o}>{o}</option>)}
                    </select>
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
              <Plus className="w-3 h-3" /> Add Clarification Question
            </Button>
        </CardContent>
      </Card>

      {/* ── 5. SOW Qualification Outcome ───────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "outcome" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SowSectionHeader title="SOW Qualification Outcome" icon={<BarChart3 className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-lg border border-border p-2.5 bg-card">
                <p className="text-lg font-bold font-mono">{stats.assessed}/{stats.total}</p>
                <p className="text-[9px] text-muted-foreground">Areas Assessed</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.gaps > 0 ? "text-amber-600" : ""}`}>{stats.gaps}</p>
                <p className="text-[9px] text-muted-foreground">Partial / Unclear</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 bg-card">
                <p className="text-lg font-bold font-mono">{stats.clarNeeded + data.clarifications.length}</p>
                <p className="text-[9px] text-muted-foreground">Clarifications</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.bidBlockers > 0 ? "text-red-600" : ""}`}>{stats.bidBlockers}</p>
                <p className="text-[9px] text-muted-foreground">Bid Blockers</p>
              </div>
            </div>

            {/* Recommendation */}
            <div className="border border-border rounded-lg p-3 bg-card space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recommendation</label>
                <select className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5"
                  value={data.outcome.recommendation}
                  onChange={e => updateOutcome({ recommendation: e.target.value as RecommendationOutcome })}>
                  {RECOMMENDATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <p className="text-[9px] text-muted-foreground mt-0.5">Advisory only — does not move tender stage.</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason / Notes</label>
                <textarea className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5 min-h-[48px]" rows={2}
                  value={data.outcome.reason}
                  onChange={e => updateOutcome({ reason: e.target.value })}
                  placeholder="" />
              </div>
            </div>
        </CardContent>
      </Card>

      {/* ── Output Use (informational) ──────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SowSectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-0">
            <div className={`overflow-x-auto ${tableFocus ? "mx-[-12px]" : ""}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="text-left p-2 font-semibold text-muted-foreground">Source</th>
                  <th className="text-left p-2 font-semibold text-muted-foreground">→ Output</th>
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
            </div>
        </CardContent>
      </Card>

      {/* ── 6. Save Button ─────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" className="hala-save-button gap-1.5 h-9 text-xs px-5" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save SOW Qualification
        </Button>
        {dirty && <span className="text-[10px] text-amber-600">You have unsaved changes.</span>}
        {!dirty && stats.assessed > 0 && <span className="text-[10px] text-emerald-600">✓ Saved</span>}
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

function SowSectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left group">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}
