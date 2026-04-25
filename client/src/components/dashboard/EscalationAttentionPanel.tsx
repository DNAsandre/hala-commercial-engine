/**
 * EscalationAttentionPanel — Dashboard surface for the escalation engine.
 *
 * Reads DIRECTLY from escalation_events (same source as GlobalEscalations page).
 * Shows only open/acknowledged events, highest priority first.
 * Replaces the old EscalationPanel which read from the Signal[] mock table.
 *
 * Design rules:
 * - Show max 6 items, prioritised by severity + age
 * - Click through: entity-level link (workspace or customer)
 * - Link to Global Escalations for full view
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Clock,
  User,
  Eye,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchAllEscalations,
  computeSlaStatus,
  getTriggerTypeLabel,
  type EscalationEvent,
} from "@/lib/escalation-engine";
import { getEventLevel, ESCALATION_LEVELS } from "@/lib/escalation-triggers";

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function entityLink(event: EscalationEvent): string {
  if (event.workspaceId) return `/workspaces/${event.workspaceId}?tab=escalations`;
  if (event.entityType === "customer") return `/customers/${event.entityId}`;
  if (event.entityType === "renewal") return `/renewals`;
  return "/escalations";
}

function entityLabel(event: EscalationEvent): string {
  return (
    event.metadata?.customerName ||
    event.metadata?.workspaceTitle ||
    event.entityId.slice(0, 8)
  );
}

function sourceTypeLabel(event: EscalationEvent): string {
  const entityType = event.entityType;
  if (entityType === "workspace") {
    const title = (event.metadata?.workspaceTitle || "").toLowerCase();
    if (title.includes("tender")) return "Tender";
    return "Commercial";
  }
  if (entityType === "renewal") return "Renewal";
  if (entityType === "customer") return "Customer";
  return entityType;
}

const SOURCE_COLORS: Record<string, string> = {
  Tender:     "bg-blue-50 text-blue-700 border-blue-200",
  Commercial: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Renewal:    "bg-purple-50 text-purple-700 border-purple-200",
  Customer:   "bg-slate-50 text-slate-700 border-slate-200",
};

function LevelPill({ event }: { event: EscalationEvent }) {
  const level = getEventLevel(event);
  const styles = [
    "", "",
    "bg-slate-100 text-slate-600",
    "bg-amber-100 text-amber-800",
    "bg-red-100 text-red-900",
  ];
  const labels = ["", "Signal", "Managed", "Escalation", "Critical"];
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

// ─── Row ────────────────────────────────────────────────────

function AttentionRow({ event }: { event: EscalationEvent }) {
  const sla = computeSlaStatus(event);
  const isRed = event.severity === "red";
  const source = sourceTypeLabel(event);
  const link = entityLink(event);

  return (
    <Link href={link}>
      <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group hover:shadow-sm ${
        isRed
          ? "border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800/50 hover:bg-red-50/80"
          : "border-amber-100 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/40 hover:bg-amber-50/60"
      }`}>
        {/* Icon */}
        <div className={`mt-0.5 shrink-0 ${isRed ? "text-red-500" : "text-amber-500"}`}>
          {isRed ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${SOURCE_COLORS[source] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
              {source}
            </span>
            <LevelPill event={event} />
            <span className="text-xs font-semibold text-foreground truncate">
              {entityLabel(event)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {getTriggerTypeLabel(event.triggerType)}: {event.triggerReason.slice(0, 120)}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {event.assignedToName && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <User className="w-3 h-3" />
                {event.assignedToName}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {timeAgo(event.createdAt)}
            </span>
            {sla?.breached && (
              <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded uppercase">
                SLA Breached
              </span>
            )}
            {sla && !sla.breached && sla.urgency === "red" && (
              <span className="text-[9px] font-semibold text-red-600">
                {Math.max(0, Math.floor(sla.remainingMs / 3600000))}h remaining
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function EscalationAttentionPanel() {
  const [events, setEvents] = useState<EscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetchAllEscalations()
        .then((all) => {
          const active = all
            .filter((e) => e.status === "open" || e.status === "acknowledged")
            .sort((a, b) => {
              const la = getEventLevel(a), lb = getEventLevel(b);
              if (la !== lb) return lb - la;
              if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .slice(0, 6);
          setEvents(active);
        })
        .finally(() => setLoading(false));

    load();
    // Auto-retry once after 800ms on first mount (timing guard)
    const retry = setTimeout(load, 800);
    // Poll every 60s for live updates
    const interval = setInterval(load, 60_000);
    return () => {
      clearTimeout(retry);
      clearInterval(interval);
    };
  }, []);

  const redCount = events.filter((e) => e.severity === "red").length;
  const amberCount = events.filter((e) => e.severity === "amber").length;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Attention Required</h3>
            {!loading && events.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {events.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {loading ? "Loading..." : (
              redCount > 0
                ? `${redCount} critical · ${amberCount} warning — requires action`
                : amberCount > 0
                  ? `${amberCount} active warnings`
                  : "No open escalations"
            )}
          </p>
        </div>
        <Link href="/escalations">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
            View all
            <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center py-8 gap-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm text-muted-foreground font-medium">No active escalations</p>
          <p className="text-xs text-muted-foreground">All exceptions resolved or cleared</p>
        </div>
      )}

      {/* Event rows */}
      {!loading && events.length > 0 && (
        <div className="space-y-2">
          {events.map((event) => (
            <AttentionRow key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Footer link */}
      {!loading && events.length > 0 && (
        <Link href="/escalations">
          <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-t border-border pt-3">
            <Eye className="w-3.5 h-3.5" />
            Open full exceptions console
          </div>
        </Link>
      )}
    </div>
  );
}
