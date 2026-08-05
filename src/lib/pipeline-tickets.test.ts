/**
 * pipeline-tickets.test.ts — SC-01 Wave 04 / T07-A (core and customer lane).
 *
 * Covers the three-state honesty contract shared by /crm-pipeline, /customers,
 * /customers/{tenders,proposals} and /workspaces/{tenders,proposals}:
 *
 *   - a FAILED read must never be reported as an EMPTY read
 *   - a headline counter must never describe more records than are rendered
 *   - derivation must not invent a customer, an owner, a value or a risk level
 *
 * It also pins, by execution, the client-side process-isolation allowlist that
 * currently decides which tender rows reach a tender surface. That module is
 * outside this lane's write allowlist; this test exists so the behaviour is
 * recorded as observed fact rather than as a reading of the source.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase mock ───────────────────────────────────────────────────
// readOperationalTicketsWithIsolation() reads commercial_tickets directly, so
// this file now asserts WHAT REACHES THE DATABASE as well as what comes back.
// The mock honours the `select` projection exactly as PostgREST does: a column
// the query never asked for is not returned.

type MockResult = { data: unknown; error: { message: string } | null };

const resultQueue: MockResult[] = [];
const calls: Array<[string, ...unknown[]]> = [];

function queue(...results: MockResult[]) {
  resultQueue.push(...results);
}

function nextResult(): MockResult {
  return resultQueue.shift() ?? {
    data: null,
    error: { message: "test error: supabase mock queue was empty" },
  };
}

function applyProjection(projection: string | null, data: unknown): unknown {
  if (!projection || projection === "*" || !Array.isArray(data)) return data;
  const wanted = projection.split(",").map(c => c.trim()).filter(Boolean);
  return data.map(row => {
    if (row === null || typeof row !== "object") return row;
    const picked: Record<string, any> = {};
    for (const column of wanted) {
      if (column in (row as Record<string, any>)) picked[column] = (row as Record<string, any>)[column];
    }
    return picked;
  });
}

function makeBuilder(): any {
  const builder: any = {};
  let projection: string | null = null;

  for (const method of ["eq", "neq", "order", "limit", "in"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    });
  }
  builder.select = vi.fn((cols?: string) => {
    calls.push(["select", cols]);
    if (typeof cols === "string") projection = cols;
    return builder;
  });

  const resolve = () => {
    const result = nextResult();
    return { ...result, data: applyProjection(projection, result.data) };
  };

  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  calls.push(["from", table]);
  return makeBuilder();
});

vi.mock("./supabase", () => ({
  supabase: { from: (...args: unknown[]) => (fromSpy as any)(...args) },
}));

import {
  resolveReadState,
  describeRenderedCount,
  describeIsolationWithholding,
  describeEmptyReadCause,
  deriveCommercialTicketPipelineTickets,
  readOperationalTicketsWithIsolation,
  sumCaptured,
  averageCaptured,
  daysSince,
  normStage,
  CRM_PIPELINE_COLUMNS,
  CRM_TERMINAL,
} from "./pipeline-tickets";
import { filterAllowedTenderTickets, ALLOWED_TENDER_IDS } from "./process-isolation";
import type { CommercialTicket } from "./unified-ticket-types";

beforeEach(() => {
  resultQueue.length = 0;
  calls.length = 0;
  fromSpy.mockClear();
});

// ── Fixtures ────────────────────────────────────────────────────────
// Shaped exactly like a commercial_tickets row. Nothing here is a business
// record: ids are synthetic except where a live id is the point of the test.

function ticket(overrides: Partial<CommercialTicket> = {}): CommercialTicket {
  return {
    id: "t-1",
    ticket_type: "proposal",
    ticket_title: null,
    customer_name: null,
    customer_id: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    company: null,
    owner: null,
    team_members: [],
    region: null,
    industry: null,
    crm_pipeline_stage: null,
    internal_stage: null,
    estimated_value: null,
    target_gp_percent: null,
    probability_percent: null,
    target_date: null,
    notes: null,
    type_details: {},
    source_type: null,
    source_reference: null,
    source_file: null,
    source_sheet: null,
    source_row_id: null,
    source_document_id: null,
    lineage_status: "unverified",
    lineage_notes: null,
    verified_by: null,
    verified_at: null,
    quarantined_reason: null,
    created_from_intake: false,
    legacy_workspace_id: null,
    legacy_opportunity_id: null,
    legacy_tender_id: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── resolveReadState ────────────────────────────────────────────────

describe("resolveReadState — a failed read is not an empty result", () => {
  it("reports loading before anything else", () => {
    expect(resolveReadState({ loading: true, error: "boom", count: 0 })).toBe("loading");
    expect(resolveReadState({ loading: true, error: null, count: 5 })).toBe("loading");
  });

  it("reports error, NOT empty, when a read failed and returned no rows", () => {
    // This is the whole point of the helper. If this ever returns "empty" the
    // pages will paint "no records" over a failure again.
    expect(resolveReadState({ loading: false, error: "permission denied", count: 0 })).toBe("error");
  });

  it("reports error even if a stale row set is still in state", () => {
    expect(resolveReadState({ loading: false, error: "network down", count: 3 })).toBe("error");
  });

  it("reports empty only when the read succeeded and returned nothing", () => {
    expect(resolveReadState({ loading: false, error: null, count: 0 })).toBe("empty");
    expect(resolveReadState({ loading: false, error: undefined, count: 0 })).toBe("empty");
  });

  it("reports ready when the read succeeded with rows", () => {
    expect(resolveReadState({ loading: false, error: null, count: 1 })).toBe("ready");
  });

  it("treats an empty-string error as no error (falsy), not as a failure", () => {
    expect(resolveReadState({ loading: false, error: "", count: 0 })).toBe("empty");
  });
});

// ── describeRenderedCount ───────────────────────────────────────────

describe("describeRenderedCount — a counter equals the set it renders", () => {
  it("states the plain count when nothing is filtered out", () => {
    expect(describeRenderedCount(6, 6, "ticket")).toBe("6 tickets");
    expect(describeRenderedCount(1, 1, "tender")).toBe("1 tender");
    expect(describeRenderedCount(0, 0, "customer")).toBe("0 customers");
  });

  it("never claims more records than are rendered", () => {
    // "12 open tenders" above a list of 6 is the defect this prevents.
    expect(describeRenderedCount(6, 12, "tender")).toBe("6 tenders (filtered from 12)");
    expect(describeRenderedCount(1, 4, "proposal")).toBe("1 proposal (filtered from 4)");
    expect(describeRenderedCount(0, 6, "ticket")).toBe("0 tickets (filtered from 6)");
  });
});

// ── deriveCommercialTicketPipelineTickets ───────────────────────────

describe("deriveCommercialTicketPipelineTickets — no invented facts", () => {
  it("drops inactive rows and non proposal/tender rows", () => {
    const rows = [
      ticket({ id: "keep-1", ticket_type: "proposal" }),
      ticket({ id: "keep-2", ticket_type: "tender" }),
      ticket({ id: "drop-inactive", active: false }),
      ticket({ id: "drop-renewal", ticket_type: "renewal" }),
      ticket({ id: "drop-sla", ticket_type: "sla" }),
    ];
    expect(deriveCommercialTicketPipelineTickets(rows).map(t => t.id)).toEqual(["keep-1", "keep-2"]);
  });

  it("preserves the row id so navigation can carry identity", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([
      ticket({ id: "089447d6-6d4f-4921-9df3-92483f36233a" }),
    ]);
    expect(derived.id).toBe("089447d6-6d4f-4921-9df3-92483f36233a");
  });

  it("labels missing identity as 'Not captured' rather than inventing one", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([
      ticket({ customer_name: null, ticket_title: null, owner: null, region: null }),
    ]);
    expect(derived.customerName).toBe("Not captured");
    expect(derived.opportunityName).toBe("Not captured");
    expect(derived.owner).toBe("");
    expect(derived.ownerInitials).toBe("??");
    expect(derived.region).toBe("");
  });

  it("does not invent a risk label or a zero when GP% was never captured", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([ticket({ target_gp_percent: null })]);
    // W04-C1 defect C: null means never captured. It used to be coerced to 0,
    // which rendered a red "0%" and a "Critical" margin verdict.
    expect(derived.gpPct).toBeNull();
    expect(derived.riskLevel).toBe("unknown");
    expect(derived.riskLabel).toBe("GP not captured");
  });

  it("reports a real low GP as a real risk", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([ticket({ target_gp_percent: 4 })]);
    expect(derived.riskLevel).toBe("red");
    expect(derived.riskLabel).toBe("Critical");
  });

  it("normalises the live crm_pipeline_stage spellings onto real columns", () => {
    // Values observed live in commercial_tickets: "qualified", "proposal_sent",
    // "Proposal Sent", and null.
    expect(normStage("qualified")).toBe("Qualified");
    expect(normStage("proposal_sent")).toBe("Proposal Sent");
    expect(normStage("Proposal Sent")).toBe("Proposal Sent");
    const [derived] = deriveCommercialTicketPipelineTickets([ticket({ crm_pipeline_stage: null })]);
    expect(derived.crmStage).toBe("Prospecting");
  });
});

// ── W04-C1 defect C: nulls are not measured zeros ───────────────────

describe("deriveCommercialTicketPipelineTickets — NULL policy", () => {
  it("keeps a never-captured value, GP% and probability as null", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([
      ticket({ estimated_value: null, target_gp_percent: null, probability_percent: null }),
    ]);
    // These three used to be coerced to 0, which rendered "SAR 0", a red "0%"
    // probability gauge and a "Critical" margin verdict for figures nobody ever
    // captured. Two live tenders have all three null.
    expect(derived.sarValue).toBeNull();
    expect(derived.gpPct).toBeNull();
    expect(derived.probabilityPct).toBeNull();
    expect(derived.riskLevel).toBe("unknown");
  });

  it("reports a STORED zero as a real zero, so 0 still means 0", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([
      ticket({ estimated_value: 0, target_gp_percent: 0, probability_percent: 0 }),
    ]);
    expect(derived.sarValue).toBe(0);
    expect(derived.gpPct).toBe(0);
    expect(derived.probabilityPct).toBe(0);
    // A stored 0% GP IS critical — the verdict is real here, unlike for a null.
    expect(derived.riskLevel).toBe("red");
    expect(derived.riskLabel).toBe("Critical");
  });

  it("never lets an uncaptured GP% drive a red or Critical verdict", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([ticket({ target_gp_percent: null })]);
    expect(derived.riskLevel).not.toBe("red");
    expect(derived.riskLabel).not.toBe("Critical");
  });
});

describe("sumCaptured / averageCaptured — absent values are excluded, not zeroed", () => {
  it("sums only the captured values", () => {
    expect(sumCaptured([100, null, 200, undefined])).toBe(300);
    expect(sumCaptured([null, null])).toBe(0);
  });

  it("averages only the captured values and returns null when none were", () => {
    // 20, not 10: a null must not halve the apparent margin.
    expect(averageCaptured([20, null])).toBe(20);
    expect(averageCaptured([null, undefined])).toBeNull();
    expect(averageCaptured([0, 10])).toBe(5);
  });
});

// ── W04-C1 defect D: no literal NaN on screen ───────────────────────

describe("daysSince / daysInStage — an unparseable date is null, never NaN", () => {
  it("returns null for an absent or unparseable date", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince("")).toBeNull();
    expect(daysSince("not-a-date")).toBeNull();
    expect(daysSince("2026-13-45T99:99:99Z")).toBeNull();
  });

  it("returns a real whole-day count for a parseable date", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(daysSince(tenDaysAgo)).toBe(10);
  });

  it("gives daysInStage null rather than NaN when created_at cannot be parsed", () => {
    const [bad] = deriveCommercialTicketPipelineTickets([ticket({ created_at: "not-a-date" })]);
    expect(bad.daysInStage).toBeNull();
    expect(Number.isNaN(bad.daysInStage as number)).toBe(false);
    // `${null}d` would print "nulld"; every render site must branch on null.
    expect(String(bad.daysInStage)).not.toContain("NaN");

    const [absent] = deriveCommercialTicketPipelineTickets([ticket({ created_at: undefined })]);
    expect(absent.daysInStage).toBeNull();
  });
});

// ── W04-C1 defect E: the empty-state claim must be true ─────────────

describe("describeIsolationWithholding / describeEmptyReadCause", () => {
  it("says nothing was withheld when nothing was", () => {
    expect(describeIsolationWithholding(4, 4)).toBeNull();
    expect(describeIsolationWithholding(0, 0)).toBeNull();
  });

  it("states the true cause when the filter removed every returned row", () => {
    // The live tender case: 4 rows read, 3 dropped, 1 rendered — and when the
    // one allowlisted id is absent, 4 read and 0 rendered.
    const copy = describeEmptyReadCause(4, 0);
    expect(copy).toContain("returned 4 rows");
    expect(copy).toContain("withheld all 4");
    expect(copy).not.toContain("returned no rows");
  });

  it("states how many were withheld on a partial filter", () => {
    expect(describeIsolationWithholding(4, 1)).toBe(
      "The read succeeded and returned 4 rows; the process-isolation filter in this build withheld 3."
    );
  });

  it("only says 'returned no rows' when the database really returned none", () => {
    expect(describeEmptyReadCause(0, 0)).toBe("The read succeeded and returned no rows.");
  });
});

describe("readOperationalTicketsWithIsolation — what reaches the database", () => {
  it("queries commercial_tickets with the filters the pipeline surfaces rely on", async () => {
    queue({ data: [], error: null });
    await readOperationalTicketsWithIsolation();

    expect(calls[0]).toEqual(["from", "commercial_tickets"]);
    expect(calls).toContainEqual(["select", "*"]);
    expect(calls).toContainEqual(["eq", "active", true]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    // No ticket_type predicate when the caller did not ask for one.
    expect(calls.filter(c => c[0] === "eq" && c[1] === "ticket_type")).toHaveLength(0);
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });

  it("adds the ticket_type predicate at the database when a type is given", async () => {
    queue({ data: [], error: null });
    await readOperationalTicketsWithIsolation("proposal");
    expect(calls).toContainEqual(["eq", "ticket_type", "proposal"]);
    expect(calls).toContainEqual(["eq", "active", true]);
  });

  it("reports the pre-filter count so a surface can disclose what was withheld", async () => {
    // 4 tender rows returned; the allowlist admits exactly one id.
    queue({
      data: [
        ticket({ id: ALLOWED_TENDER_IDS[0], ticket_type: "tender", ticket_title: "Linde SIGAS Bulk Transportation Tender" }),
        ticket({ id: "a1200000-0000-4000-8000-000000000002", ticket_type: "tender" }),
        ticket({ id: "a1200000-0000-4000-8000-000000000001", ticket_type: "tender" }),
        ticket({ id: "a1100000-0000-4000-8000-000000000030", ticket_type: "tender" }),
      ],
      error: null,
    });
    const read = await readOperationalTicketsWithIsolation();
    expect(read.fetched).toBe(4);
    expect(read.rows.map(r => r.id)).toEqual([ALLOWED_TENDER_IDS[0]]);
    expect(read.withheld).toBe(3);
    expect(read.error).toBeNull();
    // The exact claim a surface may now make.
    expect(describeIsolationWithholding(read.fetched, read.rows.length))
      .toContain("withheld 3");
  });

  it("reports fetched 0 and an error message on a failed read, never a silent empty", async () => {
    queue({ data: null, error: { message: "permission denied for table commercial_tickets" } });
    const read = await readOperationalTicketsWithIsolation();
    expect(read.error).toBe("permission denied for table commercial_tickets");
    expect(read.rows).toEqual([]);
    expect(read.fetched).toBe(0);
    // resolveReadState must call this "error", not "empty".
    expect(resolveReadState({ loading: false, error: read.error, count: read.rows.length })).toBe("error");
  });

  it("reports fetched 0 and withheld 0 on a genuinely empty read", async () => {
    queue({ data: [], error: null });
    const read = await readOperationalTicketsWithIsolation();
    expect(read).toEqual({ rows: [], fetched: 0, withheld: 0, error: null });
    expect(describeEmptyReadCause(read.fetched, read.rows.length))
      .toBe("The read succeeded and returned no rows.");
  });
});

// ── W04-C1 defect F: no stage lock ──────────────────────────────────

describe("CRM stage columns — terminal stages are columns, not locks", () => {
  it("renders Closed Won and Actual Go Live as real board columns", () => {
    expect(CRM_PIPELINE_COLUMNS).toContain("Closed Won");
    expect(CRM_PIPELINE_COLUMNS).toContain("Actual Go Live");
  });

  it("pins the exact stage labels a card can carry, so no lookup can miss", () => {
    // The drag bug was a label mismatch: code tested for "Go Live" while the
    // real label is "Actual Go Live", so those cards were grabbable but no
    // column accepted them and the drag failed with no message.
    expect(normStage("go live")).toBe("Actual Go Live");
    expect(normStage("actual_go_live")).toBe("Actual Go Live");
    expect(normStage("Actual Go Live")).toBe("Actual Go Live");
    expect(CRM_PIPELINE_COLUMNS).not.toContain("Go Live" as never);
  });

  it("keeps every terminal stage that is also a column reachable as a drag source", () => {
    // CRM_TERMINAL is advisory. Any terminal stage that is ALSO rendered as a
    // column must be a legal source, or a card lands somewhere it cannot leave.
    const terminalColumns = CRM_TERMINAL.filter(s => CRM_PIPELINE_COLUMNS.includes(s));
    expect(terminalColumns).toEqual(["Closed Won", "Actual Go Live"]);
    for (const source of terminalColumns) {
      const targets = CRM_PIPELINE_COLUMNS.filter(t => t !== source);
      expect(targets.length).toBeGreaterThan(0);
    }
  });
});

// ── Observed behaviour of the tender process-isolation allowlist ────

describe("process-isolation tender allowlist (observed, not owned by this lane)", () => {
  it("admits only the hardcoded tender id, dropping other real tender rows", () => {
    const rows = [
      ticket({ id: ALLOWED_TENDER_IDS[0], ticket_type: "tender", ticket_title: "Linde SIGAS Bulk Transportation Tender" }),
      ticket({ id: "a1200000-0000-4000-8000-000000000002", ticket_type: "tender", ticket_title: "Fifteen Stage Tender Test" }),
      ticket({ id: "a1200000-0000-4000-8000-000000000001", ticket_type: "tender", ticket_title: "Tender Aggregate Test" }),
      ticket({ id: "a1100000-0000-4000-8000-000000000030", ticket_type: "tender", ticket_title: "National Distribution Tender" }),
    ];
    const allowed = filterAllowedTenderTickets(rows);
    expect(allowed.map(r => r.id)).toEqual([ALLOWED_TENDER_IDS[0]]);
    // 4 tender rows in, 1 out: every tender surface in this lane renders a
    // strict subset of the tender rows the database returns.
    expect(rows.length).toBe(4);
  });
});
