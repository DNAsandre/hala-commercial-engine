/**
 * Sprint 14 — PDF Renderer
 * 
 * Generates styled HTML for PDF output matching Hala SCS document standards.
 * Supports cover pages, headers/footers, pricing tables, SLA matrix,
 * dual-language (EN/AR), and signature blocks.
 */

import {
  type PDFRenderContext, type PDFSectionData, type PricingRow,
  type SLAMatrixRow, type TermItem, type BrandingProfile,
  type LanguageMode, type WatermarkMode, type CoverStyle,
  formatSARPdf, formatDatePdf, generateReferenceNumber,
  HALA_BRANDING,
} from "./pdf-engine";

// ============================================================
// MAIN RENDER FUNCTION
// ============================================================

export function renderPDFHTML(ctx: PDFRenderContext): string {
  const { template, branding, watermark, language } = ctx;
  const sections = template.sections
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  let html = getDocumentHead(branding, language);
  
  // Render each section
  for (const section of sections) {
    const data = ctx.sections_data[section.content_key];
    const pageBreak = section.page_break_before ? ' style="page-break-before: always;"' : '';
    
    switch (section.type) {
      case "cover":
        html += renderCoverPage(ctx, template.cover_style);
        break;
      case "confidentiality":
        html += renderConfidentiality(ctx, section, pageBreak);
        break;
      case "introduction":
        html += renderIntroduction(ctx, section, data, pageBreak);
        break;
      case "scope_of_work":
        html += renderScopeOfWork(ctx, section, data, pageBreak);
        break;
      case "pricing_table":
        html += renderPricingTable(ctx, section, data, pageBreak);
        break;
      case "sla_matrix":
        html += renderSLAMatrix(ctx, section, data, pageBreak);
        break;
      case "commercial_terms":
      case "terms_and_conditions":
      case "legal_clauses":
        html += renderTerms(ctx, section, data, pageBreak);
        break;
      case "signature":
        html += renderSignature(ctx, section, pageBreak);
        break;
      case "table_of_contents":
        html += renderTableOfContents(ctx, sections, pageBreak);
        break;
      case "notes":
        html += renderNotes(ctx, section, data, pageBreak);
        break;
      case "custom_content":
        html += renderCustomContent(ctx, section, data, pageBreak);
        break;
      default:
        html += renderGenericSection(ctx, section, data, pageBreak);
        break;
    }
  }

  // Watermark overlay
  if (watermark !== "none") {
    html += renderWatermark(watermark);
  }

  html += '</div></body></html>';
  return html;
}

// ============================================================
// DOCUMENT HEAD + STYLES
// ============================================================

