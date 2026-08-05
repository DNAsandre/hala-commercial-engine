/**
 * ProposalOverview.test.tsx — SC-01 Wave 04 / correction lane W04-C1.
 *
 * Defends the corrections to /commercial-overview:
 *
 *   A — "Margin Health 85%" and "Time Pressure 80%" came from three-way bucket
 *       constants. Every printed figure must now come from the record.
 *   C — the swimlane card and the preview popup used to disagree about the same
 *       record: the card derived its own verdict from `gpPct` (so a null
 *       arrived as 0 and was labelled "Critical") while the popup used the
 *       ticket's derived riskLevel (which said green). They must agree.
 *
 * No DOM test environment exists in this package, so the strip is asserted
 * through `proposalMeasures`, the exact data the strip maps over.
 */
import { describe, expect, it } from "vitest";
import { proposalMeasures } from "./ProposalOverview";
import { deriveCommercialTicketPipelineTickets } from "@/lib/pipeline-tickets";
import type { CommercialTicket } from "@/lib/unified-ticket-types";

function ticket(overrides: Partial<CommercialTicket> = {}): CommercialTicket {
  return {
    id: "089447d6-6d4f-4921-9df3-92483f36233a",
    ticket_type: "proposal",
    ticket_title: "Stock Count, Transport and Warehouse Storage Area",
    customer_name: "KAFD",
    customer_id: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    company: null,
    owner: "Sara Al Otaibi",
    team_members: [],
    region: "Central",
    industry: null,
    crm_pipeline_stage: "Proposal Sent",
    internal_stage: "proposal_drafting",
    estimated_value: null,
    target_gp_percent: null,
    probability_percent: null,
    target_date: null,
    notes: null,
    type_details: {},
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function derived(overrides: Partial<CommercialTicket> = {}) {
  return deriveCommercialTicketPipelineTickets([ticket(overrides)])[0];
}

// ── Defect A ────────────────────────────────────────────────────────

describe("proposalMeasures — no fabricated percentage", () => {
  it("prints the real GP% rather than the 85 / 50 / 15 buckets", () => {
    expect(proposalMeasures(derived({ target_gp_percent: 24 }))[0].text).toBe("24%");
    expect(proposalMeasures(derived({ target_gp_percent: 18 }))[0].text).toBe("18%");
    expect(proposalMeasures(derived({ target_gp_percent: 4 }))[0].text).toBe("4%");
  });

  it("prints days as days rather than the 80 / 50 / 20 buckets", () => {
    const fresh = derived({ created_at: new Date(Date.now() - 3 * 86400000).toISOString() });
    const measure = proposalMeasures(fresh)[1];
    expect(measure.text).toBe("3d");
    expect(measure.text).not.toBe("80%");
    expect(measure.tone).toBe("green");
  });

  it("never prints a figure the record does not hold", () => {
    const measures = proposalMeasures(derived({
      target_gp_percent: 24,
      probability_percent: 60,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    }));
    expect(measures.map(m => m.text)).toEqual(["24%", "20d", "60%"]);
  });

  it("says 'Not captured' for a proposal that captured none of the three", () => {
    // Value, GP and probability all null, and no readable created_at.
    const measures = proposalMeasures(derived({ created_at: undefined }));
    expect(measures.map(m => m.text)).toEqual(["Not captured", "Not captured", "Not captured"]);
    expect(measures.map(m => m.tone)).toEqual(["none", "none", "none"]);
    expect(measures.map(m => m.fill)).toEqual([null, null, null]);
  });
});

// ── Defect C: card and popup must agree ─────────────────────────────

describe("margin verdict — one source, so the card and the popup agree", () => {
  it("gives an uncaptured GP no verdict at all, on both surfaces", () => {
    const t = derived({ target_gp_percent: null });
    // Popup strip:
    expect(proposalMeasures(t)[0].tone).toBe("none");
    // Card + popup risk chip (both now read these two fields):
    expect(t.riskLevel).toBe("unknown");
    expect(t.riskLabel).toBe("GP not captured");
    expect(t.riskLabel).not.toBe("Critical");
  });

  it("agrees on a genuinely critical margin", () => {
    const t = derived({ target_gp_percent: 4 });
    expect(t.riskLevel).toBe("red");
    expect(t.riskLabel).toBe("Critical");
    expect(proposalMeasures(t)[0].tone).toBe("red");
  });

  it("agrees on a healthy margin", () => {
    const t = derived({ target_gp_percent: 30 });
    expect(t.riskLevel).toBe("green");
    expect(proposalMeasures(t)[0].tone).toBe("green");
  });

  it("uses one set of thresholds — 22 and 10 — on both surfaces", () => {
    // The card used to switch amber at 15 while the derived verdict switched at
    // 22, so a 17% GP was "Tight" on the card and "Low GP" in the popup.
    const t = derived({ target_gp_percent: 17 });
    expect(t.riskLevel).toBe("amber");
    expect(proposalMeasures(t)[0].tone).toBe("amber");
  });
});
