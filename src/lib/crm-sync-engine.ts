/**
 * crm-sync-engine.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.7).
 *
 * CRM sync surface:
 *  - READS come from established storage: connection configuration in the
 *    global system_settings row and historical events in crm_sync_events.
 *    No seed connections or fallback records are created.
 *  - OUTBOUND synchronization is honestly unavailable in this build:
 *    triggerOutboundSync throws instead of fabricating queued events,
 *    latency, or success.
 */

import { supabase } from "./supabase";
import { handleSupabaseError, setFetchError, clearFetchError } from "@/lib/supabase-error";
import { isCrmSyncEventReadEnabled } from "./process-isolation";

// ============================================================
// TYPES
// ============================================================

// Internal (non-exported) unions referenced by the exported interfaces.
type CRMProvider = "zoho" | "ghl" | "salesforce" | "hubspot" | "custom";
type CRMAuthMethod = "oauth2" | "api_key" | "bearer_token";
type CRMHealthStatus = "connected" | "degraded" | "disconnected" | "configuring";
type SyncDirection = "outbound" | "inbound";
type SyncEntityType = "workspace" | "customer" | "deal" | "deal_stage" | "quote" | "proposal" | "contact" | "attachment";
type OutboundTrigger = "stage_change" | "quote_status" | "proposal_approved" | "sla_ready" | "customer_created" | "customer_updated" | "contact_updated" | "manual_push";

export type SyncStatus = "pending" | "processing" | "success" | "failed" | "retrying" | "conflict_resolved" | "skipped";

export interface CRMConnection {
  id: string;
  provider: CRMProvider;
  name: string;
  base_url: string;
  enabled: boolean;
  auth_method: CRMAuthMethod;
  last_sync_at: string | null;
  health_status: CRMHealthStatus;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
  config: Record<string, any>;
}

export interface HardenedSyncEvent {
  id: string;
  connection_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  direction: SyncDirection;
  trigger: OutboundTrigger | "webhook" | "bulk_resync";
  status: SyncStatus;
  payload: Record<string, any>;
  response: Record<string, any> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  idempotency_key: string;
  created_at: string;
  processed_at: string | null;
  conflict_detail: string | null;
}

// Internal (non-exported): return shape of getSyncHealthStats.
interface SyncHealthStats {
  total_events: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
  retrying: number;
  conflict_resolved: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  avg_latency_ms: number;
}

const MAX_RETRIES = 5;

// ============================================================
// ROW MAPPERS
// ============================================================

function mapConnection(row: any): CRMConnection {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    base_url: row.base_url,
    enabled: row.enabled,
    auth_method: row.auth_method,
    last_sync_at: row.last_sync_at,
    health_status: row.health_status,
    sync_interval_minutes: row.sync_interval_minutes || 15,
    created_at: row.created_at,
    updated_at: row.updated_at,
    config: row.config || {},
  };
}

function asEntityType(value: unknown): SyncEntityType {
  const normalized = String(value || "deal").trim().toLowerCase().replace(/\s+/g, "_");
  const allowed: SyncEntityType[] = ["workspace", "customer", "deal", "deal_stage", "quote", "proposal", "contact", "attachment"];
  return allowed.includes(normalized as SyncEntityType) ? normalized as SyncEntityType : "deal";
}

function mapLegacySyncEvent(row: any): HardenedSyncEvent {
  const direction: SyncDirection = row.direction === "inbound" ? "inbound" : "outbound";
  const status = String(row.status || "pending") as SyncStatus;
  const timestamp = row.timestamp || "";
  return {
    id: row.id,
    connection_id: "legacy-zoho",
    entity_type: asEntityType(row.entity),
    entity_id: row.zoho_id || row.id,
    direction,
    trigger: direction === "inbound" ? "webhook" : "manual_push",
    status,
    payload: { zoho_id: row.zoho_id || null, details: row.details || "" },
    response: status === "success" ? { details: row.details || "" } : null,
    error: status === "failed" ? row.details || "CRM event failed" : null,
    retry_count: 0,
    max_retries: MAX_RETRIES,
    next_retry_at: null,
    idempotency_key: row.id,
    created_at: timestamp,
    processed_at: status === "success" ? timestamp : null,
    conflict_detail: null,
  };
}

function mapSyncEvent(row: any): HardenedSyncEvent {
  return {
    id: row.id,
    connection_id: row.connection_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    direction: row.direction,
    trigger: row.trigger_source || row.trigger,
    status: row.status,
    payload: row.payload || {},
    response: row.response,
    error: row.error,
    retry_count: row.retry_count || 0,
    max_retries: row.max_retries || MAX_RETRIES,
    next_retry_at: row.next_retry_at,
    idempotency_key: row.idempotency_key || "",
    created_at: row.created_at,
    processed_at: row.processed_at,
    conflict_detail: row.conflict_detail,
  };
}

// ============================================================
// SESSION SNAPSHOT (filled only from live Supabase reads)
// ============================================================
// getSyncHealthStats is synchronous by contract; it computes over the most
// recent successfully fetched event set. Until a fetch succeeds the snapshot
// is empty and every counter reads zero.

let syncEventsSnapshot: HardenedSyncEvent[] = [];

