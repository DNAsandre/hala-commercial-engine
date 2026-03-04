/**
 * Sprint 14 — Production PDF Engine (Commercial-Grade + Dual-Language EN/AR)
 * 
 * Professional PDF generation system matching Hala SCS document standards:
 * - Cover page with navy gradient + wave design
 * - Repeating header (Hala logo left, title center, customer logo right)
 * - Repeating footer (COMPLETED BY, DATE, REF, Page X of Y)
 * - Professional pricing tables with SAR formatting
 * - Dual-language English/Arabic support (two-column layout)
 * - SLA matrix rendering
 * - Signature blocks (bilingual)
 * - Watermark modes (Draft, Confidential, Final)
 * - Brand-aware styling
 */

import { syncAuditEntry } from "./supabase-sync";
import { getCurrentUser } from "./auth-state";

// ============================================================
// TYPES
// ============================================================

export type DocType = "quote" | "proposal" | "sla" | "msa" | "service_order" | "financial_proposal";
export type LanguageMode = "en" | "ar" | "dual";
export type WatermarkMode = "none" | "draft" | "confidential" | "final";
export type CoverStyle = "wave" | "minimal" | "corporate" | "none";
export type TableStyle = "professional" | "minimal" | "bordered" | "striped";

export interface BrandingProfile {
  id: string;
  name: string;
  primary_color: string;    // Navy blue: #0f2b46
  secondary_color: string;  // Medium blue: #1e5a8a
  accent_color: string;     // Light blue: #3b82f6
  heading_font: string;
  body_font: string;
  logo_url: string;
  logo_ar_url: string;      // Arabic version of logo
  watermark_url: string;
  company_name_en: string;
  company_name_ar: string;
  company_subtitle_en: string;
  company_subtitle_ar: string;
  address_en: string;
  address_ar: string;
  phone: string;
  fax: string;
  cr_number: string;
  capital: string;
}

