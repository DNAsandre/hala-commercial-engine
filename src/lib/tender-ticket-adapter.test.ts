/**
 * tender-ticket-adapter.test.ts — SC-01 Wave 04 / T07-A.
 *
 * Asserts WHAT REACHES THE DATABASE for /workspaces/tenders and
 * /customers/tenders, not merely what the function returns, and pins the
 * failure contract the two tender pages now depend on:
 *
 *   fetchTenderPortfolioRows() REJECTS on a read error.
 *   It must never resolve to [] — an empty array is how those pages say
 *   "no tender records are visible", which is a different fact.
 *
 * The supabase mock honours the `select` projection exactly as PostgREST does:
 * a column the query never asked for is not returned.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type MockResult = { data: unknown; error: { message: string } | null };

const resultQueue: MockResult[] = [];
/** Every builder call, in order: ["from", "commercial_tickets"], ["eq", ...] … */
const calls: Array<[string, ...unknown[]]> = [];
const selectProjections: string[] = [];

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

/** PostgREST-faithful projection: only the asked-for columns come back. */
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

  for (const method of ["eq", "neq", "order", "limit", "in", "gte", "lte"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    });
  }
  builder.select = vi.fn((cols?: string) => {
    calls.push(["select", cols]);
    if (typeof cols === "string") {
      selectProjections.push(cols);
      projection = cols;
    }
    return builder;
  });

  const resolve = () => {
    const result = nextResult();
    return { ...result, data: applyProjection(projection, result.data) };
  };

  builder.single = vi.fn(() => Promise.resolve(resolve()));
  builder.maybeSingle = vi.fn(() => Promise.resolve(resolve()));
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
  fetchArchivedTenderPortfolioRead,
  fetchTenderPortfolioRead,
  fetchTenderPortfolioRows,
  mapCommercialTicketToTenderPortfolioRow,
} from "./tender-ticket-adapter";
import { ALLOWED_TENDER_IDS } from "./process-isolation";
import type { CommercialTicket } from "./unified-ticket-types";

/** The one tender id the client-side process isolation currently admits. */
const LINDE_ID = ALLOWED_TENDER_IDS[0];

function tenderRow(overrides: Partial<CommercialTicket> = {}): CommercialTicket {
  return {
    id: LINDE_ID,
    ticket_type: "tender",
    ticket_title: "Linde SIGAS Bulk Transportation Tender",
    customer_name: "Linde SIGAS",
    customer_id: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    company: null,
    owner: "Sara Al Otaibi",
    team_members: [],
    region: "Central",
    industry: null,
    crm_pipeline_stage: "proposal_sent",
    internal_stage: "proposal_preparation",
    estimated_value: 4200000,
    target_gp_percent: 18,
    probability_percent: 60,
    target_date: "2026-09-30",
    notes: null,
    type_details: { submission_deadline: "2026-09-15" },
    source_type: "manual_verified",
    source_reference: null,
    source_file: null,
    source_sheet: null,
    source_row_id: null,
    source_document_id: null,
    lineage_status: "verified",
    lineage_notes: null,
    verified_by: null,
    verified_at: null,
    quarantined_reason: null,
    created_from_intake: false,
    legacy_workspace_id: null,
    legacy_opportunity_id: null,
    legacy_tender_id: null,
    active: true,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  resultQueue.length = 0;
  calls.length = 0;
  selectProjections.length = 0;
  fromSpy.mockClear();
});

describe("fetchTenderPortfolioRows — what reaches the database", () => {
  it("queries commercial_tickets with the exact filters the tender surfaces rely on", async () => {
    queue({ data: [tenderRow()], error: null });
    await fetchTenderPortfolioRows();

    expect(calls[0]).toEqual(["from", "commercial_tickets"]);
    expect(calls).toContainEqual(["select", "*"]);
    expect(calls).toContainEqual(["eq", "ticket_type", "tender"]);
    expect(calls).toContainEqual(["eq", "active", true]);
    // Rejected lineage must be excluded at the database, not in the UI.
    expect(calls).toContainEqual(["neq", "lineage_status", "rejected"]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    // Exactly one table read per call — no hidden second source.
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });

  it("REJECTS on a read error instead of resolving to an empty list", async () => {
    queue({ data: null, error: { message: "permission denied for table commercial_tickets" } });
    await expect(fetchTenderPortfolioRows()).rejects.toMatchObject({
      message: "permission denied for table commercial_tickets",
    });
  });

  it("resolves to an empty list only when the read genuinely returned no rows", async () => {
    queue({ data: [], error: null });
    await expect(fetchTenderPortfolioRows()).resolves.toEqual([]);
  });

  it("resolves to an empty list when the only returned rows are legacy seed ids", async () => {
    // Wave 05 Option B: only the exact legacy seed ids are dropped client-side.
    // A clean-created row (created_from_intake=true) always survives.
    queue({ data: [tenderRow({ id: "a1100000-0000-4000-8000-000000000030" })], error: null });
    await expect(fetchTenderPortfolioRows()).resolves.toEqual([]);
  });

  it("keeps a clean-created tender in the portfolio read", async () => {
    queue({
      data: [tenderRow({ id: "b7e2c9d4-1234-4abc-9def-000000000001", created_from_intake: true })],
      error: null,
    });
    const rows = await fetchTenderPortfolioRows();
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["b7e2c9d4-1234-4abc-9def-000000000001"]);
  });

  it("maps a returned row onto the portfolio shape without inventing values", async () => {
    queue({ data: [tenderRow()], error: null });
    const [row] = await fetchTenderPortfolioRows();
    expect(row.id).toBe(LINDE_ID);
    expect(row.customer_name).toBe("Linde SIGAS");
    expect(row.estimated_value).toBe(4200000);
    // type_details.submission_deadline wins over target_date when present.
    expect(row.submission_deadline).toBe("2026-09-15");
  });
});

