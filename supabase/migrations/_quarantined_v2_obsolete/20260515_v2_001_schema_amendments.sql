-- ============================================================
-- V2-001: Schema Amendments for Functional V.2 Rebuild
-- Corrected to match exact Hala process flows.
-- ============================================================

-- ============================================================
-- 1. Ticket Amendments — missing lead intake fields
-- ============================================================
ALTER TABLE commercial_v2_tickets
  ADD COLUMN IF NOT EXISTS opportunity_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimated_gp_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- ============================================================
-- 2. Proposal Amendments — workspace fields
-- ============================================================
ALTER TABLE commercial_v2_proposals
  ADD COLUMN IF NOT EXISTS design_solution_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS negotiation_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'draft';

-- ============================================================
-- 3. Activity Lineage — track full chain
-- ============================================================
ALTER TABLE commercial_v2_activity
  ADD COLUMN IF NOT EXISTS linked_ticket_id uuid,
  ADD COLUMN IF NOT EXISTS linked_proposal_id uuid,
  ADD COLUMN IF NOT EXISTS linked_tender_id uuid,
  ADD COLUMN IF NOT EXISTS linked_approval_id uuid;

CREATE INDEX IF NOT EXISTS idx_v2al_ticket ON commercial_v2_activity(linked_ticket_id);
CREATE INDEX IF NOT EXISTS idx_v2al_proposal ON commercial_v2_activity(linked_proposal_id);
CREATE INDEX IF NOT EXISTS idx_v2al_tender ON commercial_v2_activity(linked_tender_id);

-- ============================================================
-- 4. RLS Write Policies
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_documents' AND policyname = 'v2_documents_insert_all') THEN
    CREATE POLICY v2_documents_insert_all ON commercial_v2_documents FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_documents' AND policyname = 'v2_documents_update_all') THEN
    CREATE POLICY v2_documents_update_all ON commercial_v2_documents FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_approvals' AND policyname = 'v2_approvals_insert_all') THEN
    CREATE POLICY v2_approvals_insert_all ON commercial_v2_approvals FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_approvals' AND policyname = 'v2_approvals_update_all') THEN
    CREATE POLICY v2_approvals_update_all ON commercial_v2_approvals FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 5. Fix default proposal stage → 'prospecting' (Hala flow)
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_convert_to_proposal(
  p_ticket_id uuid,
  p_customer_master_id text DEFAULT NULL,
  p_legacy_workspace_id text DEFAULT NULL,
  p_lead_owner text DEFAULT 'system'
)
RETURNS commercial_v2_proposals AS $$
DECLARE
  new_proposal commercial_v2_proposals;
  upd_ticket commercial_v2_tickets;
BEGIN
  INSERT INTO commercial_v2_proposals (
    v2_ticket_id, customer_master_id, legacy_workspace_id,
    customer_name, contact_name, stage
  )
  SELECT
    p_ticket_id,
    p_customer_master_id,
    p_legacy_workspace_id,
    customer_name,
    contact_name,
    'prospecting'
  FROM commercial_v2_tickets WHERE id = p_ticket_id
  RETURNING * INTO new_proposal;

  UPDATE commercial_v2_tickets
  SET routing_decision = 'proposal',
      converted_at = now(),
      stage = 'qualified',
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name, linked_ticket_id, linked_proposal_id)
  VALUES ('ticket', p_ticket_id, 'converted_to_proposal',
    'Ticket routed to Proposal V.2 — Proposal ID: ' || new_proposal.id, p_lead_owner,
    p_ticket_id, new_proposal.id);

  RETURN new_proposal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Fix default tender stage → 'sow_qualification' (Hala flow)
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_convert_to_tender(
  p_ticket_id uuid,
  p_tender_ws_id text DEFAULT NULL,
  p_tender_ref text DEFAULT '',
  p_customer_master_id text DEFAULT NULL,
  p_legacy_workspace_id text DEFAULT NULL,
  p_lead_owner text DEFAULT 'system'
)
RETURNS commercial_v2_tenders AS $$
DECLARE
  new_tender commercial_v2_tenders;
  upd_ticket commercial_v2_tickets;
