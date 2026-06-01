/**
 * AppendicesEvidenceTab — Tab 6 of Tender Drafting
 *
 * Maps global documents to proposal blocks as evidence/appendices.
 * Evidence gaps tracker. Open Documents button.
 * No duplicate document upload store. No AI.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Save, Loader2, Plus, Trash2, FileText, FolderOpen, AlertTriangle } from "lucide-react";
import { type TenderWorkspace, type TenderDocument } from "@/lib/tender-workspace-data";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";

const GAP_STATUSES = ["Missing", "Requested", "Uploaded", "Needs Update", "Not Required"];

interface EvidenceGap {
  id: string;
  missing_evidence: string;
  required_for: string;
  linked_block_id: string;
  linked_section: string;
  owner: string;
  due_date: string;
  status: string;
  notes: string;
}

interface Props { ws: TenderWorkspace; reload: () => void; onOpenDocuments?: () => void }

export default function AppendicesEvidenceTab({ ws, reload, onOpenDocuments }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const saved = drafting.appendices_evidence ?? {};
  const docs = ws.documents ?? [];
  const blocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const [gaps, setGaps] = useState<EvidenceGap[]>(() => Array.isArray(saved.evidence_gaps) ? saved.evidence_gaps : []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Block options for linking
  const blockOptions = blocks.map((b: any) => ({ id: b.id, label: `§${b.section_number || "?"} ${b.title || "Untitled"}` }));

  const addGap = () => {
    setGaps(prev => [...prev, { id: nanoid(8), missing_evidence: "", required_for: "", linked_block_id: "", linked_section: "", owner: "", due_date: "", status: "Missing", notes: "" }]);
    setDirty(true);
  };
  const updateGap = (id: string, patch: Partial<EvidenceGap>) => {
    setGaps(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
    setDirty(true);
  };
  const removeGap = (id: string) => {
    setGaps(prev => prev.filter(g => g.id !== id));
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateTenderDraftingData(tenderId, "appendices_evidence", { evidence_gaps: gaps }, "Appendices & evidence updated");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Appendices & Evidence saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [gaps, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "Uploaded") return "border-emerald-200 text-emerald-600";
    if (s === "Missing") return "border-red-200 text-red-600";
    if (s === "Needs Update") return "border-amber-200 text-amber-600";
    if (s === "Requested") return "border-blue-200 text-blue-600";
    return "border-slate-200 text-slate-500";
  };

  return (
    <div className="space-y-4">
      {/* Evidence Register from global docs */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Evidence Register</span>
              <Badge variant="outline" className="text-[8px]">{docs.length} document{docs.length !== 1 ? "s" : ""}</Badge>
              <Badge variant="outline" className="text-[8px] border-violet-200 text-violet-600">from global library</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
              </Button>
              {onOpenDocuments && (
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={onOpenDocuments}>
                  <FolderOpen className="w-3 h-3" /> Open Documents
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No documents in global tender library.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold">Document</th>
                    <th className="px-2 py-2 text-left font-semibold">Type</th>
                    <th className="px-2 py-2 text-left font-semibold">Category</th>
                    <th className="px-2 py-2 text-left font-semibold">Status</th>
                    <th className="px-2 py-2 text-left font-semibold">Expiry</th>
                    <th className="px-2 py-2 text-left font-semibold">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d: TenderDocument) => (
                    <tr key={d.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-2 py-1.5 font-medium">{d.document_name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{d.document_type || "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{d.document_category || "—"}</td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className={`text-[8px] ${statusColor(d.status)}`}>{d.status}</Badge></td>
                      <td className="px-2 py-1.5 text-muted-foreground font-mono">{d.expiry_date || "—"}</td>
                      <td className="px-2 py-1.5">{d.required_for_submission ? <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-600">Required</Badge> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Gaps with Block Linking */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold">Evidence Gaps</span>
              <Badge variant="outline" className="text-[8px]">{gaps.length}</Badge>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addGap}><Plus className="w-3 h-3" /> Add Gap</Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No evidence gaps recorded yet.</p>
          ) : gaps.map(g => (
            <div key={g.id} className="grid grid-cols-8 gap-2 items-start border border-border rounded-md p-2">
              <Input className="h-7 text-[10px] col-span-2" value={g.missing_evidence} onChange={e => updateGap(g.id, { missing_evidence: e.target.value })} placeholder="Missing evidence" />
              <Input className="h-7 text-[10px]" value={g.required_for} onChange={e => updateGap(g.id, { required_for: e.target.value })} placeholder="Required for" />
              <Select value={g.linked_block_id} onValueChange={v => updateGap(g.id, { linked_block_id: v })}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Link block" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {blockOptions.map((bo: any) => <SelectItem key={bo.id} value={bo.id}>{bo.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="h-7 text-[10px]" value={g.owner} onChange={e => updateGap(g.id, { owner: e.target.value })} placeholder="Owner" />
              <Input className="h-7 text-[10px]" type="date" value={g.due_date} onChange={e => updateGap(g.id, { due_date: e.target.value })} />
              <Select value={g.status} onValueChange={v => updateGap(g.id, { status: v })}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>{GAP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeGap(g.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
