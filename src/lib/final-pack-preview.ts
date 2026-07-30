/**
 * final-pack-preview.ts
 * ─────────────────────
 * FPS-023 — HTML preview generator for Final Pack Studio.
 *
 * Pure function. Reads blocks + branding → produces full HTML string.
 * No database writes. No side effects.
 *
 * Source-truth safety: Pure render function — reads data, produces HTML.
 */

import DOMPurify from "dompurify";
import type { OutputBlock } from "./final-pack-loader";
import { normalizeFinalPackLayout } from "./final-pack-layout";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface BrandingProfile {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  font_heading: string;
  logo_url: string;
  footer_format: FooterFormat;
  header_style: string;
  /** FPS-009 — cover assets (read-only, from doc_branding_profiles). Optional/safe. */
  cover_hero_urls?: string[];
  watermark_url?: string | null;
}

export interface FooterFormat {
  show_ref: boolean;
  show_date: boolean;
  show_completed_by: boolean;
  show_page_numbers: boolean;
  custom_text: string;
}

export interface PreviewOptions {
  blocks: OutputBlock[];
  branding: BrandingProfile;
  exportMode: "draft" | "test" | "final";
  customerName: string;
  refNumber: string;
  date: string;
  /** Template layout config (FPS-004). Missing/invalid → safe defaults. */
  layout?: Record<string, unknown> | null;
  /**
   * Volume filter (FPS-006): when set, only blocks whose block_key is in this
   * list render (document order preserved). null/undefined = full document.
   */
  volumeBlockKeys?: string[] | null;
  /**
   * Paginated visual mode (FPS-010 Ticket 3) — screen aid only. When true the
   * preview draws clear page gutters at every page break so the document reads
   * as separate sheets. Print/PDF pagination is unaffected (the browser print
   * engine controls final page flow). Default false.
   */
  paginated?: boolean;
}

/** A generated table-of-contents entry. */
interface TocEntry {
  order: number;
  title: string;
}

/** Render context passed to block renderers (FPS-004). */
interface RenderContext {
  tocEntries: TocEntry[];
  tocAuto: boolean;
  /** Template default cover style (FPS-009); block cover_config can override. */
  coverStyle?: string;
}

// ═══════════════════════════════════════════════════════════
// Default branding (fallback if no profile selected)
// ═══════════════════════════════════════════════════════════

export const DEFAULT_BRANDING: BrandingProfile = {
  id: "bp-001",
  name: "Hala Corporate — Navy",
  primary_color: "#1a2744",
  secondary_color: "#2a4a7f",
  accent_color: "#c9a84c",
  font_family: "IBM Plex Sans",
  font_heading: "Source Serif 4",
  logo_url: "",
  footer_format: {
    show_ref: true,
    show_date: true,
    show_completed_by: true,
    show_page_numbers: true,
    custom_text: "CONFIDENTIAL — Hala Supply Chain Services",
  },
  header_style: "full",
  cover_hero_urls: [],
  watermark_url: null,
};

// ═══════════════════════════════════════════════════════════
// Main function
// ═══════════════════════════════════════════════════════════

/**
 * Generate a full HTML document from blocks + branding.
 * Returns a sanitized, self-contained HTML string.
 */
