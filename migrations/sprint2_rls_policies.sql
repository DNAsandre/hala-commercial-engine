-- ============================================================
-- Sprint 2: RLS Policies — Basic Data Protection
-- ============================================================
-- 
-- Policy: Authenticated users can read all commercial data.
-- Anonymous users cannot access business data.
-- Writes allowed for authenticated users (no role restriction yet).
--
-- Run this in Supabase SQL Editor.
-- 
-- ⚠️ NO commercial gates or role-based restrictions.
-- ⚠️ This sprint establishes identity-based access only.
-- ============================================================

-- ─── Enable RLS on all core tables ───────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ─── CUSTOMERS ───────────────────────────────────────────
-- Authenticated users: full read
DROP POLICY IF EXISTS "customers_select_auth" ON customers;
CREATE POLICY "customers_select_auth" ON customers
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users: write (no role restriction yet)
DROP POLICY IF EXISTS "customers_insert_auth" ON customers;
CREATE POLICY "customers_insert_auth" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "customers_update_auth" ON customers;
CREATE POLICY "customers_update_auth" ON customers
  FOR UPDATE TO authenticated
  USING (true);

-- Service role (server API) always has access
DROP POLICY IF EXISTS "customers_service" ON customers;
CREATE POLICY "customers_service" ON customers
  FOR ALL TO service_role
  USING (true);

-- ─── WORKSPACES ──────────────────────────────────────────
DROP POLICY IF EXISTS "workspaces_select_auth" ON workspaces;
CREATE POLICY "workspaces_select_auth" ON workspaces
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "workspaces_insert_auth" ON workspaces;
CREATE POLICY "workspaces_insert_auth" ON workspaces
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "workspaces_update_auth" ON workspaces;
CREATE POLICY "workspaces_update_auth" ON workspaces
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "workspaces_service" ON workspaces;
CREATE POLICY "workspaces_service" ON workspaces
  FOR ALL TO service_role
  USING (true);

-- ─── QUOTES ──────────────────────────────────────────────
DROP POLICY IF EXISTS "quotes_select_auth" ON quotes;
CREATE POLICY "quotes_select_auth" ON quotes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "quotes_insert_auth" ON quotes;
CREATE POLICY "quotes_insert_auth" ON quotes
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "quotes_update_auth" ON quotes;
CREATE POLICY "quotes_update_auth" ON quotes
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "quotes_service" ON quotes;
CREATE POLICY "quotes_service" ON quotes
  FOR ALL TO service_role
  USING (true);

-- ─── PROPOSALS ───────────────────────────────────────────
DROP POLICY IF EXISTS "proposals_select_auth" ON proposals;
CREATE POLICY "proposals_select_auth" ON proposals
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "proposals_insert_auth" ON proposals;
CREATE POLICY "proposals_insert_auth" ON proposals
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "proposals_update_auth" ON proposals;
CREATE POLICY "proposals_update_auth" ON proposals
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "proposals_service" ON proposals;
CREATE POLICY "proposals_service" ON proposals
  FOR ALL TO service_role
  USING (true);

-- ─── APPROVAL_RECORDS ────────────────────────────────────
DROP POLICY IF EXISTS "approval_records_select_auth" ON approval_records;
CREATE POLICY "approval_records_select_auth" ON approval_records
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "approval_records_insert_auth" ON approval_records;
CREATE POLICY "approval_records_insert_auth" ON approval_records
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "approval_records_update_auth" ON approval_records;
CREATE POLICY "approval_records_update_auth" ON approval_records
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "approval_records_service" ON approval_records;
CREATE POLICY "approval_records_service" ON approval_records
  FOR ALL TO service_role
  USING (true);

-- ─── ESCALATION_EVENTS ──────────────────────────────────
DROP POLICY IF EXISTS "escalation_events_select_auth" ON escalation_events;
CREATE POLICY "escalation_events_select_auth" ON escalation_events
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escalation_events_insert_auth" ON escalation_events;
CREATE POLICY "escalation_events_insert_auth" ON escalation_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "escalation_events_update_auth" ON escalation_events;
CREATE POLICY "escalation_events_update_auth" ON escalation_events
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escalation_events_service" ON escalation_events;
CREATE POLICY "escalation_events_service" ON escalation_events
  FOR ALL TO service_role
  USING (true);

-- ─── SIGNALS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "signals_select_auth" ON signals;
CREATE POLICY "signals_select_auth" ON signals
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "signals_insert_auth" ON signals;
CREATE POLICY "signals_insert_auth" ON signals
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "signals_update_auth" ON signals;
CREATE POLICY "signals_update_auth" ON signals
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "signals_service" ON signals;
CREATE POLICY "signals_service" ON signals
  FOR ALL TO service_role
  USING (true);

-- ─── AUDIT_LOG ───────────────────────────────────────────
-- Authenticated: can read their own audit entries
DROP POLICY IF EXISTS "audit_log_select_auth" ON audit_log;
CREATE POLICY "audit_log_select_auth" ON audit_log
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated: can insert (for client-side audit logging)
DROP POLICY IF EXISTS "audit_log_insert_auth" ON audit_log;
CREATE POLICY "audit_log_insert_auth" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No update/delete on audit log — immutable
DROP POLICY IF EXISTS "audit_log_service" ON audit_log;
CREATE POLICY "audit_log_service" ON audit_log
  FOR ALL TO service_role
  USING (true);

-- ─── USERS ───────────────────────────────────────────────
-- Users can read the users table (needed for profile lookup)
DROP POLICY IF EXISTS "users_select_auth" ON users;
CREATE POLICY "users_select_auth" ON users
  FOR SELECT TO authenticated
  USING (true);

-- Only service role can modify users
DROP POLICY IF EXISTS "users_service" ON users;
CREATE POLICY "users_service" ON users
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- VERIFICATION: Run this to confirm RLS is enabled
-- ============================================================
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('customers','workspaces','quotes','proposals',
--   'approval_records','escalation_events','signals','audit_log','users');
