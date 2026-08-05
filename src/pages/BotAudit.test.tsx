/**
 * BotAudit.test.tsx — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Defect F: the five stat tiles were computed over the whole `invocations`
 * array while the list beneath them rendered `filteredInvocations`. Applying a
 * filter left "Recorded Rows 7 · Total Cost $1.234" sitting above two rows.
 * One figure per meaning, computed over the set actually rendered.
 *
 * No DOM test environment exists in this package, so the page's filter and its
 * summary are exported as pure functions and asserted against one another.
 */
import { describe, expect, it } from "vitest";
import type { AiUsageLogRecord } from "@/lib/ops-runtime";
import { filterInvocations, summariseInvocations } from "./BotAudit";

function row(over: Partial<AiUsageLogRecord>): AiUsageLogRecord {
  return {
    id: "r-1",
    botId: "bot-a",
    botName: "Proposal Drafter",
    userId: "u-1",
    userName: "Stored User",
    provider: "openai",
    model: "gpt-4o",
    action: "draft_block",
    status: "success",
    errorMessage: null,
    costUsd: null,
    latencyMs: null,
    tokensInput: null,
    tokensOutput: null,
    workspaceId: null,
    humanAction: null,
    createdAt: "2026-03-04T10:00:00.000Z",
    ...over,
  };
}

const rows: AiUsageLogRecord[] = [
  row({ id: "r-1", botId: "bot-a", status: "success", costUsd: 1, latencyMs: 100, humanAction: "apply" }),
  row({ id: "r-2", botId: "bot-a", status: "error", costUsd: 3, latencyMs: 300, errorMessage: "boom" }),
  row({ id: "r-3", botId: "bot-b", status: "success", costUsd: 10, latencyMs: 900, humanAction: "discard" }),
  row({ id: "r-4", botId: "bot-b", status: "success", costUsd: null, latencyMs: null }),
];

const NO_FILTER = { searchQuery: "", botFilter: "all", statusFilter: "all" };

describe("summariseInvocations — defect F", () => {
  it("summarises exactly the rows the list renders when a bot filter is applied", () => {
    const shown = filterInvocations(rows, { ...NO_FILTER, botFilter: "bot-a" });
    const stats = summariseInvocations(shown);

    expect(shown.map(r => r.id)).toEqual(["r-1", "r-2"]);
    expect(stats.shown).toBe(shown.length);
    // Not 14: bot-b's cost is not part of the figure shown above bot-a's rows.
    expect(stats.cost.total).toBe(4);
    expect(stats.latency.average).toBe(200);
    expect(stats.humanActions).toBe(1);
  });

  it("summarises exactly the rows the list renders when a status filter is applied", () => {
    const shown = filterInvocations(rows, { ...NO_FILTER, statusFilter: "error" });
    const stats = summariseInvocations(shown);
    expect(shown.map(r => r.id)).toEqual(["r-2"]);
    expect(stats.shown).toBe(1);
    expect(stats.cost.total).toBe(3);
    expect(stats.humanActions).toBe(0);
  });

  it("covers the whole read set when no filter is applied", () => {
    const shown = filterInvocations(rows, NO_FILTER);
    const stats = summariseInvocations(shown);
    expect(stats.shown).toBe(rows.length);
    expect(stats.cost.total).toBe(14);
    expect(stats.humanActions).toBe(2);
  });

  it("reports an all-unrecorded column as unrecorded, never as zero", () => {
    const shown = filterInvocations([row({ id: "r-9", costUsd: null, latencyMs: null })], NO_FILTER);
    const stats = summariseInvocations(shown);
    expect(stats.shown).toBe(1);
    expect(stats.cost.total).toBeNull();
    expect(stats.latency.average).toBeNull();
    expect(stats.cost.recordedCount).toBe(0);
  });

  it("counts only recorded values in the 'n of m shown rows' sub-label", () => {
    const shown = filterInvocations(rows, { ...NO_FILTER, botFilter: "bot-b" });
    const stats = summariseInvocations(shown);
    expect(stats.shown).toBe(2);
    // r-4 records no cost, so the sub-label reads "1 of 2 shown rows".
    expect(stats.cost.recordedCount).toBe(1);
  });

  it("a search narrows the list and the figures together", () => {
    const shown = filterInvocations(rows, { ...NO_FILTER, searchQuery: "boom" });
    expect(shown.map(r => r.id)).toEqual(["r-2"]);
    expect(summariseInvocations(shown).shown).toBe(1);
  });

  it("an empty or whitespace search does not exclude anything", () => {
    expect(filterInvocations(rows, { ...NO_FILTER, searchQuery: "   " })).toHaveLength(rows.length);
  });
});
