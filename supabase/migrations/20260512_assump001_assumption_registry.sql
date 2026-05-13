-- ============================================================
-- ASSUMP-001: Assumption Registry
-- Sprint: ASSUMP-001
-- Author: Claude / Antigravity
-- Date: 2026-05-12
--
-- ADDITIVE ONLY. No destructive changes. No CRM. No gates.
-- Creates 3 tables + seeds all assumption/probability/threshold rows.
-- ============================================================

-- ─── Table 1: default_assumptions ────────────────────────────

CREATE TABLE IF NOT EXISTS default_assumptions (
  id                TEXT PRIMARY KEY,
  assumption_key    TEXT NOT NULL UNIQUE,
  assumption_label  TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'commercial',
  value_numeric     NUMERIC,
  value_text        TEXT,
  unit              TEXT NOT NULL DEFAULT '',
  source_type       TEXT NOT NULL DEFAULT 'assumption',
  truth_status      TEXT NOT NULL DEFAULT 'assumption',
  confidence_tier   INTEGER NOT NULL DEFAULT 4,
  governance_owner  TEXT NOT NULL DEFAULT 'Unassigned',
  source_lineage    TEXT,
  risk_level        TEXT NOT NULL DEFAULT 'high',
  notes             TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table 2: stage_probabilities ────────────────────────────

CREATE TABLE IF NOT EXISTS stage_probabilities (
  id                TEXT PRIMARY KEY,
  stage_name        TEXT NOT NULL UNIQUE,
  probability_pct   NUMERIC NOT NULL DEFAULT 0,
  source_type       TEXT NOT NULL DEFAULT 'assumption',
  truth_status      TEXT NOT NULL DEFAULT 'assumption',
  governance_owner  TEXT NOT NULL DEFAULT 'Sales Leadership',
  source_lineage    TEXT,
  notes             TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── Table 3: dashboard_thresholds ───────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_thresholds (
  id                TEXT PRIMARY KEY,
  threshold_key     TEXT NOT NULL UNIQUE,
  threshold_label   TEXT NOT NULL,
  threshold_value   NUMERIC NOT NULL DEFAULT 0,
  unit              TEXT NOT NULL DEFAULT '%',
  category          TEXT NOT NULL DEFAULT 'dashboard',
  source_type       TEXT NOT NULL DEFAULT 'assumption',
  governance_owner  TEXT NOT NULL DEFAULT 'Unassigned',
  notes             TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── RLS Policies ────────────────────────────────────────────

ALTER TABLE default_assumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_assumptions" ON default_assumptions;
DROP POLICY IF EXISTS "auth_write_assumptions" ON default_assumptions;
DROP POLICY IF EXISTS "service_assumptions" ON default_assumptions;
CREATE POLICY "auth_read_assumptions"
  ON default_assumptions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_assumptions"
  ON default_assumptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_assumptions"
  ON default_assumptions FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE stage_probabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_stage_prob" ON stage_probabilities;
DROP POLICY IF EXISTS "auth_write_stage_prob" ON stage_probabilities;
DROP POLICY IF EXISTS "service_stage_prob" ON stage_probabilities;
CREATE POLICY "auth_read_stage_prob"
  ON stage_probabilities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_stage_prob"
  ON stage_probabilities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_stage_prob"
  ON stage_probabilities FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE dashboard_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_thresholds" ON dashboard_thresholds;
DROP POLICY IF EXISTS "auth_write_thresholds" ON dashboard_thresholds;
DROP POLICY IF EXISTS "service_thresholds" ON dashboard_thresholds;
CREATE POLICY "auth_read_thresholds"
  ON dashboard_thresholds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_thresholds"
  ON dashboard_thresholds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_thresholds"
  ON dashboard_thresholds FOR ALL USING (auth.role() = 'service_role');

-- ─── SEED: Default Assumptions ───────────────────────────────

INSERT INTO default_assumptions
  (id, assumption_key, assumption_label, category, value_numeric, value_text, unit, source_type, truth_status, confidence_tier, governance_owner, source_lineage, risk_level, notes)
VALUES
  ('da-gp-margin',
   'default_gp_margin_pct', 'Default GP Margin %', 'financial',
   25, NULL, '%',
   'dangerous_default', 'assumption', 5,
   'Finance',
   'Executive Dashboard → hardcoded 25% → NOT sourced from per-deal cost data',
   'critical',
   'DANGEROUS DEFAULT: Applied globally to all deals. Real GP varies 15-40% per deal. Must be replaced with per-deal GP engine (DATA-004).'),

  ('da-cost-ratio',
   'default_cost_ratio_pct', 'Default Cost Ratio %', 'financial',
   75, NULL, '%',
   'dangerous_default', 'assumption', 5,
   'Finance',
   'Inverse of GP margin → 1 - 0.25 = 0.75 → applied globally',
   'critical',
   'DANGEROUS DEFAULT: 75% cost ratio is the inverse of the 25% GP margin assumption. Per-deal cost ratios range 60-85%.'),

  ('da-pallet-rate',
   'pallet_rate_monthly_sar', 'Pallet Rate (Monthly SAR)', 'pricing',
   48, NULL, 'SAR/pallet/month',
   'assumption', 'assumption', 4,
   'Sales (Hano Oberholzer)',
   'Executive Dashboard → flat rate assumption → not per-customer or per-warehouse',
   'high',
   'Flat rate used for unsold capacity valuation. Actual rates vary SAR 30-66 per pallet depending on warehouse and customer.'),

  ('da-phasing-method',
   'monthly_phasing_method', 'Monthly Phasing Method', 'formula',
   NULL, 'go_live_equal_monthly', 'method',
   'assumption', 'assumption', 4,
   'Finance + Sales',
   'Pipeline Data Input → ACV/12 from go-live month → equal monthly distribution',
   'medium',
   'All deals use equal monthly phasing from go-live. No seasonal adjustment, no ramp-up curve. Acceptable for FY26 but may need refinement.'),

  ('da-mat-threshold',
   'materializing_probability_threshold', 'Materializing Probability Threshold', 'formula',
   75, NULL, '%',
   'assumption', 'governance_input', 3,
   'Sales Leadership',
   'Executive Dashboard → SUMIFS probability >= 75% → governance-defined threshold',
   'low',
   'Defines which deals count as "materializing". Set by Sales Leadership. Could be changed to 80% or 70% without formula changes.'),

  ('da-util-risk',
   'warehouse_utilization_risk_threshold', 'Utilization Risk Threshold', 'capacity',
   90, NULL, '%',
   'assumption', 'governance_input', 3,
   'Operations (COO)',
   'Executive Dashboard → hardcoded 90% → operations risk flag threshold',
   'medium',
   'Warehouses above 90% utilization are flagged as high-risk. Threshold is governance-defined, not formula-derived.'),

  ('da-shortfall-warn',
   'shortfall_warning_threshold', 'Shortfall Warning Threshold', 'capacity',
   1, NULL, 'pallets',
   'assumption', 'governance_input', 3,
   'Operations (COO)',
   'Dashboard → any shortfall > 0 triggers warning → minimum threshold',
   'low',
   'Any warehouse with shortfall > 0 pallets gets a warning badge. Binary threshold.')
ON CONFLICT (assumption_key) DO NOTHING;

-- ─── SEED: Stage Probabilities ───────────────────────────────

INSERT INTO stage_probabilities
  (id, stage_name, probability_pct, source_type, truth_status, governance_owner, source_lineage, notes)
VALUES
  ('sp-prospecting',     'Prospecting',           20, 'assumption', 'governance_input', 'Sales Leadership',
   'Pipeline Report → stage column → mapped to 20% by Sales Leadership',
   'Lowest conversion tier. Early-stage deals with no proposal sent.'),

  ('sp-qualified',       'Qualified',             40, 'assumption', 'governance_input', 'Sales Leadership',
   'Pipeline Report → stage column → mapped to 40% by Sales Leadership',
   'Customer need confirmed. Budget not yet allocated.'),

  ('sp-proposal-sent',   'Proposal Sent',         60, 'assumption', 'governance_input', 'Sales Leadership',
   'Pipeline Report → stage column → mapped to 60% by Sales Leadership',
   'Formal proposal delivered. Awaiting customer review/shortlisting.'),

  ('sp-shortlisted',     'Shortlisted',           75, 'assumption', 'governance_input', 'Sales Leadership',
   'Pipeline Report → stage column → mapped to 75% by Sales Leadership',
   'Customer shortlisted Hala. High likelihood of close within 2-3 months.'),

  ('sp-contract-neg',    'Contract Negotiation',  90, 'assumption', 'governance_input', 'Sales Leadership',
   'Pipeline Report → stage column → mapped to 90% by Sales Leadership',
   'Active contract negotiation. Near-certain close expected within 30 days.'),

  ('sp-closed-won',      'Closed Won',           100, 'verified_snapshot', 'verified_snapshot', 'Sales (Hano Oberholzer)',
   'Closed Won Data Input → 100% probability → contract signed',
   'Deal is closed and signed. Revenue is confirmed.'),

  ('sp-closed-lost',     'Closed Lost',            0, 'verified_snapshot', 'verified_snapshot', 'Sales (Hano Oberholzer)',
   'Pipeline Report → stage = Closed Lost → 0%',
   'Deal is lost. Removed from pipeline calculations.')
ON CONFLICT (stage_name) DO NOTHING;

-- ─── SEED: Dashboard Thresholds ──────────────────────────────

INSERT INTO dashboard_thresholds
  (id, threshold_key, threshold_label, threshold_value, unit, category, source_type, governance_owner, notes)
VALUES
  ('dt-high-util',
   'high_utilization_pct', 'High Utilization Threshold', 90, '%', 'capacity',
   'governance_input', 'Operations (COO)',
   'Warehouses above this % get red "Utilization > 90%" badge on capacity page.'),

  ('dt-warn-util',
   'warning_utilization_pct', 'Warning Utilization Threshold', 75, '%', 'capacity',
   'governance_input', 'Operations (COO)',
   'Warehouses above this % could get amber warning. Not yet implemented in UI.'),

  ('dt-mat-pct',
   'materializing_pct', 'Materializing Probability Threshold', 75, '%', 'pipeline',
   'governance_input', 'Sales Leadership',
   'Deals with probability >= this threshold are counted as materializing.'),

  ('dt-wtd-rounding',
   'weighted_pipeline_rounding_pct', 'Weighted Pipeline Rounding Tolerance', 0.5, '%', 'formula',
   'governance_input', 'Finance + Sales',
   'Variance up to 0.5% between imported and calculated weighted pipeline is classified as acceptable rounding.')
ON CONFLICT (threshold_key) DO NOTHING;
