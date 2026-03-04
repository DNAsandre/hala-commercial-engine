/**
 * Activity Intelligence Feed — Recent commercial activity events
 */
import { useMemo } from "react";
import { Link } from "wouter";
import {
  FileText, Send, AlertTriangle, ShieldCheck, RefreshCw,
  FileCheck, Clock, Zap, CheckCircle2, XCircle,
} from "lucide-react";
import type { Workspace, Signal, ApprovalRecord } from "@/lib/store";

interface ActivityFeedProps {
  workspaces: Workspace[];
  signals: Signal[];
  approvals: ApprovalRecord[];
}

interface ActivityItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  detail: string;
  timestamp: string;
  workspaceId?: string;
}

export default function ActivityFeed({ workspaces, signals, approvals }: ActivityFeedProps) {
  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    // From signals
    signals.forEach(s => {
      const ws = workspaces.find(w => w.id === s.workspaceId);
      items.push({
        id: `sig-${s.id}`,
        icon: s.severity === "red" ? AlertTriangle : s.severity === "amber" ? Zap : ShieldCheck,
        iconColor: s.severity === "red" ? "text-red-500" : s.severity === "amber" ? "text-amber-500" : "text-emerald-500",
        iconBg: s.severity === "red" ? "bg-red-50 dark:bg-red-900/30" : s.severity === "amber" ? "bg-amber-50 dark:bg-amber-900/30" : "bg-emerald-50 dark:bg-emerald-900/30",
        label: s.severity === "red" ? "Escalation triggered" : s.severity === "amber" ? "Warning signal" : "Info signal",
        detail: `${ws?.customerName || "Unknown"} — ${s.message.slice(0, 50)}…`,
        timestamp: s.createdAt,
        workspaceId: s.workspaceId,
      });
    });

    // From approvals
    approvals.forEach(a => {
      const ws = workspaces.find(w => w.id === a.workspaceId);
      items.push({
        id: `apr-${a.id}`,
        icon: a.decision === "approved" ? CheckCircle2 : a.decision === "rejected" ? XCircle : Clock,
        iconColor: a.decision === "approved" ? "text-emerald-500" : a.decision === "rejected" ? "text-red-500" : "text-amber-500",
        iconBg: a.decision === "approved" ? "bg-emerald-50 dark:bg-emerald-900/30" : a.decision === "rejected" ? "bg-red-50 dark:bg-red-900/30" : "bg-amber-50 dark:bg-amber-900/30",
        label: `${a.entityType.charAt(0).toUpperCase() + a.entityType.slice(1)} ${a.decision}`,
        detail: `${a.approverName} — ${ws?.customerName || "Unknown"} · ${a.reason.slice(0, 40)}`,
        timestamp: a.timestamp.split("T")[0],
        workspaceId: a.workspaceId,
      });
    });

    // From workspace stage changes (use updatedAt as proxy)
    workspaces
      .filter(w => ["contract_sent", "contract_signed", "proposal_active", "negotiation"].includes(w.stage))
      .forEach(w => {
        const stageLabels: Record<string, string> = {
          contract_sent: "Contract sent",
          contract_signed: "Contract signed",
          proposal_active: "Proposal activated",
          negotiation: "Entered negotiation",
        };
        items.push({
          id: `ws-${w.id}`,
          icon: w.stage === "contract_signed" ? FileCheck : w.stage === "contract_sent" ? Send : FileText,
          iconColor: w.stage === "contract_signed" ? "text-emerald-500" : "text-blue-500",
          iconBg: w.stage === "contract_signed" ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-blue-50 dark:bg-blue-900/30",
          label: stageLabels[w.stage] || w.stage,
          detail: `${w.customerName} — ${w.title}`,
          timestamp: w.updatedAt,
          workspaceId: w.id,
        });
      });

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [workspaces, signals, approvals]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Commercial Activity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Recent events across all workspaces</p>
      </div>
      <div className="space-y-1">
        {activities.map(a => {
          const Icon = a.icon;
          const content = (
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${a.iconBg}`}>
                <Icon className={`w-3.5 h-3.5 ${a.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">{a.label}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{a.timestamp}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.detail}</p>
              </div>
            </div>
          );
          if (a.workspaceId) {
            return <Link key={a.id} href={`/workspaces/${a.workspaceId}`}>{content}</Link>;
          }
          return <div key={a.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
