-- =========================================================
-- LEGACY TENDER SLOP QUARANTINE - ARCHIVE-FIRST PASS
-- Date: 2026-05-21
--
-- Purpose:
--   Copy verified legacy/mock/slop records into a quarantine table before
--   any destructive cleanup is approved.
--
-- Human rule:
--   Run manually in Supabase SQL Editor only.
--
-- Doctrine:
--   - This does NOT promote any legacy data to truth.
--   - This does NOT delete operational rows.
--   - This isolates evidence first so deletion can be reviewed.
--   - commercial_tickets remains the canonical intake parent.
--
-- Batch:
--   legacy_tender_slop_20260521
-- =========================================================

CREATE TABLE IF NOT EXISTS legacy_data_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quarantine_batch text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  parent_key text,
  quarantine_reason text NOT NULL,
  row_data jsonb NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT now(),
  quarantined_by text DEFAULT current_user
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ldq_batch_source_pk
  ON legacy_data_quarantine(quarantine_batch, source_table, source_pk);

-- ---------------------------------------------------------
-- 1. Legacy tender master rows proven to be seeded/demo/mock.
-- ---------------------------------------------------------

WITH contaminated_tenders(id) AS (
  VALUES
    ('tn-linde-001'),
    ('tn-001'),
    ('tn-002'),
    ('tn-003'),
    ('tn-004'),
    ('tn-005'),
    ('tn-006'),
    ('tn-007'),
    ('tn-008')
)
INSERT INTO legacy_data_quarantine (
  quarantine_batch,
  source_table,
  source_pk,
  parent_key,
  quarantine_reason,
  row_data
)
SELECT
  'legacy_tender_slop_20260521',
  'tenders',
  t.id::text,
  t.id::text,
  'Legacy tender row seeded without acceptable lineage; do not use as canonical truth.',
  to_jsonb(t)
FROM tenders t
JOIN contaminated_tenders c ON c.id = t.id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

-- ---------------------------------------------------------
-- 2. Tender workspace child rows attached to contaminated IDs.
-- ---------------------------------------------------------

