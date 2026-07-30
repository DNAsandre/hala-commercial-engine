/**
 * server-pdf.ts
 * ─────────────
 * FPS-007-02/03 — Server-side PDF render contract + feature flag.
 *
 * IMPORTANT (inspection finding 2026-06-22): the existing server PDF route
 * (`/api/documents/generate-pdf`) renders with PDFKit from SOURCE data
 * (buildRenderContext) for quote/proposal — it does NOT render FinalPackStudio's
 * edited-block HTML, and no headless-Chromium HTML→PDF renderer is installed.
 * Routing Final PDF through it would produce a DIFFERENT document than the one
 * the user edited (violating "same document truth").
 *
 * Therefore server export is FEATURE-FLAGGED OFF. The client native-print path
 * remains the primary, always-available exporter (no gate, no dependency
 * prison). When a faithful HTML→PDF server route exists, flip the flag and
 * implement tryServerFinalPdf — the call site already falls back to client.
 */

export interface ServerPdfRequest {
  doc_instance_id: string;
  export_mode: "draft" | "test" | "final";
  volume_key?: string | null;
  branding_profile_id?: string | null;
  /** The exact HTML the client would print — the source of truth for fidelity. */
  rendered_html: string;
  source_mode?: string;
  pack_type?: string;
  compiled_by: string;
}

export interface ServerPdfResult {
  success: boolean;
  download_url?: string;
  error?: string;
  renderer: "server";
}

/**
 * Whether server-side PDF rendering is enabled. OFF until a faithful HTML→PDF
 * server route is available. Wired to an env flag so it can be turned on per
 * environment without code changes.
 */
export function isServerPdfEnabled(): boolean {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.VITE_FPS_SERVER_PDF === "true";
  } catch {
    return false;
  }
}

/**
 * Attempt a server-side Final PDF render. Returns null when disabled/unavailable
 * so the caller falls back to the client export. Never throws into the export
 * flow. (Stub until faithful server HTML→PDF infra exists.)
 */
export async function tryServerFinalPdf(_req: ServerPdfRequest): Promise<ServerPdfResult | null> {
  if (!isServerPdfEnabled()) return null;
  // Placeholder: a faithful HTML→PDF server route is not yet available.
  // Returning null keeps the client export as the guaranteed path.
  return null;
}
