/**
 * TechnicalQualification — Structured Manual Technical Capability Assessment
 *
 * Replaces old shallow/mock "Technical Qualification" tab in the Qualification stage.
 *
 * 6 Sections:
 *   1. Technical Fit Summary (auto-calculated from user selections only)
 *   2. Technical Capability Assessment (7 rows)
 *   3. Technical Requirement Gaps (repeatable rows)
 *   4. Technical Clarifications (repeatable rows)
 *   5. Technical Recommendation
 *   6. Save Button
 *
 * Data: ws.tender.technicalQualificationData → emptyTechnicalQualificationData() fallback
 * Save: updateTenderTechnicalQualificationData() → type_details.technical_qualification_data
 *
 * Rules:
 * - No fake data, no AI generation, no hardcoded tender/customer facts.
 * - Manual capture only.
 * - No stage movement. No CRM change. No document-output touch.
 * - No localStorage.
 * - All fields empty or "Not Assessed" by default.
 */

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderTechnicalQualificationData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  ShieldCheck, Warehouse, Truck, Cpu, FileCheck, HardHat,
  Users, Timer, AlertTriangle, MessageSquare, BarChart3,
  ArrowRight, FolderOpen, PanelRightOpen, Maximize2, Minimize2,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type FitLevel = "Strong" | "Moderate" | "Weak" | "Not Assessed";
type CapabilityStatus = "Open" | "In Progress" | "Confirmed" | "Needs Clarification" | "Blocked";
type GapSeverity = "Low" | "Medium" | "High" | "Bid Blocker";
type GapStatus = "Open" | "In Progress" | "Resolved" | "Accepted as Assumption" | "Escalated";
type GapCategory = "Warehouse" | "Transport" | "Systems" | "Compliance" | "HSE" | "Resource" | "Mobilization" | "Other";
type ClarificationImpact = "Low" | "Medium" | "High" | "Bid Blocker";
type ClarificationStatus = "Draft" | "Submitted" | "Answered" | "Closed";
type RecommendationOutcome =
  | "Technically qualified"
  | "Technically qualified with assumptions"
  | "Hold pending clarification"
  | "Escalate to Operations / Technical Review"
  | "Not technically qualified"
  | "Not decided";

interface CapabilityRow {
  area: string;
  question: string;
  fit: FitLevel;
  evidence: string;
  gap_or_concern: string;
  owner: string;
  status: CapabilityStatus;
}

interface GapRow {
  gap: string;
  category: GapCategory;
  severity: GapSeverity;
  evidence: string;
  required_action: string;
  owner: string;
  status: GapStatus;
}

interface ClarificationRow {
  question: string;
  related_area: string;
  source_reference: string;
  impact: ClarificationImpact;
  owner: string;
  status: ClarificationStatus;
  buyer_response: string;
}

interface TechRecommendation {
  outcome: RecommendationOutcome;
  reason: string;
  reviewer: string;
}

