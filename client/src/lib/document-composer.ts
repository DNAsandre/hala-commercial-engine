/*
 * Document Composer v1 — Core Data Layer
 * Templates + Block Library + Branding Profiles + Document Instances + Compiled Outputs
 *
 * Architecture:
 *   Template = Layout + Styling + Default Block Recipe
 *   Block Library = Typed blocks with families, permissions, and render keys
 *   Branding Profile = Colors, fonts, logos, hero images, footer format
 *   Document Instance = User-edited document from a template, with version history
 *   Compiled Output = PDF generated from a doc instance version + branding profile
 *   Bindings = Auto-bound snapshot IDs (pricing, scope, ECR, SLA)
 *
 * No-AI-Creep Rules:
 *   - AI cannot change pricing, scope quantities, SLA metrics, legal clauses, canon content
 *   - AI can only draft text inside editable narrative blocks
 *   - Locking to Canon requires human action (RBAC)
 *   - Compiled PDFs are immutable outputs tied to a specific doc version
 *   - All compile + lock actions are audited
 */

// ============================================================
// ENUMS & TYPES
// ============================================================

export type DocType =
  | "quote"
  | "proposal"
  | "sla"
  | "msa"
  | "service_order_transport"
  | "service_order_warehouse";

export type DocTypeFamily = "commercial" | "legal";

export const DOC_TYPE_CONFIG: Record<DocType, { label: string; family: DocTypeFamily; icon: string }> = {
  quote: { label: "Quotation", family: "commercial", icon: "FileCheck" },
  proposal: { label: "Proposal", family: "commercial", icon: "BookOpen" },
  sla: { label: "Service Level Agreement", family: "legal", icon: "FileSignature" },
  msa: { label: "Master Service Agreement", family: "legal", icon: "Scale" },
  service_order_transport: { label: "Service Order — Transport", family: "legal", icon: "Truck" },
  service_order_warehouse: { label: "Service Order — Warehouse", family: "legal", icon: "Warehouse" },
};

export type TemplateStatus = "draft" | "published" | "archived";
export type DocLocale = "en" | "ar" | "bilingual";
export type DocInstanceStatus = "draft" | "canon";
export type LinkedEntityType = "quote_version" | "proposal_version" | "sla_version" | "renewal_version";
export type CompileStatus = "success" | "failed";
export type BlockFamily = "commercial" | "data_bound" | "legal" | "annexure" | "asset";
export type BlockEditorMode = "wysiwyg" | "form" | "readonly" | "clause";

// ============================================================
// BLOCK LIBRARY
// ============================================================

export interface BlockPermissions {
  editable_in_draft: boolean;
  editable_in_canon: boolean;  // always false for canon
  ai_allowed: boolean;
  lockable: boolean;
}

export interface BlockSchema {
  variable_slots: string[];  // e.g., ["customer_name", "ref_number", "date"]
  config: Record<string, string>;  // additional config
}

export interface DocBlock {
  id: string;
  block_key: string;  // e.g., "cover.hero", "pricing.table.single"
  family: BlockFamily;
  display_name: string;
  editor_mode: BlockEditorMode;
  permissions: BlockPermissions;
  schema: BlockSchema;
  render_key: string;  // maps to compiler renderer
  default_content: string;  // HTML content template
  description: string;
  created_at: string;
}

// ============================================================
// BRANDING PROFILES
// ============================================================

export interface FooterFormat {
  show_ref: boolean;
  show_date: boolean;
  show_completed_by: boolean;
  show_page_numbers: boolean;
  custom_text: string;
}

export interface BrandingProfile {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  font_heading: string;
  logo_url: string;
  cover_hero_urls: string[];
  footer_format: FooterFormat;
  watermark_url: string | null;
  header_style: "full" | "minimal" | "branded";
  created_at: string;
  updated_at: string;
}

// ============================================================
// TEMPLATES
// ============================================================

export interface RecipeBlock {
  block_key: string;
  order: number;
  required: boolean;
  default_content_override: string | null;
  config_override: Record<string, string>;
}

