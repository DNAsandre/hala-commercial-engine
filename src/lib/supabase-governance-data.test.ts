/**
 * supabase-governance-data.test.ts — SC-01 Wave 04, lane T07-C.
 *
 * Requirement C: the Governance Console stays advisory. It must not enforce,
 * gate, lock or block anything, and it must not claim a gate change persists
 * when the writer refuses it.
 *
 * These tests pin two things:
 *   1. The governance WRITE paths perform zero database calls and return an
 *      explicit refusal. If a write ever reaches the database, the assertion
 *      on the recorded call list fails.
 *   2. The governance READ paths distinguish loaded / empty / error, so the
 *      console can no longer render a failed read as "0 gates configured".
 *
 * SC-01 Wave 06 additions (lane T14):
 *   - manifest row A-35: `fetchTenderGovernanceConfigResult` is the Tender
 *     Config tab's ONLY data source — its read contract and three-way
 *     classification are pinned here;
 *   - architect correction #3 (2026-08-18): the write refusals were reworded
 *     to state the exclusion without promising the capability elsewhere; the
 *     two wording assertions below track that authorized change;
 *   - `insertGovernanceAuditEntry` (A-30 write helper): what reaches the
 *     database is asserted, not merely what the function returns.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Terminal = { data?: unknown; error?: unknown };

interface RecordedCall {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  columns: string | null;
  order: Array<[string, boolean | undefined]>;
  limit: number | null;
  payload: unknown;
}

const results = new Map<string, Terminal>();
const calls: RecordedCall[] = [];

function makeBuilder(table: string) {
  const resolveResult = (): Terminal => results.get(table) ?? { data: [], error: null };

  const record = (op: RecordedCall["op"]): RecordedCall => {
    const call: RecordedCall = { table, op, columns: null, order: [], limit: null, payload: null };
    calls.push(call);
    return call;
  };

  const builder: any = {
    select: (cols?: string) => {
      const call = calls.at(-1)?.table === table && calls.at(-1)?.op !== "select"
        ? calls.at(-1)!
        : record("select");
      call.columns = cols ?? null;
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      calls.at(-1)!.order.push([col, opts?.ascending]);
      return builder;
    },
    limit: (n: number) => { calls.at(-1)!.limit = n; return builder; },
    eq: () => builder,
    insert: (payload: unknown) => { record("insert").payload = payload; return builder; },
    update: (payload: unknown) => { record("update").payload = payload; return builder; },
    upsert: (payload: unknown) => { record("upsert").payload = payload; return builder; },
    delete: () => { record("delete"); return builder; },
    maybeSingle: () => Promise.resolve(resolveResult()),
    single: () => Promise.resolve(resolveResult()),
    then: (resolve: (v: Terminal) => unknown) => resolve(resolveResult()),
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

vi.mock("./auth-state", () => ({
  getCurrentUser: () => ({ id: "u1", name: "Test User" }),
}));

import {
  fetchCommercialGovernanceConfig,
  fetchCommercialGovernanceConfigResult,
  fetchGovernanceAuditLog,
  fetchGovernanceAuditLogResult,
  fetchPolicyGates,
  fetchPolicyGatesResult,
  fetchTenderGovernanceConfig,
  fetchTenderGovernanceConfigResult,
  insertGovernanceAuditEntry,
  updatePolicyGateConfig,
  upsertCommercialGovernanceConfig,
  upsertTenderGovernanceConfig,
} from "./supabase-governance-data";

beforeEach(() => {
  results.clear();
  calls.length = 0;
});

const mutations = () => calls.filter(c => c.op !== "select");

// ─────────────────────────────────────────────────────────────
// Requirement C — the console cannot change or enforce anything
// ─────────────────────────────────────────────────────────────

describe("governance writes refuse, and reach the database zero times", () => {
  it("updatePolicyGateConfig performs no write at all", async () => {
    const result = await updatePolicyGateConfig("gate-1", { mode: "enforce", overridable: false }, "because");
    expect(result.success).toBe(false);
    /* Wave 06 (architect correction #3): the refusal names the exclusion.
     * The old text "not available in this build" is on the wave's negative
     * scan list and must not come back. */
    expect(result.error).toContain("excluded from this build");
    expect(result.error).not.toContain("not available in this build");
    // The critical assertion: nothing reached the database. No update, no
    // version bump, no audit entry — so the console cannot claim persistence.
    expect(mutations()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("upsertTenderGovernanceConfig performs no write at all", async () => {
    const result = await upsertTenderGovernanceConfig("k", { v: 1 });
    expect(result.success).toBe(false);
    expect(mutations()).toEqual([]);
  });

  it("upsertCommercialGovernanceConfig performs no write at all", async () => {
    const result = await upsertCommercialGovernanceConfig("k", { v: 1 });
    expect(result.success).toBe(false);
    expect(mutations()).toEqual([]);
  });

  it("every refusal names the exclusion, so the UI can show a reason instead of a silent no-op", async () => {
    for (const result of [
      await updatePolicyGateConfig("g", {}),
      await upsertTenderGovernanceConfig("k", 1),
      await upsertCommercialGovernanceConfig("k", 1),
    ]) {
      expect(result.success).toBe(false);
      /* Wave 06 rewording: SX-011 is still cited; "deferred to Sprint X" no
       * longer is, because it promised a future the refusal cannot know. */
      expect(result.error).toMatch(/SX-011/);
      expect(result.error).toMatch(/excluded/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Reads: loaded / empty / error must be three answers
// ─────────────────────────────────────────────────────────────

describe("fetchPolicyGatesResult", () => {
  it("queries governance_policy_gates in sort order", async () => {
    results.set("governance_policy_gates", { data: [], error: null });
    await fetchPolicyGatesResult();
    const call = calls.find(c => c.table === "governance_policy_gates")!;
    expect(call.op).toBe("select");
    expect(call.columns).toBe("*");
    expect(call.order).toEqual([["sort_order", true]]);
  });

  it("reports a successful zero-row read as empty", async () => {
    // Live probe 2026-08-05 (anonymous client): HTTP 200, 0 rows.
    results.set("governance_policy_gates", { data: [], error: null });
    expect((await fetchPolicyGatesResult()).status).toBe("empty");
  });

  it("reports a failed read as error and never as '0 gates configured'", async () => {
    results.set("governance_policy_gates", { data: null, error: { message: "permission denied" } });
    const read = await fetchPolicyGatesResult();
    expect(read.status).toBe("error");
    expect(read.status).not.toBe("empty");
    expect(read).toMatchObject({ error: "permission denied", rows: [] });
  });

  it("returns the rows unchanged on success", async () => {
    results.set("governance_policy_gates", { data: [{ id: "g1", gate_name: "GP floor", mode: "warn" }], error: null });
    const read = await fetchPolicyGatesResult();
    expect(read.status).toBe("loaded");
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0]).toMatchObject({ id: "g1", mode: "warn" });
  });

  it("the legacy bare-array form still collapses failure to [] — which is why it must not drive counts", async () => {
    results.set("governance_policy_gates", { data: null, error: { message: "boom" } });
    expect(await fetchPolicyGates()).toEqual([]);
  });
});

describe("fetchGovernanceAuditLogResult", () => {
  it("queries governance_audit_log newest-first with the requested limit", async () => {
    results.set("governance_audit_log", { data: [], error: null });
    await fetchGovernanceAuditLogResult(50);
    const call = calls.find(c => c.table === "governance_audit_log")!;
    expect(call.order).toEqual([["created_at", false]]);
    expect(call.limit).toBe(50);
  });

  it("defaults to a bounded limit rather than an unbounded read", async () => {
    results.set("governance_audit_log", { data: [], error: null });
    await fetchGovernanceAuditLogResult();
    expect(calls.find(c => c.table === "governance_audit_log")!.limit).toBe(200);
  });

  it("distinguishes error from empty", async () => {
    results.set("governance_audit_log", { data: null, error: { message: "rls" } });
    expect((await fetchGovernanceAuditLogResult()).status).toBe("error");
    results.set("governance_audit_log", { data: [], error: null });
    expect((await fetchGovernanceAuditLogResult()).status).toBe("empty");
  });

  it("the bare-array form still returns [] on failure", async () => {
    results.set("governance_audit_log", { data: null, error: { message: "rls" } });
    expect(await fetchGovernanceAuditLog()).toEqual([]);
  });
});

describe("fetchCommercialGovernanceConfigResult", () => {
  it("queries commercial_governance_config ordered by config_key", async () => {
    results.set("commercial_governance_config", { data: [], error: null });
    await fetchCommercialGovernanceConfigResult();
    const call = calls.find(c => c.table === "commercial_governance_config")!;
    expect(call.order).toEqual([["config_key", undefined]]);
  });

  it("distinguishes error from empty so the panel stops saying 'or the store could not be read'", async () => {
    results.set("commercial_governance_config", { data: null, error: { message: "denied" } });
    const failed = await fetchCommercialGovernanceConfigResult();
    expect(failed.status).toBe("error");
    expect(failed).toMatchObject({ error: "denied" });

    results.set("commercial_governance_config", { data: [], error: null });
    expect((await fetchCommercialGovernanceConfigResult()).status).toBe("empty");
  });

  it("returns real entries on success", async () => {
    results.set("commercial_governance_config", {
      data: [{ id: "cgc-commercial_margin_authority", config_key: "commercial_margin_authority" }],
      error: null,
    });
    const read = await fetchCommercialGovernanceConfigResult();
    expect(read.status).toBe("loaded");
    expect(read.rows[0].config_key).toBe("commercial_margin_authority");
  });

  it("the bare-array form still returns [] on failure", async () => {
    results.set("commercial_governance_config", { data: null, error: { message: "x" } });
    expect(await fetchCommercialGovernanceConfig()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// SC-01 Wave 06 (T14, manifest row A-35) — Tender Config read
// ─────────────────────────────────────────────────────────────

describe("fetchTenderGovernanceConfigResult — A-35 read contract", () => {
  it("queries tender_governance_config with select('*') ordered by config_key", async () => {
    results.set("tender_governance_config", {
      data: [{
        id: "tgc-tender_templates",
        config_key: "tender_templates",
        config_value: { templates: ["3PL"] },
        category: "Templates",
        description: "stored description",
        is_active: true,
        updated_at: "2026-06-01T08:00:00.000Z",
      }],
      error: null,
    });

    const read = await fetchTenderGovernanceConfigResult();

    const call = calls.find(c => c.table === "tender_governance_config")!;
    expect(call.op).toBe("select");
    expect(call.columns).toBe("*");
    expect(call.order).toEqual([["config_key", undefined]]);
    expect(read.status).toBe("loaded");
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0]).toMatchObject({
      config_key: "tender_templates",
      config_value: { templates: ["3PL"] },
    });
  });

  it("reports a successful zero-row read as empty — a real state, not a failure", async () => {
    results.set("tender_governance_config", { data: [], error: null });
    expect((await fetchTenderGovernanceConfigResult()).status).toBe("empty");
  });

  it("reports a failed read as error with the message — NEVER as empty", async () => {
    results.set("tender_governance_config", {
      data: null,
      error: { message: "permission denied for table tender_governance_config" },
    });
    const read = await fetchTenderGovernanceConfigResult();
    expect(read.status).toBe("error");
    expect(read.status).not.toBe("empty");
    expect(read).toMatchObject({ rows: [] });
    if (read.status !== "error") throw new Error("unreachable");
    expect(read.error).toContain("permission denied");
  });

  it("the legacy bare-array wrapper stays aligned with the classified read", async () => {
    results.set("tender_governance_config", {
      data: [
        { id: "tgc-1", config_key: "tender_templates" },
        { id: "tgc-2", config_key: "tender_gate_rules" },
      ],
      error: null,
    });
    const rows = await fetchTenderGovernanceConfig();
    expect(rows.map(r => r.config_key)).toEqual(["tender_templates", "tender_gate_rules"]);
  });
});

// ─────────────────────────────────────────────────────────────
// SC-01 Wave 06 (T14) — the one real governance write helper
// ─────────────────────────────────────────────────────────────

describe("insertGovernanceAuditEntry — what reaches the database (A-30 helper)", () => {
  it("inserts one governance_audit_log row with the recorded actor and mock_only:false", async () => {
    results.set("governance_audit_log", { error: null });

    await insertGovernanceAuditEntry({
      category: "admin_change",
      action: "test_action",
      entity_type: "policy_gate",
      entity_id: "g-1",
      details: "stored detail",
    });

    expect(mutations()).toHaveLength(1);
    const write = mutations()[0]!;
    expect(write.table).toBe("governance_audit_log");
    expect(write.op).toBe("insert");
    expect(write.payload).toMatchObject({
      category: "admin_change",
      action: "test_action",
      entity_type: "policy_gate",
      entity_id: "g-1",
      details: "stored detail",
      user_id: "u1",
      user_name: "Test User",
      mock_only: false,
    });
  });
});