function getDocumentHead(branding: BrandingProfile, language: LanguageMode): string {
  const arabicFont = language !== "en" 
    ? `@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap');`
    : '';
  
  return `<!DOCTYPE html>
<html lang="${language === "ar" ? "ar" : "en"}" dir="${language === "ar" ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  ${arabicFont}
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page {
    size: A4;
    margin: 0;
  }
  
  body {
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #1a1a1a;
    background: white;
  }
  
  .ar-text {
    font-family: 'Noto Naskh Arabic', 'Traditional Arabic', 'Tahoma', sans-serif;
    direction: rtl;
    text-align: right;
  }
  
  .pdf-container {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: white;
    position: relative;
  }
  
  /* ═══ COVER PAGE ═══ */
  .cover-page {
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }
  
  .cover-wave {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, ${branding.primary_color} 0%, ${branding.secondary_color} 40%, ${branding.accent_color} 100%);
  }
  
  .cover-wave::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 65%;
    height: 100%;
    background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%);
    clip-path: ellipse(80% 100% at 80% 50%);
  }
  
  .cover-wave::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 55%;
    height: 100%;
    background: linear-gradient(180deg, rgba(200,220,240,0.3) 0%, rgba(200,220,240,0.1) 100%);
    clip-path: ellipse(70% 100% at 75% 50%);
  }
  
  .cover-dots {
    position: absolute;
    top: 0;
    left: 0;
    width: 45%;
    height: 100%;
    background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  
  .cover-content {
    position: absolute;
    bottom: 60px;
    left: 40px;
    right: 40px;
    z-index: 10;
  }
  
  .cover-title {
    font-size: 28px;
    font-weight: 700;
    color: white;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  
  .cover-subtitle {
    font-size: 14px;
    font-weight: 400;
    color: rgba(255,255,255,0.85);
    margin-bottom: 4px;
  }
  
  .cover-date {
    font-size: 12px;
    color: rgba(255,255,255,0.7);
    margin-top: 12px;
  }
  
  /* ═══ PAGE HEADER ═══ */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 25px;
    background: #f8f8f8;
    border-bottom: 2px solid ${branding.primary_color};
    min-height: 65px;
  }
  
  .header-logo {
    width: 120px;
    height: auto;
  }
  
  .header-title {
    flex: 1;
    text-align: center;
    padding: 0 15px;
  }
  
  .header-title h2 {
    font-size: 14px;
    font-weight: 700;
    color: ${branding.primary_color};
    line-height: 1.3;
  }
  
  .header-title p {
    font-size: 10px;
    color: #666;
  }
  
  .header-customer-logo {
    width: 80px;
    height: auto;
  }
  
  /* ═══ MSA HEADER (Bilingual letterhead) ═══ */
  .msa-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 25px;
    border-bottom: 2px solid ${branding.secondary_color};
  }
  
  .msa-header-left {
    font-size: 9px;
    line-height: 1.6;
    color: #333;
    font-weight: 600;
  }
  
  .msa-header-center {
    text-align: center;
  }
  
  .msa-header-center img {
    width: 100px;
    height: auto;
  }
  
  .msa-header-right {
    font-size: 9px;
    line-height: 1.6;
    color: #333;
    font-weight: 600;
    text-align: right;
    direction: rtl;
    font-family: 'Noto Naskh Arabic', 'Traditional Arabic', sans-serif;
  }
  
  /* ═══ PAGE FOOTER ═══ */
  .page-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 25px;
    border-top: 1px solid #ddd;
    font-size: 9px;
    color: #666;
    margin-top: auto;
  }
  
  .page-footer strong {
    color: #333;
  }
  
  /* ═══ CONTENT SECTIONS ═══ */
  .content-page {
    padding: 0;
    min-height: 297mm;
    display: flex;
    flex-direction: column;
  }
  
  .content-body {
    flex: 1;
    padding: 25px 30px;
  }
  
  .section-title {
    font-size: 20px;
    font-weight: 700;
    color: ${branding.secondary_color};
    margin-bottom: 16px;
    line-height: 1.2;
  }
  
  .section-subtitle {
    font-size: 14px;
    font-weight: 600;
    color: ${branding.secondary_color};
    margin-bottom: 10px;
    margin-top: 16px;
  }
  
  .section-text {
    font-size: 11px;
    line-height: 1.7;
    color: #333;
    text-align: justify;
    margin-bottom: 12px;
  }
  
  /* ═══ DUAL LANGUAGE LAYOUT ═══ */
  .dual-lang {
    display: flex;
    gap: 20px;
  }
  
  .dual-lang-en {
    flex: 1;
    text-align: left;
    direction: ltr;
  }
  
  .dual-lang-ar {
    flex: 1;
    text-align: right;
    direction: rtl;
    font-family: 'Noto Naskh Arabic', 'Traditional Arabic', sans-serif;
  }
  
  .dual-title-bar {
    background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color});
    color: white;
    padding: 10px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .dual-title-bar .en {
    font-size: 16px;
    font-weight: 700;
  }
  
  .dual-title-bar .ar {
    font-size: 16px;
    font-weight: 700;
    font-family: 'Noto Naskh Arabic', 'Traditional Arabic', sans-serif;
    direction: rtl;
  }
  
  /* ═══ TABLES ═══ */
  .pricing-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 10.5px;
  }
  
  .pricing-table th {
    background: ${branding.primary_color};
    color: white;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 10.5px;
    border: 1px solid ${branding.primary_color};
  }
  
  .pricing-table td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    vertical-align: middle;
  }
  
  .pricing-table tr:nth-child(even) {
    background: #fafafa;
  }
  
  .pricing-table .total-row {
    font-weight: 700;
    background: #f0f4f8 !important;
    border-top: 2px solid ${branding.primary_color};
  }
  
  .pricing-table .total-row td {
    font-style: italic;
    font-weight: 700;
  }
  
  .pricing-table .minimum-row {
    font-weight: 600;
    background: #fff8e1 !important;
  }
  
  .pricing-table .vat-row {
    font-size: 10px;
    color: #666;
    background: #f9f9f9 !important;
  }
  
  .pricing-table .amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  /* ═══ SLA MATRIX TABLE ═══ */
  .sla-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 10.5px;
  }
  
  .sla-table th {
    background: ${branding.primary_color};
    color: white;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    border: 1px solid ${branding.primary_color};
  }
  
  .sla-table td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    vertical-align: middle;
  }
  
  .sla-table .severity-critical {
    background: #fef2f2;
    border-left: 3px solid #ef4444;
  }
  
  .sla-table .severity-high {
    background: #fff7ed;
    border-left: 3px solid #f97316;
  }
  
  .sla-table .severity-medium {
    background: #fefce8;
    border-left: 3px solid #eab308;
  }
  
  .sla-table .severity-low {
    background: #f0fdf4;
    border-left: 3px solid #22c55e;
  }
  
  /* ═══ SIGNATURE BLOCK ═══ */
  .signature-block {
    margin-top: 40px;
    display: flex;
    gap: 40px;
  }
  
  .signature-party {
    flex: 1;
    border: 1px solid #ddd;
    padding: 0;
  }
  
  .signature-party-header {
    background: ${branding.primary_color};
    color: white;
    padding: 8px 15px;
    font-weight: 600;
    font-size: 11px;
    text-align: center;
  }
  
  .signature-party-body {
    padding: 15px;
  }
  
  .signature-field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #eee;
    font-size: 10px;
  }
  
  .signature-field:last-child {
    border-bottom: none;
  }
  
  .signature-field .label {
    font-weight: 600;
    color: #333;
    min-width: 80px;
  }
  
  .signature-field .label-ar {
    font-family: 'Noto Naskh Arabic', 'Traditional Arabic', sans-serif;
    direction: rtl;
    font-weight: 600;
    color: #333;
    min-width: 80px;
    text-align: right;
  }
  
  .signature-field .value {
    flex: 1;
    border-bottom: 1px dotted #999;
    min-height: 18px;
    margin: 0 8px;
  }
  
  .stamp-area {
    text-align: center;
    padding: 20px;
    color: #999;
    font-size: 10px;
    border-top: 1px solid #eee;
    margin-top: 10px;
  }
  
  .authorized-text {
    font-size: 9px;
    color: #666;
    text-align: center;
    margin-top: 8px;
    font-style: italic;
  }
  
  /* ═══ WATERMARK ═══ */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 80px;
    font-weight: 700;
    color: rgba(200, 200, 200, 0.15);
    text-transform: uppercase;
    pointer-events: none;
    z-index: 1000;
    white-space: nowrap;
  }
  
  /* ═══ LIST STYLES ═══ */
  .content-list {
    margin: 8px 0 16px 20px;
    font-size: 11px;
    line-height: 1.8;
  }
  
  .content-list li {
    margin-bottom: 4px;
  }
  
  /* ═══ AGREEMENT REFERENCE TABLE ═══ */
  .agreement-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10.5px;
  }
  
  .agreement-table td {
    padding: 6px 12px;
    border: 1px solid #ddd;
  }
  
  .agreement-table .label-cell {
    background: #f0f4f8;
    font-weight: 600;
    width: 25%;
  }
  
  .agreement-table .label-cell-ar {
    background: #f0f4f8;
    font-weight: 600;
    width: 25%;
    text-align: right;
    direction: rtl;
    font-family: 'Noto Naskh Arabic', 'Traditional Arabic', sans-serif;
  }
  
  /* ═══ PRINT HELPERS ═══ */
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
  
</style>
</head>
<body>
<div class="pdf-container">
`;
}

