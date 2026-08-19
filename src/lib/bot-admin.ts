/**
 * bot-admin.ts — SC-01 Wave 06, lane T13 (bot/provider DEFINITION management).
 *
 * The clean-owned data service behind the System bot-administration surfaces
 * (/system/bots, /system/bot-builder). It implements the write contracts of
 * manifest rows B-03..B-06, B-08, B-14..B-19 (.wave06-evidence/
 * MANIFEST-ROWS-B.json) against the ESTABLISHED, populated table family:
 *
 *   ai_bots          (40 rows live)   — bot definitions
 *   ai_bot_versions  (39 rows live)   — immutable per-version configuration
 *   ai_providers     (2 rows live)    — provider registry
 *   kb_collections   (0 rows live)    — knowledge collections (via knowledgebase.ts)
 *
 * Every column written or read here was verified against the live schema on
 * 2026-08-18 (probe evidence in the manifest rows). The old Express
 * bot-governance plane and its empty parallel tables (bot_definitions,
 * bot_providers, …) are NOT used — see manifest row B-30.
 *
 * SCOPE: definition management only. Nothing in this module invokes a bot,
 * calls a model, or executes anything — bot INVOCATION remains out of scope
 * for Wave 06.
 *
 * HONESTY CONTRACT (non-negotiable, the codebase's law):
 *  - Every write requests a `.select(...)` read-back and compares the stored
 *    values with the requested ones BEFORE reporting success. A resolved
 *    request is not proof of persistence: PostgREST returns NO error when an
 *    update or delete matches zero rows.
 *  - A zero-row write result is a failure with an honest message, never a
 *    success.
 *  - Multi-step operations report exactly which steps were confirmed, which
 *    failed, and which were never attempted. A partial outcome is reported as
 *    partial — never as success, never silently.
 *  - No secondary write is issued before the primary write is confirmed.
 *  - Reads are classified (loaded / empty / unavailable / error) — a failed
 *    read is not an empty result.
 *  - No mock, demo, static or fabricated records anywhere.
 *
 * FIX OF RECORD (manifest B-15): the old app's edit path inserted a new
 * ai_bot_versions row but never repointed ai_bots.current_version_id, so every
 * consumer that resolves the current version kept serving the OLD instruction
 * after a publish. Every version-creating operation in this module repoints
 * current_version_id as its final confirmed step, and tests prove it.
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";
import {
  AI_BOTS_TABLE,
  AI_BOT_VERSIONS_TABLE,
  AI_BOT_VERSIONS_COLUMNS,
  AI_PROVIDERS_TABLE,
  type AiBotRecord,
  type AiProviderRecord,
  type RecordRead,
} from "./ops-runtime";
import { fetchCollectionsResult, type KBCollection } from "./knowledgebase";

// ─────────────────────────────────────────────────────────────
// One import surface for the System pages (T15): the classified
// readers already live in ops-runtime; re-export them so pages can
// depend on bot-admin alone for the bot-administration plane.
// ─────────────────────────────────────────────────────────────

export {
  AI_BOTS_TABLE,
  AI_BOTS_COLUMNS,
  AI_BOT_VERSIONS_TABLE,
  AI_BOT_VERSIONS_COLUMNS,
  AI_PROVIDERS_TABLE,
  AI_PROVIDERS_COLUMNS,
  readAiBots,
  readAiProviders,
  readBotConfiguration,
  describeBotProvider,
  describeRecordRead,
  resolveBotProviderLabel,
} from "./ops-runtime";
export type {
  AiBotRecord,
  AiBotVersionRecord,
  AiProviderRecord,
  BotConfigurationRead,
  BotProviderState,
  RecordRead,
} from "./ops-runtime";
export type { KBCollection, KBCollectionsResult } from "./knowledgebase";

// ─────────────────────────────────────────────────────────────
// Shared result vocabulary
// ─────────────────────────────────────────────────────────────

/** One step of a multi-step operation, reported truthfully. */
export interface StepReport {
  /** Human-readable step name, e.g. 'insert bot record into "ai_bots"'. */
  step: string;
  table: string;
  outcome: "confirmed" | "failed" | "not_attempted";
  detail: string;
}

/** Single-write operations (e.g. archive). */
export type BotAdminWriteResult =
  /** The row was read back and holds exactly the requested values. */
  | { status: "stored"; stored: Record<string, unknown> }
  /** The request resolved without error but the value is NOT in the database. */
  | { status: "not_stored"; error: string }
  /** The request itself failed (constraint, RLS, network). */
  | { status: "error"; error: string };

/** Multi-step operations (create, publish, duplicate, delete, attach/detach). */
export type BotAdminOperationResult<T> =
  /** Every step was confirmed from returned rows. */
  | { status: "completed"; value: T; steps: StepReport[] }
  /**
   * At least one step failed. `steps` states exactly what WAS created/changed
   * and what was not — a partial outcome is never reported as success.
   */
  | { status: "failed"; error: string; steps: StepReport[] };

export interface BotWithVersionOutcome {
  botId: string;
  versionId: string;
  version: number;
}

// ─────────────────────────────────────────────────────────────
// Column sets (verified live 2026-08-18)
// ─────────────────────────────────────────────────────────────

/**
 * Full ai_bots definition column set for admin copy-reads. Includes the
 * FPS-008 columns (category, display_order, allowed_block_types,
 * allowed_document_intents, allowed_source_modes) that the list projection
 * deliberately omits — a duplicate MUST copy them (manifest B-05: the old
 * clone dropped them because the old Express schema predates them).
 */
export const AI_BOTS_ADMIN_COLUMNS =
  "id, name, display_name, type, status, purpose, domains_allowed, regions_allowed, " +
  "roles_allowed, current_version_id, provider_id, model, rate_limit, cost_cap, " +
  "timeout_sec, category, display_order, allowed_block_types, allowed_document_intents, " +
  "allowed_source_modes, created_at, updated_at, created_by";

// ─────────────────────────────────────────────────────────────
// Established validation limits (old BotBuilder handleSave contract)
// ─────────────────────────────────────────────────────────────

export const MAX_TOKENS_LIMIT = 8000;
export const RATE_LIMIT_MAX = 100;
export const COST_CAP_MAX = 100;

/** Statuses from which a bot may be deleted (manifest B-06, old registry rule). */
export const BOT_DELETABLE_STATUSES: ReadonlySet<string> = new Set(["draft", "disabled"]);