BEGIN
  INSERT INTO commercial_v2_tenders (
    v2_ticket_id, tender_ws_id, tender_ref,
    customer_master_id, legacy_workspace_id,
    customer_name, stage
  )
  SELECT
    p_ticket_id,
    p_tender_ws_id,
    p_tender_ref,
    p_customer_master_id,
    p_legacy_workspace_id,
    customer_name,
    'sow_qualification'
  FROM commercial_v2_tickets WHERE id = p_ticket_id
  RETURNING * INTO new_tender;

  UPDATE commercial_v2_tickets
  SET routing_decision = 'tender',
      converted_at = now(),
      stage = 'qualified',
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name, linked_ticket_id, linked_tender_id, linked_tender_ws_id)
  VALUES ('ticket', p_ticket_id, 'converted_to_tender',
    'Ticket routed to Tender V.2 — Tender ID: ' || new_tender.id,
    p_lead_owner, p_ticket_id, new_tender.id, p_tender_ws_id);

  RETURN new_tender;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Approve Approval RPC
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_approve_approval(
  p_approval_id uuid,
  p_final_approver text DEFAULT 'system'
)
RETURNS commercial_v2_approvals AS $$
DECLARE
  upd_approval commercial_v2_approvals;
BEGIN
  UPDATE commercial_v2_approvals
  SET approval_status = 'approved',
      final_approver = p_final_approver
  WHERE id = p_approval_id
  RETURNING * INTO upd_approval;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('approval', p_approval_id, 'approval_approved',
    'Approved by: ' || p_final_approver, p_final_approver);

  RETURN upd_approval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. Reject Approval RPC
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_reject_approval(
  p_approval_id uuid,
  p_rejected_by text DEFAULT 'system',
  p_reason text DEFAULT ''
)
RETURNS commercial_v2_approvals AS $$
DECLARE
  upd_approval commercial_v2_approvals;
BEGIN
  IF p_reason IS NULL OR length(p_reason) < 5 THEN
    RAISE EXCEPTION 'Rejection reason must be at least 5 characters';
  END IF;

  UPDATE commercial_v2_approvals
  SET approval_status = 'rejected',
      final_approver = p_rejected_by,
      override_reason = p_reason
  WHERE id = p_approval_id
  RETURNING * INTO upd_approval;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('approval', p_approval_id, 'approval_rejected',
    'Rejected by: ' || p_rejected_by || ' | Reason: ' || p_reason, p_rejected_by);

  RETURN upd_approval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. Update Proposal Workspace Fields
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_update_proposal_workspace(
  p_proposal_id uuid,
  p_design_solution_notes text DEFAULT NULL,
  p_negotiation_notes text DEFAULT NULL,
  p_contract_status text DEFAULT NULL
)
RETURNS commercial_v2_proposals AS $$
DECLARE
  upd_prop commercial_v2_proposals;
BEGIN
  UPDATE commercial_v2_proposals
  SET design_solution_notes = COALESCE(p_design_solution_notes, design_solution_notes),
      negotiation_notes = COALESCE(p_negotiation_notes, negotiation_notes),
      contract_status = COALESCE(p_contract_status, contract_status),
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO upd_prop;
  RETURN upd_prop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. Update Ticket (general field update for new fields)
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_update_ticket(
  p_ticket_id uuid,
  p_customer_name text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_revenue_potential numeric DEFAULT NULL,
  p_opportunity_type text DEFAULT NULL,
  p_estimated_gp_percent numeric DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_lead_owner text DEFAULT NULL
)
RETURNS commercial_v2_tickets AS $$
DECLARE
  upd_ticket commercial_v2_tickets;
