-- ============================================================
-- V2-000b: Write RPC Functions for V.2 Tables
-- RLS blocks direct inserts/updates — use these RPCs instead
-- All functions: NO hard gates. NO CRM. NO legacy mutation.
-- ============================================================

-- ============================================================
-- TICKET FUNCTIONS
-- ============================================================

-- Create a new V.2 ticket (lead)
CREATE OR REPLACE FUNCTION commercial_v2_create_ticket(params jsonb)
RETURNS commercial_v2_tickets AS $$
DECLARE
  new_ticket commercial_v2_tickets;
BEGIN
  INSERT INTO commercial_v2_tickets (
    ticket_type, customer_name, contact_name, contact_email,
    contact_phone, company, region, industry, revenue_potential,
    lead_owner, qualification_score, qualification_notes, missing_fields,
    stage, customer_master_id, legacy_workspace_id, batch_id
  ) VALUES (
    COALESCE((params->>'ticket_type')::text, 'proposal'),
    COALESCE(params->>'customer_name', ''),
    COALESCE(params->>'contact_name', ''),
    COALESCE(params->>'contact_email', ''),
    COALESCE(params->>'contact_phone', ''),
    COALESCE(params->>'company', ''),
    COALESCE(params->>'region', ''),
    COALESCE(params->>'industry', ''),
    COALESCE((params->>'revenue_potential')::numeric, 0),
    COALESCE(params->>'lead_owner', ''),
    COALESCE((params->>'qualification_score')::integer, 0),
    COALESCE(params->>'qualification_notes', ''),
    COALESCE(params->>'missing_fields', '{}'),
    'lead_generation',
    params->>'customer_master_id',
    params->>'legacy_workspace_id',
    params->>'batch_id'
  ) RETURNING * INTO new_ticket;

  -- Log creation
  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('ticket', new_ticket.id, 'ticket_created', 'Lead entered Pipeline V.2', COALESCE(params->>'lead_owner', 'system'));

  RETURN new_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update ticket stage
CREATE OR REPLACE FUNCTION commercial_v2_update_ticket_stage(
  p_ticket_id uuid,
  p_new_stage text,
  p_user_name text DEFAULT 'system',
  p_skip boolean DEFAULT false,
  p_notes text DEFAULT ''
)
RETURNS commercial_v2_tickets AS $$
DECLARE
  upd_ticket commercial_v2_tickets;
  old_stage text;
BEGIN
  SELECT stage INTO old_stage FROM commercial_v2_tickets WHERE id = p_ticket_id FOR UPDATE;
  UPDATE commercial_v2_tickets
  SET stage = p_new_stage,
      stage_changed_at = now(),
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, stage_from, stage_to, skipped, notes, user_name)
  VALUES ('ticket', p_ticket_id, 'stage_moved', old_stage, p_new_stage, p_skip, p_notes, p_user_name);

  RETURN upd_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update ticket qualification
CREATE OR REPLACE FUNCTION commercial_v2_update_ticket_qualification(
  p_ticket_id uuid,
  p_score integer,
  p_notes text DEFAULT '',
  p_missing_fields text[] DEFAULT '{}'
)
RETURNS commercial_v2_tickets AS $$
DECLARE
  upd_ticket commercial_v2_tickets;
BEGIN
  UPDATE commercial_v2_tickets
  SET qualification_score = p_score,
      qualification_notes = p_notes,
      missing_fields = p_missing_fields,
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('ticket', p_ticket_id, 'qualification_updated',
    'Score: ' || p_score || ' | Missing: ' || array_to_string(p_missing_fields, ', '),
    'system')
  RETURNING * INTO upd_ticket;

  RETURN upd_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PROPOSAL FUNCTIONS
-- ============================================================

-- Convert ticket to Proposal V.2
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
  -- Create proposal
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
    'appointment'
  FROM commercial_v2_tickets WHERE id = p_ticket_id
  RETURNING * INTO new_proposal;

  -- Update ticket routing
  UPDATE commercial_v2_tickets
  SET routing_decision = 'proposal',
      converted_at = now(),
      stage = 'qualified',
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;

  -- Log conversion
  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('ticket', p_ticket_id, 'converted_to_proposal',
    'Ticket routed to Proposal V.2 — Proposal ID: ' || new_proposal.id, p_lead_owner);

  RETURN new_proposal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advance proposal stage
