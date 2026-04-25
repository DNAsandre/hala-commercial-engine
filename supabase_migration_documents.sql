-- ==============================================================================
-- DOCUMENT COMPOSER — SUPABASE MIGRATION
-- Tables: blocks, branding, templates, template_versions, instances,
--         instance_versions, compiled_outputs, vault_assets
-- ==============================================================================

DROP TABLE IF EXISTS doc_vault_assets CASCADE;
DROP TABLE IF EXISTS doc_compiled_outputs CASCADE;
DROP TABLE IF EXISTS doc_instance_versions CASCADE;
DROP TABLE IF EXISTS doc_instances CASCADE;
DROP TABLE IF EXISTS doc_template_versions CASCADE;
DROP TABLE IF EXISTS doc_templates CASCADE;
DROP TABLE IF EXISTS doc_branding_profiles CASCADE;
DROP TABLE IF EXISTS doc_blocks CASCADE;

-- 1. Block Library
CREATE TABLE doc_blocks (
    id TEXT PRIMARY KEY,
    block_key TEXT UNIQUE NOT NULL,
    family TEXT NOT NULL CHECK (family IN ('commercial','data_bound','legal','annexure','asset')),
    display_name TEXT NOT NULL,
    editor_mode TEXT NOT NULL CHECK (editor_mode IN ('wysiwyg','form','readonly','clause')),
    permissions JSONB NOT NULL DEFAULT '{}',
    schema JSONB NOT NULL DEFAULT '{}',
    render_key TEXT NOT NULL,
    default_content TEXT NOT NULL DEFAULT '',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Branding Profiles
CREATE TABLE doc_branding_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL DEFAULT '#1a2744',
    secondary_color TEXT NOT NULL DEFAULT '#2a4a7f',
    accent_color TEXT NOT NULL DEFAULT '#c9a84c',
    font_family TEXT NOT NULL DEFAULT 'IBM Plex Sans',
    font_heading TEXT NOT NULL DEFAULT 'Source Serif 4',
    logo_url TEXT DEFAULT '',
    cover_hero_urls JSONB DEFAULT '[]',
    footer_format JSONB NOT NULL DEFAULT '{}',
    watermark_url TEXT,
    header_style TEXT NOT NULL CHECK (header_style IN ('full','minimal','branded')) DEFAULT 'full',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Templates
CREATE TABLE doc_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('quote','proposal','sla','msa','service_order_transport','service_order_warehouse')),
    status TEXT NOT NULL CHECK (status IN ('draft','published','archived')) DEFAULT 'draft',
    default_branding_profile_id TEXT REFERENCES doc_branding_profiles(id),
    default_locale TEXT NOT NULL CHECK (default_locale IN ('en','ar','bilingual')) DEFAULT 'en',
    description TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Template Versions
CREATE TABLE doc_template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES doc_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    recipe JSONB NOT NULL DEFAULT '[]',
    layout JSONB NOT NULL DEFAULT '{}',
    published_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Document Instances
