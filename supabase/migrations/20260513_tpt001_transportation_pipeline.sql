-- =========================================================
-- TPT-001: Transportation Pipeline Foundation
-- Safe additive schema only.
--
-- Doctrine:
--   - No seeded transportation opportunities.
--   - Null = unknown / not captured yet.
--   - 0 = explicitly confirmed zero.
--   - Transportation records must be imported from verified source systems
--     or created through the unified commercial intake flow.
-- =========================================================

CREATE TABLE IF NOT EXISTS transportation_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  customer_name TEXT,
  opportunity_name TEXT,
  pipeline_type TEXT,
  owner TEXT,
  stage TEXT,
  probability_pct NUMERIC,
  lane_summary TEXT,
  service_type TEXT,
  origin TEXT,
  destination TEXT,
  expected_start_date DATE,
  expected_revenue NUMERIC,
  expected_gp NUMERIC,
  volume_trips NUMERIC,
  volume_tons NUMERIC,
  volume_units NUMERIC,
  source_type TEXT,
  truth_status TEXT,
  confidence_tier INTEGER,
  source_lineage TEXT,
  import_batch_id TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transportation_opportunity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportation_opportunity_id UUID NOT NULL REFERENCES transportation_opportunities(id),
  metric_key TEXT NOT NULL,
  metric_label TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  metric_period TEXT,
  source_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transportation_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportation_opportunity_id UUID NOT NULL REFERENCES transportation_opportunities(id),
  customer_id UUID,
  source_customer_name TEXT,
  match_status TEXT,
  match_confidence TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transportation_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_opportunity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_customer_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'tpt_opportunities_read'
      AND tablename = 'transportation_opportunities'
  ) THEN
    CREATE POLICY tpt_opportunities_read
      ON transportation_opportunities
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'tpt_metrics_read'
      AND tablename = 'transportation_opportunity_metrics'
  ) THEN
    CREATE POLICY tpt_metrics_read
      ON transportation_opportunity_metrics
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'tpt_customer_links_read'
      AND tablename = 'transportation_customer_links'
  ) THEN
    CREATE POLICY tpt_customer_links_read
      ON transportation_customer_links
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
