/**
 * EscalationCountdown — Live SLA countdown timer with progress bar.
 *
 * Sprint 8b: SLA Tracking
 * Displays time remaining until SLA breach with visual urgency indicators.
 * Updates every 30 seconds via setInterval.
 *
 * Urgency bands:
 *   GREEN:    > 50% time remaining
 *   AMBER:    20–50% time remaining
 *   RED:      < 20% time remaining
 *   BREACHED: past SLA deadline (flashing)
 */

import { useState, useEffect, useCallback } from "react";
import { Timer, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  computeSlaStatus,
  getSlaUrgencyStyles,
  SLA_TARGET_HOURS,
  type EscalationEvent,
  type SlaStatus,
  type SlaUrgency,
} from "@/lib/escalation-engine";

// ============================================================
// COMPACT BADGE (for table rows)
// ============================================================

interface CountdownBadgeProps {
  event: EscalationEvent;
}

/**
 * Compact SLA countdown badge for use in table cells.
 * Shows countdown text + urgency color. Pulses when breached.
 */
export function CountdownBadge({ event }: CountdownBadgeProps) {
  const [sla, setSla] = useState<SlaStatus | null>(() => computeSlaStatus(event));

  useEffect(() => {
    if (event.status === "resolved") return;
    const interval = setInterval(() => {
      setSla(computeSlaStatus(event));
    }, 30_000); // Update every 30s
    return () => clearInterval(interval);
  }, [event]);

  if (!sla || event.status === "resolved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-muted-foreground bg-muted">
        —
      </span>
    );
  }

  const styles = getSlaUrgencyStyles(sla.urgency);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles.bg} ${styles.text} ${styles.border} border ${
        sla.breached ? "animate-pulse" : ""
      }`}
      title={`SLA deadline: ${new Date(sla.deadlineAt).toLocaleString()} | Target: ${sla.targetHours}h`}
    >
      {sla.breached ? (
        <ShieldAlert className="w-3 h-3" />
      ) : sla.urgency === "red" ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <Timer className="w-3 h-3" />
      )}
      {sla.countdownLabel}
    </span>
  );
}

// ============================================================
// DETAILED CARD (for detail drawer / expanded view)
// ============================================================

interface CountdownDetailProps {
  event: EscalationEvent;
}

/**
 * Detailed SLA countdown card with progress bar, deadline, and target info.
 * For use in the detail drawer or expanded escalation view.
 */
export function CountdownDetail({ event }: CountdownDetailProps) {
  const [sla, setSla] = useState<SlaStatus | null>(() => computeSlaStatus(event));

  useEffect(() => {
    if (event.status === "resolved") return;
    const interval = setInterval(() => {
      setSla(computeSlaStatus(event));
    }, 15_000); // Update every 15s for detail view
    return () => clearInterval(interval);
  }, [event]);

  if (!sla || event.status === "resolved") {
    return (
      <div className="rounded-md bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground">SLA Timer</div>
        <div className="text-sm font-medium text-muted-foreground mt-1">
          {event.status === "resolved" ? "Resolved — SLA no longer active" : "No SLA data"}
        </div>
      </div>
    );
  }

  const styles = getSlaUrgencyStyles(sla.urgency);
  const progressPercent = Math.min(sla.elapsed * 100, 100);
  const deadlineDate = new Date(sla.deadlineAt);

  return (
    <div className={`rounded-md ${styles.bg} ${styles.border} border p-3 space-y-2.5 ${sla.breached ? "animate-pulse" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {sla.breached ? (
            <ShieldAlert className={`w-4 h-4 ${styles.text}`} />
          ) : (
            <Timer className={`w-4 h-4 ${styles.text}`} />
          )}
          <span className={`text-xs font-semibold uppercase tracking-wider ${styles.text}`}>
            SLA {sla.breached ? "BREACHED" : "Timer"}
          </span>
        </div>
        <span className={`text-[10px] font-medium ${styles.text}`}>
          Target: {sla.targetHours}h ({event.severity.toUpperCase()})
        </span>
      </div>

      {/* Countdown */}
      <div className={`text-lg font-bold tracking-tight ${styles.text}`}>
        {sla.countdownLabel}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-white/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(sla.urgency)}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px]">
          <span className={styles.text}>
            {Math.round(progressPercent)}% elapsed
          </span>
          <span className={styles.text}>
            Deadline: {deadlineDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MINI PROGRESS (for workspace escalation cards)
// ============================================================

interface CountdownMiniProps {
  event: EscalationEvent;
}

/**
 * Minimal SLA indicator for workspace escalation cards.
 * Shows a small progress bar + countdown text inline.
 */
export function CountdownMini({ event }: CountdownMiniProps) {
  const [sla, setSla] = useState<SlaStatus | null>(() => computeSlaStatus(event));

  useEffect(() => {
    if (event.status === "resolved") return;
    const interval = setInterval(() => {
      setSla(computeSlaStatus(event));
    }, 30_000);
    return () => clearInterval(interval);
  }, [event]);

  if (!sla || event.status === "resolved") return null;

  const styles = getSlaUrgencyStyles(sla.urgency);
  const progressPercent = Math.min(sla.elapsed * 100, 100);

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden max-w-[100px]">
        <div
          className={`h-full rounded-full ${getProgressBarColor(sla.urgency)}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-semibold ${styles.text} ${sla.breached ? "animate-pulse" : ""}`}
        title={`SLA: ${sla.targetHours}h | Deadline: ${new Date(sla.deadlineAt).toLocaleString()}`}
      >
        {sla.breached ? (
          <span className="flex items-center gap-0.5">
            <ShieldAlert className="w-2.5 h-2.5" />
            {sla.countdownLabel}
          </span>
        ) : (
          <span className="flex items-center gap-0.5">
            <Timer className="w-2.5 h-2.5" />
            {sla.countdownLabel}
          </span>
        )}
      </span>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getProgressBarColor(urgency: SlaUrgency): string {
  switch (urgency) {
    case "green": return "bg-emerald-500";
    case "amber": return "bg-amber-500";
    case "red": return "bg-red-500";
    case "breached": return "bg-red-700";
  }
}
