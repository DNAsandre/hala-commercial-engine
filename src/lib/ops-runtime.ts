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
 *
 * SC-01 Wave 04: a table that does not exist in this project (PGRST205 /
 * 42P01) is reported as NOT PROVISIONED rather than as a generic check
 * failure, so a reader can tell "no CRM storage was ever created here" apart
 * from "the read broke".
 */
async function readCrmIntegration(): Promise<IntegrationEntry> {
  const { data, error } = await supabase
    .from(CRM_CONNECTIONS_TABLE)
    .select("name, provider, health_status, last_sync_at");

  if (error) {
    if (isMissingTableError(error)) {
      return {
        name: "CRM connections",
        status: "not_measured",
        detail: `${CRM_CONNECTIONS_TABLE} does not exist in this project — CRM connection storage is not provisioned in this build.`,
        connectionInfo: "Not measured — there is no connection storage to read.",
      };
    }
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

// ─────────────────────────────────────────────────────────────
// SC-01 Wave 04 — three-state record reads for the System surfaces
// ─────────────────────────────────────────────────────────────
//
// Wave 04's central rule: a failed read is not an empty result, and the two
// must not look the same to a human. Every reader below therefore answers with
// FOUR distinguishable outcomes instead of a bare array:
//
//   loaded      — the read succeeded and returned rows
//   empty       — the read succeeded and the visible row set is genuinely zero
//   unavailable — the table does not exist in this project (PGRST205 / 42P01)
//   error       — the read failed for any other reason (RLS, network, syntax)
//
// A zero-row read is reported as `empty`, never as proof that the table is
// empty for every caller: row-level security can hide rows from the current
// client. Callers must phrase `empty` as "no records are visible", which is
// what the System pages now do.

/** Postgres/PostgREST codes that mean "this relation does not exist here". */
const MISSING_TABLE_CODES: ReadonlySet<string> = new Set(["PGRST205", "42P01"]);

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  return MISSING_TABLE_CODES.has(code);
}

function errorText(error: unknown): string {
  const message = (error as { message?: string } | null)?.message;
  return message || "Unknown Supabase error";
}

export type RecordRead<T> =
  | { status: "loaded"; rows: T[] }
  | { status: "empty"; rows: [] }
  | { status: "unavailable"; rows: []; error: string }
  | { status: "error"; rows: []; error: string };

/**
 * Classify one PostgREST list response. Shared by every reader below so the
 * four outcomes are produced in exactly one place and cannot drift apart.
 */
function classifyListRead<TRow, TOut>(
  table: string,
  data: TRow[] | null,
  error: unknown,
  map: (row: TRow) => TOut,
): RecordRead<TOut> {
  if (error) {
    if (isMissingTableError(error)) {
      return {
        status: "unavailable",
        rows: [],
        error: `The table "${table}" does not exist in this project.`,
      };
    }
    return { status: "error", rows: [], error: errorText(error) };
  }
  const rows = (data ?? []).map(map);
  if (rows.length === 0) return { status: "empty", rows: [] };
  return { status: "loaded", rows };
}

/** Human sentence for a non-loaded read, used verbatim by the System pages. */
export function describeRecordRead(
  read: RecordRead<unknown>,
  subject: string,
): string {
  switch (read.status) {
    case "loaded":
      return `${read.rows.length} ${subject} read from the database.`;
    case "empty":
      return `The read succeeded and no ${subject} are visible to this account. Records hidden by row-level security would not appear here.`;
    case "unavailable":
      return `${subject} cannot be shown: ${read.error}`;
    case "error":
      return `${subject} could not be read: ${read.error}`;
  }
}

// ── Recorded timestamps ──────────────────────────────────────
//
// SC-01 Wave 04 correction. `new Date(x).toLocaleDateString()` does NOT throw
// on an unparseable value — it returns the literal string "Invalid Date", so a
// surrounding try/catch is not a guard and the words "Invalid Date" reach the
// screen as though they were a recorded value. The only reliable test is
// `Number.isNaN(d.getTime())`, applied here once so every System surface
// degrades the same honest way.

/** Shown when the column holds nothing at all. */
export const TIMESTAMP_NOT_RECORDED = "not recorded";
/** Shown when the column holds something that is not a readable date. */
export const TIMESTAMP_UNREADABLE = "unreadable date value";

function formatRecordedInstant(
  value: string | number | null | undefined,
  render: (d: Date) => string,
): string {
  if (value === null || value === undefined || value === "") return TIMESTAMP_NOT_RECORDED;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return TIMESTAMP_UNREADABLE;
  return render(d);
}

/** Date only. Never returns "Invalid Date". */
export function formatRecordedDate(value: string | number | null | undefined): string {
  return formatRecordedInstant(value, (d) => d.toLocaleDateString());
}

/** Date and time. Never returns "Invalid Date". */
export function formatRecordedDateTime(value: string | number | null | undefined): string {
  return formatRecordedInstant(value, (d) => d.toLocaleString());
}

// ── Audit trail (audit_log) ──────────────────────────────────

export const AUDIT_LOG_TABLE = "audit_log";

/** Projection actually requested from `audit_log` — every field is rendered. */
export const AUDIT_LOG_COLUMNS =
  "id, entity_type, entity_id, action, user_id, user_name, timestamp, details";

export interface AuditTrailRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

function mapAuditRow(row: any): AuditTrailRecord {
  return {
    id: row.id,
    entityType: row.entity_type ?? "",
    entityId: row.entity_id ?? "",
    action: row.action ?? "",
    userId: row.user_id ?? "",
    userName: row.user_name ?? "",
    timestamp: row.timestamp ?? "",
    details: row.details ?? "",
  };
}

/**
 * Read the persisted audit trail.
 *
 * This is the same established `audit_log` table the previous implementation
 * used; the only change is that the outcome is no longer collapsed to `[]`,
 * so the Audit Trail page can say which of the four things happened.
 */
export async function readAuditTrail(): Promise<RecordRead<AuditTrailRecord>> {
  const { data, error } = await supabase
    .from(AUDIT_LOG_TABLE)
    .select(AUDIT_LOG_COLUMNS)
    .order("timestamp", { ascending: false });
  return classifyListRead(AUDIT_LOG_TABLE, data, error, mapAuditRow);
}

// ── AI providers (ai_providers) ──────────────────────────────

export const AI_PROVIDERS_TABLE = "ai_providers";
export const AI_PROVIDERS_COLUMNS =
  "id, name, display_name, model_default, models, enabled, config";

export interface AiProviderRecord {
  id: string;
  name: string;
  displayName: string;
  modelDefault: string;
  models: string[];
  enabled: boolean;
  config: Record<string, unknown>;
}

function mapProviderRow(row: any): AiProviderRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    displayName: row.display_name ?? row.name ?? row.id,
    modelDefault: row.model_default ?? "",
    models: Array.isArray(row.models) ? row.models : [],
    enabled: row.enabled === true,
    config: (row.config ?? {}) as Record<string, unknown>,
  };
}

