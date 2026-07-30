/**
 * AssumptionsDependenciesTab — Assumptions & Dependencies
 * Data key: solution_design.assumptions_dependencies
 * Save: merges only solution_design_data.assumptions_dependencies
 *
 * 6 Sections (section-tab navigation, matching Qualification pattern):
 *   1. Assumptions
 *   2. Dependencies
 *   3. Exclusions
 *   4. Clarifications Required
 *   5. Assumptions Recommendation
 *   6. Output Use
 */
import { useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, Plus, X, FileText, Link2, XCircle, HelpCircle, ArrowRight, Info, FolderOpen, BarChart3, PanelRightOpen } from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

type ImpactLevel = "Low" | "Medium" | "High" | "Bid Blocker" | "Not Assessed";
type AssumptionCategory = "Operational" | "Commercial" | "Technical" | "Customer Dependency" | "Legal / Contractual" | "HSE / Compliance" | "Pricing" | "Submission" | "Other";
type AssumptionStatus = "Draft" | "Confirmed" | "Needs Clarification" | "Accepted" | "Removed";
type DepParty = "Hala" | "Customer" | "Third Party" | "Not Assessed";
type ClarStatus = "Draft" | "Submitted" | "Answered" | "Closed" | "Accepted as Assumption";
type YesNoNA = "Yes" | "No" | "Not Assessed";
type ReadinessStatus = "Ready" | "Partially Ready" | "Needs Clarification" | "Not Assessed";

const IMPACT: ImpactLevel[] = ["Low", "Medium", "High", "Bid Blocker", "Not Assessed"];
const CATEGORIES: AssumptionCategory[] = ["Operational", "Commercial", "Technical", "Customer Dependency", "Legal / Contractual", "HSE / Compliance", "Pricing", "Submission", "Other"];
const A_STATUS: AssumptionStatus[] = ["Draft", "Confirmed", "Needs Clarification", "Accepted", "Removed"];
const DEP_PARTY: DepParty[] = ["Hala", "Customer", "Third Party", "Not Assessed"];
const DEP_STATUS: AssumptionStatus[] = ["Draft", "Confirmed", "Needs Clarification", "Accepted", "Removed"];
const CLAR_STATUS: ClarStatus[] = ["Draft", "Submitted", "Answered", "Closed", "Accepted as Assumption"];
const YES_NO: YesNoNA[] = ["Yes", "No", "Not Assessed"];
const READINESS: ReadinessStatus[] = ["Ready", "Partially Ready", "Needs Clarification", "Not Assessed"];

const FUTURE_WIRING = [
  { source: "Assumptions", output: "terms.standard / Assumptions & Dependencies" },
  { source: "Exclusions", output: "Exclusions / Terms & Conditions" },
  { source: "Clarifications", output: "Clarifications / legal.clauses.locked" },
  { source: "Dependencies", output: "Dependencies / Mobilization Plan" },
];

type ADSectionKey = "assumptions" | "deps" | "excl" | "clr" | "recommendation" | "wiring";

const AD_SECTION_TABS: { key: ADSectionKey; label: string; icon: ReactNode }[] = [
  { key: "assumptions", label: "Assumptions", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "deps", label: "Dependencies", icon: <Link2 className="w-3.5 h-3.5" /> },
  { key: "excl", label: "Exclusions", icon: <XCircle className="w-3.5 h-3.5" /> },
  { key: "clr", label: "Clarifications", icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <Info className="w-3.5 h-3.5" /> },
];

interface AssumptionRow { assumption: string; category: AssumptionCategory | ""; impact: ImpactLevel; owner: string; source: string; status: AssumptionStatus; include_in_proposal: YesNoNA; }
interface DependencyRow { dependency: string; responsible_party: DepParty; due_date: string; impact_if_missing: string; owner: string; status: AssumptionStatus; }
interface ExclusionRow { exclusion: string; reason: string; commercial_impact: string; owner: string; include_in_proposal: YesNoNA; }
interface ClarificationRow { question: string; related_area: string; source_reference: string; impact: ImpactLevel; owner: string; status: ClarStatus; buyer_response: string; }

