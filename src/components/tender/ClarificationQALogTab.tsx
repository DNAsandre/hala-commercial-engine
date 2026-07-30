/**
 * ClarificationQALogTab — Tab 1 of Clarification Stage
 *
 * Correspondence tracker: log client clarification questions and Hala's responses.
 * Each entry = one client question with response tracking.
 *
 * Data: type_details.clarification.qa_log (array)
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
import { Save, Loader2, Plus, Info, ChevronDown, ChevronRight, MessageSquare, X } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderClarificationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

interface QAEntry {
  id: string;
  date_received: string;
  type: string;
  question: string;
  from_contact: string;
  response_due: string;
  status: string;
  response_date: string;
  response_summary: string;
  documents_count: number;
  notes: string;
}

const QUESTION_TYPES = [
  { value: "technical_query", label: "Technical Query" },
  { value: "commercial_query", label: "Commercial Query" },
  { value: "scope_clarification", label: "Scope Clarification" },
  { value: "pricing_query", label: "Pricing Query" },
  { value: "compliance_query", label: "Compliance Query" },
  { value: "other", label: "Other" },
] as const;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "responded", label: "Responded" },
  { value: "overdue", label: "Overdue" },
] as const;

const emptyEntry = (): QAEntry => ({
  id: `clq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  date_received: "",
  type: "technical_query",
  question: "",
  from_contact: "",
  response_due: "",
  status: "pending",
  response_date: "",
  response_summary: "",
  documents_count: 0,
  notes: "",
});

export default function ClarificationQALogTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const savedLog = td?.clarification?.qa_log ?? [];

  const [entries, setEntries] = useState<QAEntry[]>(Array.isArray(savedLog) ? savedLog : []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return entries;
    return entries.filter(e => e.status === filterStatus);
  }, [entries, filterStatus]);

  const stats = useMemo(() => ({
    total: entries.length,
    pending: entries.filter(e => e.status === "pending" || e.status === "in_progress").length,
    responded: entries.filter(e => e.status === "responded").length,
    overdue: entries.filter(e => e.status === "overdue").length,
  }), [entries]);

  const addEntry = () => { setEntries(prev => [emptyEntry(), ...prev]); mark(); };
  const updateEntry = (id: string, field: keyof QAEntry, value: any) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    mark();
  };
  const removeEntry = (id: string) => { setEntries(prev => prev.filter(e => e.id !== id)); mark(); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateTenderClarificationData(tenderId, "qa_log", entries, `${entries.length} clarification questions logged`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Q&A log saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [entries, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "responded") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "overdue") return "border-red-300 text-red-700 bg-red-50";
    if (s === "in_progress") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-amber-300 text-amber-700 bg-amber-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Log each client clarification question and track Hala's formal response. Data is stored separately from Client Evaluation.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Clarification Q&A</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[8px]">{stats.total} total</Badge>
          {stats.pending > 0 && <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-700 bg-amber-50">{stats.pending} pending</Badge>}
          {stats.responded > 0 && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50">{stats.responded} responded</Badge>}
          {stats.overdue > 0 && <Badge variant="outline" className="text-[8px] border-red-200 text-red-700 bg-red-50">{stats.overdue} overdue</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addEntry}>
            <Plus className="w-3 h-3" /> Add Question
          </Button>
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No clarification questions logged yet.</p>
          <p className="text-xs mt-1">Click "Add Question" to log the first client query.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id} className="border-border shadow-none">
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                  <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">{entry.date_received || "No date"}</span>
                  <Badge variant="outline" className="text-[8px] w-28 justify-center shrink-0">{QUESTION_TYPES.find(t => t.value === entry.type)?.label || entry.type}</Badge>
                  <span className="text-xs font-medium truncate flex-1">{entry.question || "Untitled question"}</span>
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{entry.from_contact || "—"}</span>
                  <Badge variant="outline" className={`text-[8px] w-20 justify-center shrink-0 ${statusColor(entry.status)}`}>
                    {STATUS_OPTIONS.find(s => s.value === entry.status)?.label || entry.status}
                  </Badge>
                </div>
                {isExpanded && (
                  <CardContent className="px-4 pb-4 pt-0 border-t border-border bg-muted/5">
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Date Received</label>
                        <Input type="date" className="h-8 text-xs mt-1" value={entry.date_received} onChange={e => updateEntry(entry.id, "date_received", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Type</label>
                        <Select value={entry.type} onValueChange={v => updateEntry(entry.id, "type", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Status</label>
                        <Select value={entry.status} onValueChange={v => updateEntry(entry.id, "status", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-muted-foreground">Question</label>
                        <Input className="h-8 text-xs mt-1" value={entry.question} onChange={e => updateEntry(entry.id, "question", e.target.value)} placeholder="What did the client ask?" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">From (Client Contact)</label>
                        <Input className="h-8 text-xs mt-1" value={entry.from_contact} onChange={e => updateEntry(entry.id, "from_contact", e.target.value)} placeholder="Contact name" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Response Due</label>
                        <Input type="date" className="h-8 text-xs mt-1" value={entry.response_due} onChange={e => updateEntry(entry.id, "response_due", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Response Date</label>
                        <Input type="date" className="h-8 text-xs mt-1" value={entry.response_date} onChange={e => updateEntry(entry.id, "response_date", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground">Documents Attached</label>
                        <Input type="number" min={0} className="h-8 text-xs mt-1" value={entry.documents_count} onChange={e => updateEntry(entry.id, "documents_count", parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Summary</label>
                      <Textarea className="text-xs mt-1 min-h-[50px]" value={entry.response_summary} onChange={e => updateEntry(entry.id, "response_summary", e.target.value)} placeholder="What was sent back to the client..." />
                    </div>
                    <div className="mt-3">
                      <label className="text-[10px] font-semibold text-muted-foreground">Internal Notes</label>
                      <Textarea className="text-xs mt-1 min-h-[40px]" value={entry.notes} onChange={e => updateEntry(entry.id, "notes", e.target.value)} placeholder="Internal notes..." />
                    </div>
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
