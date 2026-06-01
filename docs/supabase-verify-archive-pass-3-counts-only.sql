-- VERIFY ARCHIVE PASS 3 - COUNTS ONLY - READ ONLY
-- This returns one result set only.

WITH expected(source_table) AS (
  VALUES
    ('escalation_events'),
    ('escalation_tasks'),
    ('proposals')
)
SELECT
  e.source_table,
  count(q.id) AS archived_rows
FROM expected e
LEFT JOIN public.legacy_data_quarantine q
  ON q.quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
 AND q.source_table = e.source_table
GROUP BY e.source_table
ORDER BY e.source_table;
