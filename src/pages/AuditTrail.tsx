/*
 * Audit Trail — SC-01 Wave 04 (requirement D: data truth).
 *
 * WHAT THIS PAGE READS: the established `audit_log` table, via
 * ops-runtime.readAuditTrail() (projection AUDIT_LOG_COLUMNS). It is the only
 * source on this page; nothing here is derived, inferred or seeded.
 *
 * WHY IT CHANGED: the page previously used useAuditLog() -> fetchAuditLog(),
 * which routes through safeFetchList and returns `[]` for a failed read. The
 * header then stated "Complete system activity log — immutable record — 0
 * entries" and the four stat tiles all read 0. A broken read, an RLS-filtered
 * read and a genuinely empty table were one indistinguishable screen, and the
 * word "Complete" asserted completeness the page could not know.
 *
 * Live probe 2026-08-05 (anonymous client): `audit_log` returns HTTP 200 with
 * 0 rows. The read SUCCEEDS and the visible row set is empty. Because RLS can
 * hide rows from an unauthenticated client, that is reported as "no records
 * are visible to this account", never as "there are no audit records".
 */
import { Filter, Shield, FileText, Users, AlertTriangle, CheckCircle, Activity, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AUDIT_LOG_TABLE,
  formatRecordedDateTime,
  readAuditTrail,
  type AuditTrailRecord,
  type RecordRead,
} from "@/lib/ops-runtime";
import { Loader2 } from "lucide-react";

/**
 * SC-01 Wave 04 correction (defect C). A Radix `SelectItem` throws when its
 * `value` is the empty string, and `audit_log.entity_type` / `.action` are
 * nullable — `mapAuditRow` maps a null column to "". One such row took down
 * the whole page. Only values that are actually present become options; the
 * same guard `BotAudit` already applies to its recorded statuses.
 */
export function selectableAuditValues(rows: readonly AuditTrailRecord[]): {
  types: string[];
  actions: string[];
} {
  return {
    types: Array.from(new Set(rows.map(e => e.entityType).filter(Boolean))),
    actions: Array.from(new Set(rows.map(e => e.action).filter(Boolean))),
  };
}

/** The list the page renders, after both filters. */
export function filterAuditEntries(
  rows: readonly AuditTrailRecord[],
  typeFilter: string,
  actionFilter: string,
): AuditTrailRecord[] {
  return rows
    .filter(e => typeFilter === "all" || e.entityType === typeFilter)
    .filter(e => actionFilter === "all" || e.action === actionFilter);
}

/**
 * SC-01 Wave 04 correction (defect G). These counters are computed over the
 * SAME array the list renders — the filtered set. Previously they were
 * computed over the unfiltered `auditLog` while a comment claimed otherwise,
 * so applying a filter left "Total Events 194" sitting above three visible
 * rows.
 */
export function summariseAuditEntries(rows: readonly AuditTrailRecord[]): {
  total: number;
  approvals: number;
  overrides: number;
  users: number;
} {
  return {
    total: rows.length,
    approvals: rows.filter(e => e.action === "approve").length,
    overrides: rows.filter(e => e.action === "override").length,
    users: new Set(rows.map(e => e.userName).filter(Boolean)).size,
  };
}

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  approve: "bg-[#075eea]/15 text-[#064fc4]",
  reject: "bg-red-100 text-red-800",
  override: "bg-amber-100 text-amber-800",
  submit: "bg-[#075eea]/15 text-[#064fc4]",
  export: "bg-teal-100 text-teal-800",
  sync: "bg-cyan-100 text-cyan-800",
};

const entityIcons: Record<string, React.ElementType> = {
  workspace: Activity,
  quote: FileText,
  proposal: FileText,
  approval: Shield,
  customer: Users,
  policy: Shield,
};

