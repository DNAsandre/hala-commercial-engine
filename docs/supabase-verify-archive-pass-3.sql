-- VERIFY ARCHIVE PASS 3 - READ ONLY
-- Paste results back to Codex before running any delete.

SELECT source_table, count(*) AS archived_rows
FROM public.legacy_data_quarantine
WHERE quarantine_batch = 'legacy_proposal_escalation_slop_20260521'
GROUP BY source_table
ORDER BY source_table;

SELECT 'VERIFY ARCHIVE PASS 3 COMPLETE - PASTE COUNTS BACK TO CODEX' AS next_step;
