-- ════════════════════════════════════════════════════════════════
-- SUPA-006B: Tender MVP Parity Seed — Missing Tables
-- Run: 2026-05-07
-- Author: Antigravity / Hala Commercial Engine
--
-- Seeds the remaining Tender MVP tables that were NOT included in
-- SUPA-006 linde seed (which only covered tenders, packs, sections,
-- placeholders, gates, activity, audit).
--
-- This file ONLY inserts data. No schema changes.
-- Re-runnable: uses ON CONFLICT (id) DO NOTHING for additive safety.
-- ════════════════════════════════════════════════════════════════

-- ─── REQUIRED DOCUMENTS (22 records) ─────────────────────────

INSERT INTO tender_required_documents (id,pack_id,document_name,category,owner,status,native_required,signed_pdf_required,stamp_required,native_status,signed_pdf_status,evidence_status,version,included_in_output,would_block_in_production,last_updated,notes) VALUES
('rd-01','tp-linde-master','Internal Master Working DOCX','final_output','Amin Al-Halabi','draft',true,false,false,'uploaded_mock','not_required','not_required',3,false,false,'2026-04-28','Internal working document — not submitted externally.'),
('rd-02','tp-linde-bulk','Bulk Final Tender Pack PDF','final_output','Amin Al-Halabi','awaiting',true,true,true,'missing','missing','missing',0,true,true,'2026-04-28','Final compiled PDF for Bulk submission. Cannot be generated until all sections approved.'),
('rd-03','tp-linde-bulk','Bulk OBK Native Excel','pricing_obk','Amin Al-Halabi','in_review',true,false,false,'uploaded_mock','not_required','uploaded_mock',2,true,true,'2026-04-27','Native Excel required for commercial evaluation. OBK Control artifact.'),
('rd-04','tp-linde-bulk','Bulk OBK Signed/Stamped PDF','pricing_obk','Amin Al-Halabi','awaiting',false,true,true,'not_required','missing','missing',0,true,true,'2026-04-25','Signed and stamped by authorized signatory. Native Excel + signed/stamped PDF required for production submission.'),
('rd-05','tp-linde-bulk','Bulk Bid Statement Signed/Stamped PDF','bid_statement','Amin Al-Halabi','awaiting',false,true,true,'not_required','missing','missing',0,true,true,'2026-04-20','Must be signed and stamped by authorized signatory.'),
('rd-06','tp-linde-bulk','Bulk Transition Plan','transition','Ra''ed','draft',true,false,false,'uploaded_mock','not_required','not_required',1,true,true,'2026-04-26',''),
('rd-07','tp-linde-bulk','Bulk Continuous Improvement Proposal Form','continuous_improvement','Ra''ed','draft',true,false,false,'uploaded_mock','not_required','not_required',1,true,false,'2026-04-26',''),
('rd-08','tp-linde-bulk','Bulk Compliance Pack','compliance_pack','Ra''ed','awaiting',true,false,false,'missing','not_required','missing',0,true,true,'2026-04-15','Aggregated compliance evidence bundle.'),
('rd-09','tp-linde-pgp','PGP Final Tender Pack PDF','final_output','Amin Al-Halabi','awaiting',true,true,true,'missing','missing','missing',0,true,true,'2026-04-28','Final compiled PDF for PGP submission.'),
('rd-10','tp-linde-pgp','PGP OBK Native Excel','pricing_obk','Amin Al-Halabi','draft',true,false,false,'uploaded_mock','not_required','uploaded_mock',1,true,true,'2026-04-26','OBK Control artifact — native Excel for PGP pricing.'),
('rd-11','tp-linde-pgp','PGP OBK Signed/Stamped PDF','pricing_obk','Amin Al-Halabi','awaiting',false,true,true,'not_required','missing','missing',0,true,true,'2026-04-20','Native Excel + signed/stamped PDF required for production submission.'),
('rd-12','tp-linde-pgp','PGP Bid Statement Signed/Stamped PDF','bid_statement','Amin Al-Halabi','awaiting',false,true,true,'not_required','missing','missing',0,true,true,'2026-04-18','Must be signed and stamped by authorized signatory.'),
('rd-13','tp-linde-pgp','PGP Transition Plan','transition','Ra''ed','in_review',true,false,false,'uploaded_mock','not_required','not_required',1,true,true,'2026-04-27',''),
('rd-14','tp-linde-pgp','PGP Continuous Improvement Proposal Form','continuous_improvement','Ra''ed','draft',true,false,false,'uploaded_mock','not_required','not_required',1,true,false,'2026-04-25',''),
('rd-15','tp-linde-pgp','PGP Compliance Pack','compliance_pack','Ra''ed','awaiting',true,false,false,'missing','not_required','missing',0,true,true,'2026-04-10',''),
('rd-16','tp-linde-bulk','Commercial Registration Certificate','legal_registration','Amin Al-Halabi','ready',false,true,false,'not_required','ready_mock','ready_mock',1,true,true,'2026-04-20','Shared across Bulk + PGP packs.'),
('rd-17','tp-linde-bulk','VAT Certificate','legal_registration','Amin Al-Halabi','ready',false,true,false,'not_required','ready_mock','ready_mock',1,true,true,'2026-04-20','ZATCA certificate.'),
('rd-18','tp-linde-bulk','ISO 9001 / 14001 / 45001 Certificates','certification','Ra''ed','in_review',false,true,false,'not_required','uploaded_mock','uploaded_mock',1,true,true,'2026-04-27','Bundle of 3 ISO certificates. Expiry dates must be verified.'),
('rd-19','tp-linde-bulk','Insurance Certificates','insurance','Ra''ed','approved',false,true,false,'not_required','ready_mock','ready_mock',1,true,true,'2026-04-22','Motor + cargo + liability insurance bundle.'),
('rd-20','tp-linde-bulk','ADR Class 2 Certifications','hse','Ra''ed','approved',false,true,false,'not_required','ready_mock','ready_mock',1,true,true,'2026-04-22','ADR dangerous goods transport certification for cryogenic tankers.'),
('rd-21','tp-linde-bulk','Reference Credentials','fleet_operations','Amin Al-Halabi','ready',true,false,false,'ready_mock','not_required','ready_mock',1,true,true,'2026-04-22','SABIC + Aramco reference letters and contracts.'),
('rd-22','tp-linde-pgp','Performance Guarantee Confirmation','pricing_obk','Amin Al-Halabi','awaiting',true,true,true,'missing','missing','missing',0,true,true,'2026-04-15','Finance must confirm performance bond structure before submission.')
ON CONFLICT (id) DO NOTHING;

