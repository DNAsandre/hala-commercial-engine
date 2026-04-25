-- ============================================================
-- Sprint 5: SLA + Contract Status Tables
-- ============================================================
-- Run in Supabase SQL Editor (Hala Commercial engine)
-- ============================================================

-- ─── SLA TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS slas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  customer_id TEXT,
  linked_quote_id TEXT,
  linked_quote_version INTEGER,
  linked_proposal_id TEXT,
  linked_proposal_version INTEGER,
  sla_number TEXT,
  version_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',
  title TEXT DEFAULT '',
  service_scope TEXT DEFAULT '',
  kpi_rows JSONB DEFAULT '[]'::jsonb,
  measurement_methods TEXT DEFAULT '',
  penalty_terms TEXT DEFAULT '',
  exclusions TEXT DEFAULT '',
  customer_responsibilities TEXT DEFAULT '',
  operational_notes TEXT DEFAULT '',
  effective_date TEXT,
  review_date TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  supersedes_sla_id TEXT,
  change_reason TEXT
);

-- ─── CONTRACT STATUS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS contract_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT UNIQUE NOT NULL,
  contract_status TEXT DEFAULT 'not_ready',
  contract_sent_at TEXT,
  contract_signed_at TEXT,
  contract_reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────
ALTER TABLE slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slas_select_auth" ON slas FOR SELECT TO authenticated USING (true);
CREATE POLICY "slas_insert_auth" ON slas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "slas_update_auth" ON slas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "slas_service" ON slas FOR ALL TO service_role USING (true);

CREATE POLICY "cs_select_auth" ON contract_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_insert_auth" ON contract_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cs_update_auth" ON contract_status FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cs_service" ON contract_status FOR ALL TO service_role USING (true);
