-- ════════════════════════════════════════════════════════════════
-- SUPA-009 Phase 2: Tender & Commercial Governance Config Seed
-- Seeds existing tender_governance_config and commercial_governance_config
-- tables with reference data from inline mock arrays.
-- SAFE: ON CONFLICT DO NOTHING. Re-runnable.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- TENDER GOVERNANCE CONFIG
-- ────────────────────────────────────────────────────────────────

INSERT INTO tender_governance_config (id, config_key, config_value, category, description, is_active) VALUES
('tgc-tender_templates', 'tender_templates', '[
  {"id":"tt-1","name":"Single-Pack Logistics Tender","packModel":"single_pack","masterPack":false,"childPacks":[],"defaultRuntime":"Development Mock","notes":"Standard single-pack logistics tender."},
  {"id":"tt-2","name":"Multi-Pack Transport Tender","packModel":"multi_pack","masterPack":true,"childPacks":["Bulk Transportation Pack","PGP Transportation Pack"],"defaultRuntime":"Development Mock","notes":"Linde-style split-pack tender."},
  {"id":"tt-3","name":"Warehousing Tender","packModel":"single_pack","masterPack":false,"childPacks":[],"defaultRuntime":"Development Mock","notes":"Warehousing and storage services tender."},
  {"id":"tt-4","name":"Renewal Tender","packModel":"single_pack","masterPack":false,"childPacks":[],"defaultRuntime":"Development Mock","notes":"Contract renewal tender."},
  {"id":"tt-5","name":"Clarification Response Pack","packModel":"response_pack","masterPack":false,"childPacks":[],"defaultRuntime":"Development Mock","notes":"Post-submission clarification response."}
]'::JSONB, 'templates', 'Mock tender templates defining pack models', true),

('tgc-tender_gate_rules', 'tender_gate_rules', '[
  {"id":"gr-1","name":"All required placeholders populated","doctrine":true,"local":"Marker","preview":"Warning","staging":"Soft Simulation","production":"Configurable Enforcement","override":true,"approver":"Tender Owner"},
  {"id":"gr-2","name":"OBK signed/stamped and native Excel ready","doctrine":true,"local":"Marker","preview":"Warning","staging":"Soft Simulation","production":"Production Enforcement Future","override":false,"approver":"Commercial Director"},
  {"id":"gr-3","name":"Bid Statement signed/stamped","doctrine":true,"local":"Tooltip","preview":"Warning","staging":"Soft Simulation","production":"Configurable Enforcement","override":true,"approver":"Commercial Director"},
  {"id":"gr-4","name":"Transition Plan populated and reviewed","doctrine":false,"local":"Marker","preview":"Warning","staging":"Soft Simulation","production":"Configurable Enforcement","override":true,"approver":"Operations Reviewer"},
  {"id":"gr-5","name":"Compliance Pack collated","doctrine":true,"local":"Marker","preview":"Warning","staging":"Soft Simulation","production":"Production Enforcement Future","override":false,"approver":"Document Controller"},
  {"id":"gr-6","name":"Internal master pack not externally submitted","doctrine":true,"local":"Tooltip","preview":"Warning","staging":"Soft Simulation","production":"Production Enforcement Future","override":false,"approver":"System"},
  {"id":"gr-7","name":"Separate Bulk and PGP email threads required","doctrine":true,"local":"Marker","preview":"Warning","staging":"Soft Simulation","production":"Production Enforcement Future","override":false,"approver":"Tender Owner"}
]'::JSONB, 'gate_rules', 'Mock gate rule configuration per environment', true),

('tgc-tender_compliance_categories', 'tender_compliance_categories', '["Scope","Vehicle Specifications","Driver Requirements","Safety / HSE","ADR / GDP","Management Standards","Insurance","KPI / PL Consequences","Pricing / OBK","Bid Validity","Performance Guarantee","Transition","Continuous Improvement","Legal Terms","Submission Format"]'::JSONB, 'compliance', 'Tender compliance categories', true),

