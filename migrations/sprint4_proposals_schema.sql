-- ============================================================
-- Sprint 4: Proposal Data Model — Expand proposals table
-- ============================================================
-- Run in Supabase SQL Editor (Hala Commercial engine)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='proposal_number') THEN
    ALTER TABLE proposals ADD COLUMN proposal_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='version_number') THEN
    ALTER TABLE proposals ADD COLUMN version_number INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='status') THEN
    ALTER TABLE proposals ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='customer_id') THEN
    ALTER TABLE proposals ADD COLUMN customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='linked_quote_id') THEN
    ALTER TABLE proposals ADD COLUMN linked_quote_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='linked_quote_version') THEN
    ALTER TABLE proposals ADD COLUMN linked_quote_version INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='executive_summary') THEN
    ALTER TABLE proposals ADD COLUMN executive_summary TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='scope_description') THEN
    ALTER TABLE proposals ADD COLUMN scope_description TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='service_summary') THEN
    ALTER TABLE proposals ADD COLUMN service_summary TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='pricing_snapshot') THEN
    ALTER TABLE proposals ADD COLUMN pricing_snapshot JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='assumptions') THEN
    ALTER TABLE proposals ADD COLUMN assumptions TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='exclusions') THEN
    ALTER TABLE proposals ADD COLUMN exclusions TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='indicative_sla_disclaimer') THEN
    ALTER TABLE proposals ADD COLUMN indicative_sla_disclaimer TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='negotiation_notes') THEN
    ALTER TABLE proposals ADD COLUMN negotiation_notes TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='change_reason') THEN
    ALTER TABLE proposals ADD COLUMN change_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='created_by') THEN
    ALTER TABLE proposals ADD COLUMN created_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='updated_by') THEN
    ALTER TABLE proposals ADD COLUMN updated_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='updated_at') THEN
    ALTER TABLE proposals ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='supersedes_proposal_id') THEN
    ALTER TABLE proposals ADD COLUMN supersedes_proposal_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='client_request_summary') THEN
    ALTER TABLE proposals ADD COLUMN client_request_summary TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='commercial_delta_summary') THEN
    ALTER TABLE proposals ADD COLUMN commercial_delta_summary TEXT DEFAULT '';
  END IF;
END $$;

-- Migrate existing data
UPDATE proposals SET version_number = version WHERE version_number IS NULL AND version IS NOT NULL;
UPDATE proposals SET status = state WHERE status IS NULL AND state IS NOT NULL;
UPDATE proposals SET proposal_number = 'P-' || UPPER(SUBSTRING(workspace_id, 1, 4)) || '-V' || COALESCE(version_number, 1)
WHERE proposal_number IS NULL;

-- RLS policies
DROP POLICY IF EXISTS "proposals_select_auth" ON proposals;
CREATE POLICY "proposals_select_auth" ON proposals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "proposals_insert_auth" ON proposals;
CREATE POLICY "proposals_insert_auth" ON proposals FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "proposals_update_auth" ON proposals;
CREATE POLICY "proposals_update_auth" ON proposals FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "proposals_service" ON proposals;
CREATE POLICY "proposals_service" ON proposals FOR ALL TO service_role USING (true);
