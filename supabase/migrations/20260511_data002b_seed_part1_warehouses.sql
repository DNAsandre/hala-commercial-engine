-- ════════════════════════════════════════════════════════════════
-- DATA-002B Part 1: Warehouse Locations + Chambers + Capacity Snapshots
-- Import batch: data002b-20260511
-- Source: Warehourse Pallet Data Input.csv
-- SAFE: All upserts. No drops. No deletes.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. WAREHOUSE LOCATIONS ──────────────────────────────────

INSERT INTO warehouse_locations (id, name, report_label, region, facility_type, parent_location_id, active)
VALUES
  ('wl-dmm-port',     'Dammam Port',              'Dammam Port',              'Dammam',  'warehouse', NULL, true),
  ('wl-dmm-2nd',      'Dammam 2nd Industrial',     'Dammam 2nd Ind -Tad WH',  'Dammam',  'warehouse', NULL, true),
  ('wl-jub-total',    'Jubail Total',              'Jubail Total',             'Jubail',  'rollup',    NULL, true),
  ('wl-jub-1',        'Jubail 1',                  'Jubail 1',                'Jubail',  'warehouse', 'wl-jub-total', true),
  ('wl-jub-2',        'Jubail 2',                  'Jubail 2',                'Jubail',  'warehouse', 'wl-jub-total', true),
  ('wl-jed-3a',       'Jeddah Modon 3A',           'Jeddah Modon 3A',         'Jeddah',  'warehouse', NULL, true),
  ('wl-jed-3b',       'Jeddah Modon 3B',           'Jeddah Modon 3B',         'Jeddah',  'warehouse', NULL, true),
  ('wl-ruh-tayba',    'Riyadh Tayba',              'RUH Tayba',               'Riyadh',  'warehouse', NULL, true),
  ('wl-subcontractor','Subcontractor',             'Subcontractor',            'Jeddah',  'subcontractor', NULL, true),
  ('wl-contract-log', 'Contract Logistics',        'Contract Logistics',       '',        'contract_logistics', NULL, true)
ON CONFLICT (report_label) DO NOTHING;


-- ─── 2. WAREHOUSE CHAMBERS (Jubail breakdown) ────────────────

INSERT INTO warehouse_chambers (id, warehouse_location_id, chamber_name, total_locations, total_capacity, occupied_capacity, sellable_capacity, committed_capacity, shortfall_capacity, utilization_pct)
VALUES
  ('wch-jub1-chm01', 'wl-jub-1', 'CHM-01',  9261, 10533,  1331,  9202, 0, 0, 12.6),
  ('wch-jub1-chm02', 'wl-jub-1', 'CHM-02', 21811, 24884, 10450, 14434, 0, 0, 42.0),
  ('wch-jub1-flo02', 'wl-jub-1', 'FLO-02',   100,   125,    55,    70, 0, 0, 44.0),
  ('wch-jub2-chm03', 'wl-jub-2', 'CHM-03',  8152, 29258, 10011, 19247, 0, 0, 34.2)
ON CONFLICT (id) DO NOTHING;


-- ─── 3. WAREHOUSE CAPACITY SNAPSHOTS (as of 2026-05-05) ──────

INSERT INTO warehouse_capacity_snapshots
  (id, warehouse_location_id, snapshot_date, total_locations, total_capacity, occupied_capacity, utilization_pct, sellable_capacity, committed_capacity, blocked_locations, virtual_locations, shortfall_capacity, source_file, source_sheet)
