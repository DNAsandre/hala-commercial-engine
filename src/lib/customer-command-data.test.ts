/**
 * customer-command-data.test.ts — SC-01 Wave 04 / T07-A.
 *
 * /customers aggregates commercial_tickets by customer name and enriches each
 * row from the `customers` master table. `customers` returns zero rows to an
 * unauthenticated client; whether that is emptiness or RLS is unverified.
 *
 * The defect fixed here: an unmatched customer was assigned paymentRisk
 * "medium", which painted an amber risk chip and docked the health score for a
 * customer about whom nothing at all was known. Absence of a record is not
 * evidence of medium risk.
 */

import { describe, expect, it } from "vitest";
import { deriveCustomerRowsFromTickets } from "./customer-command-data";
import type { PipelineTicket } from "./pipeline-tickets";
import type { Customer } from "./store";

function pipelineTicket(overrides: Partial<PipelineTicket> = {}): PipelineTicket {
  return {
    id: "t-1",
    sourceTable: "commercial_tickets",
    customerName: "Meridian Test Logistics",
    opportunityName: "Warehousing and Transport Proposal",
    ticketType: "proposal",
    lineageStatus: "verified",
    owner: "Sara Al Otaibi",
    ownerInitials: "SA",
    region: "Central",
    sarValue: 1_000_000,
    gpPct: 24,
    riskLevel: "green",
    riskLabel: "Healthy",
    crmStage: "Qualified",
    internalStage: "qualified",
    nextAction: "Send proposal",
    daysInStage: 3,
    syncStatus: "synced",
    volumePallets: 0,
    probabilityPct: 50,
    goLiveDate: "",
    serviceType: "",
    flags: [],
    workspaceId: null,
    quoteStatus: "",
    proposalStatus: "",
    slaStatus: "",
    contractStatus: "",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c-1",
    name: "Meridian Test Logistics",
    paymentStatus: "Good",
    dso: 42,
    contractExpiry: "2027-01-01",
    industry: "Retail",
    region: "Central",
    accountOwner: "Sara Al Otaibi",
    serviceType: "Warehousing",
    ...overrides,
  } as Customer;
}

describe("deriveCustomerRowsFromTickets — payment risk is never guessed", () => {
  it("reports 'unknown' when no customer master record matched", () => {
    const [row] = deriveCustomerRowsFromTickets([pipelineTicket()], []);
    expect(row.hasCustomerRecord).toBe(false);
    expect(row.paymentRisk).toBe("unknown");
    expect(row.contractStatus).toBe("Unknown");
    expect(row.industry).toBe("—");
    // W04-C1 defect B: an unread DSO is null, not 0 days.
    expect(row.dso).toBeNull();
  });

  it("does not dock a computed health score for an unknown payment risk", () => {
    const matchedUnknownPayment = deriveCustomerRowsFromTickets(
      [pipelineTicket()],
      [customer({ paymentStatus: undefined, dso: 10 })]
    )[0];
    const matchedGood = deriveCustomerRowsFromTickets(
      [pipelineTicket()],
      [customer({ paymentStatus: "Good", dso: 10 })]
    )[0];
    // Same tickets, same GP, no risk flags: a blank payment status must not
    // make the customer look worse than one confirmed to pay on time.
    expect(matchedUnknownPayment.paymentRisk).toBe("unknown");
    expect(matchedUnknownPayment.healthScore).toBe(matchedGood.healthScore);
  });

  it("still reports a real 'medium' when the master record says Acceptable", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [pipelineTicket()],
      [customer({ paymentStatus: "Acceptable" })]
    );
    expect(row.paymentRisk).toBe("medium");
    expect(row.hasCustomerRecord).toBe(true);
  });

  it("still reports a real 'high' when the master record says Bad", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [pipelineTicket()],
      [customer({ paymentStatus: "Bad" })]
    );
    expect(row.paymentRisk).toBe("high");
  });

  it("carries the real DSO and contract expiry through when they exist", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [pipelineTicket()],
      [customer({ dso: 97, contractExpiry: "2027-06-30" })]
    );
    expect(row.dso).toBe(97);
    expect(row.contractExpiry).toBe("2027-06-30");
    expect(row.contractStatus).toBe("Active");
  });
});