export function buildPreviewHTML(options: PreviewOptions): string {
  const { blocks, branding, exportMode, customerName, refNumber, date } = options;

  // ── FPS-004: normalize layout (never throws; missing/bad → defaults) ──
  const layout = normalizeFinalPackLayout(options.layout);

  let visibleBlocks = blocks.filter((b) => b.visible);

  // FPS-006: volume filter (render-only; block data + order untouched).
  if (options.volumeBlockKeys && options.volumeBlockKeys.length > 0) {
    const allowed = new Set(options.volumeBlockKeys);
    visibleBlocks = visibleBlocks.filter((b) => allowed.has(b.block_key));
  }

  // cover_page = false → suppress the cover block from RENDER only (block data untouched).
  if (!layout.cover_page) {
    visibleBlocks = visibleBlocks.filter((b) => b.render_key !== "cover_hero");
  }

  // Generate real Auto-TOC entries from the visible content blocks.
  const tocEntries = buildTocEntries(visibleBlocks);
  const ctx: RenderContext = { tocEntries, tocAuto: layout.toc_auto, coverStyle: layout.cover_style };

  // Render each block (TOC block consumes ctx; honor toc_auto).
  const renderedBlocks = visibleBlocks
    .map((block) => renderBlock(block, branding, ctx))
    .filter(Boolean);

  // page_break_between_sections → inject page breaks between sections (render-only).
  const pageBreak = pageBreakHtml();
  const bodyHtml = layout.page_break_between_sections
    ? renderedBlocks.join(`\n${pageBreak}\n`)
    : renderedBlocks.join("\n");

  // Sanitize only the user-generated block HTML (not our structural HTML)
  const sanitizedBody = DOMPurify.sanitize(bodyHtml, {
    ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "footer"],
    ADD_ATTR: ["class", "style", "colspan", "rowspan"],
  });

  const watermark = exportMode !== "final"
    ? `<div class="fps-watermark">${exportMode.toUpperCase()}</div>`
    : "";

  // FPS-010 Ticket 3 — screen-only paginated styling (clear page gutters at breaks).
  const paginatedClass = options.paginated ? " fps-paginated" : "";

  const footerParts: string[] = [];
  if (branding.footer_format.custom_text) {
    footerParts.push(escHtml(branding.footer_format.custom_text));
  }
  if (branding.footer_format.show_ref && refNumber) {
    footerParts.push(`Ref: ${escHtml(refNumber)}`);
  }
  if (branding.footer_format.show_date && date) {
    footerParts.push(escHtml(date));
  }

  // Assemble full document — CSS and structure are controlled by us, not user input
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Final Pack Preview</title>
  <style>${getPreviewCSS(branding)}</style>
</head>
<body>
  ${watermark}
  <div class="fps-doc fps-spacing-${layout.section_spacing}${paginatedClass}">
    ${sanitizedBody}
  </div>
  <footer class="fps-footer">
    <span>${footerParts.join(" · ")}</span>
  </footer>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════
// Block renderers
// ═══════════════════════════════════════════════════════════

function renderBlock(block: OutputBlock, branding: BrandingProfile, ctx?: RenderContext): string {
  const key = block.render_key;

  // Cover
  if (key === "cover_hero") return renderCover(block, branding, ctx);

  // Page break
  if (key === "page_break") return pageBreakHtml();

  // TOC
  if (key === "toc_auto") return renderToc(block, ctx);

  // Signature
  if (key === "signature_dual") return renderSignature(block);

  // Pricing tables
  if (
    key === "pricing_table_single" ||
    key === "pricing_table_multi" ||
    key === "quote_pricing_vat" ||
    key === "annexure_rate_card"
  ) return renderPricingTable(block);

  // Totals
  if (key === "totals_words") return renderTotals(block);

  // SLA
  if (key === "annexure_sla") return renderSla(block);

  // Facility gallery
  if (key === "facility_gallery") return renderVariableBlock(block, "Facilities");

  // Party details
  if (key === "party_details") return renderVariableBlock(block, "Parties");

  // Narrative / WYSIWYG / Clause — all HTML-based
  // narrative, scope_list, closing, confidentiality, terms,
  // legal_clauses, annexure_config, annexure_comms, scope_table, custom_text
  return renderHtmlBlock(block);
}

// ── Page break (FPS-010 Ticket 3/4) ────────────────────
/**
 * A page break. On screen it shows a visible boundary ("Page break"); in print
 * the CSS collapses it and forces `page-break-before: always` so the next block
 * starts a new printed page.
 */
function pageBreakHtml(): string {
  return `<div class="fps-page-break"><span>Page break</span></div>`;
}

