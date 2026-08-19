/**
 * bot-admin.test.ts — SC-01 Wave 06, lane T13.
 *
 * Guards the bot/provider DEFINITION-management service (manifest rows
 * B-03..B-06, B-08, B-14..B-19). The rules pinned here are the codebase's law:
 *
 *  1. Every write is confirmed by a `.select(...)` read-back compared against
 *     the requested values BEFORE success is reported. A resolved request or a
 *     zero-row result is a FAILURE with an honest message.
 *  2. Multi-step operations report partial outcomes exactly (what WAS created,
 *     what was NOT) and never issue a secondary write before the primary write
 *     is confirmed.
 *  3. Every version-creating operation REPOINTS ai_bots.current_version_id —
 *     the fix of the old app's forgotten step (manifest B-15) that left
 *     consumers serving stale instructions after every publish.
 *  4. Deletes touch exact captured ids only (QA-cleanup doctrine) and a
 *     zero-row delete is a failure, not success.
 *
 * MOCK CONTRACT (house standard, intake-save.test.ts): the stub records the
 * table, operation, payload, filters, ordering and the exact `select`
 * projection reaching the database, and ENFORCES projections — only the
 * columns a query asked for come back. A mock that returns unrequested fields
 * has previously certified a fabrication in this codebase.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Terminal = { data?: unknown; error?: unknown };
type TerminalOrFn = Terminal | ((call: RecordedCall) => Terminal);

interface RecordedCall {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload: Record<string, unknown> | null;
  filters: Array<[string, unknown]>;
  projection: string | null;
  order: Array<[string, boolean | undefined]>;
  limit: number | null;
  terminal: "list" | "maybeSingle" | null;
}

const queues = new Map<string, TerminalOrFn[]>();
const calls: RecordedCall[] = [];

/** Install the next result for `${table}:${op}` (FIFO — one per DB round trip). */
function queue(table: string, op: RecordedCall["op"], result: TerminalOrFn): void {
  const key = `${table}:${op}`;
  const q = queues.get(key) ?? [];
  q.push(result);
  queues.set(key, q);
}

/** ENFORCED projection: only requested columns come back; `*` passes through. */
function projectRows(data: unknown, projection: string | null): unknown {
  if (data === null || data === undefined || !projection) return data;
  const wanted = projection.split(",").map((c) => c.trim()).filter(Boolean);
  if (wanted.some((c) => c.startsWith("*"))) return data;
  const pick = (row: Record<string, unknown>) =>
    Object.fromEntries(wanted.filter((c) => c in row).map((c) => [c, row[c]]));
  return Array.isArray(data)
    ? (data as Array<Record<string, unknown>>).map(pick)
    : pick(data as Record<string, unknown>);
}

