/**
 * ops-runtime.ts — SC-01 Wave 03, ticket W03-2 (clean-owned operations runtime).
 *
 * Replaces the last old-Hala-server HTTP calls left in the Admin panel:
 *
 *   row 62  GET/PUT /api/system-settings   -> readSystemSettings / saveSystemSettings
 *   row 61  GET     /api/system-health     -> readSystemHealth
 *   row 42  GET     /api/integration-status-> readIntegrationStatus
 *
 * HONESTY CONTRACT (non-negotiable for this module):
 *  - Settings are read from and written to the ESTABLISHED `system_settings`
 *    table (singleton row id='global'). No table, column or record is invented.
 *    A save is only reported as saved after the database returns the stored row
 *    AND that row matches what was submitted. An unconfirmed write is an error.
 *  - Health/integration status describe THIS application only. The old Hala
 *    Express server is never contacted and never reported on. Only two things
 *    are genuinely probed: Supabase (a real query) and the clean server's own
 *    /healthz. Everything else is explicitly `not_measured` — never "healthy",
 *    never a fabricated uptime, latency or integration state.
 *  - Latency values are real elapsed wall-clock measurements of the probe that
 *    was actually performed, or null when no probe ran.
 */

import { supabase } from "./supabase";
import { CLEAN_SERVER_BASE, cleanServerUrl } from "./runtime-config";

// ─────────────────────────────────────────────────────────────
// System settings (row 62) — established `system_settings` table
// ─────────────────────────────────────────────────────────────

/** Established table (old app: migrations/sprint12_system_settings.sql). */
export const SYSTEM_SETTINGS_TABLE = "system_settings";
/** Established singleton row id. */
export const SYSTEM_SETTINGS_ROW_ID = "global";

export type SystemSettings = Record<string, unknown>;

export type SystemSettingsRead =
  /** A stored row exists and was read. */
  | { status: "loaded"; settings: SystemSettings; updatedAt: string | null }
  /** The read succeeded but no settings row is stored yet. */
  | { status: "empty"; settings: null; updatedAt: null }
  /** The read genuinely failed. Nothing is known about stored settings. */
  | { status: "error"; settings: null; updatedAt: null; error: string };

export type SystemSettingsWrite =
  /** The database returned the stored row and it matches what was submitted. */
  | { status: "saved"; settings: SystemSettings; updatedAt: string | null }
  /** The write failed, or could not be confirmed. Treat as NOT saved. */
  | { status: "error"; error: string };

/** Deterministic key-sorted serialisation, used to confirm a write round-trip. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read the stored system settings.
 * Never substitutes defaults for a failed read — the caller must be able to
 * tell "nothing stored" apart from "we could not find out".
 */