// ============================================================
// COVER PAGE
// ============================================================

function renderCoverPage(ctx: PDFRenderContext, style: CoverStyle): string {
  if (style === "none") return "";
  
  if (style === "wave") {
    return `
    <div class="cover-page">
      <div class="cover-wave">
        <div class="cover-dots"></div>
      </div>
      <div class="cover-content">
        <div class="cover-title">${escapeHtml(ctx.document_title)}</div>
        ${ctx.document_subtitle ? `<div class="cover-subtitle">For: ${escapeHtml(ctx.customer_name)}</div>` : `<div class="cover-subtitle">For: ${escapeHtml(ctx.customer_name)}</div>`}
        ${ctx.language !== "en" && ctx.customer_name_ar ? `<div class="cover-subtitle ar-text" style="font-family: 'Noto Naskh Arabic', sans-serif;">${escapeHtml(ctx.customer_name_ar)}</div>` : ""}
        <div class="cover-date">${formatDatePdf(ctx.date).replace(/ /g, " ")}</div>
      </div>
    </div>`;
  }
  
  if (style === "minimal") {
    return `
    <div class="cover-page" style="background: white; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <div style="text-align: center; padding: 40px;">
        <div style="width: 80px; height: 4px; background: ${ctx.branding.primary_color}; margin: 0 auto 30px;"></div>
        <h1 style="font-size: 32px; font-weight: 700; color: ${ctx.branding.primary_color}; margin-bottom: 12px;">${escapeHtml(ctx.document_title)}</h1>
        <p style="font-size: 16px; color: #666; margin-bottom: 8px;">For: ${escapeHtml(ctx.customer_name)}</p>
        <p style="font-size: 12px; color: #999;">${formatDatePdf(ctx.date)}</p>
        <p style="font-size: 11px; color: #999; margin-top: 4px;">Ref: ${ctx.reference_number}</p>
        <div style="width: 80px; height: 4px; background: ${ctx.branding.primary_color}; margin: 30px auto 0;"></div>
      </div>
    </div>`;
  }
  
  // corporate style
  return `
  <div class="cover-page" style="background: white; padding: 60px 40px;">
    <div style="border: 2px solid ${ctx.branding.primary_color}; padding: 40px; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
      <div style="text-align: center;">
        <h1 style="font-size: 28px; font-weight: 700; color: ${ctx.branding.primary_color};">${escapeHtml(ctx.branding.company_name_en)}</h1>
        <p style="font-size: 12px; color: #666; margin-top: 8px;">${escapeHtml(ctx.branding.company_subtitle_en)}</p>
      </div>
      <div style="text-align: center;">
        <h2 style="font-size: 24px; font-weight: 600; color: ${ctx.branding.secondary_color};">${escapeHtml(ctx.document_title)}</h2>
        <p style="font-size: 14px; color: #666; margin-top: 12px;">Prepared for: ${escapeHtml(ctx.customer_name)}</p>
        <p style="font-size: 12px; color: #999; margin-top: 8px;">${formatDatePdf(ctx.date)}</p>
      </div>
      <div style="text-align: center; font-size: 10px; color: #999;">
        <p>${ctx.reference_number}</p>
      </div>
    </div>
  </div>`;
}

