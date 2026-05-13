-- ════════════════════════════════════════════════════════════════
-- DATA-002A: Commercial OS Schema Parity
-- Run: 2026-05-11
-- Author: Antigravity / Hala Commercial Engine
--
-- Creates 11 tables for the Warehouse Commercial Operating System:
--   1.  commercial_opportunities
--   2.  commercial_opportunity_monthly_phasing
--   3.  commercial_opportunity_flags
--   4.  warehouse_locations
--   5.  warehouse_chambers
--   6.  warehouse_capacity_snapshots
--   7.  closed_won_deals
--   8.  warehouse_revenue_actuals
--   9.  forecast_monthly
--   10. commercial_dashboard_snapshots
--   11. leadership_actions
--
-- SAFE: All CREATE IF NOT EXISTS. Re-runnable. No drops. No truncates.
-- SCOPE: Warehouse pipeline only. Does NOT touch tender, governance, or CRM.
-- DOCTRINE: No real gates. No enforcement. No production locks.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. COMMERCIAL OPPORTUNITIES
-- Core pipeline table. Maps 1:1 to Pipeline Data Input rows.
-- pipeline_type defaults to 'warehouse' to separate from tender.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_opportunities (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  customer_id             TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name           TEXT NOT NULL,
  opportunity_name        TEXT DEFAULT '',
  owner                   TEXT DEFAULT '',
  stage                   TEXT DEFAULT 'Prospecting',
  probability_pct         NUMERIC DEFAULT 0,
  warehouse_raw           TEXT DEFAULT '',
  warehouse_location_id   TEXT,
  go_live_date            TEXT DEFAULT '',
  acv_annual              NUMERIC DEFAULT 0,
  expected_revenue_cy     NUMERIC DEFAULT 0,
  source_exp_cy           NUMERIC DEFAULT 0,
  source_modeled_delta    NUMERIC DEFAULT 0,
  volume_pallets          INTEGER DEFAULT 0,
  volume_sqm              NUMERIC DEFAULT 0,
  region                  TEXT DEFAULT '',
  notes                   TEXT DEFAULT '',
  pipeline_type           TEXT DEFAULT 'warehouse',
  data_confidence_status  TEXT DEFAULT 'unverified',
  source_file             TEXT DEFAULT '',
  source_sheet            TEXT DEFAULT '',
  source_row              INTEGER,
  import_batch_id         TEXT DEFAULT '',
  metadata                JSONB DEFAULT '{}'::JSONB,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_co_customer ON commercial_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_co_stage ON commercial_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_co_pipeline ON commercial_opportunities(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_co_warehouse ON commercial_opportunities(warehouse_location_id);
CREATE INDEX IF NOT EXISTS idx_co_batch ON commercial_opportunities(import_batch_id);


-- ────────────────────────────────────────────────────────────────
-- 2. COMMERCIAL OPPORTUNITY MONTHLY PHASING
-- Monthly revenue breakdown per opportunity (May-26 → Dec-27).
-- One row per opportunity per month.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_opportunity_monthly_phasing (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  opportunity_id    TEXT NOT NULL REFERENCES commercial_opportunities(id) ON DELETE CASCADE,
  month             TEXT NOT NULL,
  revenue_amount    NUMERIC DEFAULT 0,
  weighted_amount   NUMERIC DEFAULT 0,
  source_type       TEXT DEFAULT 'excel_import',
  source_file       TEXT DEFAULT '',
  source_sheet      TEXT DEFAULT '',
  source_row        INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_phase_opp ON commercial_opportunity_monthly_phasing(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_comp_phase_month ON commercial_opportunity_monthly_phasing(month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_phase_opp_month ON commercial_opportunity_monthly_phasing(opportunity_id, month);


-- ────────────────────────────────────────────────────────────────
-- 3. COMMERCIAL OPPORTUNITY FLAGS
-- Data quality flags per opportunity (ACV mismatch, stale CRM, etc.)
-- Maps to Pipeline Report "Notes" column flags.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_opportunity_flags (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  opportunity_id    TEXT NOT NULL REFERENCES commercial_opportunities(id) ON DELETE CASCADE,
  flag_type         TEXT NOT NULL DEFAULT 'data_quality',
  severity          TEXT DEFAULT 'warning',
  message           TEXT DEFAULT '',
  owner             TEXT DEFAULT '',
  status            TEXT DEFAULT 'open',
  source_note       TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cof_opp ON commercial_opportunity_flags(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_cof_status ON commercial_opportunity_flags(status);


-- ────────────────────────────────────────────────────────────────
-- 4. WAREHOUSE LOCATIONS
-- Master warehouse list. parent_location_id for rollup (Jubail Total).
-- report_label matches exact Excel label for VLOOKUP parity.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                TEXT NOT NULL,
  report_label        TEXT NOT NULL UNIQUE,
  region              TEXT DEFAULT '',
  facility_type       TEXT DEFAULT 'warehouse',
  parent_location_id  TEXT REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  active              BOOLEAN DEFAULT TRUE,
  metadata            JSONB DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_region ON warehouse_locations(region);
CREATE INDEX IF NOT EXISTS idx_wl_parent ON warehouse_locations(parent_location_id);


-- ────────────────────────────────────────────────────────────────
-- 5. WAREHOUSE CHAMBERS
-- Chamber-level breakdown within a warehouse (Jubail CHM-01/02/03).
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_chambers (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  warehouse_location_id TEXT NOT NULL REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  chamber_name          TEXT NOT NULL,
  total_locations       INTEGER DEFAULT 0,
  total_capacity        INTEGER DEFAULT 0,
  occupied_capacity     INTEGER DEFAULT 0,
  sellable_capacity     INTEGER DEFAULT 0,
  committed_capacity    INTEGER DEFAULT 0,
  shortfall_capacity    INTEGER DEFAULT 0,
  utilization_pct       NUMERIC DEFAULT 0,
  metadata              JSONB DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wch_location ON warehouse_chambers(warehouse_location_id);


-- ────────────────────────────────────────────────────────────────
-- 6. WAREHOUSE CAPACITY SNAPSHOTS
-- Point-in-time capacity snapshots. One row per warehouse per date.
-- Maps to "Warehouse Pallet Data Input" sheet.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_capacity_snapshots (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  warehouse_location_id TEXT NOT NULL REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  snapshot_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  total_locations       INTEGER DEFAULT 0,
  total_capacity        INTEGER DEFAULT 0,
  occupied_capacity     INTEGER DEFAULT 0,
  utilization_pct       NUMERIC DEFAULT 0,
  sellable_capacity     INTEGER DEFAULT 0,
  committed_capacity    INTEGER DEFAULT 0,
  blocked_locations     INTEGER DEFAULT 0,
  virtual_locations     INTEGER DEFAULT 0,
  shortfall_capacity    INTEGER DEFAULT 0,
  metadata              JSONB DEFAULT '{}'::JSONB,
  source_file           TEXT DEFAULT '',
  source_sheet          TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wcs_location ON warehouse_capacity_snapshots(warehouse_location_id);
CREATE INDEX IF NOT EXISTS idx_wcs_date ON warehouse_capacity_snapshots(snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wcs_loc_date ON warehouse_capacity_snapshots(warehouse_location_id, snapshot_date);


-- ────────────────────────────────────────────────────────────────
-- 7. CLOSED WON DEALS
-- Booked deals. Maps to "Closed Won Data Input" sheet.
-- Separate from pipeline because these are committed revenue.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS closed_won_deals (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  customer_id               TEXT REFERENCES customers(id) ON DELETE SET NULL,
  account_name              TEXT NOT NULL,
  warehouse_location        TEXT DEFAULT '',
  warehouse_location_id     TEXT REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  owner                     TEXT DEFAULT '',
  volume_pallets            INTEGER DEFAULT 0,
  volume_sqm                NUMERIC DEFAULT 0,
  expected_revenue_cy       NUMERIC DEFAULT 0,
  annual_contract_value     NUMERIC DEFAULT 0,
  ops_go_live_date          TEXT DEFAULT '',
  stage                     TEXT DEFAULT 'Closed Won',
  estimated_rate_per_pallet NUMERIC DEFAULT 0,
  source_file               TEXT DEFAULT '',
  source_sheet              TEXT DEFAULT '',
  source_row                INTEGER,
  import_batch_id           TEXT DEFAULT '',
  metadata                  JSONB DEFAULT '{}'::JSONB,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cwd_customer ON closed_won_deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_cwd_warehouse ON closed_won_deals(warehouse_location_id);
CREATE INDEX IF NOT EXISTS idx_cwd_batch ON closed_won_deals(import_batch_id);


-- ────────────────────────────────────────────────────────────────
-- 8. WAREHOUSE REVENUE ACTUALS
-- Monthly P&L actuals by customer GL code.
-- Maps to "Warehouse RH Data Input" sheet.
-- One row per customer per month.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_revenue_actuals (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  gl_code         TEXT DEFAULT '',
  customer_id     TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  month           TEXT NOT NULL,
  amount          NUMERIC DEFAULT 0,
  ytd_amount      NUMERIC DEFAULT 0,
  period_year     INTEGER DEFAULT 2026,
  revenue_type    TEXT DEFAULT 'warehousing',
  source_file     TEXT DEFAULT '',
  source_sheet    TEXT DEFAULT '',
  source_row      INTEGER,
  import_batch_id TEXT DEFAULT '',
  metadata        JSONB DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wra_customer ON warehouse_revenue_actuals(customer_id);
CREATE INDEX IF NOT EXISTS idx_wra_month ON warehouse_revenue_actuals(month);
CREATE INDEX IF NOT EXISTS idx_wra_gl ON warehouse_revenue_actuals(gl_code);
CREATE INDEX IF NOT EXISTS idx_wra_batch ON warehouse_revenue_actuals(import_batch_id);


-- ────────────────────────────────────────────────────────────────
-- 9. FORECAST MONTHLY
-- Monthly forecast rows: revenue, GP, capacity metrics.
-- Maps to "Forecast 75%-100%" sheet.
-- One row per month per category per line item.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forecast_monthly (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  forecast_month    TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT '',
  line_item         TEXT NOT NULL DEFAULT '',
  probability_pct   NUMERIC,
  amount            NUMERIC DEFAULT 0,
  budget_amount     NUMERIC,
  delta_amount      NUMERIC,
  metric_type       TEXT DEFAULT 'revenue',
  source_file       TEXT DEFAULT '',
  source_sheet      TEXT DEFAULT '',
  source_row        INTEGER,
  import_batch_id   TEXT DEFAULT '',
  metadata          JSONB DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_month ON forecast_monthly(forecast_month);
CREATE INDEX IF NOT EXISTS idx_fm_category ON forecast_monthly(category);
CREATE INDEX IF NOT EXISTS idx_fm_metric ON forecast_monthly(metric_type);
CREATE INDEX IF NOT EXISTS idx_fm_batch ON forecast_monthly(import_batch_id);


-- ────────────────────────────────────────────────────────────────
-- 10. COMMERCIAL DASHBOARD SNAPSHOTS
-- KPI snapshots from Executive Dashboard tab.
-- One row per metric per snapshot date.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_dashboard_snapshots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_key      TEXT NOT NULL,
  metric_label    TEXT DEFAULT '',
  metric_value    NUMERIC DEFAULT 0,
  metric_unit     TEXT DEFAULT 'SAR',
  source_file     TEXT DEFAULT '',
  source_sheet    TEXT DEFAULT '',
  import_batch_id TEXT DEFAULT '',
  metadata        JSONB DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cds_date ON commercial_dashboard_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cds_key ON commercial_dashboard_snapshots(metric_key);
CREATE INDEX IF NOT EXISTS idx_cds_batch ON commercial_dashboard_snapshots(import_batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cds_date_key ON commercial_dashboard_snapshots(snapshot_date, metric_key);


-- ────────────────────────────────────────────────────────────────
-- 11. LEADERSHIP ACTIONS
-- Risk items and required leadership decisions from Dashboard.
-- Maps to "TOP RISKS & ACTIONS NEEDED" section.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leadership_actions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action_code     TEXT NOT NULL UNIQUE,
  action_title    TEXT NOT NULL,
  impact          TEXT DEFAULT '',
  owner           TEXT DEFAULT '',
  status          TEXT DEFAULT 'Open',
  severity        TEXT DEFAULT 'medium',
  source_area     TEXT DEFAULT '',
  source_file     TEXT DEFAULT '',
  source_sheet    TEXT DEFAULT '',
  import_batch_id TEXT DEFAULT '',
  metadata        JSONB DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_status ON leadership_actions(status);
CREATE INDEX IF NOT EXISTS idx_la_code ON leadership_actions(action_code);


-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Permissive dev policies (authenticated)
-- Same pattern as SUPA-008/SUPA-009.
-- ════════════════════════════════════════════════════════════════

-- 1. commercial_opportunities
ALTER TABLE commercial_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_commercial_opportunities" ON commercial_opportunities;
DROP POLICY IF EXISTS "auth_write_commercial_opportunities" ON commercial_opportunities;
DROP POLICY IF EXISTS "service_commercial_opportunities" ON commercial_opportunities;
CREATE POLICY "auth_read_commercial_opportunities"
  ON commercial_opportunities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_commercial_opportunities"
  ON commercial_opportunities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_commercial_opportunities"
  ON commercial_opportunities FOR ALL USING (auth.role() = 'service_role');

-- 2. commercial_opportunity_monthly_phasing
ALTER TABLE commercial_opportunity_monthly_phasing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_comp_monthly_phasing" ON commercial_opportunity_monthly_phasing;
DROP POLICY IF EXISTS "auth_write_comp_monthly_phasing" ON commercial_opportunity_monthly_phasing;
DROP POLICY IF EXISTS "service_comp_monthly_phasing" ON commercial_opportunity_monthly_phasing;
CREATE POLICY "auth_read_comp_monthly_phasing"
  ON commercial_opportunity_monthly_phasing FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_comp_monthly_phasing"
  ON commercial_opportunity_monthly_phasing FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_comp_monthly_phasing"
  ON commercial_opportunity_monthly_phasing FOR ALL USING (auth.role() = 'service_role');

-- 3. commercial_opportunity_flags
ALTER TABLE commercial_opportunity_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_comp_opp_flags" ON commercial_opportunity_flags;
DROP POLICY IF EXISTS "auth_write_comp_opp_flags" ON commercial_opportunity_flags;
DROP POLICY IF EXISTS "service_comp_opp_flags" ON commercial_opportunity_flags;
CREATE POLICY "auth_read_comp_opp_flags"
  ON commercial_opportunity_flags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_comp_opp_flags"
  ON commercial_opportunity_flags FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_comp_opp_flags"
  ON commercial_opportunity_flags FOR ALL USING (auth.role() = 'service_role');

-- 4. warehouse_locations
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_warehouse_locations" ON warehouse_locations;
DROP POLICY IF EXISTS "auth_write_warehouse_locations" ON warehouse_locations;
DROP POLICY IF EXISTS "service_warehouse_locations" ON warehouse_locations;
CREATE POLICY "auth_read_warehouse_locations"
  ON warehouse_locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_warehouse_locations"
  ON warehouse_locations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_warehouse_locations"
  ON warehouse_locations FOR ALL USING (auth.role() = 'service_role');

-- 5. warehouse_chambers
ALTER TABLE warehouse_chambers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_warehouse_chambers" ON warehouse_chambers;
DROP POLICY IF EXISTS "auth_write_warehouse_chambers" ON warehouse_chambers;
DROP POLICY IF EXISTS "service_warehouse_chambers" ON warehouse_chambers;
CREATE POLICY "auth_read_warehouse_chambers"
  ON warehouse_chambers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_warehouse_chambers"
  ON warehouse_chambers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_warehouse_chambers"
  ON warehouse_chambers FOR ALL USING (auth.role() = 'service_role');

-- 6. warehouse_capacity_snapshots
ALTER TABLE warehouse_capacity_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_wh_cap_snapshots" ON warehouse_capacity_snapshots;
DROP POLICY IF EXISTS "auth_write_wh_cap_snapshots" ON warehouse_capacity_snapshots;
DROP POLICY IF EXISTS "service_wh_cap_snapshots" ON warehouse_capacity_snapshots;
CREATE POLICY "auth_read_wh_cap_snapshots"
  ON warehouse_capacity_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_wh_cap_snapshots"
  ON warehouse_capacity_snapshots FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_wh_cap_snapshots"
  ON warehouse_capacity_snapshots FOR ALL USING (auth.role() = 'service_role');

-- 7. closed_won_deals
ALTER TABLE closed_won_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_closed_won_deals" ON closed_won_deals;
DROP POLICY IF EXISTS "auth_write_closed_won_deals" ON closed_won_deals;
DROP POLICY IF EXISTS "service_closed_won_deals" ON closed_won_deals;
CREATE POLICY "auth_read_closed_won_deals"
  ON closed_won_deals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_closed_won_deals"
  ON closed_won_deals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_closed_won_deals"
  ON closed_won_deals FOR ALL USING (auth.role() = 'service_role');

-- 8. warehouse_revenue_actuals
ALTER TABLE warehouse_revenue_actuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_wh_revenue_actuals" ON warehouse_revenue_actuals;
DROP POLICY IF EXISTS "auth_write_wh_revenue_actuals" ON warehouse_revenue_actuals;
DROP POLICY IF EXISTS "service_wh_revenue_actuals" ON warehouse_revenue_actuals;
CREATE POLICY "auth_read_wh_revenue_actuals"
  ON warehouse_revenue_actuals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_wh_revenue_actuals"
  ON warehouse_revenue_actuals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_wh_revenue_actuals"
  ON warehouse_revenue_actuals FOR ALL USING (auth.role() = 'service_role');

-- 9. forecast_monthly
ALTER TABLE forecast_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_forecast_monthly" ON forecast_monthly;
DROP POLICY IF EXISTS "auth_write_forecast_monthly" ON forecast_monthly;
DROP POLICY IF EXISTS "service_forecast_monthly" ON forecast_monthly;
CREATE POLICY "auth_read_forecast_monthly"
  ON forecast_monthly FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_forecast_monthly"
  ON forecast_monthly FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_forecast_monthly"
  ON forecast_monthly FOR ALL USING (auth.role() = 'service_role');

-- 10. commercial_dashboard_snapshots
ALTER TABLE commercial_dashboard_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_comm_dash_snapshots" ON commercial_dashboard_snapshots;
DROP POLICY IF EXISTS "auth_write_comm_dash_snapshots" ON commercial_dashboard_snapshots;
DROP POLICY IF EXISTS "service_comm_dash_snapshots" ON commercial_dashboard_snapshots;
CREATE POLICY "auth_read_comm_dash_snapshots"
  ON commercial_dashboard_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_comm_dash_snapshots"
  ON commercial_dashboard_snapshots FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_comm_dash_snapshots"
  ON commercial_dashboard_snapshots FOR ALL USING (auth.role() = 'service_role');

-- 11. leadership_actions
ALTER TABLE leadership_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_leadership_actions" ON leadership_actions;
DROP POLICY IF EXISTS "auth_write_leadership_actions" ON leadership_actions;
DROP POLICY IF EXISTS "service_leadership_actions" ON leadership_actions;
CREATE POLICY "auth_read_leadership_actions"
  ON leadership_actions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_leadership_actions"
  ON leadership_actions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_leadership_actions"
  ON leadership_actions FOR ALL USING (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════
-- END OF DATA-002A MIGRATION
-- ════════════════════════════════════════════════════════════════
