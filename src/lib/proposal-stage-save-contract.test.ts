import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkspaceData } from "@/components/proposal-workspace/proposal-workspace-state";
import {
  extractDiscoveryStageData,
  extractPnlPricingStageData,
  extractProposalCommercialApprovalStageData,
  extractProposalContractSignedStageData,
  extractProposalDraftingStageData,
  extractProposalGoLiveStageData,
  extractProposalNegotiationStageData,
  extractProposalSentStageData,
  extractQualifiedStageData,
  extractQuoteStageData,
  extractSolutionDesignStageData,
  saveProposalCommercialApprovalStageData,
  saveProposalContractSignedStageData,
  saveProposalDiscoveryStageData,
  saveProposalDraftingStageData,
  saveProposalGoLiveStageData,
  saveProposalNegotiationStageData,
  saveProposalPnlPricingStageData,
  saveProposalQualifiedStageData,
  saveProposalQuoteStageData,
  saveProposalSentStageData,
  saveProposalSolutionDesignStageData,
} from "@/lib/proposal-workspace-persistence";

const state = vi.hoisted(() => ({
  row: {} as Record<string, any>,
  calls: [] as Array<{ table: string; op: string; payload?: any; filters: Array<[string, any]>; projection?: string }>,
  auditError: null as { message: string } | null,
}));

vi.mock("@/lib/supabase", () => {
  const project = (row: Record<string, any>, projection?: string) => {
    if (!projection) return { ...row };
    return Object.fromEntries(projection.split(",").map(key => key.trim()).filter(key => key in row).map(key => [key, row[key]]));
  };
  const builderFor = (table: string) => {
    const call = { table, op: "select", filters: [] as Array<[string, any]> } as any;
    state.calls.push(call);
    const builder: any = {
      select(projection?: string) { call.projection = projection; return builder; },
      update(payload: any) { call.op = "update"; call.payload = payload; return builder; },
      insert(payload: any) { call.op = "insert"; call.payload = payload; return builder; },
      eq(column: string, value: any) { call.filters.push([column, value]); return builder; },
      maybeSingle: async () => {
        if (call.op === "insert") return state.auditError ? { data: null, error: state.auditError } : { data: { id: "audit-1" }, error: null };
        const matches = call.filters.every(([column, value]: [string, any]) => state.row[column] === value);
        if (!matches) return { data: null, error: null };
        if (call.op === "update") {
          Object.assign(state.row, call.payload, { updated_at: "2026-08-24T20:00:01.000Z" });
        }
        return { data: project(state.row, call.projection), error: null };
      },
    };
    return builder;
  };
  return { supabase: { from: builderFor } };
});

const ticketId = "proposal-closure-test";
const revision = "2026-08-24T20:00:00.000Z";

beforeEach(() => {
  state.row = {
    id: ticketId,
    ticket_type: "proposal",
    active: true,
    updated_at: revision,
    type_details: { unrelated_truth: { keep: true }, proposal_workspace: {} },
  };
  state.calls.length = 0;
  state.auditError = null;
});

const base = createDefaultWorkspaceData();
const contracts = [
  ["qualified", extractQualifiedStageData, saveProposalQualifiedStageData],
  ["discovery", extractDiscoveryStageData, saveProposalDiscoveryStageData],
  ["solution_design", extractSolutionDesignStageData, saveProposalSolutionDesignStageData],
  ["pnl_pricing", extractPnlPricingStageData, saveProposalPnlPricingStageData],
  ["quote", extractQuoteStageData, saveProposalQuoteStageData],
  ["proposal_drafting", extractProposalDraftingStageData, saveProposalDraftingStageData],
  ["proposal_sent", extractProposalSentStageData, saveProposalSentStageData],
  ["negotiation", extractProposalNegotiationStageData, saveProposalNegotiationStageData],
  ["commercial_approval", extractProposalCommercialApprovalStageData, saveProposalCommercialApprovalStageData],
  ["contract_signed", extractProposalContractSignedStageData, saveProposalContractSignedStageData],
  ["go_live", extractProposalGoLiveStageData, saveProposalGoLiveStageData],
] as const;

describe("all 11 Proposal stage save contracts", () => {
  it.each(contracts)("%s uses exact identity/revision, preserves other truth, reads back, and audits", async (key, extract, save) => {
    const result = await (save as any)(ticketId, extract(base), { expectedRevision: revision, actorName: "Amin" });

    expect(result.revision).toBe("2026-08-24T20:00:01.000Z");
    expect(result.auditWritten).toBe(true);
    expect(state.row.type_details.unrelated_truth).toEqual({ keep: true });
    expect(state.row.type_details.proposal_workspace[key]).toEqual(expect.objectContaining({ data: expect.any(Object), savedAt: expect.any(String) }));
    const update = state.calls.find(call => call.op === "update")!;
    expect(update.filters).toEqual(expect.arrayContaining([
      ["id", ticketId], ["updated_at", revision],
    ]));
    expect(update.filters).not.toEqual(expect.arrayContaining([
      ["ticket_type", "proposal"],
    ]));
    expect(update.filters).not.toEqual(expect.arrayContaining([
      ["active", true],
    ]));
    const audit = state.calls.find(call => call.table === "commercial_ticket_audit")!;
    expect(audit.payload).toEqual(expect.objectContaining({
      ticket_id: ticketId,
      field_changed: `type_details.proposal_workspace.${key}`,
      user_name: "Amin",
    }));
  });

  it("rejects a stale screen without changing the row or writing an audit", async () => {
    const result = await saveProposalQualifiedStageData(ticketId, extractQualifiedStageData(base), {
      expectedRevision: "older-revision",
      actorName: "Amin",
    }).catch(error => error as Error);

    expect(result).toBeInstanceOf(Error);
    if (!(result instanceof Error)) throw new Error("Expected the stale save to fail.");
    expect(result.message).toMatch(/changed after the workspace loaded/i);
    expect(state.calls.some(call => call.op === "update")).toBe(false);
    expect(state.calls.some(call => call.table === "commercial_ticket_audit")).toBe(false);
  });

  it("reports an audit warning after a confirmed data save", async () => {
    state.auditError = { message: "audit write refused" };
    const result = await saveProposalQualifiedStageData(ticketId, extractQualifiedStageData(base), {
      expectedRevision: revision,
      actorName: "Amin",
    });
    expect(result.auditWritten).toBe(false);
    expect(result.auditWarning).toMatch(/audit write refused/i);
    expect(state.row.type_details.proposal_workspace.qualified).toBeTruthy();
  });
});
