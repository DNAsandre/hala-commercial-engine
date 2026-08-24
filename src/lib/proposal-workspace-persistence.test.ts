/**
 * proposal-workspace-persistence.test.ts — SC-01 Wave 04 (T08-B)
 *
 * Proves the proposal workspace tracker persistence tells the truth.
 *
 * These tests assert WHAT REACHES THE DATABASE — the table, the update payload,
 * the row filter, the select projection and the audit row — not merely what a
 * function returns. The mock HONOURS the `select` projection: a query that asks
 * for `id,internal_stage` gets back exactly those keys, so a test can never be
 * satisfied by a column the query never requested.
 *
 * The scenario driving this file was observed live on 2026-08-05: PATCHing an
 * existing, readable `commercial_tickets` row without permission returns
 * HTTP 200 with an EMPTY row set and leaves the stored value untouched. A
 * client that treats "no error" as "saved" therefore announces a stage change
 * that never happened.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeProposalTrackerStage,
  finalizeStageAdvance,
  readProposalTrackerStages,
} from "@/lib/proposal-workspace-persistence";

interface RecordedCall {
  table: string;
  op: "select" | "update" | "insert";
  payload: Record<string, unknown> | null;
  filters: Array<[string, unknown]>;
  projection: string | null;
}

const db = vi.hoisted(() => ({
  /** id -> stored row (full row; projections are applied on the way out). */
  rows: new Map<string, Record<string, unknown>>(),
  calls: [] as RecordedCall[],
  /** Simulate RLS refusing the UPDATE: 200 OK, zero rows, nothing written. */
  updateMatchesNoRow: false,
  updateError: null as { message: string } | null,
  readError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  /** Simulate the column ending up as something other than what was asked. */
  storeValueAs: null as string | null,
}));

function projectRow(row: Record<string, unknown>, projection: string | null): Record<string, unknown> {
  if (!projection || projection.includes("*")) return { ...row };
  const columns = projection.split(",").map(c => c.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const column of columns) {
    // Honour the projection strictly: unrequested columns are NOT returned.
    if (column in row) out[column] = row[column];
  }
  return out;
}

