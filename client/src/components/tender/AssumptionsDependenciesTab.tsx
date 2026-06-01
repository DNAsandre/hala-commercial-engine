/**
 * AssumptionsDependenciesTab — Assumptions & Dependencies
 * Data key: solution_design.assumptions_dependencies
 * Save: merges only solution_design_data.assumptions_dependencies
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, ChevronRight, Plus, X, FileText, Link2, XCircle, HelpCircle, ArrowRight, Info } from "lucide-react";

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

interface AssumptionRow { assumption: string; category: AssumptionCategory | ""; impact: ImpactLevel; owner: string; source: string; status: AssumptionStatus; include_in_proposal: YesNoNA; }
interface DependencyRow { dependency: string; responsible_party: DepParty; due_date: string; impact_if_missing: string; owner: string; status: AssumptionStatus; }
interface ExclusionRow { exclusion: string; reason: string; commercial_impact: string; owner: string; include_in_proposal: YesNoNA; }
interface ClarificationRow { question: string; related_area: string; source_reference: string; impact: ImpactLevel; owner: string; status: ClarStatus; buyer_response: string; }

function emptyAssumption(): AssumptionRow { return { assumption: "", category: "", impact: "Not Assessed", owner: "", source: "", status: "Draft", include_in_proposal: "Not Assessed" }; }
function emptyDep(): DependencyRow { return { dependency: "", responsible_party: "Not Assessed", due_date: "", impact_if_missing: "", owner: "", status: "Draft" }; }
function emptyExclusion(): ExclusionRow { return { exclusion: "", reason: "", commercial_impact: "", owner: "", include_in_proposal: "Not Assessed" }; }
function emptyClr(): ClarificationRow { return { question: "", related_area: "", source_reference: "", impact: "Not Assessed", owner: "", status: "Draft", buyer_response: "" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }

interface Props { ws: TenderWorkspace; }

export default function AssumptionsDependenciesTab({ ws }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const ad = existing?.assumptions_dependencies;

  const [assumptions, setAssumptions] = useState<AssumptionRow[]>(() => Array.isArray(ad?.assumptions) ? ad.assumptions : []);
  const [dependencies, setDependencies] = useState<DependencyRow[]>(() => Array.isArray(ad?.dependencies) ? ad.dependencies : []);
  const [exclusions, setExclusions] = useState<ExclusionRow[]>(() => Array.isArray(ad?.exclusions) ? ad.exclusions : []);
  const [clarifications, setClarifications] = useState<ClarificationRow[]>(() => Array.isArray(ad?.clarifications) ? ad.clarifications : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => ad?.recommendation ? { readiness: "Not Assessed", notes: "", ...ad.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ assumptions: true, deps: true, excl: true, clr: true, rec: true, future: false });
  const tog = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  // Assumptions
  const addA = () => setAssumptions(p => [...p, emptyAssumption()]);
  const rmA = (i: number) => setAssumptions(p => p.filter((_, x) => x !== i));
  const upA = (i: number, f: keyof AssumptionRow, v: any) => setAssumptions(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  // Dependencies
  const addD = () => setDependencies(p => [...p, emptyDep()]);
  const rmD = (i: number) => setDependencies(p => p.filter((_, x) => x !== i));
  const upD = (i: number, f: keyof DependencyRow, v: any) => setDependencies(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  // Exclusions
  const addE = () => setExclusions(p => [...p, emptyExclusion()]);
  const rmE = (i: number) => setExclusions(p => p.filter((_, x) => x !== i));
  const upE = (i: number, f: keyof ExclusionRow, v: any) => setExclusions(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  // Clarifications
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
      {/* Assumptions */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("assumptions")}>
          <div className="flex items-center gap-2">
            {open.assumptions ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Assumptions</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{assumptions.length}</Badge>
          </div>
        </CardHeader>
        {open.assumptions && (
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
        )}
      </Card>

      {/* Dependencies */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("deps")}>
          <div className="flex items-center gap-2">
            {open.deps ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Link2 className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Dependencies</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{dependencies.length}</Badge>
          </div>
        </CardHeader>
        {open.deps && (
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
        )}
      </Card>

      {/* Exclusions */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("excl")}>
          <div className="flex items-center gap-2">
            {open.excl ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-semibold">Exclusions</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{exclusions.length}</Badge>
          </div>
        </CardHeader>
        {open.excl && (
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
        )}
      </Card>

      {/* Clarifications */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("clr")}>
          <div className="flex items-center gap-2">
            {open.clr ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <HelpCircle className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">Clarifications Required</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{clarifications.length}</Badge>
          </div>
        </CardHeader>
        {open.clr && (
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
        )}
      </Card>

      {/* Recommendation */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("rec")}>
          <div className="flex items-center gap-2">
            {open.rec ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Assumptions Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{recommendation.readiness !== "Not Assessed" ? recommendation.readiness : "Not Assessed"}</Badge>
          </div>
        </CardHeader>
        {open.rec && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Assumptions Readiness</label>
              <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
          </CardContent>
        )}
      </Card>

      {/* Future */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("future")}>
          <div className="flex items-center gap-2">
            {open.future ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-muted-foreground">Future Output Use</span>
          </div>
        </CardHeader>
        {open.future && (<CardContent className="p-3"><div className="space-y-1.5">{FUTURE_WIRING.map(fw => (<div key={fw.source} className="flex items-center gap-2 text-[10px]"><Badge variant="outline" className="text-[8px] border-violet-200 bg-violet-50 text-violet-600">{fw.source}</Badge><ArrowRight className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-muted-foreground">{fw.output}</span></div>))}<p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to PDF Studio.</p></div></CardContent>)}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Assumptions & Dependencies
        </Button>
      </div>
    </div>
  );
}
