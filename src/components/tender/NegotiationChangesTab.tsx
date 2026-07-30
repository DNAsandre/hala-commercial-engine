/**
 * NegotiationChangesTab — Tab 2 of Negotiation Stage
 *
 * Tracks specific items the client wants changed.
 * Each item has Hala's position: accept / reject / counter.
 *
 * Data: type_details.negotiation_data.requested_changes (array)
 * No AI. No mock data.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Plus, Info, ChevronDown, ChevronRight, ClipboardList, X } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderNegotiationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

interface ChangeItem {
  id: string;
  category: string;
  description: string;
  client_request: string;
  hala_position: string;
  counter_proposal: string;
  gp_impact: string;
  status: string;
  notes: string;
}

const CATEGORIES = [
  { value: "price", label: "Price" },
  { value: "payment_terms", label: "Payment Terms" },
  { value: "sla_penalties", label: "SLA / Penalties" },
  { value: "contract_duration", label: "Contract Duration" },
  { value: "scope_change", label: "Scope Change" },
  { value: "insurance_liability", label: "Insurance / Liability" },
  { value: "mobilization", label: "Mobilization" },
  { value: "kpis_reporting", label: "KPIs / Reporting" },
  { value: "staffing", label: "Staffing" },
  { value: "other", label: "Other" },
] as const;

const POSITIONS = [
  { value: "pending", label: "Pending" },
  { value: "accept", label: "Accept" },
  { value: "reject", label: "Reject" },
  { value: "counter", label: "Counter" },
] as const;

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "agreed", label: "Agreed" },
  { value: "disputed", label: "Disputed" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

const emptyItem = (): ChangeItem => ({
  id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  category: "price", description: "", client_request: "",
  hala_position: "pending", counter_proposal: "", gp_impact: "",
  status: "open", notes: "",
});

export default function NegotiationChangesTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const savedItems = td?.negotiation_data?.requested_changes ?? [];

  const [items, setItems] = useState<ChangeItem[]>(Array.isArray(savedItems) ? savedItems : []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const stats = useMemo(() => ({
    total: items.length,
    accepted: items.filter(i => i.hala_position === "accept").length,
    rejected: items.filter(i => i.hala_position === "reject").length,
    countered: items.filter(i => i.hala_position === "counter").length,
    pending: items.filter(i => i.hala_position === "pending").length,
  }), [items]);

  const addItem = () => { setItems(prev => [emptyItem(), ...prev]); mark(); };
  const updateItem = (id: string, field: keyof ChangeItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i)); mark();
  };
  const removeItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); mark(); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateTenderNegotiationData(tenderId, "requested_changes", items, `${items.length} items`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Requested changes saved.");
      setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [items, tenderId, reload]);

  const posColor = (p: string) => {
    if (p === "accept") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (p === "reject") return "border-red-300 text-red-700 bg-red-50";
    if (p === "counter") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-amber-300 text-amber-700 bg-amber-50";
  };
  const statusColor = (s: string) => {
    if (s === "agreed") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "disputed") return "border-red-300 text-red-700 bg-red-50";
    if (s === "withdrawn") return "border-slate-200 text-slate-500 bg-slate-50";
    return "border-amber-300 text-amber-700 bg-amber-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Track each item the client wants changed. Record Hala's position (accept, reject, counter) and the GP impact of each concession.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Changes</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[8px]">{stats.total} items</Badge>
          {stats.accepted > 0 && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50">{stats.accepted} accepted</Badge>}
          {stats.countered > 0 && <Badge variant="outline" className="text-[8px] border-blue-200 text-blue-700 bg-blue-50">{stats.countered} countered</Badge>}
          {stats.rejected > 0 && <Badge variant="outline" className="text-[8px] border-red-200 text-red-700 bg-red-50">{stats.rejected} rejected</Badge>}
          {stats.pending > 0 && <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-700 bg-amber-50">{stats.pending} pending</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addItem}><Plus className="w-3 h-3" /> Add Item</Button>
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No requested changes logged yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const isExp = expandedId === item.id;
            return (
              <Card key={item.id} className="border-border shadow-none">
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExp ? null : item.id)}>
                  {isExp ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                  <Badge variant="outline" className="text-[8px] w-28 justify-center shrink-0">{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</Badge>
                  <span className="text-xs font-medium truncate flex-1">{item.description || "Untitled change"}</span>
                  <Badge variant="outline" className={`text-[8px] w-16 justify-center shrink-0 ${posColor(item.hala_position)}`}>
                    {POSITIONS.find(p => p.value === item.hala_position)?.label}
                  </Badge>
                  <Badge variant="outline" className={`text-[8px] w-18 justify-center shrink-0 ${statusColor(item.status)}`}>
                    {STATUSES.find(s => s.value === item.status)?.label}
                  </Badge>
                  {item.gp_impact && <span className="text-[9px] text-muted-foreground shrink-0">GP: {item.gp_impact}</span>}
                </div>
                {isExp && (
                  <CardContent className="px-4 pb-4 pt-0 border-t border-border bg-muted/5">
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Category</label>
                        <Select value={item.category} onValueChange={v => updateItem(item.id, "category", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Hala's Position</label>
                        <Select value={item.hala_position} onValueChange={v => updateItem(item.id, "hala_position", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{POSITIONS.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Status</label>
                        <Select value={item.status} onValueChange={v => updateItem(item.id, "status", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-muted-foreground">Description</label>
                        <Input className="h-8 text-xs mt-1" value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} placeholder="What the client wants changed" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">GP Impact</label>
                        <Input className="h-8 text-xs mt-1" value={item.gp_impact} onChange={e => updateItem(item.id, "gp_impact", e.target.value)} placeholder="e.g. -1.5%" />
                      </div>
                    </div>
                    <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Client's Request</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={item.client_request} onChange={e => updateItem(item.id, "client_request", e.target.value)} placeholder="What exactly did the client ask for?" /></div>
                    {item.hala_position === "counter" && (
                      <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Counter Proposal</label>
                        <Textarea className="text-xs mt-1 min-h-[40px]" value={item.counter_proposal} onChange={e => updateItem(item.id, "counter_proposal", e.target.value)} placeholder="Hala's counter-offer..." /></div>
                    )}
                    <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={item.notes} onChange={e => updateItem(item.id, "notes", e.target.value)} placeholder="Internal notes..." /></div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => removeItem(item.id)}><X className="w-3 h-3" /> Remove</Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
