/**
 * Seed script: Extract in-memory variable data from semantic-variables.ts
 * and insert into Supabase tables.
 * 
 * Usage: node scripts/seed-variables.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzODU2NSwiZXhwIjoyMDg3NDE0NTY1fQ.AR5WyyxVgXtHt8Foj66ms15vl-fBskXhxwTb99tz99A';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// SEED DATA — extracted from semantic-variables.ts
// ============================================================

const variableDefinitions = [
  { id: "vd-001", key: "customer.name", label: "Customer Name", description: "Legal entity name of the customer", data_type: "text", scope: "global", source: "binding", binding_path: "customer.name", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-002", key: "customer.code", label: "Customer Code", description: "Internal customer reference code", data_type: "text", scope: "global", source: "binding", binding_path: "customer.code", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-003", key: "customer.industry", label: "Customer Industry", description: "Industry classification", data_type: "text", scope: "global", source: "binding", binding_path: "customer.industry", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-004", key: "customer.contact_name", label: "Contact Name", description: "Primary contact person", data_type: "text", scope: "global", source: "binding", binding_path: "customer.contact_name", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-005", key: "customer.contact_email", label: "Contact Email", description: "Primary contact email", data_type: "text", scope: "global", source: "binding", binding_path: "customer.contact_email", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-006", key: "customer.contact_phone", label: "Contact Phone", description: "Primary contact phone number", data_type: "text", scope: "global", source: "binding", binding_path: "customer.contact_phone", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-007", key: "customer.region", label: "Customer Region", description: "Geographic region", data_type: "text", scope: "global", source: "binding", binding_path: "customer.region", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-008", key: "customer.grade", label: "Customer Grade", description: "Customer tier/grade classification", data_type: "text", scope: "global", source: "binding", binding_path: "customer.grade", default_value_json: null, allowed_in_doc_types: [], namespace: "customer", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-010", key: "quote.ref_number", label: "Quote Reference", description: "Unique quotation reference number", data_type: "text", scope: "record", source: "computed", binding_path: null, default_value_json: null, allowed_in_doc_types: ["quote"], namespace: "quote", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-011", key: "quote.date", label: "Quote Date", description: "Date the quotation was issued", data_type: "date", scope: "record", source: "computed", binding_path: null, default_value_json: null, allowed_in_doc_types: ["quote"], namespace: "quote", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-012", key: "quote.validity_days", label: "Validity Period", description: "Number of days the quote remains valid", data_type: "number", scope: "template", source: "static", binding_path: null, default_value_json: 30, allowed_in_doc_types: ["quote"], namespace: "quote", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-013", key: "quote.total_amount", label: "Total Amount", description: "Total quoted amount in SAR", data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.total", default_value_json: null, allowed_in_doc_types: ["quote"], namespace: "quote", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-014", key: "quote.gp_percent", label: "Gross Profit %", description: "Gross profit margin percentage", data_type: "percent", scope: "record", source: "binding", binding_path: "pricing_snapshot.gp_percent", default_value_json: null, allowed_in_doc_types: ["quote"], namespace: "quote", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-015", key: "quote.pallets", label: "Pallet Count", description: "Number of pallet positions", data_type: "number", scope: "record", source: "binding", binding_path: "pricing_snapshot.pallets", default_value_json: null, allowed_in_doc_types: ["quote"], namespace: "quote", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-020", key: "proposal.title", label: "Proposal Title", description: "Title of the commercial proposal", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "Commercial Proposal", allowed_in_doc_types: ["proposal"], namespace: "proposal", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-021", key: "proposal.subtitle", label: "Proposal Subtitle", description: "Subtitle or tagline", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "", allowed_in_doc_types: ["proposal"], namespace: "proposal", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-022", key: "proposal.scope_summary", label: "Scope Summary", description: "Brief description of services offered", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "", allowed_in_doc_types: ["proposal"], namespace: "proposal", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-023", key: "proposal.delivery_timeline", label: "Delivery Timeline", description: "Expected delivery or implementation timeline", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "", allowed_in_doc_types: ["proposal"], namespace: "proposal", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-030", key: "sla.service_level", label: "Service Level", description: "Agreed service level tier", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "Standard", allowed_in_doc_types: ["sla"], namespace: "sla", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-031", key: "sla.response_time", label: "Response Time", description: "Maximum response time in hours", data_type: "number", scope: "record", source: "static", binding_path: null, default_value_json: 24, allowed_in_doc_types: ["sla"], namespace: "sla", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-032", key: "sla.uptime_target", label: "Uptime Target", description: "Target uptime percentage", data_type: "percent", scope: "record", source: "static", binding_path: null, default_value_json: 99.5, allowed_in_doc_types: ["sla"], namespace: "sla", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-033", key: "sla.penalty_rate", label: "Penalty Rate", description: "Penalty rate for SLA breach", data_type: "percent", scope: "record", source: "static", binding_path: null, default_value_json: 2.0, allowed_in_doc_types: ["sla"], namespace: "sla", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-034", key: "sla.start_date", label: "SLA Start Date", description: "Effective start date of the SLA", data_type: "date", scope: "record", source: "static", binding_path: null, default_value_json: null, allowed_in_doc_types: ["sla"], namespace: "sla", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-035", key: "sla.end_date", label: "SLA End Date", description: "Expiry date of the SLA", data_type: "date", scope: "record", source: "static", binding_path: null, default_value_json: null, allowed_in_doc_types: ["sla"], namespace: "sla", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-040", key: "company.name", label: "Company Name", description: "Hala Supply Chain Services legal name", data_type: "text", scope: "global", source: "static", binding_path: null, default_value_json: "Hala Supply Chain Services Co.", allowed_in_doc_types: [], namespace: "company", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-041", key: "company.cr_number", label: "CR Number", description: "Commercial registration number", data_type: "text", scope: "global", source: "static", binding_path: null, default_value_json: "1010XXXXXX", allowed_in_doc_types: [], namespace: "company", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-042", key: "company.vat_number", label: "VAT Number", description: "VAT registration number", data_type: "text", scope: "global", source: "static", binding_path: null, default_value_json: "3XXXXXXXXXX0003", allowed_in_doc_types: [], namespace: "company", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-043", key: "company.address", label: "Company Address", description: "Registered office address", data_type: "text", scope: "global", source: "static", binding_path: null, default_value_json: "Riyadh, Kingdom of Saudi Arabia", allowed_in_doc_types: [], namespace: "company", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-044", key: "company.phone", label: "Company Phone", description: "Main office phone number", data_type: "text", scope: "global", source: "static", binding_path: null, default_value_json: "+966-11-XXX-XXXX", allowed_in_doc_types: [], namespace: "company", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-045", key: "company.email", label: "Company Email", description: "Main office email", data_type: "text", scope: "global", source: "static", binding_path: null, default_value_json: "info@halascs.com", allowed_in_doc_types: [], namespace: "company", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-050", key: "doc.title", label: "Document Title", description: "Title of the document", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "", allowed_in_doc_types: [], namespace: "doc", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-051", key: "doc.subtitle", label: "Document Subtitle", description: "Subtitle or secondary heading", data_type: "text", scope: "record", source: "static", binding_path: null, default_value_json: "", allowed_in_doc_types: [], namespace: "doc", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-052", key: "doc.ref_number", label: "Document Reference", description: "Document reference number", data_type: "text", scope: "record", source: "computed", binding_path: null, default_value_json: null, allowed_in_doc_types: [], namespace: "doc", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-053", key: "doc.date", label: "Document Date", description: "Date of document creation", data_type: "date", scope: "record", source: "computed", binding_path: null, default_value_json: null, allowed_in_doc_types: [], namespace: "doc", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-054", key: "doc.version", label: "Version Number", description: "Document version", data_type: "text", scope: "record", source: "computed", binding_path: null, default_value_json: "v1", allowed_in_doc_types: [], namespace: "doc", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-055", key: "doc.author", label: "Author", description: "Document author name", data_type: "text", scope: "record", source: "binding", binding_path: "user.name", default_value_json: null, allowed_in_doc_types: [], namespace: "doc", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-060", key: "pricing.storage_rate", label: "Storage Rate", description: "Rate per pallet per month", data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.storage_rate", default_value_json: null, allowed_in_doc_types: ["quote", "proposal"], namespace: "pricing", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-061", key: "pricing.handling_rate", label: "Handling Rate", description: "Rate per pallet movement", data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.handling_rate", default_value_json: null, allowed_in_doc_types: ["quote", "proposal"], namespace: "pricing", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-062", key: "pricing.transport_rate", label: "Transport Rate", description: "Rate per delivery trip", data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.transport_rate", default_value_json: null, allowed_in_doc_types: ["quote", "proposal"], namespace: "pricing", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
  { id: "vd-063", key: "pricing.vas_total", label: "VAS Total", description: "Total value-added services amount", data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.vas_total", default_value_json: null, allowed_in_doc_types: ["quote", "proposal"], namespace: "pricing", created_by: "system", created_at: "2026-01-15T00:00:00Z" },
];

const variableSets = [
  { id: "vs-quote-en", name: "Standard Quotation (EN)", doc_type: "quote", template_version_id: "tpl-quote-en", variable_ids: ["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-010","vd-011","vd-012","vd-013","vd-014","vd-015","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055","vd-060","vd-061","vd-062","vd-063"], created_at: "2026-01-15T00:00:00Z" },
  { id: "vs-quote-bi", name: "Bilingual Quotation (EN/AR)", doc_type: "quote", template_version_id: "tpl-quote-bi", variable_ids: ["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-010","vd-011","vd-012","vd-013","vd-014","vd-015","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055","vd-060","vd-061","vd-062","vd-063"], created_at: "2026-01-15T00:00:00Z" },
  { id: "vs-proposal-en", name: "Standard Proposal (EN)", doc_type: "proposal", template_version_id: "tpl-proposal-en", variable_ids: ["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-020","vd-021","vd-022","vd-023","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055","vd-060","vd-061","vd-062","vd-063"], created_at: "2026-01-15T00:00:00Z" },
  { id: "vs-sla-en", name: "Standard SLA (EN)", doc_type: "sla", template_version_id: "tpl-sla-en", variable_ids: ["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-030","vd-031","vd-032","vd-033","vd-034","vd-035","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055"], created_at: "2026-01-15T00:00:00Z" },
  { id: "vs-contract-en", name: "Standard Contract (EN)", doc_type: "contract", template_version_id: "tpl-contract-en", variable_ids: ["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-040","vd-041","vd-042","vd-043","vd-044","vd-045","vd-050","vd-052","vd-053","vd-055"], created_at: "2026-01-15T00:00:00Z" },
];

const variableSetItems = [
  { id: "vsi-001", variable_set_id: "vs-quote-en", variable_definition_id: "vd-001", required: true, fallback_mode: "block_compile" },
  { id: "vsi-002", variable_set_id: "vs-quote-en", variable_definition_id: "vd-010", required: true, fallback_mode: "block_compile" },
  { id: "vsi-003", variable_set_id: "vs-quote-en", variable_definition_id: "vd-011", required: true, fallback_mode: "block_compile" },
  { id: "vsi-004", variable_set_id: "vs-quote-en", variable_definition_id: "vd-013", required: true, fallback_mode: "block_compile" },
  { id: "vsi-005", variable_set_id: "vs-quote-en", variable_definition_id: "vd-040", required: true, fallback_mode: "warning" },
  { id: "vsi-006", variable_set_id: "vs-quote-en", variable_definition_id: "vd-012", required: false, fallback_mode: "empty" },
  { id: "vsi-010", variable_set_id: "vs-proposal-en", variable_definition_id: "vd-001", required: true, fallback_mode: "block_compile" },
  { id: "vsi-011", variable_set_id: "vs-proposal-en", variable_definition_id: "vd-020", required: true, fallback_mode: "block_compile" },
  { id: "vsi-012", variable_set_id: "vs-proposal-en", variable_definition_id: "vd-022", required: true, fallback_mode: "warning" },
  { id: "vsi-013", variable_set_id: "vs-proposal-en", variable_definition_id: "vd-040", required: true, fallback_mode: "warning" },
  { id: "vsi-020", variable_set_id: "vs-sla-en", variable_definition_id: "vd-001", required: true, fallback_mode: "block_compile" },
  { id: "vsi-021", variable_set_id: "vs-sla-en", variable_definition_id: "vd-030", required: true, fallback_mode: "block_compile" },
  { id: "vsi-022", variable_set_id: "vs-sla-en", variable_definition_id: "vd-034", required: true, fallback_mode: "block_compile" },
  { id: "vsi-023", variable_set_id: "vs-sla-en", variable_definition_id: "vd-035", required: true, fallback_mode: "block_compile" },
];

const docVariableOverrides = [
  { id: "dvo-001", doc_instance_id: "doc-inst-q1", key: "customer.name", value_json: "Almarai Company", created_by: "hano", created_at: "2026-02-01T10:00:00Z" },
  { id: "dvo-002", doc_instance_id: "doc-inst-q1", key: "quote.ref_number", value_json: "HQ-2026-0042", created_by: "hano", created_at: "2026-02-01T10:00:00Z" },
  { id: "dvo-003", doc_instance_id: "doc-inst-q1", key: "quote.date", value_json: "2026-02-01", created_by: "hano", created_at: "2026-02-01T10:00:00Z" },
  { id: "dvo-004", doc_instance_id: "doc-inst-q1", key: "quote.total_amount", value_json: 8500000, created_by: "hano", created_at: "2026-02-01T10:00:00Z" },
  { id: "dvo-005", doc_instance_id: "doc-inst-p1", key: "customer.name", value_json: "SABIC", created_by: "rami", created_at: "2026-02-05T09:00:00Z" },
  { id: "dvo-006", doc_instance_id: "doc-inst-p1", key: "proposal.title", value_json: "SABIC National Warehousing — Commercial Proposal", created_by: "rami", created_at: "2026-02-05T09:00:00Z" },
  { id: "dvo-007", doc_instance_id: "doc-inst-s1", key: "customer.name", value_json: "Almarai Company", created_by: "hano", created_at: "2026-02-10T08:00:00Z" },
  { id: "dvo-008", doc_instance_id: "doc-inst-s1", key: "sla.service_level", value_json: "Premium Cold Chain", created_by: "hano", created_at: "2026-02-10T08:00:00Z" },
];

// ============================================================
// MIGRATION
// ============================================================
async function run() {
  console.log("🔄 Creating tables via SQL...");
  
  // Execute table creation SQL
  const sql = `
    CREATE TABLE IF NOT EXISTS variable_definitions (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      data_type TEXT NOT NULL DEFAULT 'text',
      scope TEXT NOT NULL DEFAULT 'global',
      source TEXT NOT NULL DEFAULT 'static',
      binding_path TEXT,
      default_value_json JSONB,
      allowed_in_doc_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      namespace TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE variable_definitions ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_definitions_select') THEN
        CREATE POLICY variable_definitions_select ON variable_definitions FOR SELECT USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_definitions_insert') THEN
        CREATE POLICY variable_definitions_insert ON variable_definitions FOR INSERT WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_definitions_update') THEN
        CREATE POLICY variable_definitions_update ON variable_definitions FOR UPDATE USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_definitions_delete') THEN
        CREATE POLICY variable_definitions_delete ON variable_definitions FOR DELETE USING (true);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS variable_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      template_version_id TEXT,
      variable_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE variable_sets ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_sets_select') THEN
        CREATE POLICY variable_sets_select ON variable_sets FOR SELECT USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_sets_insert') THEN
        CREATE POLICY variable_sets_insert ON variable_sets FOR INSERT WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_sets_update') THEN
        CREATE POLICY variable_sets_update ON variable_sets FOR UPDATE USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_sets_delete') THEN
        CREATE POLICY variable_sets_delete ON variable_sets FOR DELETE USING (true);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS variable_set_items (
      id TEXT PRIMARY KEY,
      variable_set_id TEXT NOT NULL REFERENCES variable_sets(id) ON DELETE CASCADE,
      variable_definition_id TEXT NOT NULL REFERENCES variable_definitions(id) ON DELETE CASCADE,
      required BOOLEAN NOT NULL DEFAULT false,
      fallback_mode TEXT NOT NULL DEFAULT 'warning'
    );
    ALTER TABLE variable_set_items ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_set_items_select') THEN
        CREATE POLICY variable_set_items_select ON variable_set_items FOR SELECT USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_set_items_insert') THEN
        CREATE POLICY variable_set_items_insert ON variable_set_items FOR INSERT WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_set_items_update') THEN
        CREATE POLICY variable_set_items_update ON variable_set_items FOR UPDATE USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variable_set_items_delete') THEN
        CREATE POLICY variable_set_items_delete ON variable_set_items FOR DELETE USING (true);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS doc_variable_overrides (
      id TEXT PRIMARY KEY,
      doc_instance_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json JSONB,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_dvo_doc_instance ON doc_variable_overrides(doc_instance_id);
    CREATE INDEX IF NOT EXISTS idx_dvo_key ON doc_variable_overrides(key);
    ALTER TABLE doc_variable_overrides ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'doc_variable_overrides_select') THEN
        CREATE POLICY doc_variable_overrides_select ON doc_variable_overrides FOR SELECT USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'doc_variable_overrides_insert') THEN
        CREATE POLICY doc_variable_overrides_insert ON doc_variable_overrides FOR INSERT WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'doc_variable_overrides_update') THEN
        CREATE POLICY doc_variable_overrides_update ON doc_variable_overrides FOR UPDATE USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'doc_variable_overrides_delete') THEN
        CREATE POLICY doc_variable_overrides_delete ON doc_variable_overrides FOR DELETE USING (true);
      END IF;
    END $$;
  `;

  // Tables already created via SQL Editor — skip RPC call
  // const { error: sqlError } = await supabase.rpc('exec_sql', { sql_text: sql });
  
  // If RPC not available, use direct REST approach — tables may need manual SQL creation
  // Let's try inserting directly — if tables exist, this works; if not, we'll get an error
  
  console.log("📦 Seeding variable_definitions...");
  const { error: vdErr } = await supabase.from('variable_definitions').upsert(variableDefinitions, { onConflict: 'id' });
  if (vdErr) {
    console.error("❌ variable_definitions:", vdErr.message);
    if (vdErr.message.includes('relation') && vdErr.message.includes('does not exist')) {
      console.error("\n⚠️  Tables don't exist yet. Please run the SQL in scripts/migrate-variables.sql in the Supabase SQL Editor first.\n");
      process.exit(1);
    }
  } else {
    console.log(`✅ variable_definitions: ${variableDefinitions.length} rows upserted`);
  }

  console.log("📦 Seeding variable_sets...");
  const { error: vsErr } = await supabase.from('variable_sets').upsert(variableSets, { onConflict: 'id' });
  if (vsErr) console.error("❌ variable_sets:", vsErr.message);
  else console.log(`✅ variable_sets: ${variableSets.length} rows upserted`);

  console.log("📦 Seeding variable_set_items...");
  const { error: vsiErr } = await supabase.from('variable_set_items').upsert(variableSetItems, { onConflict: 'id' });
  if (vsiErr) console.error("❌ variable_set_items:", vsiErr.message);
  else console.log(`✅ variable_set_items: ${variableSetItems.length} rows upserted`);

  console.log("📦 Seeding doc_variable_overrides...");
  const { error: dvoErr } = await supabase.from('doc_variable_overrides').upsert(docVariableOverrides, { onConflict: 'id' });
  if (dvoErr) console.error("❌ doc_variable_overrides:", dvoErr.message);
  else console.log(`✅ doc_variable_overrides: ${docVariableOverrides.length} rows upserted`);

  console.log("\n🎉 Seed complete!");
}

run().catch(console.error);
