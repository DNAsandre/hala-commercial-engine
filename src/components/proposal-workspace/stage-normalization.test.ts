import { describe, expect, it } from "vitest";
import { normalizeCrmStageKey } from "./CrmPipelineStrip";
import { normalizeProposalStageKey } from "./proposal-stages";
import { DEFAULT_CRM_PIPELINE_STAGE, DEFAULT_INTERNAL_STAGE } from "@/lib/unified-ticket-types";

describe("commercial tracker stage normalization", () => {
  it("writes canonical keys for newly created Proposal and Tender tickets", () => {
    expect(DEFAULT_CRM_PIPELINE_STAGE).toBe("prospecting");
    expect(DEFAULT_INTERNAL_STAGE.proposal).toBe("qualified");
    expect(DEFAULT_INTERNAL_STAGE.tender).toBe("identified");
  });

  it("recovers legacy title-case Proposal stages", () => {
    expect(normalizeProposalStageKey("Qualified")).toBe("qualified");
    expect(normalizeProposalStageKey("P&L / Pricing")).toBe("pnl_pricing");
    expect(normalizeProposalStageKey("Contract Signed")).toBe("contract_signed");
    expect(normalizeProposalStageKey("unknown legacy stage")).toBeNull();
  });

  it("recovers legacy title-case CRM stages", () => {
    expect(normalizeCrmStageKey("Prospecting")).toBe("prospecting");
    expect(normalizeCrmStageKey("Proposal Sent")).toBe("proposal_sent");
    expect(normalizeCrmStageKey("Actual Go Live")).toBe("actual_go_live");
    expect(normalizeCrmStageKey("unknown legacy stage")).toBeNull();
  });
});
