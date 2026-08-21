/**
 * CompetitorIntelTab — Tab 3 of Lost/Withdrawn Stage
 *
 * Capture intelligence about competitors from this tender.
 * Who competed, their strengths/weaknesses, pricing intel.
 *
 * Data: type_details.lost_withdrawn_data.competitor_intel
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Loader2, Info, Eye, Plus } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderLostWithdrawnData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  /** TCW-T4 (C3): lets the stage shell render the real Unsaved/Saved badge. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface CompetitorEntry {
  id: string;
  name: string;
  known_price: string;
  strengths: string;
  weaknesses: string;
  notes: string;
}

export default function CompetitorIntelTab({ ws, reload, onDirtyChange }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.lost_withdrawn_data?.competitor_intel ?? {};

  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(Array.isArray(saved.competitors) ? saved.competitors : []);
  const [marketNotes, setMarketNotes] = useState(saved.market_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => { setDirty(true); onDirtyChange?.(true); };

  const addCompetitor = () => {
    setCompetitors(prev => [...prev, {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "", known_price: "", strengths: "", weaknesses: "", notes: "",
    }]);
    mark();
  };

  const updateCompetitor = (id: string, field: keyof CompetitorEntry, value: string) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c)); mark();
  };
  const removeCompetitor = (id: string) => { setCompetitors(prev => prev.filter(c => c.id !== id)); mark(); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = { competitors, market_notes: marketNotes };
      const res = await updateTenderLostWithdrawnData(tenderId, "competitor_intel", payload, `${competitors.length} competitors logged`, wsRevisionToken(ws));
      // P2a threading + honest outcome; stale keeps the entry on screen.
      if (!reportSaveOutcome(res, "Competitor intelligence saved.")) return;
      setDirty(false); onDirtyChange?.(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [competitors, marketNotes, tenderId, reload, ws, onDirtyChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Eye className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Record what you learned about competitors during this tender. This intelligence is reusable across future bids.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Competitors</span>
        <Badge variant="outline" className="text-[8px]">{competitors.length} logged</Badge>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Competitor Cards */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Competitor Register</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addCompetitor}><Plus className="w-3 h-3" /> Add Competitor</Button>
        </CardHeader>
        <CardContent className="p-0">
          {competitors.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No competitors logged yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {competitors.map((comp, idx) => (
                <div key={comp.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">Competitor {idx + 1}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeCompetitor(comp.id)}>×</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-semibold text-muted-foreground">Company Name</label>
                      <Input className="h-7 text-[10px] mt-1" value={comp.name} onChange={e => updateCompetitor(comp.id, "name", e.target.value)} placeholder="Competitor company name" /></div>
                    <div><label className="text-[10px] font-semibold text-muted-foreground">Known Price (if available)</label>
                      <Input className="h-7 text-[10px] mt-1" value={comp.known_price} onChange={e => updateCompetitor(comp.id, "known_price", e.target.value)} placeholder="e.g. SAR 2.4M or 'Lower than ours'" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-semibold text-muted-foreground">Strengths</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={comp.strengths} onChange={e => updateCompetitor(comp.id, "strengths", e.target.value)} placeholder="What are they good at?" /></div>
                    <div><label className="text-[10px] font-semibold text-muted-foreground">Weaknesses</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={comp.weaknesses} onChange={e => updateCompetitor(comp.id, "weaknesses", e.target.value)} placeholder="Where are they weak?" /></div>
                  </div>
                  <div><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
                    <Input className="h-7 text-[10px] mt-1" value={comp.notes} onChange={e => updateCompetitor(comp.id, "notes", e.target.value)} placeholder="Any other intel..." /></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Notes */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Market Notes</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <Textarea className="text-xs min-h-[60px]" value={marketNotes} onChange={e => { setMarketNotes(e.target.value); mark(); }} placeholder="General market observations, pricing trends, client preferences noticed..." />
        </CardContent>
      </Card>
    </div>
  );
}