// ─────────────────────────────────────────────────────────────
// Input shapes
// ─────────────────────────────────────────────────────────────

/** Recorded chain configuration (manifest B-18). Stored verbatim per version. */
export interface ChainConfig {
  next_bot_id: string;
  prompt_user: boolean;
  chain_label: string;
}

/** The bot-definition fields the builder form edits (manifest B-14/B-15). */
export interface BotDefinitionFields {
  name: string;
  /** Edited explicitly — NOT mirrored from `name` (manifest B-15 note): live
   * rows distinguish name ("test-bot-verify") from display_name
   * ("Test Bot Verify"). Blank falls back to `name`. */
  displayName?: string;
  type: string;
  purpose: string;
  domainsAllowed?: string[];
  regionsAllowed?: string[];
  rolesAllowed: string[];
  providerId?: string | null;
  model?: string | null;
  rateLimit?: number | null;
  costCap?: number | null;
  timeoutSec?: number | null;
}

/** Per-version configuration written with every new version row. */
export interface BotVersionDraft {
  systemInstruction?: string | null;
  customInstruction?: string | null;
  safetyRules?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  /** Recorded action-mode / monitor-output selection (manifest B-17). Stored
   * configuration only — nothing enforces or executes it in this build. */
  allowedActions?: string[];
  providerId?: string | null;
  model?: string | null;
  /** Carried forward verbatim (or {}) — never invented (manifest B-20). */
  connectorSnapshot?: Record<string, unknown>;
  permissionSnapshot?: Record<string, unknown>;
  /** Exact kb collection ids (manifest B-19). */
  knowledgeBaseIds?: string[];
  /** {} when no chain, else the full ChainConfig (manifest B-18). */
  chainConfig?: ChainConfig | null;
  changeNote?: string;
}

