-- TND-002: Tender to Customer Master Linkage
-- Sprint: TND-002 - Safe Additive Only
-- Revised: 2026-05-21
--
-- Purpose:
--   Defines the read-only suggestion table used to relate tender workspaces
--   to customer master records.
--
-- Doctrine:
--   - Schema only.
--   - No Linde seed row.
--   - No auto-created customer/tender link suggestions.
--   - Link rows must originate from verified tender records, governed intake,
--     or human-approved SQL after lineage review.

CREATE TABLE IF NOT EXISTS tender_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_workspace_id TEXT NOT NULL,
  customer_id UUID,
  tender_customer_name TEXT NOT NULL,
  customer_master_name TEXT,
  match_status TEXT DEFAULT 'needs_review',
  match_confidence TEXT DEFAULT 'auto',
  source_type TEXT DEFAULT 'tender_workspace',
  truth_status TEXT DEFAULT 'snapshot',
  confidence_tier INTEGER DEFAULT 3,
  source_lineage TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tender_customer_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'tender_customer_links_read'
      AND tablename = 'tender_customer_links'
  ) THEN
    CREATE POLICY tender_customer_links_read
      ON tender_customer_links
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
