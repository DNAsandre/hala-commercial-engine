/**
 * Seed Blocks Script — Sprint 3
 * Inserts the 21 core blocks from the in-memory blockLibrary into the doc_blocks table.
 * Idempotent: uses upsert on block_key to avoid duplicates.
 *
 * Usage: npx tsx scripts/seed-blocks.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Block definitions (mirrors client/src/lib/document-composer.ts) ──

const blocks = [
  {
    block_key: 'cover.hero', family: 'commercial', display_name: 'Cover Page — Hero',
    editor_mode: 'form', description: 'Full-width hero cover page with title, subtitle, and branding',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['title', 'subtitle', 'customer_name', 'ref_number', 'date'], config: {} },
    render_key: 'cover_hero',
    default_content: '<div class="cover-hero"><h1>{{title}}</h1><h2>{{subtitle}}</h2><p>Prepared for: {{customer_name}}</p><p>Ref: {{ref_number}} | Date: {{date}}</p></div>',
  },
  {
    block_key: 'confidentiality.locked', family: 'commercial', display_name: 'Confidentiality Notice',
    editor_mode: 'clause', description: 'Standard confidentiality clause',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['company_name', 'recipient_name'], config: {} },
    render_key: 'confidentiality',
    default_content: '<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services.</p></div>',
  },
  {
    block_key: 'intro.narrative', family: 'commercial', display_name: 'Introduction / Narrative',
    editor_mode: 'wysiwyg', description: 'Free-form narrative section — executive summary, company overview',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'narrative',
    default_content: '<h2>Introduction</h2><p>Hala Supply Chain Services is pleased to present this document.</p>',
  },
  {
    block_key: 'scope.list', family: 'commercial', display_name: 'Scope of Services',
    editor_mode: 'wysiwyg', description: 'Editable scope of services with bullet points',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'scope_list',
    default_content: '<h2>Scope of Services</h2><ul><li>Warehousing</li><li>Inbound</li><li>Outbound</li><li>VAS</li></ul>',
  },
  {
    block_key: 'facility.gallery', family: 'asset', display_name: 'Facility Gallery',
    editor_mode: 'form', description: 'Image gallery showcasing facility, certificates, maps',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['facility_name', 'location'], config: { max_images: '6' } },
    render_key: 'facility_gallery',
    default_content: '<div class="facility-gallery"><h2>Our Facilities</h2></div>',
  },
  {
    block_key: 'terms.standard', family: 'commercial', display_name: 'Terms & Conditions',
    editor_mode: 'wysiwyg', description: 'Standard commercial terms — payment, duration, review, insurance',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'terms',
    default_content: '<h2>Terms & Conditions</h2><ul><li>Payment Terms: Net 30 days</li><li>Contract Duration: 12 months</li></ul>',
  },
  {
    block_key: 'signature.dual', family: 'commercial', display_name: 'Dual Signature Block',
    editor_mode: 'form', description: 'Signature block for both parties',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['hala_signatory', 'hala_title', 'client_signatory', 'client_title'], config: {} },
    render_key: 'signature_dual',
    default_content: '<div class="signature-block"><h2>Acceptance & Authorization</h2></div>',
  },
  {
    block_key: 'closing.note', family: 'commercial', display_name: 'Closing Note',
    editor_mode: 'wysiwyg', description: 'Closing remarks and next steps',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'closing',
    default_content: '<h2>Closing</h2><p>We look forward to serving your logistics needs.</p>',
  },
  {
    block_key: 'pricing.table.single', family: 'data_bound', display_name: 'Pricing Table — Single Option',
    editor_mode: 'readonly', description: 'Auto-bound pricing table from current quote/proposal snapshot',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['pricing_snapshot_id'], config: { format: 'single' } },
    render_key: 'pricing_table_single',
    default_content: '<div class="pricing-table"><h2>Pricing Schedule</h2>[Auto-bound]</div>',
  },
  {
    block_key: 'pricing.table.multi_option', family: 'data_bound', display_name: 'Pricing Table — Multi Option',
    editor_mode: 'readonly', description: 'Auto-bound pricing table with multiple pricing options',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['pricing_snapshot_id'], config: { format: 'multi' } },
    render_key: 'pricing_table_multi',
    default_content: '<div class="pricing-table-multi"><h2>Pricing Options</h2>[Auto-bound]</div>',
  },
  {
    block_key: 'quote.pricing.vat_bilingual', family: 'data_bound', display_name: 'Quote Pricing — VAT Bilingual',
    editor_mode: 'readonly', description: 'Bilingual (EN/AR) pricing table with VAT breakdown',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['pricing_snapshot_id'], config: { locale: 'bilingual', show_vat: 'true' } },
    render_key: 'quote_pricing_vat',
    default_content: '<div class="pricing-vat-bilingual"><h2>Pricing Schedule</h2>[Auto-bound]</div>',
  },
  {
    block_key: 'scope.table', family: 'data_bound', display_name: 'Scope Table',
    editor_mode: 'readonly', description: 'Auto-bound scope of work table',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['scope_snapshot_id'], config: {} },
    render_key: 'scope_table',
    default_content: '<div class="scope-table"><h2>Scope of Work</h2>[Auto-bound]</div>',
  },
  {
    block_key: 'totals.number_to_words', family: 'data_bound', display_name: 'Totals — Number to Words (SAR)',
    editor_mode: 'readonly', description: 'Total amount in numbers and words (SAR)',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['pricing_snapshot_id'], config: { currency: 'SAR' } },
    render_key: 'totals_words',
    default_content: '<div class="totals-words"><p><strong>Total Amount: SAR [amount]</strong></p></div>',
  },
  {
    block_key: 'legal.party_details', family: 'legal', display_name: 'Party Details',
    editor_mode: 'clause', description: 'Legal party identification — first party and second party',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['first_party_name', 'first_party_cr', 'first_party_address', 'second_party_name', 'second_party_cr', 'second_party_address'], config: {} },
    render_key: 'party_details',
    default_content: '<div class="party-details"><h2>Parties</h2></div>',
  },
  {
    block_key: 'legal.toc.auto', family: 'legal', display_name: 'Table of Contents (Auto)',
    editor_mode: 'readonly', description: 'Auto-generated table of contents from document headings',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: [], config: { depth: '2' } },
    render_key: 'toc_auto',
    default_content: '<div class="toc"><h2>Table of Contents</h2>[Auto-generated]</div>',
  },
  {
    block_key: 'legal.clauses.locked', family: 'legal', display_name: 'Legal Clauses (Locked)',
    editor_mode: 'clause', description: 'Standard legal clauses — jurisdiction, liability, force majeure',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'legal_clauses',
    default_content: '<div class="legal-clauses"><h2>General Terms</h2><ol><li>Governing Law</li><li>Dispute Resolution</li><li>Force Majeure</li></ol></div>',
  },
  {
    block_key: 'annexure.a.config', family: 'annexure', display_name: 'Annexure A — Service Configuration',
    editor_mode: 'wysiwyg', description: 'Detailed service configuration and operational parameters',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'annexure_config',
    default_content: '<div class="annexure"><h2>Annexure A — Service Configuration</h2></div>',
  },
  {
    block_key: 'annexure.b.sla_matrix', family: 'annexure', display_name: 'Annexure B — SLA Matrix',
    editor_mode: 'readonly', description: 'Auto-bound SLA KPI matrix from SLA snapshot',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['sla_snapshot_id'], config: {} },
    render_key: 'annexure_sla',
    default_content: '<div class="annexure"><h2>Annexure B — Service Level Matrix</h2>[Auto-bound]</div>',
  },
  {
    block_key: 'annexure.c.rate_card', family: 'annexure', display_name: 'Annexure C — Rate Card',
    editor_mode: 'readonly', description: 'Auto-bound rate card from pricing snapshot',
    permissions: { editable_in_draft: false, editable_in_canon: false, ai_allowed: false, lockable: true },
    schema: { variable_slots: ['pricing_snapshot_id'], config: {} },
    render_key: 'annexure_rate_card',
    default_content: '<div class="annexure"><h2>Annexure C — Rate Card</h2>[Auto-bound]</div>',
  },
  {
    block_key: 'annexure.d.communication_matrix', family: 'annexure', display_name: 'Annexure D — Communication Matrix',
    editor_mode: 'wysiwyg', description: 'Escalation and communication matrix between parties',
    permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true },
    schema: { variable_slots: [], config: {} },
    render_key: 'annexure_comms',
    default_content: '<div class="annexure"><h2>Annexure D — Communication Matrix</h2></div>',
  },
];

async function seed() {
  console.log(`Seeding ${blocks.length} blocks into doc_blocks...`);
  const now = new Date().toISOString();

  for (const block of blocks) {
    const row = {
      block_key: block.block_key,
      display_name: block.display_name,
      family: block.family,
      editor_mode: block.editor_mode,
      description: block.description,
      default_content: block.default_content,
      render_key: block.render_key,
      permissions: block.permissions,
      schema: block.schema,
      created_by: 'seed-script',
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('doc_blocks')
      .upsert(row, { onConflict: 'block_key' });

    if (error) {
      console.error(`  ✗ ${block.block_key}: ${error.message}`);
    } else {
      console.log(`  ✓ ${block.block_key}`);
    }
  }

  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
