/**
 * PreviewPane.tsx
 * ───────────────
 * FPS-024 — Right panel A4 live preview in an iframe.
 *
 * Debounces block changes (~300ms) and re-renders the preview HTML.
 * Display only — no database interaction.
 *
 * Source-truth safety: Display only. No database writes.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { Maximize2, Minimize2, Files, ScrollText } from "lucide-react";
import {
  buildPreviewHTML,
  selectRenderedBlocks,
  DEFAULT_BRANDING,
  type BrandingProfile,
  type PreviewOptions,
} from "@/lib/final-pack-preview";
import type { OutputBlock } from "@/lib/final-pack-loader";

interface PreviewPaneProps {
  blocks: OutputBlock[];
  branding: BrandingProfile | null;
  exportMode: "draft" | "test" | "final";
  customerName: string;
  refNumber: string;
  date: string;
  layout?: Record<string, unknown> | null;
  volumeBlockKeys?: string[] | null;
}

export default function PreviewPane({
  blocks,
  branding,
  exportMode,
  customerName,
  refNumber,
  date,
  layout,
  volumeBlockKeys,
}: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);
  // FPS-010 Ticket 3 — paginated visual mode (page gutters at breaks). Screen
  // aid only; final pagination follows the print/PDF engine. Persisted.
  const [paginated, setPaginated] = useState<boolean>(() => {
    try { return localStorage.getItem("fps.paginatedPreview") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("fps.paginatedPreview", paginated ? "1" : "0"); } catch { /* ignore */ }
  }, [paginated]);

  // Debounced preview HTML generation
  const [previewHtml, setPreviewHtml] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options: PreviewOptions = useMemo(
    () => ({
      blocks,
      branding: branding || DEFAULT_BRANDING,
      exportMode,
      customerName,
      refNumber,
      date,
      layout,
      volumeBlockKeys,
      paginated,
    }),
    [blocks, branding, exportMode, customerName, refNumber, date, layout, volumeBlockKeys, paginated],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        setPreviewHtml(buildPreviewHTML(options));
      } catch (err) {
        // A render failure must be visible. Previously this threw inside a
        // timer: the pane silently kept stale HTML (or stayed blank).
        console.error("[FPS Preview] Failed to render preview:", err);
        const message = err instanceof Error ? err.message : "Unknown render error";
        setPreviewHtml(
          `<!DOCTYPE html><html><body style="font-family:system-ui;padding:32px;color:#92400e">` +
            `<h2 style="margin:0 0 8px">Preview could not be rendered</h2>` +
            `<p style="margin:0 0 8px;color:#6b7280">Your document content is unchanged and still saved. ` +
            `Export may also fail until the offending block is corrected.</p>` +
            `<pre style="white-space:pre-wrap;font-size:12px;color:#6b7280">${
              message.replace(/</g, "&lt;")
            }</pre></body></html>`,
        );
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [options]);

  // Write to iframe via srcdoc
  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      iframeRef.current.srcdoc = previewHtml;
    }
  }, [previewHtml]);

  // The counter must equal what the pane actually renders (volume filter and
  // the cover_page layout flag included) — same function the renderer uses.
  const visibleCount = selectRenderedBlocks(blocks, { volumeBlockKeys, layout }).length;
  const totalCount = blocks.length;

  return (
    <div
      className={`fps-preview-pane ${expanded ? "fps-preview-expanded" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Preview</span>
          <span className="text-[10px] text-muted-foreground">
            {visibleCount}/{totalCount} blocks
          </span>
          {exportMode !== "final" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium uppercase">
              {exportMode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Paginated vs continuous view (FPS-010 Ticket 3) */}
          <button
            onClick={() => setPaginated((p) => !p)}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent transition-colors text-[10px] font-medium text-muted-foreground"
            title={
              paginated
                ? "Showing page boundaries at page breaks. Final pagination follows the print/PDF engine. Click for continuous view."
                : "Continuous view. Click to show page boundaries at page breaks."
            }
          >
            {paginated ? (
              <Files className="h-3.5 w-3.5" />
            ) : (
              <ScrollText className="h-3.5 w-3.5" />
            )}
            {paginated ? "Pages" : "Continuous"}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-accent transition-colors"
            title={expanded ? "Collapse preview" : "Expand preview"}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* A4 preview iframe */}
      <div className="fps-preview-container">
        <iframe
          ref={iframeRef}
          title="Final Pack Preview"
          className="fps-preview-iframe"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
