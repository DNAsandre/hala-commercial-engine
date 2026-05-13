-- ════════════════════════════════════════════════════════════════
-- SUPA-006: Tender MVP Schema Parity Migration
-- Run: 2026-05-06
-- Author: Antigravity / Hala Commercial Engine
--
-- Fixes FK mismatch and adds all missing columns to tender tables
-- to match the frontend TenderWorkspace data model.
-- Creates 4 new tables: split_checks, pack_outputs, submission_emails, attachments.
--
-- SAFE: All ADD COLUMN IF NOT EXISTS / CREATE IF NOT EXISTS. Re-runnable.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 0. FOUNDATION CRM TABLES (Missing from earlier migrations)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  "group" TEXT,
  status TEXT,
  city TEXT,
  region TEXT,
  industry TEXT,
  account_owner TEXT,
  service_type TEXT,
  grade TEXT,
  facility TEXT,
  payment_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'commercial',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT,
  region TEXT,
  phase TEXT,
  submission_deadline TEXT,
  estimated_value NUMERIC,
  target_gp_percent NUMERIC,
  probability_percent NUMERIC,
  assigned_owner TEXT,
  source TEXT,
  days_in_status INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 1. FIX tender_packs FK: was workspaces(id), must be tenders(id)
--    (safe because no rows exist yet)
-- ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Drop the old FK constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tender_packs'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%workspaces%'
  ) THEN
    ALTER TABLE tender_packs DROP CONSTRAINT IF EXISTS tender_packs_tender_workspace_id_fkey;
  END IF;

  -- Also drop any constraint by common naming pattern
  ALTER TABLE tender_packs DROP CONSTRAINT IF EXISTS "tender_packs_tender_workspace_id_fkey";
END $$;

