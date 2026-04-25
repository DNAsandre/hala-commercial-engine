-- ============================================================
-- Sprint 3: Quote Data Model — Expand quotes table
-- ============================================================
-- Run in Supabase SQL Editor (Hala Commercial engine)
--
-- The existing quotes table has minimal columns.
-- This migration adds the full Sprint 3 schema.
-- ============================================================

-- Add new columns to existing quotes table
-- (safe: IF NOT EXISTS pattern via DO blocks)

DO $$
BEGIN
  -- Quote number & versioning
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='quote_number') THEN
    ALTER TABLE quotes ADD COLUMN quote_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='version_number') THEN
    ALTER TABLE quotes ADD COLUMN version_number INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='status') THEN
    ALTER TABLE quotes ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;

  -- Customer link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='customer_id') THEN
    ALTER TABLE quotes ADD COLUMN customer_id TEXT;
  END IF;

  -- Service info
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='service_type') THEN
    ALTER TABLE quotes ADD COLUMN service_type TEXT DEFAULT 'warehousing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='currency') THEN
    ALTER TABLE quotes ADD COLUMN currency TEXT DEFAULT 'SAR';
  END IF;

  -- Cost
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='estimated_cost') THEN
    ALTER TABLE quotes ADD COLUMN estimated_cost NUMERIC DEFAULT 0;
  END IF;

  -- Validity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='validity_days') THEN
    ALTER TABLE quotes ADD COLUMN validity_days INTEGER DEFAULT 30;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='valid_until') THEN
    ALTER TABLE quotes ADD COLUMN valid_until TEXT;
  END IF;

  -- Assumptions & Exclusions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='assumptions') THEN
    ALTER TABLE quotes ADD COLUMN assumptions TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='exclusions') THEN
    ALTER TABLE quotes ADD COLUMN exclusions TEXT DEFAULT '';
  END IF;

  -- Actor tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='created_by') THEN
    ALTER TABLE quotes ADD COLUMN created_by TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='updated_by') THEN
    ALTER TABLE quotes ADD COLUMN updated_by TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='updated_at') THEN
    ALTER TABLE quotes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;

  -- Version linking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='supersedes_quote_id') THEN
    ALTER TABLE quotes ADD COLUMN supersedes_quote_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='change_reason') THEN
    ALTER TABLE quotes ADD COLUMN change_reason TEXT;
  END IF;

  -- Volume assumptions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='volume_unit') THEN
    ALTER TABLE quotes ADD COLUMN volume_unit TEXT DEFAULT 'pallets';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='monthly_volume') THEN
    ALTER TABLE quotes ADD COLUMN monthly_volume NUMERIC DEFAULT 0;
  END IF;

  -- Notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='notes') THEN
    ALTER TABLE quotes ADD COLUMN notes TEXT DEFAULT '';
  END IF;

  -- Discount
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='discount_percent') THEN
    ALTER TABLE quotes ADD COLUMN discount_percent NUMERIC DEFAULT 0;
  END IF;
END $$;

-- Migrate existing data: copy 'version' → 'version_number', 'state' → 'status', 'total_cost' → 'estimated_cost'
UPDATE quotes SET version_number = version WHERE version_number IS NULL AND version IS NOT NULL;
UPDATE quotes SET status = state WHERE status IS NULL AND state IS NOT NULL;
UPDATE quotes SET estimated_cost = total_cost WHERE estimated_cost IS NULL AND total_cost IS NOT NULL;

-- Backfill quote_number for existing rows
UPDATE quotes SET quote_number = 'Q-' || UPPER(SUBSTRING(workspace_id, 1, 4)) || '-V' || COALESCE(version_number, 1)
WHERE quote_number IS NULL;

-- ============================================================
-- RLS for quotes (already enabled in Sprint 2, but ensure policies)
-- ============================================================
DROP POLICY IF EXISTS "quotes_select_auth" ON quotes;
CREATE POLICY "quotes_select_auth" ON quotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "quotes_insert_auth" ON quotes;
CREATE POLICY "quotes_insert_auth" ON quotes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "quotes_update_auth" ON quotes;
CREATE POLICY "quotes_update_auth" ON quotes FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "quotes_service" ON quotes;
CREATE POLICY "quotes_service" ON quotes FOR ALL TO service_role USING (true);
