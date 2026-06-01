/**
 * SLAKPIModelTab — SLA / KPI Model
 * Data key: solution_design.sla_kpi
 * Save: merges only solution_design_data.sla_kpi
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, ChevronRight, Plus, X, Target, ShieldCheck, ArrowRight, Info } from "lucide-react";

type YesNoNA = "Yes" | "No" | "Not Assessed";
type ReadinessStatus = "Ready" | "Partially Ready" | "Needs Clarification" | "Not Assessed";

const YES_NO: YesNoNA[] = ["Yes", "No", "Not Assessed"];
const READINESS: ReadinessStatus[] = ["Ready", "Partially Ready", "Needs Clarification", "Not Assessed"];

const KPI_TEMPLATES = ["On-time Delivery", "Order Accuracy", "Inventory Accuracy", "Warehouse Throughput", "Return Processing Time", "Damage / Loss Rate", "Pickup Window", "Complaint Resolution", "Reporting Frequency"];

const FUTURE_WIRING = [
  { source: "SLA / KPI Table", output: "annexure.b.sla_matrix / KPI Matrix" },
  { source: "SLA Governance", output: "SLA Commitment / Performance Assurance" },
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

interface Props { ws: TenderWorkspace; }

export default function SLAKPIModelTab({ ws }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const sk = existing?.sla_kpi;

  const [kpis, setKpis] = useState<KPIRow[]>(() => Array.isArray(sk?.kpis) ? sk.kpis : []);
  const [governance, setGovernance] = useState<SLAGovernance>(() => sk?.governance ? { ...emptyGov(), ...sk.governance } : emptyGov());
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => sk?.recommendation ? { readiness: "Not Assessed", notes: "", ...sk.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ kpis: true, governance: true, rec: true, future: false });
  const tog = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

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
      {/* KPI Table */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("kpis")}>
          <div className="flex items-center gap-2">
            {open.kpis ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Target className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">SLA / KPI Table</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{kpis.length} KPIs</Badge>
          </div>
        </CardHeader>
        {open.kpis && (
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
        )}
      </Card>

      {/* Governance */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("governance")}>
          <div className="flex items-center gap-2">
            {open.governance ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">SLA Governance</span>
          </div>
        </CardHeader>
        {open.governance && (
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
        )}
      </Card>

      {/* Recommendation */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("rec")}>
          <div className="flex items-center gap-2">
            {open.rec ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">SLA / KPI Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{recommendation.readiness !== "Not Assessed" ? recommendation.readiness : "Not Assessed"}</Badge>
          </div>
        </CardHeader>
        {open.rec && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">SLA Readiness</label>
              <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">SLA Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter SLA notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
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
          Save SLA / KPI Model
        </Button>
      </div>
    </div>
  );
}
