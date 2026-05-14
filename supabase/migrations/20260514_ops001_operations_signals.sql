-- ============================================================
-- OPS-001: Operations Signal Inbox
-- Read-only operations signals for commercial visibility.
-- No workflow enforcement. No CRM. No gates.
-- ============================================================

-- 1) Create operations_signals table
CREATE TABLE IF NOT EXISTS operations_signals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_code   TEXT NOT NULL,
  signal_type   TEXT NOT NULL CHECK (signal_type IN (
    'capacity_risk', 'shortfall', 'high_utilization',
    'complaint', 'sla_risk', 'promise_gap',
    'warehouse_issue', 'finance_signal'
  )),
  source_area       TEXT,
  source_table      TEXT,
  source_record_id  TEXT,
  customer_id       TEXT,
  customer_name     TEXT,
  warehouse_id      TEXT,
  warehouse_label   TEXT,
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'resolved', 'ignored')),
  title             TEXT NOT NULL,
  description       TEXT,
  commercial_impact TEXT,
  recommended_action TEXT,
  source_type       TEXT DEFAULT 'formula_native',
  truth_status      TEXT DEFAULT 'verified_snapshot',
  confidence_tier   INTEGER DEFAULT 2,
  source_lineage    TEXT,
  created_from_rule BOOLEAN DEFAULT true,
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_ops_signals_type     ON operations_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_ops_signals_severity ON operations_signals(severity);
CREATE INDEX IF NOT EXISTS idx_ops_signals_status   ON operations_signals(status);
CREATE INDEX IF NOT EXISTS idx_ops_signals_active   ON operations_signals(active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_signals_code_unique ON operations_signals(signal_code);

-- 3) RLS — match Commercial OS dev pattern
ALTER TABLE operations_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'operations_signals' AND policyname = 'operations_signals_read_all'
  ) THEN
    CREATE POLICY operations_signals_read_all ON operations_signals FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- TASK 2: Seed rule-generated signals from existing data
-- These are derived from real warehouse/GP data only.
-- No invented complaints. No fake SLA events.
-- ============================================================

-- Signal 1: Overcommitted warehouses (committed > sellable)
INSERT INTO operations_signals (signal_code, signal_type, source_area, source_table, warehouse_id, warehouse_label, severity, title, description, commercial_impact, recommended_action, source_type, truth_status, source_lineage, created_from_rule)
SELECT
  'OPS-CAP-OVERCOMMIT-' || wl.report_label,
  'capacity_risk',
  'warehouse_capacity',
  'warehouse_capacity_snapshots',
  wcs.warehouse_location_id,
  wl.report_label,
  'critical',
  'Overcommitted: ' || wl.report_label,
  'Committed capacity (' || wcs.committed_capacity || ') exceeds sellable capacity (' || wcs.sellable_capacity || '). Shortfall of ' || wcs.shortfall_capacity || ' pallets.',
  'Subcontracting risk — warehouse cannot fulfill committed volumes. New deals targeting this warehouse will fail SLA.',
  'Freeze new commitments to ' || wl.report_label || '. Review subcontracting options. Notify affected customers.',
  'verified_snapshot',
  'verified_snapshot',
  'warehouse_capacity_snapshots → committed > sellable',
  true
FROM warehouse_capacity_snapshots wcs
JOIN warehouse_locations wl ON wl.id = wcs.warehouse_location_id
WHERE wcs.committed_capacity > wcs.sellable_capacity
  AND wcs.sellable_capacity > 0
ON CONFLICT (signal_code) DO NOTHING;

-- Signal 2: Warehouse shortfall > 0
INSERT INTO operations_signals (signal_code, signal_type, source_area, source_table, warehouse_id, warehouse_label, severity, title, description, commercial_impact, recommended_action, source_type, truth_status, source_lineage, created_from_rule)
SELECT
  'OPS-CAP-SHORTFALL-' || wl.report_label,
  'shortfall',
  'warehouse_capacity',
  'warehouse_capacity_snapshots',
  wcs.warehouse_location_id,
  wl.report_label,
  'high',
  'Shortfall detected: ' || wl.report_label,
  'Shortfall of ' || wcs.shortfall_capacity || ' pallets detected at ' || wl.report_label || '. Utilization at ' || ROUND(wcs.utilization_pct::numeric, 1) || '%.',
  'Capacity constraint — new commitments risk breaking SLA. Pipeline deals targeting this warehouse are at promise risk.',
  'Review capacity allocation. Consider rebalancing across warehouses. Do not promise additional volume without operations confirmation.',
  'verified_snapshot',
  'verified_snapshot',
  'warehouse_capacity_snapshots → shortfall_capacity > 0',
  true