('tgc-tender_role_matrix', 'tender_role_matrix', '[
  {"role":"Commercial Director","review":true,"mockApprove":true,"futureOverride":true,"secondApproval":false,"notes":"Final tender approval authority"},
  {"role":"Tender Owner","review":true,"mockApprove":true,"futureOverride":true,"secondApproval":true,"notes":"Day-to-day tender execution lead"},
  {"role":"Sales Owner","review":true,"mockApprove":false,"futureOverride":false,"secondApproval":false,"notes":"Customer relationship, pricing input"},
  {"role":"Document Controller","review":true,"mockApprove":true,"futureOverride":false,"secondApproval":false,"notes":"Document completeness and format"},
  {"role":"Finance Reviewer","review":true,"mockApprove":true,"futureOverride":false,"secondApproval":true,"notes":"OBK pricing, bank guarantees"},
  {"role":"Legal Reviewer","review":true,"mockApprove":true,"futureOverride":false,"secondApproval":true,"notes":"Contract terms, MSA review"},
  {"role":"Operations Reviewer","review":true,"mockApprove":true,"futureOverride":false,"secondApproval":false,"notes":"Transition plan, capacity"},
  {"role":"HSE Reviewer","review":true,"mockApprove":true,"futureOverride":false,"secondApproval":false,"notes":"LTIFR, safety compliance"},
  {"role":"Admin","review":true,"mockApprove":false,"futureOverride":false,"secondApproval":false,"notes":"System configuration only"}
]'::JSONB, 'roles', 'Tender role matrix', true)

ON CONFLICT (config_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- COMMERCIAL GOVERNANCE CONFIG
-- ────────────────────────────────────────────────────────────────

INSERT INTO commercial_governance_config (id, config_key, config_value, category, description, is_active) VALUES
('cgc-commercial_margin_authority', 'commercial_margin_authority', '[
  {"band":"GP >= 22%","authority":"Regional / Local Authority","severity":"green","roles":["Salesman","Regional Sales Head"],"escalation":"No escalation needed"},
  {"band":"GP < 22%","authority":"Commercial / Ops Review","severity":"amber","roles":["Commercial Director","Ops Manager"],"escalation":"Future review required"},
  {"band":"GP < 13%","authority":"Director / Finance Escalation","severity":"orange","roles":["Director Ops","Director Commercial","Finance"],"escalation":"Future director approval required"},
  {"band":"GP < 10%","authority":"CEO / CFO Escalation","severity":"red","roles":["CEO","CFO"],"escalation":"Future executive approval required"}
]'::JSONB, 'margin', 'GP% margin authority bands', true),

('cgc-commercial_ecr_rules', 'commercial_ecr_rules', '[
  {"dimension":"Financial Strength","weight":"25%","inputs":"DSO, payment history, credit exposure","gradeImpact":"DSO > 60d -> C or below"},
  {"dimension":"Operational Behavior","weight":"25%","inputs":"Demand patterns, planning maturity","gradeImpact":"Reactive demand -> C or below"},
  {"dimension":"Strategic Fit","weight":"25%","inputs":"Sector alignment, corridor value","gradeImpact":"Strategic sector -> B or above"},
  {"dimension":"Commercial Fit","weight":"25%","inputs":"Margin potential, capacity fit","gradeImpact":"Low margin + constrained -> C"}
]'::JSONB, 'ecr', 'ECR dimension rules', true),

('cgc-commercial_pricing_postures', 'commercial_pricing_postures', '[
  {"posture":"Premium","desc":"Strong margin, strategic value, customer willing to pay"},
  {"posture":"Balanced","desc":"Near threshold, protect price, confirm ops capacity"},
  {"posture":"Aggressive","desc":"Entry pricing to win volume — margin risk flagged"},
  {"posture":"Reprice","desc":"Current pricing unacceptable — must reprice before proposal"},
  {"posture":"Walk Away","desc":"Risk outweighs return — consider exit"}
]'::JSONB, 'posture', 'Pricing posture definitions', true),

('cgc-commercial_role_matrix', 'commercial_role_matrix', '[
  {"role":"Commercial Director","canReview":true,"mockApprove":true,"futureOverride":true,"notes":"GP < 22% approval authority."},
  {"role":"Regional Manager","canReview":true,"mockApprove":true,"futureOverride":false,"notes":"GP >= 22% local authority."},
  {"role":"Sales Owner","canReview":true,"mockApprove":false,"futureOverride":false,"notes":"Quote creation, proposal drafting."},
  {"role":"Finance Reviewer","canReview":true,"mockApprove":true,"futureOverride":false,"notes":"P&L review, cost base validation."},
  {"role":"Operations Reviewer","canReview":true,"mockApprove":true,"futureOverride":false,"notes":"Capacity fit, SLA ops review."},
  {"role":"Legal Reviewer","canReview":true,"mockApprove":true,"futureOverride":false,"notes":"SLA legal review, contract terms."},
  {"role":"Admin","canReview":true,"mockApprove":false,"futureOverride":false,"notes":"System configuration only."}
]'::JSONB, 'roles', 'Commercial role matrix', true)

ON CONFLICT (config_key) DO NOTHING;
