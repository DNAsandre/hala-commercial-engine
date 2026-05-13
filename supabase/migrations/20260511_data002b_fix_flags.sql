-- DATA-002B-FIX: Opportunity Flags
-- Source: Pipeline Report Notes column
-- Import batch: data002b-fix-20260511

INSERT INTO commercial_opportunity_flags
  (id, opportunity_id, flag_type, severity, message, owner, status, source_note)
VALUES
  ('cof-007-acv','co-007','acv_mismatch','warning','Source Exp CY (113,750) vs ACV/12 implied (94,792)','Yazan Darwish','open','Transworld 250PP'),
  ('cof-009-acv','co-009','acv_mismatch','warning','Source Exp CY (35,000) vs ACV/12 implied (29,167)','Yazan Darwish','open','FMS Group'),
  ('cof-013-acv','co-013','acv_mismatch','warning','Source Exp CY (323,400) vs ACV/12 implied (80,850) — large delta','Yazan Darwish','open','S-Chem anomaly'),
  ('cof-014-acv','co-014','acv_mismatch','warning','Source Exp CY (154,000) vs ACV/12 implied (173,250)','Yazan Darwish','open','Saudi Pelican'),
  ('cof-018-acv','co-018','acv_mismatch','warning','Source Exp CY (1,080,000) vs ACV/12 implied (720,000)','Simon Reah','open','Al Nahdi JED3A'),
  ('cof-022-acv','co-022','acv_mismatch','critical','Source Exp CY (660,000) vs ACV/12 implied (2,200,000) — 3.3x delta','Hano Oberholzer','open','Tejoury major flag'),
  ('cof-028-acv','co-028','acv_mismatch','warning','Source Exp CY (339,000) vs ACV/12 implied (1,017,000)','Simon Reah','open','KN-Hample'),
  ('cof-032-acv','co-032','acv_mismatch','warning','Source Exp CY (1,155,000) vs ACV/12 implied (583,333)','Yazan Darwish','open','Baxter'),
  ('cof-033-acv','co-033','acv_mismatch','warning','Source Exp CY (800,000) vs ACV/12 implied (533,333)','Simon Reah','open','Al Nahdi Subcontractor'),
  ('cof-034-acv','co-034','acv_mismatch','warning','Source Exp CY (661,111) vs ACV/12 implied (495,833)','Yazan Darwish','open','HMH'),
  ('cof-035-acv','co-035','acv_mismatch','warning','Source Exp CY (2,257,584) vs ACV/12 implied (1,316,924)','Hano Oberholzer','open','SNB'),
  ('cof-004-dup','co-004','duplicate_customer','info','Transworld Saudi Logistics appears twice in pipeline (co-004 500PP + co-007 250PP)','Yazan Darwish','open','Verify if same or separate deals'),
  ('cof-007-dup','co-007','duplicate_customer','info','Transworld Saudi Logistics appears twice in pipeline (co-004 500PP + co-007 250PP)','Yazan Darwish','open','Verify if same or separate deals'),
  ('cof-028-multi','co-028','multiple_entries','info','Kuehne & Nagel has 3 pipeline entries (co-028 2500PP, co-030 5000SQM, co-031 150SQM)','Simon Reah','open','Separate opportunities for same customer'),
  ('cof-030-multi','co-030','multiple_entries','info','Kuehne & Nagel has 3 pipeline entries (co-028 2500PP, co-030 5000SQM, co-031 150SQM)','Simon Reah','open','Separate opportunities for same customer'),
  ('cof-031-multi','co-031','multiple_entries','info','Kuehne & Nagel has 3 pipeline entries (co-028 2500PP, co-030 5000SQM, co-031 150SQM)','Simon Reah','open','Separate opportunities for same customer'),
  ('cof-016-region','co-016','region_mismatch','warning','Tahakom listed in Jubail 2 but region tagged West — should be East','Yazan Darwish','open','Region label error in source'),
  ('cof-jed3b-cap','co-023','capacity_warning','critical','Jeddah Modon 3B has only 686 sellable but pipeline commits 4,950 pallets — 801% oversubscribed','Simon Reah','open','Capacity overflow: JED3B pipeline > sellable')
ON CONFLICT (id) DO NOTHING;
