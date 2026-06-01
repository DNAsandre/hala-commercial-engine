/**
 * ScopeMatrixTab — Scope Responsibility Matrix
 * Data key: solution_design.scope_matrix
 * Save: merges only solution_design_data.scope_matrix
 */
import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, ChevronRight, Plus, X, Table, BarChart3, ArrowRight, Info } from "lucide-react";

type IncludedStatus = "Yes" | "No" | "Partial" | "Not Assessed";
type YesNoNA = "Yes" | "No" | "Not Assessed";

const INCLUDED_OPTIONS: IncludedStatus[] = ["Yes", "No", "Partial", "Not Assessed"];
const CLAR_OPTIONS: YesNoNA[] = ["Yes", "No", "Not Assessed"];

const SUGGESTED_SCOPE_ITEMS = [
  "Inbound Receiving", "Inspection", "Storage", "Inventory Updates", "Picking", "Packing",
  "Labelling", "Dispatch", "Transportation", "Loading", "Offloading", "Insurance", "Permits",
  "Forecasting", "ASN", "Reporting", "SLA Monitoring", "Emergency Support",
];

const FUTURE_WIRING = [
  { source: "Scope Matrix", output: "scope.table / Responsibility Matrix" },
  { source: "Included Items", output: "Scope of Services" },
  { source: "Exclusions", output: "Exclusions / Terms & Conditions" },
];

interface ScopeRow {
  scope_item: string; included: IncludedStatus; hala_responsibility: string;
  customer_responsibility: string; third_party_responsibility: string;
  evidence_source: string; commercial_impact: string;
  clarification_needed: YesNoNA; notes: string;
}

function emptyRow(): ScopeRow {
  return { scope_item: "", included: "Not Assessed", hala_responsibility: "", customer_responsibility: "", third_party_responsibility: "", evidence_source: "", commercial_impact: "", clarification_needed: "Not Assessed", notes: "" };
}

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }
function inclColor(s: IncludedStatus): string {
  if (s === "Yes") return "bg-emerald-100 border-emerald-300 text-emerald-700";
  if (s === "No") return "bg-red-100 border-red-300 text-red-700";
  if (s === "Partial") return "bg-amber-100 border-amber-300 text-amber-700";
  return "bg-slate-100 border-slate-300 text-slate-600";
}

interface Props { ws: TenderWorkspace; }

export default function ScopeMatrixTab({ ws }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const sm = existing?.scope_matrix;

  const [rows, setRows] = useState<ScopeRow[]>(() => Array.isArray(sm?.rows) ? sm.rows : []);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ matrix: true, summary: true, future: false });
  const tog = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const addRow = (template?: string) => setRows(p => [...p, { ...emptyRow(), scope_item: template || "" }]);
  const rmRow = (i: number) => setRows(p => p.filter((_, x) => x !== i));
  const upRow = (i: number, f: keyof ScopeRow, v: any) => setRows(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));

  const summary = useMemo(() => {
    const included = rows.filter(r => r.included === "Yes").length;
    const excluded = rows.filter(r => r.included === "No").length;
    const partial = rows.filter(r => r.included === "Partial").length;
    const clarNeeded = rows.filter(r => r.clarification_needed === "Yes").length;
    return { total: rows.length, included, excluded, partial, clarNeeded };
  }, [rows]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), scope_matrix: { rows } };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "Scope Matrix saved");
      if (result.success) toast.success("Scope Matrix saved"); else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, rows, existing]);

  return (
    <div className="space-y-4">
      {/* Scope Matrix */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("matrix")}>
          <div className="flex items-center gap-2">
            {open.matrix ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Table className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Scope Responsibility Matrix</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{rows.length} items</Badge>
          </div>
        </CardHeader>
        {open.matrix && (
          <CardContent className="p-4 space-y-3">
            {rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No scope matrix rows captured yet.</p>}
            {rows.map((row, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmRow(i)}><X className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Scope Item</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.scope_item} onChange={e => upRow(i, "scope_item", e.target.value)} /></div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Included?</label>
                    <div className="flex gap-1">{INCLUDED_OPTIONS.map(o => <button key={o} type="button" className={`px-2 py-0.5 rounded border text-[9px] transition-colors ${row.included === o ? inclColor(o) + " font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"}`} onClick={() => upRow(i, "included", o)}>{o}</button>)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Hala Responsibility</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.hala_responsibility} onChange={e => upRow(i, "hala_responsibility", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Customer Responsibility</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.customer_responsibility} onChange={e => upRow(i, "customer_responsibility", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Third Party Responsibility</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.third_party_responsibility} onChange={e => upRow(i, "third_party_responsibility", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Evidence / Source</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.evidence_source} onChange={e => upRow(i, "evidence_source", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Commercial Impact</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.commercial_impact} onChange={e => upRow(i, "commercial_impact", e.target.value)} /></div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Clarification Needed</label>
                    <div className="flex gap-1">{CLAR_OPTIONS.map(o => <button key={o} type="button" className={`px-2 py-0.5 rounded border text-[9px] transition-colors ${btnCls(row.clarification_needed === o)}`} onClick={() => upRow(i, "clarification_needed", o)}>{o}</button>)}</div>
                  </div>
                </div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Notes</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.notes} onChange={e => upRow(i, "notes", e.target.value)} /></div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 items-center">
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => addRow()}><Plus className="w-3 h-3" /> Add Scope Item</Button>
              <span className="text-[9px] text-muted-foreground mx-2">or add template:</span>
              <div className="flex flex-wrap gap-1">{SUGGESTED_SCOPE_ITEMS.filter(s => !rows.some(r => r.scope_item === s)).slice(0, 6).map(s => <button key={s} type="button" className="px-2 py-0.5 rounded border text-[8px] bg-card border-border text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => addRow(s)}>{s}</button>)}</div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("summary")}>
          <div className="flex items-center gap-2">
            {open.summary ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Scope Matrix Summary</span>
          </div>
        </CardHeader>
        {open.summary && (
          <CardContent className="p-4">
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No scope matrix rows captured yet.</p>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center"><div className="text-lg font-bold">{summary.total}</div><div className="text-[9px] text-muted-foreground">Total Items</div></div>
                <div className="text-center"><div className="text-lg font-bold text-emerald-600">{summary.included}</div><div className="text-[9px] text-muted-foreground">Included</div></div>
                <div className="text-center"><div className="text-lg font-bold text-red-600">{summary.excluded}</div><div className="text-[9px] text-muted-foreground">Excluded</div></div>
                <div className="text-center"><div className="text-lg font-bold text-amber-600">{summary.partial}</div><div className="text-[9px] text-muted-foreground">Partial</div></div>
                <div className="text-center"><div className="text-lg font-bold text-blue-600">{summary.clarNeeded}</div><div className="text-[9px] text-muted-foreground">Clarification Needed</div></div>
              </div>
            )}
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
          Save Scope Matrix
        </Button>
      </div>
    </div>
  );
}
