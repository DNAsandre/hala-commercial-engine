/**
 * final-pack-pdf.ts
 * ─────────────────
 * FPS-012/013 — Programmatic PDF export foundation.
 *
 * Two responsibilities:
 *  1. mergeCoverAndBody() — PURE pdf-lib merge: prepend one page of an imported
 *     PDF cover before the generated body PDF. Deterministic + unit-tested.
 *  2. htmlToBodyPdfBytes() — render the preview HTML to a body PDF (html2pdf.js).
 *
 * The imported PDF cover is used STATICALLY — pages are copied byte-for-byte by
 * pdf-lib. Nothing is parsed into editable content (no text/font/shape extraction).
 *
 * Everything here is best-effort and NEVER throws into the export flow — the
 * caller (final-pack-export) falls back to the always-available browser-print
 * path on any failure. No gate, no lock, no prison.
 */

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Merge an imported PDF cover (one page) in front of a body PDF.
 * - coverBytes: the imported PDF file bytes.
 * - bodyBytes: the generated body PDF bytes.
 * - coverPage1Based: which page of the cover to use (default 1; clamped to range).
 * Returns the merged PDF bytes. Throws only on genuinely invalid PDF input
 * (caller wraps in try/catch).
 */
export async function mergeCoverAndBody(
  coverBytes: Uint8Array,
  bodyBytes: Uint8Array,
  coverPage1Based = 1,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  // Cover: copy exactly one (clamped) page.
  const cover = await PDFDocument.load(coverBytes);
  const coverCount = cover.getPageCount();
  const idx = Math.min(Math.max((coverPage1Based || 1) - 1, 0), coverCount - 1);
  const [coverPage] = await out.copyPages(cover, [idx]);
  out.addPage(coverPage);

  // Body: copy all pages, in order, after the cover.
  const body = await PDFDocument.load(bodyBytes);
  const bodyPages = await out.copyPages(body, body.getPageIndices());
  for (const p of bodyPages) out.addPage(p);

  return out.save();
}

/** Options forwarded to html2pdf for body rendering. */
export interface BodyPdfOptions {
  /** A filename hint (not the saved name — we control download separately). */
  title?: string;
  /** When false, return null instead of degrading to the text-only renderer. */
  allowTextFallback?: boolean;
  /**
   * Presentation stamped onto every generated page. `false` returns an
   * undecorated body so a caller can merge a real cover first and stamp the
   * completed document exactly once.
   */
  presentation?: PdfPresentation | false;
}

export interface PdfPresentation {
  watermark?: string;
  footerText?: string;
  showPageNumbers?: boolean;
}

/**
 * Render a full preview-HTML document string to a body PDF (Uint8Array).
 *
 * Two-tier renderer so the imported-PDF-cover export ALWAYS produces a real body:
 *  1. html2pdf.js (html2canvas + jsPDF) — high-fidelity rasterization. Works in
 *     normal browsers; can render blank in fully sandboxed/agent browsers.
 *  2. jsPDF text fallback — a clean, text-only body that works everywhere
 *     (no html2canvas). Honors page breaks + Draft/Test watermark labels.
 *
 * Returns null only if BOTH paths fail (caller then uses browser-print). Never
 * throws into the export flow.
 */
export async function htmlToBodyPdfBytes(
  html: string,
  opts: BodyPdfOptions = {},
): Promise<Uint8Array | null> {
  const result = await htmlToBodyPdf(html, opts);
  return result?.bytes ?? null;
}

/** Which tier actually produced the body PDF (PDS-12). */
export type BodyPdfRenderer = "html2canvas" | "text_fallback";

/**
 * PADW T06e (PDS-12): tier-reporting variant. Callers that record or display
 * the renderer MUST use this — the silent degradation to the text-only body
 * (branding, colors, images, table structure gone) was previously reported
 * identically to the high-fidelity render, in the UI and in the audit row.
 */
export async function htmlToBodyPdf(
  html: string,
  opts: BodyPdfOptions = {},
): Promise<{ bytes: Uint8Array; renderer: BodyPdfRenderer } | null> {
  const hi = await tryHtml2Pdf(html, opts);
  if (hi && hi.length > 0) return { bytes: hi, renderer: "html2canvas" };
  if (opts.allowTextFallback === false) return null;
  // Fallback: always-works text body (no html2canvas dependency).
  const text = await textBodyPdfBytes(html, opts.presentation);
  return text && text.length > 0 ? { bytes: text, renderer: "text_fallback" } : null;
}

