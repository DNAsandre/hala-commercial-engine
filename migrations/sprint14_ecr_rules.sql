-- Sprint 14: ECR Configuration Persistence
-- Replacing mock rule sets and weights with live database tables.

-- 1. ECR Rule Sets Table
CREATE TABLE IF NOT EXISTS ecr_rule_sets (
  id VARCHAR(255) PRIMARY KEY,
  version_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived', 'locked'
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  evolution_controls JSONB DEFAULT '{
    "evolution_enabled": false,
    "missing_metric_mode": "strict",
    "missing_metric_default_strategy": "neutral",
    "missing_metric_confidence_penalty_per_metric": 0.05,
    "min_confidence_to_display_grade": 0.5,
    "manual_upgrade_required": true
  }'::jsonb
);

-- 2. ECR Rule Weights Table
CREATE TABLE IF NOT EXISTS ecr_rule_weights (
  id VARCHAR(255) PRIMARY KEY,
  rule_set_id VARCHAR(255) REFERENCES ecr_rule_sets(id) ON DELETE CASCADE,
  metric_id VARCHAR(255) NOT NULL, -- references mockMetrics from ecr.ts in the code
  weight NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ecr_rule_weights_rule_set_id ON ecr_rule_weights(rule_set_id);

-- 3. Seed Data (Matches the mockRuleSets and mockRuleWeights from ecr.ts)
INSERT INTO ecr_rule_sets (id, version_number, name, description, status, created_by, created_at, evolution_controls)
VALUES
  (
    'rs-1', 1, 'ECR Standard v1', 
    'Initial ECR rule set — equal weight across core financial and operational metrics', 
    'archived', 'Amin Al-Rashid', '2025-01-15T00:00:00Z',
    '{"evolution_enabled": false, "missing_metric_mode": "strict", "missing_metric_default_strategy": "neutral", "missing_metric_confidence_penalty_per_metric": 0.05, "min_confidence_to_display_grade": 0.5, "manual_upgrade_required": true}'::jsonb
  ),
  (
    'rs-2', 2, 'ECR Standard v2', 
    'Revised weights — increased GP% and revenue growth emphasis, reduced tenure weight', 
    'archived', 'Amin Al-Rashid', '2025-02-20T00:00:00Z',
    '{"evolution_enabled": false, "missing_metric_mode": "strict", "missing_metric_default_strategy": "neutral", "missing_metric_confidence_penalty_per_metric": 0.05, "min_confidence_to_display_grade": 0.5, "manual_upgrade_required": true}'::jsonb
  ),
  (
    'rs-3', 3, 'ECR Enhanced v3 (Draft)', 
    'Experimental — adds credit risk score and rebalances strategic value', 
    'draft', 'Amin Al-Rashid', '2025-03-10T00:00:00Z',
    '{"evolution_enabled": false, "missing_metric_mode": "strict", "missing_metric_default_strategy": "neutral", "missing_metric_confidence_penalty_per_metric": 0.05, "min_confidence_to_display_grade": 0.5, "manual_upgrade_required": true}'::jsonb
  ),
  (
    'rs-4', 4, 'ECR Value-Ops-Fin Structure (40/30/30)', 
    'Formalized 40% Commercial Value, 30% Operational Complexity, 30% Financial Behavior structure.', 
    'active', 'Amin Al-Rashid', '2026-04-22T00:00:00Z',
    '{"evolution_enabled": true, "missing_metric_mode": "graceful_reweight", "missing_metric_default_strategy": "neutral", "missing_metric_confidence_penalty_per_metric": 0.05, "min_confidence_to_display_grade": 0.5, "manual_upgrade_required": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Weights
INSERT INTO ecr_rule_weights (id, rule_set_id, metric_id, weight, created_at)
VALUES
  -- rs-4
  ('rw-24', 'rs-4', 'met-2', 25, '2026-04-22T00:00:00Z'),
  ('rw-25', 'rs-4', 'met-4', 10, '2026-04-22T00:00:00Z'),
  ('rw-26', 'rs-4', 'met-8', 5, '2026-04-22T00:00:00Z'),
  ('rw-27', 'rs-4', 'met-5', 10, '2026-04-22T00:00:00Z'),
  ('rw-28', 'rs-4', 'met-6', 10, '2026-04-22T00:00:00Z'),
  ('rw-29', 'rs-4', 'met-7', 10, '2026-04-22T00:00:00Z'),
  ('rw-30', 'rs-4', 'met-1', 15, '2026-04-22T00:00:00Z'),
  ('rw-31', 'rs-4', 'met-3', 15, '2026-04-22T00:00:00Z'),
  -- rs-2
  ('rw-1', 'rs-2', 'met-1', 25, '2025-02-20T00:00:00Z'),
  ('rw-2', 'rs-2', 'met-2', 15, '2025-02-20T00:00:00Z'),
  ('rw-3', 'rs-2', 'met-3', 15, '2025-02-20T00:00:00Z'),
  ('rw-4', 'rs-2', 'met-4', 10, '2025-02-20T00:00:00Z'),
  ('rw-5', 'rs-2', 'met-5', 10, '2025-02-20T00:00:00Z'),
  ('rw-6', 'rs-2', 'met-6', 10, '2025-02-20T00:00:00Z'),
  ('rw-7', 'rs-2', 'met-7', 10, '2025-02-20T00:00:00Z'),
  ('rw-8', 'rs-2', 'met-8', 5, '2025-02-20T00:00:00Z'),
  -- rs-1
  ('rw-9', 'rs-1', 'met-1', 20, '2025-01-15T00:00:00Z'),
  ('rw-10', 'rs-1', 'met-2', 15, '2025-01-15T00:00:00Z'),
  ('rw-11', 'rs-1', 'met-3', 15, '2025-01-15T00:00:00Z'),
  ('rw-12', 'rs-1', 'met-4', 15, '2025-01-15T00:00:00Z'),
  ('rw-13', 'rs-1', 'met-5', 10, '2025-01-15T00:00:00Z'),
  ('rw-14', 'rs-1', 'met-6', 10, '2025-01-15T00:00:00Z'),
  ('rw-15', 'rs-1', 'met-7', 10, '2025-01-15T00:00:00Z'),
  ('rw-16', 'rs-1', 'met-8', 5, '2025-01-15T00:00:00Z'),
  -- rs-3
  ('rw-17', 'rs-3', 'met-1', 20, '2025-03-10T00:00:00Z'),
  ('rw-18', 'rs-3', 'met-2', 15, '2025-03-10T00:00:00Z'),
  ('rw-19', 'rs-3', 'met-3', 15, '2025-03-10T00:00:00Z'),
  ('rw-20', 'rs-3', 'met-4', 5, '2025-03-10T00:00:00Z'),
  ('rw-21', 'rs-3', 'met-5', 10, '2025-03-10T00:00:00Z'),
  ('rw-22', 'rs-3', 'met-6', 10, '2025-03-10T00:00:00Z'),
  ('rw-23', 'rs-3', 'met-7', 10, '2025-03-10T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
