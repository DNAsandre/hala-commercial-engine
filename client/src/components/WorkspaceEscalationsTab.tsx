/**
 * WorkspaceEscalationsTab — Escalation event list with severity badges,
 * status flow (open → acknowledged → resolved), and Admin resolve flow.
 * 
 * Design: Hala navy + amber/red severity system. Serif headings.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  FileText,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth-state";
import {
  type EscalationEvent,
  type EscalationTask,
  acknowledgeEscalation,
  resolveEscalation,
  fetchTasksByEscalation,
  fetchEscalationsByWorkspace,
  getTriggerTypeLabel,
  getSeverityColor,
  getStatusColor,
} from "@/lib/escalation-engine";

interface WorkspaceEscalationsTabProps {
  workspaceId: string;
  escalations: EscalationEvent[];
  onRefresh: (events: EscalationEvent[]) => void;
}

export function WorkspaceEscalationsTab({
  workspaceId,
  escalations,
  onRefresh,
}: WorkspaceEscalationsTabProps) {
  const user = getCurrentUser();
  const isAdmin = user.role === "admin";

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Record<string, EscalationTask[]>>({});
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<EscalationEvent | null>(null);
  const [resolveReason, setResolveReason] = useState("");
  const [resolving, setResolving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openCount = escalations.filter(e => e.status === "open").length;
  const acknowledgedCount = escalations.filter(e => e.status === "acknowledged").length;
  const resolvedCount = escalations.filter(e => e.status === "resolved").length;

  // Load tasks when expanding an event
  useEffect(() => {
    if (expandedId && !tasks[expandedId]) {
      fetchTasksByEscalation(expandedId).then(t => {
        setTasks(prev => ({ ...prev, [expandedId]: t }));
      });
    }
  }, [expandedId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const events = await fetchEscalationsByWorkspace(workspaceId);
      onRefresh(events);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAcknowledge = async (event: EscalationEvent) => {
    if (!isAdmin) {
      toast.error("Not authorized", { description: "Only Admin can acknowledge escalations." });
      return;
    }
    const ok = await acknowledgeEscalation(event.id);
    if (ok) {
      toast.success("Escalation acknowledged");
      handleRefresh();
    } else {
      toast.error("Failed to acknowledge escalation");
    }
  };

  const handleResolveClick = (event: EscalationEvent) => {
    if (!isAdmin) {
      toast.error("Not authorized", { description: "Only Admin can resolve escalations." });
      return;
    }
    setResolveTarget(event);
    setResolveReason("");
    setResolveModalOpen(true);
  };

  const handleResolveConfirm = async () => {
    if (!resolveTarget || resolveReason.trim().length < 10) return;
    setResolving(true);
    try {
      const ok = await resolveEscalation(resolveTarget.id, resolveReason);
      if (ok) {
        toast.success("Escalation resolved", { description: "Resolution logged to audit trail." });
        setResolveModalOpen(false);
        handleRefresh();
      } else {
        toast.error("Failed to resolve escalation");
      }
    } finally {
      setResolving(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / (1000 * 60)))}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === "red") return <ShieldAlert className="h-4 w-4 text-red-600" />;
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Clock className="h-3.5 w-3.5" />;
      case "acknowledged": return <Eye className="h-3.5 w-3.5" />;
      case "resolved": return <CheckCircle2 className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-serif font-semibold text-[#0A1628]">Escalations</h3>
          <div className="flex items-center gap-2">
            {openCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                {openCount} Open
              </Badge>
            )}
            {acknowledgedCount > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                {acknowledgedCount} Acknowledged
              </Badge>
            )}
            {resolvedCount > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                {resolvedCount} Resolved
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Empty state */}
      {escalations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No escalations</p>
            <p className="text-xs text-muted-foreground mt-1">
              This workspace has no active or historical escalation events.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Event list */}
      {escalations.map((event) => {
        const sevColors = getSeverityColor(event.severity);
        const statColors = getStatusColor(event.status);
        const isExpanded = expandedId === event.id;
        const eventTasks = tasks[event.id] || [];

        return (
          <Card
            key={event.id}
            className={`${sevColors.border} border-l-4 transition-all ${
              event.status === "resolved" ? "opacity-70" : ""
            }`}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {getSeverityIcon(event.severity)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`${sevColors.bg} ${sevColors.text} ${sevColors.border} text-[10px] uppercase tracking-wider font-semibold`}
                      >
                        {event.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`${statColors.bg} ${statColors.text} text-[10px] uppercase tracking-wider font-semibold`}
                      >
                        {getStatusIcon(event.status)}
                        <span className="ml-1">{event.status}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getTriggerTypeLabel(event.triggerType)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">
                      {event.triggerReason}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 w-7 p-0"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-0 px-4 pb-3">
              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatTime(event.createdAt)}
                </span>
                {event.assignedToName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Assigned to {event.assignedToName}
                  </span>
                )}
                {event.triggeredByName && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Triggered by {event.triggeredByName}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              {event.status !== "resolved" && isAdmin && (
                <div className="flex items-center gap-2 mt-3">
                  {event.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleAcknowledge(event)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Acknowledge
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => handleResolveClick(event)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                </div>
              )}

              {/* Non-admin notice */}
              {event.status !== "resolved" && !isAdmin && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Only Admin can acknowledge or resolve escalations.
                </p>
              )}

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border space-y-3">
                  {/* Metadata */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Event Metadata</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <div key={key} className="flex items-baseline gap-1.5 text-xs">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}:
                            </span>
                            <span className="font-medium text-foreground truncate">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution info */}
                  {event.status === "resolved" && event.resolutionReason && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3">
                      <p className="text-xs font-medium text-green-800 mb-1">Resolution</p>
                      <p className="text-xs text-green-700">{event.resolutionReason}</p>
                      {event.resolvedByName && (
                        <p className="text-xs text-green-600 mt-1">
                          Resolved by {event.resolvedByName} — {event.resolvedAt ? formatTime(event.resolvedAt) : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tasks */}
                  {eventTasks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Tasks</p>
                      <div className="space-y-1.5">
                        {eventTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`h-2 w-2 rounded-full shrink-0 ${
                                task.status === "done" ? "bg-green-500" :
                                task.status === "in_progress" ? "bg-amber-500" : "bg-red-500"
                              }`} />
                              <span className="text-xs text-foreground truncate">{task.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {task.assignedToName && (
                                <span className="text-[10px] text-muted-foreground">{task.assignedToName}</span>
                              )}
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {task.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Resolve Modal */}
      <Dialog open={resolveModalOpen} onOpenChange={(v) => !v && setResolveModalOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Resolve Escalation
            </DialogTitle>
            <DialogDescription className="text-left">
              Provide a resolution reason. This will be logged to the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {resolveTarget && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium text-foreground text-xs mb-1">
                  {getTriggerTypeLabel(resolveTarget.triggerType)}
                </p>
                <p className="text-xs text-muted-foreground">{resolveTarget.triggerReason}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Resolution Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                placeholder="Explain how this escalation was resolved (min 10 characters)..."
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className={resolveReason.trim().length < 10 && resolveReason.length > 0 ? "text-red-500" : ""}>
                  {resolveReason.trim().length < 10 && resolveReason.length > 0
                    ? `${10 - resolveReason.trim().length} more characters required`
                    : "Minimum 10 characters"}
                </span>
                <span>{resolveReason.length}/500</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResolveModalOpen(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              onClick={handleResolveConfirm}
              disabled={resolveReason.trim().length < 10 || resolving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {resolving ? "Processing..." : "Resolve & Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
