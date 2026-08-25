/**
 * proposal-field-patch.test.ts — PADW T03p acceptance tests (ADR-02 closure).
 *
 * Proves the mandated contract for path-level Proposal patches:
 *  - the stage saver ALWAYS receives the COMPLETE current envelope with only
 *    the addressed leaves changed — no sibling group, leaf, or row is lost
 *    (the ADR-02 no-sibling-loss proof), and the other 10 stage envelopes are
 *    never written at all;
 *  - repeated rows are addressed by source fingerprint with update-vs-append
 *    semantics — replaying the same extraction twice never duplicates a row;
 *  - tracker immunity (pin P9): a path reaching crm_pipeline_stage or
 *    internal_stage at ANY depth is refused before any read;
 *  - stale revision refuses non-destructively; a mid-chain stale halts later
 *    stages honestly ("Not attempted"), completed stages stay saved;
 *  - success is only reported from stored truth (read-back), and an audit
 *    failure surfaces as saved_with_audit_warning.
 */
import { describe, expect, it } from "vitest";

import type { ProcessManifest, RowIdentitySpec } from "./destination-manifest/manifest-types";
import {
  applyProposalFieldPatch,
  type ProposalFieldPatchDeps,
  type ProposalStageEnvelopeKey,
} from "./proposal-field-patch";
import type {
  ProposalStageSaveOptions,
  ProposalStageSaveResult,
  ProposalWorkspaceSnapshot,
} from "./proposal-workspace-persistence";

// ─────────────────────────────────────────────────────────────
// Structural fingerprint stand-in (P5 signature; real module is T04-owned)
// ─────────────────────────────────────────────────────────────

const computeRowFingerprint = (row: Record<string, unknown>, spec: RowIdentitySpec): string =>
  [...new Set(spec.fingerprintFields)]
    .sort()
    .map((field) => String(row[field] ?? "").trim().toLowerCase())
    .join("|");

// ─────────────────────────────────────────────────────────────
// Test manifest (pin P1: ids rooted at type_details.proposal_workspace)
// ─────────────────────────────────────────────────────────────

