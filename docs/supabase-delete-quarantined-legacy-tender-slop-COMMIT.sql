-- =========================================================
-- LEGACY TENDER SLOP REMOVAL - FINAL COMMIT
-- Date: 2026-05-21
--
-- Purpose:
--   Remove only rows already archived into legacy_data_quarantine
--   batch legacy_tender_slop_20260521.
--
-- Human rule:
--   Run manually in Supabase SQL Editor only.
--
-- Safety posture:
--   - FINAL COMMIT: permanently removes only archived contaminated rows.
--   - Does NOT touch commercial_tickets.
--   - Deletes child rows before parent rows.
--   - Refuses to run if quarantine archive is missing.
--
-- This script permanently removes the rows copied into quarantine batch legacy_tender_slop_20260521.
-- =========================================================

BEGIN;

DO $$
DECLARE
  archived_rows integer;
BEGIN
  IF to_regclass('public.legacy_data_quarantine') IS NULL THEN
    RAISE EXCEPTION 'legacy_data_quarantine does not exist. Run archive-first quarantine SQL before deletion.';
  END IF;

  SELECT count(*)
    INTO archived_rows
  FROM legacy_data_quarantine
  WHERE quarantine_batch = 'legacy_tender_slop_20260521';

  IF archived_rows = 0 THEN
    RAISE EXCEPTION 'No archived rows found for batch legacy_tender_slop_20260521. Deletion refused.';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 1. Pre-delete inventory: paste this result back to Codex.
-- ---------------------------------------------------------

SELECT
  q.source_table,
  count(*) AS archived_rows
FROM legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
GROUP BY q.source_table
ORDER BY q.source_table;

-- ---------------------------------------------------------
-- 2. Delete child tables first.
-- ---------------------------------------------------------

DELETE FROM tender_submission_email_attachments a
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_submission_email_attachments'
  AND q.source_pk = a.id::text;

DELETE FROM tender_submission_emails e
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_submission_emails'
  AND q.source_pk = e.id::text;

DELETE FROM tender_pack_outputs o
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_pack_outputs'
  AND q.source_pk = o.id::text;

DELETE FROM tender_split_checks s
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_split_checks'
  AND q.source_pk = s.id::text;

DELETE FROM tender_submission_gates g
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_submission_gates'
  AND q.source_pk = g.id::text;

DELETE FROM tender_compliance_items c
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_compliance_items'
  AND q.source_pk = c.id::text;

DELETE FROM tender_required_documents d
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_required_documents'
  AND q.source_pk = d.id::text;

DELETE FROM tender_placeholders p
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_placeholders'
  AND q.source_pk = p.id::text;

DELETE FROM tender_pack_sections s
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_pack_sections'
  AND q.source_pk = s.id::text;

DELETE FROM tender_activity_events a
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_activity_events'
  AND q.source_pk = a.id::text;

DELETE FROM tender_audit_events a
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_audit_events'
  AND q.source_pk = a.id::text;

DELETE FROM tender_packs p
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_packs'
  AND q.source_pk = p.id::text;

-- ---------------------------------------------------------
-- 3. Delete non-canonical supporting slop.
-- ---------------------------------------------------------

DELETE FROM transportation_customer_links l
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'transportation_customer_links'
  AND q.source_pk = l.id::text;

DELETE FROM transportation_opportunity_metrics m
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'transportation_opportunity_metrics'
  AND q.source_pk = m.id::text;

DELETE FROM transportation_opportunities o
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'transportation_opportunities'
  AND q.source_pk = o.id::text;

DELETE FROM commercial_mock_escalations e
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'commercial_mock_escalations'
  AND q.source_pk = e.id::text;

DELETE FROM tender_customer_links l
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tender_customer_links'
  AND q.source_pk = l.id::text;

-- ---------------------------------------------------------
-- 4. Delete legacy tender parent rows last.
-- ---------------------------------------------------------

DELETE FROM tenders t
USING legacy_data_quarantine q
WHERE q.quarantine_batch = 'legacy_tender_slop_20260521'
  AND q.source_table = 'tenders'
  AND q.source_pk = t.id::text;

-- ---------------------------------------------------------
-- 5. Commit verification. These counts should be 0 before COMMIT.
-- ---------------------------------------------------------

SELECT 'remaining_tenders_after_delete_dry_run' AS check_name, count(*) AS rows
FROM tenders
WHERE id IN ('tn-linde-001', 'tn-001', 'tn-002', 'tn-003', 'tn-004', 'tn-005', 'tn-006', 'tn-007', 'tn-008')

UNION ALL
SELECT 'remaining_tender_packs_after_delete_dry_run', count(*)
FROM tender_packs
WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')

UNION ALL
SELECT 'remaining_tender_pack_sections_after_delete_dry_run', count(*)
FROM tender_pack_sections
WHERE pack_id IN (
  SELECT id FROM tender_packs
  WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)

UNION ALL
SELECT 'remaining_tender_placeholders_after_delete_dry_run', count(*)
FROM tender_placeholders
WHERE pack_id IN (
  SELECT id FROM tender_packs
  WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)

UNION ALL
SELECT 'remaining_tender_required_documents_after_delete_dry_run', count(*)
FROM tender_required_documents
WHERE pack_id IN (
  SELECT id FROM tender_packs
  WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)

