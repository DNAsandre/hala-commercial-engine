-- ════════════════════════════════════════════════════════════════
-- INTAKE-001: Unified Commercial Ticket Intake + Lineage Columns
-- Date: 2026-05-20
-- Author: Antigravity / Hala Commercial Engine
--
-- Purpose:
--   Extends commercial_v2_tickets to serve as the Unified Intake
--   table for Proposal, Tender, Renewal, and SLA ticket types.
--   Adds full source/lineage metadata for data provenance tracking.
--
-- Doctrine:
--   - Null = unknown / not captured yet
--   - 0 = explicitly confirmed zero
--   - No fake defaults. No invented values.
--   - Quarantine is for real records with incomplete proof.
--
-- SAFE: All ADD COLUMN IF NOT EXISTS. Re-runnable.
-- DO NOT AUTO-EXECUTE. Human must run manually in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. Extend ticket_type CHECK to include 'renewal' and 'sla'
--    Current: CHECK (ticket_type IN ('proposal', 'tender'))
--    Target:  CHECK (ticket_type IN ('proposal', 'tender', 'renewal', 'sla'))
-- ────────────────────────────────────────────────────────────────

ALTER TABLE commercial_v2_tickets
  DROP CONSTRAINT IF EXISTS commercial_v2_tickets_ticket_type_check;

ALTER TABLE commercial_v2_tickets
  ADD CONSTRAINT commercial_v2_tickets_ticket_type_check
  CHECK (ticket_type IN ('proposal', 'tender', 'renewal', 'sla'));


-- ────────────────────────────────────────────────────────────────
-- 2. Common intake fields
--    These serve all ticket types (proposal, tender, renewal, SLA)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE commercial_v2_tickets
  -- Ticket identity
  ADD COLUMN IF NOT EXISTS ticket_title         text,
  ADD COLUMN IF NOT EXISTS owner                text,
  ADD COLUMN IF NOT EXISTS team_members          text[] DEFAULT '{}',

  -- CRM / pipeline placement
  ADD COLUMN IF NOT EXISTS crm_pipeline_stage    text,
  ADD COLUMN IF NOT EXISTS internal_stage        text,

  -- Commercial values — NULLABLE: null = unknown, 0 = confirmed zero
  ADD COLUMN IF NOT EXISTS estimated_value       numeric,
  ADD COLUMN IF NOT EXISTS target_gp_percent     numeric,
  ADD COLUMN IF NOT EXISTS probability_percent   numeric,

  -- Timeline
  ADD COLUMN IF NOT EXISTS target_date           text,

  -- Customer link (soft FK to customers.id — no hard constraint)
  ADD COLUMN IF NOT EXISTS customer_id           text,

  -- Type-specific child fields stored as JSONB
  -- Avoids schema sprawl: each ticket type stores its own details here
  ADD COLUMN IF NOT EXISTS type_details          jsonb DEFAULT '{}'::jsonb;


-- ────────────────────────────────────────────────────────────────
-- 3. Source / Lineage metadata
--    Every ticket must be traceable to a source.
--    Records without verified lineage are quarantined.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE commercial_v2_tickets
  -- Source identification
  ADD COLUMN IF NOT EXISTS source_type           text,
    -- Values: 'crm_opportunity', 'approved_excel', 'uploaded_document',
    --         'manual_verified', 'customer_request', 'renewal_trigger',
    --         'contract_trigger'
  ADD COLUMN IF NOT EXISTS source_reference      text,
  ADD COLUMN IF NOT EXISTS source_file           text,
  ADD COLUMN IF NOT EXISTS source_sheet          text,
  ADD COLUMN IF NOT EXISTS source_row_id         text,
  ADD COLUMN IF NOT EXISTS source_document_id    text,

  -- Lineage verification status
  ADD COLUMN IF NOT EXISTS lineage_status        text DEFAULT 'unverified',
    -- Values: 'unverified', 'needs_review', 'verified', 'rejected'
  ADD COLUMN IF NOT EXISTS lineage_notes         text,

  -- Verification audit
  ADD COLUMN IF NOT EXISTS verified_by           text,
  ADD COLUMN IF NOT EXISTS verified_at           timestamptz,

  -- Intake origin flag
  ADD COLUMN IF NOT EXISTS created_from_intake   boolean DEFAULT true,

  -- Quarantine reason (if lineage_status = 'rejected' or 'needs_review')
  ADD COLUMN IF NOT EXISTS quarantined_reason    text;


-- ────────────────────────────────────────────────────────────────
-- 4. Extend routing_decision CHECK for renewal/sla
-- ────────────────────────────────────────────────────────────────

ALTER TABLE commercial_v2_tickets
  DROP CONSTRAINT IF EXISTS commercial_v2_tickets_routing_decision_check;

ALTER TABLE commercial_v2_tickets
  ADD CONSTRAINT commercial_v2_tickets_routing_decision_check
  CHECK (routing_decision IN ('proposal', 'tender', 'renewal', 'sla', 'lost'));


-- ────────────────────────────────────────────────────────────────
-- 5. Indexes for new columns
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_v2t_lineage_status
  ON commercial_v2_tickets(lineage_status);

CREATE INDEX IF NOT EXISTS idx_v2t_crm_stage
  ON commercial_v2_tickets(crm_pipeline_stage);

CREATE INDEX IF NOT EXISTS idx_v2t_customer_id
  ON commercial_v2_tickets(customer_id);

CREATE INDEX IF NOT EXISTS idx_v2t_source_type
  ON commercial_v2_tickets(source_type);

CREATE INDEX IF NOT EXISTS idx_v2t_created_intake
  ON commercial_v2_tickets(created_from_intake);


-- ────────────────────────────────────────────────────────────────
-- 6. RLS: INSERT / UPDATE / DELETE policies for commercial_v2_tickets
--    Existing policy: v2_tickets_read_all (SELECT USING true)
--    Missing: write policies
-- ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_v2_tickets'
      AND policyname = 'v2_tickets_insert_all'
  ) THEN
    CREATE POLICY v2_tickets_insert_all
      ON commercial_v2_tickets
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_v2_tickets'
      AND policyname = 'v2_tickets_update_all'
  ) THEN
    CREATE POLICY v2_tickets_update_all
      ON commercial_v2_tickets
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_v2_tickets'
      AND policyname = 'v2_tickets_delete_all'
  ) THEN
    CREATE POLICY v2_tickets_delete_all
      ON commercial_v2_tickets
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- Also ensure activity table has INSERT policy for audit logging
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_v2_activity'
      AND policyname = 'v2_activity_insert_all'
  ) THEN
    CREATE POLICY v2_activity_insert_all
      ON commercial_v2_activity
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run after migration to confirm)
-- ════════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'commercial_v2_tickets'
-- ORDER BY ordinal_position;
