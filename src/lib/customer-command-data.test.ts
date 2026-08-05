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
    expect(row.dso).toBe(0);
  });

  it("does not dock the health score for an unknown payment risk", () => {
    const unmatched = deriveCustomerRowsFromTickets([pipelineTicket()], [])[0];
    const matchedGood = deriveCustomerRowsFromTickets(
      [pipelineTicket()],
      [customer({ paymentStatus: "Good", dso: 10 })]
    )[0];
    // Same tickets, same GP, no risk flags: an absent master record must not
    // make the customer look worse than one confirmed to pay on time.
    expect(unmatched.healthScore).toBe(matchedGood.healthScore);
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
