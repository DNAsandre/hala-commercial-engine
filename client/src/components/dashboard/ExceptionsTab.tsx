/**
 * ExceptionsTab — Summarized dashboard view of the global exception layer
 *
 * NOT the full GlobalEscalations console.
 * Shows the dashboard summary with the most critical open exceptions,
 * their source mode, severity, SLA status, and routed owner.
 *
 * Click-through to: source workspace, customer, or full console.
 *
 * Reuses: fetchAllEscalations, computeSlaStatus, getEventLevel,
 * getTriggerTypeLabel — same engine as GlobalEscalations page.
 */

import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import {
  fetchAllEscalations,
  computeSlaStatus,
  getTriggerTypeLabel,
  type EscalationEvent,
} from "@/lib/escalation-engine";
import { getEventLevel } from "@/lib/escalation-triggers";

const CheckCircle2 = CheckCircle;

// ─── Helpers (same as EscalationAttentionPanel) ───────────────

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
  const t = event.entityType;
  if (t === "workspace") {
    const title = (event.metadata?.workspaceTitle || "").toLowerCase();
    if (title.includes("tender")) return "Tender";
    return "Commercial";
  }
  if (t === "renewal") return "Renewal";
  if (t === "customer") return "Customer";
  return t;
}

const SOURCE_COLORS: Record<string, string> = {
  Tender:     "bg-blue-50 text-blue-700 border-blue-200",
  Commercial: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Renewal:    "bg-purple-50 text-purple-700 border-purple-200",
  Customer:   "bg-slate-50 text-slate-700 border-slate-200",
};

const LEVEL_LABELS = ["", "Signal", "Managed", "Escalation", "Critical"];
const LEVEL_STYLES = [
  "", "",
  "bg-slate-100 text-slate-600",
  "bg-amber-100 text-amber-800",
  "bg-red-100 text-red-900",
];

// ─── Summary chip ────────────────────────────────────────────

function SummaryChip({
  label,
  value,
  rag,
}: {
  label: string;
  value: number;
  rag: "red" | "amber" | "green" | "neutral";
}) {
  const border =
    rag === "red"
      ? "border-l-red-500"
      : rag === "amber"
        ? "border-l-amber-500"
        : rag === "green"
          ? "border-l-emerald-500"
          : "border-l-slate-300";
  const text =
    rag === "red"
      ? "text-red-600 dark:text-red-400"
      : rag === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : rag === "green"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground";
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 bg-card border border-border border-l-4 ${border} rounded-xl min-w-[110px] shrink-0`}>
      <span className={`text-2xl font-bold ${text}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

// ─── Exception row ────────────────────────────────────────────

function ExceptionRow({ event }: { event: EscalationEvent }) {
  const sla = computeSlaStatus(event);
  const isRed = event.severity === "red";
  const source = sourceTypeLabel(event);
  const level = getEventLevel(event);
  const link = entityLink(event);

  return (
    <Link href={link}>
      <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group hover:shadow-sm ${
        isRed
          ? "border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800/50 hover:bg-red-50/80"
          : "border-amber-100 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/40 hover:bg-amber-50/60"
      }`}>
        {/* Severity icon */}
        <div className={`mt-0.5 shrink-0 ${isRed ? "text-red-500" : "text-amber-500"}`}>
          {isRed ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${SOURCE_COLORS[source] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
              {source}
            </span>
            {level >= 2 && (
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${LEVEL_STYLES[level]}`}>
                {LEVEL_LABELS[level]}
              </span>
            )}
            <span className="text-xs font-semibold text-foreground truncate">
              {entityLabel(event)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {getTriggerTypeLabel(event.triggerType)}: {event.triggerReason.slice(0, 100)}
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
                {Math.max(0, Math.floor(sla.remainingMs / 3600000))}h left
              </span>
            )}
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
              event.status === "open"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              {event.status === "open" ? "Open" : "Acknowledged"}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function ExceptionsTab() {
  const [allEvents, setAllEvents] = useState<EscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchAllEscalations()
      .then((events) => {
        setAllEvents(events);
        // Auto-retry once after 800ms if we got 0 results (timing issue on first mount)
        if (events.length === 0) {
          setTimeout(() => {
            fetchAllEscalations().then(setAllEvents).catch((err) => { console.warn('[ExceptionsTab] retry fallback:', err); });
          }, 800);
        }
      })
      .finally(() => setLoading(false));
  }, [retryCount]);

  const handleRetry = () => setRetryCount(c => c + 1);

  const { critical, warnings, acknowledged, slaBreached, displayed } = useMemo(() => {
    const open = allEvents.filter(e => e.status === "open" || e.status === "acknowledged");
    const critical = open.filter(e => e.severity === "red").length;
    const warnings = open.filter(e => e.severity === "amber").length;
    const acknowledged = allEvents.filter(e => e.status === "acknowledged").length;
    const slaBreached = open.filter(e => {
      const sla = computeSlaStatus(e);
      return sla?.breached;
    }).length;

    const displayed = open
      .sort((a, b) => {
        const la = getEventLevel(a), lb = getEventLevel(b);
        if (la !== lb) return lb - la;
        if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 10);

    return { critical, warnings, acknowledged, slaBreached, displayed };
  }, [allEvents]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* SUMMARY STRIP */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <SummaryChip label="Critical open" value={critical} rag={critical > 0 ? "red" : "green"} />
        <SummaryChip label="Warnings open" value={warnings} rag={warnings > 0 ? "amber" : "green"} />
        <SummaryChip label="Acknowledged" value={acknowledged} rag="neutral" />
        <SummaryChip label="SLA breached" value={slaBreached} rag={slaBreached > 0 ? "red" : "green"} />
      </div>

      {/* EXCEPTIONS LIST */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-foreground">Open Exceptions</h3>
              {displayed.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {displayed.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {critical > 0
                ? `${critical} critical · ${warnings} warnings — requires action`
                : warnings > 0
                  ? `${warnings} active warnings`
                  : "No open exceptions"}
            </p>
          </div>
          <Link href="/escalations">
            <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
              Full console <ExternalLink className="w-3 h-3" />
            </span>
          </Link>
        </div>

        <div className="p-4 space-y-2">
          {displayed.length > 0 ? (
            displayed.map(event => <ExceptionRow key={event.id} event={event} />)
          ) : (
            <div className="flex flex-col items-center py-10 gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <p className="text-sm font-medium text-muted-foreground">No open exceptions</p>
              <p className="text-xs text-muted-foreground">All exceptions resolved or cleared</p>
              <button
                onClick={handleRetry}
                className="text-xs text-primary hover:underline mt-1"
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        {displayed.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <Link href="/escalations">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <ExternalLink className="w-3.5 h-3.5" />
                Open full exceptions console — acknowledge, resolve, filter by mode
              </div>
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
