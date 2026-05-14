-- ============================================================
-- GP-002: GP Engine V2 — Per-Deal GP Basis Table
-- Sprint: GP-002
-- Author: Claude / Antigravity
-- Date: 2026-05-14
--
-- ADDITIVE ONLY. No destructive changes. No CRM. No gates.
-- Creates commercial_opportunity_gp_basis for per-deal GP
-- confidence tracking. Does NOT invent actual costs.
-- ============================================================

-- ─── TASK 1: Create GP basis detail table ─────────────────────

CREATE TABLE IF NOT EXISTS commercial_opportunity_gp_basis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT REFERENCES commercial_opportunities(id),
  customer_name TEXT,
  gp_basis TEXT NOT NULL DEFAULT 'assumed_margin'
    CHECK (gp_basis IN ('actual_cost', 'assumed_margin', 'imported_gp_snapshot', 'unknown', 'no_revenue')),
  revenue_basis NUMERIC DEFAULT 0,
  cost_amount NUMERIC,
  gp_amount NUMERIC,
  gp_margin_pct NUMERIC,
  cost_ratio_pct NUMERIC,
  confidence_status TEXT NOT NULL DEFAULT 'needs_finance_review'
    CHECK (confidence_status IN ('verified', 'assumed', 'imported_snapshot', 'needs_finance_review', 'unavailable')),
  source_type TEXT DEFAULT 'excel_import',
  truth_status TEXT DEFAULT 'imported',
  confidence_tier INTEGER DEFAULT 4
    CHECK (confidence_tier BETWEEN 1 AND 5),
  source_lineage TEXT,
  governance_owner TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by opportunity
CREATE INDEX IF NOT EXISTS idx_gp_basis_opp_id
  ON commercial_opportunity_gp_basis(opportunity_id);

-- ─── TASK 2: Safe Classification Seed ─────────────────────────
-- Populate from existing commercial_opportunities.
-- Does NOT invent actual costs.
-- All deals get assumed_margin until Finance provides cost data.

INSERT INTO commercial_opportunity_gp_basis (
  opportunity_id,
  customer_name,
  gp_basis,
  revenue_basis,
  cost_amount,
  gp_amount,
  gp_margin_pct,
  cost_ratio_pct,
  confidence_status,
  confidence_tier,
  source_lineage,
  notes
)
SELECT
  co.id,
  co.customer_name,
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN 'no_revenue'
    ELSE 'assumed_margin'
  END,
  COALESCE(co.acv_annual, 0),
  NULL, -- cost_amount: NULL = no actual cost available
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN 0
    ELSE ROUND(co.acv_annual * 0.25, 2) -- 25% GP assumption
  END,
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN 0
    ELSE 25
  END,
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN NULL
    ELSE 75
  END,
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN 'unavailable'
    ELSE 'needs_finance_review'
  END,
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN 5
    ELSE 4
  END,
  'Seeded from commercial_opportunities GP-002',
  CASE
    WHEN co.acv_annual IS NULL OR co.acv_annual = 0 THEN 'No revenue — GP not applicable'
    ELSE 'Assumed 25% GP / 75% cost ratio — needs Finance actual cost validation'
  END
FROM commercial_opportunities co
WHERE NOT EXISTS (
  SELECT 1 FROM commercial_opportunity_gp_basis g WHERE g.opportunity_id = co.id
);

-- ─── RLS ──────────────────────────────────────────────────────

ALTER TABLE commercial_opportunity_gp_basis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on commercial_opportunity_gp_basis"
  ON commercial_opportunity_gp_basis
  FOR SELECT
  TO authenticated
  USING (true);
