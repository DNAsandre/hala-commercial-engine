-- ════════════════════════════════════════════════════════════════
-- INTAKE-001: Unified Commercial Ticket Intake + Lineage System
-- Date: 2026-05-20   Rev: 4
-- Author: Antigravity / Hala Commercial Engine
--
-- Purpose:
--   Creates a FRESH commercial_tickets table as the unified intake
--   object for Proposal, Tender, Renewal, and SLA ticket types.
--   Includes full source/lineage metadata for data provenance.
--
-- Doctrine:
--   - Null = unknown / not captured yet
--   - 0 = explicitly confirmed zero
--   - Empty string is NOT truth. No fake defaults for business fields.
--   - Quarantine is for real records with incomplete proof.
--   - No open DELETE. Soft-delete via active=false.
--   - Audit trail is immutable and survives ticket deactivation.
--   - This table has ZERO dependency on obsolete commercial_v2_* tables.
--
-- SAFE: Fully re-runnable. All constraints wrapped in IF NOT EXISTS.
-- DO NOT AUTO-EXECUTE. Human must run manually in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. commercial_tickets — Unified intake master table
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_tickets (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Ticket Type ──────────────────────────────────────────────
  ticket_type               text NOT NULL CHECK (ticket_type IN ('proposal', 'tender', 'renewal', 'sla')),

  -- ── Identity (all nullable — no fake defaults) ───────────────
  ticket_title              text,
  customer_name             text,
  customer_id               text,
  contact_name              text,
  contact_email             text,
  contact_phone             text,
  company                   text,

  -- ── Ownership ────────────────────────────────────────────────
  owner                     text,
  team_members              text[] DEFAULT '{}',
  region                    text,
  industry                  text,

  -- ── Pipeline Placement ───────────────────────────────────────
  crm_pipeline_stage        text,
  internal_stage            text,

  -- ── Commercial Values (NULLABLE: null = unknown, 0 = confirmed zero) ──
  estimated_value           numeric,
  target_gp_percent         numeric,
  probability_percent       numeric,

  -- ── Timeline ─────────────────────────────────────────────────
  target_date               text,

  -- ── Notes ────────────────────────────────────────────────────
  notes                     text,

  -- ── Type-Specific Details (JSONB) ────────────────────────────
  type_details              jsonb DEFAULT '{}'::jsonb,

  -- ── Source / Lineage Metadata ────────────────────────────────
  source_type               text CHECK (source_type IN (
    'crm_opportunity', 'approved_excel', 'uploaded_document',
    'manual_verified', 'customer_request', 'renewal_trigger',
    'contract_trigger'
  )),
  source_reference          text,
  source_file               text,
  source_sheet              text,
  source_row_id             text,
  source_document_id        text,

  -- ── Lineage Verification ─────────────────────────────────────
  lineage_status            text NOT NULL DEFAULT 'unverified'
    CHECK (lineage_status IN ('unverified', 'needs_review', 'verified', 'rejected')),
  lineage_notes             text,
  verified_by               text,
  verified_at               timestamptz,
  quarantined_reason        text,

  -- ── Intake Origin ────────────────────────────────────────────
  created_from_intake       boolean NOT NULL DEFAULT true,

  -- ── Optional Legacy Links (read-only references, no FK) ─────
  legacy_workspace_id       text,
  legacy_opportunity_id     text,
  legacy_tender_id          text,

  -- ── Lifecycle ────────────────────────────────────────────────
  active                    boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────
-- 2. SLA guardrail constraints (re-runnable)
--    - SLA must have a real customer_id (not null, not blank)
--    - SLA must have parent_ticket_id OR standalone_reason (not blank)
-- ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ct_sla_requires_customer'
  ) THEN
    ALTER TABLE commercial_tickets
      ADD CONSTRAINT ct_sla_requires_customer
      CHECK (
        ticket_type != 'sla'
        OR NULLIF(trim(customer_id), '') IS NOT NULL
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ct_sla_requires_parent_or_reason'
  ) THEN
    ALTER TABLE commercial_tickets
      ADD CONSTRAINT ct_sla_requires_parent_or_reason
      CHECK (
        ticket_type != 'sla'
        OR NULLIF(trim(type_details->>'parent_ticket_id'), '') IS NOT NULL
        OR NULLIF(trim(type_details->>'standalone_reason'), '') IS NOT NULL
      );
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- 3. updated_at auto-trigger
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ct_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ct_updated_at ON commercial_tickets;
CREATE TRIGGER trg_ct_updated_at
  BEFORE UPDATE ON commercial_tickets
  FOR EACH ROW
  EXECUTE FUNCTION ct_set_updated_at();


-- ────────────────────────────────────────────────────────────────
-- 4. Indexes
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ct_type            ON commercial_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_ct_lineage         ON commercial_tickets(lineage_status);
CREATE INDEX IF NOT EXISTS idx_ct_crm_stage       ON commercial_tickets(crm_pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_ct_owner           ON commercial_tickets(owner);
CREATE INDEX IF NOT EXISTS idx_ct_region          ON commercial_tickets(region);
CREATE INDEX IF NOT EXISTS idx_ct_customer_id     ON commercial_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_ct_active          ON commercial_tickets(active);
CREATE INDEX IF NOT EXISTS idx_ct_source_type     ON commercial_tickets(source_type);
CREATE INDEX IF NOT EXISTS idx_ct_created         ON commercial_tickets(created_at DESC);


-- ────────────────────────────────────────────────────────────────
-- 5. RLS — Authenticated-only writes, no DELETE
-- ────────────────────────────────────────────────────────────────

ALTER TABLE commercial_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_tickets' AND policyname = 'ct_read_all') THEN
    CREATE POLICY ct_read_all ON commercial_tickets FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_tickets' AND policyname = 'ct_insert_auth') THEN
    CREATE POLICY ct_insert_auth ON commercial_tickets FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_tickets' AND policyname = 'ct_update_auth') THEN
    CREATE POLICY ct_update_auth ON commercial_tickets FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- NO DELETE POLICY. Soft-delete only via: UPDATE SET active = false.


-- ────────────────────────────────────────────────────────────────
-- 6. Audit trail table
--    ON DELETE RESTRICT: audit survives ticket deactivation.
--    If someone tries to hard-delete a ticket, Postgres blocks it.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_ticket_audit (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id                 uuid NOT NULL REFERENCES commercial_tickets(id) ON DELETE RESTRICT,
  action                    text NOT NULL CHECK (action IN (
    'created', 'updated', 'stage_changed', 'lineage_verified',
    'lineage_rejected', 'quarantined', 'promoted', 'deactivated'
  )),
  field_changed             text,
  old_value                 text,
  new_value                 text,
  user_name                 text,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cta_ticket    ON commercial_ticket_audit(ticket_id);
CREATE INDEX IF NOT EXISTS idx_cta_action    ON commercial_ticket_audit(action);
CREATE INDEX IF NOT EXISTS idx_cta_created   ON commercial_ticket_audit(created_at DESC);

ALTER TABLE commercial_ticket_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_ticket_audit' AND policyname = 'cta_read_all') THEN
    CREATE POLICY cta_read_all ON commercial_ticket_audit FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_ticket_audit' AND policyname = 'cta_insert_auth') THEN
    CREATE POLICY cta_insert_auth ON commercial_ticket_audit FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- NO UPDATE or DELETE on audit trail. Audit records are immutable.


-- ════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after migration to confirm)
-- ════════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'commercial_tickets'
-- ORDER BY ordinal_position;
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'commercial_tickets'::regclass;
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('commercial_tickets', 'commercial_ticket_audit');