FROM warehouse_capacity_snapshots wcs
JOIN warehouse_locations wl ON wl.id = wcs.warehouse_location_id
WHERE wcs.shortfall_capacity > 0
  AND NOT (wcs.committed_capacity > wcs.sellable_capacity AND wcs.sellable_capacity > 0)
ON CONFLICT (signal_code) DO NOTHING;

-- Signal 3: High utilization (>= 90%)
INSERT INTO operations_signals (signal_code, signal_type, source_area, source_table, warehouse_id, warehouse_label, severity, title, description, commercial_impact, recommended_action, source_type, truth_status, source_lineage, created_from_rule)
SELECT
  'OPS-CAP-HIGHUTIL-' || wl.report_label,
  'high_utilization',
  'warehouse_capacity',
  'warehouse_capacity_snapshots',
  wcs.warehouse_location_id,
  wl.report_label,
  'medium',
  'High utilization: ' || wl.report_label || ' (' || ROUND(wcs.utilization_pct::numeric, 1) || '%)',
  wl.report_label || ' is at ' || ROUND(wcs.utilization_pct::numeric, 1) || '% utilization. Limited headroom for new deals.',
  'Limited headroom — new deals require warehouse review before commitment. Risk of SLA breach if capacity further reduced.',
  'Conduct warehouse capacity review before committing new deals. Monitor weekly utilization trend.',
  'verified_snapshot',
  'verified_snapshot',
  'warehouse_capacity_snapshots → utilization_pct >= 90',
  true
FROM warehouse_capacity_snapshots wcs
JOIN warehouse_locations wl ON wl.id = wcs.warehouse_location_id
WHERE wcs.utilization_pct >= 90
  AND wcs.shortfall_capacity = 0
  AND NOT (wcs.committed_capacity > wcs.sellable_capacity AND wcs.sellable_capacity > 0)
ON CONFLICT (signal_code) DO NOTHING;

-- Signal 4: GP assumption risk (all pipeline using dangerous default)
INSERT INTO operations_signals (signal_code, signal_type, source_area, source_table, severity, title, description, commercial_impact, recommended_action, source_type, truth_status, source_lineage, created_from_rule)
VALUES (
  'OPS-FIN-GP-ASSUMED',
  'finance_signal',
  'gp_intelligence',
  'commercial_opportunity_gp_basis',
  'high',
  'GP assumption risk: 100% pipeline using 25% default',
  'All pipeline deals use the 25% GP / 75% cost assumption. No actual cost data has been verified by Finance.',
  'Entire pipeline GP projection (5.6M+ SAR) is assumed, not verified. Leadership cannot rely on these GP figures for budgeting decisions.',
  'Request Finance to provide actual cost data per deal. Do not treat assumed GP as verified profit in board reporting.',
  'assumption',
  'assumption',
  'commercial_opportunity_gp_basis → all gp_basis = assumed_margin',
  true
)
ON CONFLICT (signal_code) DO NOTHING;

-- Signal 5: Revenue gap risk (if gap metric is negative)
INSERT INTO operations_signals (signal_code, signal_type, source_area, source_table, severity, title, description, commercial_impact, recommended_action, source_type, truth_status, source_lineage, created_from_rule)
SELECT
  'OPS-FIN-REVGAP',
  'finance_signal',
  'dashboard_metrics',
  'commercial_dashboard_snapshots',
  CASE WHEN metric_value < -1000000 THEN 'critical' ELSE 'high' END,
  'Revenue gap: ' || ROUND(metric_value::numeric, 0) || ' SAR',
  'FY26 revenue gap is ' || ROUND(metric_value::numeric, 0) || ' SAR. Forecast is below budget target.',
  'Revenue shortfall risk — pipeline conversion must accelerate or additional revenue sources identified.',
  'Review pipeline conversion rates. Assess capacity monetization potential. Escalate to leadership if gap persists.',
  'formula_native',
  'formula_native',
  'commercial_dashboard_snapshots → metric_key ILIKE revenue_gap',
  true
FROM commercial_dashboard_snapshots
WHERE metric_key ILIKE '%revenue_gap%'
  AND metric_value < 0
LIMIT 1
ON CONFLICT (signal_code) DO NOTHING;