/** High-fidelity rasterized body via html2pdf.js. Returns null on any failure. */
async function tryHtml2Pdf(html: string, opts: BodyPdfOptions): Promise<Uint8Array | null> {
  let host: HTMLIFrameElement | null = null;
  try {
    const mod = await import("html2pdf.js");
    const html2pdf = (mod as { default?: unknown }).default ?? mod;

    host = document.createElement("iframe");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    const idoc = host.contentDocument;
    if (!idoc) return null;
    idoc.open();
    idoc.write(html);
    idoc.close();
    await waitForDocumentAssets(idoc);

    const presentation = opts.presentation === undefined
      ? presentationFromDocument(idoc)
      : opts.presentation;
    // html2canvas turns fixed overlays into first-page-only pixels. Remove them
    // from the raster source and stamp them with pdf-lib on every page instead.
    idoc.querySelectorAll(".fps-watermark, .fps-footer").forEach((node) => node.remove());

    const worker = (html2pdf as () => {
      set: (o: unknown) => { from: (el: unknown) => { outputPdf: (t: string) => Promise<ArrayBuffer> } };
    })();
    const arrayBuffer = await worker
      .set({
        margin: 0,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(idoc.body)
      .outputPdf("arraybuffer");

    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length === 0) return null;
    return presentation === false ? bytes : decoratePdfPages(bytes, presentation);
  } catch {
    return null;
  } finally {
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }
}

/**
 * Text-only body PDF via jsPDF. No html2canvas — works in every environment.
 * Walks the rendered `.fps-doc`, honoring `.fps-page-break` and skipping the
 * cover placeholder (the real cover is prepended separately). Stamps the
 * Draft/Test watermark label if present. Returns null only on hard failure.
 */
export async function textBodyPdfBytes(
  html: string,
  requestedPresentation?: PdfPresentation | false,
): Promise<Uint8Array | null> {
  try {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const maxW = pageW - margin * 2;
    let y = margin;

    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.querySelector(".fps-doc") || doc.body;
    const presentation = requestedPresentation === undefined
      ? presentationFromDocument(doc)
      : requestedPresentation;

    const newPage = () => { pdf.addPage(); y = margin; };

    const children = Array.from((root as HTMLElement).children) as HTMLElement[];
    for (const el of children) {
      if (el.classList.contains("fps-page-break")) { newPage(); continue; }
      if (el.classList.contains("fps-cover")) continue; // cover handled separately
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const isHeading = !!el.querySelector("h1, h2") || /^H[12]$/.test(el.tagName);
      pdf.setFontSize(isHeading ? 15 : 11);
      const lines = pdf.splitTextToSize(text, maxW) as string[];
      for (const line of lines) {
        if (y + 16 > pageH - margin) newPage();
        pdf.text(line, margin, y);
        y += 16;
      }
      y += 10;
    }

    const bytes = new Uint8Array(pdf.output("arraybuffer"));
    return presentation === false ? bytes : decoratePdfPages(bytes, presentation);
  } catch {
    return null;
  }
}

/**
 * Wait for the exact document being captured: fonts first, then every image.
 * A bounded timeout keeps export available when a remote asset is genuinely
 * unreachable, while removing the old fixed-delay race.
 */
export async function waitForDocumentAssets(doc: Document, timeoutMs = 10_000): Promise<void> {
  const waits: Promise<unknown>[] = [];
  if (doc.fonts?.ready) waits.push(Promise.resolve(doc.fonts.ready));

  for (const image of Array.from(doc.images ?? [])) {
    if (image.complete && image.naturalWidth > 0) continue;
    if (typeof image.decode === "function") {
      waits.push(image.decode().catch(() => undefined));
      continue;
    }
    waits.push(new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }));
  }

  if (waits.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(waits),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Stamp watermark/footer/page count on every page of a generated PDF. */
export async function decoratePdfPages(
  bytes: Uint8Array,
  presentation: PdfPresentation = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const watermark = asciiForPdf(presentation.watermark);
  const footer = asciiForPdf(presentation.footerText);

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    if (watermark) {
      const size = Math.min(72, Math.max(44, width / 8));
      const textWidth = font.widthOfTextAtSize(watermark, size);
      page.drawText(watermark, {
        x: Math.max(24, (width - textWidth) / 2),
        y: height / 2,
        size,
        font,
        color: rgb(0.55, 0.55, 0.55),
        opacity: 0.16,
        rotate: degrees(45),
      });
    }

    const pageLabel = presentation.showPageNumbers
      ? `Page ${index + 1} of ${pages.length}`
      : "";
    if (footer) {
      page.drawText(footer.slice(0, 110), {
        x: 36,
        y: 20,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    if (pageLabel) {
      const labelWidth = font.widthOfTextAtSize(pageLabel, 8);
      page.drawText(pageLabel, {
        x: Math.max(36, width - 36 - labelWidth),
        y: 20,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  });

  return pdf.save();
}

function presentationFromDocument(doc: Document): PdfPresentation {
  const footer = doc.querySelector(".fps-footer");
  return {
    watermark: (doc.querySelector(".fps-watermark")?.textContent || "").trim(),
    footerText: (footer?.querySelector("span")?.textContent || "").trim(),
    showPageNumbers: Boolean(footer?.querySelector(".fps-footer-page-number")),
  };
}

function asciiForPdf(value?: string): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
