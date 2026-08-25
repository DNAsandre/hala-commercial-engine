/**
 * final-pack-export.ts
 * ────────────────────
 * FPS-027 — Export engine for Final Pack Studio.
 *
 * Generates PDFs (via html2pdf.js), HTML downloads, and print preview.
 * Writes audit trail to doc_compiled_outputs on every export.
 *
 * CRITICAL RULES:
 * - All exports ALWAYS work. No conditions. No bot checks.
 * - No reading can_export_to_pdf_studio.
 * - No "resolve issues first" modals.
 * - Writes to doc_compiled_outputs only (audit).
 * - Does NOT write to commercial_tickets.
 * - Does NOT modify doc_instances.blocks.
 *
 * Source-truth safety: Writes to doc_compiled_outputs only.
 */

import { supabase } from "./supabase";
import {
  buildPreviewHTML,
  selectRenderedBlocks,
  type BrandingProfile,
  type PreviewOptions,
} from "./final-pack-preview";
import type { OutputBlock } from "./final-pack-loader";
import { tryServerFinalPdf } from "./server-pdf";
import {
  decoratePdfPages,
  htmlToBodyPdf,
  htmlToBodyPdfBytes,
  mergeCoverAndBody,
  waitForDocumentAssets,
  type BodyPdfRenderer,
  type PdfPresentation,
} from "./final-pack-pdf";
import { fetchAssetBytes } from "./cover-asset-storage";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type ExportMode = "draft" | "test" | "final";
export type ExportAction = "pdf" | "html" | "print";

export interface ExportRequest {
  instanceId: string;
  templateId: string;
  blocks: OutputBlock[];
  branding: BrandingProfile;
  exportMode: ExportMode;
  action: ExportAction;
  customerName: string;
  title: string;
  refNumber: string;
  date: string;
  compiledBy: string;
  // ── Optional metadata context (FPS-002-12) — advisory audit only ──
  sourceMode?: string;
  sourceKind?: string;
  creationMethod?: string;
  templateVersionId?: string | null;
  templateClass?: string;
  instanceLastEditedAt?: string | null;
  /** Template layout config (FPS-004); missing/invalid → safe defaults. */
  layout?: Record<string, unknown> | null;
  // ── Volume context (FPS-006) — optional; absent = full document ──
  volumeKey?: string | null;
  volumeTitle?: string | null;
  volumeBlockKeys?: string[] | null;
}

/**
 * W04-C4: what the browser ACTUALLY did.
 *
 * `print_dialog_opened` is the honest description of the native "Save as PDF"
 * path: the print pipeline was invoked. Whether the user then saved a file is
 * not observable from this page, so it must never be reported as "a PDF was
 * written".
 */
export type ExportDelivery =
  | "file_downloaded"        // bytes handed to the browser as a download
  | "print_dialog_opened"    // print pipeline invoked; the file is the user's to save
  | "print_window_opened"    // printable document opened, but print() could not be invoked
  | "server_file_opened";    // a server-rendered file URL was opened

export interface ExportResult {
  success: boolean;
  error?: string;
  auditId?: string;
  /** What was actually done. Absent on failure. */
  delivered?: ExportDelivery;
  /**
   * W04-C4: whether the doc_compiled_outputs audit row was CONFIRMED stored.
   * The insert error used to be swallowed, so a lost audit row looked identical
   * to a recorded one.
   */
  auditPersisted?: boolean;
  auditError?: string;
  /**
   * PADW T06e (PDS-12): set when the produced file came from the text-only
   * fallback renderer (branding, colors, images and table layout are absent).
   * The UI shows this note; the audit row records the distinct renderer.
   */
  rendererNote?: string;
  /** Other honest fidelity advisories, such as an image that could not be embedded. */
  advisoryNotes?: string[];
  /** Truthful doc_instances lifecycle after a final-mode export. */
  instanceStatus?: "compiled" | "exported";
  instanceStatusPersisted?: boolean;
  instanceStatusError?: string;
}

// ═══════════════════════════════════════════════════════════
// Main export function
// ═══════════════════════════════════════════════════════════

/**
 * Execute an export action.
 * No conditions, no gates.
 * Writes an audit row to doc_compiled_outputs and reports whether it landed.
 */