// ── Cover (FPS-009 — style-aware, branding-asset-aware, advisory) ──────

const COVER_STYLES = new Set(["hero_image", "branded", "minimal", "wave"]);

/** Allow only http(s)/data image URLs into the cover; anything else → "". */
export function safeImageUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u)) return u;
  return "";
}

function renderCover(block: OutputBlock, branding: BrandingProfile, ctx?: RenderContext): string {
  const vars = block.content.variables || {};
  const cfg = block.content.cover_config || {};

  // FPS-013 — imported PDF cover: show a clean placeholder page in the preview.
  // The real PDF page is prepended at export time (pdf-lib merge). It is static
  // and never editable — we do NOT fake its visual content here.
  if (cfg.cover_mode === "imported_pdf" && (cfg.imported_pdf_path || "").trim()) {
    const fname = escHtml(cfg.imported_pdf_file_name || "Imported cover.pdf");
    return `<div class="fps-cover fps-cover--imported-pdf">
      <div class="fps-cover-pdf-card">
        <div class="fps-cover-pdf-badge">PDF</div>
        <p class="fps-cover-pdf-name">${fname}</p>
        <p class="fps-cover-pdf-title">Imported PDF cover</p>
        <p class="fps-cover-pdf-note">Used as static page 1 in PDF export.</p>
        <p class="fps-cover-pdf-note">This cover is not editable.</p>
      </div>
    </div>`;
  }

  // Block override wins over the template default (ctx.coverStyle); fall back to hero_image.
  const rawStyle = (cfg.cover_style || ctx?.coverStyle || "hero_image").trim();
  const style = COVER_STYLES.has(rawStyle) ? rawStyle : "hero_image";

  const align = cfg.align === "left" || cfg.align === "right" ? cfg.align : "center";

  // Toggles default ON for text; hero/watermark only when an asset is present.
  const showLogo = cfg.show_logo !== false;
  const showSubtitle = cfg.show_subtitle !== false;
  const showMeta = cfg.show_meta !== false;
  const showHero = cfg.show_hero !== false;
  const showWatermark = cfg.show_watermark === true;

  // Resolve assets (advisory — missing → simply not rendered, never blocks).
  const logoUrl = showLogo ? safeImageUrl(branding.logo_url) : "";
  const heroList = Array.isArray(branding.cover_hero_urls) ? branding.cover_hero_urls : [];
  const heroFromIndex =
    typeof cfg.hero_index === "number" ? heroList[cfg.hero_index] : undefined;
  const heroUrl =
    style === "hero_image" && showHero
      ? safeImageUrl(cfg.hero_url || heroFromIndex || heroList[0] || "")
      : "";
  const watermarkUrl = showWatermark ? safeImageUrl(branding.watermark_url) : "";

  const logoHtml = logoUrl ? `<img class="fps-cover-logo" src="${escHtml(logoUrl)}" alt="">` : "";
  const heroHtml = heroUrl ? `<img class="fps-cover-hero-img" src="${escHtml(heroUrl)}" alt="">` : "";
  const watermarkHtml = watermarkUrl
    ? `<img class="fps-cover-watermark-img" src="${escHtml(watermarkUrl)}" alt="">`
    : "";

  const metaHtml = showMeta
    ? `<div class="fps-cover-meta">
        ${vars.customer_name ? `<p>Prepared for: <strong>${escHtml(vars.customer_name)}</strong></p>` : ""}
        ${vars.ref_number ? `<p>Reference: ${escHtml(vars.ref_number)}</p>` : ""}
        ${vars.date ? `<p>Date: ${escHtml(vars.date)}</p>` : ""}
      </div>`
    : "";

  return `<div class="fps-cover fps-cover--${style} fps-cover--align-${align}">
    ${heroHtml}
    ${watermarkHtml}
    <div class="fps-cover-inner">
      ${logoHtml}
      <h1 class="fps-cover-title">${escHtml(vars.title || "Untitled")}</h1>
      ${showSubtitle && vars.subtitle ? `<h2 class="fps-cover-subtitle">${escHtml(vars.subtitle)}</h2>` : ""}
      ${metaHtml}
    </div>
  </div>`;
}

