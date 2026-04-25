-- ============================================================
-- Sprint 3b: Corrective migration — add pricing columns
--            missing from sprint3_quotes_schema.sql
-- ============================================================
-- Run AFTER sprint3_quotes_schema.sql if not already applied.
-- All columns use IF NOT EXISTS — safe to re-run.
-- ============================================================

DO $$
BEGIN
  -- Pricing rates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='storage_rate') THEN
    ALTER TABLE quotes ADD COLUMN storage_rate NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='inbound_rate') THEN
    ALTER TABLE quotes ADD COLUMN inbound_rate NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='outbound_rate') THEN
    ALTER TABLE quotes ADD COLUMN outbound_rate NUMERIC DEFAULT 0;
  END IF;

  -- Volume
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='pallet_volume') THEN
    ALTER TABLE quotes ADD COLUMN pallet_volume NUMERIC DEFAULT 0;
  END IF;

  -- Revenue & GP
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='monthly_revenue') THEN
    ALTER TABLE quotes ADD COLUMN monthly_revenue NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='annual_revenue') THEN
    ALTER TABLE quotes ADD COLUMN annual_revenue NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='gp_amount') THEN
    ALTER TABLE quotes ADD COLUMN gp_amount NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='gp_percent') THEN
    ALTER TABLE quotes ADD COLUMN gp_percent NUMERIC DEFAULT 0;
  END IF;

  -- Legacy columns the server keeps in sync
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='total_cost') THEN
    ALTER TABLE quotes ADD COLUMN total_cost NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='state') THEN
    ALTER TABLE quotes ADD COLUMN state TEXT DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='version') THEN
    ALTER TABLE quotes ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- Backfill gp_percent / gp_amount for any rows that have revenue data but no GP
UPDATE quotes
SET
  gp_amount     = COALESCE(annual_revenue, 0) - COALESCE(estimated_cost, 0),
  gp_percent    = CASE
                    WHEN COALESCE(annual_revenue, 0) > 0
                    THEN ROUND(((COALESCE(annual_revenue, 0) - COALESCE(estimated_cost, 0)) / COALESCE(annual_revenue, 0)) * 100, 2)
                    ELSE 0
                  END
WHERE gp_percent = 0 AND COALESCE(annual_revenue, 0) > 0;

-- Sync total_cost ← estimated_cost for legacy rows
UPDATE quotes
SET total_cost = estimated_cost
WHERE total_cost = 0 AND estimated_cost > 0;

-- Sync state ← status for rows written by the new server (which writes both)
UPDATE quotes
SET state = status
WHERE state IS DISTINCT FROM status AND status IS NOT NULL;
