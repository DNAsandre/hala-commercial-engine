/**
 * HIPSystemsIPModelTab — HIP Systems & IP Model
 * Data key: solution_design.hip
 * Save: merges only solution_design_data.hip
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, ChevronRight, Plus, X, Cpu, Link2, FileText, BarChart3, ArrowRight, Info } from "lucide-react";

type YesNoNA = "Yes" | "No" | "Not Assessed";
type IntegrationType = "None" | "Manual Upload" | "API" | "ERP" | "Customer Portal" | "EDI" | "Not Assessed";
type IntegrationStatus = "Open" | "In Progress" | "Confirmed" | "Needs Clarification" | "Not Assessed";
type SOPStatus = "Draft" | "Active" | "Needs Update" | "Not Available" | "Not Assessed";
type ReportStatus = "Available" | "Planned" | "Needs Development" | "Not Required" | "Not Assessed";
type ReadinessStatus = "Ready" | "Partially Ready" | "Needs Clarification" | "Not Assessed";

const SYSTEMS = ["WMS","TMS","GPS Tracking","Electronic POD","Barcode Scanning","RFID","Customer Portal","ERP Integration","API Integration","Dashboard Reporting","AWB Automation","Photo Evidence","Digital Signatures","Control Tower","Exception Reporting","SLA Dashboard","Inventory Reporting"];
const INTEGRATION_TYPES: IntegrationType[] = ["None","Manual Upload","API","ERP","Customer Portal","EDI","Not Assessed"];
const INT_STATUS: IntegrationStatus[] = ["Open","In Progress","Confirmed","Needs Clarification","Not Assessed"];
const SOP_STATUS: SOPStatus[] = ["Draft","Active","Needs Update","Not Available","Not Assessed"];
const REPORT_STATUS: ReportStatus[] = ["Available","Planned","Needs Development","Not Required","Not Assessed"];
const READINESS: ReadinessStatus[] = ["Ready","Partially Ready","Needs Clarification","Not Assessed"];
const YES_NO: YesNoNA[] = ["Yes","No","Not Assessed"];

const SOP_LABELS = ["Receiving SOP","Picking SOP","Dispatch SOP","Damage Handling SOP","Emergency SOP","Quality Control SOP","Load Management SOP","Billing / Invoicing SOP","Escalation Matrix","BCP / DRP","HSE Procedure"];
const REPORT_LABELS = ["Inventory Report","SLA Report","KPI Dashboard","POD Report","Exception Report","Incident Report","Cycle Count Report"];

const FUTURE_WIRING = [
  { source: "Systems Included", output: "Technology & Systems / annexure.a.config" },
  { source: "Integration Model", output: "Compliance & Process Controls" },
  { source: "SOPs", output: "SOPs / Control Tower / Visibility" },
  { source: "Reporting", output: "Performance Assurance / Dashboards" },
];

interface IntegrationData { integration_required: YesNoNA; integration_type: IntegrationType; customer_system: string; integration_notes: string; it_owner: string; status: IntegrationStatus; }
interface SOPRow { name: string; purpose: string; applies_to: string; owner: string; status: SOPStatus; document_reference: string; }
interface ReportRow { report: string; frequency: string; audience: string; source_system: string; owner: string; status: ReportStatus; }
interface HIPData { systems: string[]; integration: IntegrationData; sops: SOPRow[]; reports: ReportRow[]; recommendation: { readiness: ReadinessStatus; notes: string }; }

function emptyIntegration(): IntegrationData { return { integration_required: "Not Assessed", integration_type: "Not Assessed", customer_system: "", integration_notes: "", it_owner: "", status: "Not Assessed" }; }
function emptySOP(): SOPRow { return { name: "", purpose: "", applies_to: "", owner: "", status: "Not Assessed", document_reference: "" }; }
function emptyReport(): ReportRow { return { report: "", frequency: "", audience: "", source_system: "", owner: "", status: "Not Assessed" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }
function chipCls(sel: boolean): string { return sel ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium cursor-pointer" : "bg-card border-border text-muted-foreground hover:bg-muted/30 cursor-pointer"; }

interface Props { ws: TenderWorkspace; }

export default function HIPSystemsIPModelTab({ ws }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any; const hip = existing?.hip;

  const [systems, setSystems] = useState<string[]>(() => Array.isArray(hip?.systems) ? hip.systems : []);
  const [integration, setIntegration] = useState<IntegrationData>(() => hip?.integration ? { ...emptyIntegration(), ...hip.integration } : emptyIntegration());
  const [sops, setSops] = useState<SOPRow[]>(() => Array.isArray(hip?.sops) ? hip.sops : []);
  const [reports, setReports] = useState<ReportRow[]>(() => Array.isArray(hip?.reports) ? hip.reports : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => hip?.recommendation ? { readiness: "Not Assessed", notes: "", ...hip.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ systems: true, integration: true, sops: true, reports: true, rec: true, future: false });
  const tog = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));
  const toggleChip = (val: string) => setSystems(p => p.includes(val) ? p.filter(v => v !== val) : [...p, val]);

  const addSOP = () => setSops(p => [...p, emptySOP()]);
  const rmSOP = (i: number) => setSops(p => p.filter((_, x) => x !== i));
  const upSOP = (i: number, f: keyof SOPRow, v: any) => setSops(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  const addReport = () => setReports(p => [...p, emptyReport()]);
  const rmReport = (i: number) => setReports(p => p.filter((_, x) => x !== i));
  const upReport = (i: number, f: keyof ReportRow, v: any) => setReports(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), hip: { systems, integration, sops, reports, recommendation } };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "HIP Systems & IP Model saved");
      if (result.success) toast.success("HIP Systems & IP Model saved"); else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, systems, integration, sops, reports, recommendation, existing]);

  return (
    <div className="space-y-4">
      {/* Configuration-aware advisory banner */}
      {(() => {
        const cfg = existing?.configuration;
        const sel = cfg?.selected_modules || "";
        const hipIncluded = sel.toUpperCase().includes("HIP");
        const notSelected = !sel || sel === "Not Selected";
        if (notSelected) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600"><Info className="w-3.5 h-3.5 shrink-0" /> Solution configuration has not been selected yet.</div>;
        if (hipIncluded) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700"><Info className="w-3.5 h-3.5 shrink-0" /> HIP is required by the selected solution configuration.</div>;
        return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700"><Info className="w-3.5 h-3.5 shrink-0" /> HIP is not selected in the current solution configuration. Capture only if operational scope is still relevant.</div>;
      })()}
      {/* Systems Included */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("systems")}>
          <div className="flex items-center gap-2">
            {open.systems ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Systems Included</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{systems.length} selected</Badge>
          </div>
        </CardHeader>
        {open.systems && (
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">{SYSTEMS.map(s => <button key={s} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${chipCls(systems.includes(s))}`} onClick={() => toggleChip(s)}>{s}</button>)}</div>
          </CardContent>
        )}
      </Card>

      {/* Integration */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("integration")}>
          <div className="flex items-center gap-2">
            {open.integration ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Link2 className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Integration Model</span>
          </div>
        </CardHeader>
        {open.integration && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Integration Required</label>
              <div className="flex gap-1.5">{YES_NO.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(integration.integration_required === o)}`} onClick={() => setIntegration(p => ({ ...p, integration_required: o }))}>{o}</button>)}</div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Integration Type</label>
              <div className="flex flex-wrap gap-1.5">{INTEGRATION_TYPES.map(o => <button key={o} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${btnCls(integration.integration_type === o)}`} onClick={() => setIntegration(p => ({ ...p, integration_type: o }))}>{o}</button>)}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Customer System</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={integration.customer_system} onChange={e => setIntegration(p => ({ ...p, customer_system: e.target.value }))} /></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">IT Owner</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={integration.it_owner} onChange={e => setIntegration(p => ({ ...p, it_owner: e.target.value }))} /></div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Status</label>
                <div className="flex flex-wrap gap-1">{INT_STATUS.map(o => <button key={o} type="button" className={`px-2 py-1 rounded border text-[9px] transition-colors ${btnCls(integration.status === o)}`} onClick={() => setIntegration(p => ({ ...p, status: o }))}>{o}</button>)}</div>
              </div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Integration Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" value={integration.integration_notes} onChange={e => setIntegration(p => ({ ...p, integration_notes: e.target.value }))} /></div>
          </CardContent>
        )}
      </Card>

      {/* SOP / Process Control */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("sops")}>
          <div className="flex items-center gap-2">
            {open.sops ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <FileText className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">SOP / Process Control</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{sops.length}</Badge>
          </div>
        </CardHeader>
        {open.sops && (
          <CardContent className="p-4 space-y-3">
            {sops.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No SOPs captured yet.</p>}
            {sops.map((row, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmSOP(i)}><X className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">SOP / Control</label><select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.name} onChange={e => upSOP(i, "name", e.target.value)}><option value="">Select...</option>{SOP_LABELS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Purpose</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.purpose} onChange={e => upSOP(i, "purpose", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Applies To</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.applies_to} onChange={e => upSOP(i, "applies_to", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upSOP(i, "owner", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{SOP_STATUS.map(s => <button key={s} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upSOP(i, "status", s)}>{s}</button>)}</div></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Doc Reference</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.document_reference} onChange={e => upSOP(i, "document_reference", e.target.value)} /></div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addSOP}><Plus className="w-3 h-3" /> Add SOP / Control</Button>
          </CardContent>
        )}
      </Card>

      {/* Reporting */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("reports")}>
          <div className="flex items-center gap-2">
            {open.reports ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Reporting & Visibility</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{reports.length}</Badge>
          </div>
        </CardHeader>
        {open.reports && (
          <CardContent className="p-4 space-y-3">
            {reports.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No reports captured yet.</p>}
            {reports.map((row, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmReport(i)}><X className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Report / Dashboard</label><select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.report} onChange={e => upReport(i, "report", e.target.value)}><option value="">Select...</option>{REPORT_LABELS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Frequency</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.frequency} onChange={e => upReport(i, "frequency", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Audience</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.audience} onChange={e => upReport(i, "audience", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Source System</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.source_system} onChange={e => upReport(i, "source_system", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upReport(i, "owner", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{REPORT_STATUS.map(s => <button key={s} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upReport(i, "status", s)}>{s}</button>)}</div></div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addReport}><Plus className="w-3 h-3" /> Add Report / Dashboard</Button>
          </CardContent>
        )}
      </Card>

      {/* HIP Recommendation */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("rec")}>
          <div className="flex items-center gap-2">
            {open.rec ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">HIP Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{recommendation.readiness !== "Not Assessed" ? recommendation.readiness : "Not Assessed"}</Badge>
          </div>
        </CardHeader>
        {open.rec && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Systems / IP Readiness</label>
              <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">HIP Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter HIP notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
          </CardContent>
        )}
      </Card>

      {/* Future Output Use */}
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
          Save HIP Systems & IP Model
        </Button>
      </div>
    </div>
  );
}