export async function readAiProviders(): Promise<RecordRead<AiProviderRecord>> {
  const { data, error } = await supabase
    .from(AI_PROVIDERS_TABLE)
    .select(AI_PROVIDERS_COLUMNS)
    .order("name");
  return classifyListRead(AI_PROVIDERS_TABLE, data, error, mapProviderRow);
}

// ── Bots (ai_bots) ───────────────────────────────────────────

export const AI_BOTS_TABLE = "ai_bots";
export const AI_BOTS_COLUMNS =
  "id, name, display_name, type, status, purpose, domains_allowed, regions_allowed, " +
  "roles_allowed, current_version_id, provider_id, model, rate_limit, cost_cap, " +
  "timeout_sec, created_at, updated_at";

export interface AiBotRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  purpose: string;
  domainsAllowed: string[];
  regionsAllowed: string[];
  rolesAllowed: string[];
  currentVersionId: string | null;
  /** Recorded provider id. It may not match any `ai_providers.id`. */
  providerId: string | null;
  model: string | null;
  rateLimit: number | null;
  costCap: number | null;
  timeoutSec: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map an `ai_bots` row. Fields the table leaves null stay null: this build
 * does not substitute plausible-looking defaults (20 / 10 / 30 / "gpt-4o")
 * for configuration that was never recorded, because the System pages render
 * these values as though they were the bot's stored configuration.
 */
