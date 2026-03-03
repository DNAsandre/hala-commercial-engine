/*
 * GlobalEscalations — Global Risk Console
 * Sprint 8 + 8b: Aggregates all escalation_events across workspaces
 * Sprint 8b: SLA countdown timers with urgency indicators
 *
 * Design: Swiss Precision Instrument
 * Deep navy accents, warm white background, IBM Plex Sans
 *
 * Permissions:
 *   Admin/Finance: full visibility
 *   Sales: only escalations assigned_to = self
 *   Only Admin can resolve
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Shield,
  Clock,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  Flame,
  AlertOctagon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAllEscalations,
  resolveEscalation,
  acknowledgeEscalation,
  getTriggerTypeLabel,
  computeSlaStatus,
  type EscalationEvent,
  type EscalationSeverity,
  type EscalationStatus,
  type TriggerType,
} from "@/lib/escalation-engine";
import { CountdownBadge, CountdownDetail } from "@/components/EscalationCountdown";

// ============================================================
// HELPERS
// ============================================================

function daysOpen(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// AGING BADGE
// ============================================================

function AgingBadge({ createdAt, severity, status }: { createdAt: string; severity: EscalationSeverity; status: EscalationStatus }) {
  if (status === "resolved") return null;
  if (severity !== "red") return null;

  const days = daysOpen(createdAt);

  if (days >= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white animate-pulse">
        <Flame className="w-3 h-3" />
        OVERDUE {days}d
      </span>
    );
  }

  if (days >= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-300">
        <AlertOctagon className="w-3 h-3" />
        CRITICAL {days}d
      </span>
    );
  }

  return null;
}

// ============================================================
// SEVERITY & STATUS BADGES
// ============================================================

function SeverityBadge({ severity }: { severity: EscalationSeverity }) {
  if (severity === "red") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
        <AlertTriangle className="w-3 h-3" />
        RED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
      <AlertTriangle className="w-3 h-3" />
      AMBER
    </span>
  );
}

function StatusBadge({ status }: { status: EscalationStatus }) {
  const styles: Record<EscalationStatus, string> = {
    open: "bg-red-100 text-red-800",
    acknowledged: "bg-amber-100 text-amber-800",
    resolved: "bg-green-100 text-green-800",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

// ============================================================
// RESOLVE DRAWER
// ============================================================

function ResolveDrawer({
  event,
  onClose,
  onResolved,
  isAdmin,
}: {
  event: EscalationEvent;
  onClose: () => void;
  onResolved: () => void;
  isAdmin: boolean;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleResolve = async () => {
    if (reason.trim().length < 10) {
      toast.error("Resolution reason must be at least 10 characters");
      return;
    }
    setSaving(true);
    const ok = await resolveEscalation(event.id, reason.trim());
    setSaving(false);
    if (ok) {
      toast.success("Escalation resolved");
      onResolved();
    } else {
      toast.error("Failed to resolve escalation");
    }
  };

  const handleAcknowledge = async () => {
    setSaving(true);
    const ok = await acknowledgeEscalation(event.id);
    setSaving(false);
    if (ok) {
      toast.success("Escalation acknowledged");
      onResolved();
    } else {
      toast.error("Failed to acknowledge escalation");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Escalation Detail</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{event.id.slice(0, 8)}...</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={event.severity} />
            <StatusBadge status={event.status} />
            <AgingBadge createdAt={event.createdAt} severity={event.severity} status={event.status} />
          </div>

          {/* SLA Countdown Detail */}
          <CountdownDetail event={event} />

          {/* Trigger info */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Trigger Type</div>
            <div className="text-sm font-medium">{getTriggerTypeLabel(event.triggerType)}</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Trigger Reason</div>
            <div className="text-sm">{event.triggerReason}</div>
          </div>

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Event Metadata</div>
              <div className="bg-muted rounded-md p-3 space-y-1">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span className="font-medium text-foreground">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Assigned To</div>
              <div className="text-sm font-medium">{event.assignedToName || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Triggered By</div>
              <div className="text-sm font-medium">{event.triggeredByName || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="text-sm">{formatDate(event.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Days Open</div>
              <div className="text-sm font-medium">{event.status === "resolved" ? "—" : `${daysOpen(event.createdAt)}d`}</div>
            </div>
          </div>

          {/* Resolution info (if resolved) */}
          {event.status === "resolved" && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-1">
              <div className="text-xs font-semibold text-green-800">Resolved</div>
              <div className="text-xs text-green-700">{event.resolutionReason}</div>
              <div className="text-[10px] text-green-600">
                By {event.resolvedByName} — {event.resolvedAt ? formatDate(event.resolvedAt) : ""}
              </div>
            </div>
          )}

          {/* Actions (Admin only, non-resolved) */}
          {isAdmin && event.status !== "resolved" && (
            <div className="space-y-3 pt-2 border-t border-border">
              {event.status === "open" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAcknowledge}
                  disabled={saving}
                >
                  Acknowledge
                </Button>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Resolution Reason</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the resolution action taken..."
                  className="text-sm min-h-[80px]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Minimum 10 characters</span>
                  <span className="text-[10px] text-muted-foreground">{reason.length}/500</span>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={handleResolve}
                disabled={saving || reason.trim().length < 10}
              >
                {saving ? "Resolving..." : "Resolve & Close"}
              </Button>
            </div>
          )}

          {!isAdmin && event.status !== "resolved" && (
            <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground text-center">
              Only Admin can acknowledge or resolve escalations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function GlobalEscalations() {
  const [, navigate] = useLocation();
  const { appUser } = useAuth();
  const user = appUser || { id: "u1", name: "Loading...", email: "", role: "admin" as const, region: "East" };
  const isAdmin = user.role === "admin";
  const isFinance = user.role === "finance";
  const isSales = user.role === "sales" || user.role === "salesman";
  const hasFullVisibility = isAdmin || isFinance;

  // Data
  const [allEvents, setAllEvents] = useState<EscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EscalationEvent | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const events = await fetchAllEscalations();
    setAllEvents(events);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Role-based filtering: Sales sees only assigned_to = self
  const roleFilteredEvents = useMemo(() => {
    if (hasFullVisibility) return allEvents;
    if (isSales) return allEvents.filter(e => e.assignedTo === user.id);
    // Default: show all (ops, viewer, etc.)
    return allEvents;
  }, [allEvents, hasFullVisibility, isSales, user.id]);

  // Apply UI filters
  const filteredEvents = useMemo(() => {
    return roleFilteredEvents.filter(e => {
      if (severityFilter !== "all" && e.severity !== severityFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (entityTypeFilter !== "all" && e.entityType !== entityTypeFilter) return false;
      if (assignedToFilter !== "all" && e.assignedTo !== assignedToFilter) return false;
      return true;
    }).sort((a, b) => {
      // Sort: red before amber, then by created_at desc
      if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [roleFilteredEvents, severityFilter, statusFilter, entityTypeFilter, assignedToFilter]);

  // Stats
  const stats = useMemo(() => {
    const open = roleFilteredEvents.filter(e => e.status === "open" || e.status === "acknowledged");
    const slaBreachedCount = open.filter(e => {
      const sla = computeSlaStatus(e);
      return sla?.breached === true;
    }).length;
    return {
      totalOpen: open.length,
      redCount: open.filter(e => e.severity === "red").length,
      amberCount: open.filter(e => e.severity === "amber").length,
      criticalCount: open.filter(e => e.severity === "red" && daysOpen(e.createdAt) >= 3).length,
      overdueCount: open.filter(e => e.severity === "red" && daysOpen(e.createdAt) >= 7).length,
      slaBreachedCount,
    };
  }, [roleFilteredEvents]);

  // Unique assignees for filter
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    roleFilteredEvents.forEach(e => {
      if (e.assignedTo && e.assignedToName) map.set(e.assignedTo, e.assignedToName);
    });
    return Array.from(map.entries());
  }, [roleFilteredEvents]);

  // Unique entity types for filter
  const entityTypes = useMemo(() => {
    return Array.from(new Set(roleFilteredEvents.map(e => e.entityType)));
  }, [roleFilteredEvents]);

  const handleDrillDown = (event: EscalationEvent) => {
    setSelectedEvent(event);
  };

  const handleNavigateToWorkspace = (event: EscalationEvent) => {
    if (event.workspaceId) {
      navigate(`/workspaces/${event.workspaceId}?tab=escalations`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Global Escalations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasFullVisibility ? "All escalation events across workspaces" : "Escalations assigned to you"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Open</div>
            <div className="text-2xl font-bold text-foreground">{stats.totalOpen}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1">Red</div>
            <div className="text-2xl font-bold text-red-700">{stats.redCount}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1">Amber</div>
            <div className="text-2xl font-bold text-amber-700">{stats.amberCount}</div>
          </CardContent>
        </Card>
        <Card className={`${stats.criticalCount > 0 ? "border-red-300 bg-red-50/80" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Critical (&gt;3d)</div>
            <div className={`text-2xl font-bold ${stats.criticalCount > 0 ? "text-red-700" : "text-foreground"}`}>{stats.criticalCount}</div>
          </CardContent>
        </Card>
        <Card className={`${stats.overdueCount > 0 ? "border-red-400 bg-red-100/80" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Overdue (&gt;7d)</div>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? "text-red-800 animate-pulse" : "text-foreground"}`}>{stats.overdueCount}</div>
          </CardContent>
        </Card>
        <Card className={`${stats.slaBreachedCount > 0 ? "border-red-500 bg-red-100 ring-1 ring-red-300" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">SLA Breached</div>
            <div className={`text-2xl font-bold ${stats.slaBreachedCount > 0 ? "text-red-900 animate-pulse" : "text-foreground"}`}>{stats.slaBreachedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {entityTypes.map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assignees.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(severityFilter !== "all" || statusFilter !== "open" || entityTypeFilter !== "all" || assignedToFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setSeverityFilter("all");
                  setStatusFilter("open");
                  setEntityTypeFilter("all");
                  setAssignedToFilter("all");
                }}
              >
                <X className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}

            <div className="ml-auto text-xs text-muted-foreground">
              {filteredEvents.length} of {roleFilteredEvents.length} events
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Severity</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trigger</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SLA Timer</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Age</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading escalations...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <div className="text-sm font-medium">No escalations match filters</div>
                    <div className="text-xs mt-1">Adjust filters or check back later</div>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const days = daysOpen(event.createdAt);
                  const workspaceName = event.metadata?.workspaceTitle || event.metadata?.customerName || event.entityId;

                  return (
                    <tr
                      key={event.id}
                      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleDrillDown(event)}
                    >
                      {/* Severity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <SeverityBadge severity={event.severity} />
                          <AgingBadge createdAt={event.createdAt} severity={event.severity} status={event.status} />
                        </div>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{String(workspaceName)}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">{event.entityType}</div>
                      </td>

                      {/* Trigger */}
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{getTriggerTypeLabel(event.triggerType)}</div>
                        <div className="text-[10px] text-muted-foreground max-w-[240px] truncate">{event.triggerReason}</div>
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-foreground">{event.assignedToName || "—"}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={event.status} />
                      </td>

                      {/* SLA Timer */}
                      <td className="px-4 py-3">
                        <CountdownBadge event={event} />
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-foreground">{formatRelativeTime(event.createdAt)}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDate(event.createdAt)}</div>
                      </td>

                      {/* Age */}
                      <td className="px-4 py-3">
                        <div className={`text-xs font-medium ${
                          event.status === "resolved" ? "text-green-600" :
                          days >= 7 ? "text-red-700 font-bold" :
                          days >= 3 ? "text-red-600" :
                          "text-foreground"
                        }`}>
                          {event.status === "resolved" ? "Closed" : `${days}d`}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {event.workspaceId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleNavigateToWorkspace(event)}
                              title="Go to workspace"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Drawer */}
      {selectedEvent && (
        <ResolveDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onResolved={() => {
            setSelectedEvent(null);
            loadData();
          }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
