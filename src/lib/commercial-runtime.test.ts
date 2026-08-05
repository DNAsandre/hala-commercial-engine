/**
 * commercial-runtime.test.ts — SC-01 Wave 03 / Ticket T04 (agent W03-1).
 *
 * Focused coverage of the honesty contract:
 *   - real data      → mapped rows come back
 *   - honest empty   → `{ ok: true, data: [] }`, NOT an error
 *   - functional err → `{ ok: false, error }`, and NEVER a false success
 *   - mutations      → only reported as successful when a row actually came
 *                      back from .select()
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase client mock ────────────────────────────────────────────
// Queue-driven: every awaited builder (or .single()) shifts one result.

type MockResult = { data: unknown; error: { message: string } | null };

const resultQueue: MockResult[] = [];

function queue(...results: MockResult[]) {
  resultQueue.push(...results);
}

function nextResult(): MockResult {
  return (
    resultQueue.shift() ?? {
      data: null,
      error: { message: "test error: supabase mock queue was empty" },
    }
  );
}

function makeBuilder(): any {
  const builder: any = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "neq", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(nextResult()));
  builder.maybeSingle = vi.fn(() => Promise.resolve(nextResult()));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(nextResult()).then(onFulfilled, onRejected);
  return builder;
}

const fromSpy = vi.fn(() => makeBuilder());

vi.mock("./supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => (fromSpy as any)(...args),
  },
}));

vi.mock("./auth-state", () => ({
  getCurrentUser: () => ({
    id: "u1",
    name: "Test Human",
    email: "t@example.com",
    role: "commercial_manager",
    region: "Central",
  }),
}));

const fetchOperationalTicketsByType = vi.fn();
const changeStage = vi.fn();

vi.mock("./intake-save", () => ({
  fetchOperationalTicketsByType: (...args: unknown[]) =>
    (fetchOperationalTicketsByType as any)(...args),
  changeStage: (...args: unknown[]) => (changeStage as any)(...args),
}));

import {
  listQuotesByWorkspace,
  createQuote,
  updateQuote,
  submitQuote,
  approveQuote,
  rejectQuote,
  listProposalsByWorkspace,
  markProposalSent,
  listUnstoredQuoteFields,
  mapInternalStageToProposalState,
} from "./commercial-runtime";

const QUOTE_ROW = {
  id: "q1",
  workspace_id: "ws1",
  version: 2,
  state: "submitted",
  created_at: "2026-01-01T00:00:00Z",
  storage_rate: "12.5",
  inbound_rate: 3,
  outbound_rate: 4,
  pallet_volume: 100,
  monthly_revenue: 1000,
  annual_revenue: 12000,
  total_cost: 9000,
  gp_percent: 25,
  gp_amount: 3000,
};

beforeEach(() => {
  resultQueue.length = 0;
  fromSpy.mockClear();
  fetchOperationalTicketsByType.mockReset();
  changeStage.mockReset();
});

// ════════════════════════════════════════════════════════════════════
// MAIN READ — listQuotesByWorkspace (row 71)
// ════════════════════════════════════════════════════════════════════

describe("listQuotesByWorkspace", () => {
  it("returns mapped rows with the established columns surfaced under the UI keys", async () => {
    queue({ data: [QUOTE_ROW], error: null });

    const res = await listQuotesByWorkspace("ws1");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    const quote = res.data[0];
    expect(quote.id).toBe("q1");
    expect(quote.storage_rate).toBe(12.5);
    // aliases are the established columns, not extra storage
    expect(quote.status).toBe(quote.state);
    expect(quote.version_number).toBe(quote.version);
    expect(quote.estimated_cost).toBe(quote.total_cost);
    expect(fromSpy).toHaveBeenCalledWith("quotes");
  });

  it("treats no rows as an honest empty list, not an error", async () => {
    queue({ data: [], error: null });

    const res = await listQuotesByWorkspace("ws1");

    expect(res).toEqual({ ok: true, data: [] });
  });

  it("surfaces a failed query as an error instead of an empty list", async () => {
    queue({ data: null, error: { message: "permission denied for table quotes" } });

    const res = await listQuotesByWorkspace("ws1");

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("permission denied for table quotes");
  });

  it("refuses to read without a workspace id", async () => {
    const res = await listQuotesByWorkspace("");
    expect(res.ok).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// MUTATION — submitQuote (row 55) / approveQuote (row 52)
// ════════════════════════════════════════════════════════════════════

describe("submitQuote", () => {
  it("reports success only when the update returned the affected row", async () => {
    queue({ data: [{ ...QUOTE_ROW, state: "submitted" }], error: null });

    const res = await submitQuote("q1");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.state).toBe("submitted");
    expect(res.data.status).toBe("submitted");
  });

  it("does NOT report success when the update matched no row", async () => {
    queue({ data: [], error: null });

    const res = await submitQuote("q1");

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("NOT changed");
  });

  it("surfaces a write error", async () => {
    queue({ data: null, error: { message: "row-level security violation" } });

    const res = await submitQuote("q1");

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("row-level security violation");
  });
});

describe("approveQuote", () => {
  it("records the human approval without enforcing anything", async () => {
    queue({ data: [{ ...QUOTE_ROW, state: "approved" }], error: null });

    const res = await approveQuote("q1");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.state).toBe("approved");
  });
});

// ════════════════════════════════════════════════════════════════════
// MUTATION — createQuote / updateQuote (unstored-field honesty)
// ════════════════════════════════════════════════════════════════════

describe("createQuote", () => {
  it("inserts at the next version and reports the values it could not store", async () => {
    queue(
      { data: [{ version: 2 }], error: null }, // highest existing version
      { data: [{ ...QUOTE_ROW, id: "q2", version: 3, state: "draft" }], error: null },
    );

    const res = await createQuote("ws1", {
      storage_rate: 12.5,
      estimated_cost: 9000,
      assumptions: "5-day working week",
      currency: "SAR",
      discount_percent: 0,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.quote.version).toBe(3);
    expect(res.data.quote.state).toBe("draft");
    expect(res.data.unstoredFields).toContain("assumptions");
    expect(res.data.unstoredFields).toContain("currency");
    // a zero discount lost no information, so it is not reported
    expect(res.data.unstoredFields).not.toContain("discount_percent");
  });

  it("does NOT report success when the insert returned no row", async () => {
    queue(
      { data: [], error: null },
      { data: [], error: null },
    );

    const res = await createQuote("ws1", { storage_rate: 1 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("NOT created");
  });

  it("fails when the existing versions could not be read", async () => {
    queue({ data: null, error: { message: "connection reset" } });

    const res = await createQuote("ws1", { storage_rate: 1 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("connection reset");
  });
});

describe("updateQuote", () => {
  it("refuses when nothing supplied maps to an established column", async () => {
    const res = await updateQuote("q1", { assumptions: "only unstored data" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("none of the supplied values map to a column");
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("does NOT report success when no row matched the id", async () => {
    queue({ data: [], error: null });

    const res = await updateQuote("missing", { storage_rate: 5 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("NOT updated");
  });
});

describe("rejectQuote", () => {
  it("keeps the confirmed state change but warns when the reason could not be recorded", async () => {
    queue(
      { data: [{ ...QUOTE_ROW, state: "rejected" }], error: null }, // state update
      { data: null, error: { message: "relation approval_records does not exist" } },
    );

    const res = await rejectQuote("q1", "Margin too thin");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.quote.state).toBe("rejected");
    expect(res.data.warnings.join(" ")).toContain("NOT recorded");
  });

  it("requires a reason and writes nothing without one", async () => {
    const res = await rejectQuote("q1", "   ");
    expect(res.ok).toBe(false);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// PROPOSALS — listProposalsByWorkspace (row 70) + markProposalSent (row 48)
// ════════════════════════════════════════════════════════════════════

const TICKET = {
  id: "t1",
  ticket_type: "proposal",
  ticket_title: "Sadara warehousing proposal",
  customer_name: "Sadara",
  internal_stage: "proposal_drafting",
  legacy_workspace_id: "ws1",
  type_details: { proposal_version: 2 },
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
} as any;

describe("listProposalsByWorkspace", () => {
  it("returns the workspace's proposal tickets mapped to the panel shape", async () => {
    fetchOperationalTicketsByType.mockResolvedValue({ data: [TICKET], error: null });

    const res = await listProposalsByWorkspace("ws1");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Sadara warehousing proposal");
    expect(res.data[0].version_number).toBe(2);
    expect(res.data[0].internal_stage).toBe("proposal_drafting");
  });

  it("treats a workspace with no proposal ticket as an honest empty list", async () => {
    fetchOperationalTicketsByType.mockResolvedValue({ data: [TICKET], error: null });

    const res = await listProposalsByWorkspace("some-other-workspace");

    expect(res).toEqual({ ok: true, data: [] });
  });

  it("surfaces a failed feed read as an error", async () => {
    fetchOperationalTicketsByType.mockResolvedValue({ data: [], error: "JWT expired" });

    const res = await listProposalsByWorkspace("ws1");

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("JWT expired");
  });
});

describe("markProposalSent", () => {
  it("confirms the stage change by reading the ticket back", async () => {
    queue(
      { data: [{ internal_stage: "proposal_drafting" }], error: null }, // pre-read
      { data: [{ internal_stage: "proposal_sent" }], error: null }, // confirm read
    );
    changeStage.mockResolvedValue({ error: null });

    const res = await markProposalSent("t1");

    expect(res.ok).toBe(true);
    expect(changeStage).toHaveBeenCalledWith(
      "t1",
      "internal_stage",
      "proposal_drafting",
      "proposal_sent",
      "Test Human",
    );
  });

  it("does NOT report success when the read-back shows the stage did not move", async () => {
    queue(
      { data: [{ internal_stage: "proposal_drafting" }], error: null },
      { data: [{ internal_stage: "proposal_drafting" }], error: null },
    );
    changeStage.mockResolvedValue({ error: null });

    const res = await markProposalSent("t1");

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("NOT changed");
  });

  it("surfaces a failed stage write", async () => {
    queue({ data: [{ internal_stage: "proposal_drafting" }], error: null });
    changeStage.mockResolvedValue({ error: "update blocked by RLS" });

    const res = await markProposalSent("t1");

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("update blocked by RLS");
  });
});

// ── Pure helpers ────────────────────────────────────────────────────

describe("helpers", () => {
  it("mapInternalStageToProposalState mirrors the established mapping", () => {
    expect(mapInternalStageToProposalState("proposal_sent")).toBe("sent");
    expect(mapInternalStageToProposalState("negotiation")).toBe("negotiation_active");
    expect(mapInternalStageToProposalState("commercial_approval")).toBe("commercial_approved");
    expect(mapInternalStageToProposalState("proposal_drafting")).toBe("draft");
    expect(mapInternalStageToProposalState(null)).toBe("ready_for_crm");
  });

  it("listUnstoredQuoteFields only reports values that actually carry information", () => {
    expect(listUnstoredQuoteFields({})).toEqual([]);
    expect(listUnstoredQuoteFields({ notes: "", validity_days: 0 })).toEqual([]);
    expect(listUnstoredQuoteFields({ notes: "check rates", service_type: "transport" }))
      .toEqual(["service_type", "notes"]);
  });
});