// ── HTML block (narrative, scope, terms, etc.) ─────────

function renderHtmlBlock(block: OutputBlock): string {
  const html = block.content.html || block.default_content || "";
  const status = block.content.source_status;
  if (!html && status === "not_captured") {
    return `<div class="fps-section">
      <p class="fps-empty">Content not captured yet.</p>
    </div>`;
  }
  return `<div class="fps-section">${html}</div>`;
}

// ── Variable-based blocks (facility, party details) ────

function renderVariableBlock(block: OutputBlock, sectionTitle: string): string {
  const vars = block.content.variables || {};
  const entries = Object.entries(vars);
  if (entries.length === 0) {
    return `<div class="fps-section">
      <h2>${escHtml(sectionTitle)}</h2>
      <p class="fps-empty">Not captured yet.</p>
    </div>`;
  }
  const rows = entries.map(([k, v]) =>
    `<tr><td class="fps-label">${escHtml(k.replace(/_/g, " "))}</td><td>${escHtml(v)}</td></tr>`,
  ).join("");
  return `<div class="fps-section">
    <h2>${escHtml(sectionTitle)}</h2>
    <table class="fps-var-table">${rows}</table>
  </div>`;
}

// ── Pricing table ──────────────────────────────────────

function renderPricingTable(block: OutputBlock): string {
  const rows = block.content.pricing_rows || [];
  if (rows.length === 0) {
    return `<div class="fps-section">
      <h2>${escHtml(block.display_name)}</h2>
      <p class="fps-empty">No pricing data captured yet.</p>
    </div>`;
  }
  const thead = `<tr>
    <th>Scenario</th><th>Type</th><th class="num">Revenue</th>
    <th class="num">Cost</th><th class="num">GP %</th>
    <th>Recommended</th><th>Notes</th>
  </tr>`;
  const tbody = rows.map((r) => `<tr>
    <td>${escHtml(r.scenario_name)}</td>
    <td>${escHtml(r.scenario_type)}</td>
    <td class="num">${escHtml(r.revenue)}</td>
    <td class="num">${escHtml(r.cost)}</td>
    <td class="num">${escHtml(r.gp_percent)}</td>
    <td>${escHtml(r.recommended)}</td>
    <td>${escHtml(r.notes)}</td>
  </tr>`).join("");
  return `<div class="fps-section">
    <h2>${escHtml(block.display_name)}</h2>
    <table class="fps-data-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  </div>`;
}

// ── Totals ─────────────────────────────────────────────

function renderTotals(block: OutputBlock): string {
  const vars = block.content.variables || {};
  const entries = Object.entries(vars);
  if (entries.length === 0) {
    return `<div class="fps-section">
      <h2>${escHtml(block.display_name)}</h2>
      <p class="fps-empty">Totals not captured yet.</p>
    </div>`;
  }
  const rows = entries.map(([k, v]) =>
    `<tr><td class="fps-label">${escHtml(k.replace(/_/g, " "))}</td><td><strong>${escHtml(v)}</strong></td></tr>`,
  ).join("");
  return `<div class="fps-section">
    <h2>${escHtml(block.display_name)}</h2>
    <table class="fps-var-table">${rows}</table>
  </div>`;
}

// ── SLA matrix ─────────────────────────────────────────

function renderSla(block: OutputBlock): string {
  const rows = block.content.sla_rows || [];
  if (rows.length === 0) {
    return `<div class="fps-section">
      <h2>${escHtml(block.display_name)}</h2>
      <p class="fps-empty">No SLA/KPI data captured yet.</p>
    </div>`;
  }
  const thead = `<tr><th>KPI</th><th>Target</th><th>Measurement</th><th>Penalty</th></tr>`;
  const tbody = rows.map((r) => `<tr>
    <td>${escHtml(r.kpi)}</td>
    <td>${escHtml(r.target)}</td>
    <td>${escHtml(r.measurement)}</td>
    <td>${escHtml(r.penalty)}</td>
  </tr>`).join("");
  return `<div class="fps-section">
    <h2>${escHtml(block.display_name)}</h2>
    <table class="fps-data-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  </div>`;
}

