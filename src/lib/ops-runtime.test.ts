/**
 * ops-runtime.test.ts — SC-01 Wave 03, ticket W03-2.
 *
 * These tests exist to prove the honesty contract, not just the happy path:
 *  - a failing probe must be reported as FAILED (never "healthy"),
 *  - an unconfirmed write must never be reported as saved,
 *  - "no settings stored" must be distinguishable from "read failed".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase mock ────────────────────────────────────────────
// A tiny chainable stub: each test installs the terminal result it wants.

type TerminalResult = { data?: unknown; error?: unknown; count?: number | null };

const terminal: { maybeSingle: TerminalResult; select: TerminalResult; list: TerminalResult } = {
  maybeSingle: { data: null, error: null },
  select: { data: null, error: null, count: null },
  list: { data: [], error: null },
};

const lastCall: { table: string | null; op: string | null; payload: unknown } = {
  table: null,
  op: null,
  payload: null,
};

function makeBuilder(table: string) {
  const builder: any = {
    select: (_cols?: string, opts?: { head?: boolean; count?: string }) => {
      if (opts?.head) {
        // head-count probe resolves immediately
        return Promise.resolve(terminal.select);
      }
      return builder;
    },
    eq: () => builder,
    upsert: (payload: unknown) => {
      lastCall.op = "upsert";
      lastCall.payload = payload;
      return builder;
    },
    maybeSingle: () => Promise.resolve(terminal.maybeSingle),
    // plain `.select(...)` with no head/eq terminator (crm_connections list read)
    then: (resolve: (v: TerminalResult) => unknown) => resolve(terminal.list),
  };
  lastCall.table = table;
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import {
  CLEAN_SERVER_PROBE_NAME,
  SUPABASE_PROBE_NAME,
  probeCleanServer,
  probeSupabase,
  readSystemHealth,
  readSystemSettings,
  saveSystemSettings,
} from "./ops-runtime";

beforeEach(() => {
  terminal.maybeSingle = { data: null, error: null };
  terminal.select = { data: null, error: null, count: null };
  terminal.list = { data: [], error: null };
  lastCall.table = null;
  lastCall.op = null;
  lastCall.payload = null;
  vi.unstubAllGlobals();
});

// ── Clean-server health probe ────────────────────────────────

describe("probeCleanServer", () => {
  it("reports ok only when the clean server answers /healthz with ok:true", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(String(url));
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, service: "hala-clean-commercial-engine" }),
        };
      }),
    );

    const probe = await probeCleanServer();

    expect(probe.name).toBe(CLEAN_SERVER_PROBE_NAME);
    expect(probe.status).toBe("ok");
    expect(probe.measuredAt).not.toBeNull();
    expect(probe.latencyMs).not.toBeNull();
    // Never the old server, never a frontend-origin /api path.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/\/healthz$/);
    expect(seen[0]).not.toContain("3001");
    expect(seen[0]).not.toContain("/api/");
  });

  it("reports FAILED (not healthy) when the clean server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );

    const probe = await probeCleanServer();

    expect(probe.status).toBe("failed");
    expect(probe.status).not.toBe("ok");
    expect(probe.detail).toContain("connect ECONNREFUSED");
  });

  it("reports FAILED when the server answers non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );

    const probe = await probeCleanServer();

    expect(probe.status).toBe("failed");
    expect(probe.detail).toContain("503");
  });

  it("reports FAILED when the body does not confirm ok:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) })),
    );

    const probe = await probeCleanServer();

    expect(probe.status).toBe("failed");
    expect(probe.detail).toContain("did not report ok:true");
  });
});

// ── Supabase probe ───────────────────────────────────────────

describe("probeSupabase", () => {
  it("reports ok when the real query succeeds", async () => {
    terminal.select = { data: null, error: null, count: 1 };

    const probe = await probeSupabase();

    expect(probe.name).toBe(SUPABASE_PROBE_NAME);
    expect(probe.status).toBe("ok");
    expect(probe.detail).toContain("1 row(s)");
  });

  it("reports FAILED when the query errors", async () => {
    terminal.select = { data: null, error: { message: "permission denied" }, count: null };

    const probe = await probeSupabase();

    expect(probe.status).toBe("failed");
    expect(probe.detail).toContain("permission denied");
  });
});

// ── Aggregate health ─────────────────────────────────────────

describe("readSystemHealth", () => {
  it("never reports unprobed subsystems as running", async () => {
    terminal.select = { data: null, error: null, count: 1 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })),
    );

    const report = await readSystemHealth();

    expect(report.probes).toHaveLength(2);
    expect(report.notMeasured.length).toBeGreaterThan(0);
    for (const entry of report.notMeasured) {
      expect(entry.status).toBe("not_measured");
      expect(entry.measuredAt).toBeNull();
      expect(entry.latencyMs).toBeNull();
    }
  });

  it("surfaces both probe failures instead of an aggregate 'healthy'", async () => {
    terminal.select = { data: null, error: { message: "network down" }, count: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );

    const report = await readSystemHealth();

    expect(report.probes.map((p) => p.status)).toEqual(["failed", "failed"]);
  });
});

// ── Settings read ────────────────────────────────────────────

describe("readSystemSettings", () => {
  it("returns loaded settings when a stored row exists", async () => {
    terminal.maybeSingle = {
      data: { id: "global", settings: { org_name: "Hala" }, updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    };

    const result = await readSystemSettings();

    expect(result.status).toBe("loaded");
    expect(result.settings).toEqual({ org_name: "Hala" });
  });

  it("distinguishes EMPTY (no stored row) from an error", async () => {
    terminal.maybeSingle = { data: null, error: null };

    const result = await readSystemSettings();

    expect(result.status).toBe("empty");
    expect(result.settings).toBeNull();
  });

  it("reports ERROR without substituting defaults", async () => {
    terminal.maybeSingle = { data: null, error: { message: "relation does not exist" } };

    const result = await readSystemSettings();

    expect(result.status).toBe("error");
    expect(result.settings).toBeNull();
    if (result.status === "error") {
      expect(result.error).toContain("relation does not exist");
    }
  });
});

// ── Settings write (confirmed) ───────────────────────────────

describe("saveSystemSettings", () => {
  it("reports saved only after the returned row matches the submission", async () => {
    terminal.maybeSingle = {
      data: {
        id: "global",
        settings: { org_name: "Hala", default_currency: "SAR" },
        updated_at: "2026-02-02T00:00:00Z",
      },
      error: null,
    };

    const result = await saveSystemSettings({ default_currency: "SAR", org_name: "Hala" });

    expect(result.status).toBe("saved");
    expect(lastCall.op).toBe("upsert");
  });

  it("reports ERROR when the database returns no row (silent RLS filter)", async () => {
    terminal.maybeSingle = { data: null, error: null };

    const result = await saveSystemSettings({ org_name: "Hala" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toContain("Save not confirmed");
    }
  });

  it("reports ERROR when the stored row does not match what was submitted", async () => {
    terminal.maybeSingle = {
      data: { id: "global", settings: { org_name: "Something else" }, updated_at: null },
      error: null,
    };

    const result = await saveSystemSettings({ org_name: "Hala" });

    expect(result.status).toBe("error");
  });

  it("reports ERROR when the write itself fails", async () => {
    terminal.maybeSingle = { data: null, error: { message: "permission denied for table" } };

    const result = await saveSystemSettings({ org_name: "Hala" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toContain("permission denied");
    }
  });
});