-- ─── COMPLIANCE ITEMS (22 records) ────────────────────────────

INSERT INTO tender_compliance_items (id,pack_id,category,requirement,status,response,evidence,owner,risk_level,legal_review_required,commercial_impact,operational_impact,clarification_needed,would_block_in_production,last_updated,notes,reference) VALUES
('ci-01','tp-linde-bulk','scope','Scope: cryogenic gases and gaseous hydrogen distribution across KSA','compliant','Compliant','Attached Mock','Amin Al-Halabi','low',false,'Core scope — full alignment required','Fleet must cover cryogenic + gaseous',false,true,'2026-04-25','','RFQ-3.1'),
('ci-02','tp-linde-bulk','scope','Two-hub model: Dammam primary, Jeddah secondary','compliant','Compliant','Attached Mock','Ra''ed','low',false,'Hub costs included in pricing','Operations team confirmed hub availability',false,false,'2026-04-25','','RFQ-3.2'),
('ci-03','tp-linde-bulk','vehicle_specifications','18 x 4x2 tractors provided for cryogenic trailer operation','partial','Partial — 14 available, 4 on order','Pending','Ra''ed','medium',false,'Fleet CAPEX may require adjustment','14 available, 4 on order — delivery Q3 2026',false,true,'2026-04-27','4 tractors on order, expected delivery before contract start.','RFQ-4.1'),
('ci-04','tp-linde-bulk','vehicle_specifications','4 x 6x4 rigid tankers provided for gaseous deliveries','partial','Partial — 2 available, 2 under procurement','Pending','Ra''ed','medium',false,'Rigid tanker spec requires OEM confirmation','2 available, 2 under procurement',false,true,'2026-04-27','','RFQ-4.2'),
('ci-05','tp-linde-bulk','adr_gdp','ADR Class 2 driver discipline and training compliance','compliant','Compliant','Attached Mock','Ra''ed','low',false,'None','All assigned drivers ADR certified',false,true,'2026-04-22','','RFQ-5.1'),
('ci-06','tp-linde-bulk','legal_terms','Linde-owned cryogenic trailer maintenance boundary acknowledged','clarification_required','Clarification Required','Client Clarification Needed','Amin Al-Halabi','high',true,'Maintenance cost boundary affects margin','Need to confirm which maintenance items fall on Hala vs Linde',true,true,'2026-04-28','Formal clarification submitted to Linde procurement. Awaiting response.','RFQ-6.1'),
('ci-07','tp-linde-bulk','kpi_pl_consequences','Schedule 5 KPI regime acknowledged and accepted','compliant','Compliant','Attached Mock','Amin Al-Halabi','medium',false,'KPI penalties capped at 5% monthly invoice','Operations must track OTIF, safety, fleet availability',false,false,'2026-04-25','','RFQ-7.1'),
('ci-08','tp-linde-bulk','kpi_pl_consequences','Schedule 6 PL consequences acknowledged','partial','Partial — legal review in progress','Pending','Amin Al-Halabi','high',true,'Uncapped liability clause requires legal review','Insurance coverage must align',false,true,'2026-04-28','Legal team reviewing liability cap position.','RFQ-7.2'),
('ci-09','tp-linde-bulk','pricing_obk','OBK pricing file completed and submitted','non_compliant','Non-Compliant — in review','Required','Amin Al-Halabi','critical',false,'Cannot submit without completed OBK','None',false,true,'2026-04-28','OBK native Excel in review but signed/stamped version not yet available.','RFQ-8.1'),
('ci-10','tp-linde-bulk','bid_validity','180-day bid validity period acknowledged','compliant','Compliant','Attached Mock','Amin Al-Halabi','low',false,'Pricing locked for 180 days','None',false,false,'2026-04-20','','RFQ-9.1'),
('ci-11','tp-linde-bulk','performance_guarantee','10% performance guarantee bond provided','clarification_required','Clarification Required','Client Clarification Needed','Amin Al-Halabi','high',true,'Bond cost impacts margin by ~0.3%','None',true,true,'2026-04-28','Finance confirming bond structure with bank.','RFQ-10.1'),
('ci-12','tp-linde-pgp','scope','Multi-city packaged-gas distribution scope acknowledged','compliant','Compliant','Attached Mock','Amin Al-Halabi','low',false,'PGP pricing covers all listed cities','Route planning confirmed',false,false,'2026-04-25','','RFQ-3.3'),
('ci-13','tp-linde-pgp','vehicle_specifications','PGP vehicle / helper model reviewed and accepted','compliant','Compliant','Attached Mock','Ra''ed','low',false,'Helper costs included','Vehicle + helper model confirmed',false,false,'2026-04-25','','RFQ-4.3'),
('ci-14','tp-linde-pgp','adr_gdp','PGP GDP / safety handling requirements reviewed','partial','Partial — GDP SOP under development','Pending','Ra''ed','medium',false,'GDP training costs not yet budgeted','GDP training program under development',false,false,'2026-04-27','GDP handling SOP being drafted.','RFQ-5.2'),
('ci-15','tp-linde-pgp','transition','PGP transition approach documented','not_reviewed','Not Reviewed','Not Required','Ra''ed','medium',false,'Transition mobilization costs','60-day transition window required',false,true,'2026-04-15','','RFQ-11.1'),
('ci-16','tp-linde-pgp','continuous_improvement','PGP continuous improvement proposal required','not_reviewed','Not Reviewed','Not Required','Ra''ed','low',false,'None','CI plan needed',false,false,'2026-04-15','','RFQ-12.1'),
('ci-17','tp-linde-bulk','insurance','Insurance certificates covering motor, cargo, and liability','compliant','Compliant','Attached Mock','Ra''ed','low',false,'Premium included in overhead','None',false,true,'2026-04-22','','RFQ-13.1'),
('ci-18','tp-linde-bulk','management_standards','Commercial Registration valid and matching entity','compliant','Compliant','Attached Mock','Amin Al-Halabi','low',false,'None','None',false,true,'2026-04-20','','RFQ-13.2'),
('ci-19','tp-linde-bulk','management_standards','ISO 9001 / 14001 / 45001 certificates current','clarification_required','Clarification Required','Client Clarification Needed','Ra''ed','medium',false,'None','ISO 45001 certificate expiry needs confirmation',true,true,'2026-04-27','ISO 45001 expiry date unclear — BSI confirmation requested.','RFQ-13.3'),
('ci-20','tp-linde-master','submission_format','Separate submission emails for Bulk and PGP packs','non_compliant','Non-Compliant','Required','Amin Al-Halabi','critical',false,'Incorrect submission format = disqualification risk','None',false,true,'2026-04-28','Submission process not yet configured for split-pack email delivery.','RFQ-14.1'),
('ci-21','tp-linde-master','submission_format','Internal master pack must NOT be submitted externally','accepted_risk_mock','Accepted Risk (Mock)','Not Required','Amin Al-Halabi','low',false,'None','None',false,false,'2026-04-20','Master pack flagged as internal-only in pack config.','RFQ-14.2'),
('ci-22','tp-linde-master','submission_format','Cross-pack references must be removed before submission','not_reviewed','Not Reviewed','Not Required','Ra''ed','medium',false,'None','QA review required before final output',false,true,'2026-04-15','','RFQ-14.3')
ON CONFLICT (id) DO NOTHING;

