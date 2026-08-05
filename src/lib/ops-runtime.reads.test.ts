/**
 * ops-runtime.reads.test.ts — SC-01 Wave 04, lane T07-C (System surfaces).
 *
 * These tests guard the corrections made to /system/admin, /system/audit,
 * /system/bots, /system/bot-builder and /system/bot-audit. The rule they pin
 * is the one Wave 04 exists for:
 *
 *     A FAILED READ IS NOT AN EMPTY RESULT.
 *
 * Every reader must answer with four distinguishable outcomes, and the
 * assertions check what actually reaches the database — the table name and the
 * exact `select` projection — not merely what the function returns.
 *
 * MOCK CONTRACT: the stub below records the projection string and only ever
 * returns the rows a test installs. It does not invent columns the query did
 * not ask for; a mock that returns fields the query never selected has
 * previously certified a fabrication in this codebase.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Terminal = { data?: unknown; error?: unknown };

interface RecordedCall {
  table: string;
  columns: string | null;
  order: Array<[string, boolean | undefined]>;
  eq: Array<[string, unknown]>;
  limit: number | null;
  terminal: "list" | "maybeSingle";
}

const results = new Map<string, Terminal>();
const calls: RecordedCall[] = [];

function makeBuilder(table: string) {
  const call: RecordedCall = {
    table, columns: null, order: [], eq: [], limit: null, terminal: "list",
  };
  calls.push(call);

  const resolveResult = (): Terminal => results.get(table) ?? { data: [], error: null };

  const builder: any = {
    select: (cols?: string, opts?: { head?: boolean; count?: string }) => {
      call.columns = cols ?? null;
      if (opts?.head) return Promise.resolve(resolveResult());
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      call.order.push([col, opts?.ascending]);
      return builder;
    },
    eq: (col: string, value: unknown) => {
      call.eq.push([col, value]);
      return builder;
    },
    limit: (n: number) => { call.limit = n; return builder; },
    maybeSingle: () => { call.terminal = "maybeSingle"; return Promise.resolve(resolveResult()); },
    then: (resolve: (v: Terminal) => unknown) => resolve(resolveResult()),
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import {
  AI_BOTS_COLUMNS,
  AI_BOTS_TABLE,
  AI_BOT_VERSIONS_COLUMNS,
  AI_BOT_VERSIONS_TABLE,
  AI_PROVIDERS_COLUMNS,
  AI_PROVIDERS_TABLE,
  AI_USAGE_LOGS_COLUMNS,
  AI_USAGE_LOGS_DEFAULT_LIMIT,
  AI_USAGE_LOGS_TABLE,
  AUDIT_LOG_COLUMNS,
  AUDIT_LOG_TABLE,
  FACILITIES_COLUMNS,
  FACILITIES_TABLE,
  describeRecordRead,
  readAiBots,
  readAiProviders,
  readAiUsageLogs,
  readAuditTrail,
  readBotConfiguration,
  readFacilities,
  readIntegrationStatus,
  resolveBotProviderLabel,
  summariseUsageNumber,
  type AiProviderRecord,
  type AiUsageLogRecord,
} from "./ops-runtime";

beforeEach(() => {
  results.clear();
  calls.length = 0;
  // The clean-server probe inside readIntegrationStatus must never reach the
  // network from a unit test.
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network disabled in tests"); }));
});

const lastCallFor = (table: string) => calls.filter(c => c.table === table).at(-1)!;

// ─────────────────────────────────────────────────────────────
// Audit Trail (/system/audit)
// ─────────────────────────────────────────────────────────────

describe("readAuditTrail — the Audit Trail page's only data source", () => {
  it("reads audit_log with the projection the page renders, newest first", async () => {
    results.set(AUDIT_LOG_TABLE, { data: [], error: null });
    await readAuditTrail();

    const call = lastCallFor(AUDIT_LOG_TABLE);
    expect(call.table).toBe("audit_log");
    expect(call.columns).toBe(AUDIT_LOG_COLUMNS);
    // Every field the page displays must be in the projection.
    for (const column of ["id", "entity_type", "entity_id", "action", "user_id", "user_name", "timestamp", "details"]) {
      expect(call.columns).toContain(column);
    }
    expect(call.order).toEqual([["timestamp", false]]);
  });

  it("reports a successful zero-row read as EMPTY, not as an error", async () => {
    // This is the live anonymous-client result probed 2026-08-05: HTTP 200, 0 rows.
    results.set(AUDIT_LOG_TABLE, { data: [], error: null });
    const read = await readAuditTrail();
    expect(read.status).toBe("empty");
    expect(read.rows).toEqual([]);
  });

  it("reports a failed read as ERROR, carrying the real message — never as empty", async () => {
    results.set(AUDIT_LOG_TABLE, { data: null, error: { code: "42501", message: "permission denied for table audit_log" } });
    const read = await readAuditTrail();
    expect(read.status).toBe("error");
    expect(read.status).not.toBe("empty");
    expect(read).toMatchObject({ error: "permission denied for table audit_log", rows: [] });
  });

  it("reports a missing table as UNAVAILABLE, distinct from both empty and error", async () => {
    results.set(AUDIT_LOG_TABLE, { data: null, error: { code: "PGRST205", message: "Could not find the table" } });
    const read = await readAuditTrail();
    expect(read.status).toBe("unavailable");
  });

  it("maps only recorded columns and never substitutes a value", async () => {
    results.set(AUDIT_LOG_TABLE, {
      data: [{
        id: "a1", entity_type: "quote", entity_id: "q1", action: "approve",
        user_id: "u1", user_name: null, timestamp: "2026-08-05T00:00:00Z", details: null,
      }],
      error: null,
    });
    const read = await readAuditTrail();
    expect(read.status).toBe("loaded");
    expect(read.rows[0]).toEqual({
      id: "a1", entityType: "quote", entityId: "q1", action: "approve",
      userId: "u1", userName: "", timestamp: "2026-08-05T00:00:00Z", details: "",
    });
  });

  it("describeRecordRead phrases a zero-row read as visibility, never as 'the table is empty'", async () => {
    results.set(AUDIT_LOG_TABLE, { data: [], error: null });
    const sentence = describeRecordRead(await readAuditTrail(), "audit records");
    expect(sentence).toContain("visible to this account");
    expect(sentence).not.toMatch(/there are no|table is empty/i);
  });
});

// ─────────────────────────────────────────────────────────────
// Bots (/system/bots) and providers
// ─────────────────────────────────────────────────────────────

describe("readAiBots / readAiProviders", () => {
  it("reads ai_bots with an explicit projection and no runtime-metric columns", async () => {
    results.set(AI_BOTS_TABLE, { data: [], error: null });
    await readAiBots();

    const call = lastCallFor(AI_BOTS_TABLE);
    expect(call.columns).toBe(AI_BOTS_COLUMNS);
    // ai_bots records no invocation history. Selecting these would be asking
    // for columns that do not exist, and rendering them was the fabrication.
    for (const absent of ["total_invocations", "cost_usage", "error_rate", "last_run_at"]) {
      expect(call.columns).not.toContain(absent);
    }
  });

  it("keeps unrecorded bot configuration as null instead of inventing defaults", async () => {
    // A real ai_bots row can carry nulls. The old mapper turned these into
    // 20 / 10 / 30 / 'gpt-4o' and the page showed them as stored configuration.
    results.set(AI_BOTS_TABLE, {
      data: [{
        id: "b1", name: "raw", display_name: "Raw Bot", type: "action", status: "draft",
        purpose: null, domains_allowed: null, regions_allowed: null, roles_allowed: null,
        current_version_id: null, provider_id: null, model: null,
        rate_limit: null, cost_cap: null, timeout_sec: null,
        created_at: "2026-01-01", updated_at: "2026-01-02",
      }],
      error: null,
    });
    const read = await readAiBots();
    expect(read.status).toBe("loaded");
    const bot = read.rows[0];
    expect(bot.model).toBeNull();
    expect(bot.rateLimit).toBeNull();
    expect(bot.costCap).toBeNull();
    expect(bot.timeoutSec).toBeNull();
    expect(bot.providerId).toBeNull();
    expect(bot.name).toBe("Raw Bot");
    expect(bot.domainsAllowed).toEqual([]);
  });

  it("separates a failed ai_bots read from a genuinely empty registry", async () => {
    results.set(AI_BOTS_TABLE, { data: null, error: { code: "08006", message: "connection failure" } });
    expect((await readAiBots()).status).toBe("error");

    results.set(AI_BOTS_TABLE, { data: [], error: null });
    expect((await readAiBots()).status).toBe("empty");
  });

  it("reads ai_providers with the projection the provider cards render", async () => {
    results.set(AI_PROVIDERS_TABLE, { data: [], error: null });
    await readAiProviders();
    const call = lastCallFor(AI_PROVIDERS_TABLE);
    expect(call.columns).toBe(AI_PROVIDERS_COLUMNS);
    expect(call.order).toEqual([["name", undefined]]);
  });
});

describe("resolveBotProviderLabel — the 'undefined' provider defect", () => {
  const providers: AiProviderRecord[] = [{
    id: "aip-openai-001", name: "openai", displayName: "OpenAI",
    modelDefault: "gpt-4o-mini", models: ["gpt-4o"], enabled: true, config: {},
  }];

  it("returns the display name when the recorded id matches a provider record", () => {
    const r = resolveBotProviderLabel("aip-openai-001", providers);
    expect(r).toEqual({ matched: true, label: "OpenAI" });
  });

  it("reports an unmatched id honestly instead of rendering 'undefined'", () => {
    // Live data: ai_bots.provider_id = "prov-openai" while
    // ai_providers.id = "aip-openai-001". The old UI printed `provider?.name`,
    // which rendered the literal string "undefined" for every bot.
    const r = resolveBotProviderLabel("prov-openai", providers);
    expect(r.matched).toBe(false);
    expect(r.label).toBe("prov-openai (no matching provider record)");
    expect(r.label).not.toContain("undefined");
  });

  it("reports a null provider id as not recorded, and guesses nothing", () => {
    const r = resolveBotProviderLabel(null, providers);
    expect(r).toEqual({ matched: false, label: "No provider recorded" });
  });

  it("does not fall back to the only provider when there is exactly one", () => {
    expect(resolveBotProviderLabel("prov-openai", providers).matched).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Bot Builder (/system/bot-builder)
// ─────────────────────────────────────────────────────────────

describe("readBotConfiguration", () => {
  it("queries the requested bot id and its versions with explicit projections", async () => {
    results.set(AI_BOTS_TABLE, { data: { id: "b1", display_name: "B", type: "action" }, error: null });
    results.set(AI_BOT_VERSIONS_TABLE, { data: [], error: null });

    const read = await readBotConfiguration("b1");
    expect(read.status).toBe("loaded");

    const botCall = lastCallFor(AI_BOTS_TABLE);
    expect(botCall.columns).toBe(AI_BOTS_COLUMNS);
    expect(botCall.eq).toEqual([["id", "b1"]]);
    expect(botCall.terminal).toBe("maybeSingle");

    const versionCall = lastCallFor(AI_BOT_VERSIONS_TABLE);
    expect(versionCall.columns).toBe(AI_BOT_VERSIONS_COLUMNS);
    expect(versionCall.eq).toEqual([["bot_id", "b1"]]);
    expect(versionCall.order).toEqual([["version", false]]);
  });

  it("distinguishes 'no such bot visible' from 'the read failed'", async () => {
    results.set(AI_BOTS_TABLE, { data: null, error: null });
    expect((await readBotConfiguration("missing")).status).toBe("not_found");

    results.set(AI_BOTS_TABLE, { data: null, error: { code: "42501", message: "permission denied" } });
    const failed = await readBotConfiguration("b1");
    expect(failed.status).toBe("error");
    expect(failed).toMatchObject({ error: "permission denied" });
  });

  it("reports a bot whose version read fails as an error, not as a bot with no versions", async () => {
    results.set(AI_BOTS_TABLE, { data: { id: "b1" }, error: null });
    results.set(AI_BOT_VERSIONS_TABLE, { data: null, error: { message: "timeout" } });
    const read = await readBotConfiguration("b1");
    expect(read.status).toBe("error");
    expect(read.versions).toEqual([]);
  });

  it("returns zero versions for a bot that genuinely has none — no synthetic v1", async () => {
    results.set(AI_BOTS_TABLE, { data: { id: "b1", display_name: "B" }, error: null });
    results.set(AI_BOT_VERSIONS_TABLE, { data: [], error: null });
    const read = await readBotConfiguration("b1");
    expect(read.status).toBe("loaded");
    expect(read.versions).toEqual([]);
  });

  it("keeps unrecorded version fields null rather than defaulting temperature/tokens", async () => {
    results.set(AI_BOTS_TABLE, { data: { id: "b1" }, error: null });
    results.set(AI_BOT_VERSIONS_TABLE, {
      data: [{ id: "v1", bot_id: "b1", version: 3, temperature: null, max_tokens: null, connector_snapshot: null, chain_config: null }],
      error: null,
    });
    const read = await readBotConfiguration("b1");
    expect(read.status).toBe("loaded");
    expect(read.versions[0].temperature).toBeNull();
    expect(read.versions[0].maxTokens).toBeNull();
    expect(read.versions[0].connectorSnapshot).toBeNull();
    expect(read.versions[0].knowledgeBaseIds).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Bot Audit (/system/bot-audit)
// ─────────────────────────────────────────────────────────────

describe("readAiUsageLogs", () => {
  it("reads ai_usage_logs newest-first with a bounded limit and an explicit projection", async () => {
    results.set(AI_USAGE_LOGS_TABLE, { data: [], error: null });
    await readAiUsageLogs();
    const call = lastCallFor(AI_USAGE_LOGS_TABLE);
    expect(call.columns).toBe(AI_USAGE_LOGS_COLUMNS);
    expect(call.order).toEqual([["created_at", false]]);
    expect(call.limit).toBe(AI_USAGE_LOGS_DEFAULT_LIMIT);
  });

  it("selects no gate-check column, because the table records none", async () => {
    results.set(AI_USAGE_LOGS_TABLE, { data: [], error: null });
    await readAiUsageLogs();
    const columns = lastCallFor(AI_USAGE_LOGS_TABLE).columns ?? "";
    for (const absent of ["gate", "kill_switch", "rbac", "accepted", "edited"]) {
      expect(columns).not.toContain(absent);
    }
  });

  it("does not expose an accepted/edited/gate-check field on the mapped record", async () => {
    results.set(AI_USAGE_LOGS_TABLE, {
      data: [{ id: "l1", bot_id: "bot-x", status: "success", created_at: "2026-06-23T19:07:47Z" }],
      error: null,
    });
    const read = await readAiUsageLogs();
    expect(read.status).toBe("loaded");
    const row = read.rows[0] as AiUsageLogRecord & Record<string, unknown>;
    // The old shape carried gateChecks:{...all true}, accepted:null, edited:false
    // and the page painted five green "pass" tiles from it.
    expect(row.gateChecks).toBeUndefined();
    expect(row.accepted).toBeUndefined();
    expect(row.edited).toBeUndefined();
  });

  it("keeps an unrecorded cost or latency as null, never as 0", async () => {
    results.set(AI_USAGE_LOGS_TABLE, {
      data: [{ id: "l1", cost_usd: null, latency_ms: null, tokens_input: null, tokens_output: null }],
      error: null,
    });
    const read = await readAiUsageLogs();
    expect(read.rows[0].costUsd).toBeNull();
    expect(read.rows[0].latencyMs).toBeNull();
    expect(read.rows[0].costUsd).not.toBe(0);
  });

  it("carries the recorded human_action through untranslated", async () => {
    results.set(AI_USAGE_LOGS_TABLE, {
      data: [
        { id: "l1", human_action: "apply" },
        { id: "l2", human_action: null },
      ],
      error: null,
    });
    const read = await readAiUsageLogs();
    // "apply" is NOT reinterpreted as accepted=true; the recorded word is kept.
    expect(read.rows[0].humanAction).toBe("apply");
    expect(read.rows[1].humanAction).toBeNull();
  });

  it("separates a failed usage-log read from an empty one", async () => {
    results.set(AI_USAGE_LOGS_TABLE, { data: null, error: { message: "boom" } });
    expect((await readAiUsageLogs()).status).toBe("error");
    results.set(AI_USAGE_LOGS_TABLE, { data: [], error: null });
    expect((await readAiUsageLogs()).status).toBe("empty");
  });
});

describe("summariseUsageNumber — averages over recorded values only", () => {
  const row = (costUsd: number | null, latencyMs: number | null): AiUsageLogRecord => ({
    id: "x", botId: "", botName: "", userId: "", userName: "", provider: "", model: "",
    action: "", status: "", errorMessage: null, costUsd, latencyMs,
    tokensInput: null, tokensOutput: null, workspaceId: null, humanAction: null, createdAt: "",
  });

  it("returns null totals when nothing is recorded, so the UI cannot print $0.000", () => {
    const s = summariseUsageNumber([row(null, null), row(null, null)], r => r.costUsd);
    expect(s).toEqual({ recordedCount: 0, total: null, average: null });
  });

  it("excludes unrecorded rows from the average rather than counting them as zero", () => {
    const s = summariseUsageNumber([row(null, 100), row(null, 200), row(null, null)], r => r.latencyMs);
    expect(s.recordedCount).toBe(2);
    expect(s.average).toBe(150); // not 100, which is what treating null as 0 gives
  });

  it("reports how many rows contributed, so a partial figure is visible as partial", () => {
    const s = summariseUsageNumber([row(1, null), row(null, null)], r => r.costUsd);
    expect(s).toEqual({ recordedCount: 1, total: 1, average: 1 });
  });
});

// ─────────────────────────────────────────────────────────────
// Facilities (Admin -> Facilities)
// ─────────────────────────────────────────────────────────────

describe("readFacilities", () => {
  it("reads facilities in sort order with an explicit projection", async () => {
    results.set(FACILITIES_TABLE, { data: [], error: null });
    await readFacilities();
    const call = lastCallFor(FACILITIES_TABLE);
    expect(call.columns).toBe(FACILITIES_COLUMNS);
    expect(call.order).toEqual([["sort_order", true]]);
  });

  it("distinguishes a failed read from 'no facilities recorded'", async () => {
    results.set(FACILITIES_TABLE, { data: null, error: { message: "network" } });
    expect((await readFacilities()).status).toBe("error");
    results.set(FACILITIES_TABLE, { data: [], error: null });
    expect((await readFacilities()).status).toBe("empty");
  });
});

// ─────────────────────────────────────────────────────────────
// Admin -> Integrations: crm_connections is absent in this project
// ─────────────────────────────────────────────────────────────

describe("readIntegrationStatus — CRM entry", () => {
  const crmEntry = async () => {
    const report = await readIntegrationStatus();
    return report.integrations.find(i => i.name === "CRM connections")!;
  };

  it("reports an absent crm_connections table as not measured, not as a check failure", async () => {
    results.set("crm_connections", {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table 'public.crm_connections'" },
    });
    const crm = await crmEntry();
    expect(crm.status).toBe("not_measured");
    expect(crm.detail).toContain("not provisioned");
    expect(crm.status).not.toBe("ok");
  });

  it("still reports a genuine read failure as failed", async () => {
    results.set("crm_connections", { data: null, error: { code: "42501", message: "permission denied" } });
    const crm = await crmEntry();
    expect(crm.status).toBe("failed");
    expect(crm.detail).toContain("permission denied");
  });

  it("reports a successful zero-row read as ok with no connections", async () => {
    results.set("crm_connections", { data: [], error: null });
    const crm = await crmEntry();
    expect(crm.status).toBe("ok");
    expect(crm.detail).toContain("no connections configured");
  });

  it("labels stored health values as recorded, never as a live probe", async () => {
    results.set("crm_connections", {
      data: [{ name: "Zoho", provider: "zoho", health_status: "connected", last_sync_at: null }],
      error: null,
    });
    const crm = await crmEntry();
    expect(crm.connectionInfo).toContain("stored value, not a live probe");
  });
});