VALUES
  ('wcs-dmm-port-20260505',  'wl-dmm-port',      '2026-05-05', 28694, 34755, 29782, 85.7,  4973, 23400,    0,   0,  6156, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-dmm-2nd-20260505',   'wl-dmm-2nd',       '2026-05-05', 16153, 18654,  8607, 46.1, 10047,     0, 3619,   0,     0, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-jub-1-20260505',     'wl-jub-1',         '2026-05-05', 31172, 35542, 11836, 33.3, 23706, 13157,  146, 144, 10498, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-jub-2-20260505',     'wl-jub-2',         '2026-05-05',  8152, 29258, 10011, 34.2, 19247,     0,    0,   0,     0, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-jub-total-20260505', 'wl-jub-total',     '2026-05-05', 39324, 64800, 21847, 33.7, 42953, 13157,  146, 144, 10498, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-jed-3a-20260505',    'wl-jed-3a',        '2026-05-05', 36212, 36840, 17127, 46.5, 19713,   300, 9038, 134,    70, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-jed-3b-20260505',    'wl-jed-3b',        '2026-05-05', 12177, 14189, 13503, 95.2,   686,  2600, 3734,   0,   752, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-ruh-tayba-20260505', 'wl-ruh-tayba',     '2026-05-05',     0, 11132,  8134, 73.1,  2998,   317,    0,   0,    77, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-subcon-20260505',    'wl-subcontractor', '2026-05-05',     0,     0,     0,  0.0,  7500,     0,    0,   0,     0, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot'),
  ('wcs-clog-20260505',      'wl-contract-log',  '2026-05-05',     0,     0,     0,  0.0,     0,     0,    0,   0,     0, 'Warehourse Pallet Data Input.csv', 'Warehouse Snapshot')
ON CONFLICT (id) DO NOTHING;


-- ─── 4. DASHBOARD KPI SNAPSHOTS ──────────────────────────────
-- Source: Executive Dashboard.csv

INSERT INTO commercial_dashboard_snapshots (id, snapshot_date, metric_key, metric_label, metric_value, metric_unit, source_file, source_sheet, import_batch_id)
VALUES
  ('cds-wt-pipeline-20260505',   '2026-05-05', 'weighted_pipeline',     'Pipeline - Weighted',         43332714, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-unw-pipeline-20260505',  '2026-05-05', 'unweighted_pipeline',   'Unweighted Pipeline',         63695695, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-materializing-20260505', '2026-05-05', 'materializing_75plus',  'Materializing (75%+ Prob)',    20000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-mat-deals-20260505',     '2026-05-05', 'materializing_deals',   'Near-term Deals Count',             18, 'deals','Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-gp-weighted-20260505',   '2026-05-05', 'projected_gp_weighted', 'Projected GP - Weighted',     11000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-gp-unw-20260505',        '2026-05-05', 'unweighted_gp',         'Unweighted GP',               16000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-gp-margin-20260505',     '2026-05-05', 'gp_margin_pct',         'GP Margin %',                     25.0, '%',   'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-free-cap-20260505',      '2026-05-05', 'free_capacity_baseline','Free Capacity Baseline',        88870, 'pallets','Executive Dashboard.csv','Executive Dashboard', 'data002b-20260511'),
  ('cds-committed-20260505',     '2026-05-05', 'committed_dec26',       'Committed by Dec-26',           24220, 'pallets','Executive Dashboard.csv','Executive Dashboard', 'data002b-20260511'),
  ('cds-util-20260505',          '2026-05-05', 'utilization_pct',       'Utilization %',                  27.3, '%',   'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-rev-gap-20260505',       '2026-05-05', 'fy26_revenue_gap',      'FY26 Revenue Gap',           -12000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-rev-forecast-20260505',  '2026-05-05', 'fy26_revenue_forecast', 'FY26 Revenue Forecast',       92800000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-rev-budget-20260505',    '2026-05-05', 'fy26_revenue_budget',   'FY26 Revenue Budget',        106000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-gp-gap-20260505',        '2026-05-05', 'fy26_gp_gap',           'FY26 GP Gap',                 -6000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-gp-forecast-20260505',   '2026-05-05', 'fy26_gp_forecast',      'FY26 GP Forecast',             7100000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-gp-budget-20260505',     '2026-05-05', 'fy26_gp_budget',        'FY26 GP Budget',              13600000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('cds-unsold-val-20260505',    '2026-05-05', 'unsold_capacity_value', 'Unsold Capacity Value',        3000000, 'SAR', 'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511')
ON CONFLICT (id) DO NOTHING;


-- ─── 5. LEADERSHIP ACTIONS ───────────────────────────────────
-- Source: Executive Dashboard.csv — "TOP RISKS & ACTIONS NEEDED"

INSERT INTO leadership_actions (id, action_code, action_title, impact, owner, status, severity, source_area, source_file, source_sheet, import_batch_id)
VALUES
  ('la-l1', 'L1', 'Move 5 deals from Proposal Sent (60%) to Contract Negotiation (90%)',            '+2M weighted SAR',                'Sales (Hano)',    'Open',           'high',   'Pipeline Stage Progression',  'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('la-l2', 'L2', 'Fix top 4 ACV flags: Tejoury, KN-Hample, Baxter, SNB',                          '+/- 3.7M SAR forecast accuracy',  'Sales / Ops',     'Open',           'high',   'Data Quality / ACV',          'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('la-l3', 'L3', 'Calibrate Cost % per deal (replace 75% global default)',                          '+/- 2-3M SAR GP visibility',      'Finance',         'Open',           'high',   'GP Calculation',              'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('la-l4', 'L4', 'Resolve RUH Tayba over-commitment by Dec-26',                                    '~1M SAR at stake',                'COO',             'Decision needed','critical','Capacity Planning',           'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('la-l5', 'L5', 'Formalize Subcontractor capacity (4,500 pallets without baseline)',               '~675K SAR at stake',              'COO',             'Decision needed','critical','Capacity Planning',           'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('la-r1', 'R1', 'Tejoury: ACV corrected (4.4M); Source CY in CRM still stale (660K)',             'Cosmetic - flag only',            'Hano',            'Resolved data',  'low',    'Data Quality / CRM',          'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511'),
  ('la-r2', 'R2', '11 total data discrepancy flags - see Pipeline Report Notes column',              'Review weekly',                   'Sales',           'Review weekly',  'medium', 'Data Quality',                'Executive Dashboard.csv', 'Executive Dashboard', 'data002b-20260511')
ON CONFLICT (action_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- END PART 1 — Run this first, then Part 2.
-- ════════════════════════════════════════════════════════════════