-- ─── SPLIT CHECKS (12 records for Internal Master → Bulk) ──────

INSERT INTO tender_split_checks (id,tender_workspace_id,source_pack_id,target_pack_id,check_name,category,status,severity,would_block_in_production,notes) VALUES
('sc-01','tn-linde-001','tp-linde-master','tp-linde-bulk','Remove PGP content from Bulk output','cross_references','would_block','critical',true,'All PGP-specific sections, pricing, and references must be stripped from the Bulk output pack.'),
('sc-02','tn-linde-001','tp-linde-master','tp-linde-bulk','Remove internal notes and draft comments','internal_notes','would_block','high',true,'All internal notes, working comments, and draft markers must be removed from the external output.'),
('sc-03','tn-linde-001','tp-linde-master','tp-linde-bulk','Remove internal watermark from output','output_format','pass','medium',false,'Internal-only watermark must be replaced with client-facing formatting.'),
('sc-04','tn-linde-001','tp-linde-master','tp-linde-bulk','Check cross-references to wrong pack','cross_references','warning','high',true,'Output must not reference PGP pack content, pricing, or section numbers.'),
('sc-05','tn-linde-001','tp-linde-master','tp-linde-bulk','Check Bulk placeholders completed','placeholders','would_block','critical',true,'All submission-critical placeholders for the Bulk pack must have values.'),
('sc-06','tn-linde-001','tp-linde-master','tp-linde-bulk','Check Bulk required documents ready','required_documents','would_block','high',true,'All required documents for the Bulk submission must be uploaded and approved.'),
('sc-07','tn-linde-001','tp-linde-master','tp-linde-bulk','Check compliance gaps resolved','compliance','warning','medium',false,'Non-compliant and clarification-required items must be resolved before production output.'),
('sc-08','tn-linde-001','tp-linde-master','tp-linde-bulk','Check submission gates passed','submission_gates','would_block','high',true,'All critical submission gates must pass before production output generation.'),
('sc-09','tn-linde-001','tp-linde-master','tp-linde-bulk','Check Bulk external submittable flag','submittable_flag','pass','medium',false,'The Bulk pack must be flagged as externally submittable.'),
('sc-10','tn-linde-001','tp-linde-master','tp-linde-bulk','Check final output naming convention','output_format','pass','low',false,'Output file must follow the required naming convention for client submission.'),
('sc-11','tn-linde-001','tp-linde-master','tp-linde-bulk','Check final read-through complete','final_review','not_checked','medium',true,'A human read-through confirmation is required before production output.'),
('sc-12','tn-linde-001','tp-linde-master','tp-linde-bulk','Apply TEST OUTPUT watermark for development','output_format','pass','low',false,'In development mode, all outputs are watermarked TEST OUTPUT — NOT FOR CLIENT SUBMISSION.')
ON CONFLICT (id) DO NOTHING;

