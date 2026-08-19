/**
 * knowledgebase.test.ts — SC-01 Wave 06, lane T13 (manifest row B-19).
 *
 * `fetchCollections` previously collapsed every outcome into either a thrown
 * Error or an array, so a caller could not tell "the table has no rows" apart
 * from "the table is absent" apart from "the read broke". The classified
 * `fetchCollectionsResult` answers with three distinguishable outcomes:
 *
 *   ok          — read succeeded; zero visible rows is an HONEST empty picker
 *   unavailable — the table does not exist in this project (PGRST205 / 42P01)
 *   error       — the read genuinely failed; nothing is known about the rows
 *
 * MOCK CONTRACT (house standard, intake-save.test.ts): the stub records the
 * table, the exact `select` projection and the ordering that reach the
 * database, and returns ONLY the rows a test installs for that table. The
 * projection here is the established `*` + embedded counts; the assertions pin
 * that exact string so nobody silently narrows or widens the read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Terminal = { data?: unknown; error?: unknown };

interface RecordedCall {
  table: string;
  columns: string | null;
  order: Array<[string, boolean | undefined]>;
}

const results = new Map<string, Terminal>();
const calls: RecordedCall[] = [];

function makeBuilder(table: string) {
  const call: RecordedCall = { table, columns: null, order: [] };
  calls.push(call);
  const resolveResult = (): Terminal => results.get(table) ?? { data: [], error: null };
  const builder: any = {
    select: (cols?: string) => {
      call.columns = cols ?? null;
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      call.order.push([col, opts?.ascending]);
      return builder;
    },
    eq: () => builder,
    in: () => builder,
    then: (resolve: (v: Terminal) => unknown) => resolve(resolveResult()),
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import {
  KB_COLLECTIONS_SELECT,
  KB_COLLECTIONS_TABLE,
  fetchCollections,
  fetchCollectionsResult,
} from "./knowledgebase";

beforeEach(() => {
  results.clear();
  calls.length = 0;
});

const lastCallFor = (table: string) => calls.filter((c) => c.table === table).at(-1)!;

describe("fetchCollectionsResult — classified KB-collection read (B-19)", () => {
  it("reads kb_collections with the established projection, newest first", async () => {
    results.set(KB_COLLECTIONS_TABLE, { data: [], error: null });
    await fetchCollectionsResult();

    const call = lastCallFor(KB_COLLECTIONS_TABLE);
    expect(call.table).toBe("kb_collections");
    expect(call.columns).toBe(KB_COLLECTIONS_SELECT);
    expect(call.columns).toBe("*, kb_documents(count), kb_chunks(count)");
    expect(call.order).toEqual([["created_at", false]]);
  });

  it("reports a successful zero-row read as OK with an empty list — the live state — not as a failure", async () => {
    // Live probe 2026-08-18: kb_collections exists, HTTP 200, 0 rows visible.
    results.set(KB_COLLECTIONS_TABLE, { data: [], error: null });
    const result = await fetchCollectionsResult();
    expect(result.status).toBe("ok");
    expect(result.collections).toEqual([]);
  });

  it("maps recorded rows, taking doc/chunk counts from the embedded aggregates", async () => {
    results.set(KB_COLLECTIONS_TABLE, {
      data: [{
        id: "kbc-1", name: "SLA Library", description: "Recorded SLAs",
        visibility: "internal", created_by: "u-1", created_at: "2026-06-01T00:00:00Z",
        kb_documents: [{ count: 4 }], kb_chunks: [{ count: 40 }],
      }],
      error: null,
    });
    const result = await fetchCollectionsResult();
    expect(result.status).toBe("ok");
    expect(result.collections[0]).toEqual({
      id: "kbc-1", name: "SLA Library", description: "Recorded SLAs",
      visibility: "internal", created_by: "u-1", created_at: "2026-06-01T00:00:00Z",
      doc_count: 4, chunk_count: 40,
    });
  });

  it("reports a missing table as UNAVAILABLE, distinct from empty and from error", async () => {
    for (const code of ["PGRST205", "42P01"]) {
      results.set(KB_COLLECTIONS_TABLE, { data: null, error: { code, message: "Could not find the table" } });
      const result = await fetchCollectionsResult();
      expect(result.status).toBe("unavailable");
      expect(result.collections).toEqual([]);
      if (result.status === "unavailable") {
        expect(result.error).toContain("kb_collections");
        expect(result.error).toContain("does not exist");
      }
    }
  });

  it("reports a failed read as ERROR carrying the real message — never as an empty ok", async () => {
    results.set(KB_COLLECTIONS_TABLE, {
      data: null,
      error: { code: "42501", message: "permission denied for table kb_collections" },
    });
    const result = await fetchCollectionsResult();
    expect(result.status).toBe("error");
    expect(result.status).not.toBe("ok");
    expect(result.collections).toEqual([]);
    if (result.status === "error") {
      expect(result.error).toBe("permission denied for table kb_collections");
    }
  });
});

describe("fetchCollections — compatibility wrapper for pre-Wave-06 callers", () => {
  it("returns the mapped rows on a successful read", async () => {
    results.set(KB_COLLECTIONS_TABLE, {
      data: [{ id: "kbc-1", name: "SLA Library", description: "", visibility: "internal", created_by: "u", created_at: "2026-06-01" }],
      error: null,
    });
    const collections = await fetchCollections();
    expect(collections).toHaveLength(1);
    expect(collections[0].id).toBe("kbc-1");
    expect(collections[0].doc_count).toBe(0);
  });

  it("still throws on a failed read with the message format Admin.tsx catches", async () => {
    results.set(KB_COLLECTIONS_TABLE, {
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(fetchCollections()).rejects.toThrow(
      "Failed to load knowledgebase collections: permission denied",
    );
  });

  it("throws (rather than returning []) when the table is absent — a failed read is not an empty result", async () => {
    results.set(KB_COLLECTIONS_TABLE, {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table" },
    });
    await expect(fetchCollections()).rejects.toThrow(/Failed to load knowledgebase collections/);
  });
});