export async function executeExport(req: ExportRequest): Promise<ExportResult> {
  const auditId = `dco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // W04-C4: the set that is actually exported — the same selection the renderer
  // consumes, so the audit counts describe the produced document rather than
  // the whole instance.
  const exportedBlocks = safeSelectExportedBlocks(req);

  try {
    // Build preview HTML
    const options: PreviewOptions = {
      blocks: req.blocks,
      branding: req.branding,
      exportMode: req.exportMode,
      customerName: req.customerName,
      refNumber: req.refNumber,
      date: req.date,
      compiledBy: req.compiledBy,
      layout: req.layout,
      volumeBlockKeys: req.volumeBlockKeys ?? null,
    };
    let html = buildPreviewHTML(options);
    const advisoryNotes: string[] = [];
    if (req.action === "html") {
      const embedded = await embedRemoteImagesInHtml(html);
      html = embedded.html;
      if (embedded.unresolved.length > 0) {
        advisoryNotes.push(
          `${embedded.unresolved.length} image${embedded.unresolved.length === 1 ? "" : "s"} could not be embedded in the HTML file and may stop displaying when its temporary link expires.`,
        );
      }
    }

    // Execute the action. PDF first attempts a high-fidelity browser download
    // over the same HTML used by Preview. Print remains the native print path,
    // and PDF falls back to it when the browser renderer cannot return bytes.
    // FPS-007: Final PDF first attempts a server render (feature-flagged OFF by
    // default); it ALWAYS falls back to the client path, so export never gates.
    let renderer:
      | "client"
      | "server"
      | "client-pdf"
      | "client-pdf-merge"
      | "client-pdf-merge-text-fallback" = "client";
    let delivered: ExportDelivery = "print_dialog_opened";
    // PDS-12: set when the text-only fallback produced the file.
    let rendererNote: string | undefined;

    // FPS-013: when this document has an imported PDF cover, a PDF export tries
    // the programmatic merge path (pdf-lib prepends the cover as static page 1).
    // ANY failure → advisory + the always-available browser-print fallback.
    const importedCover = req.action === "pdf" ? findImportedPdfCover(req.blocks) : null;

    if (req.action === "html") {
      downloadHtml(html, req);
      delivered = "file_downloaded";
    } else if (importedCover) {
      const merged = await tryImportedPdfExport(html, req, importedCover);
      if (merged) {
        // PDS-12: the text-only body is a REAL fidelity downgrade — record it
        // distinctly and tell the user, never report it as the high-fidelity
        // render.
        if (merged === "text_fallback") {
          renderer = "client-pdf-merge-text-fallback";
          rendererNote =
            "The high-fidelity renderer was unavailable, so the body of this file was produced by the text-only fallback: branding, colors, images and table layout are not included. Use Print → Save as PDF for a full-fidelity copy.";
        } else {
          renderer = "client-pdf-merge";
        }
        delivered = "file_downloaded";
      } else {
        // Fallback: browser-print of the body (with the placeholder cover page).
        // Never blocks — the user still gets a PDF, just without the merged cover.
        renderer = "client";
        delivered = await openPrintablePdf(markImportedCoverUnavailable(html), req);
      }
    } else if (req.action === "pdf" && req.exportMode === "final") {
      const serverResult = await tryServerFinalPdf({
        doc_instance_id: req.instanceId,
        export_mode: "final",
        volume_key: req.volumeKey ?? null,
        branding_profile_id: req.branding.id,
        rendered_html: html,
        source_mode: req.sourceMode,
        compiled_by: req.compiledBy,
      });
      if (serverResult && serverResult.success && serverResult.download_url) {
        renderer = "server";
        const opened = window.open(serverResult.download_url, "_blank");
        if (!opened) {
          throw new Error(
            "The server-rendered file is ready, but the browser blocked its window. Please allow pop-ups and export again.",
          );
        }
        delivered = "server_file_opened";
      } else {
        const downloaded = await tryDirectPdfExport(html, req);
        if (downloaded) {
          renderer = "client-pdf";
          delivered = "file_downloaded";
        } else {
          delivered = await openPrintablePdf(html, req);
        }
      }
    } else if (req.action === "pdf") {
      const downloaded = await tryDirectPdfExport(html, req);
      if (downloaded) {
        renderer = "client-pdf";
        delivered = "file_downloaded";
      } else {
        delivered = await openPrintablePdf(html, req);
      }
    } else {
      // Explicit Print action → native client print.
      delivered = await openPrintablePdf(html, req);
    }

    // Write audit row (records which renderer was used, and the exported set).
    // W04-C4: the insert result is no longer discarded.
    const audit = await writeAuditRow(auditId, req, "success", undefined, renderer, exportedBlocks);

    // The engine reports the truthful requested lifecycle only. PdfStudio owns
    // persistence because it also owns the optimistic-concurrency token used by
    // the next edit; mutating updated_at here would strand that token.
    const instanceStatus = req.exportMode === "final"
      ? (delivered === "file_downloaded" || delivered === "server_file_opened"
        ? "exported" as const
        : "compiled" as const)
      : undefined;

    return {
      success: true,
      auditId,
      delivered,
      auditPersisted: audit.persisted,
      auditError: audit.error,
      rendererNote,
      advisoryNotes,
      instanceStatus,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown export error";
    console.error("[FPS Export] Error:", err);

    // Still write audit row on failure (best-effort; never affects export result).
    // Live doc_compiled_outputs.status CHECK allows only 'success' | 'failed'.
    // Nothing was produced, so the exported set is empty — not the whole document.
    const audit = await writeAuditRow(auditId, req, "failed", errorMessage, "client", []);

    return {
      success: false,
      error: errorMessage,
      auditId,
      auditPersisted: audit.persisted,
      auditError: audit.error,
    };
  }
}

/**
 * The blocks this export actually produces, using the SAME selection function
 * the renderer uses (visibility + volume filter + cover_page layout flag).
 * Never throws — audit metadata must not be able to break an export.
 */
function safeSelectExportedBlocks(req: ExportRequest): OutputBlock[] {
  try {
    return selectRenderedBlocks(req.blocks, {
      volumeBlockKeys: req.volumeBlockKeys ?? null,
      layout: req.layout ?? null,
    });
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// PDF export via native browser print (Save as PDF)
// ═══════════════════════════════════════════════════════════

/**
 * Open the rendered HTML in a new window and trigger the browser's native
 * print dialog (the user chooses "Save as PDF"). print() is invoked from the
 * OPENER context, so it works even when the new window's own scripts are
 * sandbox-blocked. This is reliable across normal, embedded, and agent
 * browsers — unlike html2canvas, which renders blank when its capture iframe
 * is sandboxed.
 */
async function openPrintablePdf(html: string, req: ExportRequest): Promise<ExportDelivery> {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error(
      "Could not open the print window. Please allow pop-ups for this site, then export again.",
    );
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Hint the default "Save as PDF" filename via the document title.
  try {
    printWindow.document.title = buildFilename(req, "pdf").replace(/\.pdf$/i, "");
  } catch {
    /* non-fatal */
  }

  // Capture only after the exact print document has resolved its fonts/images.
  // This replaces the fixed 800ms timer and leaves no timer behind after export.
  await waitForDocumentAssets(printWindow.document);
  try {
    printWindow.focus();
    printWindow.print();
    return "print_dialog_opened";
  } catch {
    // The printable document remains available for manual Ctrl+P. We state that
    // precisely rather than claiming the native dialog opened.
    return "print_window_opened";
  }
}

// ═══════════════════════════════════════════════════════════
// FPS-013 — Imported PDF cover (static page 1) export
// ═══════════════════════════════════════════════════════════

interface ImportedPdfCover {
  path: string;
  page: number;
}

/** Detect an imported PDF cover on the document's cover block (advisory read). */
function findImportedPdfCover(blocks: OutputBlock[]): ImportedPdfCover | null {
  const cover = blocks.find((b) => b.render_key === "cover_hero");
  const cfg = cover?.content?.cover_config;
  if (
    cfg?.cover_mode === "imported_pdf" &&
    typeof cfg.imported_pdf_path === "string" &&
    cfg.imported_pdf_path.trim()
  ) {
    return { path: cfg.imported_pdf_path.trim(), page: cfg.imported_pdf_page || 1 };
  }
  return null;
}

/**
 * Render the body PDF, prepend the imported PDF cover page, and download.
 * Returns true on success; false (never throws) so the caller falls back to
 * browser-print. The imported PDF is copied byte-for-byte — never converted.
 */
async function tryImportedPdfExport(
  html: string,
  req: ExportRequest,
  cover: ImportedPdfCover,
): Promise<BodyPdfRenderer | null> {
  try {
    // PDS-12: the tier that produced the body is reported to the caller so a
    // text-only downgrade is never recorded as the high-fidelity render.
    const body = await htmlToBodyPdf(hideImportedCoverPlaceholder(html), {
      title: req.title,
      presentation: false,
    });
    if (!body || body.bytes.length === 0) return null;
    const coverBytes = await fetchAssetBytes(cover.path);
    if (!coverBytes || coverBytes.length === 0) return null;
    const merged = await mergeCoverAndBody(coverBytes, body.bytes, cover.page);
    if (!merged || merged.length === 0) return null;
    // Stamp after merge so the imported cover and every body page have the same
    // draft/test watermark and footer/page-number treatment.
    const decorated = await decoratePdfPages(merged, pdfPresentationFor(req));
    downloadPdfBytes(decorated, buildFilename(req, "pdf"));
    return body.renderer;
  } catch {
    return null;
  }
}

/**
 * Download a high-fidelity PDF directly from the exact Preview HTML. If the
 * browser cannot rasterize that HTML, return false and let the caller use the
 * native Print/Save-as-PDF path. The text-only fallback is intentionally off
 * here because a direct download must preserve the visible document layout.
 */
async function tryDirectPdfExport(html: string, req: ExportRequest): Promise<boolean> {
  try {
    const bytes = await htmlToBodyPdfBytes(html, {
      title: req.title,
      allowTextFallback: false,
      presentation: pdfPresentationFor(req),
    });
    if (!bytes || bytes.length === 0) return false;
    downloadPdfBytes(bytes, buildFilename(req, "pdf"));
    return true;
  } catch {
    return false;
  }
}

function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 100);
}

// ═══════════════════════════════════════════════════════════
// HTML download
// ═══════════════════════════════════════════════════════════

function downloadHtml(html: string, req: ExportRequest): void {
  const filename = buildFilename(req, "html");
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 100);
}

/**
 * Make a downloaded HTML document durable by replacing remote image links with
 * data URLs. Any source that cannot be fetched is left untouched and returned
 * to the caller so the UI can state the limitation honestly.
 */
export async function embedRemoteImagesInHtml(
  html: string,
): Promise<{ html: string; unresolved: string[] }> {
  const sources = new Set<string>();
  const imageSrc = /<img\b[^>]*?\bsrc=(['"])(.*?)\1[^>]*>/gi;
  for (const match of html.matchAll(imageSrc)) {
    const source = match[2]?.trim();
    if (source && !/^(data:|blob:|about:)/i.test(source)) sources.add(source);
  }
  if (sources.size === 0) return { html, unresolved: [] };

  let output = html;
  const unresolved: string[] = [];
  for (const encodedSource of sources) {
    const source = encodedSource.replace(/&amp;/g, "&");
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dataUrl = `data:${blob.type || "application/octet-stream"};base64,${toBase64(bytes)}`;
      output = output.split(encodedSource).join(dataUrl);
    } catch {
      unresolved.push(source);
    }
  }
  return { html: output, unresolved };
}

function toBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// Audit trail
// ═══════════════════════════════════════════════════════════

async function writeAuditRow(
  auditId: string,
  req: ExportRequest,
  status: "success" | "failed",
  errorText: string | undefined,
  renderer: "client" | "server" | "client-pdf" | "client-pdf-merge" | "client-pdf-merge-text-fallback",
  exportedBlocks: OutputBlock[],
): Promise<{ persisted: boolean; error?: string }> {
  const watermarkMap: Record<ExportMode, string> = {
    draft: "DRAFT",
    test: "TEST",
    final: "none",
  };

  const { error } = await supabase.from("doc_compiled_outputs").insert({
    id: auditId,
    doc_instance_id: req.instanceId,
    template_id: req.templateId || null,
    template_version_id: req.templateVersionId || null,
    output_type: req.action === "print" ? "print" : req.action,
    title: req.title,
    customer_name: req.customerName,
    export_mode: req.exportMode,
    watermark: watermarkMap[req.exportMode],
    branding_profile_id: req.branding.id,
    source_mode: req.sourceMode || null,
    source_kind: req.sourceKind || null,
    creation_method: req.creationMethod || null,
    template_class: req.templateClass || null,
    instance_last_edited_at: req.instanceLastEditedAt || null,
    volume_key: req.volumeKey || null,
    volume_title: req.volumeTitle || null,
    compiled_by: req.compiledBy,
    compiled_at: new Date().toISOString(),
    status,
    error_text: errorText || null,
    metadata: {
      // W04-C4: these used to be whole-document counts even for a volume
      // export, so the audit trail described a document that was never
      // produced. They now describe the set that was actually exported.
      block_count: req.blocks.length,                  // the instance, for context
      visible_block_count: exportedBlocks.length,      // what this export produced
      exported_block_count: exportedBlocks.length,
      exported_block_keys: exportedBlocks.map((b) => b.block_key),
      volume_scoped: Boolean(req.volumeKey),
      renderer,
    },
  });

  if (error) {
    // W04-C4: no longer swallowed — the caller reports that the export ran but
    // its audit row is not confirmed stored.
    console.error("[FPS Export] Failed to write audit row:", error);
    return { persisted: false, error: error.message ?? String(error) };
  }
  return { persisted: true };
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

export function buildFilename(req: ExportRequest, ext: string, at = new Date()): string {
  const parts = [
    filenamePart(req.customerName, "Customer", 42),
    filenamePart(req.title, "Final-Pack", 58),
    req.refNumber ? filenamePart(`Ref-${req.refNumber}`, "", 30) : "",
    req.volumeKey ? filenamePart(req.volumeTitle || req.volumeKey, "Volume", 38) : "",
    req.exportMode.toUpperCase(),
    at.toISOString().replace(/[-:.]/g, ""),
  ].filter(Boolean);
  return `${parts.join("_")}.${filenamePart(ext, "file", 8).toLowerCase()}`;
}

function filenamePart(value: string, fallback: string, max: number): string {
  const clean = (value || fallback)
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/[^\p{L}\p{N} ._-]+/gu, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[. _-]+|[. _-]+$/g, "")
    .slice(0, max);
  return clean || fallback;
}

function pdfPresentationFor(req: ExportRequest): PdfPresentation {
  const footer: string[] = [];
  const format = req.branding.footer_format;
  if (format.custom_text) footer.push(format.custom_text);
  if (format.show_ref && req.refNumber) footer.push(`Ref: ${req.refNumber}`);
  if (format.show_date && req.date) footer.push(req.date);
  if (format.show_completed_by && req.compiledBy) footer.push(`Prepared by: ${req.compiledBy}`);
  return {
    watermark: req.exportMode === "final" ? "" : req.exportMode.toUpperCase(),
    footerText: footer.join(" | "),
    showPageNumbers: format.show_page_numbers,
  };
}

/** Make an imported-cover print fallback truthful inside the artifact itself. */
export function markImportedCoverUnavailable(html: string): string {
  return html
    .replace(/<p class="fps-cover-pdf-title">Imported PDF cover<\/p>/g,
      '<p class="fps-cover-pdf-title">Imported PDF cover not included</p>')
    .replace(/<p class="fps-cover-pdf-note">Used as static page 1 in PDF export\.<\/p>/g,
      '<p class="fps-cover-pdf-note">The imported cover could not be merged into this print fallback and is not part of this artifact.</p>');
}

/** The real imported page is merged separately; never rasterize its UI card too. */
export function hideImportedCoverPlaceholder(html: string): string {
  const rule = "<style>.fps-cover--imported-pdf{display:none!important}</style>";
  return html.includes("</head>") ? html.replace("</head>", `${rule}</head>`) : `${rule}${html}`;
}

// ═══════════════════════════════════════════════════════════
// Export ALL volumes as separate files (FPS-006-08)
// ═══════════════════════════════════════════════════════════

export interface VolumeForExport {
  volume_key: string;
  volume_title: string;
  block_keys: string[];
}

export interface ExportAllVolumesResult {
  results: {
    volume_key: string;
    success: boolean;
    error?: string;
    /** W04-C4: audit confirmation is per-volume; a lost row is not a silent one. */
    auditPersisted?: boolean;
    auditError?: string;
    instanceStatus?: "compiled" | "exported";
    instanceStatusPersisted?: boolean;
    instanceStatusError?: string;
  }[];
}

/**
 * Export each configured volume as its own HTML file. Uses HTML (not the print
 * dialog) so "Export All" produces N clean, separate files without N dialogs.
 * One volume failing never stops the others; each is audited.
 */
export async function exportAllVolumes(
  base: Omit<ExportRequest, "action" | "volumeKey" | "volumeTitle" | "volumeBlockKeys">,
  volumes: VolumeForExport[],
): Promise<ExportAllVolumesResult> {
  const results: ExportAllVolumesResult["results"] = [];
  for (const v of volumes) {
    const req: ExportRequest = {
      ...base,
      action: "html",
      volumeKey: v.volume_key,
      volumeTitle: v.volume_title,
      volumeBlockKeys: v.block_keys,
    };
    try {
      const r = await executeExport(req);
      results.push({
        volume_key: v.volume_key,
        success: r.success,
        error: r.error,
        auditPersisted: r.auditPersisted,
        auditError: r.auditError,
        instanceStatus: r.instanceStatus,
        instanceStatusPersisted: r.instanceStatusPersisted,
        instanceStatusError: r.instanceStatusError,
      });
    } catch (err) {
      results.push({
        volume_key: v.volume_key,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  return { results };
}
