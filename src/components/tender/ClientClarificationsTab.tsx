/**
 * ClientClarificationsTab - Client Evaluation stage clarification register.
 *
 * Data: type_details.client_evaluation.client_clarifications
 * Isolated from formal clarification and identified-stage buckets.
 * No AI. No mock data.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderClientEvaluationData } from "@/lib/supabase-tender-actions";

export type ClientClarificationSection =
  | "clarification_register"
  | "response_tracking"
  | "impact_review"
  | "notes_documents";

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  activeSection: ClientClarificationSection;
}

interface ClientClarificationRow {
  id: string;
  date_received: string;
  client_contact: string;
  question_or_request: string;
  category: string;
  response_owner: string;
  response_due: string;
  response_status: string;
  client_priority: string;
  bafo_impact: string;
  pricing_impact: string;
  scope_impact: string;
  response_summary: string;
  documents_required: boolean;
  notes: string;
}

const RESPONSE_STATUSES = ["Open", "In Progress", "Responded", "Closed"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const IMPACT_VALUES = ["None", "Low", "Medium", "High"] as const;
const CATEGORIES = ["Technical", "Commercial", "Scope", "Pricing", "Compliance", "Document", "Other"] as const;

function makeId(): string {
  return `ce-cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyRow(): ClientClarificationRow {
  return {
    id: makeId(),
    date_received: "",
    client_contact: "",
    question_or_request: "",
    category: "Technical",
    response_owner: "",
    response_due: "",
    response_status: "Open",
    client_priority: "Medium",
    bafo_impact: "None",
    pricing_impact: "None",
    scope_impact: "None",
    response_summary: "",
    documents_required: false,
    notes: "",
  };
}

function normalizeStatus(value: unknown): string {
  const normalized = String(value || "Open").toLowerCase().replace(/_/g, " ");
  return RESPONSE_STATUSES.find(status => status.toLowerCase() === normalized) ?? "Open";
}

function normalizeOption<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  const normalized = String(value || fallback).toLowerCase();
  return options.find(option => option.toLowerCase() === normalized) ?? fallback;
}

function normalizeRow(row: Partial<ClientClarificationRow> | any): ClientClarificationRow {
  return {
    id: String(row?.id || makeId()),
    date_received: String(row?.date_received || ""),
    client_contact: String(row?.client_contact || ""),
    question_or_request: String(row?.question_or_request || row?.question || row?.subject || ""),
    category: normalizeOption(row?.category, CATEGORIES, "Technical"),
    response_owner: String(row?.response_owner || row?.owner || ""),
    response_due: String(row?.response_due || row?.due_date || ""),
    response_status: normalizeStatus(row?.response_status || row?.status),
    client_priority: normalizeOption(row?.client_priority || row?.priority, PRIORITIES, "Medium"),
    bafo_impact: normalizeOption(row?.bafo_impact, IMPACT_VALUES, "None"),
    pricing_impact: normalizeOption(row?.pricing_impact, IMPACT_VALUES, "None"),
    scope_impact: normalizeOption(row?.scope_impact, IMPACT_VALUES, "None"),
    response_summary: String(row?.response_summary || ""),
    documents_required: row?.documents_required === true,
    notes: String(row?.notes || ""),
  };
}

function rowsFromSaved(value: any): ClientClarificationRow[] {
  if (Array.isArray(value)) return value.map(normalizeRow);
  if (Array.isArray(value?.rows)) return value.rows.map(normalizeRow);
  return [];
}

function notesFromSaved(value: any): string {
  if (value && !Array.isArray(value) && typeof value.notes === "string") return value.notes;
  return "";
}

function statusColor(status: string): string {
  if (status === "Closed" || status === "Responded") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (status === "In Progress") return "border-blue-300 bg-blue-50 text-blue-700";
  return "border-amber-300 bg-amber-50 text-amber-700";
}

function impactColor(value: string): string {
  if (value === "High") return "border-red-300 bg-red-50 text-red-700";
  if (value === "Medium") return "border-amber-300 bg-amber-50 text-amber-700";
  if (value === "Low") return "border-blue-300 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function trimRow(row: ClientClarificationRow): ClientClarificationRow {
  return {
    ...row,
    date_received: row.date_received.trim(),
    client_contact: row.client_contact.trim(),
    question_or_request: row.question_or_request.trim(),
    category: row.category.trim(),
    response_owner: row.response_owner.trim(),
    response_due: row.response_due.trim(),
    response_status: row.response_status.trim(),
    client_priority: row.client_priority.trim(),
    bafo_impact: row.bafo_impact.trim(),
    pricing_impact: row.pricing_impact.trim(),
    scope_impact: row.scope_impact.trim(),
    response_summary: row.response_summary.trim(),
    notes: row.notes.trim(),
  };
}

function rowHasContent(row: ClientClarificationRow): boolean {
  return [
    row.date_received,
    row.client_contact,
    row.question_or_request,
    row.response_owner,
    row.response_due,
    row.response_summary,
    row.notes,
  ].some(value => value.trim().length > 0) || row.documents_required;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
      <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-20" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function MetricBadges({ rows }: { rows: ClientClarificationRow[] }) {
  const open = rows.filter(row => row.response_status === "Open" || row.response_status === "In Progress").length;
  const responded = rows.filter(row => row.response_status === "Responded" || row.response_status === "Closed").length;
  const highImpact = rows.filter(row => row.bafo_impact === "High" || row.pricing_impact === "High" || row.scope_impact === "High").length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="text-[8px]">{rows.length} total</Badge>
      {open > 0 && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[8px] text-amber-700">{open} open</Badge>}
      {responded > 0 && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[8px] text-emerald-700">{responded} responded</Badge>}
      {highImpact > 0 && <Badge variant="outline" className="border-red-200 bg-red-50 text-[8px] text-red-700">{highImpact} high impact</Badge>}
    </div>
  );
}

function RowTitle({ row, index }: { row: ClientClarificationRow; index: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium">{row.question_or_request || `Clarification ${index + 1}`}</p>
      <p className="text-[10px] text-muted-foreground">{row.client_contact || "Client contact not captured"}</p>
    </div>
  );
}

export default function ClientClarificationsTab({ ws, reload, activeSection }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.client_evaluation?.client_clarifications;

  const savedRows = useMemo(() => rowsFromSaved(saved), [saved]);
  const savedNotes = useMemo(() => notesFromSaved(saved), [saved]);
  const [rows, setRows] = useState<ClientClarificationRow[]>(savedRows);
  const [notes, setNotes] = useState(savedNotes);
  const [filterStatus, setFilterStatus] = useState("all");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setRows(savedRows);
    setNotes(savedNotes);
  }, [dirty, savedNotes, savedRows]);

  const filteredRows = useMemo(() => {
    if (filterStatus === "all") return rows;
    return rows.filter(row => row.response_status === filterStatus);
  }, [filterStatus, rows]);

  const documentRows = useMemo(() => rows.filter(row => row.documents_required), [rows]);
  const openRows = useMemo(() => rows.filter(row => row.response_status === "Open" || row.response_status === "In Progress"), [rows]);

  const mark = () => setDirty(true);

  function addRow() {
    setRows(prev => [emptyRow(), ...prev]);
    mark();
  }

  function updateRow(id: string, patch: Partial<ClientClarificationRow>) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
    mark();
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(row => row.id !== id));
    mark();
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const cleanedRows = rows.map(trimRow).filter(rowHasContent);
      const payload = {
        rows: cleanedRows,
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      };
      const result = await updateTenderClientEvaluationData(
        tenderId,
        "client_clarifications",
        payload,
        `${cleanedRows.length} client clarifications logged`,
      );
      if (!result.success) {
        toast.error(result.error || "Save failed.");
        return;
      }
      toast.success("Client clarifications saved.");
      setRows(cleanedRows);
      setNotes(notes.trim());
      setDirty(false);
      reload();
    } catch (error: any) {
      toast.error(error.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [notes, reload, rows, tenderId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/10 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Client Clarifications</span>
        <MetricBadges rows={rows} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 w-[118px] text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All</SelectItem>
              {RESPONSE_STATUSES.map(status => <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={addRow}>
            <Plus className="h-3 w-3" />
            Add
          </Button>
          <Button type="button" size="sm" className="h-7 gap-1 text-[10px]" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>
        </div>
      </div>

      <div className={activeSection !== "clarification_register" ? "hidden" : ""}>
        {filteredRows.length === 0 ? (
          <EmptyState text="No client evaluation clarifications captured yet." />
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row, index) => (
              <Card key={row.id} className="border-border shadow-none">
                <CardHeader className="border-b border-border bg-muted/20 px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#075eea]" />
                      <RowTitle row={row} index={index} />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={() => removeRow(row.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Date Received</label>
                      <Input type="date" className="mt-1 h-8 text-xs" value={row.date_received} onChange={event => updateRow(row.id, { date_received: event.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Client Contact</label>
                      <Input className="mt-1 h-8 text-xs" value={row.client_contact} onChange={event => updateRow(row.id, { client_contact: event.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Category</label>
                      <Select value={row.category} onValueChange={value => updateRow(row.id, { category: value })}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(category => <SelectItem key={category} value={category} className="text-xs">{category}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Priority</label>
                      <Select value={row.client_priority} onValueChange={value => updateRow(row.id, { client_priority: value })}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORITIES.map(priority => <SelectItem key={priority} value={priority} className="text-xs">{priority}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Owner</label>
                      <Input className="mt-1 h-8 text-xs" value={row.response_owner} onChange={event => updateRow(row.id, { response_owner: event.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Due</label>
                      <Input type="date" className="mt-1 h-8 text-xs" value={row.response_due} onChange={event => updateRow(row.id, { response_due: event.target.value })} />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-semibold text-muted-foreground">Question Or Request</label>
                      <Textarea className="mt-1 min-h-[70px] text-xs" value={row.question_or_request} onChange={event => updateRow(row.id, { question_or_request: event.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className={activeSection !== "response_tracking" ? "hidden" : ""}>
        {rows.length === 0 ? (
          <EmptyState text="No client clarification responses to track yet." />
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <Card key={row.id} className="border-border shadow-none">
                <CardHeader className="border-b border-border bg-muted/20 px-4 py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#075eea]" />
                    <div className="min-w-0 flex-1"><RowTitle row={row} index={index} /></div>
                    <Badge variant="outline" className={`text-[8px] ${statusColor(row.response_status)}`}>{row.response_status}</Badge>
                    {row.response_due && <span className="text-[10px] text-muted-foreground">Due: {row.response_due}</span>}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Status</label>
                      <Select value={row.response_status} onValueChange={value => updateRow(row.id, { response_status: value })}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{RESPONSE_STATUSES.map(status => <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Owner</label>
                      <Input className="mt-1 h-8 text-xs" value={row.response_owner} onChange={event => updateRow(row.id, { response_owner: event.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Due</label>
                      <Input type="date" className="mt-1 h-8 text-xs" value={row.response_due} onChange={event => updateRow(row.id, { response_due: event.target.value })} />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-semibold text-muted-foreground">Response Summary</label>
                      <Textarea className="mt-1 min-h-[70px] text-xs" value={row.response_summary} onChange={event => updateRow(row.id, { response_summary: event.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className={activeSection !== "impact_review" ? "hidden" : ""}>
        {rows.length === 0 ? (
          <EmptyState text="No client clarification impact items to review yet." />
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <Card key={row.id} className="border-border shadow-none">
                <CardHeader className="border-b border-border bg-muted/20 px-4 py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#075eea]" />
                    <div className="min-w-0 flex-1"><RowTitle row={row} index={index} /></div>
                    <Badge variant="outline" className={`text-[8px] ${impactColor(row.pricing_impact)}`}>Pricing: {row.pricing_impact}</Badge>
                    <Badge variant="outline" className={`text-[8px] ${impactColor(row.scope_impact)}`}>Scope: {row.scope_impact}</Badge>
                    <Badge variant="outline" className={`text-[8px] ${impactColor(row.bafo_impact)}`}>BAFO: {row.bafo_impact}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">BAFO Impact</label>
                      <Select value={row.bafo_impact} onValueChange={value => updateRow(row.id, { bafo_impact: value })}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{IMPACT_VALUES.map(value => <SelectItem key={value} value={value} className="text-xs">{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Pricing Impact</label>
                      <Select value={row.pricing_impact} onValueChange={value => updateRow(row.id, { pricing_impact: value })}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{IMPACT_VALUES.map(value => <SelectItem key={value} value={value} className="text-xs">{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">Scope Impact</label>
                      <Select value={row.scope_impact} onValueChange={value => updateRow(row.id, { scope_impact: value })}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{IMPACT_VALUES.map(value => <SelectItem key={value} value={value} className="text-xs">{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-semibold text-muted-foreground">Impact Notes</label>
                      <Textarea className="mt-1 min-h-[70px] text-xs" value={row.notes} onChange={event => updateRow(row.id, { notes: event.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className={activeSection !== "notes_documents" ? "hidden" : ""}>
        <Card className="border-border shadow-none">
          <CardHeader className="border-b border-border bg-muted/20 px-4 py-2">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-[#075eea]" />
              <span className="text-xs font-semibold">Notes And Document Flags</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {rows.length === 0 ? (
              <EmptyState text="No client clarification document flags yet." />
            ) : (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_160px]">
                    <RowTitle row={row} index={index} />
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={row.documents_required} onCheckedChange={checked => updateRow(row.id, { documents_required: checked === true })} />
                      Documents required
                    </label>
                  </div>
                ))}
              </div>
            )}

            {documentRows.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                {documentRows.length} clarification item{documentRows.length === 1 ? "" : "s"} marked as requiring documents.
              </div>
            )}

            {openRows.length > 0 && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] text-blue-800">
                {openRows.length} clarification item{openRows.length === 1 ? "" : "s"} still open or in progress.
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Stage Notes</label>
              <Textarea className="mt-1 min-h-[160px] text-xs" value={notes} onChange={event => { setNotes(event.target.value); mark(); }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
