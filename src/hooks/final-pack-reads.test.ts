/**
 * final-pack-reads.test.ts — SC-01 Wave 04 (W04-T09)
 *
 * The FinalStudio read paths. Each test asserts what actually reaches the
 * database (table, select projection, filters, ORDER BY) and that the three
 * outcomes stay distinguishable:
 *
 *   real rows      → rows, error null
 *   genuinely none → [] , error null
 *   failed read    → [] , error MESSAGE   (never silently "none")
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAllFinalPackInstances,
  fetchLinkedInstances,
  fetchTenderInstances,
} from "@/hooks/useFinalPackInstance";
import { checkSourceDrift } from "@/hooks/useSourceDrift";
import {
  TENDER_SOURCE_SELECT,
  buildTenderSourceData,
  computeSourceHash,
} from "@/lib/final-pack-loader";

const db = vi.hoisted(() => ({
  calls: [] as Array<{
    table: string;
    select?: string;
    filters: Array<[string, unknown]>;
    orders: unknown[][];
    limit?: number;
  }>,
  responses: new Map<string, { data: unknown; error: unknown }>(),
}));

/** Honour the select projection — a query never sees a column it did not ask for. */
function project(row: any, select?: string) {
  if (!row || typeof row !== "object") return row;
  if (!select || select.trim() === "*") return row;
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

function projectResult(res: { data: unknown; error: unknown }, select?: string, single = false) {
  if (res.error) return { data: null, error: res.error };
  const data = res.data;
  if (Array.isArray(data)) {
    const rows = data.map((r) => project(r, select));
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  }
  return { data: data ? project(data, select) : null, error: null };
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const call = {
        table,
        filters: [] as Array<[string, unknown]>,
        orders: [] as unknown[][],
        select: undefined as string | undefined,
        limit: undefined as number | undefined,
      };
      db.calls.push(call);
      const result = () => db.responses.get(table) ?? { data: null, error: null };
      const builder: any = {
        select(cols?: string) { call.select = cols; return builder; },
        eq(c: string, v: unknown) { call.filters.push([c, v]); return builder; },
        not(c: string, op: string, v: unknown) { call.filters.push([c, `${op}:${v}`]); return builder; },
        order(...a: unknown[]) { call.orders.push(a); return builder; },
        limit(n: number) { call.limit = n; return builder; },
        maybeSingle: async () => projectResult(result(), call.select, true),
        then: (res: any, rej: any) =>
          Promise.resolve(projectResult(result(), call.select, false)).then(res, rej),
      };
      return builder;
    },
  },
}));

const INSTANCE_ROW = {
  id: "inst-1",
  doc_type: "final_pack",
  pack_type: "combined_proposal",
  status: "draft",
  linked_entity_type: "tender",
  linked_entity_id: "a1200000-0000-4000-8000-000000000002",
  customer_name: "UAT Customer",
  branding_profile_id: null,
  template_class: "customer_facing",
  blocks: [{ id: "b1", order: 1 }],
  source_snapshot: { template_name: "Full Commercial Proposal" },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-02-01T00:00:00.000Z",
};

beforeEach(() => {
  db.calls.length = 0;
  db.responses.clear();
});

describe("fetchTenderInstances", () => {
  it("filters on the handed-over tender identity and orders explicitly", async () => {
    db.responses.set("doc_instances", { data: [INSTANCE_ROW], error: null });
    const res = await fetchTenderInstances("a1200000-0000-4000-8000-000000000002");

    const call = db.calls.find((c) => c.table === "doc_instances");
    expect(call?.filters).toEqual([
      ["linked_entity_type", "tender"],
      ["linked_entity_id", "a1200000-0000-4000-8000-000000000002"],
      ["pack_type", "is:null"],
    ]);
    expect(call?.orders).toEqual([["updated_at", { ascending: false }]]);
    expect(res.error).toBeNull();
    expect(res.instances.map((i) => i.id)).toEqual(["inst-1"]);
    // Identity is carried through the mapper, not re-derived.
    expect(res.instances[0].tender_id).toBe("a1200000-0000-4000-8000-000000000002");
  });

  it("reports a failed read instead of an empty list", async () => {
    db.responses.set("doc_instances", { data: null, error: { message: "permission denied" } });
    const res = await fetchTenderInstances("a1200000-0000-4000-8000-000000000002");
    expect(res.instances).toEqual([]);
    expect(res.error).toBe("permission denied");
  });

  it("a genuine zero-row result is an empty list with no error", async () => {
    db.responses.set("doc_instances", { data: [], error: null });
    const res = await fetchTenderInstances("a1200000-0000-4000-8000-000000000002");
    expect(res.instances).toEqual([]);
    expect(res.error).toBeNull();
  });
});

