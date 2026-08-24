/**
 * FinalApprovedStage.checklist.test.ts — TCW-T4 (B17/B18/F4, P6, F2)
 *
 * The Stage-9 submission checklist derives ONLY from the tender's recorded
 * required-documents register:
 *  - no recorded register ⇒ the honest "no requirement set recorded" state —
 *    never a substituted template list;
 *  - matching is register status, exact linked-document id, or FULL-name
 *    containment — never a first-word/prefix fuzzy match (guard test);
 *  - 'na' rows sit outside both counters; missing can never go negative.
 *
 * Departmental review truth (P6) derives from the per-block `<dept>_status`
 * fields updateBlockReviewStatus actually writes — the orphan
 * `tender_drafting.departmental_reviews` facet plays no part.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  buildFinalApprovalRecordPayload,
  buildSubmissionChecklist,
  deriveDepartmentalReviewProgress,
  readRequiredDocumentsRegister,
} from "@/components/tender/FinalApprovedStage";

const doc = (id: string, name: string, document_category?: string) => ({ id, document_name: name, document_category });

describe("readRequiredDocumentsRegister", () => {
  it("reads the canonical submission_readiness.required_documents rows", () => {
    const rows = readRequiredDocumentsRegister({
      submission_readiness: {
        required_documents: [
          { id: "rd-1", document_name: "Commercial Registration", status: "missing", updated_at: "", updated_by: "" },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].document_name).toBe("Commercial Registration");
  });

  it("returns an empty register when nothing is recorded — never a substitute list", () => {
    expect(readRequiredDocumentsRegister({})).toEqual([]);
    expect(readRequiredDocumentsRegister({ submission_readiness: {} })).toEqual([]);
  });
});

describe("buildSubmissionChecklist (register-driven, B17/B18/F4)", () => {
  it("empty register ⇒ recorded:false with zero counters (honest empty state)", () => {
    const summary = buildSubmissionChecklist([], [doc("d1", "anything.pdf")]);
    expect(summary.recorded).toBe(false);
    expect(summary.rows).toHaveLength(0);
    expect(summary.required).toBe(0);
    expect(summary.satisfied).toBe(0);
    expect(summary.missing).toBe(0);
  });

  it("register status uploaded/approved satisfies by itself", () => {
    const summary = buildSubmissionChecklist(
      [
        { id: "r1", document_name: "VAT Certificate", status: "uploaded" },
        { id: "r2", document_name: "ISO Certificates", status: "approved" },
        { id: "r3", document_name: "Insurance Certificates", status: "missing" },
      ],
      [],
    );
    expect(summary.recorded).toBe(true);
    expect(summary.required).toBe(3);
    expect(summary.satisfied).toBe(2);
    expect(summary.missing).toBe(1);
    expect(summary.rows.find(r => r.id === "r1")?.satisfiedBy).toBe("status");
  });

  it("an exact linked_document_id match satisfies the requirement", () => {
    const summary = buildSubmissionChecklist(
      [{ id: "r1", document_name: "Performance Guarantee Confirmation", status: "missing", linked_document_id: "doc-77" }],
      [doc("doc-77", "guarantee-final-v2.pdf")],
    );
    expect(summary.satisfied).toBe(1);
    expect(summary.rows[0].satisfiedBy).toBe("linked_document");
  });

  it("an archived document cannot satisfy readiness by id or name", () => {
    const summary = buildSubmissionChecklist(
      [{ id: "r1", document_name: "Performance Guarantee Confirmation", status: "missing", linked_document_id: "doc-77" }],
      [doc("doc-77", "Performance Guarantee Confirmation.pdf", "Archived")],
    );
    expect(summary.satisfied).toBe(0);
    expect(summary.rows[0].satisfiedBy).toBeNull();
  });

  it("FULL-name containment satisfies; the whole recorded name must appear", () => {
    const summary = buildSubmissionChecklist(
      [{ id: "r1", document_name: "Commercial Registration", status: "missing" }],
      [doc("d1", "Hala Commercial Registration 2026 (signed).pdf")],
    );
    expect(summary.satisfied).toBe(1);
    expect(summary.rows[0].satisfiedBy).toBe("name_match");
  });

  it("GUARD (B18): a first-word/prefix match must NOT satisfy a requirement", () => {
    // The pre-wave code marked "OBK Signed/Stamped PDF" as Uploaded because an
    // uploaded name merely contained the FIRST WORD "obk". Reintroducing that
    // heuristic makes this named test fail.
    const summary = buildSubmissionChecklist(
      [{ id: "r1", document_name: "OBK Signed/Stamped PDF", status: "missing" }],
      [doc("d1", "obk-working-notes.xlsx")],
    );
    expect(summary.satisfied).toBe(0);
    expect(summary.rows[0].satisfied).toBe(false);
    expect(summary.rows[0].satisfiedBy).toBeNull();
  });

  it("'na' rows are excluded from BOTH counters and missing never goes negative", () => {
    const summary = buildSubmissionChecklist(
      [
        { id: "r1", document_name: "Transition Plan", status: "na" },
        { id: "r2", document_name: "Compliance Pack", status: "uploaded" },
      ],
      [],
    );
    expect(summary.required).toBe(1);
    expect(summary.satisfied).toBe(1);
    expect(summary.missing).toBe(0);
    // All rows still render (na row visible with its own status).
    expect(summary.rows).toHaveLength(2);
    expect(summary.missing).toBeGreaterThanOrEqual(0);
  });
});

describe("deriveDepartmentalReviewProgress (P6 — per-block truth, no phantom facet)", () => {
  const block = (volume: string, statuses: Record<string, string> = {}) => ({ id: `b-${volume}-${JSON.stringify(statuses)}`, volume, ...statuses });

  it("no blocks ⇒ nothing reviewed, nothing decided", () => {
    const progress = deriveDepartmentalReviewProgress([]);
    expect(progress.hasBlocks).toBe(false);
    expect(progress.anyDecision).toBe(false);
    expect(progress.fullyReviewed).toEqual([]);
    expect(progress.rejectedCount).toBe(0);
  });

  it("a department with NO relevant blocks is never counted as fully reviewed (vacuous truth rejected)", () => {
    // Only Commercial blocks ⇒ ops (Technical/Shared) has no scope; even with
    // zero pending it must not appear fully reviewed.
    const progress = deriveDepartmentalReviewProgress([
      block("Commercial", { finance_status: "Approved", legal_status: "Approved" }),
    ]);
    expect(progress.fullyReviewed).toContain("finance");
    expect(progress.fullyReviewed).toContain("legal");
    expect(progress.fullyReviewed).not.toContain("ops");
  });

  it("pending blocks keep the department out of fullyReviewed; rejected pairs are counted", () => {
    const progress = deriveDepartmentalReviewProgress([
      block("Technical", { ops_status: "Approved", legal_status: "Rejected" }),
      block("Shared", { ops_status: "Pending", finance_status: "Approved", legal_status: "Approved" }),
    ]);
    expect(progress.anyDecision).toBe(true);
    expect(progress.fullyReviewed).not.toContain("ops"); // one Shared block still pending
    expect(progress.fullyReviewed).toContain("finance"); // its only relevant block decided
    expect(progress.rejectedCount).toBe(1);
  });

  it("the orphan departmental_reviews facet is irrelevant — only block statuses drive the result", () => {
    // Simulates the pre-fix world: a facet claiming submissions exists nowhere
    // on the blocks; the derivation must not consult it (it only receives the
    // block list, so a tender with undecided blocks reports none reviewed).
    const progress = deriveDepartmentalReviewProgress([
      block("Technical", {}), block("Commercial", {}),
    ]);
    expect(progress.fullyReviewed).toEqual([]);
    expect(progress.anyDecision).toBe(false);
  });
});

describe("buildFinalApprovalRecordPayload (P4/F2 actor truth)", () => {
  it("records the SESSION user name passed in — never the fabricated literal", () => {
    const payload = buildFinalApprovalRecordPayload(
      { decision: "approved", approved_by: "CEO", approved_at: "2026-08-19T10:00", reference: "board minutes", notes: "" },
      "Amina Al-Rashid",
      "2026-08-20T08:00:00.000Z",
    );
    expect(payload.recorded_by).toBe("Amina Al-Rashid");
    expect(payload.recorded_by).not.toBe("Current User");
    expect(payload.recorded_at).toBe("2026-08-20T08:00:00.000Z");
    expect(payload.approved_at).toBe(new Date("2026-08-19T10:00").toISOString());
  });

  it("a signed-out session records the auth module's honest literal verbatim (no substitution)", () => {
    const payload = buildFinalApprovalRecordPayload(
      { decision: "pending", approved_by: "", approved_at: "", reference: "", notes: "" },
      "Unauthenticated",
    );
    expect(payload.recorded_by).toBe("Unauthenticated");
    expect(payload.approved_at).toBe("");
  });
});
