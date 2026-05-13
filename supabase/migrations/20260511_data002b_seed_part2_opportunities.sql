-- ════════════════════════════════════════════════════════════════
-- DATA-002B Part 2: Pipeline Opportunities + Closed Won Deals
-- Import batch: data002b-20260511
-- Source: Pipeline Data Input.csv (rows 1-35 active pipeline)
--         Closed Won Data Input.csv (rows 1-11)
-- NOTE: Rows 36-45 in Pipeline are auto-pulled Closed Won — SKIPPED here.
-- ════════════════════════════════════════════════════════════════

-- ─── PIPELINE OPPORTUNITIES (35 active deals) ────────────────

INSERT INTO commercial_opportunities
  (id, customer_name, opportunity_name, owner, stage, probability_pct, warehouse_raw, warehouse_location_id, go_live_date, acv_annual, expected_revenue_cy, volume_pallets, volume_sqm, region, notes, pipeline_type, source_file, source_sheet, source_row, import_batch_id)
VALUES
  ('co-001','SLB','SLB/WH/DMM2/4000PP','Yazan Darwish','Prospecting',20,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-07-01',2400000,1200000,4000,0,'East','Opp: SLB/WH/DMM2/4000PP','warehouse','Pipeline Data Input.csv','Pipeline Data Input',1,'data002b-20260511'),
  ('co-002','NALCO Ecolab','NALCO Ecolab/WH/DMM2','Yazan Darwish','Contract Negotiation',90,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-06-01',2400000,1400000,4000,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',2,'data002b-20260511'),
  ('co-003','Synthomer ME','Synthomer ME/WH/DMM2','Yazan Darwish','Contract Negotiation',90,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-05-15',900000,600000,1500,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',3,'data002b-20260511'),
  ('co-004','Transworld Saudi Logistics','Transworld/DMM/WH/500PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-05-01',420000,280000,500,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',4,'data002b-20260511'),
  ('co-005','Schmidt','Schmidt/WH/DMM2/400PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-05-01',264000,176000,400,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',5,'data002b-20260511'),
  ('co-006','Zaghami','Zaghami/WH/DMM/250PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-08-01',210000,87500,250,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',6,'data002b-20260511'),
  ('co-007','Transworld Saudi Logistics','Transworld/DMM/WH/250PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-06-01',162500,94792,250,0,'East','Source Exp CY mismatch (113,750 vs ACV/12 94,792)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',7,'data002b-20260511'),
  ('co-008','i-Energy','iEnergy/WH/DMM2/250PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-05-01',150000,100000,250,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',8,'data002b-20260511'),
  ('co-009','FMS Group','FMS/DMM/WH/100PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-06-01',50000,29167,100,0,'East','Source Exp CY mismatch (35,000 vs ACV/12 29,167)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',9,'data002b-20260511'),
  ('co-010','El Ajou Group','El Ajou/WH/DMM2/100PP','Yazan Darwish','Proposal Sent',60,'Dammam 2nd Ind -Tad WH','wl-dmm-2nd','2026-07-01',78000,39000,100,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',10,'data002b-20260511'),
  ('co-011','JAS','JAS/WH/JUB/1400PP','Yazan Darwish','Shortlisted',75,'Jubail 1','wl-jub-1','2026-06-01',924000,539000,1400,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',11,'data002b-20260511'),
  ('co-012','LX Pantos Logistics','LXPantos/WH/JUB1/1000PP','Yazan Darwish','Shortlisted',75,'Jubail 1','wl-jub-1','2026-05-01',726000,484000,1000,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',12,'data002b-20260511'),
  ('co-013','S-Chem','S-Chem/WH/JUB1/730PP','Yazan Darwish','Shortlisted',75,'Jubail 1','wl-jub-1','2026-06-15',138600,80850,730,0,'East','Source Exp CY mismatch (323,400 vs ACV/12 80,850)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',13,'data002b-20260511'),
  ('co-014','Saudi Pelican Logistics Solutions','SaudiPelican/WH/JUB/500PP','Yazan Darwish','Proposal Sent',60,'Jubail 1','wl-jub-1','2026-06-01',297000,173250,500,0,'East','Source Exp CY mismatch','warehouse','Pipeline Data Input.csv','Pipeline Data Input',14,'data002b-20260511'),
  ('co-015','Ravago Saudi Arabia','Ravago/WH/JUB/1200PP','Yazan Darwish','Proposal Sent',60,'Jubail 2','wl-jub-2','2026-09-01',550000,183333,1200,0,'East','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',15,'data002b-20260511'),
  ('co-016','Tahakom','Tahakom/WH/JUB/15000SQM','Yazan Darwish','Shortlisted',75,'Jubail 2','wl-jub-2','2026-07-01',850000,425000,0,15000,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',16,'data002b-20260511'),
  ('co-017','Oriend Provisions','OrientProv/WH/JED3A/3000PP','Simon Reah','Proposal Sent',60,'Jeddah Modon 3A','wl-jed-3a','2026-08-01',1620000,675000,3000,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',17,'data002b-20260511'),
  ('co-018','Al Nahdi','AlNahdi/WH/JED3A/3000PP','Simon Reah','Contract Negotiation',90,'Jeddah Modon 3A','wl-jed-3a','2026-05-01',1080000,720000,3000,0,'West','Source Exp CY mismatch','warehouse','Pipeline Data Input.csv','Pipeline Data Input',18,'data002b-20260511'),
  ('co-019','JamJoom','JamJoom/WH/JED3A/2000PP','Simon Reah','Shortlisted',75,'Jeddah Modon 3A','wl-jed-3a','2026-06-01',891000,519750,1500,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',19,'data002b-20260511'),
  ('co-020','Med City Pharma','MedCity/WH/JED/800PP','Amin AlHalabi','Proposal Sent',60,'Jeddah Modon 3A','wl-jed-3a','2026-06-01',595200,347200,800,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',20,'data002b-20260511'),
  ('co-021','Diwan Al Qahwa Trading Company','Diwan/WH/JED3A/500PP','Yazan Darwish','Proposal Sent',60,'Jeddah Modon 3A','wl-jed-3a','2026-07-01',396000,198000,500,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',21,'data002b-20260511'),
  ('co-022','Tejoury','Tejoury/WH/JED3A/4495SQM','Hano Oberholzer','Proposal Sent',60,'Jeddah Modon 3A','wl-jed-3a','2026-07-01',4400000,2200000,0,4495,'West','Source Exp CY mismatch (660K vs ACV/12 2.2M)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',22,'data002b-20260511'),
  ('co-023','United Carton','UnitedCarton/WH/JED3B/1400PP','Simon Reah','Proposal Sent',60,'Jeddah Modon 3B','wl-jed-3b','2026-07-01',504000,252000,1400,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',23,'data002b-20260511'),
  ('co-024','El Ajou Group','ElAjou/WH/JED3B/900PP','Yazan Darwish','Proposal Sent',60,'Jeddah Modon 3B','wl-jed-3b','2026-07-01',507000,253500,900,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',24,'data002b-20260511'),
  ('co-025','Astra Polymers','AstraPoly/WH/JED/250PP','Yazan Darwish','Proposal Sent',60,'Jeddah Modon 3B','wl-jed-3b','2026-07-01',127000,63500,250,0,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',25,'data002b-20260511'),
  ('co-026','Shuran Plastic','ShuranPlastic/WH/JED3B/1500SQM','Simon Reah','Proposal Sent',60,'Jeddah Modon 3B','wl-jed-3b','2026-06-01',846000,493500,0,1500,'West','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',26,'data002b-20260511'),
  ('co-027','Solenis','Solenis/WH/RUH/3000PP','Amin AlHalabi','Proposal Sent',60,'RUH Tayba','wl-ruh-tayba','2026-09-01',1740000,580000,3000,0,'Central','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',27,'data002b-20260511'),
  ('co-028','Kuehne & Nagel','KN-Hample/WH/RUH/2500PP','Simon Reah','Proposal Sent',60,'RUH Tayba','wl-ruh-tayba','2026-11-01',6102000,1017000,2500,0,'Central','Source Exp CY mismatch (339K vs ACV/12 1.017M)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',28,'data002b-20260511'),
  ('co-029','United Carton','UnitedCarton/WH/RUH/1200PP','Simon Reah','Proposal Sent',60,'RUH Tayba','wl-ruh-tayba','2026-07-01',504000,252000,1200,0,'Central','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',29,'data002b-20260511'),
  ('co-030','Kuehne & Nagel','KN/WH/RUH/5000SQM','Simon Reah','Proposal Sent',60,'RUH Tayba','wl-ruh-tayba','2026-07-01',2025000,1012500,0,5000,'Central','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',30,'data002b-20260511'),
  ('co-031','Kuehne & Nagel','KN/WH/RUH/150SQM','Simon Reah','Proposal Sent',60,'RUH Tayba','wl-ruh-tayba','2026-05-15',98046,65364,0,150,'Central','','warehouse','Pipeline Data Input.csv','Pipeline Data Input',31,'data002b-20260511'),
  ('co-032','Baxter','Baxter/WH/RUH/2500PP','Yazan Darwish','Proposal Sent',60,'Subcontractor','wl-subcontractor','2026-06-01',1000000,583333,2500,0,'Central','Source Exp CY mismatch (1.155M vs ACV/12 583K)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',32,'data002b-20260511'),
  ('co-033','Al Nahdi','AlNahdi/WH/RUH/2000PP','Simon Reah','Proposal Sent',60,'Subcontractor','wl-subcontractor','2026-05-01',800000,533333,2000,0,'Central','Source Exp CY mismatch','warehouse','Pipeline Data Input.csv','Pipeline Data Input',33,'data002b-20260511'),
  ('co-034','HMH','HMH/CL/DMM/Expansion','Yazan Darwish','Qualified',40,'Contract Logistics','wl-contract-log','2026-06-01',850000,495833,0,0,'East','Source Exp CY mismatch (661K vs ACV/12 496K)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',34,'data002b-20260511'),
  ('co-035','Saudi National Bank','SNB/AssetVerification','Hano Oberholzer','Proposal Sent',60,'Contract Logistics','wl-contract-log','2026-05-15',1975386,1316924,0,0,'West','Source Exp CY mismatch (2.258M vs ACV/12 1.317M)','warehouse','Pipeline Data Input.csv','Pipeline Data Input',35,'data002b-20260511')
ON CONFLICT (id) DO NOTHING;


-- ─── CLOSED WON DEALS (11 deals from Closed Won sheet) ───────
-- Source: Closed Won Data Input.csv — NOT the auto-pulled Pipeline rows

INSERT INTO closed_won_deals
  (id, account_name, warehouse_location, warehouse_location_id, owner, volume_pallets, volume_sqm, expected_revenue_cy, annual_contract_value, ops_go_live_date, stage, estimated_rate_per_pallet, source_file, source_sheet, source_row, import_batch_id)
VALUES
  ('cwd-001','SAUDI CARBONATE COMPANY','Dammam Port','wl-dmm-port','Yazan Darwish',300,0,91200,0,'2026-05-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',1,'data002b-20260511'),
  ('cwd-002','MEBCo (Clarios)','Dammam 2nd Ind -Tad WH','wl-dmm-2nd','Yazan Darwish',900,0,540000,648000,'2026-03-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',2,'data002b-20260511'),
  ('cwd-003','Rawabi Electric','Dammam 2nd Ind -Tad WH','wl-dmm-2nd','Yazan Darwish',440,0,211200,105600,'2026-01-27','Closed Won',0,'Closed Won Data Input.csv','Closed Won',3,'data002b-20260511'),
  ('cwd-004','Dorfketal','Dammam 2nd Ind -Tad WH','wl-dmm-2nd','Yazan Darwish',200,0,86400,78000,'2026-05-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',4,'data002b-20260511'),
  ('cwd-005','Rising Future','Dammam 2nd Ind -Tad WH','wl-dmm-2nd','Yazan Darwish',50,0,25000,30000,'2026-03-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',5,'data002b-20260511'),
  ('cwd-006','Maaden','Jubail 1','wl-jub-1','Yazan Darwish',1200,0,880000,960000,'2026-02-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',6,'data002b-20260511'),
  ('cwd-007','Al Nahdi','Jeddah Modon 3B','wl-jed-3b','Simon Reah',4000,0,756000,756000,'2026-04-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',7,'data002b-20260511'),
  ('cwd-008','Sharbatly Fruit Company','Jeddah Modon 3B','wl-jed-3b','Simon Reah',1500,0,513000,684000,'2026-04-15','Closed Won',0,'Closed Won Data Input.csv','Closed Won',8,'data002b-20260511'),
  ('cwd-009','PSA-BDP','Subcontractor','wl-subcontractor','Amin AlHalabi',2500,0,1650000,1800000,'2026-02-14','Closed Won',66,'Closed Won Data Input.csv','Closed Won',9,'data002b-20260511'),
  ('cwd-010','Tasnee','Contract Logistics','wl-contract-log','Yazan Darwish',0,0,1450000,725000,'2026-05-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',10,'data002b-20260511'),
  ('cwd-011','Arabian Trading Supplies','Transportation','wl-contract-log','Yazan Darwish',0,0,197500,197500,'2026-05-01','Closed Won',0,'Closed Won Data Input.csv','Closed Won',11,'data002b-20260511')
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- END PART 2 — Run after Part 1. Then run Part 3.
-- ════════════════════════════════════════════════════════════════
