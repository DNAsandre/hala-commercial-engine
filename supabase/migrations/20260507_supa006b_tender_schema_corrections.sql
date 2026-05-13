-- ════════════════════════════════════════════════════════════════
-- SUPA-006B: Tender Schema Corrections
-- Run: 2026-05-07
-- Author: Antigravity / Hala Commercial Engine
--
-- Removes schema changes that were incorrectly placed in seed script
-- and places them in a proper migration file.
--
-- IMPORTANT: These changes were previously in 20260506_supa006_linde_seed.sql
-- They are now extracted into this proper migration. The seed script should
-- NOT contain schema ALTER statements going forward.
-- ════════════════════════════════════════════════════════════════

-- 1. Add assigned_owner to tenders table if it doesn't exist
-- (safety: IF NOT EXISTS pattern so this is re-runnable)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS assigned_owner TEXT DEFAULT '';

-- 2. Make pack_id nullable on tender_submission_gates for workspace-level gates
-- Certain gates (e.g., "Compliance Pack collated", "Email recipients verified",
-- "CI Proposal Form populated") apply to the whole tender workspace, not a
-- specific pack. This was always the intent — the NOT NULL was a schema error.
ALTER TABLE tender_submission_gates ALTER COLUMN pack_id DROP NOT NULL;