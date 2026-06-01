-- DRY RUN DELETE PASS 3 - LEGACY PROPOSAL + ESCALATION WORKFLOW SLOP
-- This uses ONLY rows already archived in legacy_data_quarantine batch:
--   legacy_proposal_escalation_slop_20260521
--
-- It deletes inside a transaction, verifies live rows would be gone,
-- then ROLLS BACK so no live data is changed by this dry run.
--
-- Run with RLS unchanged.

BEGIN;

WITH archived_tasks AS (
  SELECT source_pk
  FROM public.legacy_data_quarantine
  WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
    AND source_table = 'escalation_tasks'
),
deleted_tasks AS (
  DELETE FROM public.escalation_tasks t
  USING archived_tasks a
  WHERE t.id::text = a.source_pk
  RETURNING t.id
),
archived_events AS (
  SELECT source_pk
  FROM public.legacy_data_quarantine
  WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
    AND source_table = 'escalation_events'
),
deleted_events AS (
  DELETE FROM public.escalation_events e
  USING archived_events a
  WHERE e.id::text = a.source_pk
  RETURNING e.id
),
archived_proposals AS (
  SELECT source_pk
  FROM public.legacy_data_quarantine
  WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
    AND source_table = 'proposals'
),
deleted_proposals AS (
  DELETE FROM public.proposals p
  USING archived_proposals a
  WHERE p.id::text = a.source_pk
  RETURNING p.id
)
SELECT 'deleted_tasks_dry_run' AS check_name, count(*) AS rows FROM deleted_tasks
UNION ALL
SELECT 'deleted_events_dry_run', count(*) FROM deleted_events
UNION ALL
SELECT 'deleted_proposals_dry_run', count(*) FROM deleted_proposals;

WITH archived AS (
  SELECT source_table, source_pk
  FROM public.legacy_data_quarantine
  WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
),
remaining AS (
  SELECT 'remaining_archived_escalation_tasks_live_after_dry_run' AS check_name, count(*) AS rows
  FROM public.escalation_tasks t
  JOIN archived a ON a.source_table = 'escalation_tasks' AND a.source_pk = t.id::text
  UNION ALL
  SELECT 'remaining_archived_escalation_events_live_after_dry_run', count(*)
  FROM public.escalation_events e
  JOIN archived a ON a.source_table = 'escalation_events' AND a.source_pk = e.id::text
  UNION ALL
  SELECT 'remaining_archived_proposals_live_after_dry_run', count(*)
  FROM public.proposals p
  JOIN archived a ON a.source_table = 'proposals' AND a.source_pk = p.id::text
  UNION ALL
  SELECT 'commercial_escalations_live_after_dry_run', count(*)
  FROM public.commercial_escalations
  UNION ALL
  SELECT 'commercial_tickets_live_after_dry_run', count(*)
  FROM public.commercial_tickets
)
SELECT *
FROM remaining
ORDER BY check_name;

ROLLBACK;

SELECT 'DRY RUN PASS 3 COMPLETE - ROLLBACK PRESERVED LIVE DATA - PASTE RESULTS BACK TO CODEX' AS next_step;
