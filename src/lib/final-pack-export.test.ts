/**
 * final-pack-export.test.ts — SC-01 Wave 04, lane W04-C4.
 *
 * Two defects are pinned here:
 *
 *  C. Success was reported before persistence was confirmed.
 *     `executeExport` returned `{ success: true }` as soon as the print window
 *     opened, and `writeAuditRow` swallowed the doc_compiled_outputs insert
 *     error. A user therefore saw the same green tick whether a file was
 *     downloaded, a print dialog merely opened, or the audit row was lost.
 *
 *  D. The export audit recorded WHOLE-DOCUMENT block counts for a volume
 *     export, so the trail described a document that was never produced.
 *
 * The Supabase mock honours the select projection and records the row actually
 * handed to `.insert()`, so every assertion below is about what reached the
 * database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeExport, type ExportRequest } from "@/lib/final-pack-export";
import { DEFAULT_BRANDING } from "@/lib/final-pack-preview";
import type { OutputBlock } from "@/lib/final-pack-loader";

const pdfEngine = vi.hoisted(() => ({ bodyBytes: new Uint8Array([1, 2, 3]) as Uint8Array | null }));
vi.mock("@/lib/final-pack-pdf", () => ({
  htmlToBodyPdfBytes: vi.fn(async () => pdfEngine.bodyBytes),
  mergeCoverAndBody: vi.fn(async (_cover: Uint8Array, body: Uint8Array) => body),
}));

// DOMPurify's default export is the un-instantiated factory outside a DOM;
// this pass-through double lets the REAL preview/export code run unchanged.
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

const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: any; select?: string }>,
  insertError: null as { message: string } | null,
}));

function project(row: any, select?: string) {
  if (!row || typeof row !== "object") return row;
  if (!select || select.trim() === "*") return row;
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      let select: string | undefined;
      const builder: any = {
        select(cols?: string) { select = cols; return builder; },
        eq() { return builder; },
        insert(row: unknown) {
          db.inserts.push({ table, row, select });
          return Promise.resolve(
            db.insertError
              ? { data: null, error: db.insertError }
              : { data: project({ id: (row as any)?.id }, select), error: null },
          );
        },
        then: (res: any, rej: any) => Promise.resolve({ data: null, error: null }).then(res, rej),
      };
      return builder;
    },
  },
}));

// ─── fixtures ────────────────────────────────────────────────────────────────

function block(key: string, visible = true): OutputBlock {
  return {
    id: key,
    block_key: key,
    render_key: "narrative",
    family: "commercial",
    editor_mode: "wysiwyg",
    display_name: key,
    visible,
    order: 1,
    required: false,
    content: { html: `<p>${key}</p>`, source_status: "populated" },
    default_content: "",
    schema_config: {},
    permissions: {},
  } as unknown as OutputBlock;
}

function request(overrides: Partial<ExportRequest> = {}): ExportRequest {
  return {
    instanceId: "inst-1",
    templateId: "tpl-1",
    blocks: [block("a"), block("b"), block("c"), block("hidden", false)],
    branding: DEFAULT_BRANDING,
    exportMode: "draft",
    action: "html",
    customerName: "UAT Customer",
    title: "Pack",
    refNumber: "R-1",
    date: "2026-08-05",
    compiledBy: "tester",
    ...overrides,
  };
}

/** Stubs the download path (no DOM in this environment). */
function stubDownload() {
  const clicks: string[] = [];
  vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
  vi.stubGlobal("document", {
    createElement: () => ({ style: {}, click() { clicks.push("click"); }, download: "" }),
    body: { appendChild() {}, removeChild() {} },
  });
  return clicks;
}

/** Stubs the browser-print path and reports whether print() was invoked. */
function stubPrintWindow() {
  const state = { opened: false, printed: false };
  vi.stubGlobal("window", {
    open: () => {
      state.opened = true;
      return {
        document: { open() {}, write() {}, close() {}, title: "" },
        focus() {},
        print() { state.printed = true; },
        onload: null,
      };
    },
  });
  return state;
}

const auditRow = () => db.inserts.find((i) => i.table === "doc_compiled_outputs")?.row;

