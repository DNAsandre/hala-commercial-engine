/**
 * TND-009: Tender Audit Trail Tab
 * Governance-style event history with filters, summary cards, detail modal, and audit table.
 */
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Info, Eye, XCircle, Database } from "lucide-react";
import {
  type TenderWorkspace,
  type TenderAuditEntry,
  type AuditCategory,
  type EventSeverity,
  AUDIT_CATEGORIES,
  SEVERITY_OPTIONS,
  getSeverityColor,
  getAuditCategoryLabel,
} from "@/lib/tender-workspace-data";

// ─── AUDIT DETAIL MODAL ──────────────────────────────────────

function AuditDetailModal({ entry, onClose }: { entry: TenderAuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold">Audit Event Detail (Mock)</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Development mock — not an immutable audit record.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event Code</label><p className="text-xs font-mono mt-1">{entry.eventCode || entry.action}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event Name</label><p className="text-xs mt-1">{entry.eventName || entry.action}</p></div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label><p className="text-xs mt-1 text-muted-foreground">{entry.details}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entity</label><p className="text-xs mt-1">{entry.entityName || entry.entityType}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</label><p className="text-xs mt-1">{getAuditCategoryLabel(entry.category)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Before State</label><p className="text-xs mt-1 font-mono">{entry.beforeState || "—"}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">After State</label><p className="text-xs mt-1 font-mono">{entry.afterState || "—"}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actor</label><p className="text-xs mt-1">{entry.userName}{entry.role ? ` · ${entry.role}` : ""}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</label><p className="text-xs mt-1 font-mono">{new Date(entry.timestamp).toLocaleString()}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Severity</label><div className="mt-1">{entry.severity ? <Badge variant="outline" className={`text-[9px] ${getSeverityColor(entry.severity)}`}>{entry.severity}</Badge> : <span className="text-xs">—</span>}</div></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trace ID</label><p className="text-xs font-mono mt-1">{entry.traceId || "—"}</p></div>
          </div>
          {entry.notes && <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label><p className="text-xs mt-1 text-muted-foreground">{entry.notes}</p></div>}
          <div className="p-2.5 rounded-md border border-blue-200 bg-blue-50/50">
            <p className="text-[10px] text-blue-700 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />Mock audit record. Production audit will be immutable and backend-backed.</p>
          </div>
        </div>
        <div className="p-5 border-t flex items-center justify-end">
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ─── SUMMARY CARD ────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function TenderAuditTrailTab({ ws }: { ws: TenderWorkspace }) {
  const [catFilter, setCatFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<TenderAuditEntry | null>(null);

  const entries = ws.auditEntries;
  const sorted = useMemo(() => [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [entries]);
  const filtered = useMemo(() => sorted.filter(e => {
    if (catFilter !== "all" && e.category !== catFilter) return false;
    if (sevFilter !== "all" && e.severity !== sevFilter) return false;
    return true;
  }), [sorted, catFilter, sevFilter]);

  const gateEvents = entries.filter(e => e.category?.toLowerCase() === "gate").length;
  const subEvents = entries.filter(e => { const c = e.category?.toLowerCase(); return c === "submission" || c === "split_output"; }).length;
  const bypassEvents = entries.filter(e => e.action?.toLowerCase().includes("bypass")).length;
  const highCritCount = entries.filter(e => e.severity === "high" || e.severity === "critical").length;
  const lastEntry = sorted[0];

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">Development mode: audit events are mock records. Production audit will be immutable and backend-backed later.</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1 shrink-0"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <SummaryCard label="Total Audit" value={entries.length} color="text-foreground" />
        <SummaryCard label="Gate Events" value={gateEvents} color="text-amber-600" />
        <SummaryCard label="Submission" value={subEvents} color="text-blue-600" />
        <SummaryCard label="Mock Bypasses" value={bypassEvents} color="text-orange-600" />
        <SummaryCard label="High / Critical" value={highCritCount} color="text-red-600" />
        <SummaryCard label="Last Audit" value={lastEntry ? new Date(lastEntry.timestamp).toLocaleDateString() : "—"} color="text-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{AUDIT_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger size="sm" className="w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{SEVERITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-1">{filtered.length} of {entries.length} shown</span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Event</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-left font-semibold">Entity</th>
              <th className="px-3 py-2 text-left font-semibold">Actor</th>
              <th className="px-3 py-2 text-left font-semibold">Before</th>
              <th className="px-3 py-2 text-left font-semibold">After</th>
              <th className="px-3 py-2 text-center font-semibold">Sev.</th>
              <th className="px-3 py-2 text-center font-semibold">Mock</th>
              <th className="px-3 py-2 text-left font-semibold">Timestamp</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const isHighCrit = e.severity === "high" || e.severity === "critical";
              const isBypass = e.action?.toLowerCase().includes("bypass");
              return (
                <tr key={e.id} className={`border-t border-border hover:bg-muted/30 ${isHighCrit ? "bg-red-50/30 border-l-2 border-l-red-400" : isBypass ? "bg-orange-50/20 border-l-2 border-l-orange-300" : ""}`}>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[8px] font-mono">{e.eventCode || e.action}</Badge></td>
                  <td className="px-3 py-2 max-w-[160px]">
                    <p className="font-medium truncate">{e.eventName || e.action}</p>
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{getAuditCategoryLabel(e.category)}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{e.entityName || e.entityType}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.userName}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{e.beforeState || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{e.afterState || "—"}</td>
                  <td className="px-3 py-2 text-center">{e.severity ? <Badge variant="outline" className={`text-[8px] ${getSeverityColor(e.severity)}`}>{e.severity}</Badge> : "—"}</td>
                  <td className="px-3 py-2 text-center">{e.mock ? <Badge variant="outline" className="text-[8px] text-blue-600 bg-blue-50 border-blue-200">Mock</Badge> : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px] font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setSelectedEntry(e)}><Eye className="w-3 h-3" /></Button></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">No audit events match current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <p className="text-[10px] text-blue-700">Future: audit trail will be immutable, backend-persisted, and linked to governance controls with tamper-proof trace IDs.</p>
      </div>

      {selectedEntry && <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </div>
  );
}