-- Re-add FK referencing tenders(id)
ALTER TABLE tender_packs
  DROP CONSTRAINT IF EXISTS "tp_tender_fkey",
  ADD CONSTRAINT "tp_tender_fkey"
    FOREIGN KEY (tender_workspace_id) REFERENCES tenders(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────────
-- 2. tender_packs — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_packs
  ADD COLUMN IF NOT EXISTS pack_name                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_master                BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_external_submittable  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS version                  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS owner_id                 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_name               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sections_total           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sections_drafted         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placeholders_total       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placeholders_populated   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_total          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_ready          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compliance_total         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compliance_compliant     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compliance_partial       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approvals_total          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approvals_complete       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mock_warnings            JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS mock_actions             JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS tender_type              TEXT DEFAULT 'Multi-Pack Transport Tender',
  ADD COLUMN IF NOT EXISTS readiness_score          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level               TEXT DEFAULT 'amber',
  ADD COLUMN IF NOT EXISTS crm_sync_status          TEXT DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS submission_model         TEXT DEFAULT 'multi_pack';

-- ────────────────────────────────────────────────────────────────
-- 3. tender_pack_sections — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_pack_sections
  ADD COLUMN IF NOT EXISTS approval_state TEXT DEFAULT 'not_reviewed';

-- ────────────────────────────────────────────────────────────────
-- 4. tender_placeholders — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_placeholders
  ADD COLUMN IF NOT EXISTS placeholder_key         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pack_name               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS section_title           TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS category                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS status                  TEXT DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS source                  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_status         TEXT DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS last_updated            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_by             TEXT,
  ADD COLUMN IF NOT EXISTS would_block_in_production BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes                   TEXT DEFAULT '';

-- ────────────────────────────────────────────────────────────────
-- 5. tender_required_documents — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_required_documents
  ADD COLUMN IF NOT EXISTS pack_name               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS category                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner                   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS native_status           TEXT DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS signed_pdf_status       TEXT DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS evidence_status         TEXT DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS version                 INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_in_output      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS would_block_in_production BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_updated            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes                   TEXT DEFAULT '';

-- ────────────────────────────────────────────────────────────────
-- 6. tender_compliance_items — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_compliance_items
  ADD COLUMN IF NOT EXISTS reference               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pack_name               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_level              TEXT DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS legal_review_required   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS commercial_impact       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS operational_impact      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS clarification_needed    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS would_block_in_production BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_updated            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes                   TEXT DEFAULT '';

-- ────────────────────────────────────────────────────────────────
-- 7. tender_submission_gates — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_submission_gates
  ADD COLUMN IF NOT EXISTS gate_code               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS gate_description        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS severity                TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS category                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS enforcement_mode        TEXT DEFAULT 'mock_only',
  ADD COLUMN IF NOT EXISTS runtime_mode            TEXT DEFAULT 'development_marker',
  ADD COLUMN IF NOT EXISTS is_mock                 BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS would_block             BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS would_block_reason      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS allow_test_bypass       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS linked_signal           TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_id                TEXT,
  ADD COLUMN IF NOT EXISTS owner_name              TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes                   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tender_workspace_id     TEXT;

-- Set workspace FK for gates (gates belong to a tender, not just a pack)
ALTER TABLE tender_submission_gates
  ADD COLUMN IF NOT EXISTS tender_workspace_id_col TEXT;

-- ────────────────────────────────────────────────────────────────
-- 8. tender_activity_events — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_activity_events
  ADD COLUMN IF NOT EXISTS title        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_type   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_id      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS role         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_pack TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_module TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS mock         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description  TEXT DEFAULT '';

-- ────────────────────────────────────────────────────────────────
-- 9. tender_audit_events — add missing columns
-- ────────────────────────────────────────────────────────────────

ALTER TABLE tender_audit_events
  ADD COLUMN IF NOT EXISTS event_name    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS entity_name   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_id       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS before_state  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS after_state   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS severity      TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS mock          BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS action        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS entity_type   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS entity_id     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS detail        TEXT DEFAULT '';

-- ────────────────────────────────────────────────────────────────
-- 10. NEW: tender_split_checks
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_split_checks (
  id                       TEXT PRIMARY KEY,
  tender_workspace_id      TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  source_pack_id           TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  target_pack_id           TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  check_name               TEXT NOT NULL,
  description              TEXT DEFAULT '',
  category                 TEXT DEFAULT '',
  status                   TEXT DEFAULT 'not_checked',
  severity                 TEXT DEFAULT 'medium',
  would_block_in_production BOOLEAN DEFAULT FALSE,
  mock_resolution          TEXT DEFAULT '',
  notes                    TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tsc_workspace ON tender_split_checks(tender_workspace_id);

-- ────────────────────────────────────────────────────────────────
-- 11. NEW: tender_pack_outputs
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_pack_outputs (
  id                           TEXT PRIMARY KEY,
  tender_workspace_id          TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  tender_pack_id               TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  source_pack_id               TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  output_name                  TEXT NOT NULL,
  pack_name                    TEXT DEFAULT '',
  output_type                  TEXT DEFAULT '',
  format                       TEXT DEFAULT 'PDF',
  version                      TEXT DEFAULT 'v1',
  status                       TEXT DEFAULT 'draft_mock',
  generated_by                 TEXT DEFAULT '',
  generated_at                 TIMESTAMPTZ DEFAULT NOW(),
  watermark                    TEXT DEFAULT 'TEST OUTPUT — NOT FOR CLIENT SUBMISSION',
  is_test_output               BOOLEAN DEFAULT TRUE,
  would_be_submittable_in_production BOOLEAN DEFAULT FALSE,
  mock_warnings_count          INTEGER DEFAULT 0,
  notes                        TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tpo_workspace ON tender_pack_outputs(tender_workspace_id);

-- ────────────────────────────────────────────────────────────────
-- 12. NEW: tender_submission_emails
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_submission_emails (
  id                   TEXT PRIMARY KEY,
  tender_workspace_id  TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  tender_pack_id       TEXT REFERENCES tender_packs(id) ON DELETE SET NULL,
  pack_name            TEXT DEFAULT '',
  email_type           TEXT DEFAULT 'bulk_submission',
  to_address           TEXT DEFAULT '',
  cc_external          TEXT DEFAULT '',
  cc_internal          TEXT DEFAULT '',
  subject              TEXT DEFAULT '',
  body                 TEXT DEFAULT '',
  attachment_size_mb   NUMERIC DEFAULT 0,
  status               TEXT DEFAULT 'draft_mock',
  simulated            BOOLEAN DEFAULT FALSE,
  submitted_by         TEXT DEFAULT '',
  submitted_at         TIMESTAMPTZ,
  crm_sync_status      TEXT DEFAULT 'not_synced',
  warnings_count       INTEGER DEFAULT 0,
  notes                TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tse_workspace ON tender_submission_emails(tender_workspace_id);

-- ────────────────────────────────────────────────────────────────
-- 13. NEW: tender_submission_email_attachments
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_submission_email_attachments (
  id            TEXT PRIMARY KEY,
  email_id      TEXT NOT NULL REFERENCES tender_submission_emails(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  document_type TEXT DEFAULT '',
  format        TEXT DEFAULT 'PDF',
  required      BOOLEAN DEFAULT FALSE,
  included      BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'ready_mock',
  size_mb       NUMERIC DEFAULT 0,
  notes         TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tsea_email ON tender_submission_email_attachments(email_id);

-- ────────────────────────────────────────────────────────────────
-- 14. RLS — Permissive dev policies for new tables
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'customers',
      'workspaces',
      'tender_split_checks',
      'tender_pack_outputs',
      'tender_submission_emails',
      'tender_submission_email_attachments'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    
    -- Drop existing policies to prevent conflicts if re-run
    EXECUTE format('DROP POLICY IF EXISTS "auth_read_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_write_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_%1$s" ON %1$I', t);

    EXECUTE format(
      'CREATE POLICY "auth_read_%1$s" ON %1$I FOR SELECT USING (auth.role() = ''authenticated'')',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth_write_%1$s" ON %1$I FOR ALL USING (auth.role() = ''authenticated'')',
      t
    );
    EXECUTE format(
      'CREATE POLICY "service_%1$s" ON %1$I FOR ALL USING (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END;
$$;
