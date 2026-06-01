-- ============================================================
-- Hala Commercial Engine
-- Supabase Forensic Audit - READ ONLY
-- Date: 2026-05-21
--
-- Purpose:
--   Inspect live Supabase for duplicate source-of-truth tables,
--   legacy/V2 ghosts, seeded Linde artifacts, mock/test residue,
--   orphaned tender child rows, and source-lineage gaps.
--
-- Hard rule:
--   This file is SELECT-only. It does not update, delete, drop,
--   create persistent objects, or mutate business data.
--
-- How to use:
--   1. Paste the whole file into Supabase SQL Editor.
--   2. Run it.
--   3. Export or copy every result panel back into the review thread.
--   4. Do not run cleanup SQL until a separate human-approved plan exists.
-- ============================================================

SELECT 'AUDIT START - READ ONLY - NO DATA MUTATION' AS audit_notice;

-- ============================================================
-- 1. Table inventory and exact row counts
-- ============================================================

WITH target_tables(table_group, table_name, rel) AS (
  VALUES
    ('canonical', 'commercial_tickets', 'public.commercial_tickets'),
    ('canonical', 'commercial_ticket_audit', 'public.commercial_ticket_audit'),

    ('legacy_master', 'tenders', 'public.tenders'),
    ('legacy_master', 'commercial_opportunities', 'public.commercial_opportunities'),
    ('legacy_master', 'proposals', 'public.proposals'),
    ('legacy_master', 'slas', 'public.slas'),

    ('proposal_child', 'commercial_proposal_versions', 'public.commercial_proposal_versions'),
    ('renewal_child', 'renewal_workspaces', 'public.renewal_workspaces'),
    ('renewal_child', 'contract_baselines', 'public.contract_baselines'),
    ('sla_child', 'commercial_sla_drafts', 'public.commercial_sla_drafts'),
    ('sla_child', 'contract_status', 'public.contract_status'),

    ('escalation', 'commercial_escalations', 'public.commercial_escalations'),
    ('escalation', 'escalation_events', 'public.escalation_events'),
    ('escalation', 'escalation_tasks', 'public.escalation_tasks'),
    ('escalation', 'commercial_mock_escalations', 'public.commercial_mock_escalations'),

    ('tender_child', 'tender_packs', 'public.tender_packs'),
    ('tender_child', 'tender_pack_sections', 'public.tender_pack_sections'),
    ('tender_child', 'tender_placeholders', 'public.tender_placeholders'),
    ('tender_child', 'tender_required_documents', 'public.tender_required_documents'),
    ('tender_child', 'tender_compliance_items', 'public.tender_compliance_items'),
    ('tender_child', 'tender_submission_gates', 'public.tender_submission_gates'),
    ('tender_child', 'tender_activity_events', 'public.tender_activity_events'),
    ('tender_child', 'tender_audit_events', 'public.tender_audit_events'),
    ('tender_child', 'tender_split_checks', 'public.tender_split_checks'),
    ('tender_child', 'tender_pack_outputs', 'public.tender_pack_outputs'),
    ('tender_child', 'tender_submission_emails', 'public.tender_submission_emails'),
    ('tender_child', 'tender_submission_email_attachments', 'public.tender_submission_email_attachments'),

    ('supporting', 'document_vault', 'public.document_vault'),
    ('supporting', 'transportation_opportunities', 'public.transportation_opportunities'),
    ('supporting', 'transportation_customer_links', 'public.transportation_customer_links'),
    ('supporting', 'customer_master', 'public.customer_master'),
    ('supporting', 'customer_aliases', 'public.customer_aliases'),
    ('supporting', 'customer_source_links', 'public.customer_source_links'),

    ('v2_obsolete', 'commercial_v2_tickets', 'public.commercial_v2_tickets'),
    ('v2_obsolete', 'commercial_v2_proposals', 'public.commercial_v2_proposals'),
    ('v2_obsolete', 'commercial_v2_tenders', 'public.commercial_v2_tenders'),
    ('v2_obsolete', 'commercial_v2_documents', 'public.commercial_v2_documents'),
    ('v2_obsolete', 'commercial_v2_activity', 'public.commercial_v2_activity'),
    ('v2_obsolete', 'commercial_v2_approvals', 'public.commercial_v2_approvals')
)
SELECT
  table_group,
  table_name,
  rel,
  to_regclass(rel) IS NOT NULL AS exists_in_db,
  CASE
    WHEN to_regclass(rel) IS NULL THEN NULL
    ELSE ((xpath('//c/text()', query_to_xml(format('select count(*)::bigint as c from %s', rel), false, true, '')))[1])::text::bigint
  END AS row_count