function emptyAssumption(): AssumptionRow { return { assumption: "", category: "", impact: "Not Assessed", owner: "", source: "", status: "Draft", include_in_proposal: "Not Assessed" }; }
function emptyDep(): DependencyRow { return { dependency: "", responsible_party: "Not Assessed", due_date: "", impact_if_missing: "", owner: "", status: "Draft" }; }
function emptyExclusion(): ExclusionRow { return { exclusion: "", reason: "", commercial_impact: "", owner: "", include_in_proposal: "Not Assessed" }; }
function emptyClr(): ClarificationRow { return { question: "", related_area: "", source_reference: "", impact: "Not Assessed", owner: "", status: "Draft", buyer_response: "" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

export default function AssumptionsDependenciesTab({ ws, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const ad = existing?.assumptions_dependencies;

  const [assumptions, setAssumptions] = useState<AssumptionRow[]>(() => Array.isArray(ad?.assumptions) ? ad.assumptions : []);
  const [dependencies, setDependencies] = useState<DependencyRow[]>(() => Array.isArray(ad?.dependencies) ? ad.dependencies : []);
  const [exclusions, setExclusions] = useState<ExclusionRow[]>(() => Array.isArray(ad?.exclusions) ? ad.exclusions : []);
  const [clarifications, setClarifications] = useState<ClarificationRow[]>(() => Array.isArray(ad?.clarifications) ? ad.clarifications : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => ad?.recommendation ? { readiness: "Not Assessed", notes: "", ...ad.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ADSectionKey>("assumptions");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const addA = () => setAssumptions(p => [...p, emptyAssumption()]);
  const rmA = (i: number) => setAssumptions(p => p.filter((_, x) => x !== i));
  const upA = (i: number, f: keyof AssumptionRow, v: any) => setAssumptions(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  const addD = () => setDependencies(p => [...p, emptyDep()]);
  const rmD = (i: number) => setDependencies(p => p.filter((_, x) => x !== i));
  const upD = (i: number, f: keyof DependencyRow, v: any) => setDependencies(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  const addE = () => setExclusions(p => [...p, emptyExclusion()]);
  const rmE = (i: number) => setExclusions(p => p.filter((_, x) => x !== i));
  const upE = (i: number, f: keyof ExclusionRow, v: any) => setExclusions(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  const addC = () => setClarifications(p => [...p, emptyClr()]);
  const rmC = (i: number) => setClarifications(p => p.filter((_, x) => x !== i));
  const upC = (i: number, f: keyof ClarificationRow, v: any) => setClarifications(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), assumptions_dependencies: { assumptions, dependencies, exclusions, clarifications, recommendation } };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "Assumptions & Dependencies saved");
      if (result.success) toast.success("Assumptions & Dependencies saved"); else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, assumptions, dependencies, exclusions, clarifications, recommendation, existing]);

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">Solution Design Stage Menu</span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">Stage 4</Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
            {onOpenDocuments && (<Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}><FolderOpen className="w-3.5 h-3.5" />Open Documents</Button>)}
            {onOpenGlobalIntel && (<Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}><BarChart3 className="w-3.5 h-3.5" />Global Intelligence</Button>)}
            <Button type="button" variant="outline" size="sm" className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${stageIntelOpen ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white" : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"}`} onClick={() => setStageIntelOpen(prev => !prev)}><PanelRightOpen className="w-3.5 h-3.5" />{stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}</Button>
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <StageIntelMetric label="Assumptions" value={`${assumptions.length}`} />
                <StageIntelMetric label="Dependencies" value={`${dependencies.length}`} />
                <StageIntelMetric label="Exclusions" value={`${exclusions.length}`} />
                <StageIntelMetric label="Clarifications" value={`${clarifications.length}`} />
                <StageIntelMetric label="Readiness" value={recommendation.readiness} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {AD_SECTION_TABS.map(section => (
              <button key={section.key} type="button" onClick={() => setActiveSection(section.key)}
                className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${activeSection === section.key ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]" : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"}`}>
                <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
                <span className="block whitespace-normal text-center">{section.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="p-4 space-y-4">
      {/* ── 1. Assumptions ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "assumptions" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Assumptions" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${assumptions.length}`} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          {assumptions.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No assumptions captured yet.</p>}
          {assumptions.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmA(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Assumption</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.assumption} onChange={e => upA(i, "assumption", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Category</label><select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.category} onChange={e => upA(i, "category", e.target.value)}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Impact</label><div className="flex flex-wrap gap-0.5">{IMPACT.map(o => <button key={o} type="button" className={`px-1 py-0.5 rounded border text-[7px] transition-colors ${btnCls(row.impact === o)}`} onClick={() => upA(i, "impact", o)}>{o}</button>)}</div></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upA(i, "owner", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{A_STATUS.map(s => <button key={s} type="button" className={`px-1 py-0.5 rounded border text-[7px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upA(i, "status", s)}>{s}</button>)}</div></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">In Proposal?</label><div className="flex gap-0.5">{YES_NO.map(o => <button key={o} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.include_in_proposal === o)}`} onClick={() => upA(i, "include_in_proposal", o)}>{o}</button>)}</div></div>
              </div>
              <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Source</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.source} onChange={e => upA(i, "source", e.target.value)} /></div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addA}><Plus className="w-3 h-3" /> Add Assumption</Button>
        </CardContent>
      </Card>

      {/* ── 2. Dependencies ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "deps" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Dependencies" icon={<Link2 className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${dependencies.length}`} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          {dependencies.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No dependencies captured yet.</p>}
          {dependencies.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmD(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Dependency</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.dependency} onChange={e => upD(i, "dependency", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Responsible Party</label><div className="flex flex-wrap gap-0.5">{DEP_PARTY.map(o => <button key={o} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.responsible_party === o)}`} onClick={() => upD(i, "responsible_party", o)}>{o}</button>)}</div></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Due Date</label><input type="date" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.due_date} onChange={e => upD(i, "due_date", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Impact if Missing</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.impact_if_missing} onChange={e => upD(i, "impact_if_missing", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upD(i, "owner", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{DEP_STATUS.map(s => <button key={s} type="button" className={`px-1 py-0.5 rounded border text-[7px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upD(i, "status", s)}>{s}</button>)}</div></div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addD}><Plus className="w-3 h-3" /> Add Dependency</Button>
        </CardContent>
      </Card>

      {/* ── 3. Exclusions ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "excl" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Exclusions" icon={<XCircle className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${exclusions.length}`} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          {exclusions.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No exclusions captured yet.</p>}
          {exclusions.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmE(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Exclusion</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.exclusion} onChange={e => upE(i, "exclusion", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Reason</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.reason} onChange={e => upE(i, "reason", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Commercial Impact</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.commercial_impact} onChange={e => upE(i, "commercial_impact", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upE(i, "owner", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">In Proposal?</label><div className="flex gap-0.5">{YES_NO.map(o => <button key={o} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.include_in_proposal === o)}`} onClick={() => upE(i, "include_in_proposal", o)}>{o}</button>)}</div></div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addE}><Plus className="w-3 h-3" /> Add Exclusion</Button>
        </CardContent>
      </Card>

      {/* ── 4. Clarifications Required ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "clr" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Clarifications Required" icon={<HelpCircle className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${clarifications.length}`} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          {clarifications.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No clarifications captured yet.</p>}
          {clarifications.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmC(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Clarification Question</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.question} onChange={e => upC(i, "question", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Related Area</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.related_area} onChange={e => upC(i, "related_area", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Source Ref</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.source_reference} onChange={e => upC(i, "source_reference", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Impact</label><div className="flex flex-wrap gap-0.5">{IMPACT.map(o => <button key={o} type="button" className={`px-1 py-0.5 rounded border text-[7px] transition-colors ${btnCls(row.impact === o)}`} onClick={() => upC(i, "impact", o)}>{o}</button>)}</div></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upC(i, "owner", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{CLAR_STATUS.map(s => <button key={s} type="button" className={`px-1 py-0.5 rounded border text-[7px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upC(i, "status", s)}>{s}</button>)}</div></div>
              </div>
              <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Buyer Response</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.buyer_response} onChange={e => upC(i, "buyer_response", e.target.value)} /></div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addC}><Plus className="w-3 h-3" /> Add Clarification</Button>
        </CardContent>
      </Card>

      {/* ── 5. Recommendation ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Assumptions Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.readiness} /></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Assumptions Readiness</label>
            <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
        </CardContent>
      </Card>

      {/* ── 6. Output Use ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-3"><div className="space-y-1.5">{FUTURE_WIRING.map(fw => (<div key={fw.source} className="flex items-center gap-2 text-[10px]"><Badge variant="outline" className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]">{fw.source}</Badge><ArrowRight className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-muted-foreground">{fw.output}</span></div>))}<p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to discontinued document tooling.</p></div></CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Assumptions & Dependencies
        </Button>
      </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left group">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
