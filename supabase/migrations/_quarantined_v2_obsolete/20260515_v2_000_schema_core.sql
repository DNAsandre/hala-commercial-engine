-- ============================================================
-- V2-000: Commercial V.2 Schema + Data Spine
-- Read-only foundation for V.2 operational layer.
-- No CRM. No hard gates. No legacy mutation.
-- All tables: SELECT-only RLS. Writes go through app layer.
-- ============================================================

-- ============================================================
-- 1. commercial_v2_tickets — Master intake object
-- One ticket routes to Proposal V.2 or Tender V.2
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_tickets (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Routing
  ticket_type               text NOT NULL CHECK (ticket_type IN ('proposal', 'tender')),
  routing_decision          text CHECK (routing_decision IN ('proposal', 'tender', 'lost')),
  converted_at              timestamptz,
  -- Core fields
  customer_name              text NOT NULL DEFAULT '',
  contact_name               text DEFAULT '',
  contact_email              text DEFAULT '',
  contact_phone              text DEFAULT '',
  company                    text DEFAULT '',
  region                     text DEFAULT '',
  industry                   text DEFAULT '',
  revenue_potential          numeric DEFAULT 0,
  lead_owner                 text NOT NULL DEFAULT '',
  -- Qualification
  qualification_score        integer DEFAULT 0,
  qualification_notes       text DEFAULT '',
  missing_fields             text[] DEFAULT '{}',
  -- V.2 Stage: Lead Gen → Prospecting → Research → Qualification → Route
  stage                     text NOT NULL DEFAULT 'lead_generation',
  stage_changed_at           timestamptz NOT NULL DEFAULT now(),
  -- Optional legacy links (read-only references — no FK enforced)
  customer_master_id         text,
  legacy_workspace_id        text,
  -- Metadata
  batch_id                  text,
  active                    boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2t_type        ON commercial_v2_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_v2t_stage       ON commercial_v2_tickets(stage);
CREATE INDEX IF NOT EXISTS idx_v2t_owner       ON commercial_v2_tickets(lead_owner);
CREATE INDEX IF NOT EXISTS idx_v2t_region      ON commercial_v2_tickets(region);
CREATE INDEX IF NOT EXISTS idx_v2t_active      ON commercial_v2_tickets(active);
CREATE INDEX IF NOT EXISTS idx_v2t_routing     ON commercial_v2_tickets(routing_decision);

-- ============================================================
-- 2. commercial_v2_proposals — Proposal path details
-- Links back to commercial_v2_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_proposals (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  v2_ticket_id              uuid REFERENCES commercial_v2_tickets(id) ON DELETE SET NULL,
  -- Optional legacy links (read-only)
  customer_master_id         text,
  legacy_workspace_id        text,
  -- Client
  customer_name              text NOT NULL DEFAULT '',
  contact_name               text DEFAULT '',
  -- Proposal V.2 Stage (9 stages)
  stage                     text NOT NULL DEFAULT 'appointment',
  stage_changed_at           timestamptz NOT NULL DEFAULT now(),
  -- P&L
  gp_percent                 numeric DEFAULT 0,
  volume_pallets             numeric DEFAULT 0,
  volume_sar                 numeric DEFAULT 0,
  pnl_notes                 text DEFAULT '',
  -- Document readiness (derived from commercial_v2_documents)
  has_proposal_draft         boolean DEFAULT false,
  has_pricing_sheet          boolean DEFAULT false,
  has_sla_draft              boolean DEFAULT false,
  has_contract_draft         boolean DEFAULT false,
  -- Outcome
  outcome                   text CHECK (outcome IN ('won', 'lost', 'open')),
  outcome_notes             text DEFAULT '',
  -- Metadata
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2p_ticket      ON commercial_v2_proposals(v2_ticket_id);
CREATE INDEX IF NOT EXISTS idx_v2p_stage       ON commercial_v2_proposals(stage);
CREATE INDEX IF NOT EXISTS idx_v2p_customer    ON commercial_v2_proposals(customer_name);
CREATE INDEX IF NOT EXISTS idx_v2p_outcome     ON commercial_v2_proposals(outcome);

-- ============================================================
-- 3. commercial_v2_tenders — Tender path details
-- Linde-safe: tender_ws_id is text only, no FK
-- Links back to commercial_v2_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_tenders (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  v2_ticket_id              uuid REFERENCES commercial_v2_tickets(id) ON DELETE SET NULL,
  -- Optional legacy links (read-only)
  customer_master_id         text,
  legacy_workspace_id        text,
  tender_ws_id              text,  -- No FK — Linde workspace reference only
  tender_ref                text DEFAULT '',
  -- Client
  customer_name              text NOT NULL DEFAULT '',
  -- Tender V.2 Stage (12 stages)
  stage                     text NOT NULL DEFAULT 'opportunity',
  stage_changed_at           timestamptz NOT NULL DEFAULT now(),
  -- Checklist completeness flags
  qualification_complete     boolean DEFAULT false,
  registration_complete      boolean DEFAULT false,
  required_docs_complete     boolean DEFAULT false,
  compliance_complete        boolean DEFAULT false,
  technical_complete         boolean DEFAULT false,
  commercial_complete        boolean DEFAULT false,
  ops_review_complete        boolean DEFAULT false,
  finance_review_complete    boolean DEFAULT false,
  legal_complete             boolean DEFAULT false,
  pricing_complete           boolean DEFAULT false,
  committee_complete         boolean DEFAULT false,
  submission_ready           boolean DEFAULT false,
  -- Outcome
  outcome                   text CHECK (outcome IN ('awarded', 'lost', 'open')),
  outcome_notes             text DEFAULT '',
  -- Metadata
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2tn_ticket     ON commercial_v2_tenders(v2_ticket_id);
CREATE INDEX IF NOT EXISTS idx_v2tn_stage      ON commercial_v2_tenders(stage);
CREATE INDEX IF NOT EXISTS idx_v2tn_customer   ON commercial_v2_tenders(customer_name);
CREATE INDEX IF NOT EXISTS idx_v2tn_tender_ref ON commercial_v2_tenders(tender_ref);
CREATE INDEX IF NOT EXISTS idx_v2tn_outcome    ON commercial_v2_tenders(outcome);

-- ============================================================
-- 4. commercial_v2_documents — Linked docs only
-- Parent workspace required on upload
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_documents (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Parent anchor
  parent_type               text NOT NULL CHECK (parent_type IN ('ticket', 'proposal', 'tender', 'customer', 'contract')),
  parent_id                 uuid NOT NULL,
  -- Optional legacy links
  doc_instance_id           text,
  doc_vault_asset_id         text,
  -- Document identification
  document_type             text NOT NULL,
  -- Valid doc types per parent:
  -- proposal:     proposal_draft | pricing_sheet | sla_draft | contract_draft
  -- tender:       tender_pack | compliance_cert | legal_doc | insurance_cert | pricing_doc | submission_pack
  -- customer:     account_review | meeting_correspondence
  -- contract:     signed_contract | amendment
  file_name                 text NOT NULL DEFAULT '',
  file_size                 text DEFAULT '',
  mime_type                 text DEFAULT '',
  storage_ref               text,
  -- Status
  status                    text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'expired')),
  version_number            integer DEFAULT 1,
  -- Audit
  uploaded_by               text DEFAULT '',
  notes                     text DEFAULT '',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2d_parent      ON commercial_v2_documents(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_v2d_doc_type    ON commercial_v2_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_v2d_status      ON commercial_v2_documents(status);
CREATE INDEX IF NOT EXISTS idx_v2d_uploaded   ON commercial_v2_documents(uploaded_by);

-- ============================================================
-- 5. commercial_v2_approvals — Soft approval matrix logs
-- Approval rule stored as configurable jsonb
-- Matrix inputs: pallet volume + GP band → approver level
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_approvals (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_type            text NOT NULL CHECK (workspace_type IN ('proposal', 'tender')),
  workspace_id              uuid NOT NULL,
  -- Matrix inputs
  gp_percent                 numeric DEFAULT 0,
  volume_pallets             numeric DEFAULT 0,
  volume_sar                 numeric DEFAULT 0,
  region                     text DEFAULT '',
  opp_type                   text DEFAULT '',
  -- Stored approval matrix rule (jsonb — configurable, not hard-coded)
  -- Format: { "band": "A/B/C", "pallets_min": N, "pallets_max": N, "approver": "Director/CFO/CEO" }
  approval_matrix_rule      jsonb DEFAULT 'null'::jsonb,
  -- Recommendation
  required_approver          text DEFAULT 'director',
  recommended_approvers      text[] DEFAULT '{}',
  -- Override
  overridden                 boolean NOT NULL DEFAULT false,
  override_reason            text DEFAULT '',
  overridden_by              text DEFAULT '',
  overridden_at              timestamptz,
  -- Final
  final_approver             text DEFAULT '',
  approval_status            text DEFAULT 'pending',
  -- Optional legacy link
  legacy_approval_id         text,
  -- Metadata
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2a_workspace   ON commercial_v2_approvals(workspace_type, workspace_id);
CREATE INDEX IF NOT EXISTS idx_v2a_status      ON commercial_v2_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_v2a_overridden  ON commercial_v2_approvals(overridden);

-- ============================================================
-- 6. commercial_v2_activity — V.2 timeline log
-- Read-only in UI. No enforcement. No hard gates.
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_v2_activity (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type               text NOT NULL,
  entity_id                 uuid NOT NULL,
  action                    text NOT NULL,
  -- Actions: stage_moved | stage_skipped | converted_to_proposal |
  --          converted_to_tender | approval_overridden | document_uploaded |
  --          missing_info_logged | note_added | qualification_updated
  stage_from                text,
  stage_to                  text,
  skipped                   boolean DEFAULT false,
  notes                     text DEFAULT '',
  user_name                 text DEFAULT '',
  -- Optional legacy links
  linked_workspace_id      text,
  linked_tender_ws_id       text,
  -- Metadata
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2al_entity     ON commercial_v2_activity(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_v2al_action     ON commercial_v2_activity(action);
CREATE INDEX IF NOT EXISTS idx_v2al_user       ON commercial_v2_activity(user_name);
CREATE INDEX IF NOT EXISTS idx_v2al_created    ON commercial_v2_activity(created_at DESC);

-- ============================================================
-- RLS — all V.2 tables: SELECT-only policies
-- Writes go through app-layer insert/update functions
-- ============================================================
ALTER TABLE commercial_v2_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_v2_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_v2_tenders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_v2_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_v2_approvals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_v2_activity   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_tickets' AND policyname = 'v2_tickets_read_all') THEN
    CREATE POLICY v2_tickets_read_all ON commercial_v2_tickets FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_proposals' AND policyname = 'v2_proposals_read_all') THEN
    CREATE POLICY v2_proposals_read_all ON commercial_v2_proposals FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_tenders' AND policyname = 'v2_tenders_read_all') THEN
    CREATE POLICY v2_tenders_read_all ON commercial_v2_tenders FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_documents' AND policyname = 'v2_documents_read_all') THEN
    CREATE POLICY v2_documents_read_all ON commercial_v2_documents FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_approvals' AND policyname = 'v2_approvals_read_all') THEN
    CREATE POLICY v2_approvals_read_all ON commercial_v2_approvals FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_v2_activity' AND policyname = 'v2_activity_read_all') THEN
    CREATE POLICY v2_activity_read_all ON commercial_v2_activity FOR SELECT USING (true);
  END IF;
END $$;