export interface LayoutConfig {
  cover_page: boolean;
  cover_style: "hero_image" | "minimal" | "branded";
  section_spacing: "compact" | "normal" | "spacious";
  page_break_between_sections: boolean;
  annexure_section: boolean;
  toc_auto: boolean;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  recipe: RecipeBlock[];
  layout: LayoutConfig;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface DocTemplate {
  id: string;
  name: string;
  doc_type: DocType;
  status: TemplateStatus;
  default_branding_profile_id: string;
  default_locale: DocLocale;
  description: string;
  versions: TemplateVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// DOCUMENT INSTANCES
// ============================================================

export interface InstanceBlock {
  block_key: string;
  order: number;
  content: string;
  is_locked: boolean;
  is_ai_generated: boolean;
  config: Record<string, string>;
}

export interface Bindings {
  pricing_snapshot_id: string | null;
  scope_snapshot_id: string | null;
  ecr_score_id: string | null;
  sla_snapshot_id: string | null;
}

export interface DocInstanceVersion {
  id: string;
  doc_instance_id: string;
  version_number: number;
  blocks: InstanceBlock[];
  bindings: Bindings;
  created_by: string;
  created_at: string;
}

export interface DocInstance {
  id: string;
  doc_type: DocType;
  template_version_id: string;
  status: DocInstanceStatus;
  linked_entity_type: LinkedEntityType;
  linked_entity_id: string;
  customer_id: string;
  customer_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  current_version_id: string;
  versions: DocInstanceVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// COMPILED OUTPUTS
// ============================================================

export interface CompiledDocument {
  id: string;
  doc_instance_version_id: string;
  output_type: "pdf";
  file_asset_id: string;
  checksum: string;
  compiled_at: string;
  compiled_by: string;
  status: CompileStatus;
  error_text: string | null;
  branding_profile_id: string;
  doc_instance_id: string;
  title: string;
}

// ============================================================
// BLOCK LIBRARY — SEED DATA (Part E v1 blocks)
// ============================================================

export const blockLibrary: DocBlock[] = [
  // === Commercial (editable) ===
  {
    id: "blk-001", block_key: "cover.hero", family: "commercial", display_name: "Cover Page — Hero",
    editor_mode: "form", description: "Full-width hero cover page with title, subtitle, and branding",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["title", "subtitle", "customer_name", "ref_number", "date"], config: {} },
    render_key: "cover_hero",
    default_content: `<div class="cover-hero"><h1>{{title}}</h1><h2>{{subtitle}}</h2><p>Prepared for: {{customer_name}}</p><p>Ref: {{ref_number}} | Date: {{date}}</p></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-002", block_key: "confidentiality.locked", family: "commercial", display_name: "Confidentiality Notice",
    editor_mode: "clause", description: "Standard confidentiality clause — locked formatting, text editable in draft",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["company_name", "recipient_name"], config: {} },
    render_key: "confidentiality",
    default_content: `<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services and is intended solely for the use of {{recipient_name}}. Unauthorized distribution, copying, or disclosure of this document is strictly prohibited.</p></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-003", block_key: "intro.narrative", family: "commercial", display_name: "Introduction / Narrative",
    editor_mode: "wysiwyg", description: "Free-form narrative section — executive summary, company overview, etc.",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "narrative",
    default_content: `<h2>Introduction</h2><p>Hala Supply Chain Services is pleased to present this document. Our comprehensive logistics solutions are designed to optimize your supply chain operations across the Kingdom of Saudi Arabia.</p>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-004", block_key: "scope.list", family: "commercial", display_name: "Scope of Services",
    editor_mode: "wysiwyg", description: "Editable scope of services with bullet points",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "scope_list",
    default_content: `<h2>Scope of Services</h2><ul><li><strong>Warehousing:</strong> Ambient and temperature-controlled pallet storage with WMS integration</li><li><strong>Inbound:</strong> Container devanning, goods receipt, quality inspection, putaway</li><li><strong>Outbound:</strong> Order processing, pick-pack-ship, carrier management</li><li><strong>VAS:</strong> Labeling, kitting, co-packing, returns processing</li></ul>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-005", block_key: "facility.gallery", family: "asset", display_name: "Facility Gallery",
    editor_mode: "form", description: "Image gallery showcasing facility, certificates, maps",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["facility_name", "location"], config: { max_images: "6" } },
    render_key: "facility_gallery",
    default_content: `<div class="facility-gallery"><h2>Our Facilities</h2><p>State-of-the-art warehousing facilities across the Kingdom.</p><div class="gallery-grid">[Facility images will be rendered here]</div></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-006", block_key: "terms.standard", family: "commercial", display_name: "Terms & Conditions",
    editor_mode: "wysiwyg", description: "Standard commercial terms — payment, duration, review, insurance",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "terms",
    default_content: `<h2>Terms & Conditions</h2><ul><li><strong>Payment Terms:</strong> Net 30 days from invoice date</li><li><strong>Contract Duration:</strong> 12 months from commencement date</li><li><strong>Rate Review:</strong> Annual review subject to CPI adjustment</li><li><strong>Minimum Commitment:</strong> As specified in the pricing schedule</li><li><strong>Insurance:</strong> Standard warehouse liability coverage included</li></ul>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-007", block_key: "signature.dual", family: "commercial", display_name: "Dual Signature Block",
    editor_mode: "form", description: "Signature block for both parties — Hala and client",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["hala_signatory", "hala_title", "client_signatory", "client_title"], config: {} },
    render_key: "signature_dual",
    default_content: `<div class="signature-block"><h2>Acceptance & Authorization</h2><div class="sig-row"><div class="sig-party"><p><strong>Hala Supply Chain Services</strong></p><p>Name: _______________</p><p>Title: _______________</p><p>Date: _______________</p><p>Signature: _______________</p></div><div class="sig-party"><p><strong>Client</strong></p><p>Name: _______________</p><p>Title: _______________</p><p>Date: _______________</p><p>Signature: _______________</p></div></div></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-008", block_key: "closing.note", family: "commercial", display_name: "Closing Note",
    editor_mode: "wysiwyg", description: "Closing remarks and next steps",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "closing",
    default_content: `<h2>Closing</h2><p>We look forward to the opportunity to serve your logistics needs and build a long-term partnership. Please do not hesitate to contact us for any clarifications.</p><p><strong>Hala Supply Chain Services</strong><br/>Kingdom of Saudi Arabia</p>`,
    created_at: "2026-01-15",
  },

  // === Data-bound (read-only) ===
  {
    id: "blk-010", block_key: "pricing.table.single", family: "data_bound", display_name: "Pricing Table — Single Option",
    editor_mode: "readonly", description: "Auto-bound pricing table from current quote/proposal snapshot — single option",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["pricing_snapshot_id"], config: { format: "single" } },
    render_key: "pricing_table_single",
    default_content: `<div class="pricing-table"><h2>Pricing Schedule</h2><table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th><th>Est. Volume</th><th>Monthly (SAR)</th></tr></thead><tbody>[Auto-bound from pricing snapshot]</tbody></table></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-011", block_key: "pricing.table.multi_option", family: "data_bound", display_name: "Pricing Table — Multi Option",
    editor_mode: "readonly", description: "Auto-bound pricing table with multiple pricing options",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["pricing_snapshot_id"], config: { format: "multi" } },
    render_key: "pricing_table_multi",
    default_content: `<div class="pricing-table-multi"><h2>Pricing Options</h2><p>The following pricing options are presented for your consideration:</p>[Auto-bound from pricing snapshot — multiple options]</div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-012", block_key: "quote.pricing.vat_bilingual", family: "data_bound", display_name: "Quote Pricing — VAT Bilingual",
    editor_mode: "readonly", description: "Bilingual (EN/AR) pricing table with VAT breakdown for quotations",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["pricing_snapshot_id"], config: { locale: "bilingual", show_vat: "true" } },
    render_key: "quote_pricing_vat",
    default_content: `<div class="pricing-vat-bilingual"><h2>Pricing Schedule / جدول الأسعار</h2>[Auto-bound bilingual pricing with VAT]</div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-013", block_key: "scope.table", family: "data_bound", display_name: "Scope Table",
    editor_mode: "readonly", description: "Auto-bound scope of work table from quote/proposal snapshot",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["scope_snapshot_id"], config: {} },
    render_key: "scope_table",
    default_content: `<div class="scope-table"><h2>Scope of Work</h2><table><thead><tr><th>Service</th><th>Description</th><th>Included</th></tr></thead><tbody>[Auto-bound from scope snapshot]</tbody></table></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-014", block_key: "totals.number_to_words", family: "data_bound", display_name: "Totals — Number to Words (SAR)",
    editor_mode: "readonly", description: "Total amount in numbers and words (SAR) — auto-bound",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["pricing_snapshot_id"], config: { currency: "SAR" } },
    render_key: "totals_words",
    default_content: `<div class="totals-words"><p><strong>Total Amount: SAR [amount]</strong></p><p>(Saudi Riyals [amount in words] only)</p></div>`,
    created_at: "2026-01-15",
  },

  // === Legal Mode (locked formatting) ===
  {
    id: "blk-020", block_key: "legal.party_details", family: "legal", display_name: "Party Details",
    editor_mode: "clause", description: "Legal party identification — first party (Hala) and second party (client)",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["first_party_name", "first_party_cr", "first_party_address", "second_party_name", "second_party_cr", "second_party_address"], config: {} },
    render_key: "party_details",
    default_content: `<div class="party-details"><h2>Parties</h2><div class="party"><h3>First Party (Service Provider)</h3><p><strong>Hala Supply Chain Services</strong><br/>CR: [CR Number]<br/>Address: [Address]</p></div><div class="party"><h3>Second Party (Client)</h3><p><strong>[Client Name]</strong><br/>CR: [CR Number]<br/>Address: [Address]</p></div></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-021", block_key: "legal.toc.auto", family: "legal", display_name: "Table of Contents (Auto)",
    editor_mode: "readonly", description: "Auto-generated table of contents from document headings",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: [], config: { depth: "2" } },
    render_key: "toc_auto",
    default_content: `<div class="toc"><h2>Table of Contents</h2><p>[Auto-generated from document headings]</p></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-022", block_key: "legal.clauses.locked", family: "legal", display_name: "Legal Clauses (Locked)",
    editor_mode: "clause", description: "Standard legal clauses with locked formatting — jurisdiction, liability, force majeure",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "legal_clauses",
    default_content: `<div class="legal-clauses"><h2>General Terms</h2><ol><li><strong>Governing Law:</strong> This agreement shall be governed by the laws of the Kingdom of Saudi Arabia.</li><li><strong>Dispute Resolution:</strong> Any disputes shall be resolved through amicable negotiation, with arbitration as final recourse.</li><li><strong>Force Majeure:</strong> Neither party shall be liable for delays caused by events beyond reasonable control.</li><li><strong>Confidentiality:</strong> Both parties agree to maintain confidentiality of all proprietary information.</li><li><strong>Limitation of Liability:</strong> Total liability shall not exceed the annual contract value.</li></ol></div>`,
    created_at: "2026-01-15",
  },

  // === Annexure ===
  {
    id: "blk-030", block_key: "annexure.a.config", family: "annexure", display_name: "Annexure A — Service Configuration",
    editor_mode: "wysiwyg", description: "Detailed service configuration and operational parameters",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "annexure_config",
    default_content: `<div class="annexure"><h2>Annexure A — Service Configuration</h2><table><thead><tr><th>Parameter</th><th>Specification</th></tr></thead><tbody><tr><td>Operating Hours</td><td>Sun-Thu 07:00-19:00</td></tr><tr><td>Temperature Range</td><td>15-25°C (Ambient)</td></tr><tr><td>WMS System</td><td>Hala WMS v4.2</td></tr><tr><td>Reporting Frequency</td><td>Weekly + Monthly</td></tr></tbody></table></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-031", block_key: "annexure.b.sla_matrix", family: "annexure", display_name: "Annexure B — SLA Matrix",
    editor_mode: "readonly", description: "Auto-bound SLA KPI matrix from SLA snapshot",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["sla_snapshot_id"], config: {} },
    render_key: "annexure_sla",
    default_content: `<div class="annexure"><h2>Annexure B — Service Level Matrix</h2><table><thead><tr><th>KPI</th><th>Target</th><th>Measurement</th><th>Frequency</th><th>Penalty</th></tr></thead><tbody>[Auto-bound from SLA snapshot]</tbody></table></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-032", block_key: "annexure.c.rate_card", family: "annexure", display_name: "Annexure C — Rate Card",
    editor_mode: "readonly", description: "Auto-bound rate card from pricing snapshot",
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ["pricing_snapshot_id"], config: {} },
    render_key: "annexure_rate_card",
    default_content: `<div class="annexure"><h2>Annexure C — Rate Card</h2><table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th><th>Notes</th></tr></thead><tbody>[Auto-bound from pricing snapshot]</tbody></table></div>`,
    created_at: "2026-01-15",
  },
  {
    id: "blk-033", block_key: "annexure.d.communication_matrix", family: "annexure", display_name: "Annexure D — Communication Matrix",
    editor_mode: "wysiwyg", description: "Escalation and communication matrix between parties",
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: "annexure_comms",
    default_content: `<div class="annexure"><h2>Annexure D — Communication Matrix</h2><table><thead><tr><th>Level</th><th>Hala Contact</th><th>Client Contact</th><th>Response Time</th></tr></thead><tbody><tr><td>Level 1 — Operational</td><td>Warehouse Manager</td><td>Logistics Coordinator</td><td>4 hours</td></tr><tr><td>Level 2 — Management</td><td>Operations Head</td><td>SC Manager</td><td>24 hours</td></tr><tr><td>Level 3 — Executive</td><td>Commercial Director</td><td>VP Operations</td><td>48 hours</td></tr></tbody></table></div>`,
    created_at: "2026-01-15",
  },
];

// ============================================================
// BRANDING PROFILES — SEED DATA
// ============================================================

export const brandingProfiles: BrandingProfile[] = [
  {
    id: "bp-001",
    name: "Hala Corporate — Navy",
    primary_color: "#1a2744",
    secondary_color: "#2a4a7f",
    accent_color: "#c9a84c",
    font_family: "IBM Plex Sans",
    font_heading: "Source Serif 4",
    logo_url: "",
    cover_hero_urls: [],
    footer_format: { show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: "CONFIDENTIAL — Hala Supply Chain Services" },
    watermark_url: null,
    header_style: "full",
    created_at: "2026-01-15",
    updated_at: "2026-01-15",
  },
  {
    id: "bp-002",
    name: "Hala Modern — Minimal",
    primary_color: "#111827",
    secondary_color: "#374151",
    accent_color: "#2563eb",
    font_family: "Inter",
    font_heading: "Inter",
    logo_url: "",
    cover_hero_urls: [],
    footer_format: { show_ref: true, show_date: true, show_completed_by: false, show_page_numbers: true, custom_text: "" },
    watermark_url: null,
    header_style: "minimal",
    created_at: "2026-01-20",
    updated_at: "2026-01-20",
  },
  {
    id: "bp-003",
    name: "Hala Premium — Gold Accent",
    primary_color: "#1a2744",
    secondary_color: "#0f172a",
    accent_color: "#d4a853",
    font_family: "IBM Plex Sans",
    font_heading: "Playfair Display",
    logo_url: "",
    cover_hero_urls: [],
    footer_format: { show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: "STRICTLY CONFIDENTIAL — For Authorized Use Only" },
    watermark_url: null,
    header_style: "branded",
    created_at: "2026-02-01",
    updated_at: "2026-02-01",
  },
];

// ============================================================
// TEMPLATES — SEED DATA
// ============================================================

export const docTemplates: DocTemplate[] = [
  {
    id: "tpl-001",
    name: "Standard Quotation",
    doc_type: "quote",
    status: "published",
    default_branding_profile_id: "bp-001",
    default_locale: "en",
    description: "Standard commercial quotation template with pricing schedule, scope, and terms",
    versions: [
      {
        id: "tplv-001-1",
        template_id: "tpl-001",
        version_number: 1,
        recipe: [
          { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
          { block_key: "confidentiality.locked", order: 2, required: true, default_content_override: null, config_override: {} },
          { block_key: "intro.narrative", order: 3, required: false, default_content_override: `<h2>Executive Summary</h2><p>Thank you for the opportunity to present our warehousing and logistics services quotation. Hala Supply Chain Services is pleased to offer the following commercial terms for your consideration.</p>`, config_override: {} },
          { block_key: "scope.list", order: 4, required: true, default_content_override: null, config_override: {} },
          { block_key: "pricing.table.single", order: 5, required: true, default_content_override: null, config_override: {} },
          { block_key: "totals.number_to_words", order: 6, required: true, default_content_override: null, config_override: {} },
          { block_key: "terms.standard", order: 7, required: true, default_content_override: null, config_override: {} },
          { block_key: "signature.dual", order: 8, required: true, default_content_override: null, config_override: {} },
        ],
        layout: { cover_page: true, cover_style: "hero_image", section_spacing: "normal", page_break_between_sections: false, annexure_section: false, toc_auto: false },
        published_at: "2026-01-20",
        created_by: "Faisal Al-Rashid",
        created_at: "2026-01-15",
      },
    ],
    created_by: "Faisal Al-Rashid",
    created_at: "2026-01-15",
    updated_at: "2026-01-20",
  },
  {
    id: "tpl-002",
    name: "Full Commercial Proposal",
    doc_type: "proposal",
    status: "published",
    default_branding_profile_id: "bp-003",
    default_locale: "en",
    description: "Comprehensive proposal template with executive summary, solution design, pricing, and implementation plan",
    versions: [
      {
        id: "tplv-002-1",
        template_id: "tpl-002",
        version_number: 1,
        recipe: [
          { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
          { block_key: "confidentiality.locked", order: 2, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.toc.auto", order: 3, required: false, default_content_override: null, config_override: {} },
          { block_key: "intro.narrative", order: 4, required: true, default_content_override: `<h2>Executive Summary</h2><p>Hala Supply Chain Services is pleased to present this comprehensive warehousing and logistics proposal. Our solution is designed to optimize your supply chain operations, reduce costs, and improve service levels across the Kingdom.</p>`, config_override: {} },
          { block_key: "scope.list", order: 5, required: true, default_content_override: null, config_override: {} },
          { block_key: "facility.gallery", order: 6, required: false, default_content_override: null, config_override: {} },
          { block_key: "pricing.table.single", order: 7, required: true, default_content_override: null, config_override: {} },
          { block_key: "totals.number_to_words", order: 8, required: true, default_content_override: null, config_override: {} },
          { block_key: "terms.standard", order: 9, required: true, default_content_override: null, config_override: {} },
          { block_key: "closing.note", order: 10, required: false, default_content_override: null, config_override: {} },
          { block_key: "signature.dual", order: 11, required: true, default_content_override: null, config_override: {} },
          { block_key: "annexure.a.config", order: 12, required: false, default_content_override: null, config_override: {} },
          { block_key: "annexure.c.rate_card", order: 13, required: false, default_content_override: null, config_override: {} },
        ],
        layout: { cover_page: true, cover_style: "branded", section_spacing: "spacious", page_break_between_sections: true, annexure_section: true, toc_auto: true },
        published_at: "2026-01-25",
        created_by: "Faisal Al-Rashid",
        created_at: "2026-01-20",
      },
    ],
    created_by: "Faisal Al-Rashid",
    created_at: "2026-01-20",
    updated_at: "2026-01-25",
  },
  {
    id: "tpl-003",
    name: "Service Level Agreement",
    doc_type: "sla",
    status: "published",
    default_branding_profile_id: "bp-001",
    default_locale: "en",
    description: "Standard SLA template with KPIs, penalties, escalation matrix, and review schedule",
    versions: [
      {
        id: "tplv-003-1",
        template_id: "tpl-003",
        version_number: 1,
        recipe: [
          { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.party_details", order: 2, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.toc.auto", order: 3, required: false, default_content_override: null, config_override: {} },
          { block_key: "intro.narrative", order: 4, required: true, default_content_override: `<h2>Agreement Overview</h2><p>This Service Level Agreement defines the service levels, performance metrics, and remediation procedures for the warehousing and logistics services provided by Hala Supply Chain Services.</p>`, config_override: {} },
          { block_key: "scope.list", order: 5, required: true, default_content_override: null, config_override: {} },
          { block_key: "annexure.b.sla_matrix", order: 6, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.clauses.locked", order: 7, required: true, default_content_override: null, config_override: {} },
          { block_key: "annexure.d.communication_matrix", order: 8, required: true, default_content_override: null, config_override: {} },
          { block_key: "signature.dual", order: 9, required: true, default_content_override: null, config_override: {} },
        ],
        layout: { cover_page: true, cover_style: "minimal", section_spacing: "normal", page_break_between_sections: true, annexure_section: true, toc_auto: true },
        published_at: "2026-02-01",
        created_by: "Faisal Al-Rashid",
        created_at: "2026-01-25",
      },
    ],
    created_by: "Faisal Al-Rashid",
    created_at: "2026-01-25",
    updated_at: "2026-02-01",
  },
  {
    id: "tpl-004",
    name: "Bilingual Quotation (EN/AR)",
    doc_type: "quote",
    status: "published",
    default_branding_profile_id: "bp-001",
    default_locale: "bilingual",
    description: "Bilingual quotation template with VAT breakdown — English and Arabic",
    versions: [
      {
        id: "tplv-004-1",
        template_id: "tpl-004",
        version_number: 1,
        recipe: [
          { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
          { block_key: "confidentiality.locked", order: 2, required: true, default_content_override: null, config_override: {} },
          { block_key: "scope.list", order: 3, required: true, default_content_override: null, config_override: {} },
          { block_key: "quote.pricing.vat_bilingual", order: 4, required: true, default_content_override: null, config_override: {} },
          { block_key: "totals.number_to_words", order: 5, required: true, default_content_override: null, config_override: {} },
          { block_key: "terms.standard", order: 6, required: true, default_content_override: null, config_override: {} },
          { block_key: "signature.dual", order: 7, required: true, default_content_override: null, config_override: {} },
        ],
        layout: { cover_page: true, cover_style: "hero_image", section_spacing: "normal", page_break_between_sections: false, annexure_section: false, toc_auto: false },
        published_at: "2026-02-05",
        created_by: "Faisal Al-Rashid",
        created_at: "2026-02-01",
      },
    ],
    created_by: "Faisal Al-Rashid",
    created_at: "2026-02-01",
    updated_at: "2026-02-05",
  },
  {
    id: "tpl-005",
    name: "Master Service Agreement",
    doc_type: "msa",
    status: "draft",
    default_branding_profile_id: "bp-003",
    default_locale: "en",
    description: "Comprehensive MSA template with legal clauses, liability, and governance framework",
    versions: [
      {
        id: "tplv-005-1",
        template_id: "tpl-005",
        version_number: 1,
        recipe: [
          { block_key: "cover.hero", order: 1, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.party_details", order: 2, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.toc.auto", order: 3, required: true, default_content_override: null, config_override: {} },
          { block_key: "intro.narrative", order: 4, required: true, default_content_override: null, config_override: {} },
          { block_key: "scope.list", order: 5, required: true, default_content_override: null, config_override: {} },
          { block_key: "legal.clauses.locked", order: 6, required: true, default_content_override: null, config_override: {} },
          { block_key: "signature.dual", order: 7, required: true, default_content_override: null, config_override: {} },
        ],
        layout: { cover_page: true, cover_style: "branded", section_spacing: "spacious", page_break_between_sections: true, annexure_section: false, toc_auto: true },
        published_at: null,
        created_by: "Faisal Al-Rashid",
        created_at: "2026-02-10",
      },
    ],
    created_by: "Faisal Al-Rashid",
    created_at: "2026-02-10",
    updated_at: "2026-02-10",
  },
];

// ============================================================
// DOCUMENT INSTANCES — SEED DATA
// ============================================================

export const docInstances: DocInstance[] = [
  {
    id: "di-001",
    doc_type: "proposal",
    template_version_id: "tplv-002-1",
    status: "draft",
    linked_entity_type: "proposal_version",
    linked_entity_id: "prop-sabic-v3",
    customer_id: "c1",
    customer_name: "SABIC",
    workspace_id: "ws-1",
    workspace_name: "SABIC Jubail Warehousing",
    current_version_id: "div-001-2",
    versions: [
      {
        id: "div-001-1",
        doc_instance_id: "di-001",
        version_number: 1,
        blocks: [
          { block_key: "cover.hero", order: 1, content: `<div class="cover-hero"><h1>Commercial Proposal</h1><h2>Warehousing & Logistics Services</h2><p>Prepared for: SABIC</p><p>Ref: HCS-PR-2026-001 | Date: 2026-02-01</p></div>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "confidentiality.locked", order: 2, content: `<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services and is intended solely for the use of SABIC. Unauthorized distribution is strictly prohibited.</p></div>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "intro.narrative", order: 3, content: `<h2>Executive Summary</h2><p>Hala Supply Chain Services is pleased to present this comprehensive warehousing and logistics proposal for SABIC's Jubail operations. Our solution leverages state-of-the-art facilities and advanced WMS technology to deliver operational excellence.</p>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "scope.list", order: 4, content: `<h2>Scope of Services</h2><ul><li><strong>Warehousing:</strong> 3,500 pallet positions in temperature-controlled facility</li><li><strong>Inbound:</strong> Container devanning with quality inspection</li><li><strong>Outbound:</strong> Same-day dispatch with carrier management</li><li><strong>VAS:</strong> Labeling, kitting, returns processing</li></ul>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "pricing.table.single", order: 5, content: `<div class="pricing-table"><h2>Pricing Schedule</h2><table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th><th>Est. Volume</th><th>Monthly (SAR)</th></tr></thead><tbody><tr><td>Pallet Storage</td><td>Per pallet/day</td><td>3.80</td><td>3,500</td><td>399,000</td></tr><tr><td>Inbound Handling</td><td>Per pallet</td><td>18.00</td><td>3,500</td><td>63,000</td></tr><tr><td>Outbound Handling</td><td>Per pallet</td><td>22.00</td><td>3,500</td><td>77,000</td></tr></tbody></table><p><strong>Estimated Monthly Total: SAR 539,000</strong></p></div>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "terms.standard", order: 6, content: `<h2>Terms & Conditions</h2><ul><li><strong>Payment Terms:</strong> Net 30 days</li><li><strong>Contract Duration:</strong> 24 months</li><li><strong>Rate Review:</strong> Annual CPI adjustment</li></ul>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "signature.dual", order: 7, content: `<div class="signature-block"><h2>Acceptance</h2><p>Hala Supply Chain Services: _______________</p><p>SABIC: _______________</p></div>`, is_locked: false, is_ai_generated: false, config: {} },
        ],
        bindings: { pricing_snapshot_id: "ps-sabic-001", scope_snapshot_id: "ss-sabic-001", ecr_score_id: "ecr-sabic-001", sla_snapshot_id: null },
        created_by: "Faisal Al-Rashid",
        created_at: "2026-02-01",
      },
      {
        id: "div-001-2",
        doc_instance_id: "di-001",
        version_number: 2,
        blocks: [
          { block_key: "cover.hero", order: 1, content: `<div class="cover-hero"><h1>Commercial Proposal</h1><h2>Warehousing & Logistics Services — Jubail Industrial City</h2><p>Prepared for: SABIC</p><p>Ref: HCS-PR-2026-001 | Date: 2026-02-10</p></div>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "confidentiality.locked", order: 2, content: `<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services and is intended solely for the use of SABIC. Unauthorized distribution is strictly prohibited.</p></div>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "intro.narrative", order: 3, content: `<h2>Executive Summary</h2><p>Hala Supply Chain Services is pleased to present this comprehensive warehousing and logistics proposal for SABIC's Jubail Industrial City operations. Our solution combines 25+ years of operational excellence with cutting-edge WMS technology to deliver measurable improvements in supply chain efficiency.</p><p>This proposal covers dedicated storage for 3,500 pallet positions, full inbound/outbound management, and value-added services tailored to SABIC's petrochemical logistics requirements.</p>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "scope.list", order: 4, content: `<h2>Scope of Services</h2><ul><li><strong>Dedicated Warehousing:</strong> 3,500 pallet positions in temperature-controlled facility at Jubail</li><li><strong>Inbound Operations:</strong> Container devanning, goods receipt with ASN verification, quality inspection, WMS-directed putaway</li><li><strong>Outbound Operations:</strong> Wave-based order processing, pick-pack-ship, carrier management, POD tracking</li><li><strong>Value-Added Services:</strong> Labeling, kitting, co-packing, returns processing, custom reporting</li><li><strong>Technology:</strong> Real-time WMS portal access, inventory dashboards, automated alerts</li></ul>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "pricing.table.single", order: 5, content: `<div class="pricing-table"><h2>Pricing Schedule</h2><table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th><th>Est. Volume</th><th>Monthly (SAR)</th></tr></thead><tbody><tr><td>Pallet Storage</td><td>Per pallet/day</td><td>3.80</td><td>3,500</td><td>399,000</td></tr><tr><td>Inbound Handling</td><td>Per pallet</td><td>18.00</td><td>3,500</td><td>63,000</td></tr><tr><td>Outbound Handling</td><td>Per pallet</td><td>22.00</td><td>3,500</td><td>77,000</td></tr><tr><td>VAS Bundle</td><td>Monthly</td><td>-</td><td>-</td><td>25,000</td></tr></tbody></table><p><strong>Estimated Monthly Total: SAR 564,000</strong></p><p><strong>Estimated Annual Total: SAR 6,768,000</strong></p></div>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "terms.standard", order: 6, content: `<h2>Terms & Conditions</h2><ul><li><strong>Payment Terms:</strong> Net 30 days from invoice date</li><li><strong>Contract Duration:</strong> 24 months from commencement</li><li><strong>Rate Review:</strong> Annual review subject to CPI adjustment (capped at 5%)</li><li><strong>Minimum Commitment:</strong> 3,000 pallets per month</li><li><strong>Insurance:</strong> Standard warehouse liability + all-risk coverage</li></ul>`, is_locked: false, is_ai_generated: false, config: {} },
          { block_key: "closing.note", order: 7, content: `<h2>Next Steps</h2><p>We look forward to the opportunity to serve SABIC's logistics needs. Our team is available for a detailed walkthrough of this proposal at your convenience.</p>`, is_locked: false, is_ai_generated: true, config: {} },
          { block_key: "signature.dual", order: 8, content: `<div class="signature-block"><h2>Acceptance & Authorization</h2><p><strong>Hala Supply Chain Services</strong><br/>Name: _______________<br/>Title: _______________<br/>Date: _______________</p><p><strong>SABIC</strong><br/>Name: _______________<br/>Title: _______________<br/>Date: _______________</p></div>`, is_locked: false, is_ai_generated: false, config: {} },
        ],
        bindings: { pricing_snapshot_id: "ps-sabic-002", scope_snapshot_id: "ss-sabic-001", ecr_score_id: "ecr-sabic-001", sla_snapshot_id: null },
        created_by: "Faisal Al-Rashid",
        created_at: "2026-02-10",
      },
    ],
    created_by: "Faisal Al-Rashid",
    created_at: "2026-02-01",
    updated_at: "2026-02-10",
  },
  {
    id: "di-002",
    doc_type: "quote",
    template_version_id: "tplv-001-1",
    status: "canon",
    linked_entity_type: "quote_version",
    linked_entity_id: "qt-maaden-v2",
    customer_id: "c2",
    customer_name: "Ma'aden",
    workspace_id: "ws-2",
    workspace_name: "Ma'aden Ras Al Khair",
    current_version_id: "div-002-1",
    versions: [
      {
        id: "div-002-1",
        doc_instance_id: "di-002",
        version_number: 1,
        blocks: [
          { block_key: "cover.hero", order: 1, content: `<div class="cover-hero"><h1>Commercial Quotation</h1><h2>Storage & Distribution Services</h2><p>Prepared for: Ma'aden</p><p>Ref: HCS-Q-2026-012 | Date: 2026-01-28</p></div>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "confidentiality.locked", order: 2, content: `<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services.</p></div>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "scope.list", order: 3, content: `<h2>Scope of Services</h2><ul><li>Ambient pallet storage — 2,800 positions</li><li>Full inbound/outbound management</li><li>Monthly reporting and KPI dashboards</li></ul>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "pricing.table.single", order: 4, content: `<div class="pricing-table"><h2>Pricing</h2><table><thead><tr><th>Service</th><th>Rate (SAR)</th><th>Monthly</th></tr></thead><tbody><tr><td>Storage</td><td>3.50/pallet/day</td><td>294,000</td></tr><tr><td>Inbound</td><td>16.00/pallet</td><td>44,800</td></tr><tr><td>Outbound</td><td>20.00/pallet</td><td>56,000</td></tr></tbody></table><p><strong>Monthly Total: SAR 394,800</strong></p></div>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "terms.standard", order: 5, content: `<h2>Terms</h2><ul><li>Net 30 days</li><li>12-month contract</li><li>Annual CPI review</li></ul>`, is_locked: true, is_ai_generated: false, config: {} },
          { block_key: "signature.dual", order: 6, content: `<div class="signature-block"><h2>Acceptance</h2><p>Signed by both parties on 2026-01-30</p></div>`, is_locked: true, is_ai_generated: false, config: {} },
        ],
        bindings: { pricing_snapshot_id: "ps-maaden-001", scope_snapshot_id: "ss-maaden-001", ecr_score_id: "ecr-maaden-001", sla_snapshot_id: null },
        created_by: "Nadia Al-Harbi",
        created_at: "2026-01-28",
      },
    ],
    created_by: "Nadia Al-Harbi",
    created_at: "2026-01-28",
    updated_at: "2026-01-30",
  },
];

