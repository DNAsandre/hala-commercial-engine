-- ARCHIVE PASS 3 - LEGACY PROPOSAL + ESCALATION WORKFLOW SLOP - NO DELETE
-- Goal:
--   Preserve legacy proposal/escalation workflow rows before any delete.
--
-- Why these rows are candidates:
--   - proposals p1/p2 are legacy proposals table rows; app writes are now disabled there.
--   - escalation_events/escalation_tasks are old rule/workflow rows from before the source-of-truth cleanup.
--   - commercial_escalations is NOT touched; those rows have source_type/truth_status/source_lineage and should remain.
--
-- This script only inserts archive copies into legacy_data_quarantine.
-- It does NOT delete or update live application rows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.legacy_data_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quarantine_batch text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  parent_key text NULL,
  quarantine_reason text NOT NULL,
  row_data jsonb NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT now()
);

WITH target_proposals AS (
  SELECT p.*
  FROM public.proposals p
  WHERE p.id IN ('p1', 'p2')
),
target_events AS (
  SELECT e.*
  FROM public.escalation_events e
  WHERE e.created_at < timestamptz '2026-05-01 00:00:00+00'
    AND e.rule_id IN (
      'er-margin-breach',
      'er-score-red',
      'er-stage-override',
      'tr-contract-expired',
      'tr-contract-expiring',
      'tr-customer-grade',
      'tr-notes-red',
      'tr-payment-bad',
      'tr-renewal-expired',
      'tr-stalled-workspace'
    )
),
target_tasks AS (
  SELECT t.*
  FROM public.escalation_tasks t
  JOIN target_events e ON e.id = t.escalation_id
),
archive_proposals AS (
  INSERT INTO public.legacy_data_quarantine
    (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
  SELECT
    'legacy_proposal_escalation_slop_20260521',
    'proposals',
    p.id::text,
    p.workspace_id::text,
    'legacy proposals table row; canonical proposal intake now belongs in commercial_tickets/commercial_proposal_versions',
    to_jsonb(p)
  FROM target_proposals p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.legacy_data_quarantine q
    WHERE q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
      AND q.source_table = 'proposals'
      AND q.source_pk = p.id::text
  )
  RETURNING source_table
),
archive_tasks AS (
  INSERT INTO public.legacy_data_quarantine
    (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
  SELECT
    'legacy_proposal_escalation_slop_20260521',
    'escalation_tasks',
    t.id::text,
    t.escalation_id::text,
    'legacy escalation task tied to archived pre-cleanup escalation_event',
    to_jsonb(t)
  FROM target_tasks t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.legacy_data_quarantine q
    WHERE q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
      AND q.source_table = 'escalation_tasks'
      AND q.source_pk = t.id::text
  )
  RETURNING source_table
),
archive_events AS (
  INSERT INTO public.legacy_data_quarantine
    (quarantine_batch, source_table, source_pk, parent_key, quarantine_reason, row_data)
  SELECT
    'legacy_proposal_escalation_slop_20260521',
    'escalation_events',
    e.id::text,
    coalesce(e.workspace_id::text, e.entity_id::text),
    'legacy escalation_event from pre-cleanup workflow/rule seed path without commercial_os source_lineage',
    to_jsonb(e)
  FROM target_events e
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.legacy_data_quarantine q
    WHERE q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
      AND q.source_table = 'escalation_events'
      AND q.source_pk = e.id::text
  )
  RETURNING source_table
)
SELECT source_table, count(*) AS newly_archived_rows
FROM (
  SELECT source_table FROM archive_proposals
  UNION ALL
  SELECT source_table FROM archive_tasks
  UNION ALL
  SELECT source_table FROM archive_events
) archived
GROUP BY source_table
ORDER BY source_table;

COMMIT;

SELECT source_table, count(*) AS archived_rows_total_for_batch
FROM public.legacy_data_quarantine
WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
GROUP BY source_table
ORDER BY source_table;

SELECT 'ARCHIVE PASS 3 COMPLETE - DO NOT DELETE YET - PASTE COUNTS BACK TO CODEX' AS next_step;
