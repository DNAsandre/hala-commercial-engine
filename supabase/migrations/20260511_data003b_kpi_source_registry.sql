-- ============================================================
-- DATA-003B: KPI + Source Truth Registry
-- Sprint: DATA-003B
-- Author: Agent 2
-- Date: 2026-05-11
-- 
-- ADDITIVE ONLY. No destructive changes. No CRM. No gates.
-- ============================================================

-- ─── Table 1: commercial_kpi_registry ────────────────────────

CREATE TABLE IF NOT EXISTS commercial_kpi_registry (
  id              TEXT PRIMARY KEY,
  kpi_key         TEXT NOT NULL UNIQUE,
  kpi_label       TEXT NOT NULL,
  classification  TEXT NOT NULL DEFAULT 'operational',
  source_type     TEXT NOT NULL DEFAULT 'excel_snapshot',
  formula_detail  TEXT,
  external_source_system TEXT,
  current_source  TEXT NOT NULL DEFAULT 'Excel import',
  governance_owner TEXT NOT NULL DEFAULT 'Unassigned',
  tolerance_type  TEXT NOT NULL DEFAULT 'percentage',
  tolerance_value NUMERIC NOT NULL DEFAULT 5.0,
  rounding_policy TEXT NOT NULL DEFAULT 'none',
  risk_level      TEXT NOT NULL DEFAULT 'medium',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table 2: commercial_source_registry ─────────────────────

CREATE TABLE IF NOT EXISTS commercial_source_registry (
  id                      TEXT PRIMARY KEY,
  source_key              TEXT NOT NULL UNIQUE,
  source_label            TEXT NOT NULL,
  source_type             TEXT NOT NULL,
  system_name             TEXT,
  future_api_candidate    BOOLEAN NOT NULL DEFAULT FALSE,
  current_ingestion_method TEXT NOT NULL DEFAULT 'manual',
  owner                   TEXT NOT NULL DEFAULT 'Unassigned',
  refresh_frequency       TEXT NOT NULL DEFAULT 'ad-hoc',
  trust_level             TEXT NOT NULL DEFAULT 'medium',
  notes                   TEXT,
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Seed: Source Registry (8 source types) ──────────────────

INSERT INTO commercial_source_registry (id, source_key, source_label, source_type, system_name, future_api_candidate, current_ingestion_method, owner, refresh_frequency, trust_level, notes)
VALUES
  ('src-formula-native', 'formula_native', 'App-Native Formula', 'calculated', 'Hala Commercial Engine', FALSE, 'live_computation', 'Engineering', 'real-time', 'high',
   'TypeScript formula engine. Recalculates from raw data on every page load. Source of truth for P1 KPIs.'),

  ('src-excel-snapshot', 'excel_snapshot', 'Excel Workbook Snapshot', 'imported', 'Excel / SharePoint', TRUE, 'manual_sql_import', 'Sales (Hano Oberholzer)', 'monthly', 'medium',
   'Imported via DATA-002B SQL migration. Values are point-in-time snapshots. May contain rounding from dashboard headers.'),

  ('src-d365', 'd365', 'Microsoft Dynamics 365', 'external_erp', 'D365 Finance & Operations', TRUE, 'not_connected', 'Finance', 'daily', 'high',
   'Future API candidate. Currently not integrated. Will provide GL actuals, P&L data, and budget targets.'),

  ('src-lfs', 'lfs', 'LFS Warehouse Management', 'external_wms', 'LFS WMS', TRUE, 'not_connected', 'Operations', 'daily', 'high',
   'Future API candidate. Will provide real-time warehouse utilization, pallet counts, and capacity data.'),

  ('src-finance-budget', 'finance_budget', 'Finance Budget Input', 'manual_finance', 'Excel / Finance Team', FALSE, 'manual_sql_import', 'Finance (CFO)', 'annual', 'high',
   'Annual budget targets set by Finance. Imported as part of Forecast sheet. Updated annually or at mid-year reforecast.'),

  ('src-manual-hanno', 'manual_hanno', 'Manual Sales Input (Hano)', 'manual_sales', 'Excel / Pipeline Tracker', FALSE, 'manual_sql_import', 'Sales (Hano Oberholzer)', 'weekly', 'medium',
   'Pipeline stages, probabilities, go-live dates, and ACV values manually maintained by Sales Director.'),

  ('src-assumption', 'assumption', 'Business Assumption', 'assumption', NULL, FALSE, 'hardcoded', 'Sales / Finance', 'review_quarterly', 'low',
   'Assumed values like stage-probability mappings. Should be periodically validated against actuals.'),

  ('src-dangerous-default', 'dangerous_default', 'Dangerous Default Value', 'dangerous_default', NULL, FALSE, 'hardcoded', 'UNOWNED — RISK', 'never', 'critical',
   'Global defaults like the 75% cost ratio. These mask per-deal variance and should be replaced with actual data ASAP.')
ON CONFLICT (source_key) DO NOTHING;

-- ─── Seed: KPI Registry (17 KPIs) ───────────────────────────

INSERT INTO commercial_kpi_registry (id, kpi_key, kpi_label, classification, source_type, formula_detail, external_source_system, current_source, governance_owner, tolerance_type, tolerance_value, rounding_policy, risk_level, notes)
VALUES
  -- P1 Strategic Truths (formula-native)
  ('kpi-weighted-pipeline', 'weighted_pipeline', 'Weighted Pipeline', 'strategic_truth_p1', 'formula_native',
   'SUM(grandTotal(ACV, goLive) × probability) for 35 pipeline + 11 closed won deals. grandTotal = ACV/12 × months(goLive→Dec-27).',
   NULL, 'Formula engine + commercial_opportunities + closed_won_deals', 'Sales (Hano Oberholzer)',
   'percentage', 1.0, 'none', 'medium',
   'ST-1. Exact Pipeline Report value = 43,332,714. Formula calc = 43,661,880. Δ 0.76% from per-deal ACV/12 rounding.'),

  ('kpi-materializing-75plus', 'materializing_75plus', 'Materializing 75%+', 'strategic_truth_p1', 'formula_native',
   'SUM(grandTotal × prob) WHERE probability ≥ 75%, including all Closed Won (100%). Same formula as ST-1 with stage filter.',
   NULL, 'Formula engine + commercial_opportunities + closed_won_deals', 'Sales (Hano Oberholzer)',
   'percentage', 5.0, 'none', 'medium',
   'ST-2. Imported = rounded dashboard "20M". Calculated = 20,547,150. Variance = rounded dashboard shorthand.'),

  ('kpi-fy26-revenue-gap', 'fy26_revenue_gap', 'FY26 Revenue Gap', 'strategic_truth_p1', 'formula_native',
   'SUM(delta_amount) from Revenue Total rows. delta_amount = GrandTotal[month] - Budget[month]. Workbook exact = -12,255,269.',
   'd365 (future)', 'Formula engine + forecast_monthly', 'Finance + Sales',
   'absolute', 500000, 'round_millions', 'high',
   'ST-5. Imported = rounded "(12M)". Calculated = -12,255,271. Uses seeded delta_amount per month.'),

  ('kpi-fy26-gp-gap', 'fy26_gp_gap', 'FY26 GP Gap', 'strategic_truth_p1', 'formula_native',
   'SUM(GP Total amounts) - SUM(GP Total budget_amounts). Workbook exact = -6,454,620.',
   'd365 (future)', 'Formula engine + forecast_monthly (GP rows)', 'Finance',
   'absolute', 500000, 'round_millions', 'high',
   'ST-6. Imported = rounded "(6M)". Calculated = -6,454,618. GP uses dangerous 75% cost default — needs per-deal cost input.'),

  ('kpi-forecast-total', 'forecast_total', 'Forecast Total', 'strategic_truth_p1', 'formula_native',
   'Baseline(84,189,259) + Pipeline(8,626,333) = 92,815,592. Baseline = P&L Actuals annual. Pipeline = Shortlisted + ContractNeg + ClosedWon.',
   'd365 (future)', 'Formula engine + forecast_monthly', 'Finance + Sales',
   'percentage', 0.5, 'round_millions', 'medium',
   'ST-7. MATCH. Imported = rounded "92.8M". Calculated = 92,815,593. Exact workbook parity achieved.'),

  ('kpi-monthly-phasing', 'monthly_phasing', 'Monthly Phasing Total (Weighted)', 'strategic_truth_p1', 'formula_native',
   'SUM(recalculatePhasing(opp)) for all 35 pipeline deals. ACV/12 × months_from_goLive_to_Dec27 × probability.',
   NULL, 'Formula engine + commercial_opportunities', 'Sales (Hano Oberholzer)',
   'percentage', 0.5, 'none', 'medium',
   'ST-8. MATCH. Validates phasing engine against grandTotal calculation. Δ ≤ 1 (integer rounding).'),

  -- P2 KPIs (excel snapshot / not yet formula-native)
  ('kpi-projected-gp-weighted', 'projected_gp_weighted', 'Projected GP Weighted', 'p2_snapshot', 'excel_snapshot',
   'Weighted Pipeline × (1 - cost_ratio). Currently uses dangerous 75% global cost default.',
   'd365 (future)', 'Dashboard snapshot import', 'Finance',
   'percentage', 5.0, 'round_millions', 'high',
   'Blocked by per-deal cost input. Uses dangerous_default 75% cost ratio. HIGH RISK.'),

  ('kpi-free-capacity-baseline', 'free_capacity_baseline', 'Free Capacity Baseline', 'p2_snapshot', 'excel_snapshot',
   'Total sellable capacity - committed capacity across all warehouses.',
   'lfs (future)', 'Dashboard snapshot import + warehouse_capacity_snapshots', 'Operations',
   'absolute', 5000, 'none', 'medium',
   'Will become formula_native when LFS integration provides real-time capacity data.'),

  ('kpi-budget-target', 'budget_target', 'Budget Target', 'reference', 'finance_budget',
   'Annual revenue budget set by Finance. FY26 = 106,000,000 (rounded). Exact = 105,977,172.',
   'd365 (future)', 'Dashboard snapshot import', 'Finance (CFO)',
   'exact', 0, 'round_millions', 'low',
   'Stable reference value. Updated annually. Currently imported as rounded "106M".'),

  ('kpi-unsold-capacity-value', 'unsold_capacity_value', 'Unsold Capacity Value', 'p2_snapshot', 'excel_snapshot',
   'Free capacity × rate per pallet position. Rate source = Finance assumption.',
   'lfs (future)', 'Dashboard snapshot import', 'Operations + Finance',
   'percentage', 10.0, 'round_millions', 'medium',
   'Depends on capacity accuracy (LFS) and rate assumptions (Finance).'),

  ('kpi-warehouse-utilization', 'warehouse_utilization', 'Warehouse Utilization %', 'operational', 'excel_snapshot',
   'committed_capacity / total_sellable_capacity per warehouse. Source = Capacity sheet.',
   'lfs (future)', 'warehouse_capacity_snapshots', 'Operations',
   'percentage', 2.0, 'round_pct', 'medium',
   'Per-warehouse metric. Will become real-time with LFS API.'),

  ('kpi-stage-counts', 'stage_counts', 'Pipeline Stage Counts', 'operational', 'manual_hanno',
   'COUNT(*) GROUP BY stage from commercial_opportunities. Stages: Identified, Shortlisted, ContractNeg, ClosedWon.',
   NULL, 'commercial_opportunities', 'Sales (Hano Oberholzer)',
   'exact', 0, 'none', 'low',
   'Derived count. No rounding. Changes when Hano updates pipeline stages.'),

  ('kpi-top-deals', 'top_deals', 'Top Deals by ACV', 'operational', 'manual_hanno',
   'ORDER BY acv_annual DESC LIMIT N from commercial_opportunities.',
   NULL, 'commercial_opportunities', 'Sales (Hano Oberholzer)',
   'exact', 0, 'none', 'low',
   'Derived ranking. Read-only list for leadership visibility.'),

  ('kpi-revenue-actuals', 'revenue_actuals', 'Revenue Actuals', 'operational', 'excel_snapshot',
   'Monthly GL-level revenue by customer. Source = Revenue Data sheet.',
   'd365 (future)', 'warehouse_revenue_actuals', 'Finance',
   'absolute', 10000, 'none', 'medium',
   'Will be replaced by D365 GL feed. Currently point-in-time import.'),

  ('kpi-capacity-snapshots', 'capacity_snapshots', 'Capacity Snapshots', 'operational', 'excel_snapshot',
   'Per-warehouse capacity breakdown. Source = Capacity + Warehouse Details sheets.',
   'lfs (future)', 'warehouse_capacity_snapshots + warehouse_locations', 'Operations',
   'absolute', 1000, 'none', 'medium',
   'Point-in-time snapshot. Future = real-time LFS polling.'),

  ('kpi-closed-won-deals', 'closed_won_deals', 'Closed Won Deals', 'operational', 'manual_hanno',
   'Deals at 100% probability with contract signed. Source = Pipeline Report closed rows.',
   NULL, 'closed_won_deals', 'Sales (Hano Oberholzer)',
   'exact', 0, 'none', 'low',
   '11 deals in current import. Feed into Weighted Pipeline and Materializing calculations.'),

  ('kpi-leadership-actions', 'leadership_actions', 'Leadership Actions', 'governance', 'manual_hanno',
   'Risk/action items for leadership follow-up. Source = Actions sheet.',
   NULL, 'leadership_actions', 'Sales (Hano Oberholzer)',
   'exact', 0, 'none', 'low',
   '7 items in current import. Read-only display. No enforcement.')
ON CONFLICT (kpi_key) DO NOTHING;

-- ─── RLS Policies ────────────────────────────────────────────

ALTER TABLE commercial_kpi_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_kpi_registry" ON commercial_kpi_registry;
DROP POLICY IF EXISTS "auth_write_kpi_registry" ON commercial_kpi_registry;
DROP POLICY IF EXISTS "service_kpi_registry" ON commercial_kpi_registry;
CREATE POLICY "auth_read_kpi_registry"
  ON commercial_kpi_registry FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_kpi_registry"
  ON commercial_kpi_registry FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_kpi_registry"
  ON commercial_kpi_registry FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE commercial_source_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_source_registry" ON commercial_source_registry;
DROP POLICY IF EXISTS "auth_write_source_registry" ON commercial_source_registry;
DROP POLICY IF EXISTS "service_source_registry" ON commercial_source_registry;
CREATE POLICY "auth_read_source_registry"
  ON commercial_source_registry FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_source_registry"
  ON commercial_source_registry FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_source_registry"
  ON commercial_source_registry FOR ALL USING (auth.role() = 'service_role');

