/**
 * SupportingDocuments — Reusable panel for stage-linked document management.
 * Appears inside every stage workbench tab as "Supporting Documents".
 * Currently mocked UI — upload is placeholder, metadata is captured.
 */
import { useState } from "react";
import { FileText, Upload, Plus, X, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUPPORTING_DOC_CATEGORIES } from "./proposal-stages";

interface SupportingDoc {
  id: string;
  file_name: string;
  category: string;
  owner: string;
  version: string;
  notes: string;
  linked_stage: string;
  linked_tab: string;
  used_in_pricing: boolean;
  used_in_proposal: boolean;
  created_at: string;
}

interface SupportingDocumentsProps {
  stageKey: string;
  stageLabel: string;
  tabKey?: string;
}

export default function SupportingDocuments({ stageKey, stageLabel, tabKey }: SupportingDocumentsProps) {
  const [docs, setDocs] = useState<SupportingDoc[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    file_name: "", category: "", owner: "", version: "1.0",
    notes: "", used_in_pricing: false, used_in_proposal: false,
  });

  function handleAdd() {
    if (!form.file_name.trim()) return;
    const doc: SupportingDoc = {
      id: `sd-${Date.now()}`,
      ...form,
      linked_stage: stageKey,
      linked_tab: tabKey || "",
      created_at: new Date().toISOString(),
    };
    setDocs(prev => [doc, ...prev]);
    setForm({ file_name: "", category: "", owner: "", version: "1.0", notes: "", used_in_pricing: false, used_in_proposal: false });
    setAddOpen(false);
  }

  return (
    <Card className="shadow-none border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-indigo-500" />
            Supporting Documents
            <Badge variant="outline" className="text-[9px] ml-1">{stageLabel}</Badge>
          </span>
          <Button size="sm" variant="outline" className="gap-1 text-[10px] h-7" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3" /> Add Document
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <div className="py-6 text-center border border-dashed rounded-md bg-muted/20">
            <Upload className="h-5 w-5 mx-auto text-muted-foreground/40 mb-1.5" />
            <p className="text-[11px] text-muted-foreground">No supporting documents for this stage yet.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add customer requirements, vendor quotes, costing sheets, etc.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs bg-card">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{d.file_name}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{d.category || "General"}</Badge>
                  {d.used_in_pricing && <Badge variant="outline" className="text-[9px] border-violet-200 bg-violet-50 text-violet-600 shrink-0">Pricing</Badge>}
                  {d.used_in_proposal && <Badge variant="outline" className="text-[9px] border-indigo-200 bg-indigo-50 text-indigo-600 shrink-0">Proposal</Badge>}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                  <span>v{d.version}</span>
                  <span>{d.owner || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Add Supporting Document</DialogTitle>
              <DialogDescription className="text-xs">Linked to stage: {stageLabel}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">File Name *</Label>
                <Input value={form.file_name} onChange={e => setForm(f => ({ ...f, file_name: e.target.value }))} placeholder="e.g. Customer_SOW_v2.pdf" className="text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTING_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Owner</Label>
                  <Input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name" className="text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Version</Label>
                  <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="text-sm" />
                </div>
                <div className="space-y-1 flex items-end gap-3 pb-0.5">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.used_in_pricing} onChange={e => setForm(f => ({ ...f, used_in_pricing: e.target.checked }))} className="accent-violet-600" />
                    Pricing
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.used_in_proposal} onChange={e => setForm(f => ({ ...f, used_in_proposal: e.target.checked }))} className="accent-indigo-600" />
                    Proposal
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs" placeholder="Context, changes, version notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={!form.file_name.trim()}>Add Document</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
