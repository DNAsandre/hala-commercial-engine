/**
 * final-pack-tender-mapping.test.ts — TCW-T5 (Tender Functional Closure Wave).
 *
 * FinalPack handoff pins (verification-first lane; PdfStudio.tsx is shared and
 * untouched — these tests pin the loader/export contracts it depends on):
 *
 *   1. `loadTenderPack` carries the USER-EDITED `tender_drafting.proposal_blocks`
 *      content into the mapped narrative blocks (intro / scope / closing) —
 *      the exported document contains what the drafter wrote, not defaults.
 *   2. A section the drafter never wrote maps to `not_captured` with NO
 *      fabricated content.
 *   3. The drift projection (`buildTenderSourceData`) includes
 *      `tender_drafting`, so editing proposal blocks IS visible to the
 *      drift check that PdfStudio surfaces.
 *   4. Export path selection stays CLIENT-side when the server flag is absent:
 *      `isServerPdfEnabled()` is false and `tryServerFinalPdf` resolves null
 *      (the caller's fallback path), so no fake "server rendered" claim can
 *      exist without the env flag.
 *
 * Mock contract: house standard — the Supabase double honours the select
 * projection (only requested columns come back).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  responses: new Map<string, { data: unknown; error: unknown }>(),
  selects: [] as Array<{ table: string; select?: string }>,
}));

function project(row: Record<string, unknown> | null, select?: string) {
  if (!row || typeof row !== "object") return row;
  if (!select || select.trim() === "*") return row;
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

vi.mock("./supabase", () => ({
  supabase: {
    from(table: string) {
      const call = { table, select: undefined as string | undefined };
      db.selects.push(call);
      const result = () => db.responses.get(table) ?? { data: null, error: null };
      const settle = (single: boolean) => {
        const res = result();
        if (res.error) return { data: null, error: res.error };
        const data = res.data;
        if (Array.isArray(data)) {
          const rows = data.map((r) => project(r as Record<string, unknown>, call.select));
          return { data: single ? rows[0] ?? null : rows, error: null };
        }
        return { data: data ? project(data as Record<string, unknown>, call.select) : null, error: null };
      };
      const builder: Record<string, unknown> = {};
      Object.assign(builder, {
        select(cols?: string) { call.select = cols; return builder; },
        eq() { return builder; },
        in() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle: async () => settle(true),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(settle(false)).then(res, rej),
      });
      return builder;
    },
  },
}));

import { buildTenderSourceData, loadTenderPack } from "./final-pack-loader";
import { isServerPdfEnabled, tryServerFinalPdf } from "./server-pdf";

// ─── fixtures ────────────────────────────────────────────────

const EDITED_INTRO_HTML = "<p>USER-EDITED introduction — Hala tailored narrative for this client.</p>";
const EDITED_SCOPE_HTML = "<p>USER-EDITED scope: 3PL warehousing across two DCs.</p>";

const TENDER_ROW = {
  id: "f5e10000-0000-4000-8000-0000000000d1",
  ticket_title: "T5 Mapping Pin Tender",
  customer_name: "Mapping Pin Customer",
  estimated_value: 500,
  target_gp_percent: 22,
  target_date: "2026-10-01",
  internal_stage: "final_approved",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  type_details: {
    tender: { title: "t", customerName: "c" },
    tender_drafting: {
      proposal_blocks: [
        // Drafter-edited content in the three shapes the extractor supports.
        { block_key: "introduction", content_html: EDITED_INTRO_HTML },
        { title: "Scope of Work", draft_content: EDITED_SCOPE_HTML },
        // NOTE: no closing block — that section was never drafted.
      ],
    },
  },
};

const RECIPE = [
  { block_key: "intro.narrative", order: 1, required: false, default_content_override: null, config_override: {} },
  { block_key: "scope.list", order: 2, required: false, default_content_override: null, config_override: {} },
  { block_key: "closing.note", order: 3, required: false, default_content_override: null, config_override: {} },
];

const BLOCK_LIBRARY = [
  { id: "bl-1", block_key: "intro.narrative", family: "commercial", display_name: "Introduction", editor_mode: "wysiwyg", render_key: "narrative", default_content: "<p>library default intro</p>", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-2", block_key: "scope.list", family: "commercial", display_name: "Scope", editor_mode: "wysiwyg", render_key: "narrative", default_content: "<p>library default scope</p>", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-3", block_key: "closing.note", family: "commercial", display_name: "Closing", editor_mode: "wysiwyg", render_key: "closing", default_content: "<p>library default closing</p>", schema_config: {}, permissions: {}, description: "" },
];

function seed() {
  db.responses.set("commercial_tickets", { data: TENDER_ROW, error: null });
  db.responses.set("doc_template_versions", {
    data: { id: "tv-9", template_id: "tpl-002", recipe: RECIPE, layout: null },
    error: null,
  });
  db.responses.set("doc_template_volumes", { data: [], error: null });
  db.responses.set("doc_block_library", { data: BLOCK_LIBRARY, error: null });
  db.responses.set("doc_templates", { data: { name: "Full Commercial Proposal" }, error: null });
}

beforeEach(() => {
  db.responses.clear();
  db.selects.length = 0;
});

// ═════════════════════════════════════════════════════════════
// 1+2. tender → blocks mapping carries the drafter's edits
// ═════════════════════════════════════════════════════════════

describe("loadTenderPack — user-edited proposal_blocks reach the document blocks", () => {
  it("maps content_html / draft_content edits into the intro and scope blocks as populated content", async () => {
    seed();
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    expect(snapshot.error).toBeUndefined();

    const intro = snapshot.blocks.find((b) => b.block_key === "intro.narrative");
    const scope = snapshot.blocks.find((b) => b.block_key === "scope.list");
    expect(intro?.content.html).toBe(EDITED_INTRO_HTML);
    expect(intro?.content.source_status).toBe("populated");
    expect(scope?.content.html).toBe(EDITED_SCOPE_HTML);
    expect(scope?.content.source_status).toBe("populated");
    // The library default never silently replaces drafted content.
    expect(intro?.content.html).not.toContain("library default");
  });

  it("a never-drafted section is not_captured with NO fabricated html", async () => {
    seed();
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const closing = snapshot.blocks.find((b) => b.block_key === "closing.note");
    expect(closing?.content.source_status).toBe("not_captured");
    expect(closing?.content.html).toBeUndefined();
  });

  it("the snapshot's hashed source_data carries the same tender_drafting the blocks were mapped from", async () => {
    seed();
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    expect(snapshot.source_data.tender_drafting).toEqual(TENDER_ROW.type_details.tender_drafting);
  });
});

// ═════════════════════════════════════════════════════════════
// 3. drift projection sees proposal-block edits
// ═════════════════════════════════════════════════════════════

describe("buildTenderSourceData — drift projection includes the drafted content", () => {
  it("tender_drafting is part of the hashed projection (an edit to proposal blocks IS drift)", () => {
    const a = buildTenderSourceData(TENDER_ROW);
    expect(a.tender_drafting).toEqual(TENDER_ROW.type_details.tender_drafting);

    const edited = {
      ...TENDER_ROW,
      type_details: {
        ...TENDER_ROW.type_details,
        tender_drafting: {
          proposal_blocks: [{ block_key: "introduction", content_html: "<p>changed</p>" }],
        },
      },
    };
    expect(buildTenderSourceData(edited).tender_drafting).not.toEqual(a.tender_drafting);
  });
});

// ═════════════════════════════════════════════════════════════
// 4. export path selection without the env flag
// ═════════════════════════════════════════════════════════════

describe("server PDF path — OFF without the env flag; export stays client-side", () => {
  it("isServerPdfEnabled() is false when VITE_FPS_SERVER_PDF is absent from the environment", () => {
    expect((import.meta as { env?: Record<string, string> }).env?.VITE_FPS_SERVER_PDF).toBeUndefined();
    expect(isServerPdfEnabled()).toBe(false);
  });

  it("tryServerFinalPdf resolves null (the caller's client fallback), never a fake success shape", async () => {
    const result = await tryServerFinalPdf({
      doc_instance_id: "di-1",
      export_mode: "final",
      rendered_html: "<html></html>",
      compiled_by: "test",
    });
    expect(result).toBeNull();
  });
});
