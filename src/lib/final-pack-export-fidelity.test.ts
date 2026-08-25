import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";

vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

import { buildPreviewHTML, DEFAULT_BRANDING } from "./final-pack-preview";
import { decoratePdfPages, waitForDocumentAssets } from "./final-pack-pdf";

describe("PDF page presentation", () => {
  it("stamps draft truth, footer and page count on every generated page", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    source.addPage();
    const bytes = await source.save();
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");

    const decorated = await decoratePdfPages(bytes, {
      watermark: "DRAFT",
      footerText: "CONFIDENTIAL | Prepared by: tester@hala.test",
      showPageNumbers: true,
    });

    const rendered = await PDFDocument.load(decorated);
    expect(rendered.getPageCount()).toBe(2);
    expect(drawText.mock.calls.filter(([text]) => text === "DRAFT")).toHaveLength(2);
    expect(drawText.mock.calls.some(([text]) => text === "Page 1 of 2")).toBe(true);
    expect(drawText.mock.calls.some(([text]) => text === "Page 2 of 2")).toBe(true);
    expect(drawText.mock.calls.filter(([text]) => String(text).startsWith("CONFIDENTIAL"))).toHaveLength(2);
    drawText.mockRestore();
  });

  it("does not invent a watermark for final output", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const bytes = await source.save();
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");

    await decoratePdfPages(bytes, { watermark: "", showPageNumbers: true });

    expect(drawText.mock.calls.some(([text]) => text === "DRAFT" || text === "TEST")).toBe(false);
    expect(drawText.mock.calls.some(([text]) => text === "Page 1 of 1")).toBe(true);
    drawText.mockRestore();
  });
});

describe("capture readiness", () => {
  it("waits for both document fonts and image decoding", async () => {
    let resolveFonts!: () => void;
    let resolveImage!: () => void;
    const fonts = new Promise<void>((resolve) => { resolveFonts = resolve; });
    const image = new Promise<void>((resolve) => { resolveImage = resolve; });
    const doc = {
      fonts: { ready: fonts },
      images: [{ complete: false, naturalWidth: 0, decode: () => image }],
    } as unknown as Document;

    let finished = false;
    const waiting = waitForDocumentAssets(doc, 1_000).then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    resolveFonts();
    await Promise.resolve();
    expect(finished).toBe(false);
    resolveImage();
    await waiting;
    expect(finished).toBe(true);
  });
});

describe("preview/export footer and mode truth", () => {
  const blocks = [{
    id: "b1",
    block_key: "intro",
    render_key: "narrative",
    family: "commercial",
    editor_mode: "wysiwyg",
    display_name: "Introduction",
    visible: true,
    order: 1,
    required: false,
    content: { html: "<p>Authored text</p>", source_status: "populated" },
    default_content: "",
    schema_config: {},
    permissions: {},
  }] as any;

  it("honors completed-by and page-number footer settings", () => {
    const html = buildPreviewHTML({
      blocks,
      branding: DEFAULT_BRANDING,
      exportMode: "draft",
      customerName: "Hala UAT",
      refNumber: "R-10",
      date: "2026-08-25",
      compiledBy: "amin@hala.test",
    });
    expect(html).toContain("Prepared by: amin@hala.test");
    expect(html).toContain("fps-footer-page-number");
    expect(html).toContain(">DRAFT</div>");
  });

  it("renders final preview HTML without a draft/test watermark", () => {
    const html = buildPreviewHTML({
      blocks,
      branding: DEFAULT_BRANDING,
      exportMode: "final",
      customerName: "Hala UAT",
      refNumber: "R-10",
      date: "2026-08-25",
      compiledBy: "amin@hala.test",
    });
    expect(html).not.toContain('<div class="fps-watermark">');
  });
});