function mapBotRow(row: any): AiBotRecord {
  return {
    id: row.id,
    name: row.display_name ?? row.name ?? row.id,
    type: row.type ?? "",
    status: row.status ?? "",
    purpose: row.purpose ?? "",
    domainsAllowed: Array.isArray(row.domains_allowed) ? row.domains_allowed : [],
    regionsAllowed: Array.isArray(row.regions_allowed) ? row.regions_allowed : [],
    rolesAllowed: Array.isArray(row.roles_allowed) ? row.roles_allowed : [],
    currentVersionId: row.current_version_id ?? null,
    providerId: row.provider_id ?? null,
    model: row.model ?? null,
    rateLimit: row.rate_limit ?? null,
    costCap: row.cost_cap ?? null,
    timeoutSec: row.timeout_sec ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export async function readAiBots(): Promise<RecordRead<AiBotRecord>> {
  const { data, error } = await supabase
    .from(AI_BOTS_TABLE)
    .select(AI_BOTS_COLUMNS)
    .order("created_at", { ascending: false });
  return classifyListRead(AI_BOTS_TABLE, data, error, mapBotRow);
}

/**
 * Resolve a bot's recorded `provider_id` against the provider records that
 * were actually read.
 *
 * The live data does not always line up: `ai_bots.provider_id` holds values
 * such as "prov-openai" while `ai_providers.id` holds "aip-openai-001". The
 * previous UI rendered `provider?.name` directly and printed the literal
 * string "undefined" for every such bot. There is no defensible way to guess
 * the intended link, so an unmatched id is reported as unmatched and the
 * recorded value is shown verbatim.
 */
export function resolveBotProviderLabel(
  providerId: string | null,
  providers: readonly AiProviderRecord[],
): { matched: boolean; label: string } {
  if (!providerId) return { matched: false, label: "No provider recorded" };
  const provider = providers.find((p) => p.id === providerId);
  if (provider) return { matched: true, label: provider.displayName };
  return { matched: false, label: `${providerId} (no matching provider record)` };
}

/**
 * How a bot's recorded `provider_id` should be described, given the state of
 * the provider read itself.
 *
 * SC-01 Wave 04 correction. `resolveBotProviderLabel` answers "no matching
 * provider record has this id" from the rows it was handed — but when the
 * `ai_providers` read FAILED, the caller hands it `[]` and that sentence
 * becomes an assertion about records nobody ever looked at. "The provider list
 * could not be read" and "no provider record has this id" are different facts
 * and must look different to a human.
 */
export type BotProviderState =
  | "unread"      // the provider read has not resolved yet
  | "unreadable"  // the provider read failed / the table is absent
  | "none"        // the bot record stores no provider id
  | "matched"     // a provider record with that id was read
  | "unmatched";  // the read succeeded and no provider record has that id

export function describeBotProvider(
  providerId: string | null,
  providersRead: RecordRead<AiProviderRecord> | null,
): { state: BotProviderState; label: string } {
  if (!providerId) return { state: "none", label: "No provider recorded" };
  if (providersRead === null) {
    return { state: "unread", label: `${providerId} (provider records not read yet)` };
  }
  if (providersRead.status === "error" || providersRead.status === "unavailable") {
    return {
      state: "unreadable",
      label: `${providerId} (the provider records could not be read, so it is unknown whether one has this id)`,
    };
  }
  const provider = providersRead.rows.find((p) => p.id === providerId);
  if (provider) return { state: "matched", label: provider.displayName };
  return { state: "unmatched", label: `${providerId} (no matching provider record)` };
}

// ── Bot versions (ai_bot_versions) ───────────────────────────

export const AI_BOT_VERSIONS_TABLE = "ai_bot_versions";
/**
 * SC-01 Wave 06 (T13) correction of record: this projection previously omitted
 * `allowed_actions`, `provider_id`, `model` and `permission_snapshot`, and a
 * Wave-04 page comment claimed `ai_bots` / `ai_bot_versions` record no per-bot
 * action-mode selection. That claim is WRONG about the live schema: the
 * `allowed_actions` column exists and holds real recorded selections (live
 * probe 2026-08-18, e.g. ["suggest","draft"] and
 * ["signal_event","report_snapshot"]), and the version rows also carry
 * `provider_id`, `model` and `permission_snapshot`. All four columns are
 * verified live and now part of the projection, so the Bot Builder surfaces
 * can display the recorded selection instead of mislabelling it non-existent.
 */
export const AI_BOT_VERSIONS_COLUMNS =
  "id, bot_id, version, system_instruction, custom_instruction, safety_rules, " +
  "temperature, max_tokens, allowed_actions, provider_id, model, " +
  "knowledge_base_text, connector_snapshot, permission_snapshot, chain_config, " +
  "change_note, created_at, created_by";

export interface AiBotVersionRecord {
  id: string;
  botId: string;
  version: number | null;
  systemInstruction: string | null;
  customInstruction: string | null;
  safetyRules: string | null;
  temperature: number | null;
  maxTokens: number | null;
  /**
   * Recorded action-mode / monitor-output selection (Wave 06, row B-17).
   * Optional in the TYPE only so pre-existing fixtures stay valid;
   * `mapBotVersionRow` always populates it ([] when nothing is recorded).
   */
  allowedActions?: string[];
  /** Recorded per-version provider id (may not match any ai_providers.id). */
  providerId?: string | null;
  /** Recorded per-version model string. */
  model?: string | null;
  /** Recorded permission snapshot jsonb; null when nothing is recorded. */
  permissionSnapshot?: Record<string, unknown> | null;
  knowledgeBaseText: string | null;
  connectorSnapshot: Record<string, unknown> | null;
  chainConfig: Record<string, unknown> | null;
  changeNote: string;
  createdAt: string;
  createdBy: string;
}

function mapBotVersionRow(row: any): AiBotVersionRecord {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  return {
    id: row.id,
    botId: row.bot_id ?? "",
    version: row.version ?? null,
    systemInstruction: row.system_instruction ?? null,
    customInstruction: row.custom_instruction ?? null,
    safetyRules: row.safety_rules ?? null,
    temperature: row.temperature ?? null,
    maxTokens: row.max_tokens ?? null,
    allowedActions: Array.isArray(row.allowed_actions) ? row.allowed_actions : [],
    providerId: row.provider_id ?? null,
    model: row.model ?? null,
    permissionSnapshot: isObject(row.permission_snapshot) ? row.permission_snapshot : null,
    knowledgeBaseText: typeof row.knowledge_base_text === "string" ? row.knowledge_base_text : null,
    connectorSnapshot: isObject(row.connector_snapshot) ? row.connector_snapshot : null,
    chainConfig: isObject(row.chain_config) ? row.chain_config : null,
    changeNote: row.change_note ?? "",
    createdAt: row.created_at ?? "",
    createdBy: row.created_by ?? "",
  };
}

export type BotConfigurationRead =
  | { status: "loaded"; bot: AiBotRecord; versions: AiBotVersionRecord[] }
  /** The read succeeded and no bot with that id is visible to this account. */
  | { status: "not_found"; bot: null; versions: [] }
  | { status: "error"; bot: null; versions: []; error: string };

/**
 * Read one bot's recorded configuration plus its version history.
 *
 * "Not visible" is deliberately separate from "read failed": the previous
 * implementation logged both to the console and left the page displaying
 * "Loading recorded configuration…" forever.
 */
export async function readBotConfiguration(botId: string): Promise<BotConfigurationRead> {
  const botRes = await supabase
    .from(AI_BOTS_TABLE)
    .select(AI_BOTS_COLUMNS)
    .eq("id", botId)
    .maybeSingle();

  if (botRes.error) {
    return { status: "error", bot: null, versions: [], error: errorText(botRes.error) };
  }
  if (!botRes.data) {
    return { status: "not_found", bot: null, versions: [] };
  }

  const versionsRes = await supabase
    .from(AI_BOT_VERSIONS_TABLE)
    .select(AI_BOT_VERSIONS_COLUMNS)
    .eq("bot_id", botId)
    .order("version", { ascending: false });

  if (versionsRes.error) {
    return { status: "error", bot: null, versions: [], error: errorText(versionsRes.error) };
  }

  return {
    status: "loaded",
    bot: mapBotRow(botRes.data),
    versions: (versionsRes.data ?? []).map(mapBotVersionRow),
  };
}

// ── Bot usage log (ai_usage_logs) ────────────────────────────

export const AI_USAGE_LOGS_TABLE = "ai_usage_logs";
export const AI_USAGE_LOGS_COLUMNS =
  "id, bot_id, bot_name, user_id, user_name, provider, model, action, status, " +
  "error_message, cost_usd, latency_ms, tokens_input, tokens_output, workspace_id, " +
  "human_action, created_at";

export interface AiUsageLogRecord {
  id: string;
  botId: string;
  botName: string;
  userId: string;
  userName: string;
  provider: string;
  model: string;
  action: string;
  status: string;
  errorMessage: string | null;
  /** null when the column holds no value — never coerced to 0. */
  costUsd: number | null;
  latencyMs: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  workspaceId: string | null;
  /** Recorded human decision, e.g. "apply" / "preview_generated". */
  humanAction: string | null;
  createdAt: string;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapUsageLogRow(row: any): AiUsageLogRecord {
  return {
    id: row.id,
    botId: row.bot_id ?? "",
    botName: row.bot_name ?? "",
    userId: row.user_id ?? "",
    userName: row.user_name ?? "",
    provider: row.provider ?? "",
    model: row.model ?? "",
    action: row.action ?? "",
    status: row.status ?? "",
    errorMessage: row.error_message ?? null,
    costUsd: numberOrNull(row.cost_usd),
    latencyMs: numberOrNull(row.latency_ms),
    tokensInput: numberOrNull(row.tokens_input),
    tokensOutput: numberOrNull(row.tokens_output),
    workspaceId: row.workspace_id ?? null,
    humanAction: row.human_action ?? null,
    createdAt: row.created_at ?? "",
  };
}

export const AI_USAGE_LOGS_DEFAULT_LIMIT = 200;

export async function readAiUsageLogs(
  limit: number = AI_USAGE_LOGS_DEFAULT_LIMIT,
): Promise<RecordRead<AiUsageLogRecord>> {
  const { data, error } = await supabase
    .from(AI_USAGE_LOGS_TABLE)
    .select(AI_USAGE_LOGS_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return classifyListRead(AI_USAGE_LOGS_TABLE, data, error, mapUsageLogRow);
}

/**
 * Averages over the recorded values only.
 *
 * `null` (nothing recorded) is excluded rather than counted as zero, so an
 * empty or unrecorded column reads as "not recorded" instead of a confident
 * "0ms" / "$0.000" that no row actually supports.
 */
export function summariseUsageNumber(
  rows: readonly AiUsageLogRecord[],
  pick: (row: AiUsageLogRecord) => number | null,
): { recordedCount: number; total: number | null; average: number | null } {
  const values = rows.map(pick).filter((v): v is number => v !== null);
  if (values.length === 0) return { recordedCount: 0, total: null, average: null };
  const total = values.reduce((a, b) => a + b, 0);
  return { recordedCount: values.length, total, average: total / values.length };
}

// ── Facilities (facilities) ──────────────────────────────────

export const FACILITIES_TABLE = "facilities";
export const FACILITIES_COLUMNS = "id, name, code, region, active, sort_order, created_at, updated_at";

export interface FacilityRecord {
  id: string;
  name: string;
  code: string | null;
  region: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function mapFacilityRow(row: any): FacilityRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    code: row.code ?? null,
    region: row.region ?? null,
    active: row.active === true,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export async function readFacilities(): Promise<RecordRead<FacilityRecord>> {
  const { data, error } = await supabase
    .from(FACILITIES_TABLE)
    .select(FACILITIES_COLUMNS)
    .order("sort_order", { ascending: true });
  return classifyListRead(FACILITIES_TABLE, data, error, mapFacilityRow);
}

/**
 * Update one facility row and CONFIRM the stored result before answering.
 *
 * SC-01 Wave 04 correction. The Facilities admin previously issued
 * `.update(...).eq("id", id)` with no `.select()` and then raised
 * `toast.success("Updated")`. PostgREST returns no error when an update
 * matches zero rows (deleted row, wrong id, or a row this account may not
 * write), so the administrator was told a change had been saved that the
 * database never stored. A resolved request is not proof of persistence.
 *
 * The update is read back and every field that was requested is compared with
 * the value the database now holds. Only an exact match is reported as stored.
 * This is the same shape as `intake-save.changeStage`.
 */
export interface FacilityUpdateFields {
  name?: string;
  code?: string | null;
  region?: string | null;
  active?: boolean;
}

export type FacilityWriteResult =
  /** The row was read back and holds exactly the requested values. */
  | { status: "stored"; stored: Record<string, unknown> }
  /** The request resolved without error but the value is NOT in the database. */
  | { status: "not_stored"; error: string }
  /** The request itself failed. */
  | { status: "error"; error: string };

/** null and undefined are the same absence; everything else compares strictly. */
function sameStoredValue(stored: unknown, requested: unknown): boolean {
  return (stored ?? null) === (requested ?? null);
}

export async function updateFacility(
  id: string,
  fields: FacilityUpdateFields,
): Promise<FacilityWriteResult> {
  const patch = fields as Record<string, unknown>;
  const requestedColumns = Object.keys(patch);
  if (requestedColumns.length === 0) {
    return { status: "error", error: "No fields were supplied to update." };
  }

  // Read back exactly the columns this call claims to change, plus the id.
  const projection = ["id", ...requestedColumns].join(", ");

  const { data, error } = await supabase
    .from(FACILITIES_TABLE)
    .update(patch)
    .eq("id", id)
    .select(projection);

  if (error) return { status: "error", error: errorText(error) };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return {
      status: "not_stored",
      error:
        "The change was not stored: no matching facility record was updated. " +
        "The record may have been removed, or this account may not be permitted to change it.",
    };
  }

  const stored = rows[0] ?? {};
  const mismatched = requestedColumns.filter((column) => !sameStoredValue(stored[column], patch[column]));
  if (mismatched.length > 0) {
    const detail = mismatched
      .map((column) => `${column} still reads "${String(stored[column] ?? "")}"`)
      .join("; ");
    return { status: "not_stored", error: `The change was not stored: ${detail}.` };
  }

  return { status: "stored", stored };
}