export interface CreateBotInput extends BotDefinitionFields {
  /** Recorded verbatim; defaults to the session user id — never a hardcoded
   * 'admin' (manifest B-14 note). */
  createdBy?: string;
  /** Optional FPS-008 columns (recommended for pdf_studio bots). */
  category?: string | null;
  displayOrder?: number | null;
  allowedBlockTypes?: string[];
  allowedDocumentIntents?: string[];
  allowedSourceModes?: string[];
  /** First version content (version 1). */
  version?: BotVersionDraft;
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function errorText(error: unknown): string {
  const message = (error as { message?: string } | null)?.message;
  return message || "Unknown Supabase error";
}

function resolveActor(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  // Session user id, recorded verbatim ("anonymous" when unauthenticated —
  // an honest recorded fact, unlike the old hardcoded 'admin').
  return getCurrentUser().id;
}

/** Deterministic key-sorted serialisation for array/object comparison. */
function stableSerialise(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableSerialise).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableSerialise(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * Compare one stored column value against the requested one.
 * null and undefined are the same absence; arrays/objects compare structurally;
 * a numeric column echoed as a string ("10" for 10) still counts as stored.
 */
function sameStoredValue(stored: unknown, requested: unknown): boolean {
  const s = stored ?? null;
  const r = requested ?? null;
  if (s === null || r === null) return s === r;
  if (typeof r === "number" && typeof s === "string") return Number(s) === r;
  if (typeof r === "object") return stableSerialise(s) === stableSerialise(r);
  return s === r;
}

/**
 * Timestamp columns are excluded from the equality comparison ONLY: the client
 * submits an ISO string with a "Z" suffix and Postgres echoes its own
 * timestamptz rendering ("+00:00"), so textual equality would fail every
 * correct write. The row's existence and every business column remain fully
 * compared.
 */
const CONFIRM_EXCLUDED_COLUMNS: ReadonlySet<string> = new Set(["created_at", "updated_at"]);

type ConfirmedInsert =
  | { ok: true; stored: Record<string, unknown>; id: string }
  | { ok: false; error: string };

/**
 * INSERT one row and confirm it from the returned data. Success requires the
 * database to return the stored row, with every submitted business column
 * matching, and a non-empty id.
 */
async function insertConfirmed(
  table: string,
  payload: Record<string, unknown>,
): Promise<ConfirmedInsert> {
  const compareColumns = Object.keys(payload).filter((c) => !CONFIRM_EXCLUDED_COLUMNS.has(c));
  const projection = ["id", ...compareColumns].join(", ");

  const { data, error } = await supabase.from(table).insert(payload).select(projection);
  if (error) return { ok: false, error: errorText(error) };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return {
      ok: false,
      error: `The insert into "${table}" returned no row — nothing is confirmed as stored.`,
    };
  }

  const stored = rows[0] ?? {};
  const mismatched = compareColumns.filter((c) => !sameStoredValue(stored[c], payload[c]));
  if (mismatched.length > 0) {
    return {
      ok: false,
      error: `The row returned by "${table}" does not match the submitted values (${mismatched.join(", ")}).`,
    };
  }

  const id = stored.id;
  if (typeof id !== "string" || id === "") {
    return { ok: false, error: `The row returned by "${table}" carries no id.` };
  }
  return { ok: true, stored, id };
}

type ConfirmedUpdate =
  | { ok: true; stored: Record<string, unknown> }
  /** `resolved: true` means the request itself succeeded but stored nothing —
   * the zero-row / mismatch case that must never be reported as success. */
  | { ok: false; resolved: boolean; error: string };

/** UPDATE one row by exact id and confirm the stored values (same shape as
 * ops-runtime updateFacility / intake-save changeStage). */
async function updateConfirmed(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<ConfirmedUpdate> {
  const compareColumns = Object.keys(patch).filter((c) => !CONFIRM_EXCLUDED_COLUMNS.has(c));
  const projection = ["id", ...compareColumns].join(", ");

  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select(projection);
  if (error) return { ok: false, resolved: false, error: errorText(error) };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return {
      ok: false,
      resolved: true,
      error:
        `The change was not stored: no "${table}" record with id "${id}" was updated. ` +
        "The record may not exist, or this account may not be permitted to change it.",
    };
  }

  const stored = rows[0] ?? {};
  const mismatched = compareColumns.filter((c) => !sameStoredValue(stored[c], patch[c]));
  if (mismatched.length > 0) {
    const detail = mismatched
      .map((c) => `${c} still reads "${String(stored[c] ?? "")}"`)
      .join("; ");
    return { ok: false, resolved: true, error: `The change was not stored: ${detail}.` };
  }

  return { ok: true, stored };
}

function toWriteResult(update: ConfirmedUpdate): BotAdminWriteResult {
  if (update.ok) return { status: "stored", stored: update.stored };
  return update.resolved
    ? { status: "not_stored", error: update.error }
    : { status: "error", error: update.error };
}

function makeStep(step: string, table: string): StepReport {
  return { step, table, outcome: "not_attempted", detail: "Not attempted." };
}

function confirmStep(step: StepReport, detail: string): void {
  step.outcome = "confirmed";
  step.detail = detail;
}

function failStep(step: StepReport, detail: string): void {
  step.outcome = "failed";
  step.detail = detail;
}

function failed(
  error: string,
  steps: StepReport[],
): { status: "failed"; error: string; steps: StepReport[] } {
  return { status: "failed", error, steps };
}

// ─────────────────────────────────────────────────────────────
// Validation (established old-contract rules, enforced service-side)
// ─────────────────────────────────────────────────────────────

export function validateBotDefinition(fields: BotDefinitionFields): string[] {
  const problems: string[] = [];
  if (!fields.name || !fields.name.trim()) problems.push("Bot name is required.");
  if (!fields.type || !fields.type.trim()) problems.push("Bot type is required.");
  if (!fields.purpose || !fields.purpose.trim()) problems.push("Bot purpose is required.");
  if (!fields.rolesAllowed || fields.rolesAllowed.length === 0) {
    problems.push("At least one role must be selected.");
  }
  if (fields.rateLimit !== null && fields.rateLimit !== undefined && fields.rateLimit > RATE_LIMIT_MAX) {
    problems.push(`Rate limit cannot exceed ${RATE_LIMIT_MAX}.`);
  }
  if (fields.costCap !== null && fields.costCap !== undefined && fields.costCap > COST_CAP_MAX) {
    problems.push(`Cost cap cannot exceed $${COST_CAP_MAX}.`);
  }
  return problems;
}

function validateVersionDraft(draft: BotVersionDraft, selfBotId: string | null): string[] {
  const problems: string[] = [];
  if (draft.maxTokens !== null && draft.maxTokens !== undefined && draft.maxTokens > MAX_TOKENS_LIMIT) {
    problems.push(`Max tokens cannot exceed ${MAX_TOKENS_LIMIT}.`);
  }
  const chain = draft.chainConfig;
  // The established stored value for "no chain" is {} (manifest B-18); an
  // empty object is therefore valid, while a non-empty chain must be complete.
  if (chain && Object.keys(chain).length > 0) {
    if (!chain.next_bot_id || !chain.next_bot_id.trim()) {
      problems.push("Chain configuration requires a next_bot_id (or no chain at all).");
    } else if (selfBotId && chain.next_bot_id === selfBotId) {
      problems.push("A bot cannot chain to itself.");
    }
  }
  return problems;
}

// ─────────────────────────────────────────────────────────────
// Payload builders (exact live columns, nothing more)
// ─────────────────────────────────────────────────────────────

function buildBotDefinitionPayload(fields: BotDefinitionFields): Record<string, unknown> {
  const name = fields.name.trim();
  return {
    name,
    display_name: (fields.displayName ?? "").trim() || name,
    type: fields.type,
    purpose: fields.purpose.trim(),
    domains_allowed: fields.domainsAllowed ?? [],
    regions_allowed: fields.regionsAllowed ?? [],
    roles_allowed: fields.rolesAllowed,
    provider_id: fields.providerId ?? null,
    model: fields.model ?? null,
    rate_limit: fields.rateLimit ?? null,
    cost_cap: fields.costCap ?? null,
    timeout_sec: fields.timeoutSec ?? null,
  };
}

function buildVersionPayload(
  botId: string,
  version: number,
  draft: BotVersionDraft,
  changeNote: string,
  createdBy: string,
): Record<string, unknown> {
  return {
    bot_id: botId,
    version,
    system_instruction: draft.systemInstruction ?? null,
    custom_instruction: draft.customInstruction ?? null,
    safety_rules: draft.safetyRules ?? null,
    temperature: draft.temperature ?? null,
    max_tokens: draft.maxTokens ?? null,
    allowed_actions: draft.allowedActions ?? [],
    provider_id: draft.providerId ?? null,
    model: draft.model ?? null,
    connector_snapshot: draft.connectorSnapshot ?? {},
    permission_snapshot: draft.permissionSnapshot ?? {},
    knowledge_base_ids: draft.knowledgeBaseIds ?? [],
    change_note: changeNote,
    chain_config: draft.chainConfig ?? {},
    created_at: nowIso(),
    created_by: createdBy,
  };
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

/**
 * Classified KB-collection read for the Bot Builder knowledge picker
 * (manifest B-19), adapted to the RecordRead vocabulary the System pages
 * already render. Live state 2026-08-18: the table exists with 0 visible rows,
 * so the honest result today is `empty` — never a fabricated seed list.
 */
export async function readKnowledgeCollections(): Promise<RecordRead<KBCollection>> {
  const result = await fetchCollectionsResult();
  if (result.status === "unavailable") {
    return { status: "unavailable", rows: [], error: result.error };
  }
  if (result.status === "error") {
    return { status: "error", rows: [], error: result.error };
  }
  if (result.collections.length === 0) return { status: "empty", rows: [] };
  return { status: "loaded", rows: result.collections };
}

/**
 * Honest provider-usage summary for the provider-toggle warning
 * (manifest B-08 note). The live id scheme is mixed — 34 bots carry
 * "aip-openai-001" (matches ai_providers), 2 carry legacy "prov-openai"
 * (matches nothing) and 4 carry NULL (verified 2026-08-18) — so a count by
 * exact id match must surface the unmatched and unrecorded populations rather
 * than silently dropping them.
 */
export interface ProviderUsageSummary {
  /** provider id -> bots whose recorded provider_id matches it exactly. */
  matchedByProvider: Record<string, { total: number; active: number }>;
  /** Recorded provider ids that match no provider record, verbatim. */
  unmatched: Array<{ providerId: string; total: number; active: number }>;
  /** Bots with no recorded provider id. */
  unrecorded: { total: number; active: number };
}

export function summariseProviderUsage(
  providers: readonly AiProviderRecord[],
  bots: readonly AiBotRecord[],
): ProviderUsageSummary {
  const matchedByProvider: ProviderUsageSummary["matchedByProvider"] = {};
  for (const provider of providers) {
    matchedByProvider[provider.id] = { total: 0, active: 0 };
  }
  const unmatchedMap = new Map<string, { providerId: string; total: number; active: number }>();
  const unrecorded = { total: 0, active: 0 };

  for (const bot of bots) {
    const isActive = bot.status === "active";
    if (!bot.providerId) {
      unrecorded.total += 1;
      if (isActive) unrecorded.active += 1;
      continue;
    }
    const matched = matchedByProvider[bot.providerId];
    if (matched) {
      matched.total += 1;
      if (isActive) matched.active += 1;
      continue;
    }
    const entry = unmatchedMap.get(bot.providerId) ?? { providerId: bot.providerId, total: 0, active: 0 };
    entry.total += 1;
    if (isActive) entry.active += 1;
    unmatchedMap.set(bot.providerId, entry);
  }

  return { matchedByProvider, unmatched: [...unmatchedMap.values()], unrecorded };
}

// ─────────────────────────────────────────────────────────────
// B-04 — archive
// ─────────────────────────────────────────────────────────────
// This module deliberately exposes NO operation that stores status "active":
// `final-pack-bots.ts` and `ai-runs.ts` select bots by status = 'active', so
// such a write would change which bots execution surfaces discover — an
// activation-affecting control excluded by architect ruling (2026-08-19;
// manifest B-03 is excluded, not migrated). Status leaves "active" only via
// archive below; it is never entered from this app.

/**
 * Archive a bot (manifest B-04): status -> 'archived', confirmed by read-back.
 * Rebuilt against ai_bots directly — the old archive wrote a table the
 * registry never displayed and swallowed every failure after a success toast.
 * 'archived' against the (unverified) status constraint: a rejection surfaces
 * as an honest error.
 */
export async function archiveBot(botId: string): Promise<BotAdminWriteResult> {
  if (!botId || !botId.trim()) {
    return { status: "error", error: "A bot id is required." };
  }
  return toWriteResult(
    await updateConfirmed(AI_BOTS_TABLE, botId, { status: "archived", updated_at: nowIso() }),
  );
}

// ─────────────────────────────────────────────────────────────
// B-14 — create bot (bot row + first version + repoint)
// ─────────────────────────────────────────────────────────────

/**
 * Create a new bot definition (manifest B-14):
 *   1) INSERT ai_bots (status 'draft') — confirmed;
 *   2) INSERT ai_bot_versions (version 1) — confirmed;
 *   3) UPDATE ai_bots.current_version_id to the returned version id — confirmed.
 * On any failing step the result reports exactly what was and was not created.
 */
export async function createBot(
  input: CreateBotInput,
): Promise<BotAdminOperationResult<BotWithVersionOutcome>> {
  const steps = [
    makeStep('insert bot record into "ai_bots"', AI_BOTS_TABLE),
    makeStep('insert first version into "ai_bot_versions"', AI_BOT_VERSIONS_TABLE),
    makeStep('point "ai_bots".current_version_id at the new version', AI_BOTS_TABLE),
  ];
  const [botStep, versionStep, repointStep] = steps;

  const draft = input.version ?? {};
  const problems = [...validateBotDefinition(input), ...validateVersionDraft(draft, null)];
  if (problems.length > 0) {
    return failed(`Nothing was created: ${problems.join(" ")}`, steps);
  }

  const actor = resolveActor(input.createdBy);
  const now = nowIso();

  const botPayload: Record<string, unknown> = {
    ...buildBotDefinitionPayload(input),
    status: "draft",
    created_at: now,
    updated_at: now,
    created_by: actor,
  };
  // Optional FPS-008 columns: written only when the caller supplies them, so an
  // omitted field stays at the database default rather than being invented.
  if (input.category !== undefined) botPayload.category = input.category;
  if (input.displayOrder !== undefined) botPayload.display_order = input.displayOrder;
  if (input.allowedBlockTypes !== undefined) botPayload.allowed_block_types = input.allowedBlockTypes;
  if (input.allowedDocumentIntents !== undefined) botPayload.allowed_document_intents = input.allowedDocumentIntents;
  if (input.allowedSourceModes !== undefined) botPayload.allowed_source_modes = input.allowedSourceModes;

  const botInsert = await insertConfirmed(AI_BOTS_TABLE, botPayload);
  if (!botInsert.ok) {
    failStep(botStep, botInsert.error);
    return failed(`Nothing was created: ${botInsert.error}`, steps);
  }
  const botId = botInsert.id;
  confirmStep(botStep, `Bot record stored with id "${botId}".`);

  const changeNote = (draft.changeNote ?? "").trim() || "Initial version";
  const versionInsert = await insertConfirmed(
    AI_BOT_VERSIONS_TABLE,
    buildVersionPayload(botId, 1, draft, changeNote, actor),
  );
  if (!versionInsert.ok) {
    failStep(versionStep, versionInsert.error);
    return failed(
      `PARTIAL: the bot record WAS created (id "${botId}") but its first version row was NOT — ` +
        `the bot exists without any version. ${versionInsert.error}`,
      steps,
    );
  }
  const versionId = versionInsert.id;
  confirmStep(versionStep, `Version 1 stored with id "${versionId}".`);

  const repoint = await updateConfirmed(AI_BOTS_TABLE, botId, { current_version_id: versionId });
  if (!repoint.ok) {
    failStep(repointStep, repoint.error);
    return failed(
      `PARTIAL: bot "${botId}" and version "${versionId}" were created, but ` +
        `current_version_id was NOT set — consumers resolving the current version will find none. ` +
        repoint.error,
      steps,
    );
  }
  confirmStep(repointStep, `current_version_id now reads "${versionId}".`);

  return { status: "completed", value: { botId, versionId, version: 1 }, steps };
}

// ─────────────────────────────────────────────────────────────
// B-15 / B-17 / B-18 — edit bot + publish a new version
// ─────────────────────────────────────────────────────────────

/** Latest recorded version number for a bot (0 when none). */
async function readLatestVersion(
  botId: string,
): Promise<{ ok: true; row: Record<string, unknown> | null } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(AI_BOT_VERSIONS_TABLE)
    .select(AI_BOT_VERSIONS_COLUMNS)
    .eq("bot_id", botId)
    .order("version", { ascending: false })
    .limit(1);
  if (error) return { ok: false, error: errorText(error) };
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return { ok: true, row: rows[0] ?? null };
}

/**
 * Edit an existing bot's definition and publish a new immutable version row
 * (manifest B-15; the builder's save path). Steps, in the established order:
 *   1) UPDATE ai_bots — explicit definition columns only. `status` is NOT in
 *      the payload (preserved by omission) and the FPS-008 columns are NEVER
 *      touched (the form does not edit them);
 *   2) INSERT ai_bot_versions with version = latest + 1 and a mandatory,
 *      non-empty change note (carries allowed_actions, chain_config,
 *      knowledge_base_ids, snapshots — B-17/B-18/B-19 payloads);
 *   3) UPDATE ai_bots.current_version_id to the new version id — the REPOINT
 *      the old app forgot, which left consumers serving the stale instruction.
 */
export async function publishBotVersion(
  botId: string,
  fields: BotDefinitionFields,
  draft: BotVersionDraft,
): Promise<BotAdminOperationResult<BotWithVersionOutcome>> {
  const steps = [
    makeStep('update bot definition in "ai_bots"', AI_BOTS_TABLE),
    makeStep('insert new version into "ai_bot_versions"', AI_BOT_VERSIONS_TABLE),
    makeStep('repoint "ai_bots".current_version_id at the new version', AI_BOTS_TABLE),
  ];
  const [botStep, versionStep, repointStep] = steps;

  if (!botId || !botId.trim()) {
    return failed("Nothing was published: a bot id is required.", steps);
  }
  const changeNote = (draft.changeNote ?? "").trim();
  const problems = [...validateBotDefinition(fields), ...validateVersionDraft(draft, botId)];
  if (!changeNote) {
    problems.push("A change note is required to publish a new version.");
  }
  if (problems.length > 0) {
    return failed(`Nothing was published: ${problems.join(" ")}`, steps);
  }

  const latest = await readLatestVersion(botId);
  if (!latest.ok) {
    return failed(
      `Nothing was published: the recorded version history could not be read, so the next ` +
        `version number is unknown. ${latest.error}`,
      steps,
    );
  }
  const latestNumber = typeof latest.row?.version === "number" ? (latest.row.version as number) : 0;
  const nextVersion = latestNumber + 1;

  const botUpdate = await updateConfirmed(AI_BOTS_TABLE, botId, {
    ...buildBotDefinitionPayload(fields),
    updated_at: nowIso(),
  });
  if (!botUpdate.ok) {
    failStep(botStep, botUpdate.error);
    return failed(`Nothing was published: ${botUpdate.error}`, steps);
  }
  confirmStep(botStep, `Bot definition stored for id "${botId}".`);

  const actor = resolveActor();
  const versionInsert = await insertConfirmed(
    AI_BOT_VERSIONS_TABLE,
    buildVersionPayload(botId, nextVersion, draft, changeNote, actor),
  );
  if (!versionInsert.ok) {
    failStep(versionStep, versionInsert.error);
    return failed(
      `PARTIAL: the bot definition WAS updated but version ${nextVersion} was NOT created — ` +
        `consumers still serve version ${latestNumber || "none"}. ${versionInsert.error}`,
      steps,
    );
  }
  const versionId = versionInsert.id;
  confirmStep(versionStep, `Version ${nextVersion} stored with id "${versionId}".`);

  const repoint = await updateConfirmed(AI_BOTS_TABLE, botId, { current_version_id: versionId });
  if (!repoint.ok) {
    failStep(repointStep, repoint.error);
    return failed(
      `PARTIAL: version ${nextVersion} ("${versionId}") was created but current_version_id was ` +
        `NOT repointed — consumers that resolve the current version still serve the OLD version. ` +
        repoint.error,
      steps,
    );
  }
  confirmStep(repointStep, `current_version_id now reads "${versionId}".`);

  return { status: "completed", value: { botId, versionId, version: nextVersion }, steps };
}

// ─────────────────────────────────────────────────────────────
// B-05 — duplicate bot as a draft copy
// ─────────────────────────────────────────────────────────────

export interface DuplicateBotOutcome {
  botId: string;
  name: string;
  /** Null when the source bot has no version row to copy. */
  versionId: string | null;
  copiedVersion: boolean;
}

/**
 * Duplicate a bot as a new draft (manifest B-05): copies the FULL definition
 * (including the FPS-008 columns the old clone dropped) plus the source's
 * current version row as version 1 of the copy, then points the copy's
 * current_version_id at it. Every step is confirmed from returned rows; there
 * is no local-only fallback and no success toast without stored truth.
 */
export async function duplicateBot(
  sourceBotId: string,
  options?: { createdBy?: string },
): Promise<BotAdminOperationResult<DuplicateBotOutcome>> {
  const steps = [
    makeStep('read source bot from "ai_bots"', AI_BOTS_TABLE),
    makeStep('read source version from "ai_bot_versions"', AI_BOT_VERSIONS_TABLE),
    makeStep('insert copied bot into "ai_bots"', AI_BOTS_TABLE),
    makeStep('insert copied version into "ai_bot_versions"', AI_BOT_VERSIONS_TABLE),
    makeStep('point the copy\'s current_version_id at the copied version', AI_BOTS_TABLE),
  ];
  const [readBotStep, readVersionStep, insertBotStep, insertVersionStep, repointStep] = steps;

  if (!sourceBotId || !sourceBotId.trim()) {
    return failed("Nothing was duplicated: a source bot id is required.", steps);
  }

  const sourceRes = await supabase
    .from(AI_BOTS_TABLE)
    .select(AI_BOTS_ADMIN_COLUMNS)
    .eq("id", sourceBotId)
    .maybeSingle();
  if (sourceRes.error) {
    failStep(readBotStep, errorText(sourceRes.error));
    return failed(`Nothing was duplicated: the source bot could not be read. ${errorText(sourceRes.error)}`, steps);
  }
  const source = sourceRes.data as Record<string, unknown> | null;
  if (!source) {
    failStep(readBotStep, `No bot with id "${sourceBotId}" is visible to this account.`);
    return failed(
      `Nothing was duplicated: no bot with id "${sourceBotId}" is visible to this account.`,
      steps,
    );
  }
  confirmStep(readBotStep, `Source bot "${String(source.name ?? sourceBotId)}" read.`);

  // Source version: the row current_version_id names, else the latest row.
  let sourceVersion: Record<string, unknown> | null = null;
  const currentVersionId = source.current_version_id;
  if (typeof currentVersionId === "string" && currentVersionId !== "") {
    const versionRes = await supabase
      .from(AI_BOT_VERSIONS_TABLE)
      .select(AI_BOT_VERSIONS_COLUMNS)
      .eq("id", currentVersionId)
      .maybeSingle();
    if (versionRes.error) {
      failStep(readVersionStep, errorText(versionRes.error));
      return failed(
        `Nothing was duplicated: the source's current version could not be read. ${errorText(versionRes.error)}`,
        steps,
      );
    }
    sourceVersion = (versionRes.data as Record<string, unknown> | null) ?? null;
  }
  if (!sourceVersion) {
    const latest = await readLatestVersion(sourceBotId);
    if (!latest.ok) {
      failStep(readVersionStep, latest.error);
      return failed(
        `Nothing was duplicated: the source's version history could not be read. ${latest.error}`,
        steps,
      );
    }
    sourceVersion = latest.row;
  }
  confirmStep(
    readVersionStep,
    sourceVersion
      ? `Source version ${String(sourceVersion.version ?? "?")} read.`
      : "The source bot has no version row — the copy will be definition-only, like its source.",
  );

  const actor = resolveActor(options?.createdBy);
  const now = nowIso();
  const sourceName = typeof source.name === "string" && source.name ? source.name : sourceBotId;
  const copyName = `${sourceName} (Copy)`;
  const sourceDisplay =
    typeof source.display_name === "string" && source.display_name ? source.display_name : sourceName;

  const botInsert = await insertConfirmed(AI_BOTS_TABLE, {
    name: copyName,
    display_name: `${sourceDisplay} (Copy)`,
    type: source.type ?? null,
    status: "draft",
    purpose: source.purpose ?? null,
    domains_allowed: source.domains_allowed ?? [],
    regions_allowed: source.regions_allowed ?? [],
    roles_allowed: source.roles_allowed ?? [],
    provider_id: source.provider_id ?? null,
    model: source.model ?? null,
    rate_limit: source.rate_limit ?? null,
    cost_cap: source.cost_cap ?? null,
    timeout_sec: source.timeout_sec ?? null,
    // FPS-008 columns — the old clone dropped these; the copy must carry them.
    category: source.category ?? null,
    display_order: source.display_order ?? null,
    allowed_block_types: source.allowed_block_types ?? [],
    allowed_document_intents: source.allowed_document_intents ?? [],
    allowed_source_modes: source.allowed_source_modes ?? [],
    created_at: now,
    updated_at: now,
    created_by: actor,
  });
  if (!botInsert.ok) {
    failStep(insertBotStep, botInsert.error);
    return failed(`Nothing was duplicated: ${botInsert.error}`, steps);
  }
  const copyId = botInsert.id;
  confirmStep(insertBotStep, `Copy stored as draft with id "${copyId}".`);

  if (!sourceVersion) {
    insertVersionStep.outcome = "confirmed";
    insertVersionStep.detail = "Skipped: the source bot has no version row to copy.";
    repointStep.outcome = "confirmed";
    repointStep.detail = "Skipped: no copied version to point at.";
    return {
      status: "completed",
      value: { botId: copyId, name: copyName, versionId: null, copiedVersion: false },
      steps,
    };
  }

  const versionInsert = await insertConfirmed(AI_BOT_VERSIONS_TABLE, {
    bot_id: copyId,
    version: 1,
    system_instruction: sourceVersion.system_instruction ?? null,
    custom_instruction: sourceVersion.custom_instruction ?? null,
    safety_rules: sourceVersion.safety_rules ?? null,
    temperature: sourceVersion.temperature ?? null,
    max_tokens: sourceVersion.max_tokens ?? null,
    allowed_actions: sourceVersion.allowed_actions ?? [],
    provider_id: sourceVersion.provider_id ?? null,
    model: sourceVersion.model ?? null,
    connector_snapshot: sourceVersion.connector_snapshot ?? {},
    permission_snapshot: sourceVersion.permission_snapshot ?? {},
    knowledge_base_ids: sourceVersion.knowledge_base_ids ?? [],
    change_note: `Duplicated from "${sourceName}" (version ${String(sourceVersion.version ?? "?")}).`,
    chain_config: sourceVersion.chain_config ?? {},
    created_at: now,
    created_by: actor,
  });
  if (!versionInsert.ok) {
    failStep(insertVersionStep, versionInsert.error);
    return failed(
      `PARTIAL: the copied bot WAS created (id "${copyId}") but its version row was NOT — ` +
        `the copy exists without instructions. ${versionInsert.error}`,
      steps,
    );
  }
  confirmStep(insertVersionStep, `Copied version stored with id "${versionInsert.id}".`);

  const repoint = await updateConfirmed(AI_BOTS_TABLE, copyId, {
    current_version_id: versionInsert.id,
  });
  if (!repoint.ok) {
    failStep(repointStep, repoint.error);
    return failed(
      `PARTIAL: copy "${copyId}" and its version "${versionInsert.id}" were created, but ` +
        `current_version_id was NOT set on the copy. ${repoint.error}`,
      steps,
    );
  }
  confirmStep(repointStep, `current_version_id now reads "${versionInsert.id}".`);

  return {
    status: "completed",
    value: { botId: copyId, name: copyName, versionId: versionInsert.id, copiedVersion: true },
    steps,
  };
}

// ─────────────────────────────────────────────────────────────
// B-06 — delete bot (draft/disabled only)
// ─────────────────────────────────────────────────────────────

export interface DeleteBotOutcome {
  botId: string;
  deletedVersionCount: number;
}

/**
 * Delete a bot (manifest B-06). Permitted ONLY for draft/disabled bots (the
 * old registry contract). The FK behaviour of ai_bot_versions.bot_id and
 * ai_bots.current_version_id is UNVERIFIED live, so nothing relies on a
 * cascade: current_version_id is cleared first, version rows are deleted and
 * counted against the captured expectation, then the bot row is deleted — and
 * a zero-row delete of the bot row is a failure, not success. All deletes use
 * the exact captured id (QA-cleanup doctrine: never broad filters).
 */
export async function deleteBot(
  botId: string,
): Promise<BotAdminOperationResult<DeleteBotOutcome>> {
  const steps = [
    makeStep('read bot and confirm deletable status from "ai_bots"', AI_BOTS_TABLE),
    makeStep('clear "ai_bots".current_version_id', AI_BOTS_TABLE),
    makeStep('delete version rows from "ai_bot_versions"', AI_BOT_VERSIONS_TABLE),
    makeStep('delete bot row from "ai_bots"', AI_BOTS_TABLE),
  ];
  const [readStep, clearStep, versionsStep, botStep] = steps;

  if (!botId || !botId.trim()) {
    return failed("Nothing was deleted: a bot id is required.", steps);
  }

  const botRes = await supabase
    .from(AI_BOTS_TABLE)
    .select("id, name, status, current_version_id")
    .eq("id", botId)
    .maybeSingle();
  if (botRes.error) {
    failStep(readStep, errorText(botRes.error));
    return failed(`Nothing was deleted: the bot could not be read. ${errorText(botRes.error)}`, steps);
  }
  const bot = botRes.data as
    | { id: string; name?: string | null; status?: string | null; current_version_id?: string | null }
    | null;
  if (!bot) {
    failStep(readStep, `No bot with id "${botId}" is visible to this account.`);
    return failed(
      `Nothing was deleted: no bot with id "${botId}" is visible to this account.`,
      steps,
    );
  }
  const status = bot.status ?? "";
  if (!BOT_DELETABLE_STATUSES.has(status)) {
    failStep(
      readStep,
      `Bot status is "${status}" — only ${[...BOT_DELETABLE_STATUSES].join("/")} bots may be deleted.`,
    );
    return failed(
      `Nothing was deleted: bot "${bot.name ?? botId}" has status "${status}"; ` +
        `only ${[...BOT_DELETABLE_STATUSES].join("/")} bots may be deleted.`,
      steps,
    );
  }
  confirmStep(readStep, `Bot "${bot.name ?? botId}" read; status "${status}" permits deletion.`);

  // Capture the exact version ids we expect to delete BEFORE deleting.
  const versionIdsRes = await supabase
    .from(AI_BOT_VERSIONS_TABLE)
    .select("id")
    .eq("bot_id", botId);
  if (versionIdsRes.error) {
    failStep(versionsStep, errorText(versionIdsRes.error));
    return failed(
      `Nothing was deleted: the bot's version rows could not be read. ${errorText(versionIdsRes.error)}`,
      steps,
    );
  }
  const expectedVersionIds = ((versionIdsRes.data ?? []) as Array<{ id: string }>).map((r) => r.id);

  // Clear the current_version_id FK reference before deleting version rows.
  if (bot.current_version_id) {
    const clear = await updateConfirmed(AI_BOTS_TABLE, botId, { current_version_id: null });
    if (!clear.ok) {
      failStep(clearStep, clear.error);
      return failed(
        `Nothing was deleted: current_version_id could not be cleared, so the version rows ` +
          `were not touched. ${clear.error}`,
        steps,
      );
    }
    confirmStep(clearStep, "current_version_id cleared.");
  } else {
    confirmStep(clearStep, "Skipped: current_version_id was already null.");
  }

  const deleteVersionsRes = await supabase
    .from(AI_BOT_VERSIONS_TABLE)
    .delete()
    .eq("bot_id", botId)
    .select("id");
  if (deleteVersionsRes.error) {
    failStep(versionsStep, errorText(deleteVersionsRes.error));
    return failed(
      `PARTIAL: current_version_id was cleared but the version rows were NOT deleted and the ` +
        `bot row still exists. ${errorText(deleteVersionsRes.error)}`,
      steps,
    );
  }
  const deletedVersionIds = ((deleteVersionsRes.data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (deletedVersionIds.length !== expectedVersionIds.length) {
    failStep(
      versionsStep,
      `Expected to delete ${expectedVersionIds.length} version row(s); the database deleted ` +
        `${deletedVersionIds.length}.`,
    );
    return failed(
      `PARTIAL: ${deletedVersionIds.length} of ${expectedVersionIds.length} version row(s) were ` +
        `deleted and the bot row was NOT deleted. The record is now in a partially-deleted state.`,
      steps,
    );
  }
  confirmStep(versionsStep, `${deletedVersionIds.length} version row(s) deleted (all that existed).`);

  const deleteBotRes = await supabase
    .from(AI_BOTS_TABLE)
    .delete()
    .eq("id", botId)
    .select("id");
  if (deleteBotRes.error) {
    failStep(botStep, errorText(deleteBotRes.error));
    return failed(
      `PARTIAL: the ${deletedVersionIds.length} version row(s) WERE deleted but the bot row was ` +
        `NOT — bot "${botId}" still exists without versions. ${errorText(deleteBotRes.error)}`,
      steps,
    );
  }
  const deletedBots = (deleteBotRes.data ?? []) as Array<{ id: string }>;
  if (deletedBots.length === 0) {
    failStep(botStep, "The delete matched no row — the bot row was not removed.");
    return failed(
      `PARTIAL: the ${deletedVersionIds.length} version row(s) WERE deleted but the bot-row ` +
        `delete matched nothing — bot "${botId}" may still exist without versions. ` +
        "This account may not be permitted to delete it.",
      steps,
    );
  }
  confirmStep(botStep, `Bot row "${botId}" deleted.`);

  return {
    status: "completed",
    value: { botId, deletedVersionCount: deletedVersionIds.length },
    steps,
  };
}

// ─────────────────────────────────────────────────────────────
// B-19 — attach / detach knowledge collections
// ─────────────────────────────────────────────────────────────

export interface KnowledgeLinkOutcome {
  botId: string;
  versionId: string;
  version: number;
  knowledgeBaseIds: string[];
}

/**
 * Shared implementation for attach/detach (manifest B-19). The established,
 * verified contract is the VERSION-COLUMN one: `ai_bot_versions
 * .knowledge_base_ids` is a text[] of exact collection ids written with each
 * new version row (the bot_kb_links table belongs to the rejected
 * EditorBotBuilder surface, row B-28 — not used here). Changing the linked
 * collections therefore publishes a new version row that carries every other
 * recorded field forward VERBATIM from the latest version (nothing invented),
 * then repoints current_version_id.
 */
async function writeKnowledgeLink(
  botId: string,
  collectionId: string,
  changeNote: string,
  mode: "attach" | "detach",
  createdBy?: string,
): Promise<BotAdminOperationResult<KnowledgeLinkOutcome>> {
  const steps = [
    makeStep('read bot from "ai_bots"', AI_BOTS_TABLE),
    makeStep('read latest version from "ai_bot_versions"', AI_BOT_VERSIONS_TABLE),
    makeStep('insert new version with the updated knowledge_base_ids', AI_BOT_VERSIONS_TABLE),
    makeStep('repoint "ai_bots".current_version_id at the new version', AI_BOTS_TABLE),
  ];
  const [readBotStep, readVersionStep, insertStep, repointStep] = steps;

  const verb = mode === "attach" ? "attached" : "detached";
  if (!botId || !botId.trim()) {
    return failed(`Nothing was ${verb}: a bot id is required.`, steps);
  }
  if (!collectionId || !collectionId.trim()) {
    return failed(`Nothing was ${verb}: a knowledge collection id is required.`, steps);
  }
  const note = changeNote.trim();
  if (!note) {
    return failed(
      `Nothing was ${verb}: a change note is required — knowledge changes publish a new version.`,
      steps,
    );
  }

  const botRes = await supabase
    .from(AI_BOTS_TABLE)
    .select("id, name, current_version_id")
    .eq("id", botId)
    .maybeSingle();
  if (botRes.error) {
    failStep(readBotStep, errorText(botRes.error));
    return failed(`Nothing was ${verb}: the bot could not be read. ${errorText(botRes.error)}`, steps);
  }
  if (!botRes.data) {
    failStep(readBotStep, `No bot with id "${botId}" is visible to this account.`);
    return failed(`Nothing was ${verb}: no bot with id "${botId}" is visible to this account.`, steps);
  }
  confirmStep(readBotStep, "Bot read.");

  const latest = await readLatestVersion(botId);
  if (!latest.ok) {
    failStep(readVersionStep, latest.error);
    return failed(
      `Nothing was ${verb}: the recorded version history could not be read. ${latest.error}`,
      steps,
    );
  }
  const latestRow = latest.row;
  confirmStep(
    readVersionStep,
    latestRow
      ? `Latest version ${String(latestRow.version ?? "?")} read.`
      : "The bot has no version row yet — the new version starts from an empty configuration.",
  );

  const currentIds: string[] = Array.isArray(latestRow?.knowledge_base_ids)
    ? [...(latestRow!.knowledge_base_ids as string[])]
    : [];
  let nextIds: string[];
  if (mode === "attach") {
    if (currentIds.includes(collectionId)) {
      return failed(
        `Nothing was attached: collection "${collectionId}" is already linked to this bot — ` +
          "no new version was published.",
        steps,
      );
    }
    nextIds = [...currentIds, collectionId];
  } else {
    if (!currentIds.includes(collectionId)) {
      return failed(
        `Nothing was detached: collection "${collectionId}" is not linked to this bot — ` +
          "no new version was published.",
        steps,
      );
    }
    nextIds = currentIds.filter((id) => id !== collectionId);
  }

  const latestNumber = typeof latestRow?.version === "number" ? (latestRow.version as number) : 0;
  const nextVersion = latestNumber + 1;
  const actor = resolveActor(createdBy);

  // Carry every recorded field forward verbatim; only knowledge_base_ids and
  // the change note differ from the latest version.
  const carryForward: BotVersionDraft = {
    systemInstruction: (latestRow?.system_instruction as string | null) ?? null,
    customInstruction: (latestRow?.custom_instruction as string | null) ?? null,
    safetyRules: (latestRow?.safety_rules as string | null) ?? null,
    temperature: (latestRow?.temperature as number | null) ?? null,
    maxTokens: (latestRow?.max_tokens as number | null) ?? null,
    allowedActions: Array.isArray(latestRow?.allowed_actions)
      ? (latestRow!.allowed_actions as string[])
      : [],
    providerId: (latestRow?.provider_id as string | null) ?? null,
    model: (latestRow?.model as string | null) ?? null,
    connectorSnapshot:
      latestRow && typeof latestRow.connector_snapshot === "object" && latestRow.connector_snapshot !== null
        ? (latestRow.connector_snapshot as Record<string, unknown>)
        : {},
    permissionSnapshot:
      latestRow && typeof latestRow.permission_snapshot === "object" && latestRow.permission_snapshot !== null
        ? (latestRow.permission_snapshot as Record<string, unknown>)
        : {},
    knowledgeBaseIds: nextIds,
    chainConfig:
      latestRow && typeof latestRow.chain_config === "object" && latestRow.chain_config !== null
        ? (latestRow.chain_config as unknown as ChainConfig)
        : null,
  };

  const versionInsert = await insertConfirmed(
    AI_BOT_VERSIONS_TABLE,
    buildVersionPayload(botId, nextVersion, carryForward, note, actor),
  );
  if (!versionInsert.ok) {
    failStep(insertStep, versionInsert.error);
    return failed(`Nothing was ${verb}: the new version row was not created. ${versionInsert.error}`, steps);
  }
  confirmStep(insertStep, `Version ${nextVersion} stored with id "${versionInsert.id}".`);

  const repoint = await updateConfirmed(AI_BOTS_TABLE, botId, {
    current_version_id: versionInsert.id,
  });
  if (!repoint.ok) {
    failStep(repointStep, repoint.error);
    return failed(
      `PARTIAL: version ${nextVersion} ("${versionInsert.id}") records the ${verb} collection ` +
        `but current_version_id was NOT repointed — consumers still serve the previous version. ` +
        repoint.error,
      steps,
    );
  }
  confirmStep(repointStep, `current_version_id now reads "${versionInsert.id}".`);

  return {
    status: "completed",
    value: { botId, versionId: versionInsert.id, version: nextVersion, knowledgeBaseIds: nextIds },
    steps,
  };
}

/** Attach a knowledge collection to a bot (manifest B-19). */
export async function attachKnowledge(
  botId: string,
  collectionId: string,
  changeNote: string,
  options?: { createdBy?: string },
): Promise<BotAdminOperationResult<KnowledgeLinkOutcome>> {
  return writeKnowledgeLink(botId, collectionId, changeNote, "attach", options?.createdBy);
}

/** Detach a knowledge collection from a bot (manifest B-19). */
export async function detachKnowledge(
  botId: string,
  collectionId: string,
  changeNote: string,
  options?: { createdBy?: string },
): Promise<BotAdminOperationResult<KnowledgeLinkOutcome>> {
  return writeKnowledgeLink(botId, collectionId, changeNote, "detach", options?.createdBy);
}