CREATE OR REPLACE FUNCTION commercial_v2_update_proposal_stage(
  p_proposal_id uuid,
  p_new_stage text,
  p_user_name text DEFAULT 'system',
  p_skip boolean DEFAULT false,
  p_notes text DEFAULT ''
)
RETURNS commercial_v2_proposals AS $$
DECLARE
  upd_prop commercial_v2_proposals;
  old_stage text;
BEGIN
  SELECT stage INTO old_stage FROM commercial_v2_proposals WHERE id = p_proposal_id FOR UPDATE;
  UPDATE commercial_v2_proposals
  SET stage = p_new_stage,
      stage_changed_at = now(),
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO upd_prop;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, stage_from, stage_to, skipped, notes, user_name)
  VALUES ('proposal', p_proposal_id, 'stage_moved', old_stage, p_new_stage, p_skip, p_notes, p_user_name);

  RETURN upd_prop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update proposal P&L
CREATE OR REPLACE FUNCTION commercial_v2_update_proposal_pnl(
  p_proposal_id uuid,
  p_gp_percent numeric,
  p_volume_pallets numeric DEFAULT 0,
  p_volume_sar numeric DEFAULT 0,
  p_pnl_notes text DEFAULT ''
)
RETURNS commercial_v2_proposals AS $$
DECLARE
  upd_prop commercial_v2_proposals;
BEGIN
  UPDATE commercial_v2_proposals
  SET gp_percent = p_gp_percent,
      volume_pallets = p_volume_pallets,
      volume_sar = p_volume_sar,
      pnl_notes = p_pnl_notes,
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO upd_prop;
  RETURN upd_prop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set proposal document readiness flags
CREATE OR REPLACE FUNCTION commercial_v2_update_proposal_docs(
  p_proposal_id uuid,
  p_has_proposal_draft boolean DEFAULT NULL,
  p_has_pricing_sheet boolean DEFAULT NULL,
  p_has_sla_draft boolean DEFAULT NULL,
  p_has_contract_draft boolean DEFAULT NULL
)
RETURNS commercial_v2_proposals AS $$
DECLARE
  upd_prop commercial_v2_proposals;
BEGIN
  UPDATE commercial_v2_proposals
  SET has_proposal_draft = COALESCE(p_has_proposal_draft, has_proposal_draft),
      has_pricing_sheet   = COALESCE(p_has_pricing_sheet, has_pricing_sheet),
      has_sla_draft       = COALESCE(p_has_sla_draft, has_sla_draft),
      has_contract_draft  = COALESCE(p_has_contract_draft, has_contract_draft),
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO upd_prop;
  RETURN upd_prop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set proposal outcome
CREATE OR REPLACE FUNCTION commercial_v2_set_proposal_outcome(
  p_proposal_id uuid,
  p_outcome text,
  p_outcome_notes text DEFAULT ''
)
RETURNS commercial_v2_proposals AS $$
DECLARE
  upd_prop commercial_v2_proposals;
BEGIN
  UPDATE commercial_v2_proposals
  SET outcome = p_outcome,
      outcome_notes = p_outcome_notes,
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO upd_prop;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('proposal', p_proposal_id, 'outcome_set', 'Outcome: ' || p_outcome || ' — ' || p_outcome_notes, 'system');

  RETURN upd_prop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TENDER FUNCTIONS
-- ============================================================

-- Convert ticket to Tender V.2
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
    'opportunity'
  FROM commercial_v2_tickets WHERE id = p_ticket_id
  RETURNING * INTO new_tender;

  -- Update ticket routing
  UPDATE commercial_v2_tickets
  SET routing_decision = 'tender',
      converted_at = now(),
      stage = 'qualified',
      updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO upd_ticket;

  -- Log conversion
  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name, linked_tender_ws_id)
  VALUES ('ticket', p_ticket_id, 'converted_to_tender',
    'Ticket routed to Tender V.2 — Tender ID: ' || new_tender.id,
    p_lead_owner, p_tender_ws_id);

  RETURN new_tender;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advance tender stage
CREATE OR REPLACE FUNCTION commercial_v2_update_tender_stage(
  p_tender_id uuid,
  p_new_stage text,
  p_user_name text DEFAULT 'system',
  p_skip boolean DEFAULT false,
  p_notes text DEFAULT ''
)
RETURNS commercial_v2_tenders AS $$
DECLARE
  upd_tender commercial_v2_tenders;
  old_stage text;
