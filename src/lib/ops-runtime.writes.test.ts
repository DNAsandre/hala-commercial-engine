/**
 * ops-runtime.writes.test.ts — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Three defects are pinned here:
 *
 *  A. SUCCESS REPORTED WITHOUT CONFIRMED PERSISTENCE. `updateFacility` must
 *     read the row back and compare the stored value with the requested one.
 *     PostgREST returns NO ERROR when an update matches zero rows, so
 *     "the request resolved" is not "the change was stored".
 *
 *  B. "Invalid Date" must never reach rendered output. `toLocaleDateString`
 *     does not throw on a malformed value — it returns that literal string.
 *
 *  D. A FAILED READ IS NOT AN ABSENT RECORD. `describeBotProvider` must not
 *     say "no matching provider record" when the provider read never
 *     succeeded.
 *
 * MOCK CONTRACT (identical in spirit to ops-runtime.reads.test.ts): the stub
 * records the table, the update payload, the filters and the `select`
 * projection, and returns ONLY the rows a test installs. It never invents a
 * column the query did not ask for. Every assertion about a write checks what
 * actually reaches the database, not merely what the function returns.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

type Terminal = { data?: unknown; error?: unknown };

interface RecordedWrite {
  table: string;
  update: Record<string, unknown> | null;
  eq: Array<[string, unknown]>;
  projection: string | null;
}

const writes: RecordedWrite[] = [];
let nextResult: Terminal = { data: [], error: null };

function makeBuilder(table: string) {
  const call: RecordedWrite = { table, update: null, eq: [], projection: null };

  const builder: any = {
    update: (patch: Record<string, unknown>) => {
      call.update = patch;
      writes.push(call);
      return builder;
    },
    eq: (column: string, value: unknown) => {
      call.eq.push([column, value]);
      return builder;
    },
    select: (columns?: string) => {
      call.projection = columns ?? null;
      // Honour the projection: only the selected columns can come back.
      const requested = (columns ?? "").split(",").map(c => c.trim()).filter(Boolean);
      const rows = Array.isArray(nextResult.data) ? (nextResult.data as Array<Record<string, unknown>>) : nextResult.data;
      const projected = Array.isArray(rows)
        ? rows.map(row => {
            const out: Record<string, unknown> = {};
            for (const column of requested) {
              if (column in row) out[column] = row[column];
            }
            return out;
          })
        : rows;
      return Promise.resolve({ data: projected, error: nextResult.error ?? null });
    },
    then: (resolve: (v: Terminal) => unknown) => resolve(nextResult),
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import {
  FACILITIES_TABLE,
  TIMESTAMP_NOT_RECORDED,
  TIMESTAMP_UNREADABLE,
  describeBotProvider,
  formatRecordedDate,
  formatRecordedDateTime,
  updateFacility,
  type AiProviderRecord,
  type RecordRead,
} from "./ops-runtime";

beforeEach(() => {
  writes.length = 0;
  nextResult = { data: [], error: null };
});

// ── A. Confirmed persistence ────────────────────────────────────────────────

describe("updateFacility — a resolved request is not proof of persistence", () => {
  it("reads the row back and only reports 'stored' when the value matches", async () => {
    nextResult = {
      data: [{ id: "f-1", name: "Jubail (JUB3)", code: "JUB3", region: "East" }],
      error: null,
    };

    const result = await updateFacility("f-1", {
      name: "Jubail (JUB3)",
      code: "JUB3",
      region: "East",
    });

    expect(result.status).toBe("stored");

    // What actually reached the database:
    expect(writes).toHaveLength(1);
    const write = writes[0]!;
    expect(write.table).toBe(FACILITIES_TABLE);
    expect(write.update).toEqual({ name: "Jubail (JUB3)", code: "JUB3", region: "East" });
    expect(write.eq).toEqual([["id", "f-1"]]);
    // The read-back is what makes this a confirmation rather than a hope.
    expect(write.projection).toBe("id, name, code, region");
  });

  it("reports NOT stored — not success — when the update matched zero rows", async () => {
    // PostgREST answers an update that matches nothing with no error at all.
    nextResult = { data: [], error: null };

    const result = await updateFacility("f-missing", { name: "New Name" });

    expect(result.status).toBe("not_stored");
    if (result.status !== "not_stored") throw new Error("unreachable");
    expect(result.error).toMatch(/not stored/i);
    expect(result.error).toMatch(/no matching facility record/i);
    // The projection still had to be requested; without it this case is invisible.
    expect(writes[0]!.projection).toBe("id, name");
  });

  it("reports NOT stored when the stored value differs from the requested one", async () => {
    nextResult = { data: [{ id: "f-1", name: "Old Name" }], error: null };

    const result = await updateFacility("f-1", { name: "New Name" });

    expect(result.status).toBe("not_stored");
    if (result.status !== "not_stored") throw new Error("unreachable");
    expect(result.error).toContain('name still reads "Old Name"');
  });

  it("distinguishes a failed request from a request that stored nothing", async () => {
    nextResult = { data: null, error: { message: "permission denied for table facilities" } };

    const result = await updateFacility("f-1", { active: false });

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("unreachable");
    expect(result.error).toBe("permission denied for table facilities");
  });

  it("confirms a boolean toggle against the stored column", async () => {
    nextResult = { data: [{ id: "f-1", active: false }], error: null };

    const stored = await updateFacility("f-1", { active: false });
    expect(stored.status).toBe("stored");
    expect(writes[0]!.update).toEqual({ active: false });
    expect(writes[0]!.projection).toBe("id, active");

    // The database ignored the toggle: still active. That is NOT a success.
    writes.length = 0;
    nextResult = { data: [{ id: "f-1", active: true }], error: null };
    const rejected = await updateFacility("f-1", { active: false });
    expect(rejected.status).toBe("not_stored");
  });

  it("treats null and undefined as the same absence when comparing", async () => {
    nextResult = { data: [{ id: "f-1", code: null }], error: null };
    const result = await updateFacility("f-1", { code: null });
    expect(result.status).toBe("stored");
  });

  it("refuses to issue an update with no fields", async () => {
    const result = await updateFacility("f-1", {});
    expect(result.status).toBe("error");
    expect(writes).toHaveLength(0);
  });
});

// ── B. Invalid Date must never be rendered ──────────────────────────────────

describe("formatRecordedDate / formatRecordedDateTime", () => {
  it("never returns the string 'Invalid Date'", () => {
    for (const bad of ["not-a-date", "0000-13-45", "??", "2026-99-99T99:99:99Z"]) {
      expect(formatRecordedDate(bad)).not.toContain("Invalid Date");
      expect(formatRecordedDateTime(bad)).not.toContain("Invalid Date");
      expect(formatRecordedDate(bad)).toBe(TIMESTAMP_UNREADABLE);
      expect(formatRecordedDateTime(bad)).toBe(TIMESTAMP_UNREADABLE);
    }
    // The raw behaviour this guards against, stated explicitly:
    expect(new Date("not-a-date").toLocaleDateString()).toBe("Invalid Date");
  });

  it("distinguishes an absent value from a malformed one", () => {
    expect(formatRecordedDate(null)).toBe(TIMESTAMP_NOT_RECORDED);
    expect(formatRecordedDate(undefined)).toBe(TIMESTAMP_NOT_RECORDED);
    expect(formatRecordedDate("")).toBe(TIMESTAMP_NOT_RECORDED);
    expect(formatRecordedDateTime(null)).toBe(TIMESTAMP_NOT_RECORDED);
    expect(TIMESTAMP_NOT_RECORDED).not.toBe(TIMESTAMP_UNREADABLE);
  });

  it("renders a real recorded timestamp", () => {
    const iso = "2026-03-04T10:20:30.000Z";
    expect(formatRecordedDate(iso)).toBe(new Date(iso).toLocaleDateString());
    expect(formatRecordedDateTime(iso)).toBe(new Date(iso).toLocaleString());
    expect(formatRecordedDate(iso)).toContain("2026");
  });
});

// ── D. A failed read is not an absent record ────────────────────────────────

describe("describeBotProvider", () => {
  const provider: AiProviderRecord = {
    id: "aip-openai-001",
    name: "openai",
    displayName: "OpenAI",
    modelDefault: "gpt-4o",
    models: ["gpt-4o"],
    enabled: true,
    config: {},
  };
  const loaded: RecordRead<AiProviderRecord> = { status: "loaded", rows: [provider] };
  const empty: RecordRead<AiProviderRecord> = { status: "empty", rows: [] };
  const failed: RecordRead<AiProviderRecord> = { status: "error", rows: [], error: "network down" };
  const absent: RecordRead<AiProviderRecord> = {
    status: "unavailable",
    rows: [],
    error: 'The table "ai_providers" does not exist in this project.',
  };

  it("names the provider when a record with that id was read", () => {
    const d = describeBotProvider("aip-openai-001", loaded);
    expect(d.state).toBe("matched");
    expect(d.label).toBe("OpenAI");
  });

  it("says no record has that id ONLY when the read succeeded", () => {
    const d = describeBotProvider("prov-openai", loaded);
    expect(d.state).toBe("unmatched");
    expect(d.label).toContain("no matching provider record");

    const onEmpty = describeBotProvider("prov-openai", empty);
    expect(onEmpty.state).toBe("unmatched");
  });

  it("does NOT claim the record is missing when the read failed", () => {
    for (const read of [failed, absent]) {
      const d = describeBotProvider("prov-openai", read);
      expect(d.state).toBe("unreadable");
      expect(d.label).not.toContain("no matching provider record");
      expect(d.label).toMatch(/could not be read/);
      expect(d.label).toMatch(/unknown/);
    }
  });

  it("does not assert anything while the read is still pending", () => {
    const d = describeBotProvider("prov-openai", null);
    expect(d.state).toBe("unread");
    expect(d.label).not.toContain("no matching provider record");
  });

  it("reports an unrecorded provider id as recorded-nothing, not as a failure", () => {
    expect(describeBotProvider(null, loaded).state).toBe("none");
    expect(describeBotProvider(null, failed).state).toBe("none");
  });
});
