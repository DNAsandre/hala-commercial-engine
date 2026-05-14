-- ============================================================
-- ESC-001: Commercial Escalation Workspace
-- Read-only escalation layer for leadership visibility.
-- No workflow enforcement. No CRM. No gates. No writes from UI.
-- ============================================================

-- 1) Table
CREATE TABLE IF NOT EXISTS commercial_escalations (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escalation_code     text NOT NULL,
  source_signal_id    uuid,
  escalation_type     text NOT NULL DEFAULT 'operational',
  title               text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  severity            text NOT NULL DEFAULT 'medium',
  status              text NOT NULL DEFAULT 'open',
  customer_id         text,
  customer_name       text,
  warehouse_id        text,
  warehouse_label     text,
  tender_workspace_id text,
  owner_role          text NOT NULL DEFAULT 'leadership',
  governance_owner    text NOT NULL DEFAULT 'Commercial Director',
  commercial_impact   text NOT NULL DEFAULT '',
  financial_exposure  numeric,
  recommended_action  text NOT NULL DEFAULT '',
  source_type         text NOT NULL DEFAULT 'system_generated',
  truth_status        text NOT NULL DEFAULT 'observation',
  confidence_tier     integer NOT NULL DEFAULT 2,
  source_lineage      text NOT NULL DEFAULT '',
  created_from_rule   boolean NOT NULL DEFAULT true,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_esc_type       ON commercial_escalations(escalation_type);
CREATE INDEX IF NOT EXISTS idx_esc_severity   ON commercial_escalations(severity);
CREATE INDEX IF NOT EXISTS idx_esc_status     ON commercial_escalations(status);
CREATE INDEX IF NOT EXISTS idx_esc_active     ON commercial_escalations(active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_esc_code_unique ON commercial_escalations(escalation_code);

-- 3) RLS — match Commercial OS dev pattern
ALTER TABLE commercial_escalations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'commercial_escalations' AND policyname = 'commercial_escalations_read_all'
  ) THEN
    CREATE POLICY commercial_escalations_read_all ON commercial_escalations FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- TASK 2: Seed escalations from critical signals + capacity/GP data
-- Only real data. No invented complaints. No fake escalations.
-- ============================================================

-- Escalation 1: Critical overcommitted warehouses → capacity escalation
INSERT INTO commercial_escalations (
  escalation_code, source_signal_id, escalation_type,
  title, description, severity, status,
  warehouse_id, warehouse_label,
  owner_role, governance_owner,
  commercial_impact, financial_exposure,
  recommended_action, source_type, truth_status,
  confidence_tier, source_lineage, created_from_rule
)
SELECT
  'ESC-CAP-OVERCOMMIT-' || wl.report_label,
  os.id,
  'capacity',
  'Escalation: Overcommitted capacity at ' || wl.report_label,
  'Warehouse ' || wl.report_label || ' committed capacity (' || wcs.committed_capacity || ') exceeds sellable (' || wcs.sellable_capacity || '). Shortfall of ' || wcs.shortfall_capacity || ' pallets. Subcontracting risk is active.',
  'critical',
  'open',
  wcs.warehouse_location_id::text,
  wl.report_label,
  'Operations + Commercial Leadership',
  'COO / Commercial Director',
  'Subcontracting risk — warehouse cannot fulfill committed volumes. New deals will fail SLA. Customer escalation likely.',
  (wcs.shortfall_capacity * 48)::numeric,
  'Freeze new commitments to ' || wl.report_label || '. Review subcontracting options. Notify affected customers immediately.',
  'verified_snapshot',
  'verified_snapshot',
  1,
  'warehouse_capacity_snapshots → committed > sellable → operations_signals → escalation',
  true
FROM warehouse_capacity_snapshots wcs
JOIN warehouse_locations wl ON wl.id = wcs.warehouse_location_id
LEFT JOIN operations_signals os ON os.signal_code = 'OPS-CAP-OVERCOMMIT-' || wl.report_label
WHERE wcs.committed_capacity > wcs.sellable_capacity
  AND wcs.sellable_capacity > 0
ON CONFLICT (escalation_code) DO NOTHING;