BEGIN
  SELECT stage INTO old_stage FROM commercial_v2_tenders WHERE id = p_tender_id FOR UPDATE;
  UPDATE commercial_v2_tenders
  SET stage = p_new_stage,
      stage_changed_at = now(),
      updated_at = now()
  WHERE id = p_tender_id
  RETURNING * INTO upd_tender;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, stage_from, stage_to, skipped, notes, user_name)
  VALUES ('tender', p_tender_id, 'stage_moved', old_stage, p_new_stage, p_skip, p_notes, p_user_name);

  RETURN upd_tender;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update tender checklist flags
CREATE OR REPLACE FUNCTION commercial_v2_update_tender_checklist(
  p_tender_id uuid,
  p_section text,
  p_complete boolean
)
RETURNS commercial_v2_tenders AS $$
DECLARE
  upd_tender commercial_v2_tenders;
BEGIN
  CASE p_section
    WHEN 'qualification' THEN UPDATE commercial_v2_tenders SET qualification_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'registration'  THEN UPDATE commercial_v2_tenders SET registration_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'required_docs' THEN UPDATE commercial_v2_tenders SET required_docs_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'compliance'    THEN UPDATE commercial_v2_tenders SET compliance_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'technical'    THEN UPDATE commercial_v2_tenders SET technical_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'commercial'   THEN UPDATE commercial_v2_tenders SET commercial_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'ops_review'   THEN UPDATE commercial_v2_tenders SET ops_review_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'finance_review' THEN UPDATE commercial_v2_tenders SET finance_review_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'legal'        THEN UPDATE commercial_v2_tenders SET legal_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'pricing'      THEN UPDATE commercial_v2_tenders SET pricing_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'committee'   THEN UPDATE commercial_v2_tenders SET committee_complete = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
    WHEN 'submission'  THEN UPDATE commercial_v2_tenders SET submission_ready = p_complete, updated_at = now() WHERE id = p_tender_id RETURNING * INTO upd_tender;
  END CASE;

  SELECT * INTO upd_tender FROM commercial_v2_tenders WHERE id = p_tender_id;
  RETURN upd_tender;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set tender outcome
CREATE OR REPLACE FUNCTION commercial_v2_set_tender_outcome(
  p_tender_id uuid,
  p_outcome text,
  p_outcome_notes text DEFAULT ''
)
RETURNS commercial_v2_tenders AS $$
DECLARE
  upd_tender commercial_v2_tenders;
BEGIN
  UPDATE commercial_v2_tenders
  SET outcome = p_outcome,
      outcome_notes = p_outcome_notes,
      updated_at = now()
  WHERE id = p_tender_id
  RETURNING * INTO upd_tender;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('tender', p_tender_id, 'outcome_set', 'Outcome: ' || p_outcome || ' — ' || p_outcome_notes, 'system');

  RETURN upd_tender;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DOCUMENT FUNCTIONS
-- ============================================================

-- Upload document to parent workspace
CREATE OR REPLACE FUNCTION commercial_v2_create_document(params jsonb)
RETURNS commercial_v2_documents AS $$
DECLARE
  new_doc commercial_v2_documents;
  v_parent_type text := COALESCE(params->>'parent_type', '');
  v_doc_type text := COALESCE(params->>'document_type', '');
  v_status text;
BEGIN
  -- Validate doc type matches parent type
  IF v_parent_type = 'proposal' AND v_doc_type NOT IN ('proposal_draft','pricing_sheet','sla_draft','contract_draft') THEN
    RAISE EXCEPTION 'Invalid document type % for parent proposal', v_doc_type;
  ELSIF v_parent_type = 'tender' AND v_doc_type NOT IN ('tender_pack','compliance_cert','legal_doc','insurance_cert','pricing_doc','submission_pack') THEN
    RAISE EXCEPTION 'Invalid document type % for parent tender', v_doc_type;
  ELSIF v_parent_type = 'customer' AND v_doc_type NOT IN ('account_review','meeting_correspondence') THEN
    RAISE EXCEPTION 'Invalid document type % for parent customer', v_doc_type;
  ELSIF v_parent_type = 'contract' AND v_doc_type NOT IN ('signed_contract','amendment') THEN
    RAISE EXCEPTION 'Invalid document type % for parent contract', v_doc_type;
  END IF;

  INSERT INTO commercial_v2_documents (
    parent_type, parent_id, doc_instance_id, doc_vault_asset_id,
    document_type, file_name, file_size, mime_type, storage_ref,
    status, version_number, uploaded_by, notes
  ) VALUES (
    v_parent_type,
    (params->>'parent_id')::uuid,
    params->>'doc_instance_id',
    params->>'doc_vault_asset_id',
    v_doc_type,
    COALESCE(params->>'file_name', ''),
    COALESCE(params->>'file_size', ''),
    COALESCE(params->>'mime_type', ''),
    params->>'storage_ref',
    'draft',
    1,
    COALESCE(params->>'uploaded_by', 'system'),
    COALESCE(params->>'notes', '')
  ) RETURNING * INTO new_doc;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('document', new_doc.id, 'document_uploaded',
    'Doc: ' || v_doc_type || ' | Parent: ' || v_parent_type || '/' || (params->>'parent_id')::text,
    COALESCE(params->>'uploaded_by', 'system'));

  RETURN new_doc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update document status (draft → submitted → approved → expired)
