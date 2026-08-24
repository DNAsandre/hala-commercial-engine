/**
 * intake-save.test.ts — SC-01 Wave 04, Fable-owned shared module.
 *
 * `changeStage` is the single write path behind the CRM Pipeline board and both
 * workspace stage trackers. It previously issued
 *   .update({...}).eq("id", id)
 * and inspected only `error`. An update matching zero rows returns no error, so
 * a change that stored nothing was reported as success AND recorded a
 * `stage_changed` audit entry — a fabricated audit event for a change that
 * never happened.
 *
 * These tests assert what actually reaches the database and that no audit row
 * is written unless the stored value was read back and matches.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; op: string; payload?: unknown; filters: Record<string, unknown>; columns?: string };

const calls: Call[] = [];
let updateResult: { data: unknown; error: unknown } = { data: [], error: null };
let insertResult: { error: unknown } = { error: null };

function makeBuilder(table: string) {
  const call: Call = { table, op: "", filters: {} };
  const builder: any = {
    update(payload: unknown) {
      call.op = "update";
      call.payload = payload;
      calls.push(call);
      return builder;
    },
    insert(payload: unknown) {
      call.op = "insert";
      call.payload = payload;
      calls.push(call);
      return Promise.resolve(insertResult);
    },
    eq(col: string, val: unknown) {
      call.filters[col] = val;
      return builder;
    },
    /**
     * The projection is ENFORCED, not merely recorded. PostgREST returns only
     * the columns asked for; a mock that hands back the whole fixture lets a
     * function read a column it never requested and still pass. That exact
     * leniency certified a fabricated "GP 0%" in this codebase during Wave 03.
     */
    select(columns?: string) {
      call.columns = columns;
      const wanted = (columns ?? "*").split(",").map(c => c.trim()).filter(Boolean);
      if (!updateResult.data || wanted.includes("*")) return Promise.resolve(updateResult);
      const projected = (updateResult.data as Array<Record<string, unknown>>).map(row =>
        Object.fromEntries(wanted.filter(c => c in row).map(c => [c, row[c]])),
      );
      return Promise.resolve({ data: projected, error: updateResult.error });
    },
    // an `.update().eq()` that is never `.select()`ed still has to resolve
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import { activateTicket, changeStage, deactivateTicket } from "./intake-save";

const TICKET = "a1100000-0000-4000-8000-000000000040";

beforeEach(() => {
  calls.length = 0;
  updateResult = { data: [], error: null };
  insertResult = { error: null };
});

const auditWrites = () => calls.filter((c) => c.table === "commercial_ticket_audit");
const stageUpdates = () => calls.filter((c) => c.table === "commercial_tickets" && c.op === "update");

describe("changeStage — success requires confirmed persistence", () => {
  it("reads the row back and only then writes the audit entry", async () => {
    updateResult = {
      data: [{ id: TICKET, crm_pipeline_stage: "proposal_sent", internal_stage: "qualified" }],
      error: null,
    };

    const r = await changeStage(TICKET, "crm_pipeline_stage", "qualified", "proposal_sent", "Tester");

    expect(r.error).toBeNull();
    // what reached the database
    expect(stageUpdates()).toHaveLength(1);
    expect(stageUpdates()[0].payload).toEqual({ crm_pipeline_stage: "proposal_sent" });
    expect(stageUpdates()[0].filters).toEqual({ id: TICKET });
    // the read-back is what makes success truthful
    expect(stageUpdates()[0].columns).toContain("crm_pipeline_stage");
    expect(auditWrites()).toHaveLength(1);
    expect(auditWrites()[0].payload).toMatchObject({
      ticket_id: TICKET,
      action: "stage_changed",
      field_changed: "crm_pipeline_stage",
      old_value: "qualified",
      new_value: "proposal_sent",
    });
  });

  it("fails — and writes NO audit row — when the update matched zero rows", async () => {
    updateResult = { data: [], error: null }; // no error, nothing stored

    const r = await changeStage(TICKET, "internal_stage", "qualified", "discovery", "Tester");

    expect(r.error).toBeTruthy();
    expect(r.error).toMatch(/not stored/i);
    expect(auditWrites()).toHaveLength(0);
  });

  it("fails — and writes NO audit row — when the stored value differs from the requested one", async () => {
    updateResult = {
      data: [{ id: TICKET, crm_pipeline_stage: "qualified", internal_stage: "qualified" }],
      error: null,
    };

    const r = await changeStage(TICKET, "crm_pipeline_stage", "qualified", "proposal_sent", "Tester");

    expect(r.error).toBeTruthy();
    expect(r.error).toContain("qualified");
    expect(auditWrites()).toHaveLength(0);
  });

  it("propagates a genuine database error and writes no audit row", async () => {
    updateResult = { data: null, error: { message: "permission denied for table commercial_tickets" } };

    const r = await changeStage(TICKET, "internal_stage", "a", "b", "Tester");

    expect(r.error).toBe("permission denied for table commercial_tickets");
    expect(auditWrites()).toHaveLength(0);
  });

  it("updates only the requested column — the other stage is never touched", async () => {
    updateResult = {
      data: [{ id: TICKET, crm_pipeline_stage: "qualified", internal_stage: "discovery" }],
      error: null,
    };

    await changeStage(TICKET, "internal_stage", "qualified", "discovery", "Tester");

    expect(stageUpdates()[0].payload).toEqual({ internal_stage: "discovery" });
    expect(Object.keys(stageUpdates()[0].payload as object)).not.toContain("crm_pipeline_stage");
  });
});

describe("ticket archive and restore — confirmed persistence", () => {
  it("archives only after active=false reads back", async () => {
    updateResult = { data: [{ id: TICKET, active: false }], error: null };
    const result = await deactivateTicket(TICKET, "Tester");
    expect(result.error).toBeNull();
    expect(stageUpdates()[0].payload).toEqual({ active: false });
    expect(auditWrites()).toHaveLength(1);
  });

  it("restores only after active=true reads back", async () => {
    updateResult = { data: [{ id: TICKET, active: true }], error: null };
    const result = await activateTicket(TICKET, "Tester");
    expect(result.error).toBeNull();
    expect(stageUpdates()[0].payload).toEqual({ active: true });
    expect(auditWrites()[0].payload).toMatchObject({
      action: "updated",
      field_changed: "active",
      old_value: "false",
      new_value: "true",
    });
  });

  it("does not claim restore success when no row was updated", async () => {
    updateResult = { data: [], error: null };
    const result = await activateTicket(TICKET, "Tester");
    expect(result.error).toContain("not restored");
    expect(auditWrites()).toHaveLength(0);
  });
});
