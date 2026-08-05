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

/** Payloads actually handed to .insert() / .update(), in call order. */
const writtenRows: Array<{ op: "insert" | "update"; row: Record<string, any> }> = [];

function makeBuilder(): any {
  const builder: any = {};
  for (const method of ["select", "delete", "eq", "neq", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  for (const op of ["insert", "update"] as const) {
    builder[op] = vi.fn((row: Record<string, any>) => {
      writtenRows.push({ op, row });
      return builder;
    });
  }
  builder.single = vi.fn(() => Promise.resolve(nextResult()));
  builder.maybeSingle = vi.fn(() => Promise.resolve(nextResult()));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(nextResult()).then(onFulfilled, onRejected);
  return builder;
}

/** The single row sent to the last insert/update of the given kind. */
function lastWrite(op: "insert" | "update"): Record<string, any> {
  const match = [...writtenRows].reverse().find((w) => w.op === op);
  if (!match) throw new Error(`no ${op} was issued`);
  return match.row;
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
  createQuoteVersion,
  listProposalsByWorkspace,
  markProposalSent,
  listUnstoredQuoteFields,
  mapInternalStageToProposalState,
  generateQuoteNumber,
  calculateValidUntil,
} from "./commercial-runtime";

const QUOTE_ROW = {
  id: "q1",
  workspace_id: "ws1",
  customer_id: "cust-1",
  quote_number: "Q-WS1-V2",
  version: 2,
  version_number: 2,
  state: "submitted",
  status: "submitted",
  service_type: "warehousing",
  currency: "SAR",
  volume_unit: "pallets",
  monthly_volume: 500,
  created_at: "2026-01-01T00:00:00Z",
  storage_rate: "12.5",
  inbound_rate: 3,
  outbound_rate: 4,
  pallet_volume: 100,
  monthly_revenue: 1000,
  annual_revenue: 12000,
  total_cost: 9000,
  estimated_cost: 9000,
  discount_percent: 5,
  validity_days: 45,
  valid_until: "2026-02-15",
  assumptions: "5-day working week",
  exclusions: "Hazmat",
  notes: "check rates",
  change_reason: null,
  supersedes_quote_id: null,
  created_by: "u1",
  gp_percent: 25,
  gp_amount: 3000,
};

/** The wizard's real save payload shape. */
const WIZARD_PAYLOAD = {
  service_type: "transport",
  volume_unit: "trips",
  pallet_volume: 100,
  monthly_volume: 500,
  storage_rate: 12.5,
  inbound_rate: 3,
  outbound_rate: 4,
  estimated_cost: 9000,
  discount_percent: 5,
  validity_days: 45,
  assumptions: "5-day working week",
  exclusions: "Hazmat handling",
  notes: "check rates",
  currency: "SAR",
  monthly_revenue: 1000,
  annual_revenue: 12000,
  gp_amount: 3000,
  gp_percent: 25,
  customer_id: "cust-1",
};

beforeEach(() => {
  resultQueue.length = 0;
  writtenRows.length = 0;
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
    // the widened Sprint-3 columns round-trip
    expect(quote.quote_number).toBe("Q-WS1-V2");
    expect(quote.service_type).toBe("warehousing");
    expect(quote.currency).toBe("SAR");
    expect(quote.validity_days).toBe(45);
    expect(quote.assumptions).toBe("5-day working week");
    expect(quote.discount_percent).toBe(5);
    expect(fromSpy).toHaveBeenCalledWith("quotes");
  });

  it("falls back to the mirror column when the Sprint-3 side is empty", async () => {
    queue({
      data: [{ ...QUOTE_ROW, status: null, version_number: null, estimated_cost: null }],
      error: null,
    });

    const res = await listQuotesByWorkspace("ws1");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data[0].status).toBe("submitted"); // from `state`
    expect(res.data[0].version_number).toBe(2); // from `version`
    expect(res.data[0].estimated_cost).toBe(9000); // from `total_cost`
  });

  it("reports a genuinely empty column as unknown rather than a default", async () => {
    queue({
      data: [{ ...QUOTE_ROW, currency: null, validity_days: null, quote_number: null }],
      error: null,
    });

    const res = await listQuotesByWorkspace("ws1");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data[0].currency).toBeNull();
    expect(res.data[0].validity_days).toBeNull();
    expect(res.data[0].quote_number).toBeNull();
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
  it("sends the full widened column set, including both sides of every mirror pair", async () => {
    queue(
      { data: [{ version_number: 2 }], error: null }, // highest existing version
      { data: [{ ...QUOTE_ROW, id: "q2", version: 3, version_number: 3, state: "draft", status: "draft" }], error: null },
    );

    const res = await createQuote("ws1", WIZARD_PAYLOAD);

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = lastWrite("insert");
    // every wizard field is actually persisted — nothing is dropped
    expect(row.service_type).toBe("transport");
    expect(row.volume_unit).toBe("trips");
    expect(row.monthly_volume).toBe(500);
    expect(row.discount_percent).toBe(5);
    expect(row.validity_days).toBe(45);
    expect(row.assumptions).toBe("5-day working week");
    expect(row.exclusions).toBe("Hazmat handling");
    expect(row.notes).toBe("check rates");
    expect(row.currency).toBe("SAR");
    expect(row.customer_id).toBe("cust-1");
    expect(row.storage_rate).toBe(12.5);
    // mirror pairs — both sides written so every reader of the table agrees
    expect(row.version).toBe(3);
    expect(row.version_number).toBe(3);
    expect(row.state).toBe("draft");
    expect(row.status).toBe("draft");
    expect(row.estimated_cost).toBe(9000);
    expect(row.total_cost).toBe(9000);
    // derived columns
    expect(row.quote_number).toBe("Q-WS1-V3");
    expect(row.valid_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // insert path does not stamp updated_*; creation is recorded by created_*
    expect(row).not.toHaveProperty("updated_at");
    expect(row).not.toHaveProperty("updated_by");

    expect(res.data.unstoredFields).toEqual([]);
  });

  it("still reports a field that genuinely has no column", async () => {
    queue(
      { data: [{ version_number: 0 }], error: null },
      { data: [{ ...QUOTE_ROW, id: "q2" }], error: null },
    );

    const res = await createQuote("ws1", {
      ...WIZARD_PAYLOAD,
      sla_penalty_clause: "2% per late delivery",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.unstoredFields).toEqual(["sla_penalty_clause"]);
    expect(lastWrite("insert")).not.toHaveProperty("sla_penalty_clause");
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
  it("sends the full widened column set on an edit", async () => {
    queue({ data: [QUOTE_ROW], error: null });

    const res = await updateQuote("q1", WIZARD_PAYLOAD);

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = lastWrite("update");
    expect(row.service_type).toBe("transport");
    expect(row.volume_unit).toBe("trips");
    expect(row.monthly_volume).toBe(500);
    expect(row.discount_percent).toBe(5);
    expect(row.validity_days).toBe(45);
    expect(row.valid_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.assumptions).toBe("5-day working week");
    expect(row.exclusions).toBe("Hazmat handling");
    expect(row.notes).toBe("check rates");
    expect(row.currency).toBe("SAR");
    // estimated_cost mirrors into total_cost
    expect(row.estimated_cost).toBe(9000);
    expect(row.total_cost).toBe(9000);
    expect(res.data.unstoredFields).toEqual([]);
  });

  it("still reports a field that genuinely has no column", async () => {
    queue({ data: [QUOTE_ROW], error: null });

    const res = await updateQuote("q1", { storage_rate: 5, payment_terms_days: 60 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.unstoredFields).toEqual(["payment_terms_days"]);
    expect(lastWrite("update")).not.toHaveProperty("payment_terms_days");
  });

  it("refuses when nothing supplied maps to an established column", async () => {
    const res = await updateQuote("q1", { payment_terms_days: 60 });

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
  it("stores the reason in change_reason in the same confirmed write", async () => {
    queue({ data: [{ ...QUOTE_ROW, state: "rejected", status: "rejected", change_reason: "Margin too thin" }], error: null });

    const res = await rejectQuote("q1", "Margin too thin");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = lastWrite("update");
    expect(row.state).toBe("rejected");
    expect(row.status).toBe("rejected");
    expect(row.change_reason).toBe("Margin too thin");
    expect(res.data.quote.change_reason).toBe("Margin too thin");
    expect(res.data.warnings).toEqual([]);
  });

  it("does NOT report success when the reject write matched no row", async () => {
    queue({ data: [], error: null });

    const res = await rejectQuote("q1", "Margin too thin");

    expect(res.ok).toBe(false);
  });

  it("requires a reason and writes nothing without one", async () => {
    const res = await rejectQuote("q1", "   ");
    expect(res.ok).toBe(false);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe("createQuoteVersion", () => {
  it("copies the whole quote, links it back and stores the change reason", async () => {
    queue(
      { data: [QUOTE_ROW], error: null }, // source read
      { data: [{ version_number: 2 }], error: null }, // highest version
      { data: [{ ...QUOTE_ROW, id: "q9", version: 3, version_number: 3, state: "draft", status: "draft" }], error: null }, // insert
      { data: [{ ...QUOTE_ROW, state: "superseded", status: "superseded" }], error: null }, // supersede
    );

    const res = await createQuoteVersion("q1", "Client renegotiated rates");

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const inserted = writtenRows.find((w) => w.op === "insert")!.row;
    expect(inserted.supersedes_quote_id).toBe("q1");
    expect(inserted.change_reason).toBe("Client renegotiated rates");
    expect(inserted.quote_number).toBe("Q-WS1-V3");
    expect(inserted.service_type).toBe("warehousing");
    expect(inserted.assumptions).toBe("5-day working week");
    expect(inserted.validity_days).toBe(45);
    expect(inserted.status).toBe("draft");
    expect(inserted.state).toBe("draft");
    // the source row is marked superseded on both mirror columns
    expect(lastWrite("update")).toMatchObject({ state: "superseded", status: "superseded" });
    expect(res.data.unstoredFields).toEqual([]);
  });

  it("keeps the created version but warns when the supersede did not take", async () => {
    queue(
      { data: [QUOTE_ROW], error: null },
      { data: [{ version_number: 2 }], error: null },
      { data: [{ ...QUOTE_ROW, id: "q9", version_number: 3 }], error: null },
      { data: [], error: null }, // supersede matched no row
    );

    const res = await createQuoteVersion("q1", "Client renegotiated rates");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.warnings.join(" ")).toContain("NOT marked superseded");
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

  it("listUnstoredQuoteFields reports nothing for the wizard payload now the columns exist", () => {
    expect(listUnstoredQuoteFields({})).toEqual([]);
    expect(listUnstoredQuoteFields(WIZARD_PAYLOAD)).toEqual([]);
  });

  it("listUnstoredQuoteFields still catches a key with no column", () => {
    expect(listUnstoredQuoteFields({ notes: "check rates", rebate_tier: "gold" }))
      .toEqual(["rebate_tier"]);
    // an empty/zero unknown value lost no information, so it is not reported
    expect(listUnstoredQuoteFields({ rebate_tier: "" })).toEqual([]);
  });

  it("generateQuoteNumber matches the format already in the table", () => {
    expect(generateQuoteNumber("ws1", 3)).toBe("Q-WS1-V3");
    expect(generateQuoteNumber("a1b2-c3d4-e5f6", 12)).toBe("Q-A1B2C3-V12");
  });

  it("calculateValidUntil returns a date-only string in the future", () => {
    const result = calculateValidUntil(30);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now());
  });
});
