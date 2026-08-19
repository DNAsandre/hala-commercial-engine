/**
 * Bots.test.tsx — SC-01 Wave 06, lane T15 (manifest rows B-02..B-06).
 *
 * The registry's write actions are thin, testable functions over the T13
 * bot-admin service. The rules pinned here are the page's law:
 *
 *  1. UI success requires a CONFIRMED service result — status "stored" for
 *     single writes, "completed" for multi-step operations. A resolved-but-
 *     zero-row write ("not_stored") or a failed operation is an ok:false
 *     outcome carrying the service's reason verbatim. The component applies
 *     outcomes as: ok → toast + re-read from the database; not ok → toast the
 *     reason and leave the rendered list untouched (no optimistic mutation
 *     exists to roll back).
 *  2. The exact service calls are asserted — the page must hit the service
 *     with the exact bot id and the exact target status, nothing else.
 *  3. Success language describes the DEFINITION record (stored
 *     configuration); it never claims a bot is running or was started
 *     (architect correction #5 — there is no invocation path in this build).
 *  4. Delete is offered only for draft/disabled definitions
 *     (BOT_DELETABLE_STATUSES — the real constant, not a copy), and archived
 *     definitions remain reachable through the status filter.
 *
 * No DOM test environment exists in this package, so the action logic is
 * exported from the page and asserted directly, with @/lib/bot-admin mocked
 * at module level.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiBotRecord } from "@/lib/ops-runtime";

const mocks = vi.hoisted(() => ({
  setBotStatus: vi.fn(),
  archiveBot: vi.fn(),
  duplicateBot: vi.fn(),
  deleteBot: vi.fn(),
}));

vi.mock("@/lib/bot-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bot-admin")>();
  return { ...actual, ...mocks };
});

import {
  canDeleteBot,
  filterBots,
  performArchiveBot,
  performBotStatusToggle,
  performDeleteBot,
  performDuplicateBot,
  toggleTargetStatus,
} from "./Bots";

function bot(over: Partial<AiBotRecord>): AiBotRecord {
  return {
    id: "bot-1",
    name: "Proposal Drafter",
    type: "action",
    status: "active",
    purpose: "Drafts proposals",
    domainsAllowed: ["proposals"],
    regionsAllowed: [],
    rolesAllowed: ["admin"],
    currentVersionId: "v-1",
    providerId: "aip-openai-001",
    model: "gpt-4o",
    rateLimit: null,
    costCap: null,
    timeoutSec: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  mocks.setBotStatus.mockReset();
  mocks.archiveBot.mockReset();
  mocks.duplicateBot.mockReset();
  mocks.deleteBot.mockReset();
});

describe("toggleTargetStatus (B-03)", () => {
  it("active toggles to disabled; anything else toggles to active", () => {
    expect(toggleTargetStatus("active")).toBe("disabled");
    expect(toggleTargetStatus("disabled")).toBe("active");
    expect(toggleTargetStatus("draft")).toBe("active");
  });
});

describe("performBotStatusToggle (B-03)", () => {
  it("writes the exact bot id and the exact target status through the service", async () => {
    mocks.setBotStatus.mockResolvedValue({ status: "stored", stored: { id: "bot-1", status: "disabled" } });
    const outcome = await performBotStatusToggle(bot({ status: "active" }));
    expect(mocks.setBotStatus).toHaveBeenCalledTimes(1);
    expect(mocks.setBotStatus).toHaveBeenCalledWith("bot-1", "disabled");
    expect(outcome.ok).toBe(true);
  });

  it("toggles a draft definition to active (old registry rule)", async () => {
    mocks.setBotStatus.mockResolvedValue({ status: "stored", stored: { id: "bot-1", status: "active" } });
    await performBotStatusToggle(bot({ status: "draft" }));
    expect(mocks.setBotStatus).toHaveBeenCalledWith("bot-1", "active");
  });

  it("GUARD B-03: a zero-row status change is a failure with the reason, never success", async () => {
    // PostgREST resolves without error when an update matches zero rows; the
    // service classifies that as not_stored, and the page must NOT render
    // success for it. The displayed status only ever changes after a
    // confirmed write followed by a re-read.
    mocks.setBotStatus.mockResolvedValue({
      status: "not_stored",
      error: 'The change was not stored: no "ai_bots" record with id "bot-1" was updated.',
    });
    const outcome = await performBotStatusToggle(bot({ status: "active" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("The change was not stored");
    expect(outcome.message).toContain("Proposal Drafter");
  });

  it("a rejected write surfaces the database's reason", async () => {
    mocks.setBotStatus.mockResolvedValue({ status: "error", error: "constraint violated" });
    const outcome = await performBotStatusToggle(bot({ status: "active" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("constraint violated");
  });

  it("success language describes the stored definition, never a running bot (correction #5)", async () => {
    mocks.setBotStatus.mockResolvedValue({ status: "stored", stored: { id: "bot-1", status: "active" } });
    const outcome = await performBotStatusToggle(bot({ status: "disabled" }));
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toContain('status "active"');
    expect(outcome.message).toContain("configuration");
    expect(outcome.message).toMatch(/no bot runs in this build/i);
    expect(outcome.message).not.toMatch(/\b(running|started|executing|live)\b/i);
  });
});

describe("performArchiveBot (B-04)", () => {
  it("archives through the service by exact id and reports confirmed storage", async () => {
    mocks.archiveBot.mockResolvedValue({ status: "stored", stored: { id: "bot-1", status: "archived" } });
    const outcome = await performArchiveBot(bot({}));
    expect(mocks.archiveBot).toHaveBeenCalledTimes(1);
    expect(mocks.archiveBot).toHaveBeenCalledWith("bot-1");
    expect(outcome.ok).toBe(true);
    // The archived record is findable, not vanished.
    expect(outcome.message).toContain('"Archived" status filter');
  });

  it("a zero-row archive is a failure with the reason", async () => {
    mocks.archiveBot.mockResolvedValue({ status: "not_stored", error: "The change was not stored: nothing matched." });
    const outcome = await performArchiveBot(bot({}));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("was not archived");
    expect(outcome.message).toContain("nothing matched");
  });
});

describe("performDuplicateBot (B-05)", () => {
  it("duplicates through the service and reports the confirmed copy", async () => {
    mocks.duplicateBot.mockResolvedValue({
      status: "completed",
      value: { botId: "bot-copy", name: "Proposal Drafter (Copy)", versionId: "v-copy", copiedVersion: true },
      steps: [],
    });
    const outcome = await performDuplicateBot(bot({}));
    expect(mocks.duplicateBot).toHaveBeenCalledTimes(1);
    expect(mocks.duplicateBot).toHaveBeenCalledWith("bot-1");
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toContain('Proposal Drafter (Copy)');
    expect(outcome.message).toContain("version row was copied");
  });

  it("states when the copy is definition-only because the source has no version", async () => {
    mocks.duplicateBot.mockResolvedValue({
      status: "completed",
      value: { botId: "bot-copy", name: "Proposal Drafter (Copy)", versionId: null, copiedVersion: false },
      steps: [],
    });
    const outcome = await performDuplicateBot(bot({}));
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toContain("no version row");
  });

  it("a failed duplication carries the service's exact reason (no local-only clone exists)", async () => {
    mocks.duplicateBot.mockResolvedValue({
      status: "failed",
      error: 'PARTIAL: the copied bot WAS created (id "bot-copy") but its version row was NOT.',
      steps: [],
    });
    const outcome = await performDuplicateBot(bot({}));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("was not duplicated");
    expect(outcome.message).toContain('PARTIAL: the copied bot WAS created');
  });
});

describe("performDeleteBot (B-06)", () => {
  it("deletes through the service by exact id and reports the confirmed removal", async () => {
    mocks.deleteBot.mockResolvedValue({
      status: "completed",
      value: { botId: "bot-1", deletedVersionCount: 2 },
      steps: [],
    });
    const outcome = await performDeleteBot(bot({ status: "draft" }));
    expect(mocks.deleteBot).toHaveBeenCalledTimes(1);
    expect(mocks.deleteBot).toHaveBeenCalledWith("bot-1");
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toContain("2 version row(s)");
  });

  it("a zero-row delete is an error carried verbatim, never success", async () => {
    mocks.deleteBot.mockResolvedValue({
      status: "failed",
      error: "PARTIAL: the 1 version row(s) WERE deleted but the bot-row delete matched nothing.",
      steps: [],
    });
    const outcome = await performDeleteBot(bot({ status: "draft" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("was not deleted");
    expect(outcome.message).toContain("delete matched nothing");
  });
});

describe("canDeleteBot (B-06 offer rule — real BOT_DELETABLE_STATUSES)", () => {
  it("offers delete only for draft and disabled definitions", () => {
    expect(canDeleteBot("draft")).toBe(true);
    expect(canDeleteBot("disabled")).toBe(true);
    expect(canDeleteBot("active")).toBe(false);
    expect(canDeleteBot("archived")).toBe(false);
    expect(canDeleteBot("")).toBe(false);
  });
});

describe("filterBots (B-02, B-04 archived visibility)", () => {
  const rows = [
    bot({ id: "b-1", name: "Alpha Drafter", type: "action", status: "active" }),
    bot({ id: "b-2", name: "Beta Monitor", type: "monitor", status: "draft" }),
    bot({ id: "b-3", name: "Gamma Drafter", type: "action", status: "archived" }),
  ];

  it("archived definitions appear under 'all' and under the 'archived' filter — not vanished", () => {
    expect(filterBots(rows, { searchQuery: "", typeFilter: "all", statusFilter: "all" }).map(b => b.id))
      .toEqual(["b-1", "b-2", "b-3"]);
    expect(filterBots(rows, { searchQuery: "", typeFilter: "all", statusFilter: "archived" }).map(b => b.id))
      .toEqual(["b-3"]);
  });

  it("filters by type and status over the rows that were read", () => {
    expect(filterBots(rows, { searchQuery: "", typeFilter: "monitor", statusFilter: "all" }).map(b => b.id))
      .toEqual(["b-2"]);
    expect(filterBots(rows, { searchQuery: "", typeFilter: "all", statusFilter: "active" }).map(b => b.id))
      .toEqual(["b-1"]);
  });

  it("searches by name, case-insensitively", () => {
    expect(filterBots(rows, { searchQuery: "gamma", typeFilter: "all", statusFilter: "all" }).map(b => b.id))
      .toEqual(["b-3"]);
  });
});