CREATE TABLE doc_instances (
    id TEXT PRIMARY KEY,
    doc_type TEXT NOT NULL,
    template_version_id TEXT REFERENCES doc_template_versions(id),
    status TEXT NOT NULL CHECK (status IN ('draft','canon')) DEFAULT 'draft',
    linked_entity_type TEXT NOT NULL,
    linked_entity_id TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    workspace_id TEXT,
    workspace_name TEXT,
    current_version_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Document Instance Versions
CREATE TABLE doc_instance_versions (
    id TEXT PRIMARY KEY,
    doc_instance_id TEXT NOT NULL REFERENCES doc_instances(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    blocks JSONB NOT NULL DEFAULT '[]',
    bindings JSONB NOT NULL DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Compiled Outputs
CREATE TABLE doc_compiled_outputs (
    id TEXT PRIMARY KEY,
    doc_instance_version_id TEXT REFERENCES doc_instance_versions(id),
    output_type TEXT NOT NULL DEFAULT 'pdf',
    file_asset_id TEXT,
    checksum TEXT,
    compiled_at TIMESTAMPTZ DEFAULT NOW(),
    compiled_by TEXT,
    status TEXT NOT NULL CHECK (status IN ('success','failed')) DEFAULT 'success',
    error_text TEXT,
    branding_profile_id TEXT REFERENCES doc_branding_profiles(id),
    doc_instance_id TEXT REFERENCES doc_instances(id),
    title TEXT
);

-- 8. Vault Assets
CREATE TABLE doc_vault_assets (
    id TEXT PRIMARY KEY,
    doc_instance_id TEXT REFERENCES doc_instances(id),
    doc_instance_version_id TEXT REFERENCES doc_instance_versions(id),
    compiled_document_id TEXT REFERENCES doc_compiled_outputs(id),
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    workspace_id TEXT,
    workspace_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('preview','final','superseded')) DEFAULT 'preview',
    branding_profile_id TEXT REFERENCES doc_branding_profiles(id),
    file_url TEXT,
    checksum TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_to_crm BOOLEAN DEFAULT FALSE,
    crm_export_status TEXT CHECK (crm_export_status IN ('not_sent','pending','sent','failed')),
    crm_export_at TIMESTAMPTZ
);

-- ==============================================================================
-- SEED DATA
-- ==============================================================================

-- Blocks (16 blocks)
INSERT INTO doc_blocks (id, block_key, family, display_name, editor_mode, permissions, schema, render_key, default_content, description) VALUES
('blk-001','cover.hero','commercial','Cover Page — Hero','form','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["title","subtitle","customer_name","ref_number","date"],"config":{}}','cover_hero','<div class="cover-hero"><h1>{{title}}</h1><h2>{{subtitle}}</h2><p>Prepared for: {{customer_name}}</p><p>Ref: {{ref_number}} | Date: {{date}}</p></div>','Full-width hero cover page with title, subtitle, and branding'),
('blk-002','confidentiality.locked','commercial','Confidentiality Notice','clause','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["company_name","recipient_name"],"config":{}}','confidentiality','<div class="confidentiality"><p><strong>CONFIDENTIAL</strong></p><p>This document is the property of Hala Supply Chain Services.</p></div>','Standard confidentiality clause'),
('blk-003','intro.narrative','commercial','Introduction / Narrative','wysiwyg','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":true,"lockable":true}','{"variable_slots":[],"config":{}}','narrative','<h2>Introduction</h2><p>Hala Supply Chain Services is pleased to present this document.</p>','Free-form narrative section'),
('blk-004','scope.list','commercial','Scope of Services','wysiwyg','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":true,"lockable":true}','{"variable_slots":[],"config":{}}','scope_list','<h2>Scope of Services</h2><ul><li>Warehousing</li><li>Inbound</li><li>Outbound</li><li>VAS</li></ul>','Editable scope of services'),
('blk-005','facility.gallery','asset','Facility Gallery','form','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["facility_name","location"],"config":{"max_images":"6"}}','facility_gallery','<div class="facility-gallery"><h2>Our Facilities</h2></div>','Image gallery showcasing facility'),
('blk-006','terms.standard','commercial','Terms & Conditions','wysiwyg','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":true,"lockable":true}','{"variable_slots":[],"config":{}}','terms','<h2>Terms & Conditions</h2><ul><li>Payment Terms: Net 30</li><li>Duration: 12 months</li></ul>','Standard commercial terms'),
('blk-007','signature.dual','commercial','Dual Signature Block','form','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["hala_signatory","hala_title","client_signatory","client_title"],"config":{}}','signature_dual','<div class="signature-block"><h2>Acceptance</h2></div>','Signature block for both parties'),
('blk-008','closing.note','commercial','Closing Note','wysiwyg','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":true,"lockable":true}','{"variable_slots":[],"config":{}}','closing','<h2>Closing</h2><p>We look forward to the opportunity to serve your logistics needs.</p>','Closing remarks and next steps'),
('blk-010','pricing.table.single','data_bound','Pricing Table — Single Option','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["pricing_snapshot_id"],"config":{"format":"single"}}','pricing_table_single','<div class="pricing-table"><h2>Pricing Schedule</h2></div>','Auto-bound pricing table'),
('blk-011','pricing.table.multi_option','data_bound','Pricing Table — Multi Option','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["pricing_snapshot_id"],"config":{"format":"multi"}}','pricing_table_multi','<div class="pricing-table-multi"><h2>Pricing Options</h2></div>','Multi-option pricing table'),
('blk-012','quote.pricing.vat_bilingual','data_bound','Quote Pricing — VAT Bilingual','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["pricing_snapshot_id"],"config":{"locale":"bilingual","show_vat":"true"}}','quote_pricing_vat','<div class="pricing-vat-bilingual"><h2>Pricing / جدول الأسعار</h2></div>','Bilingual pricing with VAT'),
('blk-013','scope.table','data_bound','Scope Table','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["scope_snapshot_id"],"config":{}}','scope_table','<div class="scope-table"><h2>Scope of Work</h2></div>','Auto-bound scope table'),
('blk-014','totals.number_to_words','data_bound','Totals — Number to Words (SAR)','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["pricing_snapshot_id"],"config":{"currency":"SAR"}}','totals_words','<div class="totals-words"><p><strong>Total Amount: SAR [amount]</strong></p></div>','Total in numbers and words'),
('blk-020','legal.party_details','legal','Party Details','clause','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["first_party_name","first_party_cr","second_party_name","second_party_cr"],"config":{}}','party_details','<div class="party-details"><h2>Parties</h2></div>','Legal party identification'),
('blk-021','legal.toc.auto','legal','Table of Contents (Auto)','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":[],"config":{"depth":"2"}}','toc_auto','<div class="toc"><h2>Table of Contents</h2></div>','Auto-generated TOC'),
('blk-022','legal.clauses.locked','legal','Legal Clauses (Locked)','clause','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":[],"config":{}}','legal_clauses','<div class="legal-clauses"><h2>General Terms</h2></div>','Standard legal clauses'),
('blk-030','annexure.a.config','annexure','Annexure A — Service Configuration','wysiwyg','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":true,"lockable":true}','{"variable_slots":[],"config":{}}','annexure_config','<div class="annexure"><h2>Annexure A</h2></div>','Service configuration'),
('blk-031','annexure.b.sla_matrix','annexure','Annexure B — SLA Matrix','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["sla_snapshot_id"],"config":{}}','annexure_sla','<div class="annexure"><h2>Annexure B — SLA Matrix</h2></div>','Auto-bound SLA KPI matrix'),
('blk-032','annexure.c.rate_card','annexure','Annexure C — Rate Card','readonly','{"editable_in_draft":false,"editable_in_canon":false,"ai_allowed":false,"lockable":true}','{"variable_slots":["pricing_snapshot_id"],"config":{}}','annexure_rate_card','<div class="annexure"><h2>Annexure C — Rate Card</h2></div>','Auto-bound rate card'),
('blk-033','annexure.d.communication_matrix','annexure','Annexure D — Communication Matrix','wysiwyg','{"editable_in_draft":true,"editable_in_canon":false,"ai_allowed":true,"lockable":true}','{"variable_slots":[],"config":{}}','annexure_comms','<div class="annexure"><h2>Annexure D — Communication Matrix</h2></div>','Escalation and communication matrix')
ON CONFLICT (id) DO NOTHING;

-- Branding Profiles (3)
INSERT INTO doc_branding_profiles (id, name, primary_color, secondary_color, accent_color, font_family, font_heading, logo_url, cover_hero_urls, footer_format, watermark_url, header_style) VALUES
('bp-001','Hala Corporate — Navy','#1a2744','#2a4a7f','#c9a84c','IBM Plex Sans','Source Serif 4','','[]'::jsonb,'{"show_ref":true,"show_date":true,"show_completed_by":true,"show_page_numbers":true,"custom_text":"CONFIDENTIAL — Hala Supply Chain Services"}'::jsonb,NULL,'full'),
('bp-002','Hala Modern — Minimal','#111827','#374151','#2563eb','Inter','Inter','','[]'::jsonb,'{"show_ref":true,"show_date":true,"show_completed_by":false,"show_page_numbers":true,"custom_text":""}'::jsonb,NULL,'minimal'),
('bp-003','Hala Premium — Gold Accent','#1a2744','#0f172a','#d4a853','IBM Plex Sans','Playfair Display','','[]'::jsonb,'{"show_ref":true,"show_date":true,"show_completed_by":true,"show_page_numbers":true,"custom_text":"STRICTLY CONFIDENTIAL — For Authorized Use Only"}'::jsonb,NULL,'branded')
ON CONFLICT (id) DO NOTHING;

-- Templates (5)
INSERT INTO doc_templates (id, name, doc_type, status, default_branding_profile_id, default_locale, description, created_by) VALUES
('tpl-001','Standard Quotation','quote','published','bp-001','en','Standard commercial quotation template','Faisal Al-Rashid'),
('tpl-002','Full Commercial Proposal','proposal','published','bp-003','en','Comprehensive proposal template','Faisal Al-Rashid'),
('tpl-003','Service Level Agreement','sla','published','bp-001','en','Standard SLA template with KPIs','Faisal Al-Rashid'),
('tpl-004','Bilingual Quotation (EN/AR)','quote','published','bp-001','bilingual','Bilingual quotation with VAT','Faisal Al-Rashid'),
('tpl-005','Master Service Agreement','msa','draft','bp-003','en','Comprehensive MSA template','Faisal Al-Rashid')
ON CONFLICT (id) DO NOTHING;

-- Template Versions (5)
INSERT INTO doc_template_versions (id, template_id, version_number, recipe, layout, published_at, created_by) VALUES
('tplv-001-1','tpl-001',1,'[{"block_key":"cover.hero","order":1,"required":true},{"block_key":"confidentiality.locked","order":2,"required":true},{"block_key":"intro.narrative","order":3,"required":false},{"block_key":"scope.list","order":4,"required":true},{"block_key":"pricing.table.single","order":5,"required":true},{"block_key":"totals.number_to_words","order":6,"required":true},{"block_key":"terms.standard","order":7,"required":true},{"block_key":"signature.dual","order":8,"required":true}]'::jsonb,'{"cover_page":true,"cover_style":"hero_image","section_spacing":"normal","page_break_between_sections":false,"annexure_section":false,"toc_auto":false}'::jsonb,'2026-01-20','Faisal Al-Rashid'),
('tplv-002-1','tpl-002',1,'[{"block_key":"cover.hero","order":1,"required":true},{"block_key":"confidentiality.locked","order":2,"required":true},{"block_key":"legal.toc.auto","order":3,"required":false},{"block_key":"intro.narrative","order":4,"required":true},{"block_key":"scope.list","order":5,"required":true},{"block_key":"facility.gallery","order":6,"required":false},{"block_key":"pricing.table.single","order":7,"required":true},{"block_key":"totals.number_to_words","order":8,"required":true},{"block_key":"terms.standard","order":9,"required":true},{"block_key":"closing.note","order":10,"required":false},{"block_key":"signature.dual","order":11,"required":true},{"block_key":"annexure.a.config","order":12,"required":false},{"block_key":"annexure.c.rate_card","order":13,"required":false}]'::jsonb,'{"cover_page":true,"cover_style":"branded","section_spacing":"spacious","page_break_between_sections":true,"annexure_section":true,"toc_auto":true}'::jsonb,'2026-01-25','Faisal Al-Rashid'),
('tplv-003-1','tpl-003',1,'[{"block_key":"cover.hero","order":1,"required":true},{"block_key":"legal.party_details","order":2,"required":true},{"block_key":"legal.toc.auto","order":3,"required":false},{"block_key":"intro.narrative","order":4,"required":true},{"block_key":"scope.list","order":5,"required":true},{"block_key":"annexure.b.sla_matrix","order":6,"required":true},{"block_key":"legal.clauses.locked","order":7,"required":true},{"block_key":"annexure.d.communication_matrix","order":8,"required":true},{"block_key":"signature.dual","order":9,"required":true}]'::jsonb,'{"cover_page":true,"cover_style":"minimal","section_spacing":"normal","page_break_between_sections":true,"annexure_section":true,"toc_auto":true}'::jsonb,'2026-02-01','Faisal Al-Rashid'),
('tplv-004-1','tpl-004',1,'[{"block_key":"cover.hero","order":1,"required":true},{"block_key":"confidentiality.locked","order":2,"required":true},{"block_key":"scope.list","order":3,"required":true},{"block_key":"quote.pricing.vat_bilingual","order":4,"required":true},{"block_key":"totals.number_to_words","order":5,"required":true},{"block_key":"terms.standard","order":6,"required":true},{"block_key":"signature.dual","order":7,"required":true}]'::jsonb,'{"cover_page":true,"cover_style":"hero_image","section_spacing":"normal","page_break_between_sections":false,"annexure_section":false,"toc_auto":false}'::jsonb,'2026-02-05','Faisal Al-Rashid'),
('tplv-005-1','tpl-005',1,'[{"block_key":"cover.hero","order":1,"required":true},{"block_key":"legal.party_details","order":2,"required":true},{"block_key":"legal.toc.auto","order":3,"required":true},{"block_key":"intro.narrative","order":4,"required":true},{"block_key":"scope.list","order":5,"required":true},{"block_key":"legal.clauses.locked","order":6,"required":true},{"block_key":"signature.dual","order":7,"required":true}]'::jsonb,'{"cover_page":true,"cover_style":"branded","section_spacing":"spacious","page_break_between_sections":true,"annexure_section":false,"toc_auto":true}'::jsonb,NULL,'Faisal Al-Rashid')
ON CONFLICT (id) DO NOTHING;

-- Document Instances (2)
INSERT INTO doc_instances (id, doc_type, template_version_id, status, linked_entity_type, linked_entity_id, customer_id, customer_name, workspace_id, workspace_name, current_version_id, created_by) VALUES
('di-001','proposal','tplv-002-1','draft','proposal_version','prop-sabic-v3','c1','SABIC','ws-1','SABIC Jubail Warehousing','div-001-2','Faisal Al-Rashid'),
('di-002','quote','tplv-001-1','canon','quote_version','qt-maaden-v2','c2','Ma''aden','ws-2','Ma''aden Ras Al Khair','div-002-1','Nadia Al-Harbi')
ON CONFLICT (id) DO NOTHING;

-- Instance Versions (3)
INSERT INTO doc_instance_versions (id, doc_instance_id, version_number, blocks, bindings, created_by, created_at) VALUES
('div-001-1','di-001',1,'[{"block_key":"cover.hero","order":1,"content":"<h1>Commercial Proposal</h1>","is_locked":false,"is_ai_generated":false,"config":{}},{"block_key":"pricing.table.single","order":5,"content":"<h2>Pricing Schedule</h2>","is_locked":false,"is_ai_generated":false,"config":{}}]'::jsonb,'{"pricing_snapshot_id":"ps-sabic-001","scope_snapshot_id":"ss-sabic-001","ecr_score_id":"ecr-sabic-001","sla_snapshot_id":null}'::jsonb,'Faisal Al-Rashid','2026-02-01'),
('div-001-2','di-001',2,'[{"block_key":"cover.hero","order":1,"content":"<h1>Commercial Proposal — Jubail</h1>","is_locked":true,"is_ai_generated":false,"config":{}},{"block_key":"pricing.table.single","order":5,"content":"<h2>Pricing Schedule v2</h2>","is_locked":false,"is_ai_generated":false,"config":{}}]'::jsonb,'{"pricing_snapshot_id":"ps-sabic-002","scope_snapshot_id":"ss-sabic-001","ecr_score_id":"ecr-sabic-001","sla_snapshot_id":null}'::jsonb,'Faisal Al-Rashid','2026-02-10'),
('div-002-1','di-002',1,'[{"block_key":"cover.hero","order":1,"content":"<h1>Commercial Quotation</h1>","is_locked":true,"is_ai_generated":false,"config":{}},{"block_key":"pricing.table.single","order":4,"content":"<h2>Pricing</h2>","is_locked":true,"is_ai_generated":false,"config":{}}]'::jsonb,'{"pricing_snapshot_id":"ps-maaden-001","scope_snapshot_id":"ss-maaden-001","ecr_score_id":"ecr-maaden-001","sla_snapshot_id":null}'::jsonb,'Nadia Al-Harbi','2026-01-28')
ON CONFLICT (id) DO NOTHING;

-- Compiled Outputs (1)
INSERT INTO doc_compiled_outputs (id, doc_instance_version_id, output_type, file_asset_id, checksum, compiled_by, status, branding_profile_id, doc_instance_id, title) VALUES
('cd-001','div-002-1','pdf','fa-maaden-quote-pdf','sha256:a1b2c3d4e5f6','Nadia Al-Harbi','success','bp-001','di-002','Ma''aden Quotation — HCS-Q-2026-012')
ON CONFLICT (id) DO NOTHING;

-- Vault Assets (1)
INSERT INTO doc_vault_assets (id, doc_instance_id, doc_instance_version_id, compiled_document_id, title, doc_type, customer_id, customer_name, workspace_id, workspace_name, status, branding_profile_id, file_url, checksum, created_by, sent_to_crm, crm_export_status, crm_export_at) VALUES
('va-001','di-002','div-002-1','cd-001','Ma''aden Quotation — HCS-Q-2026-012','quote','c2','Ma''aden','ws-2','Ma''aden Ras Al Khair','final','bp-001','/vault/maaden-quote-final.pdf','sha256:a1b2c3d4e5f6','Nadia Al-Harbi',true,'sent','2026-01-31T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE doc_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_branding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_instance_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_compiled_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_vault_assets ENABLE ROW LEVEL SECURITY;

-- doc_blocks
CREATE POLICY IF NOT EXISTS "doc_blocks_select" ON doc_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_blocks_insert" ON doc_blocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "doc_blocks_update" ON doc_blocks FOR UPDATE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_blocks_delete" ON doc_blocks FOR DELETE TO authenticated USING (true);

-- doc_branding_profiles
CREATE POLICY IF NOT EXISTS "doc_branding_select" ON doc_branding_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_branding_insert" ON doc_branding_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "doc_branding_update" ON doc_branding_profiles FOR UPDATE TO authenticated USING (true);

-- doc_templates
CREATE POLICY IF NOT EXISTS "doc_templates_select" ON doc_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_templates_insert" ON doc_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "doc_templates_update" ON doc_templates FOR UPDATE TO authenticated USING (true);

-- doc_template_versions (immutable — no UPDATE/DELETE)
CREATE POLICY IF NOT EXISTS "doc_template_versions_select" ON doc_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_template_versions_insert" ON doc_template_versions FOR INSERT TO authenticated WITH CHECK (true);

-- doc_instances
CREATE POLICY IF NOT EXISTS "doc_instances_select" ON doc_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_instances_insert" ON doc_instances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "doc_instances_update" ON doc_instances FOR UPDATE TO authenticated USING (true);

-- doc_instance_versions (immutable — no UPDATE/DELETE)
CREATE POLICY IF NOT EXISTS "doc_instance_versions_select" ON doc_instance_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_instance_versions_insert" ON doc_instance_versions FOR INSERT TO authenticated WITH CHECK (true);

-- doc_compiled_outputs
CREATE POLICY IF NOT EXISTS "doc_compiled_outputs_select" ON doc_compiled_outputs FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_compiled_outputs_insert" ON doc_compiled_outputs FOR INSERT TO authenticated WITH CHECK (true);

-- doc_vault_assets
CREATE POLICY IF NOT EXISTS "doc_vault_assets_select" ON doc_vault_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_vault_assets_insert" ON doc_vault_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "doc_vault_assets_update" ON doc_vault_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "doc_vault_assets_delete" ON doc_vault_assets FOR DELETE TO authenticated USING (true);