// ── W04-C1 defect B: no score without its inputs ────────────────────

describe("deriveCustomerRowsFromTickets — the health score is never invented", () => {
  it("cannot be computed when no customers master record was read", () => {
    // This is the live condition: `customers` returns no rows, so payment
    // status and DSO were never read. The score used to start from a hardcoded
    // 50 and render as a coloured bar and "{score}/100" regardless.
    const [row] = deriveCustomerRowsFromTickets([pipelineTicket()], []);
    expect(row.healthScore).toBeNull();
    expect(row.healthScoreUnavailableReason).toContain("no customers master record was read");
  });

  it("cannot be computed when no ticket captured a GP%", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [pipelineTicket({ gpPct: null })],
      [customer()]
    );
    expect(row.avgGpPct).toBeNull();
    expect(row.healthScore).toBeNull();
    expect(row.healthScoreUnavailableReason).toContain("no ticket captured a GP%");
  });

  it("is computed, with a reason of empty string, once every input was read", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [pipelineTicket({ gpPct: 24 })],
      [customer({ paymentStatus: "Good", dso: 30 })]
    );
    expect(typeof row.healthScore).toBe("number");
    expect(row.healthScore).toBeGreaterThan(0);
    expect(row.healthScoreUnavailableReason).toBe("");
  });

  it("a null score never becomes a 50 through any code path", () => {
    const rows = deriveCustomerRowsFromTickets(
      [
        pipelineTicket({ id: "a", customerName: "A", gpPct: null }),
        pipelineTicket({ id: "b", customerName: "B", gpPct: 30 }),
      ],
      []
    );
    expect(rows.map(r => r.healthScore)).toEqual([null, null]);
  });
});

// ── W04-C1 defect C: nulls are not measured zeros ───────────────────

describe("deriveCustomerRowsFromTickets — never-captured numbers are not zeros", () => {
  it("excludes an uncaptured value from the pipeline total instead of adding 0", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [
        pipelineTicket({ id: "a", sarValue: 400 }),
        pipelineTicket({ id: "b", sarValue: null }),
      ],
      []
    );
    expect(row.totalPipelineValue).toBe(400);
  });

  it("excludes an uncaptured GP% from the average instead of averaging in 0", () => {
    const [row] = deriveCustomerRowsFromTickets(
      [
        pipelineTicket({ id: "a", gpPct: 20 }),
        pipelineTicket({ id: "b", gpPct: null }),
      ],
      []
    );
    // 20, not 10 — a null must not halve the customer's apparent margin.
    expect(row.avgGpPct).toBe(20);
  });

  it("reports a stored zero GP% as a real zero, not as 'not captured'", () => {
    const [row] = deriveCustomerRowsFromTickets([pipelineTicket({ gpPct: 0 })], []);
    expect(row.avgGpPct).toBe(0);
  });
});

describe("deriveCustomerRowsFromTickets — aggregation matches the tickets given", () => {
  it("groups by customer and keeps every ticket id for navigation", () => {
    const rows = deriveCustomerRowsFromTickets(
      [
        pipelineTicket({ id: "p-1", ticketType: "proposal", sarValue: 100 }),
        pipelineTicket({ id: "t-2", ticketType: "tender", sarValue: 300 }),
        pipelineTicket({ id: "p-3", customerName: "KAFD", sarValue: 50 }),
      ],
      []
    );
    const meridian = rows.find(r => r.customerName === "Meridian Test Logistics")!;
    expect(meridian.tickets.map(t => t.id)).toEqual(["p-1", "t-2"]);
    expect(meridian.totalPipelineValue).toBe(400);
    expect(meridian.workspaceType).toBe("Mixed");
    expect(meridian.proposalTickets).toBe(1);
    expect(meridian.tenderTickets).toBe(1);
    expect(rows.map(r => r.customerName)).toContain("KAFD");
  });

  it("returns no rows for no tickets rather than inventing a placeholder customer", () => {
    expect(deriveCustomerRowsFromTickets([], [])).toEqual([]);
  });
});
