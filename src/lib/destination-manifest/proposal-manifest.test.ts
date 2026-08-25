/**
 * proposal-manifest.test.ts — PADW T02 acceptance (pin P2).
 *
 * The manifest is machine-checkable: structural validation must return ZERO
 * problems, every stage must be one of the 11 canonical stages in order,
 * every repeated path must declare row identity, the trackers must be
 * unaddressable, and the per-stage field counts are pinned so any silent
 * edit to the manifest breaks this test and forces a deliberate re-count.
 */
import { describe, expect, it } from "vitest";

import { validateManifest } from "./manifest-types";
import { PROPOSAL_MANIFEST } from "./proposal-manifest";

const STAGES = [
  "qualified",
  "discovery",
  "solution_design",
  "pnl_pricing",
  "quote",
  "proposal_drafting",
  "proposal_sent",
  "negotiation",
  "commercial_approval",
  "contract_signed",
  "go_live",
] as const;

describe("PROPOSAL_MANIFEST — structural contract", () => {
  it("passes validateManifest with zero problems", () => {
    expect(validateManifest(PROPOSAL_MANIFEST)).toEqual([]);
  });

  it("declares exactly the 11 proposal stages, in tracker order", () => {
    expect(PROPOSAL_MANIFEST.stages).toEqual([...STAGES]);
  });

  it("every field belongs to a declared stage and every stage has fields", () => {
    const byStage = new Map<string, number>();
    for (const field of PROPOSAL_MANIFEST.fields) {
      byStage.set(field.stage, (byStage.get(field.stage) ?? 0) + 1);
    }
    for (const stage of STAGES) {
      expect(byStage.get(stage) ?? 0).toBeGreaterThan(0);
    }
    expect([...byStage.keys()].sort()).toEqual([...STAGES].sort());
  });

  it("every repeated ([]) path declares rowIdentity with content leaves (never generated ids)", () => {
    const repeated = PROPOSAL_MANIFEST.fields.filter((f) => f.persistencePath.includes("[]"));
    expect(repeated.length).toBeGreaterThan(0);
    for (const field of repeated) {
      expect(field.rowIdentity, field.id).toBeDefined();
      expect(field.rowIdentity!.fingerprintFields.length).toBeGreaterThan(0);
      expect(field.rowIdentity!.fingerprintFields).not.toContain("id");
    }
  });

  it("no path can reach either tracker column (pin P9)", () => {
    for (const field of PROPOSAL_MANIFEST.fields) {
      const segments = field.persistencePath.split(".").map((s) => s.replace("[]", ""));
      expect(segments, field.id).not.toContain("internal_stage");
      expect(segments, field.id).not.toContain("crm_pipeline_stage");
    }
  });

  it("no bot/prompt/provider content anywhere (bot architecture rule)", () => {
    const serialized = JSON.stringify(PROPOSAL_MANIFEST).toLowerCase();
    for (const forbidden of ["prompt", "openai", "anthropic", "gpt-", "claude-", "model_id"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("current PDF consumers are limited to the projected stages (doc 03)", () => {
    const exportingStages = new Set(
      PROPOSAL_MANIFEST.fields
        .filter((f) => f.pdfConsumer !== "not_exported")
        .map((f) => f.stage),
    );
    // Only pnl_pricing + proposal_drafting are read by
    // normalizeCommercialTicketDetails today; everything else is honestly
    // "not_exported" until a real resolver exists.
    expect([...exportingStages].sort()).toEqual(["pnl_pricing", "proposal_drafting"]);
  });
});

describe("PROPOSAL_MANIFEST — derivation counts (pinned; re-count deliberately on change)", () => {
  const counts: Record<(typeof STAGES)[number], number> = {
    // 11 + 8 + 6 + (1 collection + 4 leaves) = 30
    qualified: 30,
    // (1+6) meetingNotes + 6 needs + 5 pain + 8 volumes + 5 risks = 31
    discovery: 31,
    // 6+6+6+6+6+5+5+6 = 46
    solution_design: 46,
    // (1+5) versions + (1+2) revenue + (1+2) costs + 1 active + (1+5) costInputs
    // + (1+6) pricingLines + (1+6) marginScenarios + 22 terms + 10 assumptions = 65
    pnl_pricing: 65,
    // 8 + 6 + 8 + 8 + (1+4) versions = 35
    quote: 35,
    // (1+6) toc + (1+5) sourceMap + (1+7) blocks + 6 tech + 5 comm + (1+6) evidence + 3 appendix + 5 review = 47
    proposal_drafting: 47,
    // 6 + 6 + (1+7) recipients + (1+6) attachments + 6 crm + (1+4) notes = 38
    proposal_sent: 38,
    // (1+7) feedback + (1+6) scope + (1+6) pricing + 6 margin + (1+6) revised + (1+5) notes = 41
    negotiation: 41,
    // 6 + 8 + 5 + 6 + 6 = 31
    commercial_approval: 31,
    // 8 + 6 + 6 + 8 + 6 = 34
    contract_signed: 34,
    // 6 + 8 + 6 + 6 + 7 + 6 = 39
    go_live: 39,
  };

  for (const stage of STAGES) {
    it(`${stage}: ${counts[stage]} destinations`, () => {
      expect(PROPOSAL_MANIFEST.fields.filter((f) => f.stage === stage)).toHaveLength(counts[stage]);
    });
  }

  it("total destination count matches the per-stage sum", () => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(PROPOSAL_MANIFEST.fields).toHaveLength(total);
  });

  it("spot checks: critical canonical ids exist", () => {
    const ids = new Set(PROPOSAL_MANIFEST.fields.map((f) => f.id));
    for (const id of [
      "p:qualified.qualificationSummary.customer",
      "p:pnl_pricing.pnlVersions[]",
      "p:pnl_pricing.pnlVersions[].name",
      "p:pnl_pricing.pnlVersions[].revenue[].amount",
      "p:pnl_pricing.activePnlVersion",
      "p:pnl_pricing.commercialTerms.paymentTerms",
      "p:proposal_drafting.proposalDraftBlocks[].content",
      "p:proposal_drafting.proposalTocSections[].sectionTitle",
      "p:contract_signed.proposalSignedContractReference.contractNumber",
      "p:go_live.proposalRenewalFutureMemory.memoryOwner",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
