-- =========================================================
-- TPT-001: Transportation Pipeline Foundation
-- Sprint: TPT-001 — Safe Additive Only
-- Purpose: Normalized transportation pipeline shell,
--          separate from warehouse pipeline.
--          Links to Customer Master when available.
-- =========================================================

-- 1. transportation_opportunities
CREATE TABLE IF NOT EXISTS transportation_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,                             -- nullable FK to customer_master
  customer_name TEXT NOT NULL,
  opportunity_name TEXT,
  pipeline_type TEXT DEFAULT 'transportation',   -- transportation | tender | logistics
  owner TEXT,
  stage TEXT DEFAULT 'Identified',
  probability_pct NUMERIC DEFAULT 0,
  lane_summary TEXT,                             -- e.g. "Riyadh → Jeddah"
  service_type TEXT,                             -- FTL | LTL | intermodal | dedicated | project_cargo
  origin TEXT,
  destination TEXT,
  expected_start_date DATE,
  expected_revenue NUMERIC DEFAULT 0,
  expected_gp NUMERIC DEFAULT 0,
  volume_trips NUMERIC DEFAULT 0,
  volume_tons NUMERIC DEFAULT 0,
  volume_units NUMERIC DEFAULT 0,
  source_type TEXT DEFAULT 'manual',             -- tender_snapshot | d365 | tms | finance | manual
  truth_status TEXT DEFAULT 'unverified',        -- verified_snapshot | unverified | assumed
  confidence_tier INTEGER DEFAULT 4,             -- 1-5 (same as KPI registry)
  source_lineage TEXT,
  import_batch_id TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. transportation_opportunity_metrics
CREATE TABLE IF NOT EXISTS transportation_opportunity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportation_opportunity_id UUID NOT NULL REFERENCES transportation_opportunities(id),
  metric_key TEXT NOT NULL,
  metric_label TEXT,
  metric_value NUMERIC DEFAULT 0,
  metric_unit TEXT,                              -- SAR | trips | tons | km | %
  metric_period TEXT,                            -- monthly | quarterly | annual
  source_type TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. transportation_customer_links
CREATE TABLE IF NOT EXISTS transportation_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportation_opportunity_id UUID NOT NULL REFERENCES transportation_opportunities(id),
  customer_id UUID,                             -- nullable FK to customer_master
  source_customer_name TEXT NOT NULL,
  match_status TEXT DEFAULT 'pending',           -- matched | pending | needs_review | unmatched
  match_confidence TEXT DEFAULT 'auto',          -- auto | manual | verified | assumed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for authenticated (same as Commercial OS pattern)
ALTER TABLE transportation_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_opportunity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_customer_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tpt_opportunities_read' AND tablename = 'transportation_opportunities') THEN
    CREATE POLICY tpt_opportunities_read ON transportation_opportunities FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tpt_metrics_read' AND tablename = 'transportation_opportunity_metrics') THEN
    CREATE POLICY tpt_metrics_read ON transportation_opportunity_metrics FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tpt_customer_links_read' AND tablename = 'transportation_customer_links') THEN
    CREATE POLICY tpt_customer_links_read ON transportation_customer_links FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- =========================================================
-- SEED: Single Linde SIGAS reference (read-only snapshot)
-- Derived from existing tender workspace, not CRM.
-- =========================================================

INSERT INTO transportation_opportunities (
  customer_name,
  opportunity_name,
  pipeline_type,
  owner,
  stage,
  probability_pct,
  lane_summary,
  service_type,
  expected_revenue,
  expected_gp,
  source_type,
  truth_status,
  confidence_tier,
  source_lineage,
  notes
) VALUES (
  'Linde SIGAS',
  'Linde SIGAS Transportation Tender',
  'tender',
  'Amin Al-Halabi',
  'Preparing Submission',
  30,
  'KSA Industrial Gas Distribution Network',
  'dedicated',
  55600000,
  11676000,
  'tender_snapshot',
  'verified_snapshot',
  3,
  'Derived from tender workspace tn-linde-001. Not CRM. Read-only reference.',
  'SAR 55.6M tender — Preparing Submission. GP at 21% from tender workspace margin calculation. This is a read-only snapshot; the tender workspace is the source of truth.'
);

-- Link Linde to customer master if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_master') THEN
    INSERT INTO transportation_customer_links (
      transportation_opportunity_id,
      source_customer_name,
      match_status,
      match_confidence,
      notes
    )
    SELECT
      t.id,
      'Linde SIGAS',
      'needs_review',
      'auto',
      'Auto-linked from tender workspace. DO NOT auto-merge with warehouse Linde records.'
    FROM transportation_opportunities t
    WHERE t.customer_name = 'Linde SIGAS'
    LIMIT 1;
  END IF;
END $$;
