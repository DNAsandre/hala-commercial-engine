/**
 * GlobalCRMSyncIndicator — Header bar CRM sync status
 * 
 * Replaces the hardcoded "CRM Sync: 2 min ago" text in DashboardLayout.
 * Fetches the latest CRM connection and displays real last-sync time.
 * Polls every 30 seconds for freshness.
 */

import { useState, useEffect, useRef } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Unplug, Loader2 } from "lucide-react";
import { fetchConnections, type CRMConnection } from "@/lib/crm-sync-engine";

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

export default function GlobalCRMSyncIndicator() {
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const conns = await fetchConnections();
        if (!cancelled) setConnections(conns);
      } catch {
        // Silent — header should never crash
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    pollRef.current = setInterval(load, 30_000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>CRM Sync: <span className="text-foreground font-medium">checking…</span></span>
      </div>
    );
  }

  const activeConns = connections.filter(c => c.enabled);
  if (activeConns.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Unplug className="w-3.5 h-3.5" />
        <span>CRM Sync: <span className="text-foreground font-medium">No connections</span></span>
      </div>
    );
  }

  // Find the most recent sync across all active connections
  const latestSync = activeConns
    .filter(c => c.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())[0];

  const hasFailure = activeConns.some(c => c.health_status === "disconnected");
  const hasDegraded = activeConns.some(c => c.health_status === "degraded");
  const allConnected = activeConns.every(c => c.health_status === "connected");

  const Icon = hasFailure ? XCircle : hasDegraded ? AlertTriangle : allConnected ? CheckCircle2 : RefreshCw;
  const iconColor = hasFailure ? "text-red-500" : hasDegraded ? "text-amber-500" : allConnected ? "text-emerald-500" : "text-muted-foreground";
  const timeText = latestSync ? formatTimeAgo(latestSync.last_sync_at) : "Never";

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      <span>CRM Sync: <span className="text-foreground font-medium">{timeText}</span></span>
    </div>
  );
}
