/**
 * TND-009: Tender Activity Tab
 * Operational collaboration timeline with filters, summary cards, and event cards.
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { createActivityNote } from "@/lib/supabase-tender-actions";
import {
  type EventSeverity,
  type TenderActivityEvent,
  type TenderWorkspace,
  ACTIVITY_CATEGORIES,
  SEVERITY_OPTIONS,
  getActivityCategoryLabel,
  getSeverityColor,
} from "@/lib/tender-workspace-data";

function hasUncleanProcessMarker(value?: string) {
  const text = value?.toLowerCase() ?? "";
  return (
    text.includes("mock") ||
    text.includes("sample") ||
    text.includes("simulated") ||
    text.includes("fake") ||
    text.includes("development mode") ||
    text.includes("coming soon")
  );
}

function isCleanActivityEvent(event: TenderActivityEvent) {
  if (event.mock) return false;

  const categoryLabel = event.category ? getActivityCategoryLabel(event.category) : undefined;
  return ![
    event.eventType,
    event.title,
    event.description,
    event.category,
    categoryLabel,
    event.relatedPack,
    event.relatedModule,
    event.notes,
  ].some(hasUncleanProcessMarker);
}

const CLEAN_ACTIVITY_CATEGORIES = ACTIVITY_CATEGORIES.filter(
  option => !hasUncleanProcessMarker(String(option.value)) && !hasUncleanProcessMarker(option.label),
);

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function severityIcon(severity?: EventSeverity) {
  if (severity === "critical") return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
  if (severity === "high") return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
  if (severity === "warning") return <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
}

export default function TenderActivityTab({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [catFilter, setCatFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const events = useMemo(
    () => (Array.isArray(ws.activityEvents) ? ws.activityEvents : []).filter(isCleanActivityEvent),
    [ws.activityEvents],
  );
  const sorted = useMemo(() => [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [events]);
  const filtered = useMemo(() => sorted.filter(e => {
    if (catFilter !== "all" && e.category !== catFilter) return false;
    if (sevFilter !== "all" && e.severity !== sevFilter) return false;
    return true;
  }), [sorted, catFilter, sevFilter]);

  const warningCount = events.filter(e => e.severity === "warning").length;
  const highCritCount = events.filter(e => e.severity === "high" || e.severity === "critical").length;
  const noteCount = events.filter(e => e.eventType?.toLowerCase() === "note").length;
  const lastEvent = sorted[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <SummaryCard label="Total Events" value={events.length} color="text-foreground" />
        <SummaryCard label="Warnings" value={warningCount} color="text-amber-600" />
        <SummaryCard label="High / Critical" value={highCritCount} color="text-red-600" />
        <SummaryCard label="Notes" value={noteCount} color="text-blue-600" />
        <SummaryCard label="Last Activity" value={lastEvent ? new Date(lastEvent.timestamp).toLocaleDateString() : "-"} color="text-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CLEAN_ACTIVITY_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger size="sm" className="w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{SEVERITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-1">{filtered.length} of {events.length} shown</span>
      </div>

      <div className="p-3 rounded-lg border border-border bg-muted/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Add Activity Note</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <input
              type="text"
              placeholder="Note title..."
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background"
            />
            <input
              type="text"
              placeholder="Description (optional)..."
              value={noteDesc}
              onChange={e => setNoteDesc(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1 shrink-0"
            disabled={!noteTitle.trim() || noteSubmitting}
            onClick={async () => {
              setNoteSubmitting(true);
              const result = await createActivityNote(tenderId, noteTitle.trim(), noteDesc.trim());
              if (result.success) {
                toast.success("Activity note added.", { description: "Persisted to Supabase." });
                setNoteTitle("");
                setNoteDesc("");
                reload();
              } else {
                toast.warning("Note failed to save.", { description: result.error });
              }
              setNoteSubmitting(false);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Note
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(e => {
          const isCrit = e.severity === "critical" || e.severity === "high";
          return (
            <div key={e.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isCrit ? "border-red-200 bg-red-50/30" : e.severity === "warning" ? "border-amber-200 bg-amber-50/20" : "border-border bg-muted/20"}`}>
              <div className="mt-0.5 shrink-0">{severityIcon(e.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium">{e.title || e.description}</p>
                  {e.category && <Badge variant="outline" className="text-[8px]">{getActivityCategoryLabel(e.category)}</Badge>}
                  {e.severity && <Badge variant="outline" className={`text-[8px] ${getSeverityColor(e.severity)}`}>{e.severity}</Badge>}
                </div>
                {e.title && <p className="text-[11px] text-muted-foreground mt-0.5">{e.description}</p>}
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  <span>{e.userName}{e.role ? ` - ${e.role}` : ""}</span>
                  <span>{new Date(e.timestamp).toLocaleString()}</span>
                  {e.relatedPack && <span className="text-blue-600">{e.relatedPack}</span>}
                  {e.relatedModule && <span className="text-blue-600">{e.relatedModule}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {events.length === 0 ? "No activity events recorded yet." : "No activity events match current filters."}
          </p>
        )}
      </div>
    </div>
  );
}
