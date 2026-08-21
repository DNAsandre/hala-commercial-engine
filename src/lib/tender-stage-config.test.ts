/**
 * tender-stage-config.test.ts — TCW-T2 (Tender Functional Closure Wave).
 *
 * Pins for correction B in buildStageConfig / buildSignals. The indicators
 * array is dormant today (only `.tabs` is consumed by TenderWorkspace), but a
 * future consumer must inherit derivations, not fabrications:
 *
 *   B1    final_approved "Final Approval" derives from the stored record
 *         type_details.final_approved.approval_record.decision — the key the
 *         Approval Record tab writes — never a hardcoded "Approved".
 *   B2    "Version Integrity" states "Not recorded" — nothing in the clean app
 *         records a version-integrity check, so "Verified" was a fabrication.
 *   B3    client_evaluation "Evaluation" derives from
 *         type_details.client_evaluation.evaluation_status or "Not recorded".
 *   B4    internal_review departmental states derive from the per-department
 *         block review statuses the tabs write, or "Not recorded" — never the
 *         pack-section proxies ("Finance Review: Complete" at 80% of pack
 *         sections) and never a hardcoded "Legal Review: Not Started".
 *   B5-B7 qualification fit gauges derive from the qualification facets the
 *         stage tabs write (capability_assessment[].fit, dimensions[]
 *         .assessment, coverage_matrix[].status) or state "Not assessed" —
 *         never pack compliance / document percentages relabelled as fit.
 *   B24   compliance-gap signals only exist when the compliance inputs were
 *         actually read (ws.riskInputsAssessed).
 *   P6    the Stage 9 (final_approved) tab list routes the three register
 *         tabs: Placeholders, Required Documents, Compliance.
 *
 * Pure-function tests, house pattern: no DOM, no database.
 */
import { describe, expect, it } from "vitest";
import { buildSignals, buildStageConfig, type Indicator } from "./tender-stage-config";
import { TENDER_INTERNAL_STAGE_KEYS } from "./tender-stage-source-truth";
import type { TenderWorkspace } from "./tender-workspace-data";

function makeWs(overrides: Record<string, unknown> = {}, tenderOverrides: Record<string, unknown> = {}): TenderWorkspace {
  return {
    tender: {
      id: "11111111-2222-3333-4444-555555555555",
      title: "Warehouse & Transport Tender",
      customerName: "Linde",
      submissionDeadline: "2027-01-15",
      estimatedValue: 1_000_000,
      targetGpPercent: 25,
      probabilityPercent: 50,
      assignedOwner: "Owner",
      source: "Email",
      region: "Central",
      ...tenderOverrides,
    },
    tenderType: "Tender",
    readinessScore: 0,
    riskLevel: "not_assessed",
    riskInputsAssessed: false,
    requiredDocumentsAssessed: false,
    crmSyncStatus: "not_synced",
    submissionModel: "single_pack",
    crmPipelineStageRaw: null,
    packs: [],
    placeholders: [],
    requiredDocuments: [],
    documents: [],
    complianceItems: [],
    activityEvents: [],
    auditEntries: [],
    ...overrides,
  } as unknown as TenderWorkspace;
}

function indicatorByLabel(indicators: Indicator[], label: string): Indicator | undefined {
  return indicators.find(i => "label" in i && i.label === label);
}

function statusOf(indicators: Indicator[], label: string): string | undefined {
  const ind = indicatorByLabel(indicators, label);
  return ind && ind.type === "status" ? ind.state : undefined;
}

describe("B1/B2 — final_approved indicators are derived, not asserted", () => {
  it("states 'Not recorded' for Final Approval when no approval record exists", () => {
    const cfg = buildStageConfig(makeWs(), "final_approved");
    expect(statusOf(cfg.indicators, "Final Approval")).toBe("Not recorded");
  });

  it("derives Final Approval from final_approved.approval_record.decision", () => {
    const approved = buildStageConfig(
      makeWs({}, { typeDetails: { final_approved: { approval_record: { decision: "approved" } } } }),
      "final_approved",
    );
    expect(statusOf(approved.indicators, "Final Approval")).toBe("Approved");

    const notApproved = buildStageConfig(
      makeWs({}, { typeDetails: { final_approved: { approval_record: { decision: "not_approved" } } } }),
      "final_approved",
    );
    expect(statusOf(notApproved.indicators, "Final Approval")).toBe("Not Approved");

    const pending = buildStageConfig(
      makeWs({}, { typeDetails: { final_approved: { approval_record: { decision: "pending" } } } }),
      "final_approved",
    );
    expect(statusOf(pending.indicators, "Final Approval")).toBe("Pending");
  });

  it("never claims Version Integrity is 'Verified' — nothing records that check", () => {
    const cfg = buildStageConfig(makeWs(), "final_approved");
    expect(statusOf(cfg.indicators, "Version Integrity")).toBe("Not recorded");
  });
});

describe("B3 — client_evaluation Evaluation indicator derives from evaluation_status", () => {
  it("states 'Not recorded' when no evaluation status is stored", () => {
    const cfg = buildStageConfig(makeWs(), "client_evaluation");
    expect(statusOf(cfg.indicators, "Evaluation")).toBe("Not recorded");
  });

  it("derives from the stored overall_status the Evaluation Status tab writes", () => {
    const cfg = buildStageConfig(
      makeWs({}, { typeDetails: { client_evaluation: { evaluation_status: { overall_status: "under_evaluation" } } } }),
      "client_evaluation",
    );
    expect(statusOf(cfg.indicators, "Evaluation")).toBe("Under Evaluation");
  });
});