WITH contaminated_tenders(id) AS (
  VALUES ('tn-linde-001'), ('tn-001'), ('tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_packs',
  p.id::text,
  p.tender_workspace_id::text,
  'Legacy tender pack seeded from obsolete/mock workspace.',
  to_jsonb(p)
FROM tender_packs p
JOIN contaminated_tenders c ON c.id = p.tender_workspace_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_packs AS (
  SELECT id FROM tender_packs WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_pack_sections',
  s.id::text,
  s.pack_id::text,
  'Legacy tender pack section seeded from obsolete/mock workspace.',
  to_jsonb(s)
FROM tender_pack_sections s
JOIN contaminated_packs p ON p.id = s.pack_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_packs AS (
  SELECT id FROM tender_packs WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_placeholders',
  ph.id::text,
  ph.pack_id::text,
  'Legacy tender placeholder seeded from obsolete/mock workspace.',
  to_jsonb(ph)
FROM tender_placeholders ph
JOIN contaminated_packs p ON p.id = ph.pack_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_packs AS (
  SELECT id FROM tender_packs WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_required_documents',
  d.id::text,
  d.pack_id::text,
  'Legacy tender required-document row seeded from obsolete/mock workspace.',
  to_jsonb(d)
FROM tender_required_documents d
JOIN contaminated_packs p ON p.id = d.pack_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_packs AS (
  SELECT id FROM tender_packs WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_compliance_items',
  ci.id::text,
  ci.pack_id::text,
  'Legacy tender compliance row seeded from obsolete/mock workspace.',
  to_jsonb(ci)
FROM tender_compliance_items ci
JOIN contaminated_packs p ON p.id = ci.pack_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_packs AS (
  SELECT id FROM tender_packs WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_submission_gates',
  g.id::text,
  COALESCE(g.tender_workspace_id, g.tender_workspace_id_col, g.pack_id)::text,
  'Legacy tender gate seeded from obsolete/mock workspace.',
  to_jsonb(g)
FROM tender_submission_gates g
LEFT JOIN contaminated_packs p ON p.id = g.pack_id
WHERE p.id IS NOT NULL
   OR COALESCE(g.tender_workspace_id, g.tender_workspace_id_col) IN ('tn-linde-001', 'tn-001', 'tn-002')
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_activity_events',
  a.id::text,
  a.workspace_id::text,
  'Legacy tender activity event seeded from obsolete/mock workspace.',
  to_jsonb(a)
FROM tender_activity_events a
WHERE a.workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_audit_events',
  a.id::text,
  a.workspace_id::text,
  'Legacy tender audit event seeded from obsolete/mock workspace.',
  to_jsonb(a)
FROM tender_audit_events a
WHERE a.workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_split_checks',
  sc.id::text,
  sc.tender_workspace_id::text,
  'Legacy split-check row seeded from obsolete/mock workspace.',
  to_jsonb(sc)
FROM tender_split_checks sc
WHERE sc.tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_pack_outputs',
  po.id::text,
  po.tender_workspace_id::text,
  'Legacy/test tender output row seeded from obsolete/mock workspace.',
  to_jsonb(po)
FROM tender_pack_outputs po
WHERE po.tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_submission_emails',
  se.id::text,
  se.tender_workspace_id::text,
  'Legacy/test tender submission email seeded from obsolete/mock workspace.',
  to_jsonb(se)
FROM tender_submission_emails se
WHERE se.tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_emails AS (
  SELECT id FROM tender_submission_emails
  WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_submission_email_attachments',
  att.id::text,
  att.email_id::text,
  'Legacy/test tender submission attachment seeded from obsolete/mock workspace.',
  to_jsonb(att)
FROM tender_submission_email_attachments att
JOIN contaminated_emails e ON e.id = att.email_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'tender_customer_links',
  l.id::text,
  l.tender_workspace_id::text,
  'Legacy tender/customer suggestion link attached to contaminated tender workspace.',
  to_jsonb(l)
FROM tender_customer_links l
WHERE l.tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002', 'tn-003', 'tn-004', 'tn-005', 'tn-006', 'tn-007', 'tn-008')
   OR lower(coalesce(l.tender_customer_name, '')) LIKE '%linde%'
   OR lower(coalesce(l.customer_master_name, '')) LIKE '%linde%'
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

-- ---------------------------------------------------------
-- 3. Explicit mock escalation table rows.
-- ---------------------------------------------------------

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'commercial_mock_escalations',
  e.id::text,
  NULL,
  'Explicit mock escalation table; not canonical operational truth.',
  to_jsonb(e)
FROM commercial_mock_escalations e
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

-- ---------------------------------------------------------
-- 4. Transportation rows linked to seeded tender snapshots.
-- ---------------------------------------------------------

INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'transportation_opportunities',
  t.id::text,
  NULL,
  'Transportation row appears to originate from legacy tender snapshot/import, not canonical commercial_tickets lineage.',
  to_jsonb(t)
FROM transportation_opportunities t
WHERE lower(coalesce(t.source_type, '')) IN ('tender_snapshot', 'mock', 'demo', 'seed')
   OR lower(coalesce(t.truth_status, '')) IN ('mock', 'demo', 'seed', 'unverified')
   OR lower(coalesce(t.customer_name, '')) LIKE '%linde%'
   OR lower(coalesce(t.opportunity_name, '')) LIKE '%linde%'
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_transport AS (
  SELECT id FROM transportation_opportunities
  WHERE lower(coalesce(source_type, '')) IN ('tender_snapshot', 'mock', 'demo', 'seed')
     OR lower(coalesce(truth_status, '')) IN ('mock', 'demo', 'seed', 'unverified')
     OR lower(coalesce(customer_name, '')) LIKE '%linde%'
     OR lower(coalesce(opportunity_name, '')) LIKE '%linde%'
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'transportation_opportunity_metrics',
  m.id::text,
  m.transportation_opportunity_id::text,
  'Metric child of quarantined transportation opportunity.',
  to_jsonb(m)
FROM transportation_opportunity_metrics m
JOIN contaminated_transport t ON t.id = m.transportation_opportunity_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

WITH contaminated_transport AS (
  SELECT id FROM transportation_opportunities
  WHERE lower(coalesce(source_type, '')) IN ('tender_snapshot', 'mock', 'demo', 'seed')
     OR lower(coalesce(truth_status, '')) IN ('mock', 'demo', 'seed', 'unverified')
     OR lower(coalesce(customer_name, '')) LIKE '%linde%'
     OR lower(coalesce(opportunity_name, '')) LIKE '%linde%'
)
INSERT INTO legacy_data_quarantine
  (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
SELECT
  'legacy_tender_slop_20260521',
  'transportation_customer_links',
  l.id::text,
  l.transportation_opportunity_id::text,
  'Customer link child of quarantined transportation opportunity.',
  to_jsonb(l)
FROM transportation_customer_links l
JOIN contaminated_transport t ON t.id = l.transportation_opportunity_id
ON CONFLICT (quarantine_batch, source_table, source_pk) DO NOTHING;

-- ---------------------------------------------------------
-- 5. Verification output. Paste this result back to Codex.
-- ---------------------------------------------------------

SELECT
  source_table,
  count(*) AS archived_rows
FROM legacy_data_quarantine
WHERE quarantine_batch = 'legacy_tender_slop_20260521'
GROUP BY source_table
ORDER BY source_table;

SELECT
  'ARCHIVE PASS COMPLETE - DO NOT DELETE YET - PASTE COUNTS BACK TO CODEX' AS next_step;
