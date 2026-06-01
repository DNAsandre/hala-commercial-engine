/**
 * ComplianceCoverageTab — Tab 5 of Tender Drafting
 *
 * Maps RFP requirements to proposal blocks and evidence/appendices.
 * Compliance Coverage does not create separate proposal content.
 * It proves the proposal covers the tender requirements.
 *
 * No AI. No mock data. No duplicate writing.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Save, Loader2, Plus, Trash2, Shield, BarChart3 } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";

const COMPLIANCE_STATUSES = ["Not Started", "Drafted", "Covered", "Gap", "Clarification Required", "Not Applicable"];

interface ComplianceRow {
  id: string;
  requirement_id: string;
  requirement_text: string;
  source_document: string;
  linked_block_id: string;
  linked_appendix_or_document_id: string;
  status: string;
  owner: string;
  notes: string;
}

interface Props { ws: TenderWorkspace; reload: () => void }

export default function ComplianceCoverageTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const saved = drafting.compliance_coverage ?? {};
  const blocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const [requirements, setRequirements] = useState<ComplianceRow[]>(() =>
    Array.isArray(saved.requirements) ? saved.requirements : []
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const addRow = () => {
    setRequirements(prev => [...prev, {
      id: nanoid(8),
      requirement_id: `REQ-${String(prev.length + 1).padStart(3, "0")}`,
      requirement_text: "",
      source_document: "",
      linked_block_id: "",
      linked_appendix_or_document_id: "",
      status: "Not Started",
      owner: "",
      notes: "",
    }]);
    setDirty(true);
  };

  const updateRow = (id: string, patch: Partial<ComplianceRow>) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const removeRow = (id: string) => {
    setRequirements(prev => prev.filter(r => r.id !== id));
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateTenderDraftingData(tenderId, "compliance_coverage", { requirements }, "Compliance coverage updated");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Compliance Coverage saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [requirements, tenderId, reload]);

  const summary = useMemo(() => ({
    total: requirements.length,
    covered: requirements.filter(r => r.status === "Covered").length,
    drafted: requirements.filter(r => r.status === "Drafted").length,
    gaps: requirements.filter(r => r.status === "Gap").length,
    clarification: requirements.filter(r => r.status === "Clarification Required").length,
    notApplicable: requirements.filter(r => r.status === "Not Applicable").length,
  }), [requirements]);

  const statusColor = (s: string) => {
    if (s === "Covered") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "Drafted") return "border-blue-300 text-blue-700 bg-blue-50";
    if (s === "Gap") return "border-red-300 text-red-700 bg-red-50";
    if (s === "Clarification Required") return "border-amber-300 text-amber-700 bg-amber-50";
    if (s === "Not Applicable") return "border-slate-200 text-slate-500 bg-slate-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  // Block lookup for dropdown
  const blockOptions = blocks.map((b: any) => ({ id: b.id, label: `§${b.section_number || "?"} ${b.title || "Untitled"}` }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Compliance Coverage Summary</span>
            </div>
            <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-6 gap-3 text-center">
            {[
              ["Total", summary.total],
              ["Covered", summary.covered],
              ["Drafted", summary.drafted],
              ["Gaps", summary.gaps],
              ["Clarification", summary.clarification],
              ["N/A", summary.notApplicable],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-md border border-border p-2">
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requirement Matrix */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Compliance Requirements</span>
              <Badge variant="outline" className="text-[8px]">{requirements.length}</Badge>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addRow}>
              <Plus className="w-3 h-3" /> Add Requirement
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No compliance requirements captured yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold w-20">Req ID</th>
                    <th className="px-2 py-2 text-left font-semibold">Requirement</th>
                    <th className="px-2 py-2 text-left font-semibold w-28">Source Doc</th>
                    <th className="px-2 py-2 text-left font-semibold w-44">Linked Block</th>
                    <th className="px-2 py-2 text-left font-semibold w-28">Status</th>
                    <th className="px-2 py-2 text-left font-semibold w-20">Owner</th>
                    <th className="px-2 py-2 text-center font-semibold w-8">×</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-2 py-1.5">
                        <Input className="h-6 text-[10px] border-0 bg-transparent p-0 font-mono" value={r.requirement_id} onChange={e => updateRow(r.id, { requirement_id: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-6 text-[10px] border-0 bg-transparent p-0" value={r.requirement_text} onChange={e => updateRow(r.id, { requirement_text: e.target.value })} placeholder="Requirement text" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-6 text-[10px] border-0 bg-transparent p-0" value={r.source_document} onChange={e => updateRow(r.id, { source_document: e.target.value })} placeholder="e.g. RFP" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.linked_block_id} onValueChange={v => updateRow(r.id, { linked_block_id: v })}>
                          <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent p-0"><SelectValue placeholder="Link to block" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {blockOptions.map((bo: any) => <SelectItem key={bo.id} value={bo.id}>{bo.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.status} onValueChange={v => updateRow(r.id, { status: v })}>
                          <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent p-0"><SelectValue /></SelectTrigger>
                          <SelectContent>{COMPLIANCE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-6 text-[10px] border-0 bg-transparent p-0" value={r.owner} onChange={e => updateRow(r.id, { owner: e.target.value })} placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeRow(r.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