export interface PDFTemplate {
  id: string;
  name: string;
  doc_type: DocType;
  version: number;
  cover_style: CoverStyle;
  table_style: TableStyle;
  language_mode: LanguageMode;
  sections: PDFSectionConfig[];
  header_config: HeaderConfig;
  footer_config: FooterConfig;
  page_config: PageConfig;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PDFSectionConfig {
  id: string;
  type: SectionType;
  title_en: string;
  title_ar: string;
  enabled: boolean;
  order: number;
  page_break_before: boolean;
  content_key: string; // maps to document block or data source
}

export type SectionType =
  | "cover"
  | "confidentiality"
  | "table_of_contents"
  | "introduction"
  | "scope_of_work"
  | "pricing_table"
  | "commercial_terms"
  | "sla_matrix"
  | "legal_clauses"
  | "terms_and_conditions"
  | "signature"
  | "custom_content"
  | "customers_certificates"
  | "geographic_locations"
  | "notes"
  | "annexure";

export interface HeaderConfig {
  show_hala_logo: boolean;
  show_customer_logo: boolean;
  show_title: boolean;
  show_arabic: boolean;
  background_color: string;
}

export interface FooterConfig {
  show_completed_by: boolean;
  show_date: boolean;
  show_reference: boolean;
  show_page_numbers: boolean;
  reference_prefix: string; // "HSCS_"
}

export interface PageConfig {
  size: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface PDFRenderContext {
  template: PDFTemplate;
  branding: BrandingProfile;
  watermark: WatermarkMode;
  language: LanguageMode;
  document_title: string;
  document_subtitle: string;
  customer_name: string;
  customer_name_ar: string;
  customer_logo_url: string;
  reference_number: string;
  date: string;
  sections_data: Record<string, PDFSectionData>;
}

export interface PDFSectionData {
  type: SectionType;
  content_html?: string;
  content_html_ar?: string;
  pricing_rows?: PricingRow[];
  sla_rows?: SLAMatrixRow[];
  terms?: TermItem[];
  custom_blocks?: ContentBlock[];
  notes?: string[];
}

export interface PricingRow {
  no: number;
  description: string;
  description_ar?: string;
  unit: string;
  unit_ar?: string;
  rate: number;
  rate_option2?: number;
  rate_option3?: number;
  is_total?: boolean;
  is_minimum?: boolean;
  is_vat?: boolean;
  bold?: boolean;
}

export interface SLAMatrixRow {
  metric: string;
  metric_ar?: string;
  target: string;
  measurement: string;
  penalty: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface TermItem {
  number: string;
  title_en: string;
  title_ar: string;
  content_en: string;
  content_ar: string;
}

export interface ContentBlock {
  type: "paragraph" | "heading" | "list" | "table" | "image";
  content_en: string;
  content_ar?: string;
}

// ============================================================
// DEFAULT BRANDING
// ============================================================

export const HALA_BRANDING: BrandingProfile = {
  id: "hala-default",
  name: "Hala Supply Chain Services",
  primary_color: "#0f2b46",
  secondary_color: "#1e5a8a",
  accent_color: "#3b82f6",
  heading_font: "'Inter', 'Segoe UI', sans-serif",
  body_font: "'Inter', 'Segoe UI', sans-serif",
  logo_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&h=80&fit=crop", // placeholder
  logo_ar_url: "",
  watermark_url: "",
  company_name_en: "Hala Supply Chain Services Co. L.L.C",
  company_name_ar: "شركة هلا لخدمات الإمدادات المساندة ذ.م.م",
  company_subtitle_en: "SUPPLY CHAIN SERVICES",
  company_subtitle_ar: "لخدمات الإمدادات المساندة",
  address_en: "CAPITAL S.A.R. FULLY PAID 23,000,000\nC.R. NO. 1010193087 C.C. NO. 140988\nREGIONAL OFFICE\nP.O. BOX 6164 RIYADH 11442\nKINGDOM OF SAUDI ARABIA",
  address_ar: "رأس المال المدفوع ٢٣,٠٠٠,٠٠٠ ريال سعودي مدفوع بالكامل\nسجل تجاري ١٠١٠١٩٣٠٨٧ رقم العضوية ١٤٠٩٨٨\nالإدارة الإقليمية\nصندوق البريد ٦١٦٤ الرياض ١١٤٤٢\nالمملكة العربية السعودية",
  phone: "+966 11 455 7220",
  fax: "+966 11 455 7330",
  cr_number: "1010193087",
  capital: "23,000,000",
};

// ============================================================
// SEED TEMPLATES
// ============================================================

const SEED_TEMPLATES: PDFTemplate[] = [
  {
    id: "tpl-quote",
    name: "Standard Quote",
    doc_type: "quote",
    version: 1,
    cover_style: "wave",
    table_style: "professional",
    language_mode: "en",
    sections: [
      { id: "s1", type: "cover", title_en: "Cover Page", title_ar: "صفحة الغلاف", enabled: true, order: 1, page_break_before: false, content_key: "cover" },
      { id: "s2", type: "confidentiality", title_en: "Confidentiality Statement", title_ar: "بيان السرية", enabled: true, order: 2, page_break_before: true, content_key: "confidentiality" },
      { id: "s3", type: "introduction", title_en: "Introduction", title_ar: "المقدمة", enabled: true, order: 3, page_break_before: false, content_key: "introduction" },
      { id: "s4", type: "customers_certificates", title_en: "HSCS Customers & Certificates", title_ar: "عملاء وشهادات هلا", enabled: true, order: 4, page_break_before: true, content_key: "customers_certificates" },
      { id: "s5", type: "scope_of_work", title_en: "Scope of Work", title_ar: "نطاق العمل", enabled: true, order: 5, page_break_before: true, content_key: "scope" },
      { id: "s6", type: "pricing_table", title_en: "Commercial Proposal", title_ar: "العرض التجاري", enabled: true, order: 6, page_break_before: true, content_key: "pricing" },
      { id: "s7", type: "notes", title_en: "Notes", title_ar: "ملاحظات", enabled: true, order: 7, page_break_before: false, content_key: "notes" },
      { id: "s8", type: "terms_and_conditions", title_en: "Terms & Conditions", title_ar: "الشروط والأحكام", enabled: true, order: 8, page_break_before: true, content_key: "terms" },
      { id: "s9", type: "signature", title_en: "Signature", title_ar: "التوقيع", enabled: true, order: 9, page_break_before: true, content_key: "signature" },
    ],
    header_config: { show_hala_logo: true, show_customer_logo: true, show_title: true, show_arabic: false, background_color: "#f5f5f5" },
    footer_config: { show_completed_by: true, show_date: true, show_reference: true, show_page_numbers: true, reference_prefix: "HSCS_" },
    page_config: { size: "A4", orientation: "portrait", margins: { top: 25, right: 20, bottom: 25, left: 20 } },
    enabled: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "tpl-proposal",
    name: "Standard Proposal",
    doc_type: "proposal",
    version: 1,
    cover_style: "wave",
    table_style: "professional",
    language_mode: "en",
    sections: [
      { id: "s1", type: "cover", title_en: "Cover Page", title_ar: "صفحة الغلاف", enabled: true, order: 1, page_break_before: false, content_key: "cover" },
      { id: "s2", type: "confidentiality", title_en: "Confidentiality Statement", title_ar: "بيان السرية", enabled: true, order: 2, page_break_before: true, content_key: "confidentiality" },
      { id: "s3", type: "introduction", title_en: "Introduction", title_ar: "المقدمة", enabled: true, order: 3, page_break_before: false, content_key: "introduction" },
      { id: "s4", type: "scope_of_work", title_en: "Scope of Services", title_ar: "نطاق الخدمات", enabled: true, order: 4, page_break_before: true, content_key: "scope" },
      { id: "s5", type: "pricing_table", title_en: "Financial Proposal", title_ar: "العرض المالي", enabled: true, order: 5, page_break_before: true, content_key: "pricing" },
      { id: "s6", type: "sla_matrix", title_en: "Service Level Agreement", title_ar: "اتفاقية مستوى الخدمة", enabled: true, order: 6, page_break_before: true, content_key: "sla_matrix" },
      { id: "s7", type: "commercial_terms", title_en: "Commercial Terms", title_ar: "الشروط التجارية", enabled: true, order: 7, page_break_before: true, content_key: "commercial_terms" },
      { id: "s8", type: "signature", title_en: "Signature", title_ar: "التوقيع", enabled: true, order: 8, page_break_before: true, content_key: "signature" },
    ],
    header_config: { show_hala_logo: true, show_customer_logo: true, show_title: true, show_arabic: false, background_color: "#f5f5f5" },
    footer_config: { show_completed_by: true, show_date: true, show_reference: true, show_page_numbers: true, reference_prefix: "HSCS_" },
    page_config: { size: "A4", orientation: "portrait", margins: { top: 25, right: 20, bottom: 25, left: 20 } },
    enabled: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "tpl-msa",
    name: "Master Services Agreement",
    doc_type: "msa",
    version: 1,
    cover_style: "none",
    table_style: "bordered",
    language_mode: "dual",
    sections: [
      { id: "s1", type: "introduction", title_en: "Agreement", title_ar: "الاتفاقية", enabled: true, order: 1, page_break_before: false, content_key: "agreement_header" },
      { id: "s2", type: "table_of_contents", title_en: "Table of Contents", title_ar: "جدول المحتويات", enabled: true, order: 2, page_break_before: true, content_key: "toc" },
      { id: "s3", type: "legal_clauses", title_en: "Definitions", title_ar: "تعريفات", enabled: true, order: 3, page_break_before: true, content_key: "definitions" },
      { id: "s4", type: "legal_clauses", title_en: "Terms and Conditions", title_ar: "الشروط والأحكام", enabled: true, order: 4, page_break_before: true, content_key: "terms" },
      { id: "s5", type: "signature", title_en: "Signature", title_ar: "التوقيع", enabled: true, order: 5, page_break_before: true, content_key: "signature" },
    ],
    header_config: { show_hala_logo: true, show_customer_logo: false, show_title: false, show_arabic: true, background_color: "#ffffff" },
    footer_config: { show_completed_by: false, show_date: false, show_reference: false, show_page_numbers: true, reference_prefix: "" },
    page_config: { size: "A4", orientation: "portrait", margins: { top: 30, right: 15, bottom: 20, left: 15 } },
    enabled: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "tpl-sla",
    name: "Service Level Agreement",
    doc_type: "sla",
    version: 1,
    cover_style: "wave",
    table_style: "professional",
    language_mode: "dual",
    sections: [
      { id: "s1", type: "cover", title_en: "Cover Page", title_ar: "صفحة الغلاف", enabled: true, order: 1, page_break_before: false, content_key: "cover" },
      { id: "s2", type: "introduction", title_en: "Introduction", title_ar: "المقدمة", enabled: true, order: 2, page_break_before: true, content_key: "introduction" },
      { id: "s3", type: "scope_of_work", title_en: "Scope of Services", title_ar: "نطاق الخدمات", enabled: true, order: 3, page_break_before: true, content_key: "scope" },
      { id: "s4", type: "sla_matrix", title_en: "SLA Matrix", title_ar: "مصفوفة اتفاقية مستوى الخدمة", enabled: true, order: 4, page_break_before: true, content_key: "sla_matrix" },
      { id: "s5", type: "legal_clauses", title_en: "Legal Terms", title_ar: "الشروط القانونية", enabled: true, order: 5, page_break_before: true, content_key: "legal" },
      { id: "s6", type: "signature", title_en: "Signature", title_ar: "التوقيع", enabled: true, order: 6, page_break_before: true, content_key: "signature" },
    ],
    header_config: { show_hala_logo: true, show_customer_logo: true, show_title: true, show_arabic: true, background_color: "#f5f5f5" },
    footer_config: { show_completed_by: true, show_date: true, show_reference: true, show_page_numbers: true, reference_prefix: "HSCS_" },
    page_config: { size: "A4", orientation: "portrait", margins: { top: 25, right: 15, bottom: 25, left: 15 } },
    enabled: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "tpl-service-order",
    name: "Service Order",
    doc_type: "service_order",
    version: 1,
    cover_style: "minimal",
    table_style: "bordered",
    language_mode: "dual",
    sections: [
      { id: "s1", type: "introduction", title_en: "Service Order", title_ar: "طلب الخدمة", enabled: true, order: 1, page_break_before: false, content_key: "header" },
      { id: "s2", type: "scope_of_work", title_en: "Scope of Services", title_ar: "نطاق الخدمات", enabled: true, order: 2, page_break_before: false, content_key: "scope" },
      { id: "s3", type: "pricing_table", title_en: "Pricing", title_ar: "التسعير", enabled: true, order: 3, page_break_before: true, content_key: "pricing" },
      { id: "s4", type: "terms_and_conditions", title_en: "Terms", title_ar: "الشروط", enabled: true, order: 4, page_break_before: true, content_key: "terms" },
      { id: "s5", type: "signature", title_en: "Signature", title_ar: "التوقيع", enabled: true, order: 5, page_break_before: true, content_key: "signature" },
    ],
    header_config: { show_hala_logo: true, show_customer_logo: false, show_title: true, show_arabic: true, background_color: "#ffffff" },
    footer_config: { show_completed_by: false, show_date: false, show_reference: false, show_page_numbers: true, reference_prefix: "" },
    page_config: { size: "A4", orientation: "portrait", margins: { top: 30, right: 15, bottom: 20, left: 15 } },
    enabled: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
];

// ============================================================
// IN-MEMORY STORE
// ============================================================

let templates: PDFTemplate[] = [...SEED_TEMPLATES];
let brandingProfiles: BrandingProfile[] = [HALA_BRANDING];

// ============================================================
// TEMPLATE CRUD
// ============================================================

export function fetchPDFTemplates(docType?: DocType): PDFTemplate[] {
  if (docType) return templates.filter(t => t.doc_type === docType && t.enabled);
  return [...templates];
}

export function getPDFTemplate(id: string): PDFTemplate | null {
  return templates.find(t => t.id === id) || null;
}

export function updatePDFTemplate(id: string, updates: Partial<PDFTemplate>): PDFTemplate | null {
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return null;
  templates[idx] = { ...templates[idx], ...updates, updated_at: new Date().toISOString() };
  return templates[idx];
}

export function createPDFTemplate(template: Omit<PDFTemplate, "id" | "created_at" | "updated_at">): PDFTemplate {
  const newTemplate: PDFTemplate = {
    ...template,
    id: `tpl-${crypto.randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  templates.push(newTemplate);
  return newTemplate;
}

export function fetchBrandingProfiles(): BrandingProfile[] {
  return [...brandingProfiles];
}

export function getBrandingProfile(id: string): BrandingProfile {
  return brandingProfiles.find(b => b.id === id) || HALA_BRANDING;
}

// ============================================================
// FORMAT HELPERS
// ============================================================

export function formatSARPdf(amount: number): string {
  return new Intl.NumberFormat("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDatePdf(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function generateReferenceNumber(date?: string): string {
  const d = date ? new Date(date) : new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `HSCS_${day}${month}${year}`;
}

// ============================================================
// PDF GENERATION AUDIT
// ============================================================

export function logPDFGeneration(params: {
  templateId: string;
  docType: DocType;
  customerName: string;
  language: LanguageMode;
  watermark: WatermarkMode;
}) {
  const user = getCurrentUser();
  syncAuditEntry({
    id: crypto.randomUUID(),
    entityType: "pdf_generation",
    entityId: params.templateId,
    action: "pdf_generated",
    userId: user.id,
    userName: user.name,
    timestamp: new Date().toISOString(),
    details: `Generated ${params.docType} PDF for ${params.customerName} (lang: ${params.language}, watermark: ${params.watermark})`,
  });
}
