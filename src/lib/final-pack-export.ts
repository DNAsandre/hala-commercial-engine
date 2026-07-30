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
import { buildPreviewHTML, type BrandingProfile, type PreviewOptions } from "./final-pack-preview";
import type { OutputBlock } from "./final-pack-loader";
import { tryServerFinalPdf } from "./server-pdf";
import { htmlToBodyPdfBytes, mergeCoverAndBody } from "./final-pack-pdf";
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

export interface ExportResult {
  success: boolean;
  error?: string;
  auditId?: string;
}

// ═══════════════════════════════════════════════════════════
// Main export function
// ═══════════════════════════════════════════════════════════

/**
 * Execute an export action.
 * Always succeeds (no conditions, no gates).
 * Writes audit row to doc_compiled_outputs.
 */
export async function executeExport(req: ExportRequest): Promise<ExportResult> {
  const auditId = `dco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Build preview HTML
    const options: PreviewOptions = {
      blocks: req.blocks,
      branding: req.branding,
      exportMode: req.exportMode,
      customerName: req.customerName,
      refNumber: req.refNumber,
      date: req.date,
      layout: req.layout,
      volumeBlockKeys: req.volumeBlockKeys ?? null,
    };
    const html = buildPreviewHTML(options);

    // Execute the action. PDF + Print use the browser's NATIVE print pipeline
    // (Save as PDF) — reliable, vector-quality, works in sandboxed/agent browsers.
    // FPS-007: Final PDF first attempts a server render (feature-flagged OFF by
    // default); it ALWAYS falls back to the client path, so export never gates.
    let renderer: "client" | "server" | "client-pdf-merge" = "client";

    // FPS-013: when this document has an imported PDF cover, a PDF export tries
    // the programmatic merge path (pdf-lib prepends the cover as static page 1).
    // ANY failure → advisory + the always-available browser-print fallback.
    const importedCover = req.action === "pdf" ? findImportedPdfCover(req.blocks) : null;

    if (req.action === "html") {
      downloadHtml(html, req);
    } else if (importedCover) {
      const merged = await tryImportedPdfExport(html, req, importedCover);
      if (merged) {
        renderer = "client-pdf-merge";
      } else {
        // Fallback: browser-print of the body (with the placeholder cover page).
        // Never blocks — the user still gets a PDF, just without the merged cover.
        renderer = "client";
        openPrintablePdf(html, req);
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
        window.open(serverResult.download_url, "_blank");
      } else {
        openPrintablePdf(html, req); // client fallback
      }
    } else {
      // Draft/Test PDF + Print → native client print.
      openPrintablePdf(html, req);
    }

    // Write audit row (records which renderer was used).
    await writeAuditRow(auditId, req, "success", undefined, renderer);

    return { success: true, auditId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown export error";
    console.error("[FPS Export] Error:", err);

    // Still write audit row on failure (best-effort; never affects export result).
    // Live doc_compiled_outputs.status CHECK allows only 'success' | 'failed'.
    await writeAuditRow(auditId, req, "failed", errorMessage, "client");

    return { success: false, error: errorMessage, auditId };
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
function openPrintablePdf(html: string, req: ExportRequest): void {
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

  // Trigger print from the opener. onload may not fire after document.write(),
  // so use a timeout fallback. Never throws into the export flow.
  let printed = false;
  const trigger = () => {
    if (printed) return;
    printed = true;
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      /* user can still Ctrl+P; export is never blocked */
    }
  };
  printWindow.onload = trigger;
  setTimeout(trigger, 800);
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
): Promise<boolean> {
  try {
    const bodyBytes = await htmlToBodyPdfBytes(html, { title: req.title });
    if (!bodyBytes || bodyBytes.length === 0) return false;
    const coverBytes = await fetchAssetBytes(cover.path);
    if (!coverBytes || coverBytes.length === 0) return false;
    const merged = await mergeCoverAndBody(coverBytes, bodyBytes, cover.page);
    if (!merged || merged.length === 0) return false;
    downloadPdfBytes(merged, buildFilename(req, "pdf"));
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
    if (a.parentNode) document.body.removeChild(a);
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
    document.body.removeChild(a);
  }, 100);
}

// ═══════════════════════════════════════════════════════════
// Audit trail
// ═══════════════════════════════════════════════════════════

async function writeAuditRow(
  auditId: string,
  req: ExportRequest,
  status: "success" | "failed",
  errorText?: string,
  renderer: "client" | "server" | "client-pdf-merge" = "client",
): Promise<void> {
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
      block_count: req.blocks.length,
      visible_block_count: req.blocks.filter((b) => b.visible).length,
      renderer,
    },
  });

  if (error) {
    console.error("[FPS Export] Failed to write audit row:", error);
  }
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function buildFilename(req: ExportRequest, ext: string): string {
  const sanitized = (req.title || "Final-Pack")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  // FPS-006: include the volume key/title in the filename when exporting a volume.
  const vol = req.volumeKey
    ? `_${(req.volumeTitle || req.volumeKey).replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_")}`
    : "";
  const mode = req.exportMode.toUpperCase();
  const date = new Date().toISOString().slice(0, 10);
  return `${sanitized}${vol}_${mode}_${date}.${ext}`;
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
  results: { volume_key: string; success: boolean; error?: string }[];
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
      results.push({ volume_key: v.volume_key, success: r.success, error: r.error });
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
