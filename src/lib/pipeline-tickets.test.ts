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

import { describe, expect, it } from "vitest";
import {
  resolveReadState,
  describeRenderedCount,
  deriveCommercialTicketPipelineTickets,
  normStage,
} from "./pipeline-tickets";
import { filterAllowedTenderTickets, ALLOWED_TENDER_IDS } from "./process-isolation";
import type { CommercialTicket } from "./unified-ticket-types";

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

  it("does not invent a risk label when GP% was never captured", () => {
    const [derived] = deriveCommercialTicketPipelineTickets([ticket({ target_gp_percent: null })]);
    expect(derived.gpPct).toBe(0);
    expect(derived.riskLabel).toBe("");
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
