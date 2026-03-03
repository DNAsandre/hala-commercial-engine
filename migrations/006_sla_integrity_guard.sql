-- ============================================================
-- Sprint 6 — SLA Integrity Guard (Commercial Risk Control)
-- Migration: 006_sla_integrity_guard.sql
-- Non-destructive: ALTER / CREATE IF NOT EXISTS only
-- ============================================================

-- 1. Add metadata JSONB column to audit_log for structured override data
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Create sla_verification_checklists table
CREATE TABLE IF NOT EXISTS sla_verification_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast workspace lookup
CREATE INDEX IF NOT EXISTS idx_sla_checklists_workspace ON sla_verification_checklists(workspace_id);

-- 3. RLS policies for sla_verification_checklists (mirror existing workspace RLS pattern)
ALTER TABLE sla_verification_checklists ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read checklists
CREATE POLICY IF NOT EXISTS "sla_checklists_select" ON sla_verification_checklists
  FOR SELECT USING (true);

-- Allow insert/update for all authenticated users (role checks done in application layer)
CREATE POLICY IF NOT EXISTS "sla_checklists_insert" ON sla_verification_checklists
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "sla_checklists_update" ON sla_verification_checklists
  FOR UPDATE USING (true);

-- 4. Add pricing_locked_at column to workspaces for tracking when pricing was locked
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS pricing_locked_at TIMESTAMPTZ;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS pricing_locked_by TEXT;
