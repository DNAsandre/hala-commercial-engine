-- ════════════════════════════════════════════════════════════════
-- SUPA-008F: Gate Workspace Fix + Data Integrity
-- Run: 2026-05-10
--
-- Links submission gates to the Linde tender workspace so
-- fetchTenderGates returns only the correct workspace's gates.
--
-- Also ensures tender_workspace_id column exists on gates table.
-- SAFE: Additive only. Re-runnable.
-- ════════════════════════════════════════════════════════════════

-- 1. Ensure tender_workspace_id column exists on gates table
ALTER TABLE tender_submission_gates
  ADD COLUMN IF NOT EXISTS tender_workspace_id TEXT DEFAULT '';

-- 2. Link all Linde gates to tn-linde-001
UPDATE tender_submission_gates
SET tender_workspace_id = 'tn-linde-001'
WHERE id IN ('mg-001','mg-002','mg-003','mg-004','mg-005','mg-006','mg-007','mg-008','mg-009','mg-010','mg-011','mg-012','mg-013','mg-014')
  AND (tender_workspace_id IS NULL OR tender_workspace_id = '');