describe("fetchArchivedTenderPortfolioRead — reversible archive view", () => {
  it("queries the same canonical Tender source with active=false", async () => {
    queue({ data: [tenderRow({ active: false })], error: null });
    const read = await fetchArchivedTenderPortfolioRead();
    expect(calls).toContainEqual(["eq", "ticket_type", "tender"]);
    expect(calls).toContainEqual(["eq", "active", false]);
    expect(read.rows.map(row => row.id)).toEqual([LINDE_ID]);
  });
});

// ── W04-C1 defect E: the tender pages must be able to tell the truth ──

describe("fetchTenderPortfolioRead — pre-filter and post-filter counts", () => {
  it("reports how many rows the database returned and how many this client dropped", async () => {
    // The live shape: 4 tender rows readable, the allowlist admits exactly one.
    queue({
      data: [
        tenderRow(),
        tenderRow({ id: "a1200000-0000-4000-8000-000000000002", ticket_title: "Fifteen Stage Tender Test", customer_name: "UAT" }),
        tenderRow({ id: "a1200000-0000-4000-8000-000000000001", ticket_title: "Tender Aggregate Test", customer_name: "UAT" }),
        tenderRow({ id: "a1100000-0000-4000-8000-000000000030", ticket_title: "National Distribution Tender", customer_name: "UAT" }),
      ],
      error: null,
    });

    const read = await fetchTenderPortfolioRead();
    expect(read.fetched).toBe(4);
    expect(read.rows.map(r => r.id)).toEqual([LINDE_ID]);
    expect(read.withheld).toBe(3);
  });

  it("reports fetched 0 / withheld 0 when the database genuinely returned nothing", async () => {
    queue({ data: [], error: null });
    await expect(fetchTenderPortfolioRead()).resolves.toEqual({ rows: [], fetched: 0, withheld: 0 });
  });

  it("reports every returned row as withheld when none survive isolation", async () => {
    queue({ data: [tenderRow({ id: "a1100000-0000-4000-8000-000000000030", customer_name: "UAT", ticket_title: "National Distribution Tender" })], error: null });
    const read = await fetchTenderPortfolioRead();
    // A page seeing rows: [] here must NOT say "the read returned no rows".
    expect(read.rows).toEqual([]);
    expect(read.fetched).toBe(1);
    expect(read.withheld).toBe(1);
  });

  it("REJECTS on a read error rather than reporting fetched 0", async () => {
    queue({ data: null, error: { message: "permission denied for table commercial_tickets" } });
    await expect(fetchTenderPortfolioRead()).rejects.toMatchObject({
      message: "permission denied for table commercial_tickets",
    });
  });

  it("issues exactly one read — fetchTenderPortfolioRows delegates to it", async () => {
    queue({ data: [tenderRow()], error: null });
    await fetchTenderPortfolioRows();
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });
});

describe("mapCommercialTicketToTenderPortfolioRow — nulls stay null", () => {
  it("does not substitute zero or a placeholder for uncaptured commercials", () => {
    const row = mapCommercialTicketToTenderPortfolioRow(
      tenderRow({ estimated_value: null, target_gp_percent: null, probability_percent: null, region: null, owner: null })
    );
    expect(row.estimated_value).toBeNull();
    expect(row.target_gp_percent).toBeNull();
    expect(row.probability_percent).toBeNull();
    expect(row.region).toBeNull();
    expect(row.assigned_owner).toBeNull();
  });

  it("falls back to target_date only when no submission_deadline was captured", () => {
    const row = mapCommercialTicketToTenderPortfolioRow(
      tenderRow({ type_details: {}, target_date: "2026-09-30" })
    );
    expect(row.submission_deadline).toBe("2026-09-30");
  });
});
