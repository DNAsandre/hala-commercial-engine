import { describe, expect, it } from "vitest";
import { validateManifest } from "./manifest-types";
import { TENDER_MANIFEST, TENDER_STAGES } from "./tender-manifest";

describe("Tender destination manifest", () => {
  it("passes the canonical manifest validator", () => {
    expect(validateManifest(TENDER_MANIFEST)).toEqual([]);
  });

  it("covers all 15 Tender stages with at least one real destination", () => {
    expect(TENDER_MANIFEST.stages).toEqual(TENDER_STAGES);
    expect(new Set(TENDER_MANIFEST.fields.map(field => field.stage))).toEqual(new Set(TENDER_STAGES));
    expect(TENDER_STAGES).toHaveLength(15);
  });

  it("gives every repeated destination a stable content identity", () => {
    const repeated = TENDER_MANIFEST.fields.filter(field => field.persistencePath.includes("[]"));
    expect(repeated.length).toBeGreaterThan(100);
    for (const field of repeated) {
      expect(field.rowIdentity?.fingerprintFields.length, field.id).toBeGreaterThan(0);
      expect(field.rowIdentity?.fingerprintFields).not.toContain("id");
    }
  });

  it("contains representative persisted destinations from every stage", () => {
    const ids = new Set(TENDER_MANIFEST.fields.map(field => field.id));
    const expected = [
      "t:sow_data.transport.lanes[].origin",
      "t:risk_snapshot_data.register[].severity",
      "t:bid_no_bid_data.win_strategy.win_themes[].hala_proof",
      "t:solution_design_data.hop.transport.lanes[].destination",
      "t:pricing.scenarios.rows[].gp_percent",
      "t:tender_drafting.proposal_blocks[].editor_content",
      "t:tender_drafting.proposal_blocks[].ops_status",
      "t:approval_matrix.approvals[].decision",
      "t:submission_readiness.required_documents[].linked_document_id",
      "t:submission.submission_record.receipt_confirmed",
      "t:clarification.qa_log[].question",
      "t:client_evaluation.client_clarifications.rows[].response_summary",
      "t:negotiation_data.revised_terms.terms[].revised_term",
      "t:awarded_data.contract_prep.checklist.contract_signed",
      "t:lost_withdrawn_data.lessons_learned.lessons[].recommendation",
    ];
    for (const id of expected) expect(ids.has(id), id).toBe(true);
  });

  it("does not expose CRM/internal trackers, AI fields, bots, or generated row ids", () => {
    const paths = TENDER_MANIFEST.fields.map(field => field.persistencePath);
    for (const path of paths) {
      expect(path).not.toMatch(/(^|\.)(crm_pipeline_stage|internal_stage)(\.|$)/);
      expect(path).not.toMatch(/(^|\.)(ai_flags|ai_suggestions|bot_id|is_canon_locked)(\.|$)/);
      expect(path).not.toMatch(/\[\]\.id$/);
    }
  });

  it("uses canonical ids that exactly mirror persistence paths", () => {
    const ids = new Set<string>();
    for (const field of TENDER_MANIFEST.fields) {
      expect(field.id).toBe(`t:${field.persistencePath}`);
      expect(ids.has(field.id), field.id).toBe(false);
      ids.add(field.id);
    }
  });

  it("matches the Tender calculator's descriptive snapshot fields", () => {
    const byPath = new Map(TENDER_MANIFEST.fields.map(field => [field.persistencePath, field]));
    expect(byPath.get("pricing.pnl_snapshot.snapshots[].summary.gp_percent")?.type).toBe("percent");
    expect(byPath.get("pricing.pnl_snapshot.snapshots[].summary.target_gp_percent")?.type).toBe("text");
    expect(byPath.get("pricing.pnl_snapshot.snapshots[].summary.variance_to_target")?.type).toBe("text");
  });
});