FROM target_tables
ORDER BY table_group, table_name;

-- ============================================================
-- 2. Columns that still carry mock/test vocabulary
-- ============================================================

SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%mock%'
    OR column_name ILIKE '%test%'
    OR coalesce(column_default, '') ILIKE '%mock%'
    OR coalesce(column_default, '') ILIKE '%test%'
  )
ORDER BY table_name, ordinal_position;

-- ============================================================
-- 3. Canonical ticket snapshot
-- ============================================================

SELECT
  'canonical_commercial_tickets' AS audit_name,
  CASE
    WHEN to_regclass('public.commercial_tickets') IS NULL THEN 'TABLE_NOT_FOUND'
    ELSE query_to_xml($$
      SELECT
        id,
        ticket_type,
        ticket_title,
        customer_name,
        customer_id,
        owner,
        region,
        crm_pipeline_stage,
        internal_stage,
        estimated_value,
        target_gp_percent,
        probability_percent,
        target_date,
        source_type,
        source_reference,
        source_file,
        source_sheet,
        source_row_id,
        source_document_id,
        lineage_status,
        verified_by,
        verified_at,
        legacy_workspace_id,
        legacy_opportunity_id,
        legacy_tender_id,
        active,
        created_at,
        updated_at
      FROM public.commercial_tickets
      ORDER BY created_at DESC
      LIMIT 200
    $$, false, true, '')::text
  END AS result_xml;

-- ============================================================
-- 4. Canonical lineage gaps
-- ============================================================

SELECT
  'commercial_tickets_lineage_gaps' AS audit_name,
  CASE
    WHEN to_regclass('public.commercial_tickets') IS NULL THEN 'TABLE_NOT_FOUND'
    ELSE query_to_xml($$
      SELECT
        id,
        ticket_type,
        ticket_title,
        customer_name,
        crm_pipeline_stage,
        internal_stage,
        lineage_status,
        source_type,
        source_reference,
        source_file,
        source_sheet,
        source_row_id,
        source_document_id,
        created_at
      FROM public.commercial_tickets
      WHERE active IS TRUE
        AND (
          lineage_status IS NULL
          OR source_type IS NULL
          OR (
            NULLIF(trim(coalesce(source_reference, '')), '') IS NULL
            AND NULLIF(trim(coalesce(source_file, '')), '') IS NULL
            AND NULLIF(trim(coalesce(source_document_id, '')), '') IS NULL
          )
        )
      ORDER BY created_at DESC
      LIMIT 200
    $$, false, true, '')::text
  END AS result_xml;

-- ============================================================
-- 5. Duplicate identity candidates inside canonical tickets
-- ============================================================

SELECT
  'canonical_duplicate_identity_candidates' AS audit_name,
  CASE
    WHEN to_regclass('public.commercial_tickets') IS NULL THEN 'TABLE_NOT_FOUND'
    ELSE query_to_xml($$
      SELECT
        lower(trim(coalesce(customer_name, ''))) AS customer_key,
        ticket_type,
        count(*) AS record_count,
        array_agg(id::text ORDER BY created_at DESC) AS ticket_ids,
        array_agg(coalesce(ticket_title, '') ORDER BY created_at DESC) AS titles
      FROM public.commercial_tickets
      WHERE active IS TRUE
      GROUP BY lower(trim(coalesce(customer_name, ''))), ticket_type
      HAVING count(*) > 1
      ORDER BY record_count DESC, customer_key, ticket_type
    $$, false, true, '')::text
  END AS result_xml;

-- ============================================================
-- 6. Legacy master table samples
-- ============================================================

WITH legacy_samples(label, rel) AS (
  VALUES
    ('legacy_tenders', 'public.tenders'),
    ('legacy_commercial_opportunities', 'public.commercial_opportunities'),
    ('legacy_proposals', 'public.proposals'),
    ('legacy_slas', 'public.slas'),
    ('legacy_commercial_mock_escalations', 'public.commercial_mock_escalations')
)
SELECT
  label AS audit_name,
  CASE
    WHEN to_regclass(rel) IS NULL THEN 'TABLE_NOT_FOUND'
    ELSE query_to_xml(format('select * from %s limit 100', rel), false, true, '')::text
  END AS result_xml
FROM legacy_samples
ORDER BY label;

-- ============================================================
-- 7. Tender child parent map
--    Shows whether tender child rows point to legacy tenders or
--    canonical commercial_tickets.
-- ============================================================

