-- COMMIT DELETE PASS 3 - LEGACY PROPOSAL + ESCALATION WORKFLOW SLOP
-- This permanently deletes ONLY rows already archived in legacy_data_quarantine batch:
--   legacy_proposal_escalation_slop_20260521
--
-- Protected tables not touched:
--   commercial_escalations
--   commercial_tickets
--   commercial_opportunities
--   document_vault
--
-- Run with RLS unchanged.

BEGIN;

CREATE TEMP TABLE delete_pass_3_commit_counts (
  check_name text PRIMARY KEY,
  rows bigint NOT NULL
) ON COMMIT PRESERVE ROWS;

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
)
INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'deleted_tasks_commit', count(*) FROM deleted_tasks;

WITH archived_events AS (
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
)
INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'deleted_events_commit', count(*) FROM deleted_events;

WITH archived_proposals AS (
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
INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'deleted_proposals_commit', count(*) FROM deleted_proposals;

COMMIT;

INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'remaining_archived_escalation_tasks_live_after_commit', count(*)
FROM public.escalation_tasks t
JOIN public.legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
 AND q.source_table = 'escalation_tasks'
 AND q.source_pk = t.id::text;

INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'remaining_archived_escalation_events_live_after_commit', count(*)
FROM public.escalation_events e
JOIN public.legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
 AND q.source_table = 'escalation_events'
 AND q.source_pk = e.id::text;

INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'remaining_archived_proposals_live_after_commit', count(*)
FROM public.proposals p
JOIN public.legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
 AND q.source_table = 'proposals'
 AND q.source_pk = p.id::text;

INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'commercial_escalations_live_after_commit', count(*)
FROM public.commercial_escalations;

INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'commercial_tickets_live_after_commit', count(*)
FROM public.commercial_tickets;

INSERT INTO delete_pass_3_commit_counts(check_name, rows)
SELECT 'legacy_proposal_escalation_archive_rows_preserved', count(*)
FROM public.legacy_data_quarantine
WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521';

SELECT check_name, rows
FROM delete_pass_3_commit_counts
ORDER BY check_name;