// ── Signature ──────────────────────────────────────────

function renderSignature(block: OutputBlock): string {
  const vars = block.content.variables || {};
  return `<div class="fps-section fps-signature">
    <h2>Acceptance &amp; Authorization</h2>
    <div class="fps-sig-grid">
      <div class="fps-sig-party">
        <p><strong>${escHtml(vars.hala_company || "Hala Supply Chain Services")}</strong></p>
        <p>Name: ${escHtml(vars.hala_signatory || "_______________")}</p>
        <p>Title: ${escHtml(vars.hala_title || "_______________")}</p>
        <p>Date: _______________</p>
        <p>Signature: _______________</p>
      </div>
      <div class="fps-sig-party">
        <p><strong>${escHtml(vars.client_company || "Client")}</strong></p>
        <p>Name: ${escHtml(vars.client_signatory || "_______________")}</p>
        <p>Title: ${escHtml(vars.client_title || "_______________")}</p>
        <p>Date: _______________</p>
        <p>Signature: _______________</p>
      </div>
    </div>
  </div>`;
}

// ── TOC ────────────────────────────────────────────────

function renderToc(block: OutputBlock, ctx?: RenderContext): string {
  // FPS-004: when toc_auto is on, use the generated entries; otherwise fall back
  // to any static entries stored on the block. Either way, never block export.
  const generated = ctx?.tocAuto ? (ctx.tocEntries ?? []) : [];
  const entries =
    generated.length > 0
      ? generated.map((e) => ({ order: e.order, display_name: e.title }))
      : (block.content.toc_entries || []);

  if (entries.length === 0) {
    return `<div class="fps-section">
      <h2>Table of Contents</h2>
      <p class="fps-empty">No sections to list yet.</p>
    </div>`;
  }
  const rows = entries.map((e) =>
    `<tr><td class="fps-toc-num">${e.order}</td><td>${escHtml(e.display_name)}</td></tr>`,
  ).join("");
  return `<div class="fps-section">
    <h2>Table of Contents</h2>
    <table class="fps-toc-table">${rows}</table>
  </div>`;
}

// ── Auto-TOC generation (FPS-004-04) ───────────────────
/**
 * Build TOC entries from the visible content blocks. Excludes the cover,
 * page breaks, and the TOC block itself. Uses each block's display name.
 */
function buildTocEntries(visibleBlocks: OutputBlock[]): TocEntry[] {
  const entries: TocEntry[] = [];
  let n = 0;
  for (const b of visibleBlocks) {
    if (b.render_key === "cover_hero") continue;
    if (b.render_key === "page_break") continue;
    if (b.render_key === "toc_auto") continue;
    const title = (b.display_name || b.block_key || "Section").trim();
    if (!title) continue;
    n += 1;
    entries.push({ order: n, title });
  }
  return entries;
}

// ═══════════════════════════════════════════════════════════
// CSS generator
// ═══════════════════════════════════════════════════════════