export default function AuditTrail() {
  const [read, setRead] = useState<RecordRead<AuditTrailRecord> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    readAuditTrail().then(r => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // ── State 1 of 3: LOADING ──────────────────────────────────
  if (read === null) {
    return (
      <div className="flex items-center justify-center h-96 gap-2 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-sm">Reading the audit log…</span>
      </div>
    );
  }

  // ── State 2 of 3: FAILED / UNAVAILABLE READ ────────────────
  // No counters are rendered: nothing is known, so nothing is counted.
  if (read.status === "error" || read.status === "unavailable") {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-serif font-bold mb-4">Audit Trail</h1>
        <Card className="border border-red-200 bg-red-50/40 shadow-none">
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-semibold text-red-700">
              {read.status === "unavailable"
                ? `The ${AUDIT_LOG_TABLE} table does not exist in this project`
                : "The audit log could not be read"}
            </p>
            <p className="text-xs text-muted-foreground max-w-2xl">
              No audit entries are shown and no totals are calculated. This is not a claim that
              zero events occurred — the number of recorded events is unknown.
            </p>
            <p className="text-[11px] font-mono text-muted-foreground break-all">{read.error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setReloadKey(k => k + 1)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── State 3 of 3: SUCCESSFUL READ (rows, or a visible-zero) ─
  const auditLog = read.rows;
  const filtered = filterAuditEntries(auditLog, typeFilter, actionFilter);
  const stats = summariseAuditEntries(filtered);
  const filtersActive = typeFilter !== "all" || actionFilter !== "all";

  const { types: uniqueTypes, actions: uniqueActions } = selectableAuditValues(auditLog);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Audit Trail</h1>
          {/* "Complete" and "immutable" were claims this page cannot verify.
              It reports what it read, and from where. */}
          <p className="text-sm text-muted-foreground mt-0.5">
            {auditLog.length} audit {auditLog.length === 1 ? "record" : "records"} read from <span className="font-mono">{AUDIT_LOG_TABLE}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setReloadKey(k => k + 1)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reload
        </Button>
      </div>

      {auditLog.length === 0 && (
        <Card className="border border-border shadow-none mb-6">
          <CardContent className="p-8 text-center space-y-1">
            <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium">No audit records are visible to this account</p>
            <p className="text-xs text-muted-foreground max-w-xl mx-auto">
              The read of <span className="font-mono">{AUDIT_LOG_TABLE}</span> succeeded and returned zero rows.
              Records hidden from this account by row-level security would not appear here, so this is not
              a statement that the table is empty.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Counters, filters and the event list only exist once there are
          records. Rendering a row of zeroes over a failed-or-empty read is the
          exact defect Wave 04 asks us to remove. */}
      {auditLog.length > 0 && (
      <>
      {/* Summary Stats — SC-01 Wave 04 (defect G). Each counter is computed
          over `filtered`, which is exactly the array the list below renders,
          so a counter can never disagree with the data set it summarises. The
          labels say "shown" and the line underneath states the read total, so
          the two numbers are never confused for one another. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        {[
          { label: "Events shown", value: stats.total, icon: Activity, color: "bg-blue-100 text-blue-800" },
          { label: "Approvals shown", value: stats.approvals, icon: CheckCircle, color: "bg-emerald-100 text-emerald-800" },
          { label: "Overrides shown", value: stats.overrides, icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
          { label: "Users in shown events", value: stats.users, icon: Users, color: "bg-[#075eea]/15 text-[#064fc4]" },
        ].map(stat => (
          <Card key={stat.label} className="border border-border shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mb-6">
        {filtersActive
          ? `Counted over the ${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} listed below, which is the filtered subset of the ${auditLog.length} read from ${AUDIT_LOG_TABLE}.`
          : `Counted over all ${auditLog.length} ${auditLog.length === 1 ? "entry" : "entries"} read from ${AUDIT_LOG_TABLE}; no filter is applied.`}
      </p>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entries shown</span>
      </div>

      {/* Event List */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.map(entry => {
              const Icon = entityIcons[entry.entityType] || Activity;
              return (
                <div key={entry.id} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{entry.userName}</span>
                      <Badge variant="outline" className={`text-[10px] ${actionColors[entry.action] || ""}`}>{entry.action}</Badge>
                      <Badge variant="outline" className="text-[10px]">{entry.entityType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                  </div>
                  {/* SC-01 Wave 04 (defect B): toLocaleString() returns the
                      literal string "Invalid Date" for an unparseable value
                      and throws nothing, so it was rendered as if recorded. */}
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                    {formatRecordedDateTime(entry.timestamp)}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No records match the selected filters. {auditLog.length} records were read.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