// ============================================================
// PAGE HEADER
// ============================================================

function renderPageHeader(ctx: PDFRenderContext): string {
  const { template, branding } = ctx;
  const hc = template.header_config;
  
  if (template.doc_type === "msa" || template.doc_type === "service_order") {
    // MSA-style bilingual letterhead
    return `
    <div class="msa-header">
      <div class="msa-header-left">
        <strong>${branding.company_name_en}</strong><br>
        ${branding.address_en.split('\n').join('<br>')}
        <br>TEL : ${branding.phone}
        <br>FAX : ${branding.fax}
      </div>
      <div class="msa-header-center">
        <div style="font-size: 24px; font-weight: 700; color: ${branding.primary_color};">HALA</div>
        <div style="font-size: 8px; color: #666; margin-top: 2px;">${branding.company_subtitle_ar}</div>
        <div style="font-size: 7px; color: #999;">${branding.company_subtitle_en}</div>
      </div>
      <div class="msa-header-right">
        <strong>${branding.company_name_ar}</strong><br>
        ${branding.address_ar.split('\n').join('<br>')}
        <br>تلفون : ${branding.phone}
        <br>فاكس : ${branding.fax}
      </div>
    </div>`;
  }
  
  // Standard proposal/quote header
  return `
  <div class="page-header">
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="font-size: 20px; font-weight: 700; color: ${branding.primary_color};">HALA</div>
      <div>
        <div style="font-size: 7px; color: #666;">${branding.company_subtitle_ar}</div>
        <div style="font-size: 6px; color: #999;">${branding.company_subtitle_en}</div>
      </div>
    </div>
    ${hc.show_title ? `
    <div class="header-title">
      <h2>${escapeHtml(ctx.document_title)}</h2>
      ${ctx.document_subtitle ? `<p>${escapeHtml(ctx.document_subtitle)}</p>` : ""}
    </div>` : ""}
    ${hc.show_customer_logo && ctx.customer_logo_url ? `
    <div style="text-align: right;">
      <div style="font-size: 12px; font-weight: 600; color: #333;">${escapeHtml(ctx.customer_name)}</div>
    </div>` : `
    <div style="text-align: right;">
      <div style="font-size: 12px; font-weight: 600; color: #333;">${escapeHtml(ctx.customer_name)}</div>
    </div>`}
  </div>`;
}

// ============================================================
// PAGE FOOTER
// ============================================================

function renderPageFooter(ctx: PDFRenderContext, pageNum?: number, totalPages?: number): string {
  const fc = ctx.template.footer_config;
  const parts: string[] = [];
  
  if (fc.show_completed_by) parts.push(`<strong>COMPLETED BY:</strong> Hala SCS`);
  if (fc.show_date) parts.push(`<strong>DATE:</strong> ${formatDatePdf(ctx.date)}`);
  if (fc.show_reference) parts.push(`<strong>REF:</strong> ${ctx.reference_number}`);
  
  return `
  <div class="page-footer">
    <div style="display: flex; gap: 20px; align-items: center;">
      ${parts.join(' <span style="color: #ccc;">|</span> ')}
    </div>
    ${fc.show_page_numbers ? `<div>Page <strong>${pageNum || "X"}</strong> of <strong>${totalPages || "Y"}</strong></div>` : ""}
  </div>`;
}

// ============================================================
// SECTION RENDERERS
// ============================================================