-- ─── SPLIT CHECKS (12 records for Internal Master → PGP) ──────

INSERT INTO tender_split_checks (id,tender_workspace_id,source_pack_id,target_pack_id,check_name,category,status,severity,would_block_in_production,notes) VALUES
('sc-pgp-01','tn-linde-001','tp-linde-master','tp-linde-pgp','Remove Bulk content from PGP output','cross_references','would_block','critical',true,'All Bulk-specific sections, pricing, and references must be stripped from the PGP output pack.'),
('sc-pgp-02','tn-linde-001','tp-linde-master','tp-linde-pgp','Remove internal notes and draft comments','internal_notes','would_block','high',true,'All internal notes, working comments, and draft markers must be removed from the external output.'),
('sc-pgp-03','tn-linde-001','tp-linde-master','tp-linde-pgp','Remove internal watermark from output','output_format','pass','medium',false,'Internal-only watermark must be replaced with client-facing formatting.'),
('sc-pgp-04','tn-linde-001','tp-linde-master','tp-linde-pgp','Check cross-references to wrong pack','cross_references','warning','high',true,'Output must not reference Bulk pack content, pricing, or section numbers.'),
('sc-pgp-05','tn-linde-001','tp-linde-master','tp-linde-pgp','Check PGP placeholders completed','placeholders','would_block','critical',true,'All submission-critical placeholders for the PGP pack must have values.'),
('sc-pgp-06','tn-linde-001','tp-linde-master','tp-linde-pgp','Check PGP required documents ready','required_documents','would_block','high',true,'All required documents for the PGP submission must be uploaded and approved.'),
('sc-pgp-07','tn-linde-001','tp-linde-master','tp-linde-pgp','Check compliance gaps resolved','compliance','warning','medium',false,'Non-compliant and clarification-required items must be resolved before production output.'),
('sc-pgp-08','tn-linde-001','tp-linde-master','tp-linde-pgp','Check submission gates passed','submission_gates','would_block','high',true,'All critical submission gates must pass before production output generation.'),
('sc-pgp-09','tn-linde-001','tp-linde-master','tp-linde-pgp','Check PGP external submittable flag','submittable_flag','pass','medium',false,'The PGP pack must be flagged as externally submittable.'),
('sc-pgp-10','tn-linde-001','tp-linde-master','tp-linde-pgp','Check final output naming convention','output_format','pass','low',false,'Output file must follow the required naming convention for client submission.'),
('sc-pgp-11','tn-linde-001','tp-linde-master','tp-linde-pgp','Check final read-through complete','final_review','not_checked','medium',true,'A human read-through confirmation is required before production output.'),
('sc-pgp-12','tn-linde-001','tp-linde-master','tp-linde-pgp','Apply TEST OUTPUT watermark for development','output_format','pass','low',false,'In development mode, all outputs are watermarked TEST OUTPUT — NOT FOR CLIENT SUBMISSION.')
ON CONFLICT (id) DO NOTHING;