BEGIN
  UPDATE commercial_v2_tickets
  SET customer_name = COALESCE(p_customer_name, customer_name),
      contact_name = COALESCE(p_contact_name, contact_name),
      contact_email = COALESCE(p_contact_email, contact_email),
      contact_phone = COALESCE(p_contact_phone, contact_phone),
      company = COALESCE(p_company, company),
      region = COALESCE(p_region, region),
      industry = COALESCE(p_industry, industry),
      revenue_potential = COALESCE(p_revenue_potential, revenue_potential),
      opportunity_type = COALESCE(p_opportunity_type, opportunity_type),
      estimated_gp_percent = COALESCE(p_estimated_gp_percent, estimated_gp_percent),
      source = COALESCE(p_source, source),
      notes = COALESCE(p_notes, notes),
      lead_owner = COALESCE(p_lead_owner, lead_owner),
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;
  RETURN upd_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. Proposal P&L Versions — Rich line-item persistence
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_proposal_pnl_versions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id              uuid REFERENCES commercial_v2_proposals(id) ON DELETE CASCADE,
  name                      text NOT NULL DEFAULT '',
  created_at                timestamptz NOT NULL DEFAULT now(),
  notes                     text DEFAULT '',
  is_approved               boolean NOT NULL DEFAULT false,
  overhead_percent         numeric NOT NULL DEFAULT 5,
  total_revenue            numeric NOT NULL DEFAULT 0,
  total_cost               numeric NOT NULL DEFAULT 0,
  gross_profit             numeric NOT NULL DEFAULT 0,
  gp_percent               numeric NOT NULL DEFAULT 0,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pnl_v_proposal ON commercial_v2_proposal_pnl_versions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_pnl_v_approved ON commercial_v2_proposal_pnl_versions(proposal_id, is_approved);

CREATE TABLE IF NOT EXISTS commercial_v2_proposal_pnl_lines (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pnl_version_id            uuid REFERENCES commercial_v2_proposal_pnl_versions(id) ON DELETE CASCADE,
  line_type                 text NOT NULL CHECK (line_type IN ('revenue', 'cost')),
  label                     text NOT NULL DEFAULT '',
  amount                    numeric NOT NULL DEFAULT 0,
  sort_order                integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pnl_line_version ON commercial_v2_proposal_pnl_lines(pnl_version_id);

CREATE OR REPLACE FUNCTION commercial_v2_save_proposal_pnl_version(
  p_proposal_id      uuid,
  p_name             text DEFAULT '',
  p_notes            text DEFAULT '',
  p_is_approved      boolean DEFAULT false,
  p_overhead_percent numeric DEFAULT 5,
  p_revenue_lines    jsonb DEFAULT '[]',
  p_cost_lines       jsonb DEFAULT '[]'
)
RETURNS commercial_v2_proposal_pnl_versions AS $$
DECLARE
  v           commercial_v2_proposal_pnl_versions;
  total_rev   numeric := 0;
  total_cost  numeric := 0;
  v_overhead  numeric;
BEGIN
  SELECT COALESCE(SUM((r->>'amount')::numeric), 0) INTO total_rev FROM jsonb_array_elements(p_revenue_lines) r;
  SELECT COALESCE(SUM((c->>'amount')::numeric), 0) INTO total_cost FROM jsonb_array_elements(p_cost_lines) c;
  v_overhead := total_cost * (p_overhead_percent / 100);

  INSERT INTO commercial_v2_proposal_pnl_versions (
    proposal_id, name, notes, is_approved, overhead_percent,
    total_revenue, total_cost, gross_profit, gp_percent
  ) VALUES (
    p_proposal_id, p_name, p_notes, p_is_approved, p_overhead_percent,
    total_rev, total_cost + v_overhead, total_rev - (total_cost + v_overhead),
    CASE WHEN total_rev > 0 THEN ((total_rev - (total_cost + v_overhead)) / total_rev) * 100 ELSE 0 END
  ) RETURNING * INTO v;

  DELETE FROM commercial_v2_proposal_pnl_lines WHERE pnl_version_id = v.id;

  INSERT INTO commercial_v2_proposal_pnl_lines (pnl_version_id, line_type, label, amount, sort_order)
  SELECT v.id, 'revenue', (r->>'label')::text, COALESCE((r->>'amount')::numeric, 0), i
  FROM jsonb_array_elements(p_revenue_lines) WITH ORDINALITY AS r(r, i);

  INSERT INTO commercial_v2_proposal_pnl_lines (pnl_version_id, line_type, label, amount, sort_order)
  SELECT v.id, 'cost', (c->>'label')::text, COALESCE((c->>'amount')::numeric, 0), i
  FROM jsonb_array_elements(p_cost_lines) WITH ORDINALITY AS c(c, i);

  IF p_is_approved THEN
    UPDATE commercial_v2_proposal_pnl_versions SET is_approved = false WHERE proposal_id = p_proposal_id AND id != v.id;
  END IF;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name, linked_proposal_id)
  VALUES ('proposal', p_proposal_id, 'pnl_version_saved',
    'P&L version saved: ' || p_name || ' | GP: ' || ROUND(v.gp_percent, 1) || '%',
    'system', p_proposal_id);

  RETURN v;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION commercial_v2_get_proposal_pnl_versions(p_proposal_id uuid)