vi.mock("@/lib/supabase", () => {
  function makeBuilder(table: string) {
    const call: RecordedCall = { table, op: "select", payload: null, filters: [], projection: null };
    db.calls.push(call);

    const resolve = (): { data: unknown; error: unknown } => {
      if (call.op === "insert") {
        return { data: null, error: db.insertError };
      }

      const idFilter = call.filters.find(([column]) => column === "id");
      const row = idFilter ? db.rows.get(String(idFilter[1])) : undefined;

      if (call.op === "update") {
        if (db.updateError) return { data: null, error: db.updateError };
        // PostgREST semantics: an UPDATE that matches no row is NOT an error.
        const matches = row && call.filters.every(([column, value]) => row[column] === value);
        if (db.updateMatchesNoRow || !matches) return { data: null, error: null };
        for (const [column, value] of Object.entries(call.payload ?? {})) {
          row[column] = db.storeValueAs ?? value;
        }
        return { data: projectRow(row, call.projection), error: null };
      }

      if (db.readError) return { data: null, error: db.readError };
      return { data: row ? projectRow(row, call.projection) : null, error: null };
    };

    const builder: any = {
      select(projection?: string) {
        call.projection = projection ?? null;
        return builder;
      },
      update(payload: Record<string, unknown>) {
        call.op = "update";
        call.payload = payload;
        return builder;
      },
      insert(payload: Record<string, unknown>) {
        call.op = "insert";
        call.payload = payload;
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      is(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      maybeSingle: async () => resolve(),
      then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

const TICKET_ID = "a1100000-0000-4000-8000-000000000040";

beforeEach(() => {
  db.rows.clear();
  db.rows.set(TICKET_ID, {
    id: TICKET_ID,
    ticket_type: "proposal",
    ticket_title: "[HALA-UAT-ARV2] Warehousing and Transport Proposal",
    internal_stage: "qualified",
    crm_pipeline_stage: "qualified",
    type_details: { secret: "must not leak through a projection" },
  });
  db.calls.length = 0;
  db.updateMatchesNoRow = false;
  db.updateError = null;
  db.readError = null;
  db.insertError = null;
  db.storeValueAs = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const writes = () => db.calls.filter(c => c.op === "update");
const inserts = () => db.calls.filter(c => c.op === "insert");

describe("readProposalTrackerStages — rehydration reads the record, not a cache", () => {
  it("reads both tracker columns for the exact ticket id", async () => {
    const stages = await readProposalTrackerStages(TICKET_ID);

    expect(stages).toEqual({
      found: true,
      internalStage: "qualified",
      crmPipelineStage: "qualified",
      error: null,
    });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].table).toBe("commercial_tickets");
    expect(db.calls[0].projection).toBe("id,internal_stage,crm_pipeline_stage");
    expect(db.calls[0].filters).toEqual([["id", TICKET_ID]]);
  });

  it("reports a null column as null instead of inventing a stage", async () => {
    db.rows.get(TICKET_ID)!.internal_stage = null;
    db.rows.get(TICKET_ID)!.crm_pipeline_stage = null;

    const stages = await readProposalTrackerStages(TICKET_ID);

    expect(stages.found).toBe(true);
    expect(stages.internalStage).toBeNull();
    expect(stages.crmPipelineStage).toBeNull();
    expect(stages.error).toBeNull();
  });

  it("keeps a failed read distinguishable from a missing row", async () => {
    db.readError = { message: "permission denied for table commercial_tickets" };

    const failed = await readProposalTrackerStages(TICKET_ID);
    expect(failed.found).toBe(false);
    expect(failed.error).toBe("permission denied for table commercial_tickets");

    db.readError = null;
    const missing = await readProposalTrackerStages("11111111-0000-4000-8000-000000000000");
    expect(missing.found).toBe(false);
    expect(missing.error).toBeNull();
  });
});

describe("changeProposalTrackerStage — success only after confirmed persistence", () => {
  it("writes internal_stage on the requested row and confirms it from the returned row", async () => {
    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(true);
    expect(result.persistedValue).toBe("discovery");

    // What actually reached the database:
    expect(writes()).toHaveLength(1);
    expect(writes()[0].table).toBe("commercial_tickets");
    expect(writes()[0].payload).toEqual({ internal_stage: "discovery" });
    expect(writes()[0].filters).toEqual([["id", TICKET_ID], ["internal_stage", "qualified"]]);
    expect(writes()[0].projection).toBe("id,internal_stage");
    // The stored row moved, and ONLY that column moved.
    expect(db.rows.get(TICKET_ID)!.internal_stage).toBe("discovery");
    expect(db.rows.get(TICKET_ID)!.crm_pipeline_stage).toBe("qualified");
  });

  it("writes crm_pipeline_stage without touching internal_stage", async () => {
    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "crm_pipeline_stage",
      oldValue: "qualified",
      newValue: "proposal_sent",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(true);
    expect(writes()[0].payload).toEqual({ crm_pipeline_stage: "proposal_sent" });
    expect(writes()[0].projection).toBe("id,crm_pipeline_stage");
    expect(db.rows.get(TICKET_ID)!.internal_stage).toBe("qualified");
  });

  it("records the audit entry ONLY after the write is confirmed", async () => {
    await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].table).toBe("commercial_ticket_audit");
    expect(inserts()[0].payload).toEqual({
      ticket_id: TICKET_ID,
      action: "stage_changed",
      field_changed: "internal_stage",
      old_value: "qualified",
      new_value: "discovery",
      user_name: "QA Runner",
      notes: null,
    });
    // Ordering: the confirmed write comes before the audit row.
    expect(db.calls.indexOf(writes()[0])).toBeLessThan(db.calls.indexOf(inserts()[0]));
  });

  it("reports FAILURE, and writes no audit, when the update matches zero rows", async () => {
    // The live-probed case: HTTP 200, no error, no row updated.
    db.updateMatchesNoRow = true;

    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(false);
    expect(result.persistedValue).toBeNull();
    expect(result.message).toMatch(/changed after you loaded/i);
    expect(inserts()).toHaveLength(0);
    expect(db.rows.get(TICKET_ID)!.internal_stage).toBe("qualified");
  });

  it("does not write or audit when the requested stage is already current", async () => {
    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "qualified",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(true);
    expect(writes()).toHaveLength(0);
    expect(inserts()).toHaveLength(0);
  });

  it("rejects a stale tracker write and preserves the newer stored stage", async () => {
    db.rows.get(TICKET_ID)!.internal_stage = "solution_design";
    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(false);
    expect(db.rows.get(TICKET_ID)!.internal_stage).toBe("solution_design");
    expect(inserts()).toHaveLength(0);
  });

  it("reports FAILURE when the stored value is not the value that was asked for", async () => {
    db.storeValueAs = "solution_design";

    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(false);
    expect(result.persistedValue).toBe("solution_design");
    expect(inserts()).toHaveLength(0);
  });

  it("surfaces a write error verbatim and writes no audit", async () => {
    db.updateError = { message: "new row violates row-level security policy" };

    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("new row violates row-level security policy");
    expect(inserts()).toHaveLength(0);
  });

  it("still reports the confirmed save when only the audit insert fails, and says so", async () => {
    db.insertError = { message: "audit insert refused" };

    const result = await changeProposalTrackerStage({
      ticketId: TICKET_ID,
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(true);
    expect(result.auditWritten).toBe(false);
    expect(result.message).toMatch(/audit entry was not recorded/i);
    expect(db.rows.get(TICKET_ID)!.internal_stage).toBe("discovery");
  });

  it("never issues a write without a ticket id", async () => {
    const result = await changeProposalTrackerStage({
      ticketId: "  ",
      column: "internal_stage",
      oldValue: "qualified",
      newValue: "discovery",
      userName: "QA Runner",
    });

    expect(result.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("finalizeStageAdvance — a failed refresh is never a success", () => {
  it("reports confirmed only when the write landed AND the record was re-read", async () => {
    const order: string[] = [];
    const outcome = await finalizeStageAdvance({
      persist: async () => { order.push("persist"); return true; },
      refetch: async () => { order.push("refetch"); return true; },
    });

    expect(outcome.status).toBe("confirmed");
    expect(order).toEqual(["persist", "refetch"]);
  });

  it("does not refetch, and does not claim success, when the write did not land", async () => {
    const refetch = vi.fn(async () => true);
    const outcome = await finalizeStageAdvance({ persist: async () => false, refetch });

    expect(outcome.status).toBe("not_persisted");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("surfaces a thrown write as not_persisted with the real message", async () => {
    const outcome = await finalizeStageAdvance({
      persist: async () => { throw new Error("connection reset"); },
      refetch: async () => true,
    });

    expect(outcome.status).toBe("not_persisted");
    expect(outcome.message).toBe("connection reset");
  });

  it("refuses to confirm — so Undo stays shut — when the refresh fails", async () => {
    const outcome = await finalizeStageAdvance({
      persist: async () => true,
      refetch: async () => false,
    });

    expect(outcome.status).toBe("persisted_not_refreshed");
    expect(outcome.status).not.toBe("confirmed");
    expect(outcome.message).toMatch(/could not re-read/i);
    expect(outcome.message).toMatch(/Undo stays unavailable/i);
  });

  it("treats a THROWN refresh the same as a failed refresh", async () => {
    const outcome = await finalizeStageAdvance({
      persist: async () => true,
      refetch: async () => { throw new Error("timed out"); },
    });

    expect(outcome.status).toBe("persisted_not_refreshed");
  });
});
