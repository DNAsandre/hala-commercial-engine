-- ════════════════════════════════════════════════════════════════
-- USR-001: Users Table — Add department, office, updated_at columns
-- Run: 2026-05-19
-- Author: Antigravity / Hala Commercial Engine
--
-- Adds missing columns to the public.users table:
--   - department TEXT   (e.g. "Commercial", "Operations", "Finance")
--   - office TEXT       (e.g. "Riyadh", "Jeddah", "Dammam")
--   - updated_at TIMESTAMPTZ (required by Edge Function update handler)
--
-- SAFE: All ADD COLUMN IF NOT EXISTS. Re-runnable.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS office TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
