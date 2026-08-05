/**
 * useTemplates.test.ts — SC-01 Wave 04, lane W04-C4.
 *
 * Contract under test — `createTemplate` must not report a saved template when
 * the recipe was not stored.
 *
 * The defect: a template is two rows. `doc_templates` holds the header;
 * `doc_template_versions` holds the RECIPE — the block list that is the entire
 * point of the template. When the version insert failed, the hook set an error
 * and then fell through, returning a populated summary. SaveAsTemplateDialog
 * read that as success and showed "Saved", so the user's recipe was silently
 * lost.
 *
 * There is no DOM test environment in this package, so the hook is exercised
 * through `react-dom/server`: `useState`/`useCallback` resolve during render
 * and `useEffect` (the auto-`refresh`) does not run, which is exactly the
 * isolation this test wants. The returned `createTemplate` closure is captured
 * and called afterwards, and every assertion is against the rows that reached
 * the database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { useTemplates, type UseTemplatesReturn, type RecipeEntry } from "./useTemplates";

const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: any }>,
  /** table → error the insert should return */
  insertErrors: {} as Record<string, { message: string } | undefined>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const builder: any = {
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        update() { return builder; },
        insert(row: unknown) {
          db.inserts.push({ table, row });
          const error = db.insertErrors[table] ?? null;
          return Promise.resolve({ data: null, error });
        },
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (res: any, rej: any) => Promise.resolve({ data: [], error: null }).then(res, rej),
      };
      return builder;
    },
  },
}));

/** Renders the hook once (no effects) and hands back its API. */
function captureApi(): UseTemplatesReturn {
  let api: UseTemplatesReturn | null = null;
  function Probe() {
    api = useTemplates();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  if (!api) throw new Error("useTemplates did not return an API");
  return api;
}

const RECIPE: RecipeEntry[] = [
  { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
  { block_key: "intro.narrative", order: 2, required: false, default_content_override: "<p>hi</p>", config_override: {} },
];

beforeEach(() => {
  db.inserts.length = 0;
  db.insertErrors = {};
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("createTemplate — a saved template means the recipe was stored", () => {
  it("returns a summary when BOTH rows are written", async () => {
    const api = captureApi();

    const summary = await api.createTemplate({
      name: "Full Commercial Proposal",
      doc_type: "proposal",
      recipe: RECIPE,
      created_by: "tester",
    });

    expect(summary).not.toBeNull();
    expect(summary?.name).toBe("Full Commercial Proposal");

    const header = db.inserts.find((i) => i.table === "doc_templates");
    const version = db.inserts.find((i) => i.table === "doc_template_versions");
    expect(header).toBeDefined();
    // What actually reached the database — the recipe, verbatim, on the version row.
    expect(version?.row.recipe).toEqual(RECIPE);
    expect(version?.row.version_number).toBe(1);
    expect(version?.row.template_id).toBe(header?.row.id);
  });

  it("returns null — not a summary — when the recipe row fails to insert", async () => {
    db.insertErrors["doc_template_versions"] = {
      message: "new row violates row-level security policy for table doc_template_versions",
    };
    const api = captureApi();

    const summary = await api.createTemplate({
      name: "Recipe Loser",
      doc_type: "proposal",
      recipe: RECIPE,
      created_by: "tester",
    });

    // The old behaviour returned a populated summary here and the dialog said
    // "Saved" while the recipe was gone.
    expect(summary).toBeNull();

    // The header row genuinely did land — the failure message must not deny that.
    expect(db.inserts.filter((i) => i.table === "doc_templates")).toHaveLength(1);
    // And the version insert was genuinely attempted with the real recipe.
    const version = db.inserts.find((i) => i.table === "doc_template_versions");
    expect(version?.row.recipe).toEqual(RECIPE);
  });

  it("returns null when the header row itself fails, and never attempts a version", async () => {
    db.insertErrors["doc_templates"] = { message: "permission denied for table doc_templates" };
    const api = captureApi();

    const summary = await api.createTemplate({
      name: "Header Loser",
      doc_type: "proposal",
      recipe: RECIPE,
    });

    expect(summary).toBeNull();
    expect(db.inserts.filter((i) => i.table === "doc_template_versions")).toHaveLength(0);
  });
});

describe("saveRecipeVersion — a new version means a stored version row", () => {
  it("returns null when the version insert fails", async () => {
    db.insertErrors["doc_template_versions"] = { message: "insert failed" };
    const api = captureApi();

    const version = await api.saveRecipeVersion("tpl-1", RECIPE);

    expect(version).toBeNull();
  });

  it("writes the recipe that was passed, on the next version number", async () => {
    const api = captureApi();

    const version = await api.saveRecipeVersion("tpl-1", RECIPE, { cover_page: false });

    expect(version).not.toBeNull();
    const row = db.inserts.find((i) => i.table === "doc_template_versions")?.row;
    expect(row.template_id).toBe("tpl-1");
    expect(row.recipe).toEqual(RECIPE);
    expect(row.layout).toEqual({ cover_page: false });
    // getVersions reads back nothing in this mock, so the next number is 1.
    expect(row.version_number).toBe(1);
  });
});
