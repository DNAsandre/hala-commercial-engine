/**
 * renewals-data.test.ts — SC-01 Wave 04, lane T07-B.
 *
 * Pins the defect Wave 04 is about: a failed renewals read must not be
 * indistinguishable from a genuinely empty renewals table.
 *
 * The Supabase mock below HONOURS THE SELECT PROJECTION: the terminal result is
 * built by projecting the seeded row through the column list the query actually
 * asked for. A mock that hands back fields the query never requested has
 * previously certified a fabrication in this codebase, so a test asserting on an
 * unrequested field will fail here by construction.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type TerminalResult = { data: unknown; error: unknown };

interface Seen {
  tables: string[];
  columns: string[];
  orders: { column: string; ascending?: boolean }[];
}

const seen: Seen = { tables: [], columns: [], orders: [] };

/** Raw rows keyed by table, as they would sit in Postgres. */
const seeded: Record<string, Record<string, unknown>[]> = {};
/** Forced errors keyed by table. */
const failures: Record<string, unknown> = {};

function project(row: Record<string, unknown>, columns: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns.split(",").map((c) => c.trim())) {
    if (col === "*") return { ...row };
    // PostgREST returns only the requested columns. Requesting a column that
    // does not exist is an error (42703), not a null - mirror that.
    if (!(col in row)) {
      throw new Error(`mock: column "${col}" not present on seeded row; test would assert fiction`);
    }
    out[col] = row[col];
  }
  return out;
}