-- ─── PACK OUTPUTS (test output records) ───────────────────────

INSERT INTO tender_pack_outputs (id,tender_workspace_id,tender_pack_id,source_pack_id,output_name,pack_name,output_type,format,version,status,generated_by,watermark,is_test_output,would_be_submittable_in_production,mock_warnings_count,notes) VALUES
('out-001','tn-linde-001','tp-linde-bulk','tp-linde-master','Bulk Tender Pack — TEST OUTPUT','Bulk Transportation Pack','split_output','PDF','v1','generated_with_warnings','Amin Al-Halabi','TEST OUTPUT — NOT FOR CLIENT SUBMISSION',true,false,5,'Test output from split check run 2026-04-29. 5 checks would block production.')
ON CONFLICT (id) DO NOTHING;

-- ─── SUBMISSION EMAILS ─────────────────────────────────────────

INSERT INTO tender_submission_emails (id,tender_workspace_id,tender_pack_id,pack_name,email_type,to_address,cc_external,cc_internal,subject,status,simulated,warnings_count,notes) VALUES
('em-001','tn-linde-001','tp-linde-bulk','Bulk Transportation Pack','bulk_submission','sulman.ahmed@example-client.com','','amin@hala.example, tenders@hala.example','Linde SIGAS Bulk Transportation Tender — Hala Submission','draft_mock',true,2,'Draft email — 2 required attachments missing.'),
('em-002','tn-linde-001','tp-linde-pgp','PGP Transportation Pack','pgp_submission','sulman.ahmed@example-client.com','','amin@hala.example, tenders@hala.example','Linde SIGAS PGP Transportation Tender — Hala Submission','draft_mock',true,2,'Draft email — 2 required attachments missing.'),
('em-003','tn-linde-001',NULL,'Test Bundle (Combined)','test_bundle','sulman.ahmed@example-client.com','','amin@hala.example, tenders@hala.example','Linde SIGAS Transportation Tender — Hala Combined Submission (MOCK)','would_fail_production',true,4,'Mock Warning: Bulk and PGP should be submitted as separate email threads in production. This combined scenario is for mock testing only.')
ON CONFLICT (id) DO NOTHING;