RETURNS TABLE(
  id uuid, name text, created_at timestamptz, notes text, is_approved boolean,
  overhead_percent numeric, total_revenue numeric, total_cost numeric,
  gross_profit numeric, gp_percent numeric, revenue_lines jsonb, cost_lines jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id, pv.name, pv.created_at, pv.notes, pv.is_approved,
    pv.overhead_percent, pv.total_revenue, pv.total_cost, pv.gross_profit, pv.gp_percent,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('label', pl.label, 'amount', pl.amount) ORDER BY pl.sort_order))
      FROM commercial_v2_proposal_pnl_lines pl WHERE pl.pnl_version_id = pv.id AND pl.line_type = 'revenue'), '[]'::jsonb) as revenue_lines,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('label', pl.label, 'amount', pl.amount) ORDER BY pl.sort_order))
      FROM commercial_v2_proposal_pnl_lines pl WHERE pl.pnl_version_id = pv.id AND pl.line_type = 'cost'), '[]'::jsonb) as cost_lines
  FROM commercial_v2_proposal_pnl_versions pv
  WHERE pv.proposal_id = p_proposal_id
  ORDER BY pv.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. CRM Sync Trigger — explicit, human-initiated, logged
-- ============================================================
CREATE OR REPLACE FUNCTION commercial_v2_sync_proposal_to_crm(
  p_proposal_id  uuid,
  p_sync_type    text DEFAULT 'status_update',
  p_notes        text DEFAULT '',
  p_user_name    text DEFAULT 'system'
)
RETURNS commercial_v2_activity AS $$
DECLARE
  new_act commercial_v2_activity;
  prop   commercial_v2_proposals;
BEGIN
  SELECT * INTO prop FROM commercial_v2_proposals WHERE id = p_proposal_id;

  INSERT INTO commercial_v2_activity (
    entity_type, entity_id, action, notes, user_name, linked_proposal_id
  ) VALUES (
    'proposal', p_proposal_id, 'crm_sync',
    'CRM sync | Type: ' || p_sync_type ||
    ' | Stage: ' || COALESCE(prop.stage, 'unknown') ||
    ' | GP: ' || COALESCE(prop.gp_percent::text, 'n/a') ||
    CASE WHEN p_notes != '' THEN ' | ' || p_notes ELSE '' END,
    p_user_name, p_proposal_id
  ) RETURNING * INTO new_act;

  RETURN new_act;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