function renderConfidentiality(ctx: PDFRenderContext, _section: any, pageBreak: string): string {
  const isDual = ctx.language === "dual";
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      <h1 class="section-title">Confidentiality Statement</h1>
      ${isDual ? `<h1 class="section-title ar-text" style="margin-top: -8px;">بيان السرية</h1>` : ""}
      
      <p class="section-text">
        The information contained within this document is confidential between ${ctx.branding.company_name_en} and ${ctx.customer_name}.
      </p>
      ${isDual ? `<p class="section-text ar-text">المعلومات الواردة في هذه الوثيقة سرية بين ${ctx.branding.company_name_ar} و ${ctx.customer_name_ar || ctx.customer_name}.</p>` : ""}
      
      <p class="section-text">
        This document is prepared and published by ${ctx.branding.company_name_en.split(' Co.')[0]} exclusively for the use by ${ctx.customer_name} employees on a need-to-know basis.
      </p>
      ${isDual ? `<p class="section-text ar-text">تم إعداد ونشر هذه الوثيقة من قبل ${ctx.branding.company_name_ar} حصرياً لاستخدام موظفي ${ctx.customer_name_ar || ctx.customer_name} على أساس الحاجة إلى المعرفة.</p>` : ""}
      
      <p class="section-text">
        It contains ${ctx.branding.company_name_en.split(' Co.')[0]} confidential and proprietary information, and, under no circumstances should this document, or a copy, in any form, be given or any of its contents disclosed to anyone who is not an authorized recipient.
      </p>
      ${isDual ? `<p class="section-text ar-text">تحتوي على معلومات سرية وملكية خاصة، ولا يجوز بأي حال من الأحوال إعطاء هذه الوثيقة أو نسخة منها بأي شكل أو الكشف عن أي من محتوياتها لأي شخص غير مخول باستلامها.</p>` : ""}
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderIntroduction(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  const isDual = ctx.language === "dual";
  const customContent = data?.content_html || "";
  const customContentAr = data?.content_html_ar || "";
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      ${isDual ? `
      <div class="dual-title-bar">
        <span class="en">${escapeHtml(section.title_en)}</span>
        <span class="ar">${escapeHtml(section.title_ar)}</span>
      </div>` : `
      <h1 class="section-title">${escapeHtml(section.title_en)}</h1>`}
      
      ${customContent ? customContent : `
      <p class="section-text">
        HALA SCS is a leading supply chain solution provider with over 20 years of extensive experience in Saudi Arabia. We are pioneers in four main verticals (petrochemical, healthcare, FMCG / F&B, Industrial) where we successfully help our clients mitigate their supply chain risk, optimize the cost, and sustain their logistics.
      </p>`}
      
      ${isDual && !customContentAr ? `
      <p class="section-text ar-text">
        هلا لخدمات الإمدادات المساندة هي شركة رائدة في حلول سلسلة الإمداد مع أكثر من 20 عامًا من الخبرة الواسعة في المملكة العربية السعودية. نحن رواد في أربعة قطاعات رئيسية (البتروكيماويات، الرعاية الصحية، السلع الاستهلاكية سريعة التداول / الأغذية والمشروبات، الصناعية) حيث نساعد عملاءنا بنجاح في تخفيف مخاطر سلسلة الإمداد وتحسين التكاليف واستدامة الخدمات اللوجستية.
      </p>` : isDual && customContentAr ? customContentAr : ""}
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderScopeOfWork(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  const isDual = ctx.language === "dual";
  const blocks = data?.custom_blocks || [];
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      ${isDual ? `
      <div class="dual-title-bar">
        <span class="en">${escapeHtml(section.title_en)}</span>
        <span class="ar">${escapeHtml(section.title_ar)}</span>
      </div>` : `
      <h1 class="section-title">${escapeHtml(section.title_en)}</h1>`}
      
      ${data?.content_html ? data.content_html : `
      <ol class="content-list" type="a">
        <li>Dedicated storage space in the designated warehouse facility.</li>
        <li>Temperature controlled storage as per agreed specifications.</li>
        <li>Handling pallets In and Out activities.</li>
        <li>Inbound shipments will be inspected for damages and quantity checked against the pre-alert sent by the client.</li>
        <li>Upon request, any inventory received not palletized, will be palletized and stored accordingly.</li>
        <li>Inbound shipment information will be recorded on the WMS (SKU, Batch Number, Quantity).</li>
        <li>Outbound orders will be processed per customer instructions and the shipping documents will be prepared for each shipment.</li>
      </ol>`}
      
      ${isDual && data?.content_html_ar ? `
      <div class="ar-text" style="margin-top: 16px;">
        ${data.content_html_ar}
      </div>` : ""}
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderPricingTable(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  const isDual = ctx.language === "dual";
  const rows = data?.pricing_rows || getSamplePricingRows();
  
  const hasOption2 = rows.some(r => r.rate_option2 !== undefined);
  const hasOption3 = rows.some(r => r.rate_option3 !== undefined);
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      ${isDual ? `
      <div class="dual-title-bar">
        <span class="en">${escapeHtml(section.title_en)}</span>
        <span class="ar">${escapeHtml(section.title_ar)}</span>
      </div>` : `
      <h1 class="section-title">${escapeHtml(section.title_en)}</h1>`}
      
      <table class="pricing-table">
        <thead>
          <tr>
            <th style="width: 40px;">No.</th>
            <th>Description</th>
            <th>Unit of Measure</th>
            <th class="amount" style="width: 100px;">Option 1:<br>Rate (SAR)</th>
            ${hasOption2 ? `<th class="amount" style="width: 100px;">Option 2:<br>Rate (SAR)</th>` : ""}
            ${hasOption3 ? `<th class="amount" style="width: 100px;">Option 3:<br>Rate (SAR)</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            const rowClass = row.is_total ? 'total-row' : row.is_minimum ? 'minimum-row' : row.is_vat ? 'vat-row' : '';
            return `
            <tr class="${rowClass}">
              <td style="text-align: center;">${row.is_total || row.is_minimum ? '' : row.no}</td>
              <td>${row.bold ? `<strong>${escapeHtml(row.description)}</strong>` : escapeHtml(row.description)}</td>
              <td>${escapeHtml(row.unit)}</td>
              <td class="amount">${row.is_minimum ? `<strong>${formatSARPdf(row.rate)}</strong>` : formatSARPdf(row.rate)}</td>
              ${hasOption2 ? `<td class="amount">${row.rate_option2 !== undefined ? formatSARPdf(row.rate_option2) : '-'}</td>` : ""}
              ${hasOption3 ? `<td class="amount">${row.rate_option3 !== undefined ? formatSARPdf(row.rate_option3) : '-'}</td>` : ""}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderSLAMatrix(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  const isDual = ctx.language === "dual";
  const rows = data?.sla_rows || getSampleSLARows();
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      ${isDual ? `
      <div class="dual-title-bar">
        <span class="en">${escapeHtml(section.title_en)}</span>
        <span class="ar">${escapeHtml(section.title_ar)}</span>
      </div>` : `
      <h1 class="section-title">${escapeHtml(section.title_en)}</h1>`}
      
      <table class="sla-table">
        <thead>
          <tr>
            <th>SLA Metric</th>
            ${isDual ? '<th class="ar-text">المقياس</th>' : ''}
            <th>Target</th>
            <th>Measurement</th>
            <th>Penalty</th>
            <th style="width: 60px;">Severity</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
          <tr>
            <td class="severity-${row.severity}">${escapeHtml(row.metric)}</td>
            ${isDual ? `<td class="ar-text severity-${row.severity}">${escapeHtml(row.metric_ar || '')}</td>` : ''}
            <td>${escapeHtml(row.target)}</td>
            <td>${escapeHtml(row.measurement)}</td>
            <td>${escapeHtml(row.penalty)}</td>
            <td style="text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600;
                background: ${row.severity === 'critical' ? '#fef2f2' : row.severity === 'high' ? '#fff7ed' : row.severity === 'medium' ? '#fefce8' : '#f0fdf4'};
                color: ${row.severity === 'critical' ? '#dc2626' : row.severity === 'high' ? '#ea580c' : row.severity === 'medium' ? '#ca8a04' : '#16a34a'};">
                ${row.severity.toUpperCase()}
              </span>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderTerms(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  const isDual = ctx.language === "dual";
  const terms = data?.terms || [];
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      ${isDual ? `
      <div class="dual-title-bar">
        <span class="en">${escapeHtml(section.title_en)}</span>
        <span class="ar">${escapeHtml(section.title_ar)}</span>
      </div>
      <div class="dual-lang">
        <div class="dual-lang-en">
          ${terms.map(t => `
          <div class="no-break" style="margin-bottom: 12px;">
            <p style="font-weight: 600; font-size: 11px; margin-bottom: 4px;">${t.number} ${escapeHtml(t.title_en)}</p>
            <p class="section-text">${escapeHtml(t.content_en)}</p>
          </div>`).join('')}
        </div>
        <div class="dual-lang-ar">
          ${terms.map(t => `
          <div class="no-break" style="margin-bottom: 12px;">
            <p style="font-weight: 600; font-size: 11px; margin-bottom: 4px; font-family: 'Noto Naskh Arabic', sans-serif;">${t.number} ${escapeHtml(t.title_ar)}</p>
            <p class="section-text ar-text">${escapeHtml(t.content_ar)}</p>
          </div>`).join('')}
        </div>
      </div>` : `
      <h1 class="section-title">${escapeHtml(section.title_en)}</h1>
      ${terms.map(t => `
      <div class="no-break" style="margin-bottom: 12px;">
        <p style="font-weight: 600; font-size: 11px; margin-bottom: 4px;">${t.number} ${escapeHtml(t.title_en)}</p>
        <p class="section-text">${escapeHtml(t.content_en)}</p>
      </div>`).join('')}
      ${data?.content_html || ""}`}
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderSignature(ctx: PDFRenderContext, _section: any, pageBreak: string): string {
  const isDual = ctx.language === "dual" || ctx.language === "ar";
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      <div class="signature-block">
        <!-- HALA Party -->
        <div class="signature-party">
          <div class="signature-party-header">
            ${ctx.branding.company_name_en.split(' Co.')[0]}
            ${isDual ? `<br><span style="font-family: 'Noto Naskh Arabic', sans-serif; font-size: 10px;">("هلا")</span>` : ` ("HALA")`}
          </div>
          <div class="signature-party-body">
            <div class="signature-field">
              <span class="label">Name</span>
              ${isDual ? '<span class="label-ar">الأسم</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Designation</span>
              ${isDual ? '<span class="label-ar">المنصب</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Email</span>
              ${isDual ? '<span class="label-ar">البريد الإلكتروني</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Date</span>
              ${isDual ? '<span class="label-ar">التاريخ</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Signature</span>
              ${isDual ? '<span class="label-ar">التوقيع</span>' : ''}
              <span class="value" style="min-height: 40px;"></span>
            </div>
            <div class="stamp-area">
              Company Stamp${isDual ? '<br><span style="font-family: \'Noto Naskh Arabic\', sans-serif;">ختم الشركة</span>' : ''}
            </div>
            <div class="authorized-text">
              who warrants that he is duly authorized to sign
              ${isDual ? '<br><span style="font-family: \'Noto Naskh Arabic\', sans-serif;">الذي يضمن أنه مخول حسب أصول التوقيع</span>' : ''}
            </div>
          </div>
        </div>
        
        <!-- Customer Party -->
        <div class="signature-party">
          <div class="signature-party-header">
            ${escapeHtml(ctx.customer_name)}
            ${isDual && ctx.customer_name_ar ? `<br><span style="font-family: 'Noto Naskh Arabic', sans-serif; font-size: 10px;">("${escapeHtml(ctx.customer_name_ar)}")</span>` : ` ("the Customer")`}
          </div>
          <div class="signature-party-body">
            <div class="signature-field">
              <span class="label">Name</span>
              ${isDual ? '<span class="label-ar">الأسم</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Designation</span>
              ${isDual ? '<span class="label-ar">المنصب</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Email</span>
              ${isDual ? '<span class="label-ar">البريد الإلكتروني</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Date</span>
              ${isDual ? '<span class="label-ar">التاريخ</span>' : ''}
              <span class="value"></span>
            </div>
            <div class="signature-field">
              <span class="label">Signature</span>
              ${isDual ? '<span class="label-ar">التوقيع</span>' : ''}
              <span class="value" style="min-height: 40px;"></span>
            </div>
            <div class="stamp-area">
              Company Stamp${isDual ? '<br><span style="font-family: \'Noto Naskh Arabic\', sans-serif;">ختم الشركة</span>' : ''}
            </div>
            <div class="authorized-text">
              who warrants that he is duly authorized to sign
              ${isDual ? '<br><span style="font-family: \'Noto Naskh Arabic\', sans-serif;">الذي يضمن أنه مخول حسب أصول التوقيع</span>' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderTableOfContents(ctx: PDFRenderContext, sections: any[], pageBreak: string): string {
  const tocSections = sections.filter(s => s.type !== "cover" && s.type !== "table_of_contents");
  
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      <h2 style="font-size: 14px; font-weight: 700; margin-bottom: 16px;">Table of Contents</h2>
      <div style="font-size: 11px; line-height: 2.2;">
        ${tocSections.map((s, i) => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 2px 0;">
          <span>${i + 1}. ${escapeHtml(s.title_en).toUpperCase()}</span>
          <span style="color: #999;">${i + 3}</span>
        </div>`).join('')}
      </div>
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderNotes(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  const notes = data?.notes || [];
  
  return `
  <div${pageBreak ? ` ${pageBreak}` : ""}>
    <div style="padding: 0 30px 20px;">
      <h2 class="section-subtitle" style="font-size: 16px; font-style: italic;">Note:</h2>
      ${notes.length > 0 ? `
      <ul class="content-list">
        ${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
      </ul>` : `
      <p class="section-text" style="color: #666; font-style: italic;">No additional notes.</p>`}
    </div>
  </div>`;
}

function renderCustomContent(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  return `
  <div class="content-page"${pageBreak}>
    ${renderPageHeader(ctx)}
    <div class="content-body">
      <h1 class="section-title">${escapeHtml(section.title_en)}</h1>
      ${data?.content_html || '<p class="section-text">Content to be added.</p>'}
    </div>
    ${renderPageFooter(ctx)}
  </div>`;
}

function renderGenericSection(ctx: PDFRenderContext, section: any, data: PDFSectionData | undefined, pageBreak: string): string {
  return renderCustomContent(ctx, section, data, pageBreak);
}

// ============================================================
// WATERMARK
// ============================================================

function renderWatermark(mode: WatermarkMode): string {
  const text = mode === "draft" ? "DRAFT" : mode === "confidential" ? "CONFIDENTIAL" : "FINAL";
  return `<div class="watermark">${text}</div>`;
}

// ============================================================
// SAMPLE DATA
// ============================================================

function getSamplePricingRows(): PricingRow[] {
  return [
    { no: 1, description: "Temperature Controlled Storage", unit: "Pallet Per Month", rate: 41.00, rate_option2: 46.00, rate_option3: 41.00 },
    { no: 2, description: "Minimum Charges", unit: "Per Month", rate: 49200.00, rate_option2: 0, rate_option3: 102500.00 },
    { no: 0, description: "Minimum Pallet Positions", unit: "", rate: 1200, rate_option2: 0, rate_option3: 2500, is_minimum: true, bold: true },
    { no: 3, description: "Handling In", unit: "Per Pallet", rate: 7.00, rate_option2: 9.00, rate_option3: 7.00 },
    { no: 4, description: "Handling Out", unit: "Per Pallet", rate: 7.00, rate_option2: 9.00, rate_option3: 7.00 },
    { no: 5, description: "Delayering of Pallet", unit: "Per case", rate: 0.50, rate_option2: 0.60, rate_option3: 0.50 },
    { no: 6, description: "Additional Pallets", unit: "Per Pallet", rate: 21.00, rate_option2: 21.00, rate_option3: 21.00 },
    { no: 7, description: "Stretch Wrap", unit: "Per Pallet", rate: 4.00, rate_option2: 6.00, rate_option3: 4.00 },
    { no: 8, description: "Handing Out - Case Handling", unit: "Per case", rate: 0.70, rate_option2: 1.00, rate_option3: 0.80 },
    { no: 9, description: "Handing In - Case Handling", unit: "Per case", rate: 0.70, rate_option2: 1.00, rate_option3: 0.80 },
    { no: 10, description: "Handling Out Piece Handling", unit: "Per Piece", rate: 0.10, rate_option2: 0.20, rate_option3: 0.10 },
    { no: 11, description: "Handling Out Piece Handling", unit: "Per Piece", rate: 0.10, rate_option2: 0.20, rate_option3: 0.10 },
  ];
}

function getSampleSLARows(): SLAMatrixRow[] {
  return [
    { metric: "Order Accuracy", metric_ar: "دقة الطلبات", target: "≥ 99.5%", measurement: "Monthly audit", penalty: "2% credit per 0.1% below target", severity: "critical" },
    { metric: "On-Time Dispatch", metric_ar: "التسليم في الوقت المحدد", target: "≥ 98%", measurement: "Weekly tracking", penalty: "1.5% credit per 0.5% below target", severity: "high" },
    { metric: "Inventory Accuracy", metric_ar: "دقة المخزون", target: "≥ 99.8%", measurement: "Quarterly count", penalty: "Replacement cost + 5% admin fee", severity: "critical" },
    { metric: "Damage Rate", metric_ar: "معدل التلف", target: "≤ 0.1%", measurement: "Monthly report", penalty: "Full replacement cost", severity: "high" },
    { metric: "Inbound Processing", metric_ar: "معالجة الواردات", target: "≤ 4 hours", measurement: "Per receipt", penalty: "SAR 500 per hour delay", severity: "medium" },
    { metric: "Customer Response Time", metric_ar: "وقت استجابة العملاء", target: "≤ 2 hours", measurement: "Per inquiry", penalty: "SAR 200 per hour delay", severity: "medium" },
    { metric: "System Uptime (WMS)", metric_ar: "وقت تشغيل النظام", target: "≥ 99.5%", measurement: "Monthly", penalty: "SAR 1,000 per hour downtime", severity: "low" },
  ];
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export { renderPageHeader, renderPageFooter, getSamplePricingRows, getSampleSLARows, escapeHtml };
