-- ════════════════════════════════════════════════════════════════
-- DATA-002B Part 3: Forecast Monthly + Revenue Actuals
-- Import batch: data002b-20260511
-- Source: Forecast 75% - 100%.csv, Warehouse RH Data Input.csv
-- ════════════════════════════════════════════════════════════════

-- ─── FORECAST MONTHLY ────────────────────────────────────────
-- Source: Forecast 75% - 100%.csv

INSERT INTO forecast_monthly (id, forecast_month, category, line_item, probability_pct, amount, budget_amount, delta_amount, metric_type, source_file, source_sheet, import_batch_id)
VALUES
-- Revenue rows
('fm-rev-jan26','2026-01','Revenue','Total',NULL,8222564,7804324,418240,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-feb26','2026-02','Revenue','Total',NULL,7540407,7991024,-450618,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-mar26','2026-03','Revenue','Total',NULL,7826591,8136274,-309683,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-apr26','2026-04','Revenue','Total',NULL,6956107,8557831,-1601724,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-may26','2026-05','Revenue','Total',NULL,7526454,8554331,-1027877,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-jun26','2026-06','Revenue','Total',NULL,7889254,8719831,-830577,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-jul26','2026-07','Revenue','Total',NULL,7960087,9239831,-1279744,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-aug26','2026-08','Revenue','Total',NULL,7960087,9133831,-1173744,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-sep26','2026-09','Revenue','Total',NULL,7960087,9193421,-1233333,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-oct26','2026-10','Revenue','Total',NULL,7960087,9466824,-1506737,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-nov26','2026-11','Revenue','Total',NULL,7960087,9544824,-1584737,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-rev-dec26','2026-12','Revenue','Total',NULL,7960087,9634824,-1674737,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
-- Pipeline component: Shortlisted 75%
('fm-short-may26','2026-05','Pipeline','Shortlisted',75,60500,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-jun26','2026-06','Pipeline','Shortlisted',75,223300,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-jul26','2026-07','Pipeline','Shortlisted',75,294133,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-aug26','2026-08','Pipeline','Shortlisted',75,294133,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-sep26','2026-09','Pipeline','Shortlisted',75,294133,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-oct26','2026-10','Pipeline','Shortlisted',75,294133,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-nov26','2026-11','Pipeline','Shortlisted',75,294133,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-short-dec26','2026-12','Pipeline','Shortlisted',75,294133,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
-- Pipeline component: Contract Negotiation 90%
('fm-nego-may26','2026-05','Pipeline','Contract Negotiation',90,165000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-jun26','2026-06','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-jul26','2026-07','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-aug26','2026-08','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-sep26','2026-09','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-oct26','2026-10','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-nov26','2026-11','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-nego-dec26','2026-12','Pipeline','Contract Negotiation',90,365000,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
-- Pipeline component: Closed Won 100%
('fm-won-may26','2026-05','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-jun26','2026-06','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-jul26','2026-07','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-aug26','2026-08','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-sep26','2026-09','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-oct26','2026-10','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-nov26','2026-11','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-won-dec26','2026-12','Pipeline','Closed Won',100,482217,NULL,NULL,'revenue','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
-- GP rows
('fm-gp-jan26','2026-01','GP','Total',NULL,734179,30698,703481,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-feb26','2026-02','GP','Total',NULL,383798,223363,160434,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-mar26','2026-03','GP','Total',NULL,1117977,255135,862842,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-apr26','2026-04','GP','Total',NULL,300967,790477,-489510,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-may26','2026-05','GP','Total',NULL,477896,784100,-306204,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-jun26','2026-06','GP','Total',NULL,568596,937540,-368944,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-jul26','2026-07','GP','Total',NULL,586305,1636160,-1049856,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-aug26','2026-08','GP','Total',NULL,586305,1540304,-954000,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-sep26','2026-09','GP','Total',NULL,586305,1581516,-995211,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-oct26','2026-10','GP','Total',NULL,586305,1843824,-1257519,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-nov26','2026-11','GP','Total',NULL,586305,1921241,-1334936,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-gp-dec26','2026-12','GP','Total',NULL,586305,2011503,-1425198,'gp','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
-- Capacity loss rows
('fm-cap-may26','2026-05','Capacity','Revenue Loss',NULL,3469440,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-jun26','2026-06','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-jul26','2026-07','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-aug26','2026-08','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-sep26','2026-09','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-oct26','2026-10','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-nov26','2026-11','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511'),
('fm-cap-dec26','2026-12','Capacity','Revenue Loss',NULL,3103200,NULL,NULL,'capacity','Forecast 75% - 100%.csv','Forecast','data002b-20260511')
ON CONFLICT (id) DO NOTHING;


-- ─── REVENUE ACTUALS (top 20 customers by YTD) ───────────────
-- Source: Warehouse RH Data Input.csv
-- Months: Jan-Apr 2026 (actuals available)

INSERT INTO warehouse_revenue_actuals (id, gl_code, customer_name, month, amount, ytd_amount, period_year, revenue_type, source_file, source_sheet, import_batch_id)
VALUES
-- SABIC (multiple GL codes combined: 143295 + 143596 + 143605 + 143708)
('wra-sabic-jan','401120:401122-CUS-143295','Saudi Basic Industries Corporation (SABIC)','2026-01',719112.80,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-sabic-feb','401120:401122-CUS-143295','Saudi Basic Industries Corporation (SABIC)','2026-02',766900.73,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-sabic-mar','401120:401122-CUS-143295','Saudi Basic Industries Corporation (SABIC)','2026-03',727848.65,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-sabic-apr','401120:401122-CUS-143295','Saudi Basic Industries Corporation (SABIC)','2026-04',399966.43,2613828.61,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- Tasnee (Saudi Technology and Security = Tasnee)
('wra-tasnee-jan','401120:401122-CUS-143429','Saudi Technology and Security Comprehensive Control Co. LTD','2026-01',1209752,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-tasnee-feb','401120:401122-CUS-143429','Saudi Technology and Security Comprehensive Control Co. LTD','2026-02',1211420,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-tasnee-mar','401120:401122-CUS-143429','Saudi Technology and Security Comprehensive Control Co. LTD','2026-03',1197100,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-tasnee-apr','401120:401122-CUS-143429','Saudi Technology and Security Comprehensive Control Co. LTD','2026-04',1203016,4821288,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- SLB (Schlumberger)
('wra-slb-jan','401120:401122-CUS-143313','Schlumberger Middle East S.A.','2026-01',704580,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-slb-feb','401120:401122-CUS-143313','Schlumberger Middle East S.A.','2026-02',704580,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-slb-mar','401120:401122-CUS-143313','Schlumberger Middle East S.A.','2026-03',704580,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-slb-apr','401120:401122-CUS-143313','Schlumberger Middle East S.A.','2026-04',704580,2818320,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- BDP International
('wra-bdp-jan','401120:401122-CUS-143700','BDP International Logistic Services Co.','2026-01',505661.44,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-bdp-feb','401120:401122-CUS-143700','BDP International Logistic Services Co.','2026-02',505062.05,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-bdp-mar','401120:401122-CUS-143700','BDP International Logistic Services Co.','2026-03',524568.49,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-bdp-apr','401120:401122-CUS-143700','BDP International Logistic Services Co.','2026-04',563628.87,2098920.85,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- AATCO
('wra-aatco-jan','401120:401122-CUS-143592','AATCO Food Industries LLC','2026-01',427427.53,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-aatco-feb','401120:401122-CUS-143592','AATCO Food Industries LLC','2026-02',400151.34,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-aatco-mar','401120:401122-CUS-143592','AATCO Food Industries LLC','2026-03',457086.77,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-aatco-apr','401120:401122-CUS-143592','AATCO Food Industries LLC','2026-04',461916.06,1746581.70,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- Baxter
('wra-baxter-jan','401120:401122-CUS-143330','Baxter Company Limited','2026-01',264304,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-baxter-feb','401120:401122-CUS-143330','Baxter Company Limited','2026-02',274710,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-baxter-mar','401120:401122-CUS-143330','Baxter Company Limited','2026-03',308797,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-baxter-apr','401120:401122-CUS-143330','Baxter Company Limited','2026-04',316397,1164208,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- Diversey
('wra-diversey-jan','401120:401122-CUS-143561','Diversey Saudi Arabia Limited Company','2026-01',322768.50,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-diversey-feb','401120:401122-CUS-143561','Diversey Saudi Arabia Limited Company','2026-02',263249.50,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-diversey-mar','401120:401122-CUS-143561','Diversey Saudi Arabia Limited Company','2026-03',247026,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-diversey-apr','401120:401122-CUS-143561','Diversey Saudi Arabia Limited Company','2026-04',298295,1131339,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- Hydrill
('wra-hydrill-jan','401120:401122-CUS-143678','Hydrill Pressure controlling Arabia limited','2026-01',218038.69,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-hydrill-feb','401120:401122-CUS-143678','Hydrill Pressure controlling Arabia limited','2026-02',221200,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-hydrill-mar','401120:401122-CUS-143678','Hydrill Pressure controlling Arabia limited','2026-03',223000.30,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-hydrill-apr','401120:401122-CUS-143678','Hydrill Pressure controlling Arabia limited','2026-04',217750.30,879989.29,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
-- Total revenue row (summary)
('wra-total-jan','401120:401122','TOTAL REVENUE','2026-01',8115849.35,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-total-feb','401120:401122','TOTAL REVENUE','2026-02',7432397.95,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-total-mar','401120:401122','TOTAL REVENUE','2026-03',7272375.18,0,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511'),
('wra-total-apr','401120:401122','TOTAL REVENUE','2026-04',6818737.41,29639359.89,2026,'warehousing','Warehouse RH Data Input.csv','Revenue Actuals','data002b-20260511')
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- END PART 3
-- ════════════════════════════════════════════════════════════════
