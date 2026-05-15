# Schema Contract

Date: 2026-05-14

## Scope And Source Rules

This contract is based only on confirmed repo evidence from:

- `supabase/migrations/*.sql`
- `migrations/*.sql`
- top-level `supabase_migration_*.sql`
- `scripts/*.sql`
- Supabase table queries in `client/src/lib/*`, `client/src/hooks/*`, `server/routes/*`, and `server/lib/*`
- `supabase/functions/ghl-proxy/index.ts`

No generated Supabase TypeScript database types were found.

Important: the effective production schema is `UNCONFIRMED` until applied migrations are verified against the live Supabase project. Multiple migration roots exist, so this document records repo-confirmed schema candidates and source files, not guaranteed live state.

## Database Platform

- Supabase PostgreSQL.
- Frontend uses `@supabase/supabase-js`.
- Backend uses Supabase service-role access through `server/lib/supabase.ts`.
- Supabase Auth is used for login/session state.

## Confirmed Table Inventory

### Core App / Commercial / Tender

| Table | Confirmed Source |
|---|---|
| `customers` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `workspaces` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tenders` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_quote_scenarios` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_pricing_lines` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_pnl_snapshots` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_customer_scores` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_capacity_fits` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_revenue_realization` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_mock_escalations` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_proposal_versions` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_sla_drafts` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_activity_events` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_audit_events` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_governance_config` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `commercial_negotiation_rounds` | `supabase/migrations/20260504_supa003b_schema_parity.sql` |
| `tender_packs` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_pack_sections` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_placeholders` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_required_documents` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_compliance_items` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_submission_gates` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_activity_events` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_audit_events` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_governance_config` | `supabase/migrations/20260504_supa002_commercial_tender_tables.sql` |
| `tender_split_checks` | `supabase/migrations/20260506_supa006_tender_schema_parity.sql` |
| `tender_pack_outputs` | `supabase/migrations/20260506_supa006_tender_schema_parity.sql` |
| `tender_submission_emails` | `supabase/migrations/20260506_supa006_tender_schema_parity.sql` |
| `tender_submission_email_attachments` | `supabase/migrations/20260506_supa006_tender_schema_parity.sql` |
| `tender_stage_history` | `supabase/migrations/20260510_supa008_tender_action_tables.sql` |
| `tender_customer_links` | `supabase/migrations/20260513_tnd002_tender_customer_links.sql` |

### Quotes / Proposals / SLAs / Approval / Audit

| Table | Confirmed Source |
|---|---|
| `quotes` | `migrations/sprint3_quotes_schema.sql` |
| `proposals` | `migrations/sprint4_proposals_schema.sql` |
| `slas` | `migrations/sprint5_sla_contract.sql` |
| `contract_status` | `migrations/sprint5_sla_contract.sql` |
| `sla_verification_checklists` | `migrations/006_sla_integrity_guard.sql` |
| `approval_records` | `migrations/sprint2_rls_policies.sql` references existing table |
| `audit_log` | queried by server/client; RLS policies in `migrations/sprint2_rls_policies.sql` |
| `signals` | queried by client; RLS policies in `migrations/sprint2_rls_policies.sql` |
| `users` | queried by auth; RLS policies in `migrations/sprint2_rls_policies.sql` |

Column definitions for `approval_records`, `audit_log`, `signals`, and `users` were not found in the inspected `CREATE TABLE` output. Their exact creation source is `UNCONFIRMED`.

### Documents / Composer / Variables

| Table | Confirmed Source |
|---|---|
| `doc_blocks` | `supabase_migration_documents.sql` |
| `doc_branding_profiles` | `supabase_migration_documents.sql` |
| `doc_templates` | `supabase_migration_documents.sql` |
| `doc_template_versions` | `supabase_migration_documents.sql` |
| `doc_instances` | `supabase_migration_documents.sql` |
| `doc_instance_versions` | `supabase_migration_documents.sql` |
| `doc_compiled_outputs` | `supabase_migration_documents.sql` |
| `doc_vault_assets` | `supabase_migration_documents.sql` |
| `generated_documents` | `migrations/sprint6_generated_documents.sql` |
| `compiled_documents` | queried by server/client; creation source `UNCONFIRMED` |
| `vault_assets` | queried by client; creation source `UNCONFIRMED` |
| `variable_definitions` | `scripts/migrate-variables.sql` |
| `variable_sets` | `scripts/migrate-variables.sql` |
| `variable_set_items` | `scripts/migrate-variables.sql` |
| `doc_variable_overrides` | `scripts/migrate-variables.sql` |

### Bots / AI / Knowledge Base / Signals

| Table | Confirmed Source |
|---|---|
| `editor_bots` | `supabase_migration_bots.sql` |
| `ai_runs` | `supabase_migration_bots.sql` |
| `ai_providers` | `scripts/009_ai_providers.sql` |
| `ai_usage_logs` | `scripts/009_ai_providers.sql` |
| `bot_providers` | `migrations/sprint9_automation_persistence.sql` |
| `bot_connectors` | `migrations/sprint9_automation_persistence.sql` |
| `bot_definitions` | `migrations/sprint9_automation_persistence.sql` |
| `bot_versions` | `migrations/sprint9_automation_persistence.sql` |
| `bot_invocations` | `migrations/sprint9_automation_persistence.sql` |
| `bot_global_settings` | `migrations/sprint9_automation_persistence.sql` |
| `signal_rules` | `migrations/sprint9_automation_persistence.sql` |
| `signal_events` | `migrations/sprint9_automation_persistence.sql` |
| `kb_collections` | `migrations/sprint11_knowledgebase.sql` |
| `kb_documents` | `migrations/sprint11_knowledgebase.sql` |
| `kb_chunks` | `migrations/sprint11_knowledgebase.sql` |
| `kb_embeddings` | `migrations/sprint11_knowledgebase.sql` |
| `bot_kb_links` | `migrations/sprint11_knowledgebase.sql` |
| `bot_runs` | queried by `client/src/lib/knowledgebase.ts`; creation source `UNCONFIRMED` |

### ECR / Governance / Escalations / Operations

| Table | Confirmed Source |
|---|---|
| `ecr_metrics` | `supabase_migration_ecr.sql` |
| `ecr_rule_sets` | `supabase_migration_ecr.sql`; also `migrations/sprint14_ecr_rules.sql` |
| `ecr_rule_weights` | `supabase_migration_ecr.sql`; also `migrations/sprint14_ecr_rules.sql` |
| `ecr_input_snapshots` | `supabase_migration_ecr.sql` |
| `ecr_input_values` | `supabase_migration_ecr.sql` |
| `ecr_scores` | `supabase_migration_ecr.sql` |
| `ecr_audit_trail` | `supabase_migration_ecr.sql` |
| `governance_policy_gates` | `supabase/migrations/20260510_supa009_governance_tables.sql` |
| `governance_audit_log` | `supabase/migrations/20260510_supa009_governance_tables.sql` |
| `escalation_rules` | `migrations/007_escalation_engine.sql` |
| `escalation_events` | `migrations/007_escalation_engine.sql` |
| `escalation_tasks` | `migrations/007_escalation_engine.sql` |
| `commercial_escalations` | `supabase/migrations/20260514_esc001_commercial_escalations.sql` |
| `operations_signals` | `supabase/migrations/20260514_ops001_operations_signals.sql` |
| `system_settings` | `migrations/sprint12_system_settings.sql` |

### Commercial OS / Warehouse / Transportation / Reports

| Table | Confirmed Source |
|---|---|
| `commercial_opportunities` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `commercial_opportunity_monthly_phasing` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `commercial_opportunity_flags` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `warehouse_locations` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `warehouse_chambers` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `warehouse_capacity_snapshots` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `closed_won_deals` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `warehouse_revenue_actuals` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `forecast_monthly` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `commercial_dashboard_snapshots` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `leadership_actions` | `supabase/migrations/20260511_data002a_commercial_os_schema.sql` |
| `commercial_kpi_registry` | `supabase/migrations/20260511_data003b_kpi_source_registry.sql` |
| `commercial_source_registry` | `supabase/migrations/20260511_data003b_kpi_source_registry.sql` |
| `default_assumptions` | `supabase/migrations/20260512_assump001_assumption_registry.sql` |
| `stage_probabilities` | `supabase/migrations/20260512_assump001_assumption_registry.sql` |
| `dashboard_thresholds` | `supabase/migrations/20260512_assump001_assumption_registry.sql` |
| `customer_master` | `supabase/migrations/20260513_cust001_customer_master.sql` |
| `customer_aliases` | `supabase/migrations/20260513_cust001_customer_master.sql` |
| `customer_source_links` | `supabase/migrations/20260513_cust001_customer_master.sql` |
| `transportation_opportunities` | `supabase/migrations/20260513_tpt001_transportation_pipeline.sql` |
| `transportation_opportunity_metrics` | `supabase/migrations/20260513_tpt001_transportation_pipeline.sql` |
| `transportation_customer_links` | `supabase/migrations/20260513_tpt001_transportation_pipeline.sql` |
| `commercial_opportunity_gp_basis` | `supabase/migrations/20260514_gp002_gp_engine_v2.sql` |
| `monthly_commercial_reports` | `supabase/migrations/20260514_rpt001_monthly_reports.sql` |

### CRM / Renewals / Handover

| Table | Confirmed Source |
|---|---|
| `crm_config` | `supabase_migration_crm_config.sql` |
| `crm_contact_map` | `supabase_migration_crm_config.sql` |
| `crm_opportunity_map` | `supabase_migration_crm_config.sql` |
| `crm_connections` | queried by `server/routes/system-health.ts`; creation source `UNCONFIRMED` |
| `crm_sync_events` | queried by client; creation source `UNCONFIRMED` |
| `renewal_workspaces` | `supabase_migration_tenders_renewals.sql` |
| `contract_baselines` | `supabase_migration_tenders_renewals.sql` |
| `handover_processes` | `migrations/sprint13_handover_processes.sql` |

## Confirmed Relationships

Confirmed relationship examples from migration files:

- `workspaces.customer_id` relationships are used in service code, but exact FK definition is `UNCONFIRMED` from inspected table output.
- `tenders.customer_id -> customers.id`.
- `commercial_quote_scenarios.workspace_id -> workspaces.id`.
- `commercial_pricing_lines.scenario_id -> commercial_quote_scenarios.id`.
- `commercial_pnl_snapshots.scenario_id -> commercial_quote_scenarios.id`.
- `commercial_customer_scores.workspace_id -> workspaces.id`; `commercial_customer_scores.customer_id -> customers.id`.
- `commercial_capacity_fits.scenario_id -> commercial_quote_scenarios.id`.
- `commercial_mock_escalations.scenario_id -> commercial_quote_scenarios.id`.
- `commercial_proposal_versions.workspace_id -> workspaces.id`; optional scenario link.
- `commercial_sla_drafts.workspace_id -> workspaces.id`.
- `tender_packs.tender_workspace_id -> workspaces.id`.
- Tender pack child tables reference `tender_packs.id`.
- Tender split/output/email tables reference `tenders.id` and/or `tender_packs.id`.
- `commercial_negotiation_rounds.workspace_id -> workspaces.id`; `proposal_version_id -> commercial_proposal_versions.id`.
- `sla_verification_checklists.workspace_id -> workspaces.id`.
- `bot_versions.bot_id -> bot_definitions.id`.
- `bot_invocations.bot_id -> bot_definitions.id`.
- `signal_rules.bot_id -> bot_definitions.id`.
- `signal_events.rule_id -> signal_rules.id`; `signal_events.bot_id -> bot_definitions.id`.
- Knowledge base documents/chunks/embeddings link through collection/document/chunk IDs.
- Commercial OS warehouse/opportunity/phasing/flags tables reference opportunity, customer, and warehouse records as declared in migrations.
- Transportation metrics/customer links reference transportation opportunities.

## RLS Policies

RLS policy files exist and include broad authenticated/service policies. Confirmed examples:

- `migrations/sprint2_rls_policies.sql` enables RLS for `customers`, `workspaces`, `quotes`, `proposals`, `approval_records`, `escalation_events`, `signals`, `audit_log`, and `users`.
- `migrations/010_rls_hardening.sql` contains additional RLS hardening for several domains.
- Document, ECR, bot, AI, variable, governance, Commercial OS, assumptions, customer master, transportation, monthly report, operations signal, and commercial escalation migrations also enable RLS and create policies.

Effective live RLS behavior is `UNCONFIRMED`. Do not infer production access rules from this document alone.

## SQL Functions

No `CREATE FUNCTION` or `CREATE OR REPLACE FUNCTION` statements were found in inspected SQL files.

## Supabase Edge Functions

| Function | Path | Purpose |
|---|---|---|
| `ghl-proxy` | `supabase/functions/ghl-proxy/index.ts` | Proxy requests to GoHighLevel / DNA Supersystems API using server-side secrets |

## Known Contract Gaps

- Live applied migration history is `UNCONFIRMED`.
- Some queried tables have no confirmed `CREATE TABLE` source in inspected files.
- Complete column-level contract for every table has not been normalized.
- Generated Supabase types are missing.
- Existing direct frontend writes and server service-role writes need security review before policy assumptions.