// ============================================================
// COMPILED OUTPUTS — SEED DATA
// ============================================================

export const compiledDocuments: CompiledDocument[] = [
  {
    id: "cd-001",
    doc_instance_version_id: "div-002-1",
    output_type: "pdf",
    file_asset_id: "fa-maaden-quote-pdf",
    checksum: "sha256:a1b2c3d4e5f6",
    compiled_at: "2026-01-30T14:30:00Z",
    compiled_by: "Nadia Al-Harbi",
    status: "success",
    error_text: null,
    branding_profile_id: "bp-001",
    doc_instance_id: "di-002",
    title: "Ma'aden Quotation — HCS-Q-2026-012",
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getBlockByKey(key: string): DocBlock | undefined {
  return blockLibrary.find(b => b.block_key === key);
}

export function getBlocksByFamily(family: BlockFamily): DocBlock[] {
  return blockLibrary.filter(b => b.family === family);
}

export function getTemplatesByDocType(docType: DocType): DocTemplate[] {
  return docTemplates.filter(t => t.doc_type === docType);
}

export function getPublishedTemplates(): DocTemplate[] {
  return docTemplates.filter(t => t.status === "published");
}

export function getLatestTemplateVersion(template: DocTemplate): TemplateVersion | null {
  if (template.versions.length === 0) return null;
  return template.versions.reduce((latest, v) => v.version_number > latest.version_number ? v : latest, template.versions[0]);
}

export function getPublishedTemplateVersion(template: DocTemplate): TemplateVersion | null {
  return template.versions.find(v => v.published_at !== null) || null;
}

export function getBrandingProfile(id: string): BrandingProfile | undefined {
  return brandingProfiles.find(bp => bp.id === id);
}

export function getDocInstance(id: string): DocInstance | undefined {
  return docInstances.find(di => di.id === id);
}

export function getCurrentVersion(instance: DocInstance): DocInstanceVersion | null {
  return instance.versions.find(v => v.id === instance.current_version_id) || null;
}

export function isBlockEditable(block: InstanceBlock, docStatus: DocInstanceStatus): boolean {
  const blockDef = getBlockByKey(block.block_key);
  if (!blockDef) return false;
  if (docStatus === "canon") return false;
  if (block.is_locked) return false;
  return blockDef.permissions.editable_in_draft;
}

export function isAIAllowed(block: InstanceBlock, docStatus: DocInstanceStatus): boolean {
  const blockDef = getBlockByKey(block.block_key);
  if (!blockDef) return false;
  if (docStatus === "canon") return false;
  if (block.is_locked) return false;
  return blockDef.permissions.ai_allowed;
}

export function canLockToCanon(instance: DocInstance): { allowed: boolean; reason: string } {
  const version = getCurrentVersion(instance);
  if (!version) return { allowed: false, reason: "No current version found" };

  // Check all required blocks are present
  const templateVersion = docTemplates
    .flatMap(t => t.versions)
    .find(v => v.id === instance.template_version_id);

  if (templateVersion) {
    const requiredKeys = templateVersion.recipe.filter(r => r.required).map(r => r.block_key);
    const presentKeys = version.blocks.map(b => b.block_key);
    const missing = requiredKeys.filter(k => !presentKeys.includes(k));
    if (missing.length > 0) {
      return { allowed: false, reason: `Missing required blocks: ${missing.join(", ")}` };
    }
  }

  return { allowed: true, reason: "All checks passed" };
}

// Family display config
export const BLOCK_FAMILY_CONFIG: Record<BlockFamily, { label: string; color: string; bg: string }> = {
  commercial: { label: "Commercial", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  data_bound: { label: "Data-Bound", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  legal: { label: "Legal", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  annexure: { label: "Annexure", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  asset: { label: "Asset", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
};

export const EDITOR_MODE_CONFIG: Record<BlockEditorMode, { label: string; description: string }> = {
  wysiwyg: { label: "WYSIWYG", description: "Full rich-text editing" },
  form: { label: "Form", description: "Structured form fields" },
  readonly: { label: "Read-Only", description: "Auto-bound data, no editing" },
  clause: { label: "Clause", description: "Locked formatting, text editable" },
};

export const TEMPLATE_STATUS_CONFIG: Record<TemplateStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-gray-700", bg: "bg-gray-100" },
  published: { label: "Published", color: "text-emerald-700", bg: "bg-emerald-50" },
  archived: { label: "Archived", color: "text-amber-700", bg: "bg-amber-50" },
};

export const DOC_INSTANCE_STATUS_CONFIG: Record<DocInstanceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-gray-700", bg: "bg-gray-100" },
  canon: { label: "Canon", color: "text-[#1B2A4A]", bg: "bg-[#1B2A4A]/10" },
};
