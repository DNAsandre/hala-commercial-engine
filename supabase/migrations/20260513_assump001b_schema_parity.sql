-- ============================================================
-- ASSUMP-001B: Schema Parity Patch
-- Sprint: ASSUMP-001
-- Author: Claude / Antigravity
-- Date: 2026-05-13
--
-- ADDITIVE ONLY. Adds missing columns to stage_probabilities
-- and dashboard_thresholds, plus 2 missing threshold seeds.
-- ============================================================

-- ─── Patch stage_probabilities ───────────────────────────────

ALTER TABLE stage_probabilities
  ADD COLUMN IF NOT EXISTS confidence_tier INTEGER NOT NULL DEFAULT 3;

ALTER TABLE stage_probabilities
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE stage_probabilities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── Patch dashboard_thresholds ──────────────────────────────

ALTER TABLE dashboard_thresholds
  ADD COLUMN IF NOT EXISTS truth_status TEXT NOT NULL DEFAULT 'governance_input';

ALTER TABLE dashboard_thresholds
  ADD COLUMN IF NOT EXISTS confidence_tier INTEGER NOT NULL DEFAULT 4;

ALTER TABLE dashboard_thresholds
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE dashboard_thresholds
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── Seed 2 missing dashboard thresholds ─────────────────────

INSERT INTO dashboard_thresholds
  (id, threshold_key, threshold_label, threshold_value, unit, category, source_type, truth_status, confidence_tier, governance_owner, notes)
VALUES
  ('dt-formula-warn',
   'formula_warning_pct', 'Formula Warning Threshold', 1, '%', 'formula',
   'assumption', 'assumption', 4, 'Finance + Sales',
   'Variance above 1% between imported and calculated values triggers a WARNING status in Strategic Truth.'),

  ('dt-formula-drift',
   'formula_drift_pct', 'Formula Drift Threshold', 5, '%', 'formula',
   'assumption', 'assumption', 4, 'Finance',
   'Variance above 5% is classified as formula drift requiring investigation.')
ON CONFLICT (threshold_key) DO NOTHING;
