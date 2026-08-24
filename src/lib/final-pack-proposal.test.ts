import { describe, expect, it } from "vitest";
import { buildTenderSourceData, normalizeCommercialTicketDetails } from "@/lib/final-pack-loader";

describe("Proposal Drafting to FinalPack projection", () => {
  const details = {
    proposal_workspace: {
      proposal_drafting: {
        data: {
          proposalTocSections: [{ id: "executive-summary", sectionTitle: "Executive Summary" }],
          proposalDraftBlocks: [{
            id: "block-1",
            sectionId: "executive-summary",
            blockTitle: "Executive Summary",
            content: "<p>Persisted proposal truth</p>",
            sourceRefs: "Qualified / Customer Needs",
          }],
        },
      },
      pnl_pricing: {
        data: {
          activePnlVersion: "pnl-1",
          pnlVersions: [{
            id: "pnl-1",
            name: "Working P&L",
            isApproved: true,
            overheadPercent: 10,
            revenue: [{ label: "Revenue", amount: 1000 }],
            costs: [{ label: "Cost", amount: 500 }],
          }],
        },
      },
    },
  };

  it("projects persisted Proposal blocks and pricing into the existing document contract", () => {
    const normalized = normalizeCommercialTicketDetails(details);
    expect(normalized.tender_drafting.proposal_blocks).toEqual([expect.objectContaining({
      id: "block-1",
      title: "Executive Summary",
      content_html: "<p>Persisted proposal truth</p>",
    })]);
    expect(normalized.pricing.scenarios.rows[0]).toEqual(expect.objectContaining({
      id: "pnl-1",
      revenue: "1000",
      cost: "550",
      recommended: "Working scenario",
    }));
  });

  it("includes Proposal Drafting truth in source-drift hashing input", () => {
    const source = buildTenderSourceData({
      id: "proposal-1",
      ticket_title: "Customer Proposal",
      customer_name: "Customer",
      type_details: details,
    });
    expect(source.tender_drafting).toEqual(expect.objectContaining({
      proposal_blocks: [expect.objectContaining({ content_html: "<p>Persisted proposal truth</p>" })],
    }));
  });
});
