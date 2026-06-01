/**
 * CRM Sync Console — DNA Super Systems Integration
 * 
 * Professional admin page for managing the GHL CRM integration.
 * Connects to real backend API endpoints for live data.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowUpDown, ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle2, XCircle,
  Clock, AlertTriangle, Zap, Plug, Activity, Table2, Loader2, Shield,
  ChevronDown, ChevronRight, Wifi, WifiOff, Database, GitBranch, ExternalLink
} from "lucide-react";
import { api } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SyncStatus {
  entityMap: { contacts: StatusCounts; opportunities: StatusCounts; businesses: StatusCounts };
  recentActivity: { total: number; success: number; failed: number; lastInbound: string | null; lastOutbound: string | null };
  config: { sync_enabled: boolean; location_id: string; sync_direction: string; webhook_url: string | null; last_health_check_at: string | null };
}

interface StatusCounts { active: number; pending: number; error: number; deleted: number }

interface EntityMapRow {
  id: string; ghl_entity_type: string; ghl_entity_id: string; hala_entity_type: string;
  hala_entity_id: string; ghl_contact_id: string | null; ghl_opportunity_id: string | null;
  ghl_business_id: string | null; sync_status: string; last_synced_at: string;
  metadata: Record<string, any>; created_at: string;
}

interface SyncLogRow {
  id: string; direction: string; event_type: string; ghl_entity_type: string;
  ghl_entity_id: string; hala_entity_id: string; status: string;
  request_payload: any; response_payload: any; error: string | null;
  idempotency_key: string; webhook_id: string | null; created_at: string; processed_at: string | null;
}

interface Pipeline { id: string; name: string; stages: { id: string; name: string; position: number }[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function statusColor(s: string) {
  return s === "success" ? "text-emerald-400" : s === "failed" ? "text-red-400" :
    s === "processing" ? "text-cyan-400" : s === "pending" ? "text-blue-400" :
    s === "skipped" ? "text-zinc-500" : "text-zinc-400";
}

function statusVariant(s: string): "default" | "destructive" | "secondary" | "outline" {
  return s === "success" ? "default" : s === "failed" ? "destructive" : s === "processing" ? "secondary" : "outline";
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CRMSyncConsole() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [entityMap, setEntityMap] = useState<EntityMapRow[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Filters
  const [logDirection, setLogDirection] = useState("all");
  const [logStatus, setLogStatus] = useState("all");
  const [mapEntityType, setMapEntityType] = useState("all");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, mapRes, logsRes] = await Promise.all([
        api.ghlSync.status().catch(() => ({ data: null })),
        api.ghlSync.entityMap({ limit: 100 }).catch(() => ({ data: { entityMap: [] } })),
        api.ghlSync.syncLog({ limit: 100 }).catch(() => ({ data: { logs: [] } })),
      ]);
      setSyncStatus(statusRes.data || statusRes);
      setEntityMap((mapRes.data?.entityMap || mapRes.entityMap) ?? []);
      setSyncLogs((logsRes.data?.logs || logsRes.logs) ?? []);
    } catch (err) {
      console.error("[CRM Sync] Load error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await api.ghlSync.testConnection();
      const d = res.data || res;
      setConnectionOk(d.ok);
      setLatencyMs(d.latencyMs);
      toast(d.ok ? "Connection Successful" : "Connection Failed", { description: `${d.message} (${d.latencyMs}ms)` });
    } catch (err: any) {
      setConnectionOk(false);
      toast.error("Connection Failed", { description: err.message });
    }
    setTesting(false);
  };

  const handleLoadPipelines = async () => {
    try {
      const res = await api.ghlSync.pipelines();
      const p = res.data?.pipelines || res.pipelines || [];
      setPipelines(p);
      toast.success(`Loaded ${p.length} pipelines`);
    } catch (err: any) {
      toast.error("Failed to load pipelines", { description: err.message });
    }
  };

  // Filtered logs
  const filteredLogs = syncLogs.filter(l => {
    if (logDirection !== "all" && l.direction !== logDirection) return false;
    if (logStatus !== "all" && l.status !== logStatus) return false;
    return true;
  });

  const filteredMap = entityMap.filter(m => {
    if (mapEntityType !== "all" && m.ghl_entity_type !== mapEntityType) return false;
    return true;
  });

  const stats = syncStatus?.entityMap;
  const activity = syncStatus?.recentActivity;
  const totalMapped = stats ? (stats.contacts.active + stats.opportunities.active + stats.businesses.active) : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
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
            Bi-directional integration — DNA Super Systems (GoHighLevel)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Connection Status Card */}
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${connectionOk === true ? "bg-emerald-500/10" : connectionOk === false ? "bg-red-500/10" : "bg-zinc-800"}`}>
                {connectionOk === true ? <Wifi className="w-6 h-6 text-emerald-400" /> :
                 connectionOk === false ? <WifiOff className="w-6 h-6 text-red-400" /> :
                 <Plug className="w-6 h-6 text-zinc-500" />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">DNA Super Systems</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Private Integration — services.leadconnectorhq.com</p>
                <div className="flex items-center gap-4 mt-2">
                  {connectionOk !== null && (
                    <Badge variant={connectionOk ? "default" : "destructive"} className="text-xs">
                      {connectionOk ? "✓ Connected" : "✗ Disconnected"}
                    </Badge>
                  )}
                  {latencyMs > 0 && (
                    <span className="text-xs text-zinc-500">Latency: <span className="text-cyan-400">{latencyMs}ms</span></span>
                  )}
                  <span className="text-xs text-zinc-500">API: <span className="text-zinc-400">v2023-02-21</span></span>
                  <span className="text-xs text-zinc-500">Auth: <span className="text-zinc-400">Bearer Token</span></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing} className="gap-1 text-xs">
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Test Connection
              </Button>
              <Button variant="outline" size="sm" onClick={handleLoadPipelines} className="gap-1 text-xs">
                <GitBranch className="w-3 h-3" /> Load Pipelines
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-6 gap-3 mt-4 pt-4 border-t border-zinc-800">
            <MiniStat label="Mapped Entities" value={totalMapped} color="text-zinc-200" />
            <MiniStat label="Contacts" value={stats?.contacts.active ?? 0} color="text-emerald-400" />
            <MiniStat label="Opportunities" value={stats?.opportunities.active ?? 0} color="text-cyan-400" />
            <MiniStat label="Sync Success" value={activity?.success ?? 0} color="text-emerald-400" />
            <MiniStat label="Sync Failed" value={activity?.failed ?? 0} color="text-red-400" />
            <MiniStat label="Last Inbound" value={timeAgo(activity?.lastInbound ?? null)} color="text-amber-400" />
          </div>
        </CardContent>
      </Card>

      {/* Pipelines (if loaded) */}
      {pipelines.length > 0 && (
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-cyan-400" /> GHL Pipelines
              <Badge variant="outline" className="text-xs">{pipelines.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pipelines.map(p => (
                <div key={p.id} className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-sm font-medium text-zinc-200">{p.name}</p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{p.id}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.stages.map(s => (
                      <Badge key={s.id} variant="outline" className="text-[10px] text-zinc-400">{s.name}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="entity-map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entity-map" className="gap-1"><Table2 className="w-3.5 h-3.5" /> Entity Map</TabsTrigger>
          <TabsTrigger value="sync-log" className="gap-1"><Activity className="w-3.5 h-3.5" /> Sync Log</TabsTrigger>
        </TabsList>

        {/* ─── Entity Map Tab ─── */}
        <TabsContent value="entity-map" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={mapEntityType} onValueChange={setMapEntityType}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Entity Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-zinc-500 ml-auto">{filteredMap.length} mappings</span>
          </div>

          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-400 text-xs">
                  <th className="p-2 text-left">GHL Type</th>
                  <th className="p-2 text-left">GHL Entity ID</th>
                  <th className="p-2 text-center">→</th>
                  <th className="p-2 text-left">Hala Type</th>
                  <th className="p-2 text-left">Hala Entity ID</th>
                  <th className="p-2 text-left">Cross-Ref IDs</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Last Synced</th>
                </tr>
              </thead>
              <tbody>
                {filteredMap.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-zinc-600">
                    <Database className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    No entity mappings yet — sync events from GHL will appear here
                  </td></tr>
                )}
                {filteredMap.map(m => (
                  <tr key={m.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{m.ghl_entity_type}</Badge>
                    </td>
                    <td className="p-2 text-xs text-zinc-300 font-mono">{m.ghl_entity_id.slice(0, 12)}…</td>
                    <td className="p-2 text-center"><ArrowUpRight className="w-3 h-3 text-zinc-600 inline" /></td>
                    <td className="p-2">
                      <Badge variant="secondary" className="text-[10px]">{m.hala_entity_type}</Badge>
                    </td>
                    <td className="p-2 text-xs text-zinc-300 font-mono">{m.hala_entity_id.slice(0, 12)}…</td>
                    <td className="p-2 text-[10px] text-zinc-500">
                      {m.ghl_contact_id && <span className="mr-2">C: {m.ghl_contact_id.slice(0, 8)}</span>}
                      {m.ghl_opportunity_id && <span className="mr-2">O: {m.ghl_opportunity_id.slice(0, 8)}</span>}
                      {m.ghl_business_id && <span>B: {m.ghl_business_id.slice(0, 8)}</span>}
                    </td>
                    <td className="p-2">
                      <Badge variant={m.sync_status === "active" ? "default" : m.sync_status === "deleted" ? "destructive" : "outline"} className="text-[10px]">
                        {m.sync_status}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-zinc-500">{timeAgo(m.last_synced_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ─── Sync Log Tab ─── */}
        <TabsContent value="sync-log" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={logDirection} onValueChange={setLogDirection}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Direction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logStatus} onValueChange={setLogStatus}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-zinc-500 ml-auto">{filteredLogs.length} events</span>
          </div>

          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-400 text-xs">
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Direction</th>
                  <th className="p-2 text-left">Event</th>
                  <th className="p-2 text-left">Entity</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Error</th>
                  <th className="p-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-zinc-600">
                    <Shield className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    No sync events recorded yet
                  </td></tr>
                )}
                {filteredLogs.map(log => {
                  const isExpanded = expandedLogs.has(log.id);
                  return (
                    <LogRow key={log.id} log={log} isExpanded={isExpanded}
                      onToggle={() => setExpandedLogs(prev => {
                        const next = new Set(prev);
                        next.has(log.id) ? next.delete(log.id) : next.add(log.id);
                        return next;
                      })}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function LogRow({ log, isExpanded, onToggle }: { log: SyncLogRow; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-t border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer" onClick={onToggle}>
        <td className="p-2">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
        </td>
        <td className="p-2">
          {log.direction === "inbound" ? (
            <span className="flex items-center gap-1 text-xs text-amber-400"><ArrowDownLeft className="w-3 h-3" /> Inbound</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-cyan-400"><ArrowUpRight className="w-3 h-3" /> Outbound</span>
          )}
        </td>
        <td className="p-2 text-xs text-zinc-300">{log.event_type}</td>
        <td className="p-2 text-xs text-zinc-400">
          <Badge variant="outline" className="text-[10px]">{log.ghl_entity_type}</Badge>
        </td>
        <td className="p-2">
          <Badge variant={statusVariant(log.status)} className="text-xs">{log.status.toUpperCase()}</Badge>
        </td>
        <td className="p-2 text-xs text-red-400 max-w-[200px] truncate">{log.error || "—"}</td>
        <td className="p-2 text-xs text-zinc-500">{timeAgo(log.created_at)}</td>
      </tr>
      {isExpanded && (
        <tr className="bg-zinc-900/40">
          <td colSpan={7} className="p-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-zinc-500 mb-1 font-medium">Request Payload</p>
                <pre className="bg-zinc-950 rounded p-2 text-zinc-400 overflow-x-auto max-h-32 text-[11px]">
                  {JSON.stringify(log.request_payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-zinc-500 mb-1 font-medium">Response</p>
                <pre className="bg-zinc-950 rounded p-2 text-zinc-400 overflow-x-auto max-h-32 text-[11px]">
                  {log.response_payload ? JSON.stringify(log.response_payload, null, 2) : "—"}
                </pre>
              </div>
              <div className="col-span-2 flex gap-6 text-zinc-600">
                <span>ID: {log.id}</span>
                <span>Idempotency: {log.idempotency_key}</span>
                {log.webhook_id && <span>Webhook: {log.webhook_id}</span>}
                {log.processed_at && <span>Processed: {new Date(log.processed_at).toLocaleString()}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
