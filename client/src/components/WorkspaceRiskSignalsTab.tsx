/**
 * WorkspaceRiskSignalsTab — Single source Risk & Signals tab for all workspace types.
 *
 * Used by: WorkspaceDetail (Commercial), Tenders.tsx, Renewals.tsx
 *
 * Reads from escalation_events filtered to:
 * - workspaceId (if workspace-level)
 * - customerId / entityId (for customer-level escalations related to this workspace)
 *
 * Also renders contextual calculated signals (margin, deadline, etc.) as
 * "Derived Context" that feeds escalation awareness — read-only, not stored.
 *
 * IMPORTANT: This does NOT store a separate signal system.
 * The escalation events are the single source. Derived context is display-only.
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  RefreshCw,
  Eye,
  ArrowRight,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth-state";
import {
  type EscalationEvent,
  fetchAllEscalations,
  acknowledgeEscalation,
  resolveEscalation,
  getTriggerTypeLabel,
  computeSlaStatus,
  getSeverityColor,
} from "@/lib/escalation-engine";
import { getEventLevel } from "@/lib/escalation-triggers";
import { CountdownMini } from "@/components/EscalationCountdown";

// ─── Types ───────────────────────────────────────────────────

export interface DerivedSignal {
  label: string;
  detail: string;
  severity: "red" | "amber" | "green";
}

interface Props {
  /** Workspace-level: filter by workspace_id */
  workspaceId?: string;
  /** Customer-level: filter by entity_id where entity_type = customer */
  customerId?: string;
  /** Tenant-level: filter by entity_id where entity_type = renewal */
  renewalId?: string;
  /** Calculated signals from local context (margin, deadline, etc.) — display only */
  derivedSignals?: DerivedSignal[];
  /** Label for the workspace context (for empty state) */
  contextLabel?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LevelBadge({ event }: { event: EscalationEvent }) {
  const level = getEventLevel(event);
  const styles = ["", "bg-slate-100 text-slate-600 border-slate-300", "bg-blue-50 text-blue-700 border-blue-200", "bg-amber-50 text-amber-800 border-amber-300", "bg-red-100 text-red-900 border-red-300"];
  const labels = ["", "Signal", "Managed", "Escalation", "Critical"];
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${styles[level]}`}>
      L{level} {labels[level]}
    </span>
  );
}

// ─── Escalation Event Row ────────────────────────────────────

function EscalationRow({
  event,
  onRefresh,
}: {
  event: EscalationEvent;
  onRefresh: () => void;
}) {
  const user = getCurrentUser();
  const isAdmin = user.role === "admin";
  const sla = computeSlaStatus(event);
  const isRed = event.severity === "red";
  const isResolved = event.status === "resolved";

  const [acting, setActing] = useState(false);
  const [resolveMode, setResolveMode] = useState(false);
  const [resolveReason, setResolveReason] = useState("");

  const handleAcknowledge = async () => {
    if (!isAdmin) return;
    setActing(true);
    const ok = await acknowledgeEscalation(event.id);
    if (ok) { toast.success("Escalation acknowledged"); onRefresh(); }
    else toast.error("Failed to acknowledge");
    setActing(false);
  };

  const handleResolve = async () => {
    if (!isAdmin || resolveReason.trim().length < 10) return;
    setActing(true);
    const ok = await resolveEscalation(event.id, resolveReason);
    if (ok) { toast.success("Escalation resolved"); setResolveMode(false); onRefresh(); }
    else toast.error("Failed to resolve");
    setActing(false);
  };

  return (
    <div className={`rounded-xl border-l-4 border border-border p-4 space-y-2 transition-all ${
      isResolved ? "opacity-60" : ""
    } ${isRed ? "border-l-red-500" : "border-l-amber-400"}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {isRed
            ? <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <LevelBadge event={event} />
              <Badge variant="outline" className={`text-[9px] uppercase ${getSeverityColor(event.severity).bg} ${getSeverityColor(event.severity).text} ${getSeverityColor(event.severity).border}`}>
                {event.severity}
              </Badge>
              <Badge variant="outline" className="text-[9px] uppercase">
                {event.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {getTriggerTypeLabel(event.triggerType)}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground leading-snug">
              {event.triggerReason}
            </p>
          </div>
        </div>
        <Link href="/escalations">
          <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="View in Global Console">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap pl-6">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(event.createdAt)}
        </span>
        {event.assignedToName && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {event.assignedToName}
          </span>
        )}
        {sla?.breached && (
          <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded uppercase">
            SLA Breached
          </span>
        )}
      </div>

      {/* SLA Countdown */}
      <div className="pl-6">
        <CountdownMini event={event} />
      </div>

      {/* Actions */}
      {!isResolved && isAdmin && (
        <div className="pl-6">
          {resolveMode ? (
            <div className="space-y-2">
              <textarea
                value={resolveReason}
                onChange={e => setResolveReason(e.target.value)}
                placeholder="Resolution reason (min 10 characters)…"
                className="w-full text-xs border border-border rounded-lg p-2 resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setResolveMode(false)} disabled={acting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleResolve}
                  disabled={resolveReason.trim().length < 10 || acting}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {acting ? "Resolving…" : "Resolve & Close"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {event.status === "open" && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleAcknowledge} disabled={acting}>
                  <Eye className="w-3 h-3 mr-1" />
                  Acknowledge
                </Button>
              )}
              <Button variant="outline" size="sm" className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setResolveMode(true)}>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Resolve
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────

export function WorkspaceRiskSignalsTab({
  workspaceId,
  customerId,
  renewalId,
  derivedSignals = [],
  contextLabel = "this workspace",
}: Props) {
  const [events, setEvents] = useState<EscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllEscalations();
      // Filter to events relevant to this context
      const relevant = all.filter(e => {
        if (workspaceId && e.workspaceId === workspaceId) return true;
        if (workspaceId && e.entityId === workspaceId) return true;
        if (customerId && e.entityType === "customer" && e.entityId === customerId) return true;
        if (renewalId && e.entityType === "renewal" && e.entityId === renewalId) return true;
        return false;
      });
      // Sort: open first, red before amber, newest first
      relevant.sort((a, b) => {
        const statusOrder = { open: 0, acknowledged: 1, resolved: 2 };
        const so = statusOrder[a.status] - statusOrder[b.status];
        if (so !== 0) return so;
        if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setEvents(relevant);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, customerId, renewalId]);

  useEffect(() => { load(); }, [load]);

  const openCount = events.filter(e => e.status === "open").length;
  const redCount = events.filter(e => e.severity === "red" && e.status !== "resolved").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Active Escalations & Signals</h3>
            {openCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {openCount}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loading…" : (
              events.length === 0
                ? `No active escalations for ${contextLabel}`
                : `${redCount} critical · ${openCount} open · reads from global escalation engine`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/escalations">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
              <ArrowRight className="w-3 h-3" />
              Full Console
            </Button>
          </Link>
        </div>
      </div>

      {/* Derived context signals (local calc, not stored) */}
      {derivedSignals.length > 0 && (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Contextual Risk Signals
            </span>
            <span className="text-[10px] text-muted-foreground">(calculated · not escalation events)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {derivedSignals.map((sig, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                sig.severity === "red"
                  ? "border-red-200 bg-red-50/60 dark:bg-red-950/20"
                  : sig.severity === "amber"
                    ? "border-amber-100 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-emerald-100 bg-emerald-50/40 dark:bg-emerald-950/20"
              }`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  sig.severity === "red" ? "bg-red-500" :
                  sig.severity === "amber" ? "bg-amber-500" : "bg-emerald-500"
                }`} />
                <div>
                  <p className="text-xs font-medium text-foreground">{sig.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{sig.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center py-10 gap-3 border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No active escalations</p>
            <p className="text-xs text-muted-foreground mt-1">
              {contextLabel} has no open or acknowledged escalation events
            </p>
          </div>
        </div>
      )}

      {/* Event list */}
      {!loading && events.length > 0 && (
        <div className="space-y-3">
          {events.map(event => (
            <EscalationRow key={event.id} event={event} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