SELECT
  'tender_child_parent_map' AS audit_name,
  CASE
    WHEN NOT (
      to_regclass('public.tender_packs') IS NOT NULL
      AND to_regclass('public.tenders') IS NOT NULL
      AND to_regclass('public.commercial_tickets') IS NOT NULL
    ) THEN 'SKIPPED_MISSING_REQUIRED_TABLES'
    ELSE query_to_xml($$
      WITH child_refs AS (
        SELECT 'tender_packs' AS child_table, tender_workspace_id::text AS parent_id, count(*)::bigint AS row_count
        FROM public.tender_packs
        GROUP BY tender_workspace_id

        UNION ALL
        SELECT 'tender_pack_sections', p.tender_workspace_id::text, count(*)::bigint
        FROM public.tender_pack_sections s
        LEFT JOIN public.tender_packs p ON p.id = s.pack_id
        GROUP BY p.tender_workspace_id

        UNION ALL
        SELECT 'tender_placeholders', p.tender_workspace_id::text, count(*)::bigint
        FROM public.tender_placeholders ph
        LEFT JOIN public.tender_packs p ON p.id = ph.pack_id
        GROUP BY p.tender_workspace_id

        UNION ALL
        SELECT 'tender_required_documents', p.tender_workspace_id::text, count(*)::bigint
        FROM public.tender_required_documents d
        LEFT JOIN public.tender_packs p ON p.id = d.pack_id
        GROUP BY p.tender_workspace_id

        UNION ALL
        SELECT 'tender_compliance_items', p.tender_workspace_id::text, count(*)::bigint
        FROM public.tender_compliance_items c
        LEFT JOIN public.tender_packs p ON p.id = c.pack_id
        GROUP BY p.tender_workspace_id

        UNION ALL
        SELECT 'tender_submission_gates', coalesce(g.tender_workspace_id, g.tender_workspace_id_col)::text, count(*)::bigint
        FROM public.tender_submission_gates g
        GROUP BY coalesce(g.tender_workspace_id, g.tender_workspace_id_col)

        UNION ALL
        SELECT 'tender_activity_events', workspace_id::text, count(*)::bigint
        FROM public.tender_activity_events
        GROUP BY workspace_id

        UNION ALL
        SELECT 'tender_audit_events', workspace_id::text, count(*)::bigint
        FROM public.tender_audit_events
        GROUP BY workspace_id

        UNION ALL
        SELECT 'tender_split_checks', tender_workspace_id::text, count(*)::bigint
        FROM public.tender_split_checks
        GROUP BY tender_workspace_id

        UNION ALL
        SELECT 'tender_pack_outputs', tender_workspace_id::text, count(*)::bigint
        FROM public.tender_pack_outputs
        GROUP BY tender_workspace_id

        UNION ALL
        SELECT 'tender_submission_emails', tender_workspace_id::text, count(*)::bigint
        FROM public.tender_submission_emails
        GROUP BY tender_workspace_id
      )
      SELECT
        child_table,
        coalesce(parent_id, '[NULL_PARENT]') AS parent_id,
        sum(row_count) AS row_count,
        CASE WHEN t.id IS NULL THEN false ELSE true END AS parent_exists_in_legacy_tenders,
        CASE WHEN ct.id IS NULL THEN false ELSE true END AS parent_exists_in_commercial_tickets,
        ct.ticket_type AS canonical_ticket_type,
        ct.ticket_title AS canonical_ticket_title,
        ct.customer_name AS canonical_customer_name
      FROM child_refs cr
      LEFT JOIN public.tenders t ON t.id = cr.parent_id
      LEFT JOIN public.commercial_tickets ct ON ct.id::text = cr.parent_id
      GROUP BY
        child_table,
        parent_id,
        t.id,
        ct.id,
        ct.ticket_type,
        ct.ticket_title,
        ct.customer_name
      ORDER BY child_table, parent_id
    $$, false, true, '')::text
  END AS result_xml;

-- ============================================================
-- 8. Tender mock/test/Linde contamination fingerprints
-- ============================================================