interface TechnicalQualificationData {
  capability_assessment: CapabilityRow[];
  gaps: GapRow[];
  clarifications: ClarificationRow[];
  recommendation: TechRecommendation;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const FIT_OPTIONS: FitLevel[] = ["Strong", "Moderate", "Weak", "Not Assessed"];
const CAPABILITY_STATUS_OPTIONS: CapabilityStatus[] = ["Open", "In Progress", "Confirmed", "Needs Clarification", "Blocked"];
const GAP_CATEGORY_OPTIONS: GapCategory[] = ["Warehouse", "Transport", "Systems", "Compliance", "HSE", "Resource", "Mobilization", "Other"];
const GAP_SEVERITY_OPTIONS: GapSeverity[] = ["Low", "Medium", "High", "Bid Blocker"];
const GAP_STATUS_OPTIONS: GapStatus[] = ["Open", "In Progress", "Resolved", "Accepted as Assumption", "Escalated"];
const CLARIFICATION_IMPACT_OPTIONS: ClarificationImpact[] = ["Low", "Medium", "High", "Bid Blocker"];
const CLARIFICATION_STATUS_OPTIONS: ClarificationStatus[] = ["Draft", "Submitted", "Answered", "Closed"];
const RECOMMENDATION_OPTIONS: RecommendationOutcome[] = [
  "Technically qualified", "Technically qualified with assumptions",
  "Hold pending clarification", "Escalate to Operations / Technical Review",
  "Not technically qualified", "Not decided",
];

const CAPABILITY_AREAS: { area: string; question: string; icon: React.ReactNode; guidance: string }[] = [
  { area: "Warehouse Capability", question: "Can Hala provide the required warehouse/storage capability?", icon: <Warehouse className="w-3.5 h-3.5" />, guidance: "facility location · capacity · storage type · temperature · DG / bonded / secure" },
  { area: "Transport Capability", question: "Can Hala provide the required transport capability?", icon: <Truck className="w-3.5 h-3.5" />, guidance: "fleet type · coverage · trip model · dedicated / shared · route capability" },
  { area: "Systems / WMS / TMS Fit", question: "Can Hala support required systems, tracking, reporting, integrations?", icon: <Cpu className="w-3.5 h-3.5" />, guidance: "WMS · TMS · GPS · ePOD · API / ERP integration · dashboards" },
  { area: "Compliance / License Fit", question: "Can Hala meet required compliance, licensing, and regulatory obligations?", icon: <FileCheck className="w-3.5 h-3.5" />, guidance: "ISO 9001 · ISO 45001 · Civil Defense · SFDA · DG handling · local regulatory" },
  { area: "HSE / Security Fit", question: "Can Hala meet safety, security, emergency, and HSE requirements?", icon: <HardHat className="w-3.5 h-3.5" />, guidance: "CCTV · fire systems · emergency response · staff training · pest control · HSE SOPs" },
  { area: "Resource / Manpower Fit", question: "Can Hala provide the required team, supervisors, drivers, and operational staff?", icon: <Users className="w-3.5 h-3.5" />, guidance: "manpower estimate · supervisors · drivers · coordinators · project team" },
  { area: "Mobilization Readiness", question: "Can Hala mobilize within the required timeline?", icon: <Timer className="w-3.5 h-3.5" />, guidance: "mobilization period · facility readiness · fleet readiness · staffing readiness · dependencies" },
];

const FUTURE_WIRING = [
  { source: "Warehouse Capability", output: "Solution Description / Warehouse Methodology" },
  { source: "Transport Capability", output: "Transport Methodology" },
  { source: "Systems Fit", output: "Technology & Systems" },
  { source: "Compliance Fit", output: "Compliance & Certifications" },
  { source: "HSE Fit", output: "HSE / Security section" },
  { source: "Resource Fit", output: "Team / Mobilization section" },
  { source: "Technical Gaps", output: "Assumptions / Clarifications" },
];

const RELATED_AREA_OPTIONS = CAPABILITY_AREAS.map(c => c.area);

type TechSectionKey = "summary" | "capability" | "gaps" | "clarifications" | "recommendation" | "wiring";

const TECH_SECTION_TABS: { key: TechSectionKey; label: string; icon: ReactNode }[] = [
  { key: "summary", label: "Technical Fit Summary", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "capability", label: "Technical Capability Assessment", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: "gaps", label: "Technical Requirement Gaps", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: "clarifications", label: "Technical Clarifications", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "Technical Recommendation", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

// ═══════════════════════════════════════════════════════════
// DEFAULT DATA
// ═══════════════════════════════════════════════════════════

function emptyTechnicalQualificationData(): TechnicalQualificationData {
  return {
    capability_assessment: CAPABILITY_AREAS.map(c => ({
      area: c.area, question: c.question,
      fit: "Not Assessed" as FitLevel, evidence: "", gap_or_concern: "",
      owner: "", status: "Open" as CapabilityStatus,
    })),
    gaps: [],
    clarifications: [],
    recommendation: { outcome: "Not decided", reason: "", reviewer: "" },
  };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════



function fitBtnClass(selected: boolean, level: FitLevel): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (level === "Strong") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (level === "Moderate") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (level === "Weak") return "bg-red-100 border-red-300 text-red-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

function readinessLabel(strong: number, moderate: number, weak: number, allNA: boolean): string {
  if (allNA) return "Not Assessed";
  if (weak >= 3) return "Weak";
  if (strong >= 4 && weak === 0) return "Strong";
  return "Moderate";
}

function readinessColor(label: string): string {
  if (label === "Strong") return "text-emerald-700 bg-emerald-50 border-emerald-300";
  if (label === "Moderate") return "text-amber-700 bg-amber-50 border-amber-300";
  if (label === "Weak") return "text-red-700 bg-red-50 border-red-300";
  return "text-slate-500 bg-slate-50 border-slate-200";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

export default function TechnicalQualification({ ws, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const tenderId = t.id;

  // ── State ─────────────────────────────────────────────────
  const [data, setData] = useState<TechnicalQualificationData>(() => {
    if (t.technicalQualificationData && typeof t.technicalQualificationData === "object") {
      const saved = t.technicalQualificationData as any;
      return {
        capability_assessment: Array.isArray(saved.capability_assessment) && saved.capability_assessment.length === 7
          ? saved.capability_assessment
          : emptyTechnicalQualificationData().capability_assessment,
        gaps: Array.isArray(saved.gaps) ? saved.gaps : [],
        clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : [],
        recommendation: { ...emptyTechnicalQualificationData().recommendation, ...(saved.recommendation || {}) },
      };
    }
    return emptyTechnicalQualificationData();
  });

  const [initial, setInitial] = useState(() => JSON.stringify(data));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(data) !== initial;

  useEffect(() => {
    if (t.technicalQualificationData && typeof t.technicalQualificationData === "object") {
      const saved = t.technicalQualificationData as any;
      const loaded: TechnicalQualificationData = {
        capability_assessment: Array.isArray(saved.capability_assessment) && saved.capability_assessment.length === 7
          ? saved.capability_assessment
          : emptyTechnicalQualificationData().capability_assessment,
        gaps: Array.isArray(saved.gaps) ? saved.gaps : [],
        clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : [],
        recommendation: { ...emptyTechnicalQualificationData().recommendation, ...(saved.recommendation || {}) },
      };
      const loadedStr = JSON.stringify(loaded);
      setData(prev => {
        if (JSON.stringify(prev) === initial) return loaded;
        return prev;
      });
      setInitial(() => loadedStr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.technicalQualificationData]);

  // ── Collapsible ───────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true, capability: true, gaps: false, clarifications: false,
    recommendation: true, wiring: false,
  });
  const [activeSection, setActiveSection] = useState<TechSectionKey>("summary");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [tableFocus, setTableFocus] = useState(false);
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const selectSection = (key: TechSectionKey) => {
    setActiveSection(key);
    setOpenSections(prev => ({ ...prev, [key]: true }));
  };

  // ── Updaters ──────────────────────────────────────────────
  const updateCapability = useCallback((idx: number, patch: Partial<CapabilityRow>) => {
    setData(prev => {
      const rows = [...prev.capability_assessment];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, capability_assessment: rows };
    });
  }, []);

  const addGap = useCallback(() => {
    setData(prev => ({
      ...prev,
      gaps: [...prev.gaps, {
        gap: "", category: "Other" as GapCategory, severity: "Medium" as GapSeverity,
        evidence: "", required_action: "", owner: "", status: "Open" as GapStatus,
      }],
    }));
  }, []);
  const updateGap = useCallback((idx: number, patch: Partial<GapRow>) => {
    setData(prev => {
      const rows = [...prev.gaps]; rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, gaps: rows };
    });
  }, []);
  const removeGap = useCallback((idx: number) => {
    setData(prev => ({ ...prev, gaps: prev.gaps.filter((_, i) => i !== idx) }));
  }, []);

  const addClarification = useCallback(() => {
    setData(prev => ({
      ...prev,
      clarifications: [...prev.clarifications, {
        question: "", related_area: "", source_reference: "",
        impact: "Medium" as ClarificationImpact, owner: "",
        status: "Draft" as ClarificationStatus, buyer_response: "",
      }],
    }));
  }, []);
  const updateClarification = useCallback((idx: number, patch: Partial<ClarificationRow>) => {
    setData(prev => {
      const rows = [...prev.clarifications]; rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, clarifications: rows };
    });
  }, []);
  const removeClarification = useCallback((idx: number) => {
    setData(prev => ({ ...prev, clarifications: prev.clarifications.filter((_, i) => i !== idx) }));
  }, []);

  const updateRecommendation = useCallback((patch: Partial<TechRecommendation>) => {
    setData(prev => ({ ...prev, recommendation: { ...prev.recommendation, ...patch } }));
  }, []);

  // ── Calculated stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const assessed = data.capability_assessment.filter(r => r.fit !== "Not Assessed").length;
    const strong = data.capability_assessment.filter(r => r.fit === "Strong").length;
    const moderate = data.capability_assessment.filter(r => r.fit === "Moderate").length;
    const weak = data.capability_assessment.filter(r => r.fit === "Weak").length;
    const allNA = data.capability_assessment.every(r => r.fit === "Not Assessed");
    const bidBlockers = data.gaps.filter(g => g.severity === "Bid Blocker").length
      + data.clarifications.filter(c => c.impact === "Bid Blocker").length;
    const readiness = readinessLabel(strong, moderate, weak, allNA);
    return { assessed, total: 7, strong, moderate, weak, bidBlockers, readiness };
  }, [data]);

  const hasTableFocus = activeSection === "wiring";

  useEffect(() => {
    if (!hasTableFocus) setTableFocus(false);
  }, [hasTableFocus]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateTenderTechnicalQualificationData(tenderId, data);
      if (result.success) {
        toast.success("Technical Qualification saved.");
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
            <Button type="button" variant="outline" size="sm" className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
              tableFocus
                ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
            }`} onClick={() => setTableFocus(prev => !prev)}>
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
            <Button type="button" variant="outline" size="sm" className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
              stageIntelOpen
                ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
            }`} onClick={() => setStageIntelOpen(prev => !prev)}>
              <PanelRightOpen className="w-3.5 h-3.5" />
              {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
            </Button>
            {!dirty && stats.assessed > 0 && <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>}
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <StageIntelMetric label="Capability Assessed" value={`${stats.assessed}/${stats.total}`} />
                <StageIntelMetric label="Strong" value={`${stats.strong}`} />
                <StageIntelMetric label="Moderate" value={`${stats.moderate}`} />
                <StageIntelMetric label="Weak" value={`${stats.weak}`} />
                <StageIntelMetric label="Bid Blockers" value={`${stats.bidBlockers}`} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          <QualificationInnerTabs tabs={TECH_SECTION_TABS} activeKey={activeSection} onSelect={selectSection} />
        </CardContent>
      </Card>

      {/* ── 1. Technical Fit Summary ───────────────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "summary" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionToggle title="Technical Fit Summary" icon={<BarChart3 className="w-3.5 h-3.5 text-[#075eea]" />} open={openSections.summary} onToggle={() => toggle("summary")}
            badge={stats.readiness === "Not Assessed" ? "Not Assessed" : stats.readiness}
          />
        </CardHeader>
        {openSections.summary && (
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-3 text-center">
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className="text-lg font-bold font-mono">{stats.assessed}/{stats.total}</p>
                <p className="text-[9px] text-muted-foreground">Assessed</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.strong > 0 ? "text-emerald-600" : ""}`}>{stats.strong}</p>
                <p className="text-[9px] text-muted-foreground">Strong</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.moderate > 0 ? "text-amber-600" : ""}`}>{stats.moderate}</p>
                <p className="text-[9px] text-muted-foreground">Moderate</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.weak > 0 ? "text-red-600" : ""}`}>{stats.weak}</p>
                <p className="text-[9px] text-muted-foreground">Weak</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className={`text-lg font-bold font-mono ${stats.bidBlockers > 0 ? "text-red-600" : ""}`}>{stats.bidBlockers}</p>
                <p className="text-[9px] text-muted-foreground">Bid Blockers</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Overall Technical Readiness:</span>
              <Badge variant="outline" className={`text-[9px] font-semibold ${readinessColor(stats.readiness)}`}>
                {stats.readiness}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── 2. Technical Capability Assessment ─────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "capability" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionToggle title="Technical Capability Assessment" icon={<ShieldCheck className="w-3.5 h-3.5 text-[#075eea]" />} open={openSections.capability} onToggle={() => toggle("capability")}
            badge={`${stats.assessed}/${stats.total} assessed`}
          />
          <p className="border-b border-border bg-muted/20 px-4 pb-3 text-[10px] text-muted-foreground">
            Evidence-backed assessment of Hala's ability to deliver the tender scope technically, operationally, and compliantly.
          </p>
        </CardHeader>
        {openSections.capability && (
          <CardContent className="p-4 space-y-3">
            {data.capability_assessment.map((row, idx) => {
              const meta = CAPABILITY_AREAS[idx];
              return (
                <div key={row.area} className="border border-border rounded-lg p-3 bg-card">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400">{meta?.icon}</span>
                    <span className="text-xs font-semibold flex-1">{row.area}</span>
                    <div className="flex gap-1">
                      {FIT_OPTIONS.map(opt => (
                        <button key={opt} type="button"
                          className={`text-[9px] px-2.5 py-0.5 rounded-full border transition-colors ${
                            fitBtnClass(row.fit === opt, opt)
                          }`}
                          onClick={() => updateCapability(idx, { fit: row.fit === opt ? "Not Assessed" : opt })}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">{row.question}</p>
                  {meta?.guidance && (
                    <p className="text-[9px] text-muted-foreground/70 mb-2 italic">
                      Capture evidence for: {meta.guidance}
                    </p>
                  )}
                  {/* Fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground">Evidence / Source</label>
                      <textarea className="w-full text-[10px] border border-border rounded px-2 py-1 bg-card min-h-[32px]" rows={1}
                        value={row.evidence} onChange={e => updateCapability(idx, { evidence: e.target.value })} placeholder="" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Gap / Concern</label>
                      <textarea className="w-full text-[10px] border border-border rounded px-2 py-1 bg-card min-h-[32px]" rows={1}
                        value={row.gap_or_concern} onChange={e => updateCapability(idx, { gap_or_concern: e.target.value })} placeholder="" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="text-[9px] text-muted-foreground">Owner</label>
                      <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                        value={row.owner} onChange={e => updateCapability(idx, { owner: e.target.value })} placeholder="" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Status</label>
                      <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                        value={row.status} onChange={e => updateCapability(idx, { status: e.target.value as CapabilityStatus })}>
                        {CAPABILITY_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* ── 3. Technical Requirement Gaps ──────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "gaps" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionToggle title="Technical Requirement Gaps" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />} open={openSections.gaps} onToggle={() => toggle("gaps")}
            badge={data.gaps.length > 0 ? `${data.gaps.length} gaps` : undefined}
          />
        </CardHeader>
        {openSections.gaps && (
          <CardContent className="p-4 space-y-2">
            {data.gaps.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No technical gaps captured yet.</p>
            )}
            {data.gaps.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeGap(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-muted-foreground">Gap / Requirement</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.gap} onChange={e => updateGap(idx, { gap: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Category</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.category} onChange={e => updateGap(idx, { category: e.target.value as GapCategory })}>
                      {GAP_CATEGORY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Severity</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.severity} onChange={e => updateGap(idx, { severity: e.target.value as GapSeverity })}>
                      {GAP_SEVERITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Evidence / Source</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.evidence} onChange={e => updateGap(idx, { evidence: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Owner</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                      value={row.owner} onChange={e => updateGap(idx, { owner: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Status</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.status} onChange={e => updateGap(idx, { status: e.target.value as GapStatus })}>
                      {GAP_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-1">
                  <label className="text-[9px] text-muted-foreground">Required Action</label>
                  <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card"
                    value={row.required_action} onChange={e => updateGap(idx, { required_action: e.target.value })} placeholder="" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={addGap}>
              <Plus className="w-3 h-3" /> Add Technical Gap
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── 4. Technical Clarifications ────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "clarifications" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionToggle title="Technical Clarifications" icon={<MessageSquare className="w-3.5 h-3.5 text-[#075eea]" />} open={openSections.clarifications} onToggle={() => toggle("clarifications")}
            badge={data.clarifications.length > 0 ? `${data.clarifications.length} questions` : undefined}
          />
        </CardHeader>
        {openSections.clarifications && (
          <CardContent className="p-4 space-y-2">
            {data.clarifications.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No technical clarifications captured yet.</p>
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
                    <label className="text-[9px] text-muted-foreground">Related Capability Area</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={row.related_area} onChange={e => updateClarification(idx, { related_area: e.target.value })}>
                      <option value="">Select...</option>
                      {RELATED_AREA_OPTIONS.map(o => <option key={o}>{o}</option>)}
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
              <Plus className="w-3 h-3" /> Add Technical Clarification
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── 5. Technical Recommendation ────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionToggle title="Technical Recommendation" icon={<ShieldCheck className="w-3.5 h-3.5 text-[#075eea]" />} open={openSections.recommendation} onToggle={() => toggle("recommendation")} />
        </CardHeader>
        {openSections.recommendation && (
          <CardContent className="p-4">
            <div className="border border-border rounded-lg p-3 bg-card space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Technical Qualification Outcome</label>
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
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reviewer / Owner</label>
                <input className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5"
                  value={data.recommendation.reviewer}
                  onChange={e => updateRecommendation({ reviewer: e.target.value })} placeholder="" />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Output Use ──────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionToggle title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-slate-400" />} open={openSections.wiring} onToggle={() => toggle("wiring")} />
        </CardHeader>
        {openSections.wiring && (
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
        )}
      </Card>

      {/* ── 6. Save Button ─────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          className="hala-save-button gap-1.5 h-9 text-xs px-5"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Technical Qualification
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

function QualificationInnerTabs<T extends string>({
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

function SectionToggle({ title, icon, open, onToggle, badge }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button type="button" className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left group" onClick={onToggle}>
      {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </button>
  );
}
