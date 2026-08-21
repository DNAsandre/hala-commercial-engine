/**
 * TenderGlobalIntelligenceDrawer.test.ts — TCW-T4 (F5, B15, B16)
 *
 *  - F5: the drawer timeline consumes ONE deduplicated audit feed — every
 *    stored row appears exactly once and the totals count the real row set
 *    (the pre-fix drawer merged two projections of the SAME rows and doubled
 *    everything);
 *  - B15/B16: stage-intelligence checks derive from the keys the writers
 *    actually store (solution_design_data.configuration/hop/ham/hip/
 *    scope_matrix/sla_kpi, pricing sections, per-block review statuses,
 *    canonical-with-legacy approval matrix) — a fully populated tender turns
 *    every check on, which the pre-fix hardcoded `false` literals made
 *    impossible.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  buildDrawerTimeline,
  classifyAuditEntryKind,
  deriveStageIntelligenceChecks,
} from "@/components/tender/TenderGlobalIntelligenceDrawer";

function auditRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenderWorkspaceId: "t-1",
    action: "updated",
    eventCode: "pricing.scenarios",
    eventName: "pricing.scenarios",
    entityType: "commercial_ticket",
    entityId: "t-1",
    category: "SYSTEM",
    userId: "Amina",
    userName: "Amina",
    timestamp: "2026-08-19T10:00:00.000Z",
    details: "P&L / Pricing updated | scenarios",
    beforeState: undefined,
    afterState: undefined,
    severity: "info",
    mock: false,
    notes: undefined,
    ...overrides,
  } as any;
}

describe("classifyAuditEntryKind (real stored fields)", () => {
  it("field_changed 'note' rows are notes", () => {
    expect(classifyAuditEntryKind({ action: "updated", eventCode: "note", eventName: "note" })).toBe("note");
  });
  it("stage_changed actions and stage/phase fields are stage moves", () => {
    expect(classifyAuditEntryKind({ action: "stage_changed", eventCode: "internal_stage", eventName: "internal_stage" })).toBe("stage_move");
    expect(classifyAuditEntryKind({ action: "updated", eventCode: "crm_pipeline_stage", eventName: "crm_pipeline_stage" })).toBe("stage_move");
  });
  it("everything else is an update", () => {
    expect(classifyAuditEntryKind({ action: "updated", eventCode: "tender_drafting.proposal_blocks", eventName: "tender_drafting.proposal_blocks" })).toBe("update");
  });
});

describe("buildDrawerTimeline (F5 — count once, list once)", () => {
  it("N stored audit rows produce exactly N timeline entries (never 2N)", () => {
    const rows = [auditRow("a1"), auditRow("a2", { eventCode: "note", eventName: "note" }), auditRow("a3", { action: "stage_changed", eventCode: "internal_stage" })];
    const timeline = buildDrawerTimeline(rows);
    expect(timeline).toHaveLength(3);
    expect(new Set(timeline.map(e => e.id)).size).toBe(3);
  });

  it("sorts newest first and preserves before/after payloads", () => {
    const timeline = buildDrawerTimeline([
      auditRow("old", { timestamp: "2026-08-01T00:00:00.000Z" }),
      auditRow("new", { timestamp: "2026-08-19T00:00:00.000Z", beforeState: "qualified", afterState: "proposal_sent" }),
    ]);
    expect(timeline[0].id).toBe("new");
    expect(timeline[0].beforeState).toBe("qualified");
    expect(timeline[0].afterState).toBe("proposal_sent");
  });

  it("kind counters over the single feed match the real row set", () => {
    const timeline = buildDrawerTimeline([
      auditRow("a1", { eventCode: "note", eventName: "note" }),
      auditRow("a2"),
      auditRow("a3"),
    ]);
    expect(timeline.filter(e => e.kind === "note")).toHaveLength(1);
    expect(timeline.filter(e => e.kind === "update")).toHaveLength(2);
  });
});

describe("deriveStageIntelligenceChecks (B15/B16 — real stored keys, nothing hardcoded)", () => {
  const draftedBlock = (volume: string, statuses: Record<string, string> = {}) => ({
    id: `b-${volume}`,
    volume,
    editor_content: "<p>" + "content ".repeat(20) + "</p>",
    ...statuses,
  });

  function fullyPopulatedTender() {
    const blocks = [
      draftedBlock("Technical", { ops_status: "Approved", legal_status: "Approved" }),
      draftedBlock("Commercial", { finance_status: "Approved", legal_status: "Approved" }),
      draftedBlock("Shared", { ops_status: "Approved", finance_status: "Approved", legal_status: "Approved" }),
      { id: "b-appendix", volume: "Appendix", legal_status: "Approved" },
    ];
    return {
      title: "KAFD Warehousing Tender",
      customerName: "KAFD",
      assignedOwner: "Amina",
      submissionDeadline: "2026-09-30",
      estimatedValue: 1_000_000,
      sowQualificationData: { outcome: { recommendation: "Proceed" } },
      technicalQualificationData: { recommendation: { outcome: "Fit" } },
      customerFitData: { recommendation: "Fit" },
      riskSnapshotData: { register: [{ title: "Capacity", severity: "High" }] },
      bidNoBidData: {
        decision: { decision: "Bid" },
        win_strategy: { rationale: { why_bid: "Strategic account" } },
        resource_commitment: { recommendation: { recommendation: "Commit" } },
        decision_record: { formal: { decision: "Bid" } },
      },
      solutionDesignData: {
        configuration: { selected_modules: "Warehousing + Transport" },
        hop: { warehouse: { storage_required: "Yes" } },
        ham: { staffing: [{ role: "Ops Manager" }] },
        hip: { systems: [{ name: "WMS" }] },
        scope_matrix: { rows: [{ scope_item: "Inbound" }] },
        sla_kpi: { kpis: [{ name: "OTIF" }] },
      },
      pricingData: {
        pnl_snapshot: { snapshot_status: "Snapshot Saved", linked_pnl_record_id: "pnl-1" },
        scenarios: { rows: [{ scenario_name: "Base", gp_percent: 24 }] },
        commercial_terms: { payment_tax_validity: { payment_terms: "60 days" } },
        approval: { summary: { approval_status: "Management Approved" } },
      },
      tenderDraftingData: {
        proposal_architecture: { status: "Blocks Created", toc_versions: [{ id: "v1", sections: [{ section_title: "Intro" }] }] },
        proposal_blocks: blocks,
      },
      typeDetails: {
        approval_matrix: {
          approvals: [
            { id: "a1", role: "ceo", role_label: "CEO", type: "approval", decision: "approved", decided_by: "Amina", comment: "", decided_at: "2026-08-19T10:00:00.000Z" },
            { id: "a2", role: "cfo", role_label: "CFO", type: "approval", decision: "approved", decided_by: "Amina", comment: "", decided_at: "2026-08-19T10:05:00.000Z" },
          ],
        },
      },
    };
  }

  function checksFor(groups: ReturnType<typeof deriveStageIntelligenceChecks>, stage: string) {
    const group = groups.find(g => g.stage === stage);
    if (!group) throw new Error(`missing stage group ${stage}`);
    return group.checks;
  }

  it("a fully populated tender turns EVERY check on (impossible under the old hardcoded-false literals)", () => {
    const groups = deriveStageIntelligenceChecks(fullyPopulatedTender());
    for (const group of groups) {
      for (const check of group.checks) {
        expect(check.done, `${group.stage} → ${check.label}`).toBe(true);
      }
    }
  });

  it("B16: solution-design checks read the REAL writer keys (configuration/hop/ham/hip/scope_matrix/sla_kpi)", () => {
    const legacyKeysOnly = {
      solutionDesignData: {
        solution_configuration: { selected_modules: "X" },
        hop_operations_model: { warehouse: {} },
        ham_manpower_model: {},
        hip_systems_ip_model: {},
        sla_kpi_model: {},
      },
    };
    const groups = deriveStageIntelligenceChecks(legacyKeysOnly);
    const sd = checksFor(groups, "Solution Design");
    // Keys no writer ever stored do not light checks up…
    expect(sd.every(c => !c.done)).toBe(true);
    // …and the real keys do.
    const realKeys = deriveStageIntelligenceChecks({ solutionDesignData: { configuration: { selected_modules: "X" }, hop: { warehouse: { storage_required: "Yes" } } } });
    const sdReal = checksFor(realKeys, "Solution Design");
    expect(sdReal.find(c => c.label === "Solution configured")?.done).toBe(true);
    expect(sdReal.find(c => c.label === "Operations model set")?.done).toBe(true);
    expect(sdReal.find(c => c.label === "Scope matrix completed")?.done).toBe(false);
  });

  it("B15: P&L checks derive from the stored pricing sections, not literals", () => {
    const groups = deriveStageIntelligenceChecks({
      pricingData: {
        pnl_snapshot: { snapshot_status: "No Snapshot" },
        scenarios: { rows: [{ scenario_name: "Base" }] },
        approval: { summary: { approval_status: "Not Submitted" } },
      },
    });
    const pnl = checksFor(groups, "P&L Pricing");
    expect(pnl.find(c => c.label === "Pricing scenarios defined")?.done).toBe(true);
    expect(pnl.find(c => c.label === "P&L snapshot recorded")?.done).toBe(false);
    expect(pnl.find(c => c.label.startsWith("Pricing approval"))?.done).toBe(false);
  });

  it("B15/P6: internal-review checks derive from per-block statuses (no phantom facet, no hardcoded false)", () => {
    const groups = deriveStageIntelligenceChecks({
      tenderDraftingData: {
        proposal_blocks: [
          { id: "b1", volume: "Technical", ops_status: "Approved", legal_status: "Approved", editor_content: "x".repeat(60) },
          { id: "b2", volume: "Commercial", finance_status: "Pending", legal_status: "Approved", editor_content: "x".repeat(60) },
        ],
      },
    });
    const review = checksFor(groups, "Internal Review");
    expect(review.find(c => c.label.startsWith("Ops review"))?.done).toBe(true);
    expect(review.find(c => c.label.startsWith("Finance review"))?.done).toBe(false);
    expect(review.find(c => c.label.startsWith("Legal review"))?.done).toBe(true);
    expect(review.find(c => c.label.startsWith("No rejected"))?.done).toBe(true);
  });

  it("approval-matrix checks read the CANONICAL location and fall back to legacy", () => {
    const canonical = deriveStageIntelligenceChecks({
      typeDetails: { approval_matrix: { approvals: [{ id: "a1", role: "ceo", decision: "approved" }] } },
    });
    expect(checksFor(canonical, "Approval Matrix").find(c => c.label === "Approval participants recorded")?.done).toBe(true);

    const legacy = deriveStageIntelligenceChecks({
      typeDetails: { tender_drafting: { approval_matrix: { approvals: [{ id: "a1", role: "ceo", decision: "pending" }] } } },
    });
    const legacyChecks = checksFor(legacy, "Approval Matrix");
    expect(legacyChecks.find(c => c.label === "Approval participants recorded")?.done).toBe(true);
    expect(legacyChecks.find(c => c.label === "No pending decisions")?.done).toBe(false);
  });
});