UNION ALL
SELECT 'remaining_tender_compliance_after_delete_dry_run', count(*)
FROM tender_compliance_items
WHERE pack_id IN (
  SELECT id FROM tender_packs
  WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)

UNION ALL
SELECT 'remaining_tender_submission_gates_after_delete_dry_run', count(*)
FROM tender_submission_gates
WHERE COALESCE(tender_workspace_id, tender_workspace_id_col) IN ('tn-linde-001', 'tn-001', 'tn-002')
   OR pack_id IN (
    SELECT id FROM tender_packs
    WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
  )

UNION ALL
SELECT 'remaining_tender_activity_after_delete_dry_run', count(*)
FROM tender_activity_events
WHERE workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')

UNION ALL
SELECT 'remaining_tender_audit_after_delete_dry_run', count(*)
FROM tender_audit_events
WHERE workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')

UNION ALL
SELECT 'remaining_tender_split_checks_after_delete_dry_run', count(*)
FROM tender_split_checks
WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')

UNION ALL
SELECT 'remaining_tender_outputs_after_delete_dry_run', count(*)
FROM tender_pack_outputs
WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')

UNION ALL
SELECT 'remaining_tender_emails_after_delete_dry_run', count(*)
FROM tender_submission_emails
WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')

UNION ALL
SELECT 'remaining_tender_email_attachments_after_delete_dry_run', count(*)
FROM tender_submission_email_attachments
WHERE email_id IN (
  SELECT id FROM tender_submission_emails
  WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002')
)

UNION ALL
SELECT 'remaining_commercial_mock_escalations_after_delete_dry_run', count(*)
FROM commercial_mock_escalations

UNION ALL
SELECT 'remaining_tender_customer_links_after_delete_dry_run', count(*)
FROM tender_customer_links
WHERE tender_workspace_id IN ('tn-linde-001', 'tn-001', 'tn-002', 'tn-003', 'tn-004', 'tn-005', 'tn-006', 'tn-007', 'tn-008')
   OR lower(coalesce(tender_customer_name, '')) LIKE '%linde%'
   OR lower(coalesce(customer_master_name, '')) LIKE '%linde%'

UNION ALL
SELECT 'remaining_transportation_opportunities_after_delete_dry_run', count(*)
FROM transportation_opportunities
WHERE lower(coalesce(source_type, '')) IN ('tender_snapshot', 'mock', 'demo', 'seed')
   OR lower(coalesce(truth_status, '')) IN ('mock', 'demo', 'seed', 'unverified')
   OR lower(coalesce(customer_name, '')) LIKE '%linde%'
   OR lower(coalesce(opportunity_name, '')) LIKE '%linde%'

UNION ALL
SELECT 'remaining_transportation_customer_links_after_delete_dry_run', count(*)
FROM transportation_customer_links
WHERE transportation_opportunity_id IN (
  SELECT id FROM transportation_opportunities
  WHERE lower(coalesce(source_type, '')) IN ('tender_snapshot', 'mock', 'demo', 'seed')
     OR lower(coalesce(truth_status, '')) IN ('mock', 'demo', 'seed', 'unverified')
     OR lower(coalesce(customer_name, '')) LIKE '%linde%'
     OR lower(coalesce(opportunity_name, '')) LIKE '%linde%'
);

SELECT 'DELETE CHECK COMPLETE - COMMITTING NOW' AS next_step;

COMMIT;

SELECT 'remaining_archived_tenders_live' AS check_name, count(*) AS rows
FROM tenders t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tenders'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_packs_live', count(*)
FROM tender_packs t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_packs'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_pack_sections_live', count(*)
FROM tender_pack_sections t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_pack_sections'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_placeholders_live', count(*)
FROM tender_placeholders t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_placeholders'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_required_documents_live', count(*)
FROM tender_required_documents t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_required_documents'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_compliance_items_live', count(*)
FROM tender_compliance_items t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_compliance_items'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_submission_gates_live', count(*)
FROM tender_submission_gates t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_submission_gates'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_activity_events_live', count(*)
FROM tender_activity_events t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_activity_events'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_audit_events_live', count(*)
FROM tender_audit_events t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_audit_events'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_split_checks_live', count(*)
FROM tender_split_checks t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_split_checks'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_pack_outputs_live', count(*)
FROM tender_pack_outputs t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_pack_outputs'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_submission_emails_live', count(*)
FROM tender_submission_emails t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_submission_emails'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_submission_email_attachments_live', count(*)
FROM tender_submission_email_attachments t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_submission_email_attachments'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_commercial_mock_escalations_live', count(*)
FROM commercial_mock_escalations t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'commercial_mock_escalations'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_tender_customer_links_live', count(*)
FROM tender_customer_links t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'tender_customer_links'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_transportation_opportunities_live', count(*)
FROM transportation_opportunities t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'transportation_opportunities'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'remaining_archived_transportation_customer_links_live', count(*)
FROM transportation_customer_links t
JOIN legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_tender_slop_20260521'
 AND q.source_table = 'transportation_customer_links'
 AND q.source_pk = t.id::text

UNION ALL
SELECT 'canonical_commercial_tickets_live_after_commit', count(*)
FROM commercial_tickets

UNION ALL
SELECT 'quarantine_archive_rows_preserved_after_commit', count(*)
FROM legacy_data_quarantine
WHERE quarantine_batch = 'legacy_tender_slop_20260521';

