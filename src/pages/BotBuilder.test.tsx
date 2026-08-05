/**
 * BotBuilder.test.tsx — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Defect E: stored data was read and then discarded.
 *
 *  - `ai_bot_versions.system_instruction` IS queried and mapped
 *    (ops-runtime AI_BOT_VERSIONS_COLUMNS / mapBotVersionRow) and the page then
 *    displayed a page-level constant in its place, so the stored instruction
 *    never reached the screen.
 *  - The domain badges were rendered from a fixed page list that omitted
 *    `pdf_studio`, so a bot scoped to that domain showed zero badges while the
 *    sidebar stated "Domains: 1 recorded".
 *
 * `deriveBotBuilderView` is the single mapping from the stored record to what
 * the page displays, so both can be asserted without a DOM.
 */
import { describe, expect, it } from "vitest";
import type { AiBotRecord, AiBotVersionRecord, BotConfigurationRead } from "@/lib/ops-runtime";
import { deriveBotBuilderView } from "./BotBuilder";

const bot: AiBotRecord = {
  id: "bot-1",
  name: "Cover Page Writer",
  type: "action",
  status: "active",
  purpose: "Drafts cover pages",
  domainsAllowed: ["pdf_studio"],
  regionsAllowed: ["East"],
  rolesAllowed: ["admin", "sales"],
  currentVersionId: "v-2",
  providerId: "prov-openai",
  model: "gpt-4o",
  rateLimit: null,
  costCap: null,
  timeoutSec: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

function version(over: Partial<AiBotVersionRecord>): AiBotVersionRecord {
  return {
    id: "v-2",
    botId: "bot-1",
    version: 2,
    systemInstruction: null,
    customInstruction: null,
    safetyRules: null,
    temperature: null,
    maxTokens: null,
    knowledgeBaseIds: [],
    connectorSnapshot: null,
    chainConfig: null,
    changeNote: "",
    createdAt: "2026-02-01T00:00:00.000Z",
    createdBy: "stored-user",
    ...over,
  };
}

describe("deriveBotBuilderView — defect E", () => {
  it("carries the STORED system instruction through to the page", () => {
    const stored = "STORED INSTRUCTION: only draft cover pages for KAFD proposals.";
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [version({ systemInstruction: stored })],
    };

    const view = deriveBotBuilderView(read)!;
    expect(view.systemInstruction).toBe(stored);
    // It must be the recorded text, not a page constant about Hala doctrine.
    expect(view.systemInstruction).not.toMatch(/You are a commercial assistant/);
  });

  it("says nothing is recorded rather than substituting a default", () => {
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [version({ systemInstruction: null })],
    };
    expect(deriveBotBuilderView(read)!.systemInstruction).toBeNull();

    const noVersions: BotConfigurationRead = { status: "loaded", bot, versions: [] };
    expect(deriveBotBuilderView(noVersions)!.systemInstruction).toBeNull();
  });

  it("takes the latest version row, which is the one the header names", () => {
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [
        version({ id: "v-2", version: 2, systemInstruction: "newest" }),
        version({ id: "v-1", version: 1, systemInstruction: "oldest" }),
      ],
    };
    expect(deriveBotBuilderView(read)!.systemInstruction).toBe("newest");
  });

  it("renders a recorded domain that no fixed page list contains", () => {
    const read: BotConfigurationRead = { status: "loaded", bot, versions: [] };
    const view = deriveBotBuilderView(read)!;
    // `pdf_studio` was absent from the page's DOMAINS constant, so it vanished.
    expect(view.domains).toEqual(["pdf_studio"]);
    // The sidebar count is derived from the same array the badges render, so
    // it can never claim a domain the reader cannot see.
    expect(view.domains.length).toBe(bot.domainsAllowed.length);
  });

  it("renders recorded regions and roles from the record too", () => {
    const scoped: AiBotRecord = {
      ...bot,
      regionsAllowed: ["Northern Borders"],
      rolesAllowed: ["tender_lead"],
    };
    const view = deriveBotBuilderView({ status: "loaded", bot: scoped, versions: [] })!;
    expect(view.regions).toEqual(["Northern Borders"]);
    expect(view.roles).toEqual(["tender_lead"]);
  });

  it("carries the other recorded version values without inventing defaults", () => {
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [version({ temperature: 0.2, maxTokens: 1200, knowledgeBaseIds: ["kb-1"] })],
    };
    const view = deriveBotBuilderView(read)!;
    expect(view.temperature).toBe(0.2);
    expect(view.maxTokens).toBe(1200);
    expect(view.knowledgeBaseIds).toEqual(["kb-1"]);

    const bare = deriveBotBuilderView({ status: "loaded", bot, versions: [version({})] })!;
    expect(bare.temperature).toBeNull();
    expect(bare.maxTokens).toBeNull();
  });

  it("derives nothing at all from a read that did not succeed", () => {
    expect(deriveBotBuilderView({ status: "not_found", bot: null, versions: [] })).toBeNull();
    expect(
      deriveBotBuilderView({ status: "error", bot: null, versions: [], error: "network down" }),
    ).toBeNull();
  });
});
