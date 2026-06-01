-- SUPA-008F: Gate Workspace Link Column
-- Revised: 2026-05-21
--
-- Purpose:
--   Keeps the tender_submission_gates schema compatible with workspace-scoped
--   gate reads.
--
-- Doctrine:
--   - Schema only.
--   - No Linde-specific UPDATE.
--   - No auto-linking seed/demo gates to a workspace.

ALTER TABLE tender_submission_gates
  ADD COLUMN IF NOT EXISTS tender_workspace_id TEXT;
