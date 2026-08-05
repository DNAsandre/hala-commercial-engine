/**
 * ProposalStageWorkbench.test.ts — SC-01 Wave 04 (T08-B)
 *
 * The workbench aggregates documents across every scope id that belongs to the
 * ACTIVE proposal. Two things must survive that aggregation:
 *   - a truncation declared by the server for ANY scope, so a partial list is
 *     never presented as the whole scope (Wave 03 obs 9);
 *   - a read failure, which must propagate as a rejection so the caller can
 *     hold it on screen instead of rendering an empty list (Wave 03 obs 10).
 *
 * The scope ids sent to the server are asserted, because a document list read
 * for a different proposal is a cross-contamination defect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveProposalIdentity } from "@/lib/proposal-identity";

const runtime = vi.hoisted(() => ({
  pages: new Map<string, { rows: any[]; limit: number | null; truncated: boolean }>(),
  failures: new Map<string, Error>(),
  requested: [] as string[],
}));

vi.mock("@/lib/document-runtime", () => ({
  listScopeDocumentsPageFromCleanServer: async (scopeId: string) => {
    runtime.requested.push(scopeId);
    const failure = runtime.failures.get(scopeId);
    if (failure) throw failure;
    return runtime.pages.get(scopeId) ?? { rows: [], limit: null, truncated: false };
  },
}));

import { fetchProposalStageDocuments } from "@/components/proposal-workspace/ProposalStageWorkbench";

const IDENTITY: ActiveProposalIdentity = {
  proposalId: "a1100000-0000-4000-8000-000000000040",
  routeId: "a1100000-0000-4000-8000-000000000040",
  workspaceId: "a1100000-0000-4000-8000-000000000040",
  customerId: "cust-1",
  customerName: "UAT Customer",
  title: "[HALA-UAT-ARV2] Warehousing and Transport Proposal",
  crmOpportunityId: "a1100000-0000-4000-8000-000000000040",
  source: "crm_ticket",
};

/** A row shaped the way the workbench recognises a proposal document. */
function documentRow(id: string, workspaceId: string) {
  return {
    id,
    file_name: `${id}.pdf`,
    workspace_id: workspaceId,
    document_type: "Customer Requirement",
    generated_at: "2026-07-13T00:00:00.000Z",
    generated_by_name: "QA Runner",
    version_number: 1,
    notes: `HALA_PROPOSAL_DOCUMENT_META:${JSON.stringify({
      linkedStage: "qualified",
      linkedTab: "supporting_docs",
      usedInPricing: false,
      usedInProposal: false,
    })}`,
  };
}

beforeEach(() => {
  runtime.pages.clear();
  runtime.failures.clear();
  runtime.requested.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchProposalStageDocuments", () => {
  it("reads only the scope ids of the active proposal", async () => {
    await fetchProposalStageDocuments(IDENTITY, "a1100000-0000-4000-8000-000000000040");

    expect(runtime.requested).toEqual(["a1100000-0000-4000-8000-000000000040"]);
  });

  it("returns the mapped documents with no truncation claim when the server declared none", async () => {
    runtime.pages.set(IDENTITY.proposalId, {
      rows: [documentRow("doc-1", IDENTITY.proposalId)],
      limit: 200,
      truncated: false,
    });

    const result = await fetchProposalStageDocuments(IDENTITY, IDENTITY.proposalId);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].fileName).toBe("doc-1.pdf");
    expect(result.documents[0].proposalId).toBe(IDENTITY.proposalId);
    expect(result.truncated).toBe(false);
  });

  it("propagates truncation declared for ANY scope, with the server's cap", async () => {
    const identity = { ...IDENTITY, workspaceId: "ws-legacy-1" };
    runtime.pages.set(identity.proposalId, { rows: [documentRow("doc-1", identity.proposalId)], limit: 200, truncated: false });
    runtime.pages.set("ws-legacy-1", { rows: [documentRow("doc-2", "ws-legacy-1")], limit: 200, truncated: true });

    const result = await fetchProposalStageDocuments(identity, "ws-legacy-1");

    expect(runtime.requested).toEqual([identity.proposalId, "ws-legacy-1"]);
    expect(result.truncated).toBe(true);
    expect(result.limit).toBe(200);
    expect(result.documents).toHaveLength(2);
  });

  it("rejects on a failed read instead of returning an empty document set", async () => {
    runtime.failures.set(IDENTITY.proposalId, new Error("Clean document server not reachable"));

    await expect(fetchProposalStageDocuments(IDENTITY, IDENTITY.proposalId)).rejects.toThrow(
      /not reachable/i,
    );
  });
});