export async function readSystemSettings(): Promise<SystemSettingsRead> {
  const { data, error } = await supabase
    .from(SYSTEM_SETTINGS_TABLE)
    .select("id, settings, updated_at")
    .eq("id", SYSTEM_SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      settings: null,
      updatedAt: null,
      error: error.message || "Unknown Supabase error",
    };
  }

  const row = data as { settings?: unknown; updated_at?: string | null } | null;
  if (!row || !isPlainObject(row.settings)) {
    return { status: "empty", settings: null, updatedAt: null };
  }

  return {
    status: "loaded",
    settings: row.settings,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Write the system settings and CONFIRM the write.
 *
 * `status: "saved"` is returned only when the database echoed back a row whose
 * `settings` payload is byte-identical (key order aside) to what was submitted.
 * A silent RLS filter, a missing row, or a mismatch is reported as an error so
 * the UI can never claim a save that did not happen.
 */
export async function saveSystemSettings(
  settings: SystemSettings,
): Promise<SystemSettingsWrite> {
  if (!isPlainObject(settings)) {
    return { status: "error", error: "Settings payload must be an object." };
  }

  const { data, error } = await supabase
    .from(SYSTEM_SETTINGS_TABLE)
    .upsert(
      {
        id: SYSTEM_SETTINGS_ROW_ID,
        settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, settings, updated_at")
    .maybeSingle();

  if (error) {
    return { status: "error", error: error.message || "Unknown Supabase error" };
  }

  const row = data as { settings?: unknown; updated_at?: string | null } | null;
  if (!row) {
    return {
      status: "error",
      error:
        "Save not confirmed: the database returned no row. Nothing was reported as saved.",
    };
  }

  if (!isPlainObject(row.settings) || stableStringify(row.settings) !== stableStringify(settings)) {
    return {
      status: "error",
      error:
        "Save not confirmed: the stored row does not match the submitted settings.",
    };
  }

  return {
    status: "saved",
    settings: row.settings,
    updatedAt: row.updated_at ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Probes (rows 61 + 42) — this application only
// ─────────────────────────────────────────────────────────────

/**
 * `ok` / `failed` are the outcome of a probe that actually ran.
 * `not_measured` means no probe exists in this build — it is NOT a health claim.
 */
export type ProbeStatus = "ok" | "failed" | "not_measured";

export interface Probe {
  name: string;
  status: ProbeStatus;
  /** Factual description of what was (or was not) observed. */
  detail: string;
  /** ISO timestamp of the probe; null when nothing was measured. */
  measuredAt: string | null;
  /** Real elapsed milliseconds of the probe; null when nothing was measured. */
  latencyMs: number | null;
}

export const SUPABASE_PROBE_NAME = "Supabase (database)";
export const CLEAN_SERVER_PROBE_NAME = "Clean application server";

/** Abort budget for the clean-server probe. */
export const CLEAN_SERVER_PROBE_TIMEOUT_MS = 3000;

function notMeasured(name: string, detail: string): Probe {
  return { name, status: "not_measured", detail, measuredAt: null, latencyMs: null };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Real Supabase connectivity probe: a genuine, cheap head-count query against
 * the established `system_settings` table. Success means the request reached
 * PostgREST and was authorised; failure is reported as failure, never masked.
 */
export async function probeSupabase(): Promise<Probe> {
  const startedAt = Date.now();
  try {
    const { error, count } = await supabase
      .from(SYSTEM_SETTINGS_TABLE)
      .select("id", { count: "exact", head: true });

    const latencyMs = Date.now() - startedAt;
    const measuredAt = new Date().toISOString();

    if (error) {
      return {
        name: SUPABASE_PROBE_NAME,
        status: "failed",
        detail: `Query failed: ${error.message || "unknown error"}`,
        measuredAt,
        latencyMs,
      };
    }

    return {
      name: SUPABASE_PROBE_NAME,
      status: "ok",
      detail: `Query succeeded — ${count ?? 0} row(s) visible in ${SYSTEM_SETTINGS_TABLE}`,
      measuredAt,
      latencyMs,
    };
  } catch (err) {
    return {
      name: SUPABASE_PROBE_NAME,
      status: "failed",
      detail: `Query threw: ${errorMessage(err)}`,
      measuredAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * Real probe of THIS application's own server (`GET ${CLEAN_SERVER_BASE}/healthz`).
 * The old Hala server is never contacted. A non-2xx, a malformed body, a
 * timeout or a connection refusal are all reported as `failed`.
 */
export async function probeCleanServer(): Promise<Probe> {
  const url = cleanServerUrl("/healthz");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLEAN_SERVER_PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    const measuredAt = new Date().toISOString();

    if (!res.ok) {
      return {
        name: CLEAN_SERVER_PROBE_NAME,
        status: "failed",
        detail: `HTTP ${res.status} from ${url}`,
        measuredAt,
        latencyMs,
      };
    }

    const body = await res.json().catch(() => null);
    if (!isPlainObject(body) || body.ok !== true) {
      return {
        name: CLEAN_SERVER_PROBE_NAME,
        status: "failed",
        detail: `HTTP ${res.status} from ${url} but the body did not report ok:true`,
        measuredAt,
        latencyMs,
      };
    }

    const service = typeof body.service === "string" ? body.service : "unnamed service";
    return {
      name: CLEAN_SERVER_PROBE_NAME,
      status: "ok",
      detail: `HTTP ${res.status} from ${url} — ${service}`,
      measuredAt,
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      name: CLEAN_SERVER_PROBE_NAME,
      status: "failed",
      detail: aborted
        ? `No response from ${url} within ${CLEAN_SERVER_PROBE_TIMEOUT_MS}ms`
        : `${CLEAN_SERVER_BASE} unreachable: ${errorMessage(err)}`,
      measuredAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// System health (row 61)
// ─────────────────────────────────────────────────────────────

/**
 * Subsystems the OLD server used to report on. This build performs no probe
 * for any of them, so they are surfaced as explicitly not-measured rather than
 * silently dropped or optimistically reported as running.
 */
export const UNMEASURED_MODULES: readonly string[] = [
  "CRM Sync Engine",
  "Document Export Engine",
  "Escalation Engine",
  "Audit Logger",
  "AI Authoring",
  "Notification Service",
];

export interface SystemHealthReport {
  /** Probes that actually ran. */
  probes: Probe[];
  /** Declared-unmeasured subsystems (status is always "not_measured"). */
  notMeasured: Probe[];
  /** ISO timestamp of this report. */
  reportedAt: string;
}

/** Health of THIS application: two real probes, everything else declared unmeasured. */
export async function readSystemHealth(): Promise<SystemHealthReport> {
  const [supabaseProbe, serverProbe] = await Promise.all([
    probeSupabase(),
    probeCleanServer(),
  ]);

  return {
    probes: [supabaseProbe, serverProbe],
    notMeasured: UNMEASURED_MODULES.map((name) =>
      notMeasured(name, "No health probe exists for this subsystem in this build."),
    ),
    reportedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Integration status (row 42)
// ─────────────────────────────────────────────────────────────

export interface IntegrationEntry {
  name: string;
  /** Outcome of a real probe, or "not_measured" when this build probes nothing. */
  status: ProbeStatus;
  /** Factual description. Recorded (stored) values are labelled as such. */
  detail: string;
  /** Connection facts actually observed, or an explicit not-measured note. */
  connectionInfo: string;
}

export interface IntegrationReport {
  integrations: IntegrationEntry[];
  reportedAt: string;
}

/** Established table read by the clean CRM surface (see crm-sync-engine.ts). */
const CRM_CONNECTIONS_TABLE = "crm_connections";

/**
 * CRM entry. The clean app can genuinely verify whether the established
 * `crm_connections` table is readable and how many rows it holds. It cannot
 * probe Zoho itself, so each connection's stored `health_status` is reported
 * as a RECORDED value, explicitly not a live check.
 */
async function readCrmIntegration(): Promise<IntegrationEntry> {
  const { data, error } = await supabase
    .from(CRM_CONNECTIONS_TABLE)
    .select("name, provider, health_status, last_sync_at");

  if (error) {
    return {
      name: "CRM connections",
      status: "failed",
      detail: `Could not read ${CRM_CONNECTIONS_TABLE}: ${error.message || "unknown error"}`,
      connectionInfo: "Not measured — table read failed.",
    };
  }

  const rows = (data ?? []) as Array<{
    name?: string | null;
    provider?: string | null;
    health_status?: string | null;
    last_sync_at?: string | null;
  }>;

  if (rows.length === 0) {
    return {
      name: "CRM connections",
      status: "ok",
      detail: `Read succeeded — no connections configured in ${CRM_CONNECTIONS_TABLE}.`,
      connectionInfo: "No connection records exist.",
    };
  }

  const recorded = rows
    .map((r) => `${r.provider ?? "unknown"}/${r.name ?? "unnamed"}=${r.health_status ?? "unset"}`)
    .join(", ");

  return {
    name: "CRM connections",
    status: "ok",
    detail: `Read succeeded — ${rows.length} connection record(s).`,
    connectionInfo: `Recorded status (stored value, not a live probe): ${recorded}`,
  };
}

/**
 * Integration status for THIS application. Nothing here describes the old
 * server. Anything this build does not probe is reported as not measured.
 */
export async function readIntegrationStatus(): Promise<IntegrationReport> {
  const [supabaseProbe, crm] = await Promise.all([probeSupabase(), readCrmIntegration()]);

  const integrations: IntegrationEntry[] = [
    {
      name: "Supabase",
      status: supabaseProbe.status,
      detail: supabaseProbe.detail,
      connectionInfo:
        supabaseProbe.latencyMs === null
          ? "Not measured."
          : `Live probe — ${supabaseProbe.latencyMs}ms`,
    },
    crm,
    {
      name: "Zoho Books",
      status: "not_measured",
      detail: "No integration exists in this build.",
      connectionInfo: "Not measured.",
    },
    {
      name: "WMS (Blue Yonder)",
      status: "not_measured",
      detail: "No integration exists in this build.",
      connectionInfo: "Not measured.",
    },
    {
      name: "Email (SMTP)",
      status: "not_measured",
      detail: "No integration exists in this build.",
      connectionInfo: "Not measured.",
    },
  ];

  return { integrations, reportedAt: new Date().toISOString() };
}
