/**
 * Sprint 13 — CRM Sync Badge
 * Shows CRM sync status for a workspace entity.
 * Used in workspace cards, workspace detail header, and workspace list.
 */

import { useState } from "react";
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Loader2, Unplug, ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchSyncEvents, triggerOutboundSync,
  type HardenedSyncEvent, type SyncStatus,
} from "@/lib/crm-sync-engine";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface CRMSyncBadgeProps {
  workspaceId: string;
  workspaceTitle?: string;
  variant?: "badge" | "full"; // badge = compact, full = with sync button
  className?: string;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string; badgeClass: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-600", label: "Synced", badgeClass: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  pending: { icon: Clock, color: "text-amber-600", label: "Pending", badgeClass: "border-amber-300 text-amber-700 bg-amber-50" },
  processing: { icon: Loader2, color: "text-blue-600", label: "Syncing", badgeClass: "border-blue-300 text-blue-700 bg-blue-50" },
  failed: { icon: XCircle, color: "text-red-600", label: "Failed", badgeClass: "border-red-300 text-red-700 bg-red-50" },
  retrying: { icon: RefreshCw, color: "text-amber-600", label: "Retrying", badgeClass: "border-amber-300 text-amber-700 bg-amber-50" },
  conflict_resolved: { icon: ArrowUpDown, color: "text-blue-600", label: "Resolved", badgeClass: "border-blue-300 text-blue-700 bg-blue-50" },
  not_synced: { icon: Unplug, color: "text-muted-foreground", label: "Not Synced", badgeClass: "border-border text-muted-foreground" },
};

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function useCRMSyncStatus(workspaceId: string) {
  const [latestEvent, setLatestEvent] = useState<HardenedSyncEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const events = await fetchSyncEvents({
        entityType: "deal_stage",
        limit: 10,
      });
      // Find latest event for this workspace
      const wsEvents = events.filter(e =>
        e.entity_id === workspaceId ||
        e.entity_id === workspaceId.replace("w", "")
      );
      if (wsEvents.length > 0) {
        setLatestEvent(wsEvents[0]);
      } else {
        // Check broader entity types
        const allEvents = await fetchSyncEvents({ limit: 50 });
        const broader = allEvents.filter(e => e.entity_id === workspaceId);
        setLatestEvent(broader.length > 0 ? broader[0] : null);
      }
    } catch (err) {
      console.warn('[CRMSyncBadge] loadStatus fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  return { latestEvent, loading, loadStatus };
}

export default function CRMSyncBadge({ workspaceId, workspaceTitle, variant = "badge", className = "" }: CRMSyncBadgeProps) {
  const { user } = useAuth();
  const [latestEvent, setLatestEvent] = useState<HardenedSyncEvent | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useState(() => {
    (async () => {
      try {
        const events = await fetchSyncEvents({ limit: 50 });
        const wsEvents = events.filter(e => e.entity_id === workspaceId);
        if (wsEvents.length > 0) {
          setLatestEvent(wsEvents[0]);
        }
      } catch (err) { console.warn('[CRMSyncBadge] mount load fallback:', err); }
      setLoaded(true);
    })();
  });

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const events = await triggerOutboundSync({
        entityType: "workspace",
        entityId: workspaceId,
        trigger: "manual_push",
        payload: { title: workspaceTitle || workspaceId, action: "manual_sync" },
      });
      if (events.length > 0) {
        setLatestEvent(events[0]);
        toast.success("CRM sync triggered", {
          description: `${events.length} sync event(s) created for ${events.map(e => e.connection_id.replace("crm-conn-", "").toUpperCase()).join(", ")}`,
        });
      }
    } catch (err) {
      console.warn('[CRMSyncBadge] handleSyncNow fallback:', err);
      toast.error("Failed to trigger CRM sync");
    } finally {
      setSyncing(false);
    }
  };

  const status = latestEvent?.status || "not_synced";
  const config = statusConfig[status] || statusConfig.not_synced;
  const StatusIcon = config.icon;
  const isAdmin = user?.role === "admin";

  if (!loaded) {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> CRM</Badge>;
  }

  if (variant === "badge") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${config.badgeClass} ${className}`}>
            <StatusIcon className={`w-2.5 h-2.5 ${status === "processing" || status === "retrying" ? "animate-spin" : ""}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">CRM: {config.label}</p>
            {latestEvent && (
              <>
                <p className="text-muted-foreground">Provider: {latestEvent.connection_id.replace("crm-conn-", "")}</p>
                <p className="text-muted-foreground">Last sync: {formatTimeAgo(latestEvent.processed_at || latestEvent.created_at)}</p>
                {latestEvent.error && <p className="text-red-500">{latestEvent.error}</p>}
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Full variant with sync button
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${config.badgeClass}`}>
        <StatusIcon className={`w-2.5 h-2.5 ${status === "processing" || status === "retrying" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
      {latestEvent && (
        <span className="text-[10px] text-muted-foreground data-value">
          {formatTimeAgo(latestEvent.processed_at || latestEvent.created_at)}
        </span>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={handleSyncNow}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          Sync Now
        </Button>
      )}
    </div>
  );
}