SELECT
  'tender_contamination_fingerprints' AS audit_name,
  CASE
    WHEN NOT (
      to_regclass('public.tender_packs') IS NOT NULL
      AND to_regclass('public.tender_submission_gates') IS NOT NULL
      AND to_regclass('public.tender_pack_outputs') IS NOT NULL
      AND to_regclass('public.tender_submission_emails') IS NOT NULL
    ) THEN 'SKIPPED_MISSING_REQUIRED_TABLES'
    ELSE query_to_xml($$
      WITH hits AS (
        SELECT
          'tender_packs' AS source_table,
          id::text AS row_id,
          tender_workspace_id::text AS parent_id,
          concat_ws(' | ', pack_name, status, mock_warnings::text, mock_actions::text) AS evidence
        FROM public.tender_packs
        WHERE concat_ws(' | ', pack_name, status, mock_warnings::text, mock_actions::text)
          ILIKE ANY (ARRAY['%mock%', '%test output%', '%draft_mock%', '%ready_mock%', '%simulated%', '%tn-linde-001%', '%linde sigas%'])

        UNION ALL
        SELECT
          'tender_submission_gates',
          id::text,
          coalesce(tender_workspace_id, tender_workspace_id_col)::text,
          concat_ws(' | ', gate_code, name, status, enforcement_mode, runtime_mode, is_mock::text, notes)
        FROM public.tender_submission_gates
        WHERE concat_ws(' | ', gate_code, name, status, enforcement_mode, runtime_mode, is_mock::text, notes)
          ILIKE ANY (ARRAY['%mock%', '%test output%', '%draft_mock%', '%ready_mock%', '%simulated%', '%tn-linde-001%', '%linde sigas%'])

        UNION ALL
        SELECT
          'tender_pack_outputs',
          id::text,
          tender_workspace_id::text,
          concat_ws(' | ', output_name, pack_name, output_type, format, version, status, watermark, is_test_output::text, notes)
        FROM public.tender_pack_outputs
        WHERE concat_ws(' | ', output_name, pack_name, output_type, format, version, status, watermark, is_test_output::text, notes)
          ILIKE ANY (ARRAY['%mock%', '%test output%', '%draft_mock%', '%ready_mock%', '%simulated%', '%tn-linde-001%', '%linde sigas%'])

        UNION ALL
        SELECT
          'tender_submission_emails',
          id::text,
          tender_workspace_id::text,
          concat_ws(' | ', pack_name, email_type, to_address, cc_external, cc_internal, subject, status, simulated::text, notes)
        FROM public.tender_submission_emails
        WHERE concat_ws(' | ', pack_name, email_type, to_address, cc_external, cc_internal, subject, status, simulated::text, notes)
          ILIKE ANY (ARRAY['%mock%', '%test output%', '%draft_mock%', '%ready_mock%', '%simulated%', '%example-client%', '%hala.example%', '%tn-linde-001%', '%linde sigas%'])
      )
      SELECT *
      FROM hits
      ORDER BY source_table, parent_id, row_id
      LIMIT 500
    $$, false, true, '')::text
  END AS result_xml;

-- ============================================================
-- 9. Proposal/SLA/escalation child samples for classification
-- ============================================================

WITH child_samples(label, rel) AS (
  VALUES
    ('commercial_proposal_versions', 'public.commercial_proposal_versions'),
    ('commercial_sla_drafts', 'public.commercial_sla_drafts'),
    ('commercial_escalations', 'public.commercial_escalations'),
    ('commercial_mock_escalations', 'public.commercial_mock_escalations'),
    ('escalation_events', 'public.escalation_events'),
    ('escalation_tasks', 'public.escalation_tasks'),
    ('renewal_workspaces', 'public.renewal_workspaces'),
    ('contract_baselines', 'public.contract_baselines'),
    ('document_vault', 'public.document_vault'),
    ('transportation_opportunities', 'public.transportation_opportunities')
)
SELECT
  label AS audit_name,
  CASE
    WHEN to_regclass(rel) IS NULL THEN 'TABLE_NOT_FOUND'
    ELSE query_to_xml(format('select * from %s limit 100', rel), false, true, '')::text
  END AS result_xml
FROM child_samples
ORDER BY label;

-- ============================================================
-- 10. Tables with potential lineage columns
-- ============================================================

SELECT
  table_name,
  bool_or(column_name = 'source_type') AS has_source_type,
  bool_or(column_name = 'source_reference') AS has_source_reference,
  bool_or(column_name = 'source_file') AS has_source_file,
  bool_or(column_name = 'source_sheet') AS has_source_sheet,
  bool_or(column_name = 'source_row') AS has_source_row,
  bool_or(column_name = 'source_row_id') AS has_source_row_id,
  bool_or(column_name = 'source_document_id') AS has_source_document_id,
  bool_or(column_name = 'lineage_status') AS has_lineage_status,
  bool_or(column_name = 'source_lineage') AS has_source_lineage,
  bool_or(column_name = 'truth_status') AS has_truth_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'commercial_tickets',
    'commercial_opportunities',
    'tenders',
    'commercial_proposal_versions',
    'commercial_sla_drafts',
    'commercial_escalations',
    'commercial_mock_escalations',
    'renewal_workspaces',
    'contract_baselines',
    'document_vault',
    'transportation_opportunities'
  )
GROUP BY table_name
ORDER BY table_name;

SELECT 'AUDIT END - COPY ALL RESULT PANELS BACK FOR CLASSIFICATION' AS audit_notice;
