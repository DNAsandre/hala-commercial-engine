/**
 * Sprint 13 — CRM Dashboard Widget
 * Compact CRM health indicator for the main Dashboard.
 * Shows connection status, sync stats, and links to full CRM Sync Console.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Clock, Loader2, Unplug, ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchConnections, getSyncHealthStats,
  type CRMConnection, type SyncHealthStats,
} from "@/lib/crm-sync-engine";

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

const healthColors: Record<string, string> = {
  connected: "text-emerald-600",
  degraded: "text-amber-600",
  disconnected: "text-red-600",
  configuring: "text-blue-600",
};

const healthIcons: Record<string, React.ElementType> = {
  connected: CheckCircle2,
  degraded: AlertTriangle,
  disconnected: XCircle,
  configuring: Loader2,
};

export default function CRMDashboardWidget() {
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  const [stats, setStats] = useState<SyncHealthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const guardedLoad = async () => {
      try {
        const conns = await fetchConnections();
        if (cancelled) return;
        setConnections(conns);
        const s = getSyncHealthStats();
        setStats(s);
      } catch (err) {
        console.warn('[CRMDashboardWidget] loadData fallback:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    guardedLoad();
    const interval = setInterval(guardedLoad, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <Card className="border border-border shadow-none">
        <CardContent className="p-5 flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const activeConns = connections.filter(c => c.enabled);
  const connectedCount = activeConns.filter(c => c.health_status === "connected").length;
  const hasFailures = (stats?.failed ?? 0) > 0;
  const hasRetrying = (stats?.retrying ?? 0) > 0;

  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-blue-600" />
            CRM Sync
          </CardTitle>
          <Link href="/crm-sync-console">
            <span className="text-xs text-primary hover:underline flex items-center gap-1">
              Console <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Connection Status */}
        <div className="space-y-2">
          {connections.map(conn => {
            const StatusIcon = healthIcons[conn.health_status] || Unplug;
            return (
              <div key={conn.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-3.5 h-3.5 ${healthColors[conn.health_status] || "text-muted-foreground"} ${conn.health_status === "configuring" ? "animate-spin" : ""}`} />
                  <span className="text-sm">{conn.provider === "zoho" ? "Zoho CRM" : "DNA Supersystems"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {conn.enabled ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Disabled
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground data-value">
                    {formatTimeAgo(conn.last_sync_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <div className="text-center">
              <p className="text-lg font-bold data-value text-emerald-600">{stats.success}</p>
              <p className="text-[10px] text-muted-foreground">Synced</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold data-value ${stats.pending + stats.retrying > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {stats.pending + stats.retrying}
              </p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold data-value ${stats.failed > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {stats.failed}
              </p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
          </div>
        )}

        {/* Alerts */}
        {hasFailures && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="text-xs text-red-700">{stats?.failed} sync failures — check CRM Console</span>
          </div>
        )}
        {hasRetrying && !hasFailures && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-spin" />
            <span className="text-xs text-amber-700">{stats?.retrying} events retrying</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