-- ─── SUBMISSION EMAIL ATTACHMENTS ────────────────────────────

INSERT INTO tender_submission_email_attachments (id,email_id,file_name,document_type,format,required,included,status,size_mb,notes) VALUES
('at-001','em-001','Bulk Final Tender Pack.pdf','Final Output','PDF',true,true,'ready_mock',4.2,''),
('at-002','em-001','Bulk OBK Native.xlsx','Pricing / OBK','Excel',true,true,'ready_mock',1.8,''),
('at-003','em-001','Bulk OBK Signed Stamped.pdf','Pricing / OBK','PDF',true,false,'missing',0,'Signed/stamped PDF not yet available'),
('at-004','em-001','Bulk Bid Statement Signed.pdf','Bid Statement','PDF',true,false,'missing',0,'Signed/stamped copy pending'),
('at-005','em-001','Bulk Transition Plan.pdf','Transition','PDF',true,true,'warning',2.1,'Draft version — not final'),
('at-006','em-001','Bulk Compliance Pack.pdf','Compliance','PDF',true,true,'ready_mock',3.5,''),
('at-007','em-002','PGP Final Tender Pack.pdf','Final Output','PDF',true,true,'ready_mock',3.1,''),
('at-008','em-002','PGP OBK Native.xlsx','Pricing / OBK','Excel',true,true,'ready_mock',1.2,''),
('at-009','em-002','PGP OBK Signed Stamped.pdf','Pricing / OBK','PDF',true,false,'missing',0,'Signed/stamped PDF not yet available'),
('at-010','em-002','PGP Bid Statement Signed.pdf','Bid Statement','PDF',true,false,'missing',0,'Signed/stamped copy pending'),
('at-011','em-002','PGP Transition Plan.pdf','Transition','PDF',true,true,'ready_mock',1.4,''),
('at-012','em-002','PGP Compliance Pack.pdf','Compliance','PDF',true,true,'ready_mock',2.8,''),
('at-013','em-003','Bulk Final Tender Pack.pdf','Final Output','PDF',true,false,'missing',0,'Missing from combined bundle — separate thread required'),
('at-014','em-003','Bulk OBK Native.xlsx','Pricing / OBK','Excel',true,false,'missing',0,'Missing from combined bundle — separate thread required'),
('at-015','em-003','Bulk OBK Signed Stamped.pdf','Pricing / OBK','PDF',true,false,'missing',0,'Missing from combined bundle'),
('at-016','em-003','Bulk Bid Statement Signed.pdf','Bid Statement','PDF',true,false,'missing',0,'Missing from combined bundle'),
('at-017','em-003','PGP Final Tender Pack.pdf','Final Output','PDF',true,false,'missing',0,'Missing from combined bundle — separate thread required'),
('at-018','em-003','PGP OBK Native.xlsx','Pricing / OBK','Excel',true,false,'missing',0,'Missing from combined bundle — separate thread required'),
('at-019','em-003','PGP OBK Signed Stamped.pdf','Pricing / OBK','PDF',true,false,'missing',0,'Missing from combined bundle'),
('at-020','em-003','PGP Bid Statement Signed.pdf','Bid Statement','PDF',true,false,'missing',0,'Missing from combined bundle')
ON CONFLICT (id) DO NOTHING;