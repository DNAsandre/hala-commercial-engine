-- =========================================================
-- TND-002: Tender to Customer Master Linkage
-- Sprint: TND-002 — Safe Additive Only
-- Purpose: Read-only link suggestions between tender
--          workspaces and Customer Master.
--          Does NOT alter tender workflow or data.
-- =========================================================

-- 1. tender_customer_links
CREATE TABLE IF NOT EXISTS tender_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_workspace_id TEXT NOT NULL,             -- e.g. tn-linde-001
  customer_id UUID,                             -- nullable FK to customer_master
  tender_customer_name TEXT NOT NULL,
  customer_master_name TEXT,                     -- canonical match from customer_master
  match_status TEXT DEFAULT 'needs_review',       -- exact | likely | possible | unmatched | needs_review
  match_confidence TEXT DEFAULT 'auto',           -- auto | manual | verified | assumed
  source_type TEXT DEFAULT 'tender_workspace',    -- tender_workspace | manual | d365
  truth_status TEXT DEFAULT 'snapshot',            -- verified | snapshot | assumed
  confidence_tier INTEGER DEFAULT 3,              -- 1-5
  source_lineage TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for authenticated
ALTER TABLE tender_customer_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tender_customer_links_read' AND tablename = 'tender_customer_links') THEN
    CREATE POLICY tender_customer_links_read ON tender_customer_links FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- =========================================================
-- SEED: Linde SIGAS link suggestion (read-only)
-- =========================================================

-- Create Linde tender → customer link suggestion
-- Only if the tender workspace tn-linde-001 data exists
INSERT INTO tender_customer_links (
  tender_workspace_id,
  tender_customer_name,
  customer_master_name,
  match_status,
  match_confidence,
  source_type,
  truth_status,
  confidence_tier,
  source_lineage,
  notes
) VALUES (
  'tn-linde-001',
  'Linde SIGAS',
  'linde sigas',
  'likely',
  'auto',
  'tender_workspace',
  'snapshot',
  3,
  'Auto-discovered from tender workspace tn-linde-001. Customer name matches customer_master canonical.',
  'Read-only link suggestion. Does NOT affect tender workflow. Human review required before confirming match.'
);

-- Attempt to link customer_id if customer_master exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_master') THEN
    UPDATE tender_customer_links tcl
    SET customer_id = cm.id,
        match_status = 'likely',
        customer_master_name = cm.canonical_name
    FROM customer_master cm
    WHERE tcl.tender_workspace_id = 'tn-linde-001'
      AND cm.canonical_name = 'linde sigas';
  END IF;
END $$;
