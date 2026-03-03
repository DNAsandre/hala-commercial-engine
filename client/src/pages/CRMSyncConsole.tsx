/**
 * Sprint 12 — CRM Sync Console
 * 
 * Admin page for managing CRM connections (Zoho + GHL),
 * viewing sync events, retrying failures, and monitoring health.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowUpDown, ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle2, XCircle,
  Clock, AlertTriangle, Zap, RotateCcw, Plug, Unplug, Activity, GitCompare,
  Table2, ArrowRight, Loader2, Shield, ChevronDown, ChevronRight
} from "lucide-react";
import {
  fetchConnections, fetchSyncEvents, getSyncHealthStats, fetchFieldMappings, fetchConflicts,
  toggleConnection, testConnection, manualRetry, bulkResync,
  type CRMConnection, type HardenedSyncEvent, type CRMFieldMapping, type ConflictRecord,
  type SyncDirection, type SyncStatus, type SyncEntityType, type SyncHealthStats
} from "@/lib/crm-sync-engine";

// ============================================================
// STATUS HELPERS
// ============================================================

function statusColor(status: SyncStatus): string {
  switch (status) {
    case "success": return "text-emerald-400";
    case "failed": return "text-red-400";
    case "retrying": return "text-amber-400";
    case "pending": return "text-blue-400";
    case "processing": return "text-cyan-400";
    case "conflict_resolved": return "text-purple-400";
    case "skipped": return "text-zinc-500";
    default: return "text-zinc-400";
  }
}

function statusBadge(status: SyncStatus) {
  const variants: Record<SyncStatus, "default" | "secondary" | "destructive" | "outline"> = {
    success: "default",
    failed: "destructive",
    retrying: "secondary",
    pending: "outline",
    processing: "outline",
    conflict_resolved: "secondary",
    skipped: "outline",
  };
  return (
    <Badge variant={variants[status] || "outline"} className="text-xs">
      {status.replace("_", " ").toUpperCase()}
    </Badge>
  );
}

function healthBadge(status: CRMConnection["health_status"]) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    connected: { color: "text-emerald-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    degraded: { color: "text-amber-400", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    disconnected: { color: "text-red-400", icon: <XCircle className="w-3.5 h-3.5" /> },
    configuring: { color: "text-blue-400", icon: <Clock className="w-3.5 h-3.5" /> },
  };
  const { color, icon } = map[status] || map.disconnected;
  return (
    <span className={`flex items-center gap-1 ${color} text-xs font-medium`}>
      {icon} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function providerLogo(provider: string) {
  if (provider === "zoho") return "🟠";
  if (provider === "ghl") return "🟢";
  return "⚪";
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CRMSyncConsole() {
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  const [events, setEvents] = useState<HardenedSyncEvent[]>([]);
  const [mappings, setMappings] = useState<CRMFieldMapping[]>([]);
  const [conflictRecords, setConflicts] = useState<ConflictRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  // Filters
  const [filterDirection, setFilterDirection] = useState<SyncDirection | "all">("all");
  const [filterStatus, setFilterStatus] = useState<SyncStatus | "all">("all");
  const [filterEntity, setFilterEntity] = useState<SyncEntityType | "all">("all");
  const [filterConnection, setFilterConnection] = useState<string>("all");

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [conns, evts, maps, confs] = await Promise.all([
      fetchConnections(),
      fetchSyncEvents(),
      fetchFieldMappings(),
      Promise.resolve(fetchConflicts()),
    ]);
    setConnections(conns);
    setEvents(evts);
    setMappings(maps);
    setConflicts(confs);
    setLoading(false);
  }

  // Health stats per connection + overall
  const overallStats = useMemo(() => getSyncHealthStats(), [events]);
  const connStats = useMemo(() => {
    const map: Record<string, SyncHealthStats> = {};
    for (const c of connections) {
      map[c.id] = getSyncHealthStats(c.id);
    }
    return map;
  }, [connections, events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (filterDirection !== "all") result = result.filter((e) => e.direction === filterDirection);
    if (filterStatus !== "all") result = result.filter((e) => e.status === filterStatus);
    if (filterEntity !== "all") result = result.filter((e) => e.entity_type === filterEntity);
    if (filterConnection !== "all") result = result.filter((e) => e.connection_id === filterConnection);
    return result;
  }, [events, filterDirection, filterStatus, filterEntity, filterConnection]);

  async function handleTestConnection(connId: string) {
    setTestingId(connId);
    const result = await testConnection(connId);
    setTestingId(null);
    toast(result.success ? "Connection OK" : "Connection Failed", {
      description: `${result.message} (${result.latency_ms}ms)`,
    });
    await loadData();
  }

  async function handleToggle(connId: string, enabled: boolean) {
    await toggleConnection(connId, enabled);
    toast(enabled ? "Connection Enabled" : "Connection Disabled");
    await loadData();
  }

  async function handleManualRetry(eventId: string) {
    setRetryingId(eventId);
    const result = await manualRetry(eventId);
    setRetryingId(null);
    if (result) {
      toast(result.status === "success" ? "Retry Succeeded" : "Retry Scheduled", {
        description: result.status === "success" ? "Event synced successfully" : `Status: ${result.status}`,
      });
    }
    await loadData();
  }

  async function handleBulkResync(connId: string) {
    setResyncingId(connId);
    const result = await bulkResync(connId);
    setResyncingId(null);
    toast("Bulk Resync", { description: `${result.queued} events queued for resync` });
    await loadData();
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <ArrowUpDown className="w-6 h-6 text-cyan-400" />
            CRM Sync Console
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Bi-directional CRM integration — Zoho CRM + GoHighLevel
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Health Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total Events" value={overallStats.total_events} icon={<Activity className="w-4 h-4 text-zinc-400" />} />
        <StatCard label="Pending" value={overallStats.pending} icon={<Clock className="w-4 h-4 text-blue-400" />} color="text-blue-400" />
        <StatCard label="Success" value={overallStats.success} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} color="text-emerald-400" />
        <StatCard label="Failed" value={overallStats.failed} icon={<XCircle className="w-4 h-4 text-red-400" />} color="text-red-400" />
        <StatCard label="Retrying" value={overallStats.retrying} icon={<RotateCcw className="w-4 h-4 text-amber-400" />} color="text-amber-400" />
        <StatCard label="Conflicts" value={overallStats.conflict_resolved} icon={<GitCompare className="w-4 h-4 text-purple-400" />} color="text-purple-400" />
        <StatCard label="Avg Latency" value={`${overallStats.avg_latency_ms}ms`} icon={<Zap className="w-4 h-4 text-cyan-400" />} color="text-cyan-400" />
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections" className="gap-1"><Plug className="w-3.5 h-3.5" /> Connections</TabsTrigger>
          <TabsTrigger value="events" className="gap-1"><Activity className="w-3.5 h-3.5" /> Sync Events</TabsTrigger>
          <TabsTrigger value="mappings" className="gap-1"><Table2 className="w-3.5 h-3.5" /> Field Mappings</TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-1"><GitCompare className="w-3.5 h-3.5" /> Conflicts</TabsTrigger>
        </TabsList>

        {/* ============ CONNECTIONS TAB ============ */}
        <TabsContent value="connections" className="space-y-4">
          {connections.map((conn) => {
            const stats = connStats[conn.id];
            return (
              <Card key={conn.id} className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{providerLogo(conn.provider)}</span>
                      <div>
                        <h3 className="text-base font-semibold text-zinc-100">{conn.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{conn.base_url}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {healthBadge(conn.health_status)}
                          <span className="text-xs text-zinc-500">
                            Auth: <span className="text-zinc-400">{conn.auth_method}</span>
                          </span>
                          <span className="text-xs text-zinc-500">
                            Interval: <span className="text-zinc-400">{conn.sync_interval_minutes}m</span>
                          </span>
                          <span className="text-xs text-zinc-500">
                            Last sync: <span className="text-zinc-400">{timeAgo(conn.last_sync_at)}</span>
                          </span>
                        </div>
                        {conn.config?.migration_mode && (
                          <Badge variant="outline" className="mt-2 text-xs text-amber-400 border-amber-800">
                            Migration Mode — auto-triggers disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(conn.id)}
                        disabled={testingId === conn.id}
                        className="gap-1 text-xs"
                      >
                        {testingId === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkResync(conn.id)}
                        disabled={resyncingId === conn.id || !conn.enabled}
                        className="gap-1 text-xs"
                      >
                        {resyncingId === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Resync Failed
                      </Button>
                      <Button
                        variant={conn.enabled ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleToggle(conn.id, !conn.enabled)}
                        className="gap-1 text-xs"
                      >
                        {conn.enabled ? <><Unplug className="w-3 h-3" /> Disable</> : <><Plug className="w-3 h-3" /> Enable</>}
                      </Button>
                    </div>
                  </div>

                  {/* Connection stats */}
                  {stats && (
                    <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-zinc-800">
                      <MiniStat label="Success" value={stats.success} color="text-emerald-400" />
                      <MiniStat label="Failed" value={stats.failed} color="text-red-400" />
                      <MiniStat label="Retrying" value={stats.retrying} color="text-amber-400" />
                      <MiniStat label="Pending" value={stats.pending} color="text-blue-400" />
                      <MiniStat label="Avg Latency" value={`${stats.avg_latency_ms}ms`} color="text-cyan-400" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ============ SYNC EVENTS TAB ============ */}
        <TabsContent value="events" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={filterConnection} onValueChange={(v) => setFilterConnection(v)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Connection" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Connections</SelectItem>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDirection} onValueChange={(v) => setFilterDirection(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Direction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="retrying">Retrying</SelectItem>
                <SelectItem value="conflict_resolved">Conflict</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={(v) => setFilterEntity(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="deal">Deal</SelectItem>
                <SelectItem value="deal_stage">Deal Stage</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
                <SelectItem value="attachment">Attachment</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-zinc-500 ml-auto">{filteredEvents.length} events</span>
          </div>

          {/* Events Table */}
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-400 text-xs">
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Provider</th>
                  <th className="p-2 text-left">Direction</th>
                  <th className="p-2 text-left">Entity</th>
                  <th className="p-2 text-left">Trigger</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Retries</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-zinc-600">No sync events match filters</td></tr>
                )}
                {filteredEvents.map((event) => {
                  const conn = connections.find((c) => c.id === event.connection_id);
                  const isExpanded = expandedRows.has(event.id);
                  return (
                    <EventRow
                      key={event.id}
                      event={event}
                      conn={conn}
                      isExpanded={isExpanded}
                      onToggle={() => toggleRow(event.id)}
                      onRetry={() => handleManualRetry(event.id)}
                      retrying={retryingId === event.id}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ============ FIELD MAPPINGS TAB ============ */}
        <TabsContent value="mappings" className="space-y-4">
          {connections.map((conn) => {
            const connMappings = mappings.filter((m) => m.connection_id === conn.id);
            if (connMappings.length === 0) return null;
            return (
              <Card key={conn.id} className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    {providerLogo(conn.provider)} {conn.name} — Field Mappings
                    <Badge variant="outline" className="text-xs">{connMappings.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-900/80 text-zinc-400">
                          <th className="p-2 text-left">Local Table</th>
                          <th className="p-2 text-left">Local Field</th>
                          <th className="p-2 text-center"><ArrowRight className="w-3 h-3 inline" /></th>
                          <th className="p-2 text-left">CRM Field</th>
                          <th className="p-2 text-left">Direction</th>
                          <th className="p-2 text-left">Transform</th>
                          <th className="p-2 text-center">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {connMappings.map((m) => (
                          <tr key={m.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                            <td className="p-2 text-zinc-400 font-mono">{m.local_table}</td>
                            <td className="p-2 text-zinc-300 font-mono">{m.local_field}</td>
                            <td className="p-2 text-center">
                              {m.direction === "both" ? <ArrowUpDown className="w-3 h-3 text-zinc-500 inline" /> :
                               m.direction === "outbound" ? <ArrowUpRight className="w-3 h-3 text-cyan-500 inline" /> :
                               <ArrowDownLeft className="w-3 h-3 text-amber-500 inline" />}
                            </td>
                            <td className="p-2 text-zinc-300 font-mono">{m.crm_field}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-xs">{m.direction}</Badge>
                            </td>
                            <td className="p-2 text-zinc-500 font-mono">{m.transform || "—"}</td>
                            <td className="p-2 text-center">
                              {m.active ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /> : <XCircle className="w-3.5 h-3.5 text-red-400 inline" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ============ CONFLICTS TAB ============ */}
        <TabsContent value="conflicts" className="space-y-4">
          {conflictRecords.length === 0 ? (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-8 text-center">
                <Shield className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No conflicts recorded</p>
                <p className="text-zinc-600 text-xs mt-1">Conflicts are logged when inbound and local data have competing timestamps</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 text-xs">
                    <th className="p-2 text-left">Entity</th>
                    <th className="p-2 text-left">Local Updated</th>
                    <th className="p-2 text-left">CRM Updated</th>
                    <th className="p-2 text-left">Resolution</th>
                    <th className="p-2 text-left">Detail</th>
                    <th className="p-2 text-left">Resolved At</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictRecords.map((c) => (
                    <tr key={c.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="p-2">
                        <span className="text-zinc-300 text-xs">{c.entity_type}</span>
                        <span className="text-zinc-500 text-xs ml-1">({c.entity_id})</span>
                      </td>
                      <td className="p-2 text-xs text-zinc-400 font-mono">{new Date(c.local_updated_at).toLocaleString()}</td>
                      <td className="p-2 text-xs text-zinc-400 font-mono">{new Date(c.crm_updated_at).toLocaleString()}</td>
                      <td className="p-2">
                        <Badge variant={c.resolution === "local_wins" ? "default" : "secondary"} className="text-xs">
                          {c.resolution === "local_wins" ? "Local Wins" : c.resolution === "crm_wins" ? "CRM Wins" : "Manual"}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-zinc-500 max-w-xs truncate">{c.detail}</td>
                      <td className="p-2 text-xs text-zinc-500">{new Date(c.resolved_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color?: string }) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-zinc-500">{label}</span></div>
        <p className={`text-lg font-bold ${color || "text-zinc-200"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function EventRow({
  event, conn, isExpanded, onToggle, onRetry, retrying,
}: {
  event: HardenedSyncEvent;
  conn?: CRMConnection;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <>
      <tr className="border-t border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer" onClick={onToggle}>
        <td className="p-2">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
        </td>
        <td className="p-2">
          <span className="text-xs">{providerLogo(conn?.provider || "")} {conn?.provider?.toUpperCase() || "?"}</span>
        </td>
        <td className="p-2">
          {event.direction === "outbound" ? (
            <span className="flex items-center gap-1 text-xs text-cyan-400"><ArrowUpRight className="w-3 h-3" /> Out</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400"><ArrowDownLeft className="w-3 h-3" /> In</span>
          )}
        </td>
        <td className="p-2 text-xs text-zinc-300">{event.entity_type}</td>
        <td className="p-2 text-xs text-zinc-400">{event.trigger}</td>
        <td className="p-2">{statusBadge(event.status)}</td>
        <td className="p-2 text-xs text-zinc-400">
          {event.retry_count > 0 ? `${event.retry_count}/${event.max_retries}` : "—"}
        </td>
        <td className="p-2 text-xs text-zinc-500">{timeAgo(event.created_at)}</td>
        <td className="p-2" onClick={(e) => e.stopPropagation()}>
          {(event.status === "failed" || event.status === "retrying") && (
            <Button variant="ghost" size="sm" onClick={onRetry} disabled={retrying} className="h-6 px-2 text-xs gap-1">
              {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Retry
            </Button>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-zinc-900/40">
          <td colSpan={9} className="p-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-zinc-500 mb-1 font-medium">Payload</p>
                <pre className="bg-zinc-950 rounded p-2 text-zinc-400 overflow-x-auto max-h-32 text-[11px]">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-zinc-500 mb-1 font-medium">Response</p>
                <pre className="bg-zinc-950 rounded p-2 text-zinc-400 overflow-x-auto max-h-32 text-[11px]">
                  {event.response ? JSON.stringify(event.response, null, 2) : "—"}
                </pre>
              </div>
              {event.error && (
                <div className="col-span-2">
                  <p className="text-zinc-500 mb-1 font-medium">Error</p>
                  <p className="text-red-400 bg-red-950/30 rounded p-2">{event.error}</p>
                </div>
              )}
              {event.next_retry_at && (
                <div className="col-span-2">
                  <p className="text-zinc-500">
                    Next retry: <span className="text-amber-400">{new Date(event.next_retry_at).toLocaleString()}</span>
                  </p>
                </div>
              )}
              {event.conflict_detail && (
                <div className="col-span-2">
                  <p className="text-zinc-500 mb-1 font-medium">Conflict</p>
                  <p className="text-purple-400 bg-purple-950/30 rounded p-2">{event.conflict_detail}</p>
                </div>
              )}
              <div className="col-span-2 text-zinc-600">
                ID: {event.id} | Idempotency: {event.idempotency_key}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