-- Escalation 2: GP assumption risk → finance escalation
INSERT INTO commercial_escalations (
  escalation_code, source_signal_id, escalation_type,
  title, description, severity, status,
  owner_role, governance_owner,
  commercial_impact, financial_exposure,
  recommended_action, source_type, truth_status,
  confidence_tier, source_lineage, created_from_rule
)
SELECT
  'ESC-FIN-GP-ASSUMED',
  os.id,
  'gp',
  'Escalation: 100% pipeline using assumed GP (25% default)',
  'All ' || COUNT(*)::text || ' pipeline deals use the 25% GP assumption. No actual cost data verified by Finance. Projected GP of ' || ROUND(SUM(o.acv_annual * 0.25)::numeric, 0) || ' SAR is entirely assumed.',
  'high',
  'open',
  'Finance + Commercial Leadership',
  'CFO / Commercial Director',
  'Entire pipeline GP projection is assumed. Leadership cannot rely on GP figures for budgeting. Board reporting at risk.',
  ROUND(SUM(o.acv_annual * 0.25)::numeric, 0),
  'Request Finance to provide actual cost data per deal. Do not present assumed GP as verified profit in board or investor materials.',
  'assumption',
  'assumption',
  3,
  'commercial_opportunities → gp_basis = assumed → operations_signals → escalation',
  true
FROM commercial_opportunities o
LEFT JOIN operations_signals os ON os.signal_code = 'OPS-FIN-GP-ASSUMED'
GROUP BY os.id
HAVING COUNT(*) > 0
ON CONFLICT (escalation_code) DO NOTHING;

-- Escalation 3: Revenue gap risk → finance escalation
INSERT INTO commercial_escalations (
  escalation_code, source_signal_id, escalation_type,
  title, description, severity, status,
  owner_role, governance_owner,
  commercial_impact, financial_exposure,
  recommended_action, source_type, truth_status,
  confidence_tier, source_lineage, created_from_rule
)
SELECT
  'ESC-FIN-REVGAP',
  os.id,
  'finance',
  'Escalation: FY26 revenue gap of ' || ROUND(metric_value::numeric, 0) || ' SAR',
  'Revenue forecast is ' || ROUND(ABS(metric_value)::numeric, 0) || ' SAR below budget target. Gap requires pipeline acceleration or new revenue sources.',
  CASE WHEN metric_value < -5000000 THEN 'critical' ELSE 'high' END,
  'open',
  'Sales + Commercial Leadership',
  'Commercial Director / CEO',
  'Revenue shortfall threatens FY26 budget targets. Pipeline conversion must accelerate. Capacity monetization should be explored.',
  ABS(metric_value)::numeric,
  'Review pipeline conversion rates. Assess capacity monetization potential. Consider commercial acceleration strategy. Escalate to CEO if gap exceeds 10M SAR.',
  'formula_native',
  'formula_native',
  2,
  'commercial_dashboard_snapshots → revenue_gap metric → operations_signals → escalation',
  true
FROM commercial_dashboard_snapshots cds
LEFT JOIN operations_signals os ON os.signal_code = 'OPS-FIN-REVGAP'
WHERE cds.metric_key ILIKE '%revenue_gap%'
  AND cds.metric_value < 0
LIMIT 1
ON CONFLICT (escalation_code) DO NOTHING;

-- Escalation 4: Severe shortfall warehouses → operational escalation
INSERT INTO commercial_escalations (
  escalation_code, source_signal_id, escalation_type,
  title, description, severity, status,
  warehouse_id, warehouse_label,
  owner_role, governance_owner,
  commercial_impact, financial_exposure,
  recommended_action, source_type, truth_status,
  confidence_tier, source_lineage, created_from_rule
)
SELECT
  'ESC-OPS-SHORTFALL-' || wl.report_label,
  os.id,
  'operational',
  'Escalation: Capacity shortfall at ' || wl.report_label || ' (' || wcs.shortfall_capacity || ' pallets)',
  'Warehouse ' || wl.report_label || ' has a shortfall of ' || wcs.shortfall_capacity || ' pallets. Utilization at ' || ROUND(wcs.utilization_pct::numeric, 1) || '%. New deal commitments risk SLA violations.',
  'high',
  'open',
  wcs.warehouse_location_id::text,
  wl.report_label,
  'Operations Leadership',
  'COO',
  'Capacity constraint — new commitments risk breaking SLA. Customer churn risk if unresolved.',
  (wcs.shortfall_capacity * 48)::numeric,
  'Review capacity allocation at ' || wl.report_label || '. Do not promise additional volume without operations confirmation.',
  'verified_snapshot',
  'verified_snapshot',
  1,
  'warehouse_capacity_snapshots → shortfall > 0 → operations_signals → escalation',
  true
FROM warehouse_capacity_snapshots wcs
JOIN warehouse_locations wl ON wl.id = wcs.warehouse_location_id
LEFT JOIN operations_signals os ON os.signal_code = 'OPS-CAP-SHORTFALL-' || wl.report_label
WHERE wcs.shortfall_capacity > 0
  AND NOT (wcs.committed_capacity > wcs.sellable_capacity AND wcs.sellable_capacity > 0)
ON CONFLICT (escalation_code) DO NOTHING;
