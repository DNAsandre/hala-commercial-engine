/**
 * BotBuilder.test.tsx — SC-01 Wave 04 (lane T07-C) + Wave 06 (lane T15).
 *
 * WAVE 04 (kept, still binding) — defect E: stored data was read and then
 * discarded.
 *  - `ai_bot_versions.system_instruction` IS queried and mapped and the page
 *    then displayed a page-level constant in its place, so the stored
 *    instruction never reached the screen.
 *  - The domain badges were rendered from a fixed page list that omitted
 *    `pdf_studio`, so a bot scoped to that domain showed zero badges while the
 *    sidebar stated "Domains: 1 recorded".
 *
 * WAVE 06 (manifest rows B-14..B-19) — the builder writes through the T13
 * bot-admin service and the rules pinned here are:
 *  1. UI success requires status "completed" from the service. A failed or
 *     partial operation is an ok:false outcome carrying the service's reason
 *     verbatim — the page never fabricates success (GUARD tests).
 *  2. The exact service calls are asserted: createBot receives exactly the
 *     definition fields + version draft the form holds; publishBotVersion
 *     receives the exact bot id, fields and draft.
 *  3. Provider/model options derive from the LIVE ai_providers rows; recorded
 *     ids that match nothing render verbatim and are never silently remapped
 *     (live data: 34× "aip-openai-001", 2× legacy "prov-openai", 4× NULL).
 *  4. chain_config 'none' maps to null (stored as {}), a real chain maps to
 *     the full {next_bot_id, prompt_user, chain_label} object (B-18), and the
 *     recorded allowed_actions selection round-trips (B-17).
 *
 * The version fixtures carry the four fields T13 added to the version
 * projection (allowed_actions, provider_id, model, permission_snapshot).
 * No DOM test environment exists in this package, so the page's logic is
 * exported and asserted directly, with @/lib/bot-admin mocked at module level
 * (validateBotDefinition and every reader stay REAL via importOriginal).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiBotRecord, AiBotVersionRecord, AiProviderRecord, BotConfigurationRead } from "@/lib/ops-runtime";

const mocks = vi.hoisted(() => ({
  createBot: vi.fn(),
  publishBotVersion: vi.fn(),
  attachKnowledge: vi.fn(),
  detachKnowledge: vi.fn(),
}));

vi.mock("@/lib/bot-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bot-admin")>();
  return { ...actual, ...mocks };
});

import {
  buildDefinitionFields,
  buildVersionDraft,
  deriveBotBuilderView,
  deriveModelOptions,
  deriveProviderOptions,
  parseNumberInput,
  performAttachKnowledge,
  performDetachKnowledge,
  selectionUnion,
  submitCreateBot,
  submitPublishVersion,
  type BuilderFormState,
} from "./BotBuilder";

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
    // Wave 06: the four fields T13 added to AI_BOT_VERSIONS_COLUMNS.
    allowedActions: [],
    providerId: null,
    model: null,
    permissionSnapshot: null,
    knowledgeBaseIds: [],
    connectorSnapshot: null,
    chainConfig: null,
    changeNote: "",
    createdAt: "2026-02-01T00:00:00.000Z",
    createdBy: "stored-user",
    ...over,
  };
}

beforeEach(() => {
  mocks.createBot.mockReset();
  mocks.publishBotVersion.mockReset();
  mocks.attachKnowledge.mockReset();
  mocks.detachKnowledge.mockReset();
});

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

describe("deriveBotBuilderView — Wave 06 version fields (B-17/B-18/B-20)", () => {
  it("carries the recorded allowed_actions selection into the form (B-17)", () => {
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [version({ allowedActions: ["signal_event", "report_snapshot"] })],
    };
    expect(deriveBotBuilderView(read)!.allowedActions).toEqual(["signal_event", "report_snapshot"]);
  });

  it("an empty chain_config reads as 'none' — no chain is invented (B-18)", () => {
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [version({ chainConfig: {} })],
    };
    const view = deriveBotBuilderView(read)!;
    expect(view.chainNextBotId).toBe("none");
    expect(view.chainPromptUser).toBe(true);
    expect(view.chainLabel).toBe("");
  });

  it("a recorded chain reads back exactly (B-18)", () => {
    const read: BotConfigurationRead = {
      status: "loaded",
      bot,
      versions: [version({
        chainConfig: { next_bot_id: "bot-9", prompt_user: false, chain_label: "Auto-draft all blocks" },
      })],
    };
    const view = deriveBotBuilderView(read)!;
    expect(view.chainNextBotId).toBe("bot-9");
    expect(view.chainPromptUser).toBe(false);
    expect(view.chainLabel).toBe("Auto-draft all blocks");
  });

  it("carries the recorded connector snapshot verbatim, {} when none (B-20)", () => {
    const snapshot = { finance: true, ops: false };
    const withSnap: BotConfigurationRead = {
      status: "loaded", bot, versions: [version({ connectorSnapshot: snapshot })],
    };
    expect(deriveBotBuilderView(withSnap)!.connectorSnapshot).toEqual(snapshot);

    const without: BotConfigurationRead = { status: "loaded", bot, versions: [version({})] };
    expect(deriveBotBuilderView(without)!.connectorSnapshot).toEqual({});
  });
});

describe("selectionUnion — recorded values can never vanish from the form", () => {
  it("keeps vocabulary order and appends recorded extras", () => {
    expect(selectionUnion(["a", "b"], ["b", "pdf_studio"])).toEqual(["a", "b", "pdf_studio"]);
  });
  it("returns the vocabulary alone when nothing extra is recorded", () => {
    expect(selectionUnion(["a", "b"], [])).toEqual(["a", "b"]);
  });
});

// A complete, valid form the submit tests mutate per case.
function makeForm(over?: Partial<BuilderFormState>): BuilderFormState {
  return {
    name: "tender-summariser",
    displayName: "Tender Summariser",
    type: "action",
    purpose: "Summarises tender documents for human review",
    domains: ["tenders", "pdf_studio"],
    regions: ["East"],
    roles: ["admin"],
    providerId: "aip-openai-001",
    model: "gpt-4o",
    rateLimit: 20,
    costCap: 10,
    timeoutSec: 30,
    systemInstruction: "Summarise the tender.",
    customInstruction: "",
    safetyRules: "Never invent figures.",
    temperature: 0.2,
    maxTokens: 1200,
    allowedActions: ["suggest", "draft"],
    knowledgeBaseIds: ["kb-1"],
    connectorSnapshot: { finance: false },
    chainNextBotId: "none",
    chainPromptUser: true,
    chainLabel: "",
    changeNote: "Adjusted instruction",
    ...over,
  };
}

describe("buildDefinitionFields / buildVersionDraft — the exact stored shape", () => {
  it("maps the form onto the service's definition fields one-to-one", () => {
    const fields = buildDefinitionFields(makeForm());
    expect(fields).toEqual({
      name: "tender-summariser",
      displayName: "Tender Summariser",
      type: "action",
      purpose: "Summarises tender documents for human review",
      domainsAllowed: ["tenders", "pdf_studio"],
      regionsAllowed: ["East"],
      rolesAllowed: ["admin"],
      providerId: "aip-openai-001",
      model: "gpt-4o",
      rateLimit: 20,
      costCap: 10,
      timeoutSec: 30,
    });
  });

  it("records empty text as null — never as '' pretending to be content", () => {
    const draft = buildVersionDraft(makeForm({ systemInstruction: "  ", customInstruction: "", safetyRules: "" }));
    expect(draft.systemInstruction).toBeNull();
    expect(draft.customInstruction).toBeNull();
    expect(draft.safetyRules).toBeNull();
  });

  it("'none' chain maps to null (stored as {}), a real chain maps to the full object (B-18)", () => {
    expect(buildVersionDraft(makeForm({ chainNextBotId: "none" })).chainConfig).toBeNull();
    expect(
      buildVersionDraft(makeForm({
        chainNextBotId: "bot-9", chainPromptUser: false, chainLabel: "Run next",
      })).chainConfig,
    ).toEqual({ next_bot_id: "bot-9", prompt_user: false, chain_label: "Run next" });
  });

  it("writes the recorded selections: allowed_actions, knowledge ids, connector snapshot verbatim", () => {
    const draft = buildVersionDraft(makeForm());
    expect(draft.allowedActions).toEqual(["suggest", "draft"]);
    expect(draft.knowledgeBaseIds).toEqual(["kb-1"]);
    expect(draft.connectorSnapshot).toEqual({ finance: false });
  });

  it("snapshots the scope fields as the established permission_snapshot", () => {
    const draft = buildVersionDraft(makeForm());
    expect(draft.permissionSnapshot).toEqual({
      domainsAllowed: ["tenders", "pdf_studio"],
      regionsAllowed: ["East"],
      rolesAllowed: ["admin"],
    });
  });
});

describe("submitCreateBot (B-14)", () => {
  it("calls createBot with exactly the form's fields and version draft", async () => {
    mocks.createBot.mockResolvedValue({
      status: "completed",
      value: { botId: "bot-new", versionId: "v-new", version: 1 },
      steps: [],
    });
    const form = makeForm();
    const outcome = await submitCreateBot(form);
    expect(mocks.createBot).toHaveBeenCalledTimes(1);
    expect(mocks.createBot).toHaveBeenCalledWith({
      ...buildDefinitionFields(form),
      version: buildVersionDraft(form),
    });
    expect(outcome).toMatchObject({ ok: true, botId: "bot-new", versionNumber: 1 });
    expect(outcome.message).toContain("confirmed");
  });

  it("rejects an invalid form with the real validator's reasons and never calls the service", async () => {
    const outcome = await submitCreateBot(makeForm({ name: "", roles: [] }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("Bot name is required.");
    expect(outcome.message).toContain("At least one role must be selected.");
    expect(mocks.createBot).not.toHaveBeenCalled();
  });

  it("GUARD B-14: creation success comes ONLY from a completed service result", async () => {
    // A failed (including partial) operation must surface the service's exact
    // report — the page must not navigate to or announce a bot that the
    // database did not confirm.
    mocks.createBot.mockResolvedValue({
      status: "failed",
      error: 'PARTIAL: the bot record WAS created (id "bot-x") but its first version row was NOT.',
      steps: [],
    });
    const outcome = await submitCreateBot(makeForm());
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("PARTIAL: the bot record WAS created");
    expect("botId" in outcome).toBe(false);
  });
});

describe("submitPublishVersion (B-15)", () => {
  it("calls publishBotVersion with the exact bot id, fields and draft", async () => {
    mocks.publishBotVersion.mockResolvedValue({
      status: "completed",
      value: { botId: "bot-1", versionId: "v-3", version: 3 },
      steps: [],
    });
    const form = makeForm();
    const outcome = await submitPublishVersion("bot-1", form);
    expect(mocks.publishBotVersion).toHaveBeenCalledTimes(1);
    expect(mocks.publishBotVersion).toHaveBeenCalledWith(
      "bot-1",
      buildDefinitionFields(form),
      buildVersionDraft(form),
    );
    expect(outcome).toMatchObject({ ok: true, botId: "bot-1", versionNumber: 3 });
    // The repoint is part of the confirmed outcome the user is told about —
    // the old app's forgotten step (manifest B-15).
    expect(outcome.message).toContain("current_version_id repointed");
  });

  it("a failed publish carries the service's reason verbatim and no success", async () => {
    mocks.publishBotVersion.mockResolvedValue({
      status: "failed",
      error: "Nothing was published: A change note is required to publish a new version.",
      steps: [],
    });
    const outcome = await submitPublishVersion("bot-1", makeForm({ changeNote: "" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe("Nothing was published: A change note is required to publish a new version.");
  });
});

describe("attach/detach knowledge (B-19)", () => {
  it("attaches through the service with the exact ids and note", async () => {
    mocks.attachKnowledge.mockResolvedValue({
      status: "completed",
      value: { botId: "bot-1", versionId: "v-4", version: 4, knowledgeBaseIds: ["kb-1", "kb-2"] },
      steps: [],
    });
    const outcome = await performAttachKnowledge("bot-1", "kb-2", "Attach pricing KB");
    expect(mocks.attachKnowledge).toHaveBeenCalledTimes(1);
    expect(mocks.attachKnowledge).toHaveBeenCalledWith("bot-1", "kb-2", "Attach pricing KB");
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toContain("version 4");
  });

  it("detaches through the service and reports failure verbatim when not completed", async () => {
    mocks.detachKnowledge.mockResolvedValue({
      status: "failed",
      error: 'Nothing was detached: collection "kb-9" is not linked to this bot — no new version was published.',
      steps: [],
    });
    const outcome = await performDetachKnowledge("bot-1", "kb-9", "note");
    expect(mocks.detachKnowledge).toHaveBeenCalledWith("bot-1", "kb-9", "note");
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('collection "kb-9" is not linked');
  });
});

describe("provider/model options (B-16) — the live id mess is data", () => {
  const providers: AiProviderRecord[] = [
    {
      id: "aip-openai-001", name: "openai", displayName: "OpenAI",
      modelDefault: "gpt-4o", models: ["gpt-4o", "gpt-4o-mini"], enabled: true, config: {},
    },
    {
      id: "aip-google-001", name: "google", displayName: "Google",
      modelDefault: "gemini", models: ["gemini"], enabled: false, config: {},
    },
  ];

  it("offers every provider that was read, marking recorded-disabled ones as data", () => {
    const options = deriveProviderOptions(providers, "aip-openai-001");
    expect(options.map(o => o.value)).toEqual(["aip-openai-001", "aip-google-001"]);
    expect(options[1]!.label).toContain("(recorded disabled)");
  });

  it("renders a legacy unmatched id verbatim — never remapped, never 'undefined'", () => {
    const options = deriveProviderOptions(providers, "prov-openai");
    expect(options[0]).toEqual({
      value: "prov-openai",
      label: "prov-openai (recorded value — no matching provider record)",
      matched: false,
    });
    // The matched providers are still offered for an explicit human re-selection.
    expect(options.map(o => o.value)).toContain("aip-openai-001");
    expect(options.every(o => !o.label.includes("undefined"))).toBe(true);
  });

  it("a NULL provider id adds no phantom option", () => {
    const options = deriveProviderOptions(providers, null);
    expect(options.map(o => o.value)).toEqual(["aip-openai-001", "aip-google-001"]);
  });

  it("model options come from the selected provider's recorded models array", () => {
    const options = deriveModelOptions(providers, "aip-openai-001", "gpt-4o");
    expect(options.map(o => o.value)).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });

  it("a recorded model absent from the provider's list is offered verbatim as data", () => {
    const options = deriveModelOptions(providers, "aip-openai-001", "gpt-3.5-legacy");
    expect(options[0]).toEqual({
      value: "gpt-3.5-legacy",
      label: "gpt-3.5-legacy (recorded value — not in this provider's model list)",
      matched: false,
    });
  });

  it("with no provider selected, only the recorded model is offered, verbatim", () => {
    const options = deriveModelOptions(providers, null, "gpt-4o");
    expect(options).toEqual([{ value: "gpt-4o", label: "gpt-4o (recorded value)", matched: false }]);
  });
});

describe("parseNumberInput — no NaN can reach the form state", () => {
  it("empty input means 'not recorded' (null), never 0 and never NaN", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("   ")).toBeNull();
  });
  it("parses real numbers and rejects garbage as null", () => {
    expect(parseNumberInput("42")).toBe(42);
    expect(parseNumberInput("0.5")).toBe(0.5);
    expect(parseNumberInput("abc")).toBeNull();
  });
});
