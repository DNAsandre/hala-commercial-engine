/**
 * NegotiationLogTab — Tab 1 of Negotiation Stage
 *
 * Chronological log of negotiation meetings/discussions.
 * Each entry = one meeting or exchange with the client.
 *
 * Data: type_details.negotiation_data.negotiation_log (array)
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
import { Save, Loader2, Plus, Info, ChevronDown, ChevronRight, MessageSquare, X, Calendar, Users } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderNegotiationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

interface LogEntry {
  id: string;
  date: string;
  type: string;
  attendees: string;
  summary: string;
  key_points: string;
  action_items: string;
  next_steps: string;
  outcome: string;
}

const MEETING_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Phone / Video Call" },
  { value: "email", label: "Email Exchange" },
  { value: "presentation", label: "Presentation" },
  { value: "site_visit", label: "Site Visit" },
  { value: "other", label: "Other" },
] as const;

const OUTCOMES = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "challenging", label: "Challenging" },
  { value: "pending", label: "Pending" },
] as const;

const emptyEntry = (): LogEntry => ({
  id: `neg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  date: "", type: "meeting", attendees: "", summary: "",
  key_points: "", action_items: "", next_steps: "", outcome: "pending",
});

export default function NegotiationLogTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const savedLog = td?.negotiation_data?.negotiation_log ?? [];

  const [entries, setEntries] = useState<LogEntry[]>(Array.isArray(savedLog) ? savedLog : []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const addEntry = () => { setEntries(prev => [emptyEntry(), ...prev]); mark(); };
  const updateEntry = (id: string, field: keyof LogEntry, value: any) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e)); mark();
  };
  const removeEntry = (id: string) => { setEntries(prev => prev.filter(e => e.id !== id)); mark(); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateTenderNegotiationData(tenderId, "negotiation_log", entries, `${entries.length} entries`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Negotiation log saved.");
      setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [entries, tenderId, reload]);

  const outcomeColor = (o: string) => {
    if (o === "positive") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (o === "challenging") return "border-red-300 text-red-700 bg-red-50";
    if (o === "neutral") return "border-slate-200 text-slate-600 bg-slate-50";
    return "border-amber-300 text-amber-700 bg-amber-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Log each negotiation meeting, call, or exchange chronologically. Record key discussion points, action items, and outcomes.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Log</span>
        <Badge variant="outline" className="text-[8px]">{entries.length} entries</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addEntry}>
            <Plus className="w-3 h-3" /> Add Entry
          </Button>
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No negotiation entries logged yet.</p>
          <p className="text-xs mt-1">Click "Add Entry" to log the first negotiation event.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const isExp = expandedId === entry.id;
            return (
              <Card key={entry.id} className="border-border shadow-none">
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExp ? null : entry.id)}>
                  {isExp ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                  <span className="text-[10px] text-muted-foreground font-mono w-20 shrink-0 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{entry.date || "No date"}</span>
                  <Badge variant="outline" className="text-[8px] w-24 justify-center shrink-0">{MEETING_TYPES.find(t => t.value === entry.type)?.label || entry.type}</Badge>
                  <span className="text-xs font-medium truncate flex-1">{entry.summary || "Untitled entry"}</span>
                  <span className="text-[10px] text-muted-foreground w-28 shrink-0 truncate flex items-center gap-1"><Users className="w-2.5 h-2.5" />{entry.attendees || "—"}</span>
                  <Badge variant="outline" className={`text-[8px] w-20 justify-center shrink-0 ${outcomeColor(entry.outcome)}`}>
                    {OUTCOMES.find(o => o.value === entry.outcome)?.label || entry.outcome}
                  </Badge>
                </div>
                {isExp && (
                  <CardContent className="px-4 pb-4 pt-0 border-t border-border bg-muted/5">
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Date</label>
                        <Input type="date" className="h-8 text-xs mt-1" value={entry.date} onChange={e => updateEntry(entry.id, "date", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Type</label>
                        <Select value={entry.type} onValueChange={v => updateEntry(entry.id, "type", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{MEETING_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Outcome</label>
                        <Select value={entry.outcome} onValueChange={v => updateEntry(entry.id, "outcome", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{OUTCOMES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-muted-foreground">Summary</label>
                        <Input className="h-8 text-xs mt-1" value={entry.summary} onChange={e => updateEntry(entry.id, "summary", e.target.value)} placeholder="Brief description of the meeting/exchange" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Attendees</label>
                        <Input className="h-8 text-xs mt-1" value={entry.attendees} onChange={e => updateEntry(entry.id, "attendees", e.target.value)} placeholder="Names" />
                      </div>
                    </div>
                    <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Key Discussion Points</label>
                      <Textarea className="text-xs mt-1 min-h-[50px]" value={entry.key_points} onChange={e => updateEntry(entry.id, "key_points", e.target.value)} placeholder="Main items discussed..." /></div>
                    <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Action Items</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={entry.action_items} onChange={e => updateEntry(entry.id, "action_items", e.target.value)} placeholder="Actions agreed..." /></div>
                    <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Next Steps</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={entry.next_steps} onChange={e => updateEntry(entry.id, "next_steps", e.target.value)} placeholder="What happens next..." /></div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => removeEntry(entry.id)}>
                        <X className="w-3 h-3" /> Remove
                      </Button>
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
