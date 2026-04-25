/**
 * SlaWizard — 7-step SLA creation from proposal
 * Sprint 5: Select Proposal → Scope → KPIs → Penalties → Customer Resp → Ops Notes → Review
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Save, Send, Link2, Plus, Trash2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const STEPS = ["Select Proposal", "Service Scope", "KPIs", "Penalties & Exclusions", "Customer Responsibilities", "Operational Notes", "Review & Save"];

interface KpiRow { name: string; target: string; method: string; frequency: string; owner: string; penalty_applies: boolean; }
const emptyKpi = (): KpiRow => ({ name: "", target: "", method: "", frequency: "Monthly", owner: "", penalty_applies: false });

interface Props {
  workspaceId: string; customerId?: string; customerName?: string;
  existingSla?: any; onSaved: (s: any) => void; onCancel: () => void;
}

export default function SlaWizard({ workspaceId, customerId, customerName, existingSla, onSaved, onCancel }: Props) {
  const [step, setStep] = useState(existingSla ? 1 : 0);
  const [saving, setSaving] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loadingP, setLoadingP] = useState(true);
  const isEdit = !!existingSla;

  const [selectedPropId, setSelectedPropId] = useState(existingSla?.linked_proposal_id || "");
  const [title, setTitle] = useState(existingSla?.title || "");
  const [serviceScope, setServiceScope] = useState(existingSla?.service_scope || "");
  const [kpis, setKpis] = useState<KpiRow[]>(existingSla?.kpi_rows?.length ? existingSla.kpi_rows : [emptyKpi()]);
  const [measurementMethods, setMeasurementMethods] = useState(existingSla?.measurement_methods || "");
  const [penaltyTerms, setPenaltyTerms] = useState(existingSla?.penalty_terms || "");
  const [exclusions, setExclusions] = useState(existingSla?.exclusions || "");
  const [custResp, setCustResp] = useState(existingSla?.customer_responsibilities || "");
  const [opsNotes, setOpsNotes] = useState(existingSla?.operational_notes || "");
  const [effectiveDate, setEffectiveDate] = useState(existingSla?.effective_date || "");
  const [reviewDate, setReviewDate] = useState(existingSla?.review_date || "");

  useEffect(() => {
    api.proposals.listByWorkspace(workspaceId)
      .then(r => setProposals((r.data || []).filter((p: any) => p.status !== "superseded")))
      .catch(() => {}).finally(() => setLoadingP(false));
  }, [workspaceId]);

  const selectedProp = proposals.find(p => p.id === selectedPropId);
  const snap = selectedProp?.pricing_snapshot || existingSla?.pricing_snapshot;

  const updateKpi = (i: number, field: keyof KpiRow, val: any) => {
    const next = [...kpis]; next[i] = { ...next[i], [field]: val }; setKpis(next);
  };

  const handleSave = async (andSubmit = false) => {
    if (!selectedPropId && !isEdit) { toast.error("Select a proposal"); return; }
    setSaving(true);
    try {
      const payload = {
        linked_proposal_id: selectedPropId, title, service_scope: serviceScope,
        kpi_rows: kpis.filter(k => k.name.trim()), measurement_methods: measurementMethods,
        penalty_terms: penaltyTerms, exclusions, customer_responsibilities: custResp,
        operational_notes: opsNotes, effective_date: effectiveDate || undefined,
        review_date: reviewDate || undefined, customer_id: customerId,
      };
      let sla: any;
      if (isEdit) {
        const { linked_proposal_id, customer_id, ...upd } = payload;
        const r = await api.slas.update(existingSla.id, upd); sla = r.data;
      } else {
        const r = await api.slas.create(workspaceId, payload); sla = r.data;
      }
      if (andSubmit && sla) { const r = await api.slas.submit(sla.id); sla = r.data; toast.success("SLA submitted"); }
      else toast.success(isEdit ? "SLA updated" : "SLA saved as draft");
      onSaved(sla);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Select Proposal</h3>
          {loadingP ? <p className="text-xs text-muted-foreground py-4">Loading...</p>
          : proposals.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div><p className="text-sm font-medium text-amber-800">No proposals available</p>
              <p className="text-xs text-amber-700 mt-0.5">Create a proposal before creating an SLA.</p></div>
            </div>
          ) : proposals.map(p => (
            <button key={p.id} onClick={() => setSelectedPropId(p.id)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedPropId === p.id ? "border-[var(--color-hala-navy)] bg-[var(--color-hala-navy)]/5" : "border-border hover:border-muted-foreground/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{p.proposal_number || `V${p.version_number}`}</span>
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                {p.pricing_snapshot?.quote_number && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 gap-0.5"><Link2 className="w-2.5 h-2.5" />{p.pricing_snapshot.quote_number}</Badge>}
              </div>
              {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
              {p.pricing_snapshot && <p className="text-xs mt-1">Value: {p.pricing_snapshot.currency || "SAR"} {(p.pricing_snapshot.annual_revenue || 0).toLocaleString()}/yr — GP: {p.pricing_snapshot.gp_percent}%</p>}
            </button>
          ))}
        </div>
      );
      case 1: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Service Scope</h3>
          <div><label className="text-xs text-muted-foreground mb-1 block">SLA Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Warehousing SLA — Sadara Chemical" className="h-9 text-sm" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Service Scope</label>
          <textarea value={serviceScope} onChange={e => setServiceScope(e.target.value)} placeholder="Describe service areas covered by this SLA..." className="w-full h-28 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Effective Date</label><Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="h-9 text-sm" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Review Date</label><Input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} className="h-9 text-sm" /></div>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">KPI Rows</h3>
            <Button variant="outline" size="sm" onClick={() => setKpis([...kpis, emptyKpi()])} className="text-xs h-7"><Plus className="w-3 h-3 mr-1" />Add KPI</Button>
          </div>
          {kpis.map((k, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">KPI {i + 1}</span>
                {kpis.length > 1 && <Button variant="ghost" size="sm" onClick={() => setKpis(kpis.filter((_, j) => j !== i))} className="h-6 w-6 p-0"><Trash2 className="w-3 h-3 text-red-500" /></Button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={k.name} onChange={e => updateKpi(i, "name", e.target.value)} placeholder="KPI Name" className="h-8 text-xs" />
                <Input value={k.target} onChange={e => updateKpi(i, "target", e.target.value)} placeholder="Target (e.g., 99.5%)" className="h-8 text-xs" />
                <Input value={k.method} onChange={e => updateKpi(i, "method", e.target.value)} placeholder="Measurement method" className="h-8 text-xs" />
                <Input value={k.frequency} onChange={e => updateKpi(i, "frequency", e.target.value)} placeholder="Frequency" className="h-8 text-xs" />
                <Input value={k.owner} onChange={e => updateKpi(i, "owner", e.target.value)} placeholder="Owner" className="h-8 text-xs" />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={k.penalty_applies} onChange={e => updateKpi(i, "penalty_applies", e.target.checked)} />Penalty applies</label>
              </div>
            </div>
          ))}
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Penalties & Exclusions</h3>
          <div><label className="text-xs text-muted-foreground mb-1 block">Penalty Terms</label>
          <textarea value={penaltyTerms} onChange={e => setPenaltyTerms(e.target.value)} placeholder="Describe penalty mechanisms..." className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Exclusions</label>
          <textarea value={exclusions} onChange={e => setExclusions(e.target.value)} placeholder="Service limitations, force majeure, etc." className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Measurement Methods</label>
          <textarea value={measurementMethods} onChange={e => setMeasurementMethods(e.target.value)} placeholder="How KPIs are measured and reported..." className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Customer Responsibilities</h3>
          <textarea value={custResp} onChange={e => setCustResp(e.target.value)} placeholder="Data provision, access, forecasts, approvals, systems, documentation..." className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      );
      case 5: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Operational Notes</h3>
          <textarea value={opsNotes} onChange={e => setOpsNotes(e.target.value)} placeholder="Implementation notes, operational considerations..." className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      );
      case 6: return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Review & Save</h3>
          {snap && <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-2 text-xs flex items-center gap-2"><Link2 className="w-3.5 h-3.5 text-blue-500" />Linked: {snap.quote_number} → {selectedProp?.proposal_number || "Proposal"}</div>}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <RR label="Title" value={title || "(untitled)"} />
            <RR label="KPIs" value={`${kpis.filter(k => k.name.trim()).length} defined`} />
            <RR label="Penalties" value={kpis.filter(k => k.penalty_applies).length + " with penalty"} />
            <RR label="Effective" value={effectiveDate || "Not set"} />
          </div>
          {serviceScope && <div className="text-xs"><span className="font-medium">Scope:</span> <span className="text-muted-foreground">{serviceScope.substring(0, 200)}</span></div>}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Info className="w-3 h-3" />SLA preserves commercial truth from linked quote and proposal. Pricing changes must go through quote versioning.</p>
        </div>
      );
      default: return null;
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-serif">{isEdit ? "Edit SLA" : "New SLA"}</CardTitle>
          <div className="flex items-center gap-1.5">{STEPS.map((s, i) => <button key={i} onClick={() => setStep(i)} className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-[var(--color-hala-navy)] scale-125" : i < step ? "bg-emerald-400" : "bg-muted-foreground/20"}`} title={s} />)}</div>
          <span className="text-xs text-muted-foreground">{step + 1}/{STEPS.length}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-5 pb-4 min-h-[280px]">{renderStep()}</CardContent>
      <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="text-xs h-8"><ChevronLeft className="w-3.5 h-3.5 mr-1" />Back</Button>}
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-8">Cancel</Button>
        </div>
        <div className="flex gap-2">
          {step < STEPS.length - 1
            ? <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={step === 0 && !selectedPropId} className="text-xs h-8 bg-[var(--color-hala-navy)]">Next<ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
            : <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="text-xs h-8"><Save className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save Draft"}</Button>
                <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800"><Send className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save & Submit"}</Button>
              </>}
        </div>
      </div>
    </Card>
  );
}

function RR({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1.5 border-b border-dashed border-muted last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-xs font-medium">{value}</span></div>;
}