function getPreviewCSS(b: BrandingProfile): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(b.font_family)}:wght@400;500;600;700&family=${encodeURIComponent(b.font_heading)}:wght@400;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: '${b.font_family}', 'IBM Plex Sans', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 40px 48px;
      position: relative;
    }

    h1, h2, h3, h4 {
      font-family: '${b.font_heading}', '${b.font_family}', serif;
      color: ${b.primary_color};
      margin-bottom: 0.5em;
    }

    h1 { font-size: 24pt; }
    h2 { font-size: 16pt; border-bottom: 2px solid ${b.accent_color}; padding-bottom: 4px; margin-top: 1.5em; }
    h3 { font-size: 13pt; }
    h4 { font-size: 11.5pt; font-weight: 600; margin-top: 1em; }

    p { margin-bottom: 0.6em; }
    u { text-decoration: underline; }
    blockquote { border-left: 3px solid ${b.accent_color}; margin: 0.6em 0; padding: 0.2em 0 0.2em 0.9em; color: #374151; font-style: italic; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 1em 0; }
    a { color: ${b.accent_color}; text-decoration: underline; }
    /* honor TipTap text-align inline styles + alignment classes */
    [style*="text-align: center"], .has-text-align-center { text-align: center; }
    [style*="text-align: right"], .has-text-align-right { text-align: right; }
    [style*="text-align: left"], .has-text-align-left { text-align: left; }

    strong { font-weight: 600; }

    ul, ol { margin-left: 1.5em; margin-bottom: 0.8em; }
    li { margin-bottom: 0.3em; }

    /* ── Cover (FPS-009 — style-aware) ── */
    .fps-cover {
      position: relative;
      overflow: hidden;
      min-height: 500px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, ${b.primary_color} 0%, ${b.secondary_color} 100%);
      color: #fff;
      border-radius: 4px;
      margin-bottom: 32px;
      padding: 48px;
    }
    .fps-cover-inner { position: relative; z-index: 2; text-align: center; max-width: 90%; }
    .fps-cover--align-left .fps-cover-inner { text-align: left; margin-right: auto; }
    .fps-cover--align-right .fps-cover-inner { text-align: right; margin-left: auto; }
    .fps-cover-title { color: #fff; font-size: 28pt; border: none; margin-bottom: 12px; }
    .fps-cover-subtitle { color: ${b.accent_color}; font-size: 16pt; font-weight: 400; margin-bottom: 24px; }
    .fps-cover-meta { opacity: 0.9; font-size: 11pt; }
    .fps-cover-meta p { margin-bottom: 4px; }
    .fps-cover-meta strong { color: #fff; }
    /* Logo */
    .fps-cover-logo { display: block; max-height: 64px; max-width: 240px; margin: 0 auto 22px; }
    .fps-cover--align-left .fps-cover-logo { margin-left: 0; }
    .fps-cover--align-right .fps-cover-logo { margin-right: 0; }
    /* Hero image + legibility overlay */
    .fps-cover-hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
    .fps-cover--hero_image::after { content: ""; position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 100%); }
    /* Watermark image (subtle, behind content) */
    .fps-cover-watermark-img { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 60%; max-width: 360px; opacity: 0.08; z-index: 1; pointer-events: none; }
    /* Style: branded — solid primary with accent top bar */
    .fps-cover--branded { background: ${b.primary_color}; border-top: 8px solid ${b.accent_color}; }
    /* Style: minimal — light, dark text, thin frame */
    .fps-cover--minimal { background: #ffffff; color: ${b.primary_color}; border: 1px solid #e5e7eb; }
    .fps-cover--minimal .fps-cover-title { color: ${b.primary_color}; }
    .fps-cover--minimal .fps-cover-subtitle { color: ${b.accent_color}; }
    .fps-cover--minimal .fps-cover-meta { color: #555; opacity: 1; }
    .fps-cover--minimal .fps-cover-meta strong { color: ${b.primary_color}; }
    /* Style: wave — gradient with a decorative accent curve */
    .fps-cover--wave { background: linear-gradient(160deg, ${b.primary_color} 0%, ${b.secondary_color} 100%); }
    .fps-cover--wave::before { content: ""; position: absolute; left: -10%; right: -10%; bottom: -55%;
      height: 90%; background: ${b.accent_color}; opacity: 0.18; border-radius: 50%; z-index: 0; }
    /* FPS-013: imported PDF cover placeholder (preview only; real PDF page merged at export) */
    .fps-cover--imported-pdf { background: #f3f4f6; color: ${b.primary_color}; border: 1px dashed #cbd5e1; }
    .fps-cover-pdf-card { text-align: center; }
    .fps-cover-pdf-badge { display: inline-block; font-weight: 800; font-size: 14pt; letter-spacing: 0.08em;
      color: #fff; background: #b91c1c; border-radius: 6px; padding: 6px 12px; margin-bottom: 16px; }
    .fps-cover-pdf-name { font-size: 13pt; font-weight: 600; color: ${b.primary_color}; margin-bottom: 8px; word-break: break-word; }
    .fps-cover-pdf-title { font-size: 12pt; font-weight: 600; color: ${b.primary_color}; margin-bottom: 12px; }
    .fps-cover-pdf-note { font-size: 9.5pt; color: #6b7280; margin-bottom: 2px; }

    /* ── Sections ── */
    .fps-section { margin-bottom: 24px; }
    .fps-empty { color: #9ca3af; font-style: italic; font-size: 10pt; }

    /* ── Section spacing (FPS-004 layout flag) ── */
    .fps-spacing-compact .fps-section { margin-bottom: 12px; }
    .fps-spacing-normal .fps-section { margin-bottom: 24px; }
    .fps-spacing-spacious .fps-section { margin-bottom: 44px; }

    /* ── Tables ── */
    .fps-data-table, .fps-var-table, .fps-toc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin-top: 8px;
    }
    .fps-data-table th {
      background: ${b.primary_color};
      color: #fff;
      text-align: left;
      padding: 6px 10px;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .fps-data-table th.num { text-align: right; }
    .fps-data-table td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
    .fps-data-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .fps-data-table tbody tr:nth-child(even) { background: #f9fafb; }

    .fps-var-table td { padding: 4px 10px; border-bottom: 1px solid #e5e7eb; }
    .fps-var-table .fps-label { font-weight: 500; text-transform: capitalize; color: #6b7280; width: 180px; }

    .fps-toc-table td { padding: 4px 10px; }
    .fps-toc-num { color: ${b.accent_color}; font-weight: 600; width: 30px; }

    /* ── Signature ── */
    .fps-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 16px; }
    .fps-sig-party { border-top: 1px dashed #d1d5db; padding-top: 12px; }
    .fps-sig-party p { margin-bottom: 6px; font-size: 10pt; }

    /* ── Page break (FPS-010) ── */
    /* On screen: a clearly visible boundary so users see where a new page
       starts. In print: collapse to a true page break. */
    .fps-page-break {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 26px 0;
      color: #94a3b8;
      font-size: 8.5pt;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      break-before: page;
      page-break-before: always;
    }
    .fps-page-break::before, .fps-page-break::after {
      content: "";
      flex: 1;
      border-top: 1px dashed #cbd5e1;
    }
    .fps-page-break span { white-space: nowrap; }

    /* Paginated view (screen aid): render each break as a grey gutter that
       visually ends one sheet and starts the next. Bleeds past the body
       padding to span the full page width. */
    .fps-paginated .fps-page-break {
      margin: 30px -48px;
      padding: 0 48px;
      height: 38px;
      color: #94a3b8;
      background: #e9edf2;
      border-top: 1px solid #d6dce4;
      border-bottom: 1px solid #d6dce4;
    }

    @media print {
      .fps-page-break, .fps-paginated .fps-page-break {
        height: 0; margin: 0; padding: 0;
        background: transparent; border: none; color: transparent;
      }
      .fps-page-break::before, .fps-page-break::after { border: none; }
    }

    /* ── Watermark ── */
    .fps-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 120pt;
      font-weight: 800;
      color: rgba(0, 0, 0, 0.04);
      pointer-events: none;
      z-index: 1000;
      white-space: nowrap;
      letter-spacing: 0.1em;
    }

    /* ── Footer ── */
    .fps-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 48px;
      font-size: 8pt;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      background: #fff;
      text-align: center;
    }
  `;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
