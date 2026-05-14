-- ============================================================
-- DOC-001: Document Vault
-- Artifact governance for Commercial OS documents.
-- Read-only metadata registry. Source files remain system-of-record.
-- Vault does not replace source truth.
-- No CRM. No gates. No file deletion.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_vault (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type         text NOT NULL DEFAULT 'source_import',
  document_title        text NOT NULL DEFAULT '',
  related_entity_type   text NOT NULL DEFAULT 'import',
  related_entity_id     text,
  source_batch_id       text,
  source_system         text NOT NULL DEFAULT 'commercial_os',
  source_file_name      text NOT NULL DEFAULT '',
  storage_reference     text,
  version_number        integer NOT NULL DEFAULT 1,
  version_status        text NOT NULL DEFAULT 'active',
  truth_status          text NOT NULL DEFAULT 'snapshot',
  confidence_tier       integer NOT NULL DEFAULT 4,
  source_lineage        text NOT NULL DEFAULT '',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_by            text NOT NULL DEFAULT 'system',
  notes                 text NOT NULL DEFAULT '',
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dv_type     ON document_vault(document_type);
CREATE INDEX IF NOT EXISTS idx_dv_entity   ON document_vault(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_dv_batch    ON document_vault(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_dv_status   ON document_vault(version_status);

-- RLS — read-only
ALTER TABLE document_vault ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_vault' AND policyname = 'document_vault_read_all'
  ) THEN
    CREATE POLICY document_vault_read_all ON document_vault FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- Seed: Register existing system artifacts as vault entries
-- Uses ON CONFLICT DO NOTHING pattern for idempotency
-- ============================================================

INSERT INTO document_vault (id, document_type, document_title, related_entity_type, source_system, source_file_name, version_status, truth_status, confidence_tier, source_lineage, notes)
VALUES
  ('d0c-imp-001', 'source_import', 'Commercial Pipeline Import (Excel)', 'import', 'excel_import', 'Hala_Commercial_Pipeline.xlsx', 'active', 'snapshot', 3, 'Excel workbook → Supabase batch import', 'Primary pipeline data source. Contains opportunities, stages, ACV, owners.'),
  ('d0c-imp-002', 'source_import', 'Revenue Actuals Import (GL)', 'import', 'excel_import', 'Revenue_Actuals_GL.xlsx', 'active', 'snapshot', 3, 'GL export → Supabase batch import', 'Monthly GL revenue actuals by customer and GL code.'),
  ('d0c-imp-003', 'source_import', 'Capacity Snapshots Import', 'import', 'excel_import', 'Warehouse_Capacity.xlsx', 'active', 'snapshot', 3, 'Capacity workbook → Supabase batch import', 'Warehouse capacity, sellable, committed, utilization snapshots.'),
  ('d0c-imp-004', 'source_import', 'Closed Won Deals Import', 'import', 'excel_import', 'Closed_Won_Deals.xlsx', 'active', 'snapshot', 3, 'Closed won sheet → Supabase batch import', 'Booked/won deals with ACV, go-live, warehouse.'),
  ('d0c-rpt-001', 'monthly_report', 'RPT-001 Monthly Commercial Report', 'report', 'commercial_os', 'CommercialOsMonthlyReport.tsx', 'active', 'computed', 2, 'Commercial OS → client-side report generation', '7-section leadership report generated from live OS data.'),
  ('d0c-rpt-002', 'customer_review_pack', 'RPT-002 Customer Review Pack Template', 'report', 'commercial_os', 'CommercialOsCustomerReviewPack.tsx', 'active', 'computed', 2, 'Commercial OS → per-customer MBR/QBR pack', '8-section customer review pack for internal leadership.'),
  ('d0c-reg-001', 'governance_pack', 'Assumption Registry (ASSUMP-001)', 'finance', 'commercial_os', 'default_assumptions', 'active', 'registered', 2, 'Supabase table: default_assumptions', 'Registered assumptions with confidence tiers and governance owners.'),
  ('d0c-reg-002', 'governance_pack', 'KPI Source Registry (DATA-003B)', 'ops', 'commercial_os', 'kpi_source_registry', 'active', 'registered', 2, 'Supabase table: kpi_source_registry', 'KPI definitions, formulas, source mappings.'),
  ('d0c-fin-001', 'finance_snapshot', 'GP Engine V2 Schema (GP-002)', 'finance', 'commercial_os', 'gp_deal_cost_basis', 'active', 'registered', 2, 'Supabase table: gp_deal_cost_basis', 'Deal-level GP cost basis for verified vs assumed split.'),
  ('d0c-tnd-001', 'tender_reference', 'Linde SIGAS Transportation Tender', 'tender', 'tender_workspace', 'tn-linde-001', 'active', 'reference', 3, 'Tender workspace → vault reference only', 'SAR 55.6M tender. Reference only — vault does not modify tender.')
ON CONFLICT (id) DO NOTHING;
