/**
 * WarningBanner.test.tsx — SC-01 Wave 04, lane W04-C4.
 *
 * Defect D (banner half): the composer's notes counted the WHOLE document even
 * when a volume was selected, so the banner described blocks the selected
 * volume does not contain. The counts must describe the set actually shown.
 */
import { describe, expect, it } from "vitest";
import { computeWarnings, scopeBlocksToVolume } from "./WarningBanner";
import type { OutputBlock } from "@/lib/final-pack-loader";

function block(
  key: string,
  opts: { visible?: boolean; sourceStatus?: string; renderKey?: string } = {},
): OutputBlock {
  return {
    id: key,
    block_key: key,
    render_key: opts.renderKey ?? "narrative",
    family: "commercial",
    editor_mode: "wysiwyg",
    display_name: key,
    visible: opts.visible ?? true,
    order: 1,
    required: false,
    content: { html: `<p>${key}</p>`, source_status: opts.sourceStatus ?? "populated" },
    default_content: "",
    schema_config: {},
    permissions: {},
  } as unknown as OutputBlock;
}

describe("scopeBlocksToVolume", () => {
  it("returns the whole document when no volume is selected", () => {
    const blocks = [block("a"), block("b")];
    expect(scopeBlocksToVolume(blocks, null)).toHaveLength(2);
    expect(scopeBlocksToVolume(blocks, [])).toHaveLength(2);
  });

  it("returns only the selected volume's blocks", () => {
    const blocks = [block("a"), block("b"), block("c")];
    expect(scopeBlocksToVolume(blocks, ["a", "c"]).map((b) => b.block_key)).toEqual(["a", "c"]);
  });

  it("filters only — it never reorders", () => {
    const blocks = [block("a"), block("b"), block("c")];
    expect(scopeBlocksToVolume(blocks, ["c", "a"]).map((b) => b.block_key)).toEqual(["a", "c"]);
  });
});

describe("warning counts follow the selected volume", () => {
  const doc = [
    block("tech.intro"),
    block("tech.hidden", { visible: false }),
    block("comm.pricing", { renderKey: "pricing_table_single" }),
    block("comm.empty", { sourceStatus: "not_captured" }),
  ];

  it("counts the whole document when nothing is selected", () => {
    const warnings = computeWarnings(scopeBlocksToVolume(doc, null));
    const ids = warnings.map((w) => w.id).sort();
    expect(ids).toEqual(["empty-pricing", "hidden", "not-captured"]);
    expect(warnings.find((w) => w.id === "hidden")?.message).toContain("1 block is hidden");
  });

  it("counts ONLY the technical volume when it is selected", () => {
    const warnings = computeWarnings(scopeBlocksToVolume(doc, ["tech.intro", "tech.hidden"]));
    const ids = warnings.map((w) => w.id).sort();
    // The commercial volume's empty pricing and uncaptured block belong to a
    // document this export/preview is not showing.
    expect(ids).toEqual(["hidden"]);
  });

  it("counts ONLY the commercial volume when it is selected", () => {
    const warnings = computeWarnings(scopeBlocksToVolume(doc, ["comm.pricing", "comm.empty"]));
    const ids = warnings.map((w) => w.id).sort();
    expect(ids).toEqual(["empty-pricing", "not-captured"]);
    // No hidden block lives in this volume, so no hidden note may appear.
    expect(ids).not.toContain("hidden");
  });
});