// ============================================================
// CONNECTION READS
// ============================================================

/**
 * Outcome of a connection read. Wave 04 requires a failed read to be visibly
 * different from real emptiness. The project has no crm_connections table;
 * connection records are stored as an optional array in system_settings.
 *
 * - `ok`          — the read succeeded; `connections` is the real set (possibly empty).
 * - `unavailable` — the global settings contract is not present in this project.
 * - `error`       — the read failed for any other reason.
 *
 * Outbound synchronization remains outside this contract; reporting configured
 * connections and recorded historical events is ordinary read functionality.
 */
export type CrmConnectionsResult =
  | { status: "ok"; connections: CRMConnection[] }
  | { status: "unavailable"; connections: []; message: string }
  | { status: "error"; connections: []; message: string };

const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);

export async function fetchConnectionsResult(): Promise<CrmConnectionsResult> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("settings")
    .eq("id", "global")
    .limit(1);
  if (error) {
    handleSupabaseError("fetchConnections", error, { silent: true });
    setFetchError("fetchConnections", error);
    const code = (error as { code?: string }).code ?? "";
    if (MISSING_TABLE_CODES.has(code)) {
      return {
        status: "unavailable",
        connections: [],
        message: "The global system settings contract is not provisioned in this environment.",
      };
    }
    return { status: "error", connections: [], message: error.message };
  }
  clearFetchError("fetchConnections");
  const settings = (data?.[0] as { settings?: Record<string, unknown> } | undefined)?.settings;
  const rows = Array.isArray(settings?.crm_connections) ? settings.crm_connections : [];
  return { status: "ok", connections: rows.map(mapConnection) };
}

/**
 * Bare-array form retained for callers that only render a list. It cannot
 * distinguish failure from emptiness — anything that shows counts, health, or
 * "no connections" copy must use {@link fetchConnectionsResult} instead.
 */
export async function fetchConnections(): Promise<CRMConnection[]> {
  return (await fetchConnectionsResult()).connections;
}

// ============================================================
// SYNC EVENT READS
// ============================================================

export async function fetchSyncEvents(options?: {
  connectionId?: string;
  direction?: SyncDirection;
  status?: SyncStatus;
  entityType?: SyncEntityType;
  limit?: number;
}): Promise<HardenedSyncEvent[]> {
  if (!isCrmSyncEventReadEnabled()) {
    // Process isolation keeps this read disabled — explicit empty result.
    return [];
  }

  let query = supabase.from("crm_sync_events").select("id, direction, entity, zoho_id, status, timestamp, details").order("timestamp", { ascending: false });
  if (options?.direction) query = query.eq("direction", options.direction);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.entityType) query = query.eq("entity", options.entityType.replace(/_/g, " "));
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;

  if (error) {
    handleSupabaseError("fetchSyncEvents", error, { silent: true });
    setFetchError("fetchSyncEvents", error);
    return [];
  }
  clearFetchError("fetchSyncEvents");

  let events = (data ?? []).map(mapLegacySyncEvent);
  if (options?.connectionId) {
    events = events.filter((event) => event.connection_id === options.connectionId);
  }
  // Unfiltered (or superset) reads refresh the health snapshot.
  if (!options?.connectionId && !options?.direction && !options?.status && !options?.entityType) {
    syncEventsSnapshot = events;
  }
  return events;
}

// ============================================================
// HEALTH STATS (pure computation over the fetched snapshot)
// ============================================================

export function getSyncHealthStats(connectionId?: string): SyncHealthStats {
  const events = connectionId
    ? syncEventsSnapshot.filter((e) => e.connection_id === connectionId)
    : syncEventsSnapshot;
  const successEvents = events.filter((e) => e.status === "success");
  const failedEvents = events.filter((e) => e.status === "failed");

  const latencies = successEvents
    .filter((e) => e.processed_at && e.created_at)
    .map((e) => new Date(e.processed_at!).getTime() - new Date(e.created_at).getTime());

  return {
    total_events: events.length,
    pending: events.filter((e) => e.status === "pending").length,
    processing: events.filter((e) => e.status === "processing").length,
    success: successEvents.length,
    failed: failedEvents.length,
    retrying: events.filter((e) => e.status === "retrying").length,
    conflict_resolved: events.filter((e) => e.status === "conflict_resolved").length,
    last_success_at: successEvents.length > 0
      ? successEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].processed_at
      : null,
    last_failure_at: failedEvents.length > 0
      ? failedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].processed_at
      : null,
    avg_latency_ms: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
  };
}

// ============================================================
// OUTBOUND SYNC — HONESTLY UNAVAILABLE
// ============================================================

/**
 * Outbound CRM synchronization is not available in this build: there is no
 * deployed sync executor, and the legacy implementation fabricated success
 * and latency, which is not ported. Throws so callers render the failure.
 */
export async function triggerOutboundSync(params: {
  entityType: SyncEntityType;
  entityId: string;
  trigger: OutboundTrigger;
  payload: Record<string, any>;
  connectionId?: string;
}): Promise<HardenedSyncEvent[]> {
  void params;
  throw new Error("Outbound CRM synchronization is not available in this build. No sync event was created.");
}