beforeEach(() => {
  db.inserts.length = 0;
  db.insertError = null;
  purify.failNext = false;
  pdfEngine.bodyBytes = new Uint8Array([1, 2, 3]);
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ═══════════════════════════════════════════════════════════════════════════
// C — say what actually happened
// ═══════════════════════════════════════════════════════════════════════════

describe("executeExport — reports what was actually done", () => {
  it("an HTML export reports a file handed to the browser", async () => {
    const clicks = stubDownload();

    const res = await executeExport(request({ action: "html" }));

    expect(res.success).toBe(true);
    expect(res.delivered).toBe("file_downloaded");
    expect(clicks).toContain("click");
  });

  it("a high-fidelity PDF export is handed directly to the browser for download", async () => {
    const clicks = stubDownload();

    const res = await executeExport(request({ action: "pdf", exportMode: "draft" }));

    expect(res.success).toBe(true);
    expect(res.delivered).toBe("file_downloaded");
    expect(clicks).toContain("click");
  });

  it("falls back honestly to Print/Save-as-PDF when high-fidelity bytes are unavailable", async () => {
    pdfEngine.bodyBytes = null;
    const printState = stubPrintWindow();

    const res = await executeExport(request({ action: "pdf", exportMode: "draft" }));

    expect(res.success).toBe(true);
    expect(printState.opened).toBe(true);
    expect(res.delivered).toBe("print_dialog_opened");
  });

  it("a failed render reports failure and audits it as failed", async () => {
    stubDownload();
    purify.failNext = true;

    const res = await executeExport(request({ action: "html" }));

    expect(res.success).toBe(false);
    expect(res.error).toContain("sanitizer unavailable");
    expect(res.delivered).toBeUndefined();
    expect(auditRow()?.status).toBe("failed");
    // Nothing was produced, so the audit must not claim blocks were exported.
    expect(auditRow()?.metadata.exported_block_count).toBe(0);
  });
});

describe("executeExport — audit persistence is confirmed, not assumed", () => {
  it("reports auditPersisted true when the doc_compiled_outputs insert lands", async () => {
    stubDownload();

    const res = await executeExport(request({ action: "html" }));

    expect(res.auditPersisted).toBe(true);
    expect(res.auditError).toBeUndefined();
    expect(auditRow()?.doc_instance_id).toBe("inst-1");
  });

  it("surfaces a lost audit row instead of swallowing the insert error", async () => {
    stubDownload();
    db.insertError = { message: "new row violates row-level security policy" };

    const res = await executeExport(request({ action: "html" }));

    // The export itself genuinely ran, so it is not reported as a failure…
    expect(res.success).toBe(true);
    // …but the audit trail is NOT confirmed, and the caller can now say so.
    expect(res.auditPersisted).toBe(false);
    expect(res.auditError).toContain("row-level security");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D — the audit counts the set that was actually exported
// ═══════════════════════════════════════════════════════════════════════════

describe("export audit counts match the exported set", () => {
  it("a full-document export counts the blocks that render", async () => {
    stubDownload();

    await executeExport(request({ action: "html" }));

    const row = auditRow();
    expect(row.metadata.block_count).toBe(4);           // the instance
    expect(row.metadata.exported_block_count).toBe(3);  // hidden block excluded
    expect(row.metadata.visible_block_count).toBe(3);
    expect(row.metadata.exported_block_keys).toEqual(["a", "b", "c"]);
    expect(row.metadata.volume_scoped).toBe(false);
  });

  it("a VOLUME export counts that volume, not the whole document", async () => {
    stubDownload();

    await executeExport(
      request({
        action: "html",
        volumeKey: "technical",
        volumeTitle: "Technical Volume",
        volumeBlockKeys: ["a", "b"],
      }),
    );

    const row = auditRow();
    expect(row.volume_key).toBe("technical");
    expect(row.volume_title).toBe("Technical Volume");
    // The defect: these were 4 and 3 — the whole document — for a two-block volume.
    expect(row.metadata.exported_block_count).toBe(2);
    expect(row.metadata.visible_block_count).toBe(2);
    expect(row.metadata.exported_block_keys).toEqual(["a", "b"]);
    expect(row.metadata.volume_scoped).toBe(true);
    // The instance total is still recorded, clearly labelled as such.
    expect(row.metadata.block_count).toBe(4);
  });

  it("a hidden block inside the selected volume is not counted as exported", async () => {
    stubDownload();

    await executeExport(
      request({
        action: "html",
        volumeKey: "commercial",
        volumeTitle: "Commercial Volume",
        volumeBlockKeys: ["a", "hidden"],
      }),
    );

    const row = auditRow();
    expect(row.metadata.exported_block_keys).toEqual(["a"]);
    expect(row.metadata.exported_block_count).toBe(1);
  });
});