describe("B4 — internal_review departmental states derive from block review statuses", () => {
  it("states 'Not recorded' for all three departments when there are no blocks", () => {
    const cfg = buildStageConfig(makeWs(), "internal_review");
    expect(statusOf(cfg.indicators, "Ops Review")).toBe("Not recorded");
    expect(statusOf(cfg.indicators, "Finance Review")).toBe("Not recorded");
    expect(statusOf(cfg.indicators, "Legal Review")).toBe("Not recorded");
  });

  it("derives per-department states from the statuses the review tabs write", () => {
    const cfg = buildStageConfig(
      makeWs({}, {
        tenderDraftingData: {
          proposal_blocks: [
            { volume: "Technical", ops_status: "Approved", legal_status: "Pending" },
            { volume: "Commercial", finance_status: "Rejected", legal_status: "Pending" },
          ],
        },
      }),
      "internal_review",
    );
    // Ops: 1/1 Technical block approved → Complete.
    expect(statusOf(cfg.indicators, "Ops Review")).toBe("Complete");
    // Finance: 1 Commercial block, 0 approved / 1 rejected → in-progress detail.
    expect(statusOf(cfg.indicators, "Finance Review")).toBe("0/1 approved, 1 rejected");
    // Legal: 2 blocks in scope, none decided → Not Started (derived, not hardcoded).
    expect(statusOf(cfg.indicators, "Legal Review")).toBe("Not Started");
  });
});

describe("B5-B7 — qualification gauges derive from qualification facets, not packs", () => {
  it("states 'Not assessed' for all three fit gauges when the facets are absent", () => {
    const cfg = buildStageConfig(makeWs(), "qualification");
    expect(statusOf(cfg.indicators, "Technical Fit")).toBe("Not assessed");
    expect(statusOf(cfg.indicators, "Customer Fit")).toBe("Not assessed");
    expect(statusOf(cfg.indicators, "Requirement Cover")).toBe("Not assessed");
  });

  it("derives assessed ratios from the keys the qualification tabs write", () => {
    const cfg = buildStageConfig(
      makeWs({}, {
        technicalQualificationData: {
          capability_assessment: [{ fit: "Strong" }, { fit: "Not Assessed" }],
        },
        customerFitData: {
          dimensions: [{ assessment: "Strong Fit" }, { assessment: "Moderate Fit" }, { assessment: "Not Assessed" }, { assessment: "Not Assessed" }],
        },
        sowQualificationData: {
          coverage_matrix: [{ status: "Clear" }, { status: "Not Assessed" }],
        },
      }),
      "qualification",
    );
    const technical = indicatorByLabel(cfg.indicators, "Technical Fit Assessed");
    expect(technical?.type).toBe("gauge");
    expect(technical && "value" in technical ? technical.value : null).toBe(50);
    const customer = indicatorByLabel(cfg.indicators, "Customer Fit Assessed");
    expect(customer && "value" in customer ? customer.value : null).toBe(50);
    const coverage = indicatorByLabel(cfg.indicators, "SOW Coverage Assessed");
    expect(coverage && "value" in coverage ? coverage.value : null).toBe(50);
  });
});

describe("B24 — compliance signals are gated on riskInputsAssessed", () => {
  const gapItems = [
    { status: "non_compliant" },
    { status: "clarification_required" },
  ];

  it("emits no compliance-gap signal when the compliance inputs were never read", () => {
    const ws = makeWs({ complianceItems: gapItems, riskInputsAssessed: false });
    const signals = buildSignals(ws, "identified");
    expect(signals.some(s => s.title.includes("Compliance Gap"))).toBe(false);
  });

  it("emits the compliance-gap signal when the inputs were read and gaps exist", () => {
    const ws = makeWs({ complianceItems: gapItems, riskInputsAssessed: true });
    const signals = buildSignals(ws, "identified");
    expect(signals.some(s => s.title.includes("Compliance Gap"))).toBe(true);
  });
});

describe("P6 — Stage 9 routes the three register tabs", () => {
  it("final_approved tab list contains Placeholders, Required Documents and Compliance", () => {
    const cfg = buildStageConfig(makeWs(), "final_approved");
    expect(cfg.tabs).toContain("Placeholders");
    expect(cfg.tabs).toContain("Required Documents");
    expect(cfg.tabs).toContain("Compliance");
  });
});

describe("correction B sweep — no stage asserts the four dormant hardcoded verdicts on empty data", () => {
  it("with a bare tender, no indicator states Approved / Verified / In Progress fabrications", () => {
    const ws = makeWs();
    for (const stage of TENDER_INTERNAL_STAGE_KEYS) {
      const cfg = buildStageConfig(ws, stage);
      for (const ind of cfg.indicators) {
        if (ind.type !== "status") continue;
        // The four previously hardcoded verdict strings, by their labels.
        if (ind.label === "Final Approval") expect(ind.state).not.toBe("Approved");
        if (ind.label === "Version Integrity") expect(ind.state).not.toBe("Verified");
        if (ind.label === "Evaluation") expect(ind.state).not.toBe("In Progress");
        if (ind.label === "Legal Review") expect(ind.state).toBe("Not recorded");
      }
    }
  });
});