const MANIFEST: ProcessManifest = {
  process: "proposal",
  stages: [
    "qualified", "discovery", "solution_design", "pnl_pricing", "quote",
    "proposal_drafting", "proposal_sent", "negotiation", "commercial_approval",
    "contract_signed", "go_live",
  ],
  fields: [
    {
      id: "p:qualified.qualificationSummary.customer",
      process: "proposal", stage: "qualified", tab: "Qualification Summary",
      label: "Customer", type: "text", nullBehavior: "empty_string",
      persistencePath: "qualified.qualificationSummary.customer",
      uiOwner: "src/components/proposal-workspace/stages/QualifiedStage.tsx",
      evidence: "sidecar", pdfConsumer: "not_exported",
    },
    {
      id: "p:pnl_pricing.commercialTerms.paymentTerms",
      process: "proposal", stage: "pnl_pricing", tab: "Commercial Terms",
      label: "Payment terms", type: "text", nullBehavior: "empty_string",
      persistencePath: "pnl_pricing.commercialTerms.paymentTerms",
      uiOwner: "src/components/proposal-workspace/stages/PnlPricingStage.tsx",
      evidence: "sidecar", pdfConsumer: "not_exported",
    },
    {
      id: "p:pnl_pricing.pnlVersions[]",
      process: "proposal", stage: "pnl_pricing", tab: "P&L Versions",
      label: "P&L version", type: "object", nullBehavior: "omit",
      persistencePath: "pnl_pricing.pnlVersions[]",
      uiOwner: "src/components/proposal-workspace/stages/PnlPricingStage.tsx",
      rowIdentity: { fingerprintFields: ["name"] },
      evidence: "sidecar", pdfConsumer: ["pricing_table_single"],
    },
    {
      id: "p:discovery.volumesLanes.lanes[].origin",
      process: "proposal", stage: "discovery", tab: "Volumes & Lanes",
      label: "Lane origin", type: "text", nullBehavior: "empty_string",
      persistencePath: "discovery.volumesLanes.lanes[].origin",
      uiOwner: "src/components/proposal-workspace/stages/DiscoveryStage.tsx",
      rowIdentity: { fingerprintFields: ["laneCode"] },
      evidence: "sidecar", pdfConsumer: "not_exported",
    },
    // Deliberately hostile entry: P9 guard must refuse tracker paths at depth.
    {
      id: "p:qualified.internal_stage",
      process: "proposal", stage: "qualified", tab: "Qualification Summary",
      label: "FORBIDDEN tracker", type: "text", nullBehavior: "omit",
      persistencePath: "qualified.internal_stage",
      uiOwner: "src/pages/ProposalWorkspace.tsx",
      evidence: "none", pdfConsumer: "not_exported",
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// In-memory workspace fake (injected via ProposalFieldPatchDeps)
// ─────────────────────────────────────────────────────────────

interface FakeOptions {
  auditWarning?: boolean;
  /** Evil saver: silently drop this top-level envelope key when storing. */
  dropKeyOnSave?: string;
  /** Throw the persistence layer's stale message on the Nth saveStage call (1-based). */
  staleOnSaveCall?: number;
}

function seedStages(): Partial<Record<ProposalStageEnvelopeKey, Record<string, unknown>>> {
  return {
    qualified: {
      qualificationSummary: { opportunityName: "KAFD", customer: "original customer", region: "Riyadh" },
      customerFit: { icpFit: "Strong", fitScore: "8" },
      requiredInfo: [{ id: "ri-legacy-1724500000001", label: "Site plan", status: "Pending" }],
    },
    discovery: {
      meetingNotes: [{ id: "mn-1", note: "kickoff" }],
      volumesLanes: {
        summary: "two lanes",
        lanes: [
          { id: "lane-legacy-0.42", laneCode: "RUH-JED", origin: "Riyadh", volume: 120 },
          { id: "lane-legacy-0.43", laneCode: "JED-DMM", origin: "Jeddah", volume: 60 },
        ],
      },
    },
    pnl_pricing: {
      pnlVersions: [{ id: "v-legacy-1", name: "Base case", notes: "human-built", isApproved: true }],
      activePnlVersion: "v-legacy-1",
      commercialTerms: { paymentTerms: "original 30 days", vatTreatment: "standard" },
      costInputs: [{ id: "ci-1", label: "Labour", amount: 100 }],
    },
  };
}

function makeFake(options: FakeOptions = {}) {
  let revisionCounter = 1;
  let revision = "rev-1";
  const stages = seedStages();
  const savedEnvelopes: Array<{ stageKey: ProposalStageEnvelopeKey; data: Record<string, unknown>; options: ProposalStageSaveOptions }> = [];
  let saveCalls = 0;

  const stageLoad = (key: ProposalStageEnvelopeKey) => ({
    ticketFound: true,
    baselineData: {},
    savedData: stages[key] ? JSON.parse(JSON.stringify(stages[key])) : null,
    savedAt: null,
    revision,
    source: "commercial_tickets",
  });

  const loadSnapshot = async (): Promise<ProposalWorkspaceSnapshot> =>
    ({
      ticketFound: true,
      revision,
      qualified: stageLoad("qualified"),
      discovery: stageLoad("discovery"),
      solutionDesign: stageLoad("solution_design"),
      pnlPricing: stageLoad("pnl_pricing"),
      quote: stageLoad("quote"),
      proposalDrafting: stageLoad("proposal_drafting"),
      proposalSent: stageLoad("proposal_sent"),
      negotiation: stageLoad("negotiation"),
      commercialApproval: stageLoad("commercial_approval"),
      contractSigned: stageLoad("contract_signed"),
      goLive: stageLoad("go_live"),
    }) as unknown as ProposalWorkspaceSnapshot;

  const saveStage = async (
    stageKey: ProposalStageEnvelopeKey,
    _proposalId: string,
    data: Record<string, unknown>,
    saveOptions: ProposalStageSaveOptions,
  ): Promise<ProposalStageSaveResult> => {
    saveCalls += 1;
    if (options.staleOnSaveCall === saveCalls) {
      throw new Error("This proposal changed after the workspace loaded. Reload to continue.");
    }
    if (saveOptions.expectedRevision !== revision) {
      throw new Error("This proposal changed after the workspace loaded. Reload to continue.");
    }
    savedEnvelopes.push({ stageKey, data: JSON.parse(JSON.stringify(data)), options: saveOptions });
    const stored = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    if (options.dropKeyOnSave) delete stored[options.dropKeyOnSave];
    stages[stageKey] = stored;
    revisionCounter += 1;
    revision = `rev-${revisionCounter}`;
    return {
      savedAt: `2026-08-24T00:00:0${revisionCounter}.000Z`,
      revision,
      auditWritten: !options.auditWarning,
      ...(options.auditWarning ? { auditWarning: "audit insert refused (test)" } : {}),
      storedData: stored,
    };
  };

  const deps: ProposalFieldPatchDeps = { loadSnapshot, saveStage, computeRowFingerprint };

  return {
    deps,
    savedEnvelopes,
    get revision() { return revision; },
    get stages() { return stages; },
  };
}

// ─────────────────────────────────────────────────────────────
// No sibling loss (the ADR-02 proof)
// ─────────────────────────────────────────────────────────────

describe("applyProposalFieldPatch — no sibling loss (ADR-02)", () => {
  it("hands the saver the COMPLETE current envelope with only the addressed leaf changed", async () => {
    const fake = makeFake();
    const before = JSON.parse(JSON.stringify(fake.stages.pnl_pricing));

    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin Al-Rashid",
      patches: [{ fieldId: "p:pnl_pricing.commercialTerms.paymentTerms", value: "patched 45 days" }],
    });

    expect(outcome.status).toBe("saved");
    expect(fake.savedEnvelopes).toHaveLength(1);
    expect(fake.savedEnvelopes[0].stageKey).toBe("pnl_pricing");

    const sent = fake.savedEnvelopes[0].data;
    before.commercialTerms.paymentTerms = "patched 45 days";
    // Every sibling group, row, and leaf of the stage envelope rode through.
    expect(sent).toEqual(before);
  });

  it("never writes the other 10 stage envelopes", async () => {
    const fake = makeFake();
    const qualifiedBefore = JSON.parse(JSON.stringify(fake.stages.qualified));
    const discoveryBefore = JSON.parse(JSON.stringify(fake.stages.discovery));

    await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin Al-Rashid",
      patches: [{ fieldId: "p:pnl_pricing.commercialTerms.paymentTerms", value: "only pnl_pricing" }],
    });

    expect(fake.savedEnvelopes.map((s) => s.stageKey)).toEqual(["pnl_pricing"]);
    expect(fake.stages.qualified).toEqual(qualifiedBefore);
    expect(fake.stages.discovery).toEqual(discoveryBefore);
  });

  it("a nested repeated-row leaf patch preserves sibling rows byte-for-byte, legacy ids intact", async () => {
    const fake = makeFake();
    const fingerprint = computeRowFingerprint({ laneCode: "RUH-JED" }, { fingerprintFields: ["laneCode"] });

    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin Al-Rashid",
      patches: [{
        fieldId: "p:discovery.volumesLanes.lanes[].origin",
        value: "Riyadh (extracted)",
        rowKeys: [{ laneCode: "RUH-JED" }],
      }],
    });

    expect(outcome.status).toBe("saved");
    void fingerprint;
    const lanes = (fake.stages.discovery as any).volumesLanes.lanes;
    expect(lanes).toHaveLength(2);
    expect(lanes[0]).toMatchObject({ id: "lane-legacy-0.42", laneCode: "RUH-JED", origin: "Riyadh (extracted)", volume: 120 });
    expect(lanes[1]).toEqual({ id: "lane-legacy-0.43", laneCode: "JED-DMM", origin: "Jeddah", volume: 60 });
    // Sibling leaf of the containing group is untouched.
    expect((fake.stages.discovery as any).volumesLanes.summary).toBe("two lanes");
    expect((fake.stages.discovery as any).meetingNotes).toEqual([{ id: "mn-1", note: "kickoff" }]);
  });
});

