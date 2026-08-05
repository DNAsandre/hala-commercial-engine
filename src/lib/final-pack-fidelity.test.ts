/**
 * final-pack-fidelity.test.ts — SC-01 Wave 04 (W04-T09)
 *
 * FinalStudio document fidelity, over the REAL snapshot/normalize/export
 * modules. There is no authenticated session in this wave, so a live export
 * cannot be exercised; these tests instead pin the properties a live export
 * would depend on:
 *
 *  1. Document order survives build → save (JSONB round-trip) → load → render.
 *  2. Preview and export consume the SAME selection, in the SAME order.
 *  3. The drift check hashes the SAME projection the snapshot hashed, so an
 *     unchanged tender reports "no drift" instead of permanent fake drift.
 *  4. Server PDF rendering is unavailable and is NEVER reported as a success.
 *  5. Missing/typeless content renders honestly — no throw, no NaN/undefined.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildTenderSourceData,
  computeSourceHash,
  loadTenderPack,
  sortRecipeByOrder,
  uniqueBlockId,
  TENDER_SOURCE_SELECT,
  type OutputBlock,
} from "@/lib/final-pack-loader";
import { buildPreviewHTML, selectRenderedBlocks } from "@/lib/final-pack-preview";
import { DEFAULT_BRANDING } from "@/lib/final-pack-preview";
import { isServerPdfEnabled, tryServerFinalPdf } from "@/lib/server-pdf";
import { executeExport } from "@/lib/final-pack-export";

// ─── DOMPurify test double ───────────────────────────────────────────────────
// DOMPurify's default export is only a sanitizer instance when a DOM exists; in
// the node test environment it is the un-instantiated factory. This double is a
// pass-through so the REAL preview/export code under test runs unchanged.
const purify = vi.hoisted(() => ({ failNext: false }));
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => {
      if (purify.failNext) {
        purify.failNext = false;
        throw new Error("sanitizer unavailable");
      }
      return html;
    },
  },
}));

// ─── mocked Supabase client ──────────────────────────────────────────────────
// The mock HONOURS the select projection: a query only ever sees the columns it
// asked for. (A mock that returns unrequested fields has previously certified a
// fabrication in this codebase.)

const db = vi.hoisted(() => ({
  calls: [] as Array<{
    table: string;
    select?: string;
    filters: Array<[string, unknown]>;
    orders: unknown[][];
    limit?: number;
    inserted?: unknown;
  }>,
  responses: new Map<string, { data: unknown; error: unknown }>(),
}));

function project(row: any, select?: string) {
  if (!row || typeof row !== "object") return row;
  if (!select || select.trim() === "*") return row;
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

function projectResult(res: { data: unknown; error: unknown }, select?: string, single = false) {
  if (res.error) return { data: null, error: res.error };
  const data = res.data;
  if (Array.isArray(data)) {
    const rows = data.map((r) => project(r, select));
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  }
  return { data: data ? project(data, select) : null, error: null };
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const call = {
        table,
        filters: [] as Array<[string, unknown]>,
        orders: [] as unknown[][],
        select: undefined as string | undefined,
        limit: undefined as number | undefined,
        inserted: undefined as unknown,
      };
      db.calls.push(call);
      const result = () => db.responses.get(table) ?? { data: null, error: null };
      const builder: any = {
        select(cols?: string) { call.select = cols; return builder; },
        eq(c: string, v: unknown) { call.filters.push([c, v]); return builder; },
        in(c: string, v: unknown) { call.filters.push([c, v]); return builder; },
        not(c: string, op: string, v: unknown) { call.filters.push([c, `${op}:${v}`]); return builder; },
        order(...a: unknown[]) { call.orders.push(a); return builder; },
        limit(n: number) { call.limit = n; return builder; },
        insert(row: unknown) { call.inserted = row; return Promise.resolve({ data: null, error: null }); },
        maybeSingle: async () => projectResult(result(), call.select, true),
        then: (res: any, rej: any) =>
          Promise.resolve(projectResult(result(), call.select, false)).then(res, rej),
      };
      return builder;
    },
  },
}));

// ─── fixtures ────────────────────────────────────────────────────────────────

const TENDER_ROW = {
  id: "a1200000-0000-4000-8000-000000000002",
  ticket_title: "[HALA-UAT-ARV2][W2-S002] Fifteen Stage Tender Test",
  customer_name: "UAT Customer",
  estimated_value: 100,
  target_gp_percent: 20,
  target_date: "2026-09-01",
  internal_stage: "clarification",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-02-01T00:00:00.000Z",
  type_details: {
    tender: { title: "t", customerName: "c" },
    pricing: { scenarios: { rows: [] } },
  },
  // A column NOT in the projection — it must never reach the hash.
  secret_internal_note: "must not be selected",
};

/** Recipe deliberately stored out of `order` sequence, as JSONB permits. */
const OUT_OF_ORDER_RECIPE = [
  { block_key: "closing.note", order: 3, required: false, default_content_override: null, config_override: {} },
  { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
  { block_key: "intro.narrative", order: 2, required: false, default_content_override: null, config_override: {} },
];

const BLOCK_LIBRARY = [
  { id: "bl-1", block_key: "cover.hero", family: "commercial", display_name: "Cover", editor_mode: "form", render_key: "cover_hero", default_content: "", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-2", block_key: "intro.narrative", family: "commercial", display_name: "Introduction", editor_mode: "wysiwyg", render_key: "narrative", default_content: "<p>intro</p>", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-3", block_key: "closing.note", family: "commercial", display_name: "Closing", editor_mode: "wysiwyg", render_key: "closing", default_content: "<p>closing</p>", schema_config: {}, permissions: {}, description: "" },
];

function seedConnectedLoad(tender: unknown = TENDER_ROW, recipe: unknown = OUT_OF_ORDER_RECIPE) {
  db.responses.set("commercial_tickets", { data: tender, error: null });
  db.responses.set("doc_template_versions", {
    data: { id: "tv-1", template_id: "tpl-002", recipe, layout: null },
    error: null,
  });
  db.responses.set("doc_template_volumes", { data: [], error: null });
  db.responses.set("doc_block_library", { data: BLOCK_LIBRARY, error: null });
  db.responses.set("doc_templates", { data: { name: "Full Commercial Proposal" }, error: null });
  db.responses.set("clause_library", { data: [], error: null });
}

function block(partial: Partial<OutputBlock> & { id: string; display_name: string }): OutputBlock {
  return {
    block_key: partial.id,
    render_key: "narrative",
    family: "commercial",
    editor_mode: "wysiwyg",
    visible: true,
    order: 1,
    required: false,
    content: { html: `<p>${partial.display_name}</p>`, source_status: "populated" },
    default_content: "",
    schema_config: {},
    permissions: {},
    ...partial,
  } as OutputBlock;
}

beforeEach(() => {
  db.calls.length = 0;
  db.responses.clear();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Ordering truth
// ═══════════════════════════════════════════════════════════════════════════

describe("document order", () => {
  it("sortRecipeByOrder sorts by the order field and is stable for ties", () => {
    const sorted = sortRecipeByOrder([
      { order: 2, tag: "b" },
      { order: 1, tag: "a" },
      { order: 2, tag: "c" },
      { tag: "no-order" } as { order?: number; tag: string },
    ]);
    expect(sorted.map((r: any) => r.tag)).toEqual(["a", "b", "c", "no-order"]);
  });

  it("uniqueBlockId never lets two blocks share an id", () => {
    const used = new Set<string>();
    expect(uniqueBlockId("cover.hero-1", used)).toBe("cover.hero-1");
    expect(uniqueBlockId("cover.hero-1", used)).toBe("cover.hero-1-2");
    expect(uniqueBlockId("cover.hero-1", used)).toBe("cover.hero-1-3");
  });

  it("loadTenderPack emits blocks in recipe order even when the stored recipe array is not sorted", async () => {
    seedConnectedLoad();
    const snap = await loadTenderPack(TENDER_ROW.id, "combined_proposal");

    expect(snap.error).toBeUndefined();
    expect(snap.blocks.map((b) => b.block_key)).toEqual([
      "cover.hero",
      "intro.narrative",
      "closing.note",
    ]);
    // Array position and the `#order` shown on each card agree.
    expect(snap.blocks.map((b) => b.order)).toEqual([1, 2, 3]);
    expect(new Set(snap.blocks.map((b) => b.id)).size).toBe(snap.blocks.length);
  });

  it("asks the database for the exact columns the hash is built from", async () => {
    seedConnectedLoad();
    await loadTenderPack(TENDER_ROW.id, "combined_proposal");

    const tenderCall = db.calls.find((c) => c.table === "commercial_tickets");
    expect(tenderCall?.select).toBe(TENDER_SOURCE_SELECT);
    expect(tenderCall?.filters).toEqual([["id", TENDER_ROW.id]]);
    // The template-version read is explicitly ordered — never server default.
    const tvCall = db.calls.find((c) => c.table === "doc_template_versions");
    expect(tvCall?.orders).toEqual([["version_number", { ascending: false }]]);
  });

  it("order survives the save → JSONB → load → render round trip", async () => {
    seedConnectedLoad();
    const snap = await loadTenderPack(TENDER_ROW.id, "combined_proposal");

    // Simulate doc_instances.blocks (jsonb) write + read-back.
    const stored = JSON.parse(JSON.stringify(snap.blocks)) as OutputBlock[];
    expect(stored.map((b) => b.id)).toEqual(snap.blocks.map((b) => b.id));

    // Simulate a user reorder (what useFinalPackBlocks.moveBlock produces).
    const moved = [stored[2], stored[0], stored[1]].map((b, i) => ({ ...b, order: i + 1 }));
    const reloaded = JSON.parse(JSON.stringify(moved)) as OutputBlock[];

    const html = buildPreviewHTML({
      blocks: reloaded,
      branding: DEFAULT_BRANDING,
      exportMode: "final",
      customerName: "UAT Customer",
      refNumber: "R-1",
      date: "2026-08-05",
    });

    // Rendered order follows the saved array order, not the original recipe.
    const closingAt = html.indexOf("closing");
    const introAt = html.indexOf("intro");
    expect(closingAt).toBeGreaterThan(-1);
    expect(introAt).toBeGreaterThan(-1);
    expect(closingAt).toBeLessThan(introAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Preview and export consume the same selection
// ═══════════════════════════════════════════════════════════════════════════

describe("render selection", () => {
  const blocks: OutputBlock[] = [
    block({ id: "a", display_name: "Alpha", block_key: "a", order: 1 }),
    block({ id: "b", display_name: "Bravo", block_key: "b", order: 2, visible: false }),
    block({ id: "c", display_name: "Charlie", block_key: "c", order: 3 }),
  ];

  it("filters without reordering and drops only hidden blocks", () => {
    expect(selectRenderedBlocks(blocks).map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("volume filter preserves document order", () => {
    const sel = selectRenderedBlocks(blocks, { volumeBlockKeys: ["c", "a"] });
    expect(sel.map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("the selection is exactly what buildPreviewHTML renders", () => {
    const sel = selectRenderedBlocks(blocks, { volumeBlockKeys: ["c"] });
    const html = buildPreviewHTML({
      blocks,
      branding: DEFAULT_BRANDING,
      exportMode: "draft",
      customerName: "",
      refNumber: "",
      date: "",
      volumeBlockKeys: ["c"],
    });
    expect(sel.map((b) => b.id)).toEqual(["c"]);
    expect(html).toContain("Charlie");
    expect(html).not.toContain("Alpha");
    expect(html).not.toContain("Bravo");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Drift check hashes the same projection the snapshot hashed
// ═══════════════════════════════════════════════════════════════════════════

describe("source drift parity", () => {
  it("an unchanged tender hashes to the snapshot hash (no fabricated drift)", async () => {
    seedConnectedLoad();
    const snap = await loadTenderPack(TENDER_ROW.id, "combined_proposal");

    // Re-read exactly what the drift checker selects.
    const cols = TENDER_SOURCE_SELECT.split(",").map((c) => c.trim());
    const asRead: Record<string, unknown> = {};
    for (const c of cols) asRead[c] = (TENDER_ROW as any)[c];

    const recheck = await computeSourceHash(buildTenderSourceData(asRead));
    expect(snap.source_hash).toBe(recheck);
  });

  it("a real content change produces a different hash", async () => {
    const a = await computeSourceHash(buildTenderSourceData(TENDER_ROW));
    const b = await computeSourceHash(
      buildTenderSourceData({
        ...TENDER_ROW,
        type_details: { ...TENDER_ROW.type_details, pricing: { scenarios: { rows: [{ id: "x" }] } } },
      }),
    );
    expect(a).not.toBe(b);
  });

  it("columns outside the projection cannot influence the hash", async () => {
    const a = await computeSourceHash(buildTenderSourceData(TENDER_ROW));
    const b = await computeSourceHash(
      buildTenderSourceData({ ...TENDER_ROW, secret_internal_note: "changed" }),
    );
    expect(a).toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Server PDF is unavailable and never reported as success
// ═══════════════════════════════════════════════════════════════════════════

describe("server PDF availability", () => {
  it("is disabled and returns null rather than a fake success", async () => {
    expect(isServerPdfEnabled()).toBe(false);
    const res = await tryServerFinalPdf({
      doc_instance_id: "i-1",
      export_mode: "final",
      rendered_html: "<html></html>",
      compiled_by: "tester",
    });
    expect(res).toBeNull();
  });

  it("a Final PDF export never claims the server rendered it and never calls the server", async () => {
    const fetchSpy = vi.fn();
    const openSpy = vi.fn(() => ({
      document: { open() {}, write() {}, close() {}, title: "" },
      focus() {},
      print() {},
      onload: null as unknown,
    }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("window", { open: openSpy });

    const result = await executeExport({
      instanceId: "i-1",
      templateId: "tpl-002",
      blocks: [block({ id: "a", display_name: "Alpha", block_key: "a" })],
      branding: DEFAULT_BRANDING,
      exportMode: "final",
      action: "pdf",
      customerName: "UAT Customer",
      title: "Pack",
      refNumber: "R-1",
      date: "2026-08-05",
      compiledBy: "tester",
    });

    expect(result.success).toBe(true); // the CLIENT export ran
    expect(openSpy).toHaveBeenCalled(); // …via the browser print path
    expect(fetchSpy).not.toHaveBeenCalled(); // …and no server render was attempted

    const audit = db.calls.find((c) => c.table === "doc_compiled_outputs");
    expect((audit?.inserted as any)?.metadata?.renderer).toBe("client");
    expect((audit?.inserted as any)?.status).toBe("success");
    vi.unstubAllGlobals();
  });

  it("records what actually reached the audit table for an HTML export", async () => {
    const clicked: string[] = [];
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    vi.stubGlobal("document", {
      createElement: () => ({ style: {}, click() { clicked.push("click"); }, set download(v: string) { clicked.push(v); }, get download() { return ""; } }),
      body: { appendChild() {}, removeChild() {} },
    });

    const blocks = [
      block({ id: "a", display_name: "Alpha", block_key: "a" }),
      block({ id: "b", display_name: "Bravo", block_key: "b", visible: false }),
    ];
    const res = await executeExport({
      instanceId: "i-2",
      templateId: "tpl-002",
      blocks,
      branding: DEFAULT_BRANDING,
      exportMode: "draft",
      action: "html",
      customerName: "UAT Customer",
      title: "Pack",
      refNumber: "R-1",
      date: "2026-08-05",
      compiledBy: "tester",
    });

    expect(res.success).toBe(true);
    const audit = db.calls.find((c) => c.table === "doc_compiled_outputs");
    const row = audit?.inserted as any;
    expect(row.doc_instance_id).toBe("i-2");
    expect(row.output_type).toBe("html");
    expect(row.metadata.block_count).toBe(2);
    expect(row.metadata.visible_block_count).toBe(1);
    expect(clicked).toContain("click");
    vi.unstubAllGlobals();
  });

  it("a render failure is reported as a failure and audited as failed — never a fake success", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    vi.stubGlobal("document", {
      createElement: () => ({ style: {}, click() {} }),
      body: { appendChild() {}, removeChild() {} },
    });
    purify.failNext = true;

    const res = await executeExport({
      instanceId: "i-3",
      templateId: "tpl-002",
      blocks: [block({ id: "a", display_name: "Alpha", block_key: "a" })],
      branding: DEFAULT_BRANDING,
      exportMode: "draft",
      action: "html",
      customerName: "UAT Customer",
      title: "Pack",
      refNumber: "",
      date: "",
      compiledBy: "tester",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("sanitizer unavailable");
    const audit = db.calls.find((c) => c.table === "doc_compiled_outputs");
    expect((audit?.inserted as any)?.status).toBe("failed");
    vi.unstubAllGlobals();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Missing / untyped content renders honestly
// ═══════════════════════════════════════════════════════════════════════════

describe("honest rendering of missing values", () => {
  function render(b: OutputBlock[]) {
    return buildPreviewHTML({
      blocks: b,
      branding: DEFAULT_BRANDING,
      exportMode: "draft",
      customerName: "",
      refNumber: "",
      date: "",
    });
  }

  it("does not throw and emits no NaN/undefined when variables are not strings", () => {
    const b = block({ id: "p", display_name: "Parties", block_key: "p" });
    b.render_key = "party_details";
    // JSONB content is not runtime-typed: numbers/null/undefined can appear.
    b.content = {
      variables: { count: 3 as unknown as string, missing: null as unknown as string, blank: undefined as unknown as string },
      source_status: "populated",
    };
    const html = render([b]);
    expect(html).toContain("3");
    expect(html).not.toMatch(/NaN/);
    expect(html).not.toMatch(/>undefined</);
  });

  it("an empty pricing table says so instead of rendering a blank table", () => {
    const b = block({ id: "pr", display_name: "Pricing Schedule", block_key: "pr" });
    b.render_key = "pricing_table_single";
    b.content = { pricing_rows: [], source_status: "not_captured" };
    const html = render([b]);
    expect(html).toContain("No pricing data captured yet.");
  });

  it("a missing source document still renders an honest error snapshot, not an empty success", async () => {
    db.responses.set("commercial_tickets", { data: null, error: null });
    const snap = await loadTenderPack("does-not-exist", "combined_proposal");
    expect(snap.error).toContain("not found");
    expect(snap.blocks).toEqual([]);
    expect(snap.tender_title).toBe("Not available");
  });

  it("a failed source read is reported as an error, not as an empty document", async () => {
    db.responses.set("commercial_tickets", { data: null, error: { message: "permission denied" } });
    const snap = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    expect(snap.error).toContain("permission denied");
    expect(snap.blocks).toEqual([]);
  });
});
