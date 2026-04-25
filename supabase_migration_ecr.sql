-- ==============================================================================
-- STRATEGIC ECR SUITE — DATA LAYER MIGRATION
-- This script replaces the transient React memory models with a persistent,
-- transactional audit architecture.
-- ==============================================================================

DROP TABLE IF EXISTS ecr_audit_trail CASCADE;
DROP TABLE IF EXISTS ecr_scores CASCADE;
DROP TABLE IF EXISTS ecr_input_values CASCADE;
DROP TABLE IF EXISTS ecr_input_snapshots CASCADE;
DROP TABLE IF EXISTS ecr_rule_weights CASCADE;
DROP TABLE IF EXISTS ecr_rule_sets CASCADE;
DROP TABLE IF EXISTS ecr_metrics CASCADE;

-- 1. ecr_metrics
CREATE TABLE IF NOT EXISTS ecr_metrics (
    id TEXT PRIMARY KEY,
    metric_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL CHECK (unit IN ('%', 'days', 'number', 'band')),
    min_value NUMERIC NOT NULL,
    max_value NUMERIC NOT NULL,
    default_weight NUMERIC NOT NULL,
    default_source_mode TEXT NOT NULL CHECK (default_source_mode IN ('manual', 'spreadsheet', 'connector')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ecr_rule_sets
CREATE TABLE IF NOT EXISTS ecr_rule_sets (
    id TEXT PRIMARY KEY,
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived', 'locked')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ecr_rule_weights
CREATE TABLE IF NOT EXISTS ecr_rule_weights (
    id TEXT PRIMARY KEY,
    rule_set_id TEXT REFERENCES ecr_rule_sets(id) ON DELETE CASCADE,
    metric_id TEXT REFERENCES ecr_metrics(id) ON DELETE CASCADE,
    weight NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ecr_input_snapshots
CREATE TABLE IF NOT EXISTS ecr_input_snapshots (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ecr_input_values
CREATE TABLE IF NOT EXISTS ecr_input_values (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT REFERENCES ecr_input_snapshots(id) ON DELETE CASCADE,
    metric_id TEXT REFERENCES ecr_metrics(id) ON DELETE CASCADE,
    value NUMERIC NOT NULL,
    source_mode TEXT NOT NULL CHECK (source_mode IN ('manual', 'spreadsheet', 'connector')),
    source_reference TEXT,
    captured_by TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ecr_scores
CREATE TABLE IF NOT EXISTS ecr_scores (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    snapshot_id TEXT REFERENCES ecr_input_snapshots(id) ON DELETE CASCADE,
    rule_set_id TEXT REFERENCES ecr_rule_sets(id) ON DELETE CASCADE,
    total_score NUMERIC NOT NULL,
    grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    confidence_score INTEGER NOT NULL,
    breakdown JSONB,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    computed_by_system BOOLEAN DEFAULT TRUE
);

-- 7. ecr_audit_trail
CREATE TABLE IF NOT EXISTS ecr_audit_trail (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    previous_grade TEXT,
    new_grade TEXT NOT NULL,
    reason TEXT,
    "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
--  INITIAL DATA PROVISIONING
-- ==============================================================================

-- Metrics (from mockMetrics)
INSERT INTO ecr_metrics (id, metric_key, display_name, description, unit, min_value, max_value, default_weight, default_source_mode, active) VALUES
('met-1', 'gp_percent', 'Gross Profit %', 'Average gross profit percentage across all active deals with this customer', '%', 0, 100, 25, 'manual', true),
('met-2', 'revenue_growth', 'Revenue Growth YoY', 'Year-over-year revenue growth rate with this customer', '%', -100, 500, 15, 'spreadsheet', true),
('met-3', 'dso_days', 'Days Sales Outstanding', 'Average number of days to collect payment from this customer', 'days', 0, 365, 15, 'manual', true),
('met-4', 'contract_tenure', 'Contract Tenure', 'Number of years as an active customer', 'number', 0, 50, 10, 'manual', true),
('met-5', 'sla_compliance', 'SLA Compliance Rate', 'Percentage of SLA targets met by Hala for this customer', '%', 0, 100, 10, 'spreadsheet', true),
('met-6', 'volume_utilization', 'Volume Utilization', 'Percentage of contracted capacity actually utilized by the customer', '%', 0, 100, 10, 'connector', true),
('met-7', 'dispute_rate', 'Dispute Rate', 'Percentage of invoices disputed by the customer', '%', 0, 100, 10, 'manual', true),
('met-8', 'strategic_value', 'Strategic Value Band', 'Qualitative assessment of strategic importance (1=Low, 5=Critical)', 'band', 1, 5, 5, 'manual', true)
ON CONFLICT (id) DO NOTHING;

-- Active Rule Set (rs-4)
INSERT INTO ecr_rule_sets (id, version_number, name, description, status, created_by) VALUES
('rs-4', 4, 'ECR Value-Ops-Fin Structure (40/30/30)', 'Formalized 40% Commercial Value, 30% Operational Complexity, 30% Financial Behavior structure.', 'active', 'Amin Al-Rashid')
ON CONFLICT (id) DO NOTHING;

-- Rule Weights for rs-4
INSERT INTO ecr_rule_weights (id, rule_set_id, metric_id, weight) VALUES
('rw-24', 'rs-4', 'met-2', 25),
('rw-25', 'rs-4', 'met-4', 10),
('rw-26', 'rs-4', 'met-8', 5),
('rw-27', 'rs-4', 'met-5', 10),
('rw-28', 'rs-4', 'met-6', 10),
('rw-29', 'rs-4', 'met-7', 10),
('rw-30', 'rs-4', 'met-1', 15),
('rw-31', 'rs-4', 'met-3', 15)
ON CONFLICT (id) DO NOTHING;

-- Input Snapshots (SABIC and Almarai)
INSERT INTO ecr_input_snapshots (id, customer_id, period_start, period_end, created_by) VALUES
('snap-1', 'cust-sabic', '2025-01-01', '2025-03-31', 'Amin Al-Rashid'),
('snap-5', 'cust-almarai', '2025-01-01', '2025-03-31', 'Amin Al-Rashid')
ON CONFLICT (id) DO NOTHING;

-- Input Values for SABIC (snap-1)
INSERT INTO ecr_input_values (id, snapshot_id, metric_id, value, source_mode, source_reference, captured_by) VALUES
('iv-1', 'snap-1', 'met-1', 28.5, 'manual', 'Q1 Finance Review', 'Amin Al-Rashid'),
('iv-2', 'snap-1', 'met-2', 12.3, 'spreadsheet', 'sabic-revenue-2025.xlsx', 'Amin Al-Rashid'),
('iv-3', 'snap-1', 'met-3', 32, 'manual', 'Finance team report', 'Amin Al-Rashid'),
('iv-4', 'snap-1', 'met-4', 8, 'manual', 'CRM record', 'Amin Al-Rashid'),
('iv-5', 'snap-1', 'met-5', 96.2, 'spreadsheet', 'sla-compliance-q1.xlsx', 'Amin Al-Rashid'),
('iv-6', 'snap-1', 'met-6', 87.5, 'manual', 'Ops dashboard', 'Amin Al-Rashid'),
('iv-7', 'snap-1', 'met-7', 2.1, 'manual', 'Finance team report', 'Amin Al-Rashid'),
('iv-8', 'snap-1', 'met-8', 5, 'manual', 'Strategic review', 'Amin Al-Rashid')
ON CONFLICT (id) DO NOTHING;

-- Input Values for Almarai (snap-5)
INSERT INTO ecr_input_values (id, snapshot_id, metric_id, value, source_mode, source_reference, captured_by) VALUES
('iv-33', 'snap-5', 'met-1', 31.2, 'manual', 'Q1 Finance Review', 'Amin Al-Rashid'),
('iv-34', 'snap-5', 'met-2', 18.7, 'spreadsheet', 'almarai-revenue-2025.xlsx', 'Amin Al-Rashid'),
('iv-35', 'snap-5', 'met-3', 25, 'manual', 'Finance team report', 'Amin Al-Rashid'),
('iv-36', 'snap-5', 'met-4', 12, 'manual', 'CRM record', 'Amin Al-Rashid'),
('iv-37', 'snap-5', 'met-5', 98.5, 'spreadsheet', 'sla-compliance-q1.xlsx', 'Amin Al-Rashid'),
('iv-38', 'snap-5', 'met-6', 92.0, 'manual', 'Ops dashboard', 'Amin Al-Rashid'),
('iv-39', 'snap-5', 'met-7', 1.0, 'manual', 'Finance team report', 'Amin Al-Rashid'),
('iv-40', 'snap-5', 'met-8', 5, 'manual', 'Strategic review', 'Amin Al-Rashid')
ON CONFLICT (id) DO NOTHING;

-- Scores corresponding to the new formula outputs:
-- computed manually or pre-aggregated for smooth initialization
INSERT INTO ecr_scores (id, customer_id, snapshot_id, rule_set_id, total_score, grade, confidence_score, breakdown, computed_by_system) VALUES
('score-snap-1', 'cust-sabic', 'snap-1', 'rs-4', 71.3, 'B', 100, '[{"metricKey":"revenue_growth","unit":"%","value":12.3,"weight":25,"displayName":"Revenue Growth YoY","weightedScore":4.55},{"metricKey":"contract_tenure","unit":"number","value":8,"weight":10,"displayName":"Contract Tenure","weightedScore":1.6},{"metricKey":"strategic_value","unit":"band","value":5,"weight":5,"displayName":"Strategic Value Band","weightedScore":5},{"metricKey":"sla_compliance","unit":"%","value":96.2,"weight":10,"displayName":"SLA Compliance Rate","weightedScore":9.62},{"metricKey":"volume_utilization","unit":"%","value":87.5,"weight":10,"displayName":"Volume Utilization","weightedScore":8.75},{"metricKey":"dispute_rate","unit":"%","value":2.1,"weight":10,"displayName":"Dispute Rate","weightedScore":9.79},{"metricKey":"gp_percent","unit":"%","value":28.5,"weight":15,"displayName":"Gross Profit %","weightedScore":4.28},{"metricKey":"dso_days","unit":"days","value":32,"weight":15,"displayName":"Days Sales Outstanding","weightedScore":13.68}]'::jsonb, true),
('score-snap-5', 'cust-almarai', 'snap-5', 'rs-4', 81.3, 'A', 100, '[{"metricKey":"revenue_growth","unit":"%","value":18.7,"weight":25,"displayName":"Revenue Growth YoY","weightedScore":6.5},{"metricKey":"contract_tenure","unit":"number","value":12,"weight":10,"displayName":"Contract Tenure","weightedScore":2.4},{"metricKey":"strategic_value","unit":"band","value":5,"weight":5,"displayName":"Strategic Value Band","weightedScore":5},{"metricKey":"sla_compliance","unit":"%","value":98.5,"weight":10,"displayName":"SLA Compliance Rate","weightedScore":9.85},{"metricKey":"volume_utilization","unit":"%","value":92,"weight":10,"displayName":"Volume Utilization","weightedScore":9.2},{"metricKey":"dispute_rate","unit":"%","value":1,"weight":10,"displayName":"Dispute Rate","weightedScore":9.9},{"metricKey":"gp_percent","unit":"%","value":31.2,"weight":15,"displayName":"Gross Profit %","weightedScore":4.68},{"metricKey":"dso_days","unit":"days","value":25,"weight":15,"displayName":"Days Sales Outstanding","weightedScore":13.97}]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Audit Trail
INSERT INTO ecr_audit_trail (id, customer_id, previous_grade, new_grade, reason) VALUES
('at-1', 'cust-sabic', 'C', 'B', 'DSO improvement over Q1 transition'),
('at-2', 'cust-almarai', 'B', 'A', 'Transition to 40/30/30 algorithm improved ops rating')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE ecr_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecr_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecr_rule_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecr_input_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecr_input_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecr_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecr_audit_trail ENABLE ROW LEVEL SECURITY;

-- Authenticated access for all ECR tables
CREATE POLICY IF NOT EXISTS "ecr_metrics_select" ON ecr_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_metrics_insert" ON ecr_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "ecr_metrics_update" ON ecr_metrics FOR UPDATE TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "ecr_rule_sets_select" ON ecr_rule_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_rule_sets_insert" ON ecr_rule_sets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "ecr_rule_sets_update" ON ecr_rule_sets FOR UPDATE TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "ecr_rule_weights_select" ON ecr_rule_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_rule_weights_insert" ON ecr_rule_weights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "ecr_rule_weights_update" ON ecr_rule_weights FOR UPDATE TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "ecr_input_snapshots_select" ON ecr_input_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_input_snapshots_insert" ON ecr_input_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "ecr_input_values_select" ON ecr_input_values FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_input_values_insert" ON ecr_input_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "ecr_input_values_update" ON ecr_input_values FOR UPDATE TO authenticated USING (true);

-- Immutable: no UPDATE/DELETE
CREATE POLICY IF NOT EXISTS "ecr_scores_select" ON ecr_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_scores_insert" ON ecr_scores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "ecr_audit_trail_select" ON ecr_audit_trail FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ecr_audit_trail_insert" ON ecr_audit_trail FOR INSERT TO authenticated WITH CHECK (true);
