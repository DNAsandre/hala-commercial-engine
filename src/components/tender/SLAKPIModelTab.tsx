/**
 * SLAKPIModelTab — SLA / KPI Model
 * Data key: solution_design.sla_kpi
 * Save: merges only solution_design_data.sla_kpi
 *
 * 4 Sections (section-tab navigation, matching Qualification pattern):
 *   1. SLA / KPI Table
 *   2. SLA Governance
 *   3. SLA / KPI Recommendation
 *   4. Output Use
 */
import { useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, Plus, X, Target, ShieldCheck, ArrowRight, Info, FolderOpen, BarChart3, PanelRightOpen } from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

type YesNoNA = "Yes" | "No" | "Not Assessed";
type ReadinessStatus = "Ready" | "Partially Ready" | "Needs Clarification" | "Not Assessed";

const YES_NO: YesNoNA[] = ["Yes", "No", "Not Assessed"];
const READINESS: ReadinessStatus[] = ["Ready", "Partially Ready", "Needs Clarification", "Not Assessed"];

const KPI_TEMPLATES = ["On-time Delivery", "Order Accuracy", "Inventory Accuracy", "Warehouse Throughput", "Return Processing Time", "Damage / Loss Rate", "Pickup Window", "Complaint Resolution", "Reporting Frequency"];

const FUTURE_WIRING = [
  { source: "SLA / KPI Table", output: "annexure.b.sla_matrix / KPI Matrix" },
  { source: "SLA Governance", output: "SLA Commitment / Performance Assurance" },
];

type SLASectionKey = "kpis" | "governance" | "recommendation" | "wiring";

const SLA_SECTION_TABS: { key: SLASectionKey; label: string; icon: ReactNode }[] = [
  { key: "kpis", label: "SLA / KPI Table", icon: <Target className="w-3.5 h-3.5" /> },
  { key: "governance", label: "SLA Governance", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "SLA Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <Info className="w-3.5 h-3.5" /> },
];

interface KPIRow {
  kpi_name: string; target: string; measurement_method: string; reporting_frequency: string;
  owner: string; source: string; risk_notes: string; include_in_proposal: YesNoNA;
}
interface SLAGovernance {
  review_frequency: string; reporting_owner: string; customer_reporting_contact: string;
  escalation_trigger: string; penalty_linkage: YesNoNA;
}

function emptyKPI(): KPIRow { return { kpi_name: "", target: "", measurement_method: "", reporting_frequency: "", owner: "", source: "", risk_notes: "", include_in_proposal: "Not Assessed" }; }
function emptyGov(): SLAGovernance { return { review_frequency: "", reporting_owner: "", customer_reporting_contact: "", escalation_trigger: "", penalty_linkage: "Not Assessed" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

export default function SLAKPIModelTab({ ws, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const sk = existing?.sla_kpi;

  const [kpis, setKpis] = useState<KPIRow[]>(() => Array.isArray(sk?.kpis) ? sk.kpis : []);
  const [governance, setGovernance] = useState<SLAGovernance>(() => sk?.governance ? { ...emptyGov(), ...sk.governance } : emptyGov());
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => sk?.recommendation ? { readiness: "Not Assessed", notes: "", ...sk.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SLASectionKey>("kpis");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const addKPI = (template?: string) => setKpis(p => [...p, { ...emptyKPI(), kpi_name: template || "" }]);
  const rmKPI = (i: number) => setKpis(p => p.filter((_, x) => x !== i));
  const upKPI = (i: number, f: keyof KPIRow, v: any) => setKpis(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), sla_kpi: { kpis, governance, recommendation } };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "SLA / KPI Model saved");
      if (result.success) toast.success("SLA / KPI Model saved"); else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, kpis, governance, recommendation, existing]);

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
              <div className="grid gap-3 sm:grid-cols-4">
                <StageIntelMetric label="KPIs" value={`${kpis.length} defined`} />
                <StageIntelMetric label="Penalty Linkage" value={governance.penalty_linkage} />
                <StageIntelMetric label="Review Frequency" value={governance.review_frequency || "Not set"} />
                <StageIntelMetric label="Readiness" value={recommendation.readiness} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {SLA_SECTION_TABS.map(section => (
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
      {/* ── 1. SLA / KPI Table ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "kpis" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="SLA / KPI Table" icon={<Target className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${kpis.length} KPIs`} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          {kpis.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No SLA / KPI rows captured yet.</p>}
          {kpis.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmKPI(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">KPI / SLA Name</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.kpi_name} onChange={e => upKPI(i, "kpi_name", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Target</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="e.g. 98%" value={row.target} onChange={e => upKPI(i, "target", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Measurement Method</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.measurement_method} onChange={e => upKPI(i, "measurement_method", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Reporting Frequency</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.reporting_frequency} onChange={e => upKPI(i, "reporting_frequency", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upKPI(i, "owner", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Source</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.source} onChange={e => upKPI(i, "source", e.target.value)} /></div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Include in Proposal?</label>
                  <div className="flex gap-0.5">{YES_NO.map(o => <button key={o} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.include_in_proposal === o)}`} onClick={() => upKPI(i, "include_in_proposal", o)}>{o}</button>)}</div>
                </div>
              </div>
              <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Risk / Notes</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.risk_notes} onChange={e => upKPI(i, "risk_notes", e.target.value)} /></div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => addKPI()}><Plus className="w-3 h-3" /> Add KPI / SLA</Button>
            <span className="text-[9px] text-muted-foreground mx-2">or add template:</span>
            <div className="flex flex-wrap gap-1">{KPI_TEMPLATES.filter(k => !kpis.some(r => r.kpi_name === k)).slice(0, 5).map(k => <button key={k} type="button" className="px-2 py-0.5 rounded border text-[8px] bg-card border-border text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => addKPI(k)}>{k}</button>)}</div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. SLA Governance ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "governance" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="SLA Governance" icon={<ShieldCheck className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">SLA Review Frequency</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="e.g. Monthly" value={governance.review_frequency} onChange={e => setGovernance(p => ({ ...p, review_frequency: e.target.value }))} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Reporting Owner</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={governance.reporting_owner} onChange={e => setGovernance(p => ({ ...p, reporting_owner: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Customer Reporting Contact</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={governance.customer_reporting_contact} onChange={e => setGovernance(p => ({ ...p, customer_reporting_contact: e.target.value }))} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Escalation Trigger</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="e.g. 2 missed SLAs" value={governance.escalation_trigger} onChange={e => setGovernance(p => ({ ...p, escalation_trigger: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Penalty / LD Linkage</label>
            <div className="flex gap-1.5">{YES_NO.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(governance.penalty_linkage === o)}`} onClick={() => setGovernance(p => ({ ...p, penalty_linkage: o }))}>{o}</button>)}</div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Recommendation ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="SLA / KPI Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.readiness} /></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">SLA Readiness</label>
            <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">SLA Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter SLA notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
        </CardContent>
      </Card>

      {/* ── 4. Output Use ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-3"><div className="space-y-1.5">{FUTURE_WIRING.map(fw => (<div key={fw.source} className="flex items-center gap-2 text-[10px]"><Badge variant="outline" className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]">{fw.source}</Badge><ArrowRight className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-muted-foreground">{fw.output}</span></div>))}<p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to discontinued document tooling.</p></div></CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save SLA / KPI Model
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