function makeBuilder(table: string) {
  seen.tables.push(table);
  let columns = "*";
  const builder: any = {
    select: (cols?: string) => {
      columns = cols ?? "*";
      seen.columns.push(columns);
      return builder;
    },
    order: (column: string, opts?: { ascending?: boolean }) => {
      seen.orders.push({ column, ascending: opts?.ascending });
      return builder;
    },
    then: (resolve: (v: TerminalResult) => unknown) => {
      if (failures[table]) return resolve({ data: null, error: failures[table] });
      const rows = (seeded[table] ?? []).map((r) => project(r, columns));
      return resolve({ data: rows, error: null });
    },
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

vi.mock("@/lib/supabase-error", () => ({
  handleSupabaseError: () => {},
  setFetchError: () => {},
  clearFetchError: () => {},
}));

import {
  CONTRACT_BASELINE_COLUMNS,
  RENEWAL_WORKSPACE_COLUMNS,
  deriveRenewalsViewState,
  fetchContractBaselineRows,
  fetchRenewalWorkspaceRows,
  loadRenewalsOverview,
} from "./renewals-data";

/** A row shaped exactly like the live `renewal_workspaces` columns. */
function workspaceRow(id: string): Record<string, unknown> {
  return {
    id,
    customer_id: "c-1",
    customer_name: "Seeded Customer",
    baseline_id: "b-1",
    status: "in_progress",
    owner: "seed-owner",
    decision: "pending",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-03-04T00:00:00Z",
    // columns that exist in the table but are NOT projected
    workspace_id: "w-1",
    pricing: {},
    sla_terms: {},
  };
}

function baselineRow(id: string): Record<string, unknown> {
  return {
    id,
    customer_id: "c-1",
    customer_name: "Seeded Customer",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    created_by: "seed-user",
  };
}

beforeEach(() => {
  seen.tables = [];
  seen.columns = [];
  seen.orders = [];
  for (const k of Object.keys(seeded)) delete seeded[k];
  for (const k of Object.keys(failures)) delete failures[k];
});

describe("what actually reaches the database", () => {
  it("reads renewal_workspaces with the proven column projection, newest first", async () => {
    seeded.renewal_workspaces = [];
    await fetchRenewalWorkspaceRows();
    expect(seen.tables).toEqual(["renewal_workspaces"]);
    expect(seen.columns).toEqual([RENEWAL_WORKSPACE_COLUMNS]);
    expect(seen.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("reads contract_baselines with the proven column projection", async () => {
    seeded.contract_baselines = [];
    await fetchContractBaselineRows();
    expect(seen.tables).toEqual(["contract_baselines"]);
    expect(seen.columns).toEqual([CONTRACT_BASELINE_COLUMNS]);
  });

  it("never selects '*' (an unprojected read hides which columns are real)", async () => {
    seeded.renewal_workspaces = [];
    seeded.contract_baselines = [];
    await loadRenewalsOverview();
    expect(seen.columns).toHaveLength(2);
    expect(seen.columns).not.toContain("*");
  });

  it("requests no column the live tables do not have", async () => {
    // The mock throws on an unknown column, so a drifted projection fails here.
    seeded.renewal_workspaces = [workspaceRow("w1")];
    seeded.contract_baselines = [baselineRow("b1")];
    const overview = await loadRenewalsOverview();
    expect(overview.workspaces.status).toBe("ok");
    expect(overview.baselines.status).toBe("ok");
  });

  it("returns only projected fields — unrequested columns do not reach the page", async () => {
    seeded.renewal_workspaces = [workspaceRow("w1")];
    const r = await fetchRenewalWorkspaceRows();
    expect(r.status).toBe("ok");
    expect(Object.keys(r.rows[0]).sort()).toEqual(RENEWAL_WORKSPACE_COLUMNS.split(",").sort());
    expect(r.rows[0]).not.toHaveProperty("pricing");
  });
});

describe("a failed read is not an empty result", () => {
  it("classifies a genuine zero-row read as ok", async () => {
    seeded.renewal_workspaces = [];
    const r = await fetchRenewalWorkspaceRows();
    expect(r.status).toBe("ok");
    expect(r.rows).toEqual([]);
  });

  it("classifies PGRST205 as unavailable, not as zero rows", async () => {
    failures.renewal_workspaces = { code: "PGRST205", message: "Could not find the table" };
    const r = await fetchRenewalWorkspaceRows();
    expect(r.status).toBe("unavailable");
    expect(r.status).not.toBe("ok");
  });

  it("classifies 42P01 as unavailable", async () => {
    failures.contract_baselines = { code: "42P01", message: "relation does not exist" };
    expect((await fetchContractBaselineRows()).status).toBe("unavailable");
  });

  it("classifies any other failure as error and carries the real message", async () => {
    failures.contract_baselines = { code: "42501", message: "permission denied for contract_baselines" };
    const r = await fetchContractBaselineRows();
    expect(r.status).toBe("error");
    expect(r).toMatchObject({ message: "permission denied for contract_baselines" });
  });
});

describe("deriveRenewalsViewState", () => {
  it("shows records when either relation returns rows", async () => {
    seeded.renewal_workspaces = [workspaceRow("w1"), workspaceRow("w2")];
    seeded.contract_baselines = [baselineRow("b1")];
    const s = deriveRenewalsViewState(await loadRenewalsOverview());
    expect(s.kind).toBe("records");
    if (s.kind !== "records") throw new Error("unreachable");
    expect(s.workspaces).toHaveLength(2);
    expect(s.baselines).toHaveLength(1);
    expect(s.failures).toEqual([]);
  });

  it("shows the honest empty state only when BOTH reads succeeded with zero rows", async () => {
    seeded.renewal_workspaces = [];
    seeded.contract_baselines = [];
    const s = deriveRenewalsViewState(await loadRenewalsOverview());
    expect(s.kind).toBe("empty");
  });

  it("shows unreadable — never empty — when a read failed and nothing was returned", async () => {
    seeded.renewal_workspaces = [];
    failures.contract_baselines = { code: "42501", message: "permission denied" };
    const s = deriveRenewalsViewState(await loadRenewalsOverview());
    expect(s.kind).toBe("unreadable");
    expect(s.kind).not.toBe("empty");
    if (s.kind !== "unreadable") throw new Error("unreachable");
    expect(s.failures).toEqual([
      { source: "contract_baselines", status: "error", message: "permission denied" },
    ]);
  });

  it("shows unreadable when BOTH reads failed, naming both relations", async () => {
    failures.renewal_workspaces = { code: "PGRST205", message: "missing" };
    failures.contract_baselines = { code: "42501", message: "permission denied" };
    const s = deriveRenewalsViewState(await loadRenewalsOverview());
    expect(s.kind).toBe("unreadable");
    if (s.kind !== "unreadable") throw new Error("unreachable");
    expect(s.failures.map((f) => f.source)).toEqual(["renewal_workspaces", "contract_baselines"]);
  });

  it("keeps the partial-failure notice when one relation has rows and the other failed", async () => {
    seeded.renewal_workspaces = [workspaceRow("w1")];
    failures.contract_baselines = { code: "42501", message: "permission denied" };
    const s = deriveRenewalsViewState(await loadRenewalsOverview());
    expect(s.kind).toBe("records");
    if (s.kind !== "records") throw new Error("unreachable");
    expect(s.workspaces).toHaveLength(1);
    expect(s.baselines).toEqual([]);
    expect(s.failures).toHaveLength(1);
  });

  it("never counts rows from a failed read", async () => {
    failures.renewal_workspaces = { code: "42501", message: "permission denied" };
    seeded.contract_baselines = [baselineRow("b1")];
    const s = deriveRenewalsViewState(await loadRenewalsOverview());
    if (s.kind !== "records") throw new Error("expected records");
    expect(s.workspaces).toEqual([]);
    expect(s.baselines).toHaveLength(1);
  });
});