function makeBuilder(table: string) {
  const call: RecordedCall = {
    table, op: "select", payload: null, filters: [], projection: null,
    order: [], limit: null, terminal: null,
  };
  calls.push(call);

  const resolve = (): Terminal => {
    const q = queues.get(`${table}:${call.op}`);
    const raw = q && q.length > 0
      ? q.shift()!
      : call.terminal === "maybeSingle"
        ? { data: null, error: null }
        : { data: [], error: null };
    const result = typeof raw === "function" ? raw(call) : raw;
    if (result.error) return { data: null, error: result.error };
    return { data: projectRows(result.data, call.projection), error: null };
  };

  const builder: any = {
    select: (cols?: string) => { call.projection = cols ?? null; return builder; },
    insert: (payload: Record<string, unknown>) => { call.op = "insert"; call.payload = payload; return builder; },
    update: (patch: Record<string, unknown>) => { call.op = "update"; call.payload = patch; return builder; },
    delete: () => { call.op = "delete"; return builder; },
    eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder; },
    order: (col: string, opts?: { ascending?: boolean }) => { call.order.push([col, opts?.ascending]); return builder; },
    limit: (n: number) => { call.limit = n; return builder; },
    maybeSingle: () => { call.terminal = "maybeSingle"; return Promise.resolve(resolve()); },
    then: (onFulfilled: (v: Terminal) => unknown, onRejected?: (e: unknown) => unknown) => {
      call.terminal = call.terminal ?? "list";
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

// The session user the service must record as created_by (never 'admin').
const SESSION_USER_ID = "session-user-9";
vi.mock("./auth-state", () => ({
  getCurrentUser: () => ({
    id: "session-user-9", name: "Session User", email: "", role: "admin", region: "",
  }),
}));

import {
  AI_BOTS_ADMIN_COLUMNS,
  AI_BOTS_TABLE,
  AI_BOT_VERSIONS_COLUMNS,
  AI_BOT_VERSIONS_TABLE,
  AI_PROVIDERS_TABLE,
  archiveBot,
  createBot,
  deleteBot,
  duplicateBot,
  publishBotVersion,
  restoreArchivedBot,
  summariseProviderUsage,
  validateBotDefinition,
  type AiBotRecord,
  type AiProviderRecord,
  type BotDefinitionFields,
  type CreateBotInput,
} from "./bot-admin";

beforeEach(() => {
  queues.clear();
  calls.length = 0;
});

// Echo helpers: the database returns exactly what was submitted (a correct
// write). The projection filter still strips unrequested columns afterwards.
const echoInsert = (id: string): TerminalOrFn => (call) => ({
  data: [{ id, ...(call.payload ?? {}) }],
  error: null,
});
const echoUpdate = (): TerminalOrFn => (call) => {
  const idFilter = call.filters.find(([c]) => c === "id");
  return { data: [{ id: idFilter?.[1] ?? "missing-id", ...(call.payload ?? {}) }], error: null };
};

const callsFor = (table: string, op?: RecordedCall["op"]) =>
  calls.filter((c) => c.table === table && (!op || c.op === op));
const writeCalls = () => calls.filter((c) => c.op !== "select");

const BOT_ID = "8d12a4a5-be1a-4636-a8ff-f0499d6d03bd";

describe("summariseProviderUsage — the live id-scheme mix must surface, not vanish (B-08/B-16)", () => {
  const provider = (id: string): AiProviderRecord => ({
    id, name: "openai", displayName: "OpenAI", modelDefault: "gpt-4o-mini",
    models: [], enabled: true, config: {},
  });
  const bot = (id: string, providerId: string | null, status: string): AiBotRecord => ({
    id, name: id, type: "action", status, purpose: "", domainsAllowed: [],
    regionsAllowed: [], rolesAllowed: [], currentVersionId: null, providerId,
    model: null, rateLimit: null, costCap: null, timeoutSec: null, createdAt: "", updatedAt: "",
  });

  it("counts exact-id matches and surfaces legacy/unrecorded ids verbatim", () => {
    // Live shape 2026-08-18: aip-openai-001 matched, prov-openai legacy, NULLs.
    const summary = summariseProviderUsage(
      [provider("aip-openai-001")],
      [
        bot("b1", "aip-openai-001", "active"),
        bot("b2", "aip-openai-001", "draft"),
        bot("b3", "prov-openai", "active"),
        bot("b4", "prov-openai", "draft"),
        bot("b5", null, "active"),
      ],
    );
    expect(summary.matchedByProvider["aip-openai-001"]).toEqual({ total: 2, active: 1 });
    expect(summary.unmatched).toEqual([{ providerId: "prov-openai", total: 2, active: 1 }]);
    expect(summary.unrecorded).toEqual({ total: 1, active: 1 });
  });

  it("never remaps a legacy id onto a provider record", () => {
    const summary = summariseProviderUsage(
      [provider("aip-openai-001")],
      [bot("b1", "prov-openai", "active")],
    );
    // The legacy bot must NOT be silently attributed to aip-openai-001.
    expect(summary.matchedByProvider["aip-openai-001"]).toEqual({ total: 0, active: 0 });
    expect(summary.unmatched[0].providerId).toBe("prov-openai");
  });
});

// ─────────────────────────────────────────────────────────────
// B-03 — EXCLUDED (architect ruling 2026-08-19)
// ─────────────────────────────────────────────────────────────

describe("activation exclusion — no ordinary write path stores status 'active' (B-03 excluded)", () => {
  // final-pack-bots.ts and ai-runs.ts select bots by status='active'; a status
  // write here would change which bots execution surfaces discover. The former
  // setBotStatus toggle is removed, not disabled — this pin fails if it, or
  // any export writing status 'active', comes back.
  it("the module no longer exports setBotStatus or any status-toggle surface", async () => {
    const mod = await import("./bot-admin");
    expect("setBotStatus" in mod).toBe(false);
    const activationWriters = Object.keys(mod).filter(
      (k) => typeof (mod as Record<string, unknown>)[k] === "function" && /setBotStatus|activate|enable/i.test(k),
    );
    expect(activationWriters).toEqual([]);
  });
  // The remaining status writes are pinned where they live: createBot and
  // duplicateBot suites assert INSERT status "draft"; archiveBot asserts
  // UPDATE status "archived". None stores "active".
});

// ─────────────────────────────────────────────────────────────
// B-04 — archiveBot
// ─────────────────────────────────────────────────────────────

describe("archiveBot — status -> archived with confirmed persistence (B-04)", () => {
  it("writes status 'archived' to ai_bots by exact id, confirmed by read-back", async () => {
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    const result = await archiveBot(BOT_ID);
    expect(result.status).toBe("stored");
    const write = callsFor(AI_BOTS_TABLE, "update")[0];
    expect(write.payload).toMatchObject({ status: "archived" });
    expect(write.filters).toEqual([["id", BOT_ID]]);
  });

  it("zero matched rows is a failure, not the old app's silent success toast", async () => {
    queue(AI_BOTS_TABLE, "update", { data: [], error: null });
    const result = await archiveBot(BOT_ID);
    expect(result.status).toBe("not_stored");
  });
});

describe("restoreArchivedBot — archived definition is reversible", () => {
  it("writes status 'active' to the exact archived definition with read-back", async () => {
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    const result = await restoreArchivedBot(BOT_ID);
    expect(result.status).toBe("stored");
    const write = callsFor(AI_BOTS_TABLE, "update")[0];
    expect(write.payload).toMatchObject({ status: "active" });
    expect(write.filters).toEqual([["id", BOT_ID]]);
  });
});

// ─────────────────────────────────────────────────────────────
// B-14 — createBot
// ─────────────────────────────────────────────────────────────

const CREATE_INPUT: CreateBotInput = {
  name: "tender-summary-bot",
  displayName: "Tender Summary Bot",
  type: "action",
  purpose: "Summarises tender documents",
  domainsAllowed: ["tender"],
  regionsAllowed: ["East"],
  rolesAllowed: ["admin"],
  providerId: "aip-openai-001",
  model: "gpt-4o-mini",
  rateLimit: 20,
  costCap: 10,
  timeoutSec: 30,
  version: {
    systemInstruction: "You summarise tenders.",
    knowledgeBaseText: "Hala tender services and operating facts.",
    allowedActions: ["suggest", "draft"],
    temperature: 0.4,
    maxTokens: 2000,
    changeNote: "",
  },
};

describe("createBot — bot row + first version + repoint, each confirmed (B-14)", () => {
  it("performs the three-step contract in order and confirms every step", async () => {
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-new-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-1"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    const result = await createBot(CREATE_INPUT);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.value).toEqual({ botId: "bot-new-1", versionId: "ver-new-1", version: 1 });
      expect(result.steps.map((s) => s.outcome)).toEqual(["confirmed", "confirmed", "confirmed"]);
    }

    // Step 1: what actually reached ai_bots.
    const botInsert = callsFor(AI_BOTS_TABLE, "insert")[0];
    expect(botInsert.payload).toMatchObject({
      name: "tender-summary-bot",
      display_name: "Tender Summary Bot",
      type: "action",
      status: "draft",
      purpose: "Summarises tender documents",
      provider_id: "aip-openai-001",
      model: "gpt-4o-mini",
      rate_limit: 20,
      cost_cap: 10,
      timeout_sec: 30,
    });
    // FPS-008 columns not supplied -> not in the payload (DB defaults stand).
    expect(botInsert.payload).not.toHaveProperty("category");
    expect(botInsert.payload).not.toHaveProperty("allowed_block_types");
    // The insert read-back projection was requested.
    expect(botInsert.projection).toContain("id");
    expect(botInsert.projection).toContain("name");

    // Step 2: version 1 for the returned bot id.
    const versionInsert = callsFor(AI_BOT_VERSIONS_TABLE, "insert")[0];
    expect(versionInsert.payload).toMatchObject({
      bot_id: "bot-new-1",
      version: 1,
      system_instruction: "You summarise tenders.",
      knowledge_base_text: "Hala tender services and operating facts.",
      knowledge_base_ids: [],
      allowed_actions: ["suggest", "draft"],
      temperature: 0.4,
      max_tokens: 2000,
      change_note: "Initial version",
      chain_config: {},
    });

    // Step 3: the repoint.
    const repoint = callsFor(AI_BOTS_TABLE, "update")[0];
    expect(repoint.payload).toEqual({ current_version_id: "ver-new-1" });
    expect(repoint.filters).toEqual([["id", "bot-new-1"]]);
    expect(repoint.projection).toContain("current_version_id");
  });

  it("records created_by from the session user, never a hardcoded 'admin'", async () => {
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-new-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-1"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    await createBot(CREATE_INPUT);

    expect(callsFor(AI_BOTS_TABLE, "insert")[0].payload).toMatchObject({ created_by: SESSION_USER_ID });
    expect(callsFor(AI_BOT_VERSIONS_TABLE, "insert")[0].payload).toMatchObject({ created_by: SESSION_USER_ID });
    expect(callsFor(AI_BOTS_TABLE, "insert")[0].payload!.created_by).not.toBe("admin");
  });

  it("rejects an invalid definition before any database write", async () => {
    const result = await createBot({ ...CREATE_INPUT, name: "  ", rolesAllowed: [] });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("Nothing was created");
      expect(result.steps.every((s) => s.outcome === "not_attempted")).toBe(true);
    }
    expect(calls).toHaveLength(0);
  });

  it("does NOT insert a version when the bot insert failed (no secondary write before primary confirmed)", async () => {
    queue(AI_BOTS_TABLE, "insert", { data: null, error: { message: "permission denied for table ai_bots" } });
    const result = await createBot(CREATE_INPUT);

    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("Nothing was created");
    expect(callsFor(AI_BOT_VERSIONS_TABLE)).toHaveLength(0);
    expect(callsFor(AI_BOTS_TABLE, "update")).toHaveLength(0);
  });

  it("treats a zero-row insert result as a failure, not success", async () => {
    queue(AI_BOTS_TABLE, "insert", { data: [], error: null });
    const result = await createBot(CREATE_INPUT);
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toMatch(/returned no row/);
    expect(callsFor(AI_BOT_VERSIONS_TABLE)).toHaveLength(0);
  });

  it("treats a mismatched insert read-back as a failure", async () => {
    // The database claims a different name was stored.
    queue(AI_BOTS_TABLE, "insert", (call) => ({
      data: [{ id: "bot-new-1", ...(call.payload ?? {}), name: "someone-else" }],
      error: null,
    }));
    const result = await createBot(CREATE_INPUT);
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("does not match");
  });

  it("reports the exact partial state when the version insert fails after the bot insert", async () => {
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-new-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", { data: null, error: { message: "row level security" } });

    const result = await createBot(CREATE_INPUT);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain('bot record WAS created (id "bot-new-1")');
      expect(result.error).toContain("version row was NOT");
      expect(result.steps[0].outcome).toBe("confirmed");
      expect(result.steps[1].outcome).toBe("failed");
      expect(result.steps[2].outcome).toBe("not_attempted");
    }
    // No repoint was attempted for a version that does not exist.
    expect(callsFor(AI_BOTS_TABLE, "update")).toHaveLength(0);
  });

  it("reports the exact partial state when the repoint fails after both inserts", async () => {
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-new-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-1"));
    queue(AI_BOTS_TABLE, "update", { data: [], error: null }); // repoint matched nothing

    const result = await createBot(CREATE_INPUT);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain('bot "bot-new-1"');
      expect(result.error).toContain('version "ver-new-1"');
      expect(result.error).toContain("current_version_id was NOT set");
      expect(result.steps.map((s) => s.outcome)).toEqual(["confirmed", "confirmed", "failed"]);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// B-15 / B-17 / B-18 — publishBotVersion
// ─────────────────────────────────────────────────────────────

const EDIT_FIELDS: BotDefinitionFields = {
  name: "tender-summary-bot",
  displayName: "Tender Summary Bot",
  type: "action",
  purpose: "Summarises tender documents",
  domainsAllowed: ["tender"],
  regionsAllowed: ["East"],
  rolesAllowed: ["admin"],
  providerId: "aip-openai-001",
  model: "gpt-4o-mini",
  rateLimit: 20,
  costCap: 10,
  timeoutSec: 30,
};

function queueLatestVersion(version: number, extra: Record<string, unknown> = {}): void {
  queue(AI_BOT_VERSIONS_TABLE, "select", {
    data: [{ id: `ver-${version}`, bot_id: BOT_ID, version, knowledge_base_text: null, ...extra }],
    error: null,
  });
}

describe("publishBotVersion — edit + immutable version + REPOINT (B-15/B-17/B-18)", () => {
  const DRAFT = {
    systemInstruction: "New instruction.",
    knowledgeBaseText: "Pricing and service facts for this bot.",
    allowedActions: ["draft"],
    chainConfig: { next_bot_id: "bot-other", prompt_user: true, chain_label: "Draft all" },
    changeNote: "Tightened the instruction",
  };

  it("updates the bot, inserts version latest+1 and repoints current_version_id", async () => {
    queueLatestVersion(4);
    queue(AI_BOTS_TABLE, "update", echoUpdate()); // definition update
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-5"));
    queue(AI_BOTS_TABLE, "update", echoUpdate()); // repoint

    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.value).toEqual({ botId: BOT_ID, versionId: "ver-new-5", version: 5 });
    }

    // The version-number read is a real, explicit-projection read.
    const historyRead = callsFor(AI_BOT_VERSIONS_TABLE, "select")[0];
    expect(historyRead.projection).toBe(AI_BOT_VERSIONS_COLUMNS);
    expect(historyRead.filters).toEqual([["bot_id", BOT_ID]]);
    expect(historyRead.order).toEqual([["version", false]]);
    expect(historyRead.limit).toBe(1);

    // The version insert carries the B-17/B-18 payloads.
    const versionInsert = callsFor(AI_BOT_VERSIONS_TABLE, "insert")[0];
    expect(versionInsert.payload).toMatchObject({
      bot_id: BOT_ID,
      version: 5,
      allowed_actions: ["draft"],
      knowledge_base_text: "Pricing and service facts for this bot.",
      knowledge_base_ids: [],
      chain_config: { next_bot_id: "bot-other", prompt_user: true, chain_label: "Draft all" },
      change_note: "Tightened the instruction",
    });
  });

  it("REPOINTS current_version_id — the step the old app forgot (manifest B-15 defect)", async () => {
    queueLatestVersion(4);
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-5"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);

    const botUpdates = callsFor(AI_BOTS_TABLE, "update");
    expect(botUpdates).toHaveLength(2);
    const repoint = botUpdates[1];
    expect(repoint.payload).toEqual({ current_version_id: "ver-new-5" });
    expect(repoint.filters).toEqual([["id", BOT_ID]]);
  });

  it("never touches status or the FPS-008 columns in the definition update", async () => {
    queueLatestVersion(4);
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-5"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);

    const definitionUpdate = callsFor(AI_BOTS_TABLE, "update")[0];
    expect(definitionUpdate.payload).not.toHaveProperty("status");
    for (const fps008 of [
      "category", "display_order", "allowed_block_types",
      "allowed_document_intents", "allowed_source_modes",
    ]) {
      expect(definitionUpdate.payload).not.toHaveProperty(fps008);
    }
    // It DOES carry the explicit definition columns.
    expect(definitionUpdate.payload).toMatchObject({ name: "tender-summary-bot", display_name: "Tender Summary Bot" });
  });

  it("refuses to publish without a change note — no write reaches the database", async () => {
    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, { ...DRAFT, changeNote: "   " });
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("change note");
    expect(calls).toHaveLength(0);
  });

  it("refuses a self-chain — no write reaches the database", async () => {
    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, {
      ...DRAFT,
      chainConfig: { next_bot_id: BOT_ID, prompt_user: false, chain_label: "loop" },
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("chain to itself");
    expect(calls).toHaveLength(0);
  });

  it("fails honestly when the version history cannot be read (no guessed version number)", async () => {
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: null, error: { message: "timeout" } });
    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("version number is unknown");
    expect(writeCalls()).toHaveLength(0);
  });

  it("stops before the version insert when the bot update matched zero rows", async () => {
    queueLatestVersion(4);
    queue(AI_BOTS_TABLE, "update", { data: [], error: null });
    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);

    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("Nothing was published");
    expect(callsFor(AI_BOT_VERSIONS_TABLE, "insert")).toHaveLength(0);
  });

  it("reports the exact partial state when the version insert fails after the bot update", async () => {
    queueLatestVersion(4);
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "insert", { data: null, error: { message: "row level security" } });

    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("bot definition WAS updated");
      expect(result.error).toContain("version 5 was NOT created");
      expect(result.steps.map((s) => s.outcome)).toEqual(["confirmed", "failed", "not_attempted"]);
    }
  });

  it("reports the exact partial state when the repoint fails — consumers still serve the OLD version", async () => {
    queueLatestVersion(4);
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-new-5"));
    queue(AI_BOTS_TABLE, "update", { data: [], error: null });

    const result = await publishBotVersion(BOT_ID, EDIT_FIELDS, DRAFT);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("current_version_id was NOT repointed");
      expect(result.error).toContain("still serve the OLD version");
      expect(result.steps.map((s) => s.outcome)).toEqual(["confirmed", "confirmed", "failed"]);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// B-05 — duplicateBot
// ─────────────────────────────────────────────────────────────

const SOURCE_BOT_ROW: Record<string, unknown> = {
  id: BOT_ID,
  name: "fps-light-refine",
  display_name: "Light Refine",
  type: "action",
  status: "active",
  purpose: "Refines blocks",
  domains_allowed: ["pdf_studio"],
  regions_allowed: [],
  roles_allowed: ["admin"],
  current_version_id: "ver-cur-1",
  provider_id: "aip-openai-001",
  model: "gpt-4o-mini",
  rate_limit: 20,
  cost_cap: 10,
  timeout_sec: 30,
  category: "refine",
  display_order: 3,
  allowed_block_types: ["paragraph"],
  allowed_document_intents: ["proposal"],
  allowed_source_modes: ["replace"],
  created_at: "2026-06-01",
  updated_at: "2026-06-02",
  created_by: "seed",
};

const SOURCE_VERSION_ROW: Record<string, unknown> = {
  id: "ver-cur-1",
  bot_id: BOT_ID,
  version: 3,
  system_instruction: "Refine the block.",
  custom_instruction: null,
  safety_rules: "No hallucination.",
  temperature: 0.2,
  max_tokens: 1500,
  allowed_actions: ["suggest", "draft"],
  provider_id: "aip-openai-001",
  model: "gpt-4o-mini",
  connector_snapshot: {},
  permission_snapshot: { rolesAllowed: ["admin"] },
  knowledge_base_text: "Source bot facts.",
  knowledge_base_ids: ["legacy-kbc-a"],
  chain_config: {},
  change_note: "v3",
  created_at: "2026-06-02",
  created_by: "seed",
};

describe("duplicateBot — full copy as draft, version included, repointed (B-05)", () => {
  it("copies the definition INCLUDING the FPS-008 columns the old clone dropped", async () => {
    queue(AI_BOTS_TABLE, "select", { data: SOURCE_BOT_ROW, error: null });
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: SOURCE_VERSION_ROW, error: null });
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-copy-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-copy-1"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    const result = await duplicateBot(BOT_ID);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.value).toEqual({
        botId: "bot-copy-1", name: "fps-light-refine (Copy)",
        versionId: "ver-copy-1", copiedVersion: true,
      });
    }

    // The source read asked for the full admin column set (with FPS-008 columns).
    const sourceRead = callsFor(AI_BOTS_TABLE, "select")[0];
    expect(sourceRead.projection).toBe(AI_BOTS_ADMIN_COLUMNS);
    expect(sourceRead.filters).toEqual([["id", BOT_ID]]);

    const copyInsert = callsFor(AI_BOTS_TABLE, "insert")[0];
    expect(copyInsert.payload).toMatchObject({
      name: "fps-light-refine (Copy)",
      display_name: "Light Refine (Copy)",
      status: "draft",
      category: "refine",
      display_order: 3,
      allowed_block_types: ["paragraph"],
      allowed_document_intents: ["proposal"],
      allowed_source_modes: ["replace"],
      created_by: SESSION_USER_ID,
    });
    // The copy must not inherit the SOURCE's current_version_id.
    expect(copyInsert.payload).not.toHaveProperty("current_version_id");

    // The copied version: version 1 on the NEW bot, content verbatim.
    const versionInsert = callsFor(AI_BOT_VERSIONS_TABLE, "insert")[0];
    expect(versionInsert.payload).toMatchObject({
      bot_id: "bot-copy-1",
      version: 1,
      system_instruction: "Refine the block.",
      allowed_actions: ["suggest", "draft"],
      knowledge_base_text: "Source bot facts.",
      knowledge_base_ids: [],
    });

    // And the copy's current_version_id points at the copied version.
    const repoint = callsFor(AI_BOTS_TABLE, "update")[0];
    expect(repoint.payload).toEqual({ current_version_id: "ver-copy-1" });
    expect(repoint.filters).toEqual([["id", "bot-copy-1"]]);
  });

  it("reads the version named by current_version_id (by exact id)", async () => {
    queue(AI_BOTS_TABLE, "select", { data: SOURCE_BOT_ROW, error: null });
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: SOURCE_VERSION_ROW, error: null });
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-copy-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-copy-1"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    await duplicateBot(BOT_ID);

    const versionRead = callsFor(AI_BOT_VERSIONS_TABLE, "select")[0];
    expect(versionRead.filters).toEqual([["id", "ver-cur-1"]]);
    expect(versionRead.projection).toBe(AI_BOT_VERSIONS_COLUMNS);
  });

  it("falls back to the latest version when current_version_id is null", async () => {
    queue(AI_BOTS_TABLE, "select", { data: { ...SOURCE_BOT_ROW, current_version_id: null }, error: null });
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: [SOURCE_VERSION_ROW], error: null });
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-copy-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", echoInsert("ver-copy-1"));
    queue(AI_BOTS_TABLE, "update", echoUpdate());

    const result = await duplicateBot(BOT_ID);
    expect(result.status).toBe("completed");

    const versionRead = callsFor(AI_BOT_VERSIONS_TABLE, "select")[0];
    expect(versionRead.filters).toEqual([["bot_id", BOT_ID]]);
    expect(versionRead.order).toEqual([["version", false]]);
    expect(versionRead.limit).toBe(1);
  });

  it("copies a version-less bot honestly: definition-only, versionId null, no version insert", async () => {
    queue(AI_BOTS_TABLE, "select", { data: { ...SOURCE_BOT_ROW, current_version_id: null }, error: null });
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: [], error: null });
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-copy-1"));

    const result = await duplicateBot(BOT_ID);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.value.copiedVersion).toBe(false);
      expect(result.value.versionId).toBeNull();
    }
    expect(callsFor(AI_BOT_VERSIONS_TABLE, "insert")).toHaveLength(0);
    expect(callsFor(AI_BOTS_TABLE, "update")).toHaveLength(0);
  });

  it("fails with no writes when the source bot is not visible", async () => {
    queue(AI_BOTS_TABLE, "select", { data: null, error: null });
    const result = await duplicateBot("missing-bot");
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toContain("Nothing was duplicated");
    expect(writeCalls()).toHaveLength(0);
  });

  it("reports the exact partial state when the version copy fails after the bot copy", async () => {
    queue(AI_BOTS_TABLE, "select", { data: SOURCE_BOT_ROW, error: null });
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: SOURCE_VERSION_ROW, error: null });
    queue(AI_BOTS_TABLE, "insert", echoInsert("bot-copy-1"));
    queue(AI_BOT_VERSIONS_TABLE, "insert", { data: [], error: null }); // zero-row insert

    const result = await duplicateBot(BOT_ID);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain('copied bot WAS created (id "bot-copy-1")');
      expect(result.error).toContain("version row was NOT");
    }
    expect(callsFor(AI_BOTS_TABLE, "update")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// B-06 — deleteBot
// ─────────────────────────────────────────────────────────────

describe("deleteBot — draft/disabled only, exact ids, every step confirmed (B-06)", () => {
  function queueDeletableBot(status: string, currentVersionId: string | null = "ver-1"): void {
    queue(AI_BOTS_TABLE, "select", {
      data: { id: BOT_ID, name: "Old Draft", status, current_version_id: currentVersionId },
      error: null,
    });
  }

  it("clears current_version_id, deletes versions then the bot, all by exact id", async () => {
    queueDeletableBot("draft");
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: [{ id: "ver-1" }, { id: "ver-2" }], error: null });
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "delete", { data: [{ id: "ver-1" }, { id: "ver-2" }], error: null });
    queue(AI_BOTS_TABLE, "delete", { data: [{ id: BOT_ID }], error: null });

    const result = await deleteBot(BOT_ID);

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.value).toEqual({ botId: BOT_ID, deletedVersionCount: 2 });
    }

    // QA-cleanup doctrine: exact captured ids only, never broad filters.
    const clear = callsFor(AI_BOTS_TABLE, "update")[0];
    expect(clear.payload).toEqual({ current_version_id: null });
    expect(clear.filters).toEqual([["id", BOT_ID]]);

    const versionDelete = callsFor(AI_BOT_VERSIONS_TABLE, "delete")[0];
    expect(versionDelete.filters).toEqual([["bot_id", BOT_ID]]);
    expect(versionDelete.projection).toBe("id"); // read-back of what was deleted

    const botDelete = callsFor(AI_BOTS_TABLE, "delete")[0];
    expect(botDelete.filters).toEqual([["id", BOT_ID]]);
    expect(botDelete.projection).toBe("id");
  });

  it("refuses to delete an active bot — nothing reaches the database", async () => {
    queueDeletableBot("active");
    const result = await deleteBot(BOT_ID);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain('status "active"');
      expect(result.error).toContain("Nothing was deleted");
    }
    expect(writeCalls()).toHaveLength(0);
  });

  it("fails with no writes when the bot is not visible", async () => {
    queue(AI_BOTS_TABLE, "select", { data: null, error: null });
    const result = await deleteBot(BOT_ID);
    expect(result.status).toBe("failed");
    expect(writeCalls()).toHaveLength(0);
  });

  it("skips the clear step honestly when current_version_id is already null", async () => {
    queueDeletableBot("disabled", null);
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: [], error: null });
    queue(AI_BOT_VERSIONS_TABLE, "delete", { data: [], error: null });
    queue(AI_BOTS_TABLE, "delete", { data: [{ id: BOT_ID }], error: null });

    const result = await deleteBot(BOT_ID);
    expect(result.status).toBe("completed");
    if (result.status === "completed") expect(result.value.deletedVersionCount).toBe(0);
    expect(callsFor(AI_BOTS_TABLE, "update")).toHaveLength(0);
  });

  it("fails when fewer version rows were deleted than exist — and does not delete the bot", async () => {
    queueDeletableBot("draft");
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: [{ id: "ver-1" }, { id: "ver-2" }], error: null });
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "delete", { data: [{ id: "ver-1" }], error: null }); // only 1 of 2

    const result = await deleteBot(BOT_ID);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("1 of 2");
      expect(result.error).toContain("partially-deleted");
    }
    expect(callsFor(AI_BOTS_TABLE, "delete")).toHaveLength(0);
  });

  it("a zero-row bot delete is a FAILURE that names the surviving record", async () => {
    queueDeletableBot("draft");
    queue(AI_BOT_VERSIONS_TABLE, "select", { data: [{ id: "ver-1" }], error: null });
    queue(AI_BOTS_TABLE, "update", echoUpdate());
    queue(AI_BOT_VERSIONS_TABLE, "delete", { data: [{ id: "ver-1" }], error: null });
    queue(AI_BOTS_TABLE, "delete", { data: [], error: null }); // matched nothing

    const result = await deleteBot(BOT_ID);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("version row(s) WERE deleted");
      expect(result.error).toContain("matched nothing");
      expect(result.steps[3].outcome).toBe("failed");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Validation helper
// ─────────────────────────────────────────────────────────────

describe("validateBotDefinition — the established old-contract limits", () => {
  const valid: BotDefinitionFields = {
    name: "bot", type: "action", purpose: "p", rolesAllowed: ["admin"],
  };

  it("accepts a minimal valid definition", () => {
    expect(validateBotDefinition(valid)).toEqual([]);
  });

  it("enforces required fields and the recorded numeric caps", () => {
    expect(validateBotDefinition({ ...valid, name: " " })).toContain("Bot name is required.");
    expect(validateBotDefinition({ ...valid, purpose: "" })).toContain("Bot purpose is required.");
    expect(validateBotDefinition({ ...valid, rolesAllowed: [] })).toContain("At least one role must be selected.");
    expect(validateBotDefinition({ ...valid, rateLimit: 101 })).toContain("Rate limit cannot exceed 100.");
    expect(validateBotDefinition({ ...valid, costCap: 101 })).toContain("Cost cap cannot exceed $100.");
    // Null means "not recorded", not zero — and passes.
    expect(validateBotDefinition({ ...valid, rateLimit: null, costCap: null })).toEqual([]);
  });
});