// ─────────────────────────────────────────────────────────────
// Repeated-row idempotency (replay never duplicates)
// ─────────────────────────────────────────────────────────────

describe("applyProposalFieldPatch — repeated-row replay", () => {
  it("upserts a row by identity: append once, then update in place on replay", async () => {
    const fake = makeFake();
    const patchOf = (notes: string) => ({
      fieldId: "p:pnl_pricing.pnlVersions[]",
      value: { name: "Extracted scenario", notes },
    });

    const first = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1", expectedRevision: "rev-1", actor: "Amin", patches: [patchOf("v1")],
    });
    expect(first.status).toBe("saved");
    const second = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1", expectedRevision: fake.revision, actor: "Amin", patches: [patchOf("v2 (replayed)")],
    });
    expect(second.status).toBe("saved");

    const versions = (fake.stages.pnl_pricing as any).pnlVersions;
    expect(versions).toHaveLength(2); // 1 human row + 1 extracted row after TWO replays
    expect(versions[0]).toMatchObject({ id: "v-legacy-1", name: "Base case", notes: "human-built", isApproved: true });
    expect(versions[1]).toMatchObject({ name: "Extracted scenario", notes: "v2 (replayed)" });
    expect(versions[1]._source_fingerprint).toBe(
      computeRowFingerprint({ name: "Extracted scenario" }, { fingerprintFields: ["name"] }),
    );
  });

  it("a row upsert merges supplied leaves and keeps unsupplied leaves of the matched row", async () => {
    const fake = makeFake();
    // Matches the HUMAN row by computed identity — update, not duplicate.
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin",
      patches: [{
        fieldId: "p:pnl_pricing.pnlVersions[]",
        value: { name: "Base case", notes: "annotated by extraction" },
      }],
    });
    expect(outcome.status).toBe("saved");
    const versions = (fake.stages.pnl_pricing as any).pnlVersions;
    expect(versions).toHaveLength(1);
    // Unsupplied leaves of the matched human row survive the upsert.
    expect(versions[0]).toMatchObject({
      id: "v-legacy-1", name: "Base case", notes: "annotated by extraction", isApproved: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Refusals, guards, honest outcomes
// ─────────────────────────────────────────────────────────────

describe("applyProposalFieldPatch — refusals and honest outcomes", () => {
  it("refuses tracker paths at any depth before any read (pin P9)", async () => {
    const fake = makeFake();
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin",
      patches: [{ fieldId: "p:qualified.internal_stage", value: "go_live" }],
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.message).toMatch(/never move either tracker/i);
    expect(fake.savedEnvelopes).toHaveLength(0);
  });

  it("refuses an unknown fieldId and an undefined value with zero writes", async () => {
    const fake = makeFake();
    const unknown = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1", expectedRevision: "rev-1", actor: "Amin",
      patches: [{ fieldId: "p:not.in.manifest", value: 1 }],
    });
    expect(unknown.status).toBe("failed");
    expect(unknown.message).toMatch(/not in the proposal manifest/i);

    const undef = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1", expectedRevision: "rev-1", actor: "Amin",
      patches: [{ fieldId: "p:qualified.qualificationSummary.customer", value: undefined }],
    });
    expect(undef.status).toBe("failed");
    expect(undef.message).toMatch(/use null to clear/i);
    expect(fake.savedEnvelopes).toHaveLength(0);
  });

  it("a stale revision refuses non-destructively before any save", async () => {
    const fake = makeFake();
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-0-stale",
      actor: "Amin",
      patches: [{ fieldId: "p:qualified.qualificationSummary.customer", value: "must not land" }],
    });
    expect(outcome.status).toBe("stale");
    expect(fake.savedEnvelopes).toHaveLength(0);
    expect((fake.stages.qualified as any).qualificationSummary.customer).toBe("original customer");
  });

  it("a mid-chain stale halts later stages honestly; completed stages stay saved", async () => {
    const fake = makeFake({ staleOnSaveCall: 2 });
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin",
      patches: [
        { fieldId: "p:qualified.qualificationSummary.customer", value: "stage 1 landed" },
        { fieldId: "p:pnl_pricing.commercialTerms.paymentTerms", value: "stage 2 must halt" },
        { fieldId: "p:discovery.volumesLanes.lanes[].origin", value: "never attempted", rowKeys: [{ laneCode: "RUH-JED" }] },
      ],
    });

    expect(outcome.status).toBe("stale");
    expect(outcome.stages.map((s) => [s.stageKey, s.status])).toEqual([
      ["qualified", "saved"],
      ["pnl_pricing", "stale"],
      ["discovery", "stale"],
    ]);
    expect(outcome.stages[2].message).toMatch(/not attempted/i);
    // Stage 1 persisted; stage 3 never wrote.
    expect((fake.stages.qualified as any).qualificationSummary.customer).toBe("stage 1 landed");
    expect((fake.stages.discovery as any).volumesLanes.lanes[0].origin).toBe("Riyadh");
    expect(fake.savedEnvelopes.map((s) => s.stageKey)).toEqual(["qualified"]);
  });

  it("chains revision tokens across a multi-stage batch", async () => {
    const fake = makeFake();
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin",
      patches: [
        { fieldId: "p:qualified.qualificationSummary.customer", value: "chained A" },
        { fieldId: "p:pnl_pricing.commercialTerms.paymentTerms", value: "chained B" },
      ],
    });
    expect(outcome.status).toBe("saved");
    expect(fake.savedEnvelopes).toHaveLength(2);
    // Second stage save carried the revision returned by the first.
    expect(fake.savedEnvelopes[1].options.expectedRevision).toBe("rev-2");
    expect(outcome.stages[1].revision).toBe(fake.revision);
  });

  it("a saver that drops the value fails read-back — no fabricated success", async () => {
    const fake = makeFake({ dropKeyOnSave: "commercialTerms" });
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin",
      patches: [{ fieldId: "p:pnl_pricing.commercialTerms.paymentTerms", value: "never verifiable" }],
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.stages[0].message).toMatch(/not present in stored truth|did not match/i);
  });

  it("an audit failure surfaces as saved_with_audit_warning, never silent", async () => {
    const fake = makeFake({ auditWarning: true });
    const outcome = await applyProposalFieldPatch(MANIFEST, fake.deps, {
      ticketId: "prop-1",
      expectedRevision: "rev-1",
      actor: "Amin",
      patches: [{ fieldId: "p:qualified.qualificationSummary.customer", value: "saved, audit warned" }],
    });
    expect(outcome.status).toBe("saved_with_audit_warning");
    expect(outcome.stages[0].auditWarning).toMatch(/audit insert refused/i);
    expect((fake.stages.qualified as any).qualificationSummary.customer).toBe("saved, audit warned");
  });
});
