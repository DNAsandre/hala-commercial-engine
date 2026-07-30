/**
 * HIPSystemsIPModelTab — HIP Systems & IP Model
 * Data key: solution_design.hip
 * Save: merges only solution_design_data.hip
 *
 * 6 Sections (section-tab navigation, matching Qualification pattern):
 *   1. Systems Included
 *   2. Integration Model
 *   3. SOP / Process Control
 *   4. Reporting & Visibility
 *   5. HIP Recommendation
 *   6. Output Use
 */
import { useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, Plus, X, Cpu, Link2, FileText, BarChart3, ArrowRight, Info, FolderOpen, PanelRightOpen } from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

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

// ── Section tabs ─────────────────────────────────────────────────────
type HIPSectionKey = "systems" | "integration" | "sops" | "reports" | "recommendation" | "wiring";

const HIP_SECTION_TABS: { key: HIPSectionKey; label: string; icon: ReactNode }[] = [
  { key: "systems", label: "Systems Selection", icon: <Cpu className="w-3.5 h-3.5" /> },
  { key: "integration", label: "Integration", icon: <Link2 className="w-3.5 h-3.5" /> },
  { key: "sops", label: "SOP / Process", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "reports", label: "Reporting", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "HIP Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <Info className="w-3.5 h-3.5" /> },
];

interface IntegrationData { integration_required: YesNoNA; integration_type: IntegrationType; customer_system: string; integration_notes: string; it_owner: string; status: IntegrationStatus; }
interface SOPRow { name: string; purpose: string; applies_to: string; owner: string; status: SOPStatus; document_reference: string; }
interface ReportRow { report: string; frequency: string; audience: string; source_system: string; owner: string; status: ReportStatus; }

function emptyIntegration(): IntegrationData { return { integration_required: "Not Assessed", integration_type: "Not Assessed", customer_system: "", integration_notes: "", it_owner: "", status: "Not Assessed" }; }
function emptySOP(): SOPRow { return { name: "", purpose: "", applies_to: "", owner: "", status: "Not Assessed", document_reference: "" }; }
function emptyReport(): ReportRow { return { report: "", frequency: "", audience: "", source_system: "", owner: "", status: "Not Assessed" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }
function chipCls(sel: boolean): string { return sel ? "bg-[#075eea]/15 border-[#075eea]/30 text-[#075eea] font-medium cursor-pointer" : "bg-card border-border text-muted-foreground hover:bg-muted/30 cursor-pointer"; }

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

export default function HIPSystemsIPModelTab({ ws, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any; const hip = existing?.hip;

  const [systems, setSystems] = useState<string[]>(() => Array.isArray(hip?.systems) ? hip.systems : []);
  const [integration, setIntegration] = useState<IntegrationData>(() => hip?.integration ? { ...emptyIntegration(), ...hip.integration } : emptyIntegration());
  const [sops, setSops] = useState<SOPRow[]>(() => Array.isArray(hip?.sops) ? hip.sops : []);
  const [reports, setReports] = useState<ReportRow[]>(() => Array.isArray(hip?.reports) ? hip.reports : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => hip?.recommendation ? { readiness: "Not Assessed", notes: "", ...hip.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<HIPSectionKey>("systems");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
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
                <StageIntelMetric label="Systems" value={`${systems.length} selected`} />
                <StageIntelMetric label="SOPs" value={`${sops.length}`} />
                <StageIntelMetric label="Reports" value={`${reports.length}`} />
                <StageIntelMetric label="Readiness" value={recommendation.readiness} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {HIP_SECTION_TABS.map(section => (
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
      {(() => {
        const cfg = existing?.configuration;
        const sel = cfg?.selected_modules || "";
        const hipIncluded = sel.toUpperCase().includes("HIP");
        const notSelected = !sel || sel === "Not Selected";
        if (notSelected) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600"><Info className="w-3.5 h-3.5 shrink-0" /> Solution configuration has not been selected yet.</div>;
        if (hipIncluded) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700"><Info className="w-3.5 h-3.5 shrink-0" /> HIP is required by the selected solution configuration.</div>;
        return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700"><Info className="w-3.5 h-3.5 shrink-0" /> HIP is not selected in the current solution configuration. Capture only if operational scope is still relevant.</div>;
      })()}

      {/* ── 1. Systems Included ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "systems" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Systems Included" icon={<Cpu className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${systems.length} selected`} /></CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-1.5">{SYSTEMS.map(s => <button key={s} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${chipCls(systems.includes(s))}`} onClick={() => toggleChip(s)}>{s}</button>)}</div>
        </CardContent>
      </Card>

      {/* ── 2. Integration Model ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "integration" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Integration Model" icon={<Link2 className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
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
      </Card>

      {/* ── 3. SOP / Process Control ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "sops" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="SOP / Process Control" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${sops.length}`} /></CardHeader>
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
      </Card>

      {/* ── 4. Reporting & Visibility ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "reports" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Reporting & Visibility" icon={<BarChart3 className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${reports.length}`} /></CardHeader>
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
      </Card>

      {/* ── 5. HIP Recommendation ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="HIP Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.readiness} /></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Systems / IP Readiness</label>
            <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">HIP Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter HIP notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
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
          Save HIP Systems & IP Model
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
