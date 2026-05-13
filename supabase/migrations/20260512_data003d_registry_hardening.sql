-- ============================================================
-- DATA-003D: Registry Doctrine Hardening
-- Sprint: DATA-003D
-- Author: Claude / Antigravity
-- Date: 2026-05-12
--
-- ADDITIVE ONLY. No destructive changes. No CRM. No gates.
-- Adds truth_status, confidence_tier, source_lineage columns
-- and updates all 17 KPI rows with doctrine-aligned metadata.
-- ============================================================

-- ─── TASK 1: Add new columns ─────────────────────────────────

ALTER TABLE commercial_kpi_registry
  ADD COLUMN IF NOT EXISTS truth_status TEXT NOT NULL DEFAULT 'unresolved';

ALTER TABLE commercial_kpi_registry
  ADD COLUMN IF NOT EXISTS confidence_tier INTEGER NOT NULL DEFAULT 5;

ALTER TABLE commercial_kpi_registry
  ADD COLUMN IF NOT EXISTS source_lineage TEXT;

-- ─── TASK 2: Update all 17 KPIs with doctrine metadata ──────

-- ST-1: Weighted Pipeline
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_formula',
  confidence_tier = 2,
  tolerance_value = 0.5,
  tolerance_type  = 'percentage',
  source_lineage  = 'Dashboard A6 → Pipeline Report AH67 → commercial_opportunities → SUM(acv_annual × probability_pct)'
WHERE kpi_key = 'weighted_pipeline';

-- ST-2: Materializing 75%+
UPDATE commercial_kpi_registry SET
  truth_status     = 'rounded_snapshot',
  confidence_tier  = 3,
  governance_owner = 'Sales Leadership + Commercial Director',
  tolerance_value  = 1.0,
  tolerance_type   = 'percentage',
  source_lineage   = 'Dashboard D6 → SUMIFS(AI6:AI65, probability>=75%) → commercial_opportunities → SUM(weighted WHERE probability>=75)'
WHERE kpi_key = 'materializing_75plus';

-- ST-3: Projected GP Weighted
UPDATE commercial_kpi_registry SET
  truth_status    = 'disputed',
  confidence_tier = 5,
  tolerance_value = 5.0,
  tolerance_type  = 'percentage',
  source_lineage  = 'Dashboard → weighted_pipeline × (1 - cost_ratio) → USES dangerous_default 75% cost ratio'
WHERE kpi_key = 'projected_gp_weighted';

-- ST-4: Free Capacity Baseline
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_snapshot',
  confidence_tier = 3,
  tolerance_value = 1000,
  tolerance_type  = 'absolute',
  source_lineage  = 'Dashboard → WH Pallet Input → warehouse_capacity_snapshots → SUM(sellable_capacity)'
WHERE kpi_key = 'free_capacity_baseline';

-- ST-5: FY26 Revenue Gap
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_formula',
  confidence_tier = 2,
  tolerance_value = 100000,
  tolerance_type  = 'absolute',
  source_lineage  = 'Forecast P11 → P9-P10 → forecast_total - budget_target'
WHERE kpi_key = 'fy26_revenue_gap';

-- ST-6: FY26 GP Gap
UPDATE commercial_kpi_registry SET
  truth_status    = 'rounded_snapshot',
  confidence_tier = 3,
  tolerance_value = 500000,
  tolerance_type  = 'absolute',
  source_lineage  = 'Forecast P19 → P17-P18 → gp_forecast - gp_budget'
WHERE kpi_key = 'fy26_gp_gap';

-- ST-7: Forecast Total
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_formula',
  confidence_tier = 2,
  tolerance_value = 100000,
  tolerance_type  = 'absolute',
  source_lineage  = 'Forecast P9 → P5+P6+P7+P8 → forecast_monthly baseline + pipeline 75%+ phasing rows'
WHERE kpi_key = 'forecast_total';

-- ST-8: Monthly Phasing
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_formula',
  confidence_tier = 2,
  tolerance_value = 0,
  tolerance_type  = 'exact_or_integer_rounding',
  source_lineage  = 'Pipeline Data Input monthly columns → commercial_opportunity_monthly_phasing → ACV/12 from go-live month'
WHERE kpi_key = 'monthly_phasing';

-- Budget Target
UPDATE commercial_kpi_registry SET
  truth_status    = 'governance_input',
  confidence_tier = 3,
  tolerance_value = 0,
  tolerance_type  = 'exact',
  source_lineage  = 'Forecast P10 → Finance monthly budget targets → forecast_monthly budget rows'
WHERE kpi_key = 'budget_target';

-- Unsold Capacity Value
UPDATE commercial_kpi_registry SET
  truth_status    = 'assumption',
  confidence_tier = 4,
  tolerance_value = 500000,
  tolerance_type  = 'absolute',
  source_lineage  = 'Dashboard → free_capacity × assumed_rate → dangerous_default rate assumption'
WHERE kpi_key = 'unsold_capacity_value';

-- Warehouse Utilization
UPDATE commercial_kpi_registry SET
  truth_status    = 'disputed',
  confidence_tier = 5,
  tolerance_value = 5.0,
  tolerance_type  = 'percentage_points',
  source_lineage  = 'Dashboard → WH Pallet Input → occupied/total capacity → varies by snapshot date'
WHERE kpi_key = 'warehouse_utilization';

-- Stage Counts
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_formula',
  confidence_tier = 2,
  tolerance_value = 0,
  tolerance_type  = 'exact',
  source_lineage  = 'Pipeline Data Input → commercial_opportunities → COUNT(GROUP BY stage)'
WHERE kpi_key = 'stage_counts';

-- Top Deals by ACV
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_formula',
  confidence_tier = 2,
  tolerance_value = 0,
  tolerance_type  = 'exact',
  source_lineage  = 'Pipeline Data Input → commercial_opportunities → ORDER BY acv_annual DESC LIMIT N'
WHERE kpi_key = 'top_deals_by_acv';

-- Revenue Actuals
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_snapshot',
  confidence_tier = 3,
  tolerance_value = 1000,
  tolerance_type  = 'absolute',
  source_lineage  = 'Revenue Data Input → warehouse_revenue_actuals → historical GL values per warehouse per month'
WHERE kpi_key = 'revenue_actuals';

-- Capacity Snapshots
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_snapshot',
  confidence_tier = 3,
  tolerance_value = 1000,
  tolerance_type  = 'absolute',
  source_lineage  = 'WH Pallet Input → warehouse_capacity_snapshots → imported capacity snapshot per warehouse'
WHERE kpi_key = 'capacity_snapshots';

-- Closed Won Deals
UPDATE commercial_kpi_registry SET
  truth_status    = 'verified_snapshot',
  confidence_tier = 3,
  tolerance_value = 0,
  tolerance_type  = 'exact',
  source_lineage  = 'Closed Won Data Input → closed_won_deals → 11 deals at 100% probability'
WHERE kpi_key = 'closed_won_deals';

-- Leadership Actions
UPDATE commercial_kpi_registry SET
  truth_status    = 'governance_input',
  confidence_tier = 3,
  tolerance_value = 0,
  tolerance_type  = 'exact',
  source_lineage  = 'Executive Dashboard Actions → leadership_actions → risk/action items for leadership'
WHERE kpi_key = 'leadership_actions';
