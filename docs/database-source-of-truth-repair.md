# Database Source Of Truth Repair

Date: 2026-05-20
Owner: Hala Commercial Engine
Status: Active repair blueprint

## Objective

Create one integrated relational source of truth for commercial execution records:

- Proposal
- Tender
- Renewal
- SLA
- Escalation

No duplicate master tables. No mock or seed records in operational views. No destructive database changes before migration and verification.

## Non-Negotiable Rules

- Do not drop or delete tables before data is migrated, verified, and approved.
- Do not run destructive SQL by bot. SQL must be prepared for human review and manual execution.
- Do not create new master tables for these domains without explicit architecture approval.
- Null means unknown or not captured yet.
- Zero means explicitly confirmed zero.
- Mock, seed, demo, and test rows must not be promoted as business truth.
- Operational UI must not read legacy duplicate master tables as source of truth.

## Live Supabase Findings

Read-only inventory on 2026-05-20:

| Table | Rows | Current Classification |
| --- | ---: | --- |
| commercial_tickets | 1 | Canonical master candidate |
| commercial_ticket_audit | 1 | Canonical audit child candidate |
| tenders | 0 | Legacy duplicate tender master |
| commercial_opportunities | 0 | Legacy duplicate proposal/pipeline master |
| commercial_proposal_versions | 3 | Proposal version child, but rows look seeded/mock-like |
| proposals | 0 | Empty duplicate proposal table |
| renewal_workspaces | 0 | Renewal child candidate, empty |
| contract_baselines | 0 | Contract/renewal child candidate, empty |
| commercial_sla_drafts | 3 | SLA draft child, but rows look seeded/mock-like |
| slas | 0 | Empty duplicate SLA table |
| contract_status | 0 | Empty SLA/contract status child |
| commercial_escalations | 8 | Escalation table with source lineage fields |
| escalation_events | 19 | Escalation event system |
| escalation_tasks | 17 | Escalation task child table |
| commercial_mock_escalations | 9 | Mock contamination candidate |
| tender_packs | 3 | Tender child data, orphaned to legacy tender id |
| tender_pack_sections | 34 | Tender child data, orphaned to legacy tender id |
| tender_placeholders | 18 | Tender child data, orphaned to legacy tender id |
| tender_required_documents | 22 | Tender child data, orphaned to legacy tender id |
| tender_compliance_items | 22 | Tender child data, orphaned to legacy tender id |
| tender_submission_gates | 14 | Tender child data, contains mock/test indicators |

## Critical Finding

The live `tenders` master table is empty, but tender workspace child tables still contain Linde rows linked to `tn-linde-001`.

That means the tender workspace data is orphaned from the current canonical Linde ticket:

- Canonical Linde ticket: `commercial_tickets.id = 7483c493-0098-40a9-9e5f-76007bc62cd1`
- Orphaned legacy tender workspace id: `tn-linde-001`

These child rows include mock/test language such as:

- Mock Gate
- TEST OUTPUT
- draft_mock
- simulated
- would_block

They must be audited before any migration into the canonical Linde ticket.

## Canonical Target Model

### Master

`commercial_tickets`

This is the single master table for:

- proposal
- tender
- renewal
- sla

It owns:

- identity
- customer
- ticket type
- owner
- CRM pipeline stage
- internal process stage
- commercial value
- target date
- source and lineage
- active status

### Tender Children

Tender child tables may remain only as detail tables linked to `commercial_tickets.id`.

Candidate child tables:

- tender_packs
- tender_pack_sections
- tender_placeholders
- tender_required_documents
- tender_compliance_items
- tender_submission_gates
- tender_activity_events
- tender_audit_events
- tender_split_checks
- tender_pack_outputs
- tender_submission_emails
- tender_submission_email_attachments

Required repair:

- Child foreign/reference fields must point to the canonical `commercial_tickets.id`.
- Legacy id `tn-linde-001` cannot remain the operational parent.
- Mock/test child rows must be archived unless explicitly approved as real historical workspace data.

### Proposal Children

Proposal master identity belongs in `commercial_tickets` where `ticket_type = proposal`.

Candidate child table:

- commercial_proposal_versions

Required repair:

- Existing rows must be audited.
- Rows that are seeded/mock must not be treated as business truth.
- Proposal versions must link to canonical ticket id, not orphan workspace-only ids.

### Renewal Children

Renewal master identity belongs in `commercial_tickets` where `ticket_type = renewal`.

Candidate child tables:

- renewal_workspaces
- contract_baselines

Required repair:

- Since both live tables are empty, do not build new renewal truth elsewhere.
- Remove hardcoded renewal mock records from operational UI after replacement empty state exists.

### SLA Children

SLA master identity belongs in `commercial_tickets` where `ticket_type = sla`.

Choose one SLA child path:

- Keep and repair `commercial_sla_drafts`, or
- Migrate to `slas` and retire `commercial_sla_drafts`.

Current recommendation:

- Use `commercial_sla_drafts` only as an SLA version/draft child if rows are cleaned and linked to `commercial_tickets.id`.
- Retire empty `slas` unless server routes require it and the architecture explicitly chooses it.

### Escalations

Current candidates:

- commercial_escalations
- escalation_events
- escalation_tasks
- commercial_mock_escalations

Current recommendation:

- Use `escalation_events` as the event master.
- Use `escalation_tasks` as child tasks.
- Migrate or reference useful verified `commercial_escalations` rows only if they have valid source lineage.
- Retire `commercial_mock_escalations` after confirming no operational UI depends on it.

## App Rewiring Rule

Operational pages must not read legacy master tables directly.

Canonical operational reads:

- CRM Pipeline: `commercial_tickets`
- Tender Portfolio: `commercial_tickets` filtered to `ticket_type = tender`
- Tender Overview: `commercial_tickets` filtered to `ticket_type = tender`
- Proposal Portfolio: `commercial_tickets` filtered to `ticket_type = proposal`
- Customer Command Centre: aggregate from `commercial_tickets`
- Renewal pages: `commercial_tickets` filtered to `ticket_type = renewal`, plus approved renewal children
- SLA pages: `commercial_tickets` filtered to `ticket_type = sla`, plus approved SLA child table

Legacy/source tables may exist temporarily as staging or archive, but not as operational truth.

## Repair Sequence

1. Stop operational UI from reading legacy master tables.
2. Audit child/detail rows for real vs mock vs orphaned.
3. Produce migration mapping for each legacy table.
4. Prepare human-reviewed SQL to reparent valid child rows to canonical ticket ids.
5. Prepare human-reviewed SQL to archive mock/seed rows.
6. Rewire remaining pages and API routes to data-access modules instead of direct table reads.
7. Run build and browser verification.
8. Rename legacy duplicate tables to archive names.
9. Run app verification again.
10. Drop retired tables only after explicit human sign-off.

## First Safe Code Repair Applied

Operational tender identity was redirected to `commercial_tickets` in:

- `client/src/pages/CrmPipeline.tsx`
- `client/src/pages/Tenders.tsx`
- `client/src/pages/TendersOverview.tsx`
- `client/src/lib/tender-ticket-adapter.ts`

This does not delete data and does not mutate Supabase.

## Second Safe Code Repair Applied

Operational proposal/customer reads were redirected away from `commercial_opportunities`:

- `client/src/pages/Commercial.tsx`
- `client/src/pages/CommercialOverview.tsx`
- `client/src/pages/Customers.tsx`
- `client/src/lib/customer-command-data.ts`
- `client/src/lib/intake-save.ts`
- `client/src/lib/pipeline-tickets.ts`

CRM stage changes now persist through the canonical `commercial_tickets` update path instead of updating table names dynamically.
Legacy CRM/tender conversion helpers were removed from the shared pipeline adapter to prevent accidental reintroduction of `commercial_opportunities` or `tenders` as CRM card sources.

Hardcoded renewal runtime records were neutralized in:

- `client/src/lib/renewal-engine.ts`

The renewal engine now exposes empty arrays until real Supabase-backed renewal records exist. This prevents the old SABIC/Ma'aden/Sadara/Unilever/Al-Rajhi seed records from appearing as operational truth.

## Third Safe Code Repair Applied

Operational commercial workspace contamination was contained:

- `client/src/lib/supabase-commercial-actions.ts` now refuses to persist mock workflow actions.
- `client/src/lib/supabase-commercial-data.ts` hides unverified `commercial_mock_escalations`, `commercial_proposal_versions`, and `commercial_sla_drafts` rows from operational workspace bundles.
- `client/src/lib/supabase-commercial-signals.ts` no longer reads those mock/unverified child tables for commercial signal summaries.
- `client/src/components/commercial/CommercialMockEscalationPanel.tsx` no longer falls back to in-memory mock escalations.
- `client/src/components/commercial/CommercialProposalControlTab.tsx` no longer falls back to in-memory proposal versions or negotiations.
- `client/src/components/commercial/CommercialSlaControlTab.tsx` no longer falls back to in-memory SLA drafts, sections, KPIs, or promise gaps.
- `client/src/pages/WorkspaceDetail.tsx` no longer contains hardcoded local SLA records, and proposal workbench state no longer persists to `localStorage`.
- `client/src/lib/supabase-data.ts` no longer synthesizes workspaces from `commercial_opportunities`.

This is containment, not final schema retirement. The legacy child tables still require row-level audit and human-approved migration/archive SQL.

## Next Required Audit

Read-only audit artifact prepared:

- `docs/supabase-forensic-audit-readonly.sql`
- `docs/supabase-forensic-audit-guide.md`

Before any migration SQL:

- Inspect all rows in tender child tables.
- Classify each child row as real, mock, seed, duplicate, or orphan.
- Decide whether Linde child rows should be:
  - reparented to `7483c493-0098-40a9-9e5f-76007bc62cd1`,
  - archived as mock/test history,
  - or partially re-created from the real Linde tender document.
