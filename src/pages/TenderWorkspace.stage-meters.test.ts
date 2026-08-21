/**
 * TenderWorkspace.stage-meters.test.ts — TCW-T2 (Tender Functional Closure
 * Wave).
 *
 * Meter truth for the Stage Tasks sidebar. The defect class: every meter must
 * read the EXACT keys its stage tab writes. Before this lane, the
 * qualification meters read clarification_questions / overall_score /
 * output_wiring / fit_dimensions / evidence_register / risk_register /
 * risk_assessment — none of which any tab writes — so honestly saved work
 * rendered 0% forever, while the technical capability segment counted
 * pre-seeded rows as complete. The drafting meters read cc.items / ae.items
 * where the tabs save requirements / evidence_gaps. The Stage-8 meter read
 * ONLY the legacy tender_drafting.approval_matrix location while the stage
 * writes canonical type_details.approval_matrix (live Linde data is at the
 * legacy location — the canonical-first-legacy-fallback projection covers
 * both).
 *
 * House pattern: pure logic exported from the page, no DOM.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildApprovalMatrixTaskProgress,
  buildCustomerFitTaskProgress,
  buildFinalApprovedTaskProgress,
  buildRiskSnapshotTaskProgress,
  buildSowQualificationTaskProgress,
  buildStageTaskProgress,
  buildTechnicalQualificationTaskProgress,
  buildTenderDraftingTaskProgress,
} from "./TenderWorkspace";
import type { TenderWorkspace } from "@/lib/tender-workspace-data";

function makeWs(tenderOverrides: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}): TenderWorkspace {
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

function segment(segments: { key: string; percent: number | null; note?: string }[] | null, key: string) {
  const found = segments?.find(s => s.key === key);
  if (!found) throw new Error(`segment ${key} missing`);
  return found;
}

describe("SOW Qualification meter reads the keys SowQualification.tsx writes", () => {
  it("saved clarifications and outcome register as progress", () => {
    const ws = makeWs({
      sowQualificationData: {
        clarifications: [{ question: "Confirm pallet volumes" }],
        outcome: { recommendation: "Proceed with assumptions", reason: "Volumes assumed from RFQ annex" },
        coverage_matrix: [{ status: "Clear" }, { status: "Not Assessed" }],
      },
    });
    const segs = buildSowQualificationTaskProgress(ws);
    expect(segment(segs, "clarifications").percent).toBe(100);
    expect(segment(segs, "outcome").percent).toBe(100);
    expect(segment(segs, "coverage").percent).toBe(50);
  });

  it("an empty facet renders honest zeros, and the static wiring tab renders no percentage", () => {
    const segs = buildSowQualificationTaskProgress(makeWs());
    expect(segment(segs, "clarifications").percent).toBe(0);
    expect(segment(segs, "outcome").percent).toBe(0);
    expect(segment(segs, "wiring").percent).toBeNull();
    expect(segment(segs, "wiring").note).toContain("nothing is recorded");
  });
});

describe("Technical Qualification meter reads the keys TechnicalQualification.tsx writes", () => {
  it("counts capability rows by .fit — pre-seeded unassessed rows are not progress", () => {
    const ws = makeWs({
      technicalQualificationData: {
        // Pre-seeded shape: every row exists from first save with status "Open".
        capability_assessment: [
          { fit: "Strong", status: "Open" },
          { fit: "Not Assessed", status: "Open" },
          { fit: "Not Assessed", status: "Open" },
          { fit: "Not Assessed", status: "Open" },
        ],
        gaps: [{ gap: "No DG-certified fleet in the Eastern region" }],
        clarifications: [{ question: "Confirm WMS integration scope" }],
        recommendation: { outcome: "Not decided", reason: "" },
      },
    });
    const segs = buildTechnicalQualificationTaskProgress(ws);
    // 1 of 4 rows has a fit level set. The old .status check would say 100%.
    expect(segment(segs, "capability").percent).toBe(25);
    expect(segment(segs, "summary").percent).toBe(25);
    expect(segment(segs, "gaps").percent).toBe(100);
    expect(segment(segs, "clarifications").percent).toBe(100);
    expect(segment(segs, "recommendation").percent).toBe(0);
  });

  it("empty facet renders zeros and the wiring tab renders no percentage", () => {
    const segs = buildTechnicalQualificationTaskProgress(makeWs());
    expect(segment(segs, "capability").percent).toBe(0);
    expect(segment(segs, "gaps").percent).toBe(0);
    expect(segment(segs, "wiring").percent).toBeNull();
  });
});

describe("Customer Fit meter reads the keys CustomerFitQualification.tsx writes", () => {
  it("snapshot / dimensions / evidence / gaps / recommendation derive from the saved facet", () => {
    const ws = makeWs({
      customerFitData: {
        customer_snapshot: { customer_name: "Linde", region: "Central" },
        dimensions: [{ assessment: "Strong Fit" }, { assessment: "Not Assessed" }],
        evidence: [{ evidence_type: "Reference", description: "Existing contract" }],
        gaps: [],
        recommendation: { outcome: "Proceed to Bid / No-Bid", reason: "Strategic account" },
      },
    });
    const segs = buildCustomerFitTaskProgress(ws);
    expect(segment(segs, "snapshot").percent).toBe(20); // 2 of the 10 snapshot fields
    expect(segment(segs, "dimensions").percent).toBe(50);
    expect(segment(segs, "scorecard").percent).toBe(50); // scorecard is a projection of the same rows
    expect(segment(segs, "evidence").percent).toBe(100);
    expect(segment(segs, "gaps").percent).toBe(0);
    expect(segment(segs, "recommendation").percent).toBe(100);
  });

  it("empty facet renders honest zeros", () => {
    const segs = buildCustomerFitTaskProgress(makeWs());
    for (const key of ["snapshot", "dimensions", "scorecard", "evidence", "gaps", "recommendation"]) {
      expect(segment(segs, key).percent).toBe(0);
    }
  });
});

describe("Risk Snapshot meter reads the keys RiskSnapshot.tsx writes", () => {
  it("register / assessment / clarifications derive from the saved facet", () => {
    const ws = makeWs({
      riskSnapshotData: {
        register: [{ title: "Deadline risk", severity: "High" }],
        assessment: { scope_risk: "High", deadline_risk: "Not Assessed" },
        mitigation_actions: [],
        clarifications: [{ question: "Confirm penalty regime" }],
        recommendation: { outcome: "Proceed with mitigation", reason: "" },
      },
    });
    const segs = buildRiskSnapshotTaskProgress(ws);
    expect(segment(segs, "register").percent).toBe(100);
    expect(segment(segs, "summary").percent).toBe(100); // summary renders register stats
    expect(segment(segs, "assessment").percent).toBe(50);
    expect(segment(segs, "clarifications").percent).toBe(100);
    expect(segment(segs, "mitigation").percent).toBe(0);
    expect(segment(segs, "recommendation").percent).toBe(50);
  });

  it("empty facet renders zeros and the wiring tab renders no percentage", () => {
    const segs = buildRiskSnapshotTaskProgress(makeWs());
    expect(segment(segs, "register").percent).toBe(0);
    expect(segment(segs, "assessment").percent).toBe(0);
    expect(segment(segs, "wiring").percent).toBeNull();
  });
});

describe("Drafting meters read the keys the drafting tabs write", () => {
  it("compliance coverage counts requirements rows the tab saves", () => {
    const ws = makeWs({
      tenderDraftingData: {
        compliance_coverage: {
          requirements: [
            { requirement_text: "ISO 9001", status: "Covered" },
            { requirement_text: "SFDA licence", status: "Not Started" },
          ],
        },
      },
    });
    const segs = buildTenderDraftingTaskProgress("compliance_coverage", ws);
    expect(segment(segs, "compliance_items").percent).toBe(50);
  });

  it("appendices meter counts evidence_gaps rows the tab saves", () => {
    const ws = makeWs({
      tenderDraftingData: {
        appendices_evidence: {
          evidence_gaps: [
            { missing_evidence: "Insurance certificate", status: "Missing" },
            { missing_evidence: "", status: "Missing" },
          ],
        },
      },
    });
    const segs = buildTenderDraftingTaskProgress("appendices_evidence", ws);
    expect(segment(segs, "appendices").percent).toBe(50);
  });

  it("empty drafting facets render honest zeros", () => {
    const ws = makeWs({ tenderDraftingData: {} });
    expect(segment(buildTenderDraftingTaskProgress("compliance_coverage", ws), "compliance_items").percent).toBe(0);
    expect(segment(buildTenderDraftingTaskProgress("appendices_evidence", ws), "appendices").percent).toBe(0);
  });
});

describe("Stage-8 approval meter reads the canonical matrix with legacy fallback", () => {
  const approvals = [{ decision: "approved" }, { decision: "pending" }];

  it("reads canonical type_details.approval_matrix", () => {
    const ws = makeWs({ typeDetails: { approval_matrix: { approvals } } });
    const segs = buildApprovalMatrixTaskProgress("approval_matrix", ws);
    expect(segment(segs, "approvals").percent).toBe(50);
  });

  it("falls back to the legacy tender_drafting.approval_matrix location (live Linde shape)", () => {
    const ws = makeWs({ typeDetails: { tender_drafting: { approval_matrix: { approvals } } } });
    const segs = buildApprovalMatrixTaskProgress("approval_matrix", ws);
    expect(segment(segs, "approvals").percent).toBe(50);
  });

  it("prefers canonical over legacy when both exist", () => {
    const ws = makeWs({
      typeDetails: {
        approval_matrix: { approvals: [{ decision: "approved" }] },
        tender_drafting: { approval_matrix: { approvals: [{ decision: "pending" }, { decision: "pending" }] } },
      },
    });
    const segs = buildApprovalMatrixTaskProgress("approval_matrix", ws);
    expect(segment(segs, "approvals").percent).toBe(100);
  });

  it("final_approved approval_record segments read the same projection", () => {
    const ws = makeWs({ typeDetails: { tender_drafting: { approval_matrix: { approvals: [{ decision: "approved" }] } } } });
    const segs = buildFinalApprovedTaskProgress("approval_record", ws);
    expect(segment(segs, "signoffs").percent).toBe(100);
  });
});

describe("constant-100% segments are gone — advisory sections say so instead", () => {
  it("Governance Note / Governance Rules / Governance render as advisory notes, not 100%", () => {
    const ws = makeWs();
    const matrixSegs = buildApprovalMatrixTaskProgress("approval_matrix", ws);
    expect(segment(matrixSegs, "governance").percent).toBeNull();
    expect(segment(matrixSegs, "governance").note).toContain("Advisory");

    const logSegs = buildApprovalMatrixTaskProgress("governance_log", ws);
    expect(segment(logSegs, "governance_rules").percent).toBeNull();
    expect(segment(logSegs, "governance_rules").note).toContain("Advisory");

    const recordSegs = buildFinalApprovedTaskProgress("approval_record", ws);
    expect(segment(recordSegs, "governance").percent).toBeNull();
  });
});

describe("stage dispatch still routes every stage builder", () => {
  it("qualification tab ids resolve through buildStageTaskProgress", () => {
    const ws = makeWs({ riskSnapshotData: { register: [{ title: "r" }] } });
    const segs = buildStageTaskProgress("qualification", "risk_snapshot", ws);
    expect(segment(segs, "register").percent).toBe(100);
  });
});

describe("reload wiring — every saving stage tab dispatch hands the bundle reload to the tab", () => {
  const source = readFileSync(fileURLToPath(new URL("./TenderWorkspace.tsx", import.meta.url)), "utf-8");
  const lines = source.split(/\r?\n/);

  /** The JSX dispatch lines are single-line returns; find the line rendering the component. */
  function dispatchLines(name: string): string[] {
    const found = lines.filter(line => line.includes(`return <${name} `));
    if (found.length === 0) throw new Error(`no dispatch line renders <${name} …> in TenderWorkspace.tsx`);
    return found;
  }

  const spreadWired = [
    "TechnicalQualification",
    "CustomerFitQualification",
    "RiskSnapshot",
    "SolutionConfigurationTab",
    "HOPOperationsModelTab",
    "HAMManpowerModelTab",
    "HIPSystemsIPModelTab",
    "ScopeMatrixTab",
    "SLAKPIModelTab",
    "AssumptionsDependenciesTab",
  ];

  it.each(spreadWired)("%s dispatch carries onSaved: reload (spread contract for T3)", name => {
    for (const line of dispatchLines(name)) {
      expect(line).toContain("{...{ onSaved: reload }}");
    }
  });

  it.each(["SowQualification", "BidDecisionTab", "WinStrategyTab", "ResourceCommitmentTab", "DecisionRecordTab", "TenderDraftingStage"])(
    "%s dispatch carries onSaved={reload} directly",
    name => {
      for (const line of dispatchLines(name)) {
        expect(line).toContain("onSaved={reload}");
      }
    },
  );
});