describe("fetchLinkedInstances — proposal identity", () => {
  it("queries the proposal namespace instead of the tender namespace", async () => {
    db.responses.set("doc_instances", {
      data: [{ ...INSTANCE_ROW, linked_entity_type: "proposal", linked_entity_id: "proposal-1" }],
      error: null,
    });
    const res = await fetchLinkedInstances("proposal-1", "proposal");

    const call = db.calls.find((entry) => entry.table === "doc_instances");
    expect(call?.filters).toEqual([
      ["linked_entity_type", "proposal"],
      ["linked_entity_id", "proposal-1"],
      ["pack_type", "is:null"],
    ]);
    expect(db.calls.filter((entry) => entry.table === "doc_instances").map((entry) => entry.filters[0]))
      .toEqual([
        ["linked_entity_type", "proposal"],
        ["linked_entity_type", "tender"],
      ]);
    expect(res.error).toBeNull();
    expect(res.instances).toHaveLength(1); // canonical + legacy query deduplicated by instance id
    expect(res.instances[0].tender_id).toBe("proposal-1");
  });
});

describe("fetchAllFinalPackInstances", () => {
  it("lists final_pack instances newest-edited first", async () => {
    db.responses.set("doc_instances", { data: [INSTANCE_ROW], error: null });
    const res = await fetchAllFinalPackInstances();

    const call = db.calls.find((c) => c.table === "doc_instances");
    expect(call?.filters).toEqual([["doc_type", "final_pack"]]);
    expect(call?.orders).toEqual([["updated_at", { ascending: false }]]);
    expect(call?.limit).toBe(50);
    expect(res.error).toBeNull();
    expect(res.instances).toHaveLength(1);
  });

  it("a failed read is an error, not 'No documents yet'", async () => {
    db.responses.set("doc_instances", { data: null, error: { message: "network error" } });
    const res = await fetchAllFinalPackInstances();
    expect(res.instances).toEqual([]);
    expect(res.error).toBe("network error");
  });
});

describe("checkSourceDrift", () => {
  const TENDER = {
    id: "a1200000-0000-4000-8000-000000000002",
    ticket_title: "[HALA-UAT-ARV2][W2-S002] Fifteen Stage Tender Test",
    customer_name: "UAT Customer",
    estimated_value: 100,
    target_gp_percent: 20,
    target_date: "2026-09-01",
    internal_stage: "clarification",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    type_details: { tender: { title: "t" }, pricing: { scenarios: { rows: [] } } },
  };

  it("selects the same projection the snapshot hash was built from", async () => {
    db.responses.set("commercial_tickets", { data: TENDER, error: null });
    await checkSourceDrift(TENDER.id, "whatever");
    const call = db.calls.find((c) => c.table === "commercial_tickets");
    expect(call?.select).toBe(TENDER_SOURCE_SELECT);
    expect(call?.filters).toEqual([["id", TENDER.id]]);
  });

  it("reports NO drift when the source is unchanged", async () => {
    db.responses.set("commercial_tickets", { data: TENDER, error: null });
    const snapshotHash = await computeSourceHash(buildTenderSourceData(TENDER));
    const res = await checkSourceDrift(TENDER.id, snapshotHash);
    expect(res.error).toBeNull();
    expect(res.drifted).toBe(false);
  });

  it("reports drift when the source content really changed", async () => {
    const snapshotHash = await computeSourceHash(buildTenderSourceData(TENDER));
    db.responses.set("commercial_tickets", {
      data: { ...TENDER, customer_name: "Someone Else" },
      error: null,
    });
    const res = await checkSourceDrift(TENDER.id, snapshotHash);
    expect(res.drifted).toBe(true);
  });

  it("a failed check is 'unknown', never 'unchanged'", async () => {
    db.responses.set("commercial_tickets", { data: null, error: { message: "permission denied" } });
    const res = await checkSourceDrift(TENDER.id, "hash");
    expect(res.drifted).toBeNull();
    expect(res.error).toBe("permission denied");
  });

  it("a missing source row is reported honestly", async () => {
    db.responses.set("commercial_tickets", { data: null, error: null });
    const res = await checkSourceDrift("gone", "hash");
    expect(res.drifted).toBeNull();
    expect(res.error).toContain("no longer readable");
  });
});