CREATE OR REPLACE FUNCTION commercial_v2_update_document_status(
  p_doc_id uuid,
  p_status text,
  p_user_name text DEFAULT 'system'
)
RETURNS commercial_v2_documents AS $$
DECLARE
  upd_doc commercial_v2_documents;
BEGIN
  IF p_status NOT IN ('draft','submitted','approved','expired') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE commercial_v2_documents
  SET status = p_status,
      updated_at = now()
  WHERE id = p_doc_id
  RETURNING * INTO upd_doc;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('document', p_doc_id, 'document_status_changed', 'Status → ' || p_status, p_user_name);

  RETURN upd_doc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- APPROVAL FUNCTIONS
-- ============================================================

-- Run approval check (creates log entry, no block)
CREATE OR REPLACE FUNCTION commercial_v2_run_approval_check(
  p_workspace_type text,
  p_workspace_id uuid,
  p_gp_percent numeric DEFAULT 0,
  p_volume_pallets numeric DEFAULT 0,
  p_volume_sar numeric DEFAULT 0,
  p_region text DEFAULT '',
  p_opp_type text DEFAULT '',
  p_matrix_rule jsonb DEFAULT 'null'::jsonb,
  p_required_approver text DEFAULT 'director',
  p_recommended_approvers text[] DEFAULT '{}'
)
RETURNS commercial_v2_approvals AS $$
DECLARE
  new_approval commercial_v2_approvals;
BEGIN
  INSERT INTO commercial_v2_approvals (
    workspace_type, workspace_id,
    gp_percent, volume_pallets, volume_sar,
    region, opp_type,
    approval_matrix_rule, required_approver, recommended_approvers,
    approval_status
  ) VALUES (
    p_workspace_type, p_workspace_id,
    p_gp_percent, p_volume_pallets, p_volume_sar,
    p_region, p_opp_type,
    p_matrix_rule, p_required_approver, p_recommended_approvers,
    'pending'
  ) RETURNING * INTO new_approval;

  RETURN new_approval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Override approval (logs reason, no block)
CREATE OR REPLACE FUNCTION commercial_v2_override_approval(
  p_approval_id uuid,
  p_override_reason text,
  p_overridden_by text DEFAULT 'system'
)
RETURNS commercial_v2_approvals AS $$
DECLARE
  upd_approval commercial_v2_approvals;
BEGIN
  IF p_override_reason IS NULL OR length(p_override_reason) < 5 THEN
    RAISE EXCEPTION 'Override reason must be at least 5 characters';
  END IF;

  UPDATE commercial_v2_approvals
  SET overridden = true,
      override_reason = p_override_reason,
      overridden_by = p_overridden_by,
      overridden_at = now()
  WHERE id = p_approval_id
  RETURNING * INTO upd_approval;

  INSERT INTO commercial_v2_activity (entity_type, entity_id, action, notes, user_name)
  VALUES ('approval', p_approval_id, 'approval_overridden',
    'Reason: ' || p_override_reason || ' | By: ' || p_overridden_by, p_overridden_by);

  RETURN upd_approval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ACTIVITY LOG FUNCTION
-- ============================================================

-- Generic activity log entry
CREATE OR REPLACE FUNCTION commercial_v2_log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_notes text DEFAULT '',
  p_user_name text DEFAULT 'system',
  p_linked_workspace_id text DEFAULT NULL,
  p_linked_tender_ws_id text DEFAULT NULL
)
RETURNS commercial_v2_activity AS $$
DECLARE
  new_entry commercial_v2_activity;
BEGIN
  INSERT INTO commercial_v2_activity (
    entity_type, entity_id, action, notes, user_name,
    linked_workspace_id, linked_tender_ws_id
  ) VALUES (
    p_entity_type, p_entity_id, p_action,
    p_notes, p_user_name,
    p_linked_workspace_id, p_linked_tender_ws_id
  ) RETURNING * INTO new_entry;

  RETURN new_entry;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;