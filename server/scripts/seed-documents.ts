/**
 * One-time seed script — inserts base document system data into Supabase.
 *
 * - Blocks:           upserted by block_key (safe to re-run)
 * - Branding profiles: skipped if table already has rows
 * - Templates:        skipped if table already has rows
 *
 * Run: tsx server/scripts/seed-documents.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Seed Data ──────────────────────────────────────────────────

const BLOCKS = [
  { block_key: 'cover.hero', family: 'commercial', display_name: 'Cover Page — Hero', editor_mode: 'form', render_key: 'cover_hero', description: 'Full-width hero cover page with title, subtitle, and branding', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['title', 'subtitle', 'customer_name', 'ref_number', 'date'], config: {} }, default_content: '<div class="cover-hero"><h1>{{title}}</h1><h2>{{subtitle}}</h2><p>Prepared for: {{customer_name}}</p><p>Ref: {{ref_number}} | Date: {{date}}</p></div>' },
  { block_key: 'confidentiality.locked', family: 'commercial', display_name: 'Confidentiality Notice', editor_mode: 'clause', render_key: 'confidentiality', description: 'Standard confidentiality clause — locked formatting, text editable in draft', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['company_name', 'recipient_name'], config: {} }, default_content: '<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services and is intended solely for the use of {{recipient_name}}. Unauthorized distribution is strictly prohibited.</p></div>' },
  { block_key: 'intro.narrative', family: 'commercial', display_name: 'Introduction / Narrative', editor_mode: 'wysiwyg', render_key: 'narrative', description: 'Free-form narrative section — executive summary, company overview, etc.', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<h2>Introduction</h2><p>Hala Supply Chain Services is pleased to present this document.</p>' },
  { block_key: 'scope.list', family: 'commercial', display_name: 'Scope of Services', editor_mode: 'wysiwyg', render_key: 'scope_list', description: 'Editable scope of services with bullet points', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<h2>Scope of Services</h2><ul><li><strong>Warehousing:</strong> Ambient and temperature-controlled pallet storage</li><li><strong>Inbound:</strong> Container devanning, goods receipt, quality inspection, putaway</li><li><strong>Outbound:</strong> Order processing, pick-pack-ship, carrier management</li><li><strong>VAS:</strong> Labeling, kitting, co-packing, returns processing</li></ul>' },
  { block_key: 'facility.gallery', family: 'asset', display_name: 'Facility Gallery', editor_mode: 'form', render_key: 'facility_gallery', description: 'Image gallery showcasing facility, certificates, maps', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['facility_name', 'location'], config: { max_images: '6' } }, default_content: '<div class="facility-gallery"><h2>Our Facilities</h2><div class="gallery-grid">[Facility images will be rendered here]</div></div>' },
  { block_key: 'terms.standard', family: 'commercial', display_name: 'Terms & Conditions', editor_mode: 'wysiwyg', render_key: 'terms', description: 'Standard commercial terms — payment, duration, review, insurance', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<h2>Terms & Conditions</h2><ul><li><strong>Payment Terms:</strong> Net 30 days from invoice date</li><li><strong>Contract Duration:</strong> 12 months from commencement date</li><li><strong>Rate Review:</strong> Annual review subject to CPI adjustment</li></ul>' },
  { block_key: 'signature.dual', family: 'commercial', display_name: 'Dual Signature Block', editor_mode: 'form', render_key: 'signature_dual', description: 'Signature block for both parties — Hala and client', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['hala_signatory', 'hala_title', 'client_signatory', 'client_title'], config: {} }, default_content: '<div class="signature-block"><h2>Acceptance & Authorization</h2><div class="sig-row"><div class="sig-party"><p><strong>Hala Supply Chain Services</strong></p><p>Name: _______________</p><p>Title: _______________</p><p>Date: _______________</p></div><div class="sig-party"><p><strong>Client</strong></p><p>Name: _______________</p><p>Title: _______________</p><p>Date: _______________</p></div></div></div>' },
  { block_key: 'closing.note', family: 'commercial', display_name: 'Closing Note', editor_mode: 'wysiwyg', render_key: 'closing', description: 'Closing remarks and next steps', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<h2>Closing</h2><p>We look forward to the opportunity to serve your logistics needs and build a long-term partnership.</p>' },
  { block_key: 'pricing.table.single', family: 'data_bound', display_name: 'Pricing Table — Single Option', editor_mode: 'readonly', render_key: 'pricing_table_single', description: 'Auto-bound pricing table from current quote/proposal snapshot — single option', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['pricing_snapshot_id'], config: { format: 'single' } }, default_content: '<div class="pricing-table"><h2>Pricing Schedule</h2>[Auto-bound from pricing snapshot]</div>' },
  { block_key: 'pricing.table.multi_option', family: 'data_bound', display_name: 'Pricing Table — Multi Option', editor_mode: 'readonly', render_key: 'pricing_table_multi', description: 'Auto-bound pricing table with multiple pricing options', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['pricing_snapshot_id'], config: { format: 'multi' } }, default_content: '<div class="pricing-table-multi"><h2>Pricing Options</h2>[Auto-bound from pricing snapshot — multiple options]</div>' },
  { block_key: 'quote.pricing.vat_bilingual', family: 'data_bound', display_name: 'Quote Pricing — VAT Bilingual', editor_mode: 'readonly', render_key: 'quote_pricing_vat', description: 'Bilingual (EN/AR) pricing table with VAT breakdown for quotations', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['pricing_snapshot_id'], config: { locale: 'bilingual', show_vat: 'true' } }, default_content: '<div class="pricing-vat-bilingual"><h2>Pricing Schedule / جدول الأسعار</h2>[Auto-bound bilingual pricing with VAT]</div>' },
  { block_key: 'scope.table', family: 'data_bound', display_name: 'Scope Table', editor_mode: 'readonly', render_key: 'scope_table', description: 'Auto-bound scope of work table from quote/proposal snapshot', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['scope_snapshot_id'], config: {} }, default_content: '<div class="scope-table"><h2>Scope of Work</h2>[Auto-bound from scope snapshot]</div>' },
  { block_key: 'totals.number_to_words', family: 'data_bound', display_name: 'Totals — Number to Words (SAR)', editor_mode: 'readonly', render_key: 'totals_words', description: 'Total amount in numbers and words (SAR) — auto-bound', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['pricing_snapshot_id'], config: { currency: 'SAR' } }, default_content: '<div class="totals-words"><p><strong>Total Amount: SAR [amount]</strong></p></div>' },
  { block_key: 'legal.party_details', family: 'legal', display_name: 'Party Details', editor_mode: 'clause', render_key: 'party_details', description: 'Legal party identification — first party (Hala) and second party (client)', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['first_party_name', 'first_party_cr', 'second_party_name', 'second_party_cr'], config: {} }, default_content: '<div class="party-details"><h2>Parties</h2><div class="party"><h3>First Party (Service Provider)</h3><p><strong>Hala Supply Chain Services</strong></p></div><div class="party"><h3>Second Party (Client)</h3><p><strong>[Client Name]</strong></p></div></div>' },
  { block_key: 'legal.toc.auto', family: 'legal', display_name: 'Table of Contents (Auto)', editor_mode: 'readonly', render_key: 'toc_auto', description: 'Auto-generated table of contents from document headings', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: [], config: { depth: '2' } }, default_content: '<div class="toc"><h2>Table of Contents</h2><p>[Auto-generated from document headings]</p></div>' },
  { block_key: 'legal.clauses.locked', family: 'legal', display_name: 'Legal Clauses (Locked)', editor_mode: 'clause', render_key: 'legal_clauses', description: 'Standard legal clauses with locked formatting — jurisdiction, liability, force majeure', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<div class="legal-clauses"><h2>General Terms</h2><ol><li><strong>Governing Law:</strong> This agreement shall be governed by the laws of the Kingdom of Saudi Arabia.</li><li><strong>Force Majeure:</strong> Neither party shall be liable for delays caused by events beyond reasonable control.</li></ol></div>' },
  { block_key: 'annexure.a.config', family: 'annexure', display_name: 'Annexure A — Service Configuration', editor_mode: 'wysiwyg', render_key: 'annexure_config', description: 'Detailed service configuration and operational parameters', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<div class="annexure"><h2>Annexure A — Service Configuration</h2><table><thead><tr><th>Parameter</th><th>Specification</th></tr></thead><tbody><tr><td>Operating Hours</td><td>Sun-Thu 07:00-19:00</td></tr></tbody></table></div>' },
  { block_key: 'annexure.b.sla_matrix', family: 'annexure', display_name: 'Annexure B — SLA Matrix', editor_mode: 'readonly', render_key: 'annexure_sla', description: 'Auto-bound SLA KPI matrix from SLA snapshot', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['sla_snapshot_id'], config: {} }, default_content: '<div class="annexure"><h2>Annexure B — Service Level Matrix</h2>[Auto-bound from SLA snapshot]</div>' },
  { block_key: 'annexure.c.rate_card', family: 'annexure', display_name: 'Annexure C — Rate Card', editor_mode: 'readonly', render_key: 'annexure_rate_card', description: 'Auto-bound rate card from pricing snapshot', permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['pricing_snapshot_id'], config: {} }, default_content: '<div class="annexure"><h2>Annexure C — Rate Card</h2>[Auto-bound from pricing snapshot]</div>' },
  { block_key: 'annexure.d.communication_matrix', family: 'annexure', display_name: 'Annexure D — Communication Matrix', editor_mode: 'wysiwyg', render_key: 'annexure_comms', description: 'Escalation and communication matrix between parties', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }, schema: { variable_slots: [], config: {} }, default_content: '<div class="annexure"><h2>Annexure D — Communication Matrix</h2><table><thead><tr><th>Level</th><th>Hala Contact</th><th>Client Contact</th><th>Response Time</th></tr></thead><tbody><tr><td>Level 1 — Operational</td><td>Warehouse Manager</td><td>Logistics Coordinator</td><td>4 hours</td></tr></tbody></table></div>' },
  { block_key: 'legal.signature.witness', family: 'legal', display_name: 'Witness Signature Block', editor_mode: 'form', render_key: 'signature_witness', description: 'Witnessed signature block for formal legal agreements', permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true }, schema: { variable_slots: ['witness_name', 'witness_title'], config: {} }, default_content: '<div class="signature-witness"><h2>Witnesses</h2><p>Witness 1: _______________</p><p>Witness 2: _______________</p></div>' },
];

const BRANDING_PROFILES = [
  { name: 'Hala Corporate — Navy', primary_color: '#1a2744', secondary_color: '#2a4a7f', accent_color: '#c9a84c', font_family: 'IBM Plex Sans', font_heading: 'Source Serif 4', logo_url: null, cover_hero_urls: [], footer_format: { show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: 'CONFIDENTIAL — Hala Supply Chain Services' }, watermark_url: null, header_style: 'full' },
  { name: 'Hala Modern — Minimal', primary_color: '#111827', secondary_color: '#374151', accent_color: '#2563eb', font_family: 'Inter', font_heading: 'Inter', logo_url: null, cover_hero_urls: [], footer_format: { show_ref: true, show_date: true, show_completed_by: false, show_page_numbers: true, custom_text: '' }, watermark_url: null, header_style: 'minimal' },
  { name: 'Hala Premium — Gold Accent', primary_color: '#1a2744', secondary_color: '#0f172a', accent_color: '#d4a853', font_family: 'IBM Plex Sans', font_heading: 'Playfair Display', logo_url: null, cover_hero_urls: [], footer_format: { show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: 'STRICTLY CONFIDENTIAL — For Authorized Use Only' }, watermark_url: null, header_style: 'branded' },
];

// Templates are defined as [templateData, versionsData[]] pairs
// branding_profile_id is resolved after branding profiles are inserted
const TEMPLATES: Array<{
  template: { name: string; doc_type: string; status: string; default_locale: string; description: string; branding_name: string };
  versions: Array<{ version_number: number; recipe: object[]; layout: object; published: boolean }>;
}> = [
  {
    template: { name: 'Standard Quotation', doc_type: 'quote', status: 'published', default_locale: 'en', description: 'Standard commercial quotation template with pricing schedule, scope, and terms', branding_name: 'Hala Corporate — Navy' },
    versions: [{
      version_number: 1, published: true,
      recipe: [
        { block_key: 'cover.hero', order: 1, required: true, default_content_override: null, config_override: {} },
        { block_key: 'confidentiality.locked', order: 2, required: true, default_content_override: null, config_override: {} },
        { block_key: 'intro.narrative', order: 3, required: false, default_content_override: '<h2>Executive Summary</h2><p>Thank you for the opportunity to present our warehousing and logistics services quotation.</p>', config_override: {} },
        { block_key: 'scope.list', order: 4, required: true, default_content_override: null, config_override: {} },
        { block_key: 'pricing.table.single', order: 5, required: true, default_content_override: null, config_override: {} },
        { block_key: 'totals.number_to_words', order: 6, required: true, default_content_override: null, config_override: {} },
        { block_key: 'terms.standard', order: 7, required: true, default_content_override: null, config_override: {} },
        { block_key: 'signature.dual', order: 8, required: true, default_content_override: null, config_override: {} },
      ],
      layout: { cover_page: true, cover_style: 'hero_image', section_spacing: 'normal', page_break_between_sections: false, annexure_section: false, toc_auto: false },
    }],
  },
  {
    template: { name: 'Full Commercial Proposal', doc_type: 'proposal', status: 'published', default_locale: 'en', description: 'Comprehensive proposal template with executive summary, solution design, pricing, and annexures', branding_name: 'Hala Premium — Gold Accent' },
    versions: [{
      version_number: 1, published: true,
      recipe: [
        { block_key: 'cover.hero', order: 1, required: true, default_content_override: null, config_override: {} },
        { block_key: 'confidentiality.locked', order: 2, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.toc.auto', order: 3, required: false, default_content_override: null, config_override: {} },
        { block_key: 'intro.narrative', order: 4, required: true, default_content_override: '<h2>Executive Summary</h2><p>Hala Supply Chain Services is pleased to present this comprehensive warehousing and logistics proposal.</p>', config_override: {} },
        { block_key: 'scope.list', order: 5, required: true, default_content_override: null, config_override: {} },
        { block_key: 'facility.gallery', order: 6, required: false, default_content_override: null, config_override: {} },
        { block_key: 'pricing.table.single', order: 7, required: true, default_content_override: null, config_override: {} },
        { block_key: 'totals.number_to_words', order: 8, required: true, default_content_override: null, config_override: {} },
        { block_key: 'terms.standard', order: 9, required: true, default_content_override: null, config_override: {} },
        { block_key: 'closing.note', order: 10, required: false, default_content_override: null, config_override: {} },
        { block_key: 'signature.dual', order: 11, required: true, default_content_override: null, config_override: {} },
        { block_key: 'annexure.a.config', order: 12, required: false, default_content_override: null, config_override: {} },
        { block_key: 'annexure.c.rate_card', order: 13, required: false, default_content_override: null, config_override: {} },
      ],
      layout: { cover_page: true, cover_style: 'branded', section_spacing: 'spacious', page_break_between_sections: true, annexure_section: true, toc_auto: true },
    }],
  },
  {
    template: { name: 'Service Level Agreement', doc_type: 'sla', status: 'published', default_locale: 'en', description: 'Standard SLA template with KPIs, penalties, escalation matrix, and review schedule', branding_name: 'Hala Corporate — Navy' },
    versions: [{
      version_number: 1, published: true,
      recipe: [
        { block_key: 'cover.hero', order: 1, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.party_details', order: 2, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.toc.auto', order: 3, required: false, default_content_override: null, config_override: {} },
        { block_key: 'intro.narrative', order: 4, required: true, default_content_override: '<h2>Agreement Overview</h2><p>This Service Level Agreement defines the service levels and performance metrics for warehousing and logistics services.</p>', config_override: {} },
        { block_key: 'scope.list', order: 5, required: true, default_content_override: null, config_override: {} },
        { block_key: 'annexure.b.sla_matrix', order: 6, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.clauses.locked', order: 7, required: true, default_content_override: null, config_override: {} },
        { block_key: 'annexure.d.communication_matrix', order: 8, required: true, default_content_override: null, config_override: {} },
        { block_key: 'signature.dual', order: 9, required: true, default_content_override: null, config_override: {} },
      ],
      layout: { cover_page: true, cover_style: 'minimal', section_spacing: 'normal', page_break_between_sections: true, annexure_section: true, toc_auto: true },
    }],
  },
  {
    template: { name: 'Bilingual Quotation (EN/AR)', doc_type: 'quote', status: 'published', default_locale: 'bilingual', description: 'Bilingual quotation template with VAT breakdown — English and Arabic', branding_name: 'Hala Corporate — Navy' },
    versions: [{
      version_number: 1, published: true,
      recipe: [
        { block_key: 'cover.hero', order: 1, required: true, default_content_override: null, config_override: {} },
        { block_key: 'confidentiality.locked', order: 2, required: true, default_content_override: null, config_override: {} },
        { block_key: 'scope.list', order: 3, required: true, default_content_override: null, config_override: {} },
        { block_key: 'quote.pricing.vat_bilingual', order: 4, required: true, default_content_override: null, config_override: {} },
        { block_key: 'totals.number_to_words', order: 5, required: true, default_content_override: null, config_override: {} },
        { block_key: 'terms.standard', order: 6, required: true, default_content_override: null, config_override: {} },
        { block_key: 'signature.dual', order: 7, required: true, default_content_override: null, config_override: {} },
      ],
      layout: { cover_page: true, cover_style: 'hero_image', section_spacing: 'normal', page_break_between_sections: false, annexure_section: false, toc_auto: false },
    }],
  },
  {
    template: { name: 'Master Service Agreement', doc_type: 'msa', status: 'draft', default_locale: 'en', description: 'Comprehensive MSA template with legal clauses, liability, and governance framework', branding_name: 'Hala Premium — Gold Accent' },
    versions: [{
      version_number: 1, published: false,
      recipe: [
        { block_key: 'cover.hero', order: 1, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.party_details', order: 2, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.toc.auto', order: 3, required: true, default_content_override: null, config_override: {} },
        { block_key: 'intro.narrative', order: 4, required: true, default_content_override: null, config_override: {} },
        { block_key: 'scope.list', order: 5, required: true, default_content_override: null, config_override: {} },
        { block_key: 'legal.clauses.locked', order: 6, required: true, default_content_override: null, config_override: {} },
        { block_key: 'signature.dual', order: 7, required: true, default_content_override: null, config_override: {} },
      ],
      layout: { cover_page: true, cover_style: 'branded', section_spacing: 'spacious', page_break_between_sections: true, annexure_section: false, toc_auto: true },
    }],
  },
];

// ── Seed Functions ─────────────────────────────────────────────

async function seedBlocks() {
  console.log('  Seeding blocks...');
  const rows = BLOCKS.map(b => ({ id: crypto.randomUUID(), ...b }));
  const { error } = await supabase
    .from('doc_blocks')
    .upsert(rows, { onConflict: 'block_key' });
  if (error) throw new Error(`Blocks seed failed: ${error.message}`);
  console.log(`  ✓ ${BLOCKS.length} blocks upserted`);
}

async function seedBrandingProfiles(): Promise<Record<string, string>> {
  const { count } = await supabase
    .from('doc_branding_profiles')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    console.log(`  ✓ Branding profiles already seeded (${count} rows) — skipping`);
    const { data } = await supabase.from('doc_branding_profiles').select('id, name');
    return Object.fromEntries((data ?? []).map((r: any) => [r.name, r.id]));
  }

  console.log('  Seeding branding profiles...');
  const { data, error } = await supabase
    .from('doc_branding_profiles')
    .insert(BRANDING_PROFILES)
    .select('id, name');
  if (error) throw new Error(`Branding seed failed: ${error.message}`);
  console.log(`  ✓ ${data?.length} branding profiles inserted`);
  return Object.fromEntries((data ?? []).map((r: any) => [r.name, r.id]));
}

async function seedTemplates(brandingIdByName: Record<string, string>) {
  const { count } = await supabase
    .from('doc_templates')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    console.log(`  ✓ Templates already seeded (${count} rows) — skipping`);
    return;
  }

  console.log('  Seeding templates...');
  for (const { template, versions } of TEMPLATES) {
    const brandingId = brandingIdByName[template.branding_name] ?? null;
    const { data: tpl, error: tplErr } = await supabase
      .from('doc_templates')
      .insert({
        name: template.name,
        doc_type: template.doc_type,
        status: template.status,
        default_locale: template.default_locale,
        description: template.description,
        default_branding_profile_id: brandingId,
      })
      .select('id')
      .single();
    if (tplErr) throw new Error(`Template "${template.name}" insert failed: ${tplErr.message}`);

    for (const ver of versions) {
      const { error: verErr } = await supabase
        .from('doc_template_versions')
        .insert({
          template_id: tpl.id,
          version_number: ver.version_number,
          recipe: ver.recipe,
          layout: ver.layout,
          published_at: ver.published ? new Date().toISOString() : null,
        });
      if (verErr) throw new Error(`Version for "${template.name}" insert failed: ${verErr.message}`);
    }
    console.log(`  ✓ Template "${template.name}" inserted`);
  }
}

// ── Main ───────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Starting document system seed...\n');
  await seedBlocks();
  const brandingIdByName = await seedBrandingProfiles();
  await seedTemplates(brandingIdByName);
  console.log('\n✅ Seed complete\n');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
