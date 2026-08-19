# Functional Closure and Human UAT Report

Date: 2026-08-19

Application: `hala-clean-commercial-engine`

Verdict: **PASS for the tested pre-Sprint-X human workflows**

This wave repaired and tested the standalone clean application's Proposal,
Tender, Admin, Bot-definition, data-contract, responsive, and Final Pack PDF
workflows. It did not activate AI runtime behaviour or implement Sprint X.

## Automated gates

- `pnpm test`: 50 files, 714 tests passed.
- `pnpm check`: zero TypeScript errors.
- `pnpm build`: passed; 2,497 modules transformed.
- Functional old-app scan: no executable import, route, server, or asset path
  points into the old application. The remaining old-app strings are comments,
  package description text, and a negative test assertion.

## Controlled browser UAT

Every temporary write below was read back after reload and restored.

| Area | Test | Result |
|---|---|---|
| Proposal CRM tracker | Proposal Sent -> Shortlisted -> reload -> restore -> reload | PASS |
| Proposal internal tracker | Proposal Drafting -> Proposal Sent -> reload -> restore -> reload | PASS |
| Tender internal tracker | Tender Drafting -> Internal Review -> reload -> restore -> reload | PASS |
| Admin settings | Temporary organisation-name change -> reload -> restore -> reload | PASS |
| Bot definitions | Archive active definition -> count 39 to 38 -> Restore -> count 39 -> reload | PASS |
| Final Pack source | Connected-source picker showed only the real Linde tender | PASS |
| Final Pack document | Retained Linde pack opened with 13 blocks and live preview | PASS |
| Draft PDF | Draft PDF invoked the native print-to-PDF handoff | PASS WITH HUMAN HANDOFF |

The browser cannot operate or verify the native operating-system print dialog.
The application proved that the PDF pipeline was invoked and instructed the
human to choose `Save as PDF`; the final filesystem save remains a human step.

## Real data contracts verified

- Knowledgebase: 4 collections, 8 active documents, 9 chunks read from the
  real collection/document relationship.
- ECR: 8 active metrics, 1 current rule set, 8 weights totalling 100, 2
  snapshots, 2 scores, and 2 audit rows rendered from stored records.
- Users: `public.users.status` exists, contains no null values, and all 9 users
  rendered with readable Active/Inactive state and the appropriate action.
- CRM: connection configuration is read from `system_settings`; historical
  event health is read from the existing `crm_sync_events` table. No outbound
  synchronization success is fabricated.

## Data cleanup

The controlled cleanup left 2 real commercial tickets and 4 retained document
instances. The final browser sweep found one additional UAT branding profile
and its UAT compiled-output row; migration
`202608190003_functional_closure_pdf_uat_cleanup.sql` removed those exact rows.

Postconditions:

- users with null status: 0
- remaining UAT branding profile: 0
- remaining UAT compiled output: 0
- remaining commercial tickets: 2
- remaining document instances: 4

## Responsive verification

At a 423 x 900 viewport, `/system/admin`, `/system/bots`,
`/system/bot-builder`, the Linde Tender Workspace, the KAFD Proposal Workspace,
and `/pdf-studio` all remained within the document viewport. The Proposal stage
workbench now contains its own task/tab overflow instead of stretching the app.

## UAT-discovered repairs

1. Proposal Workspace hook ordering was corrected, removing the render crash.
2. Proposal workbench and shared stage shell now contain nested responsive
   content correctly.
3. Bot archive was found to be one-way. A confirmed, read-back Restore action
   was added and tested; it changes stored definition configuration only and
   does not invoke AI.
4. Final Pack source classification now excludes inactive, non-tender, and UAT
   records.

## Honest remaining boundaries

- Outbound CRM synchronization and webhooks are not implemented. Existing
  status/events are real reads; outbound actions remain honestly unavailable.
- Knowledgebase collection/document CRUD is not a separate management surface
  in this build; the repaired contract is the real embedded read surface.
- The final `Save as PDF` click occurs in the native print dialog and requires
  a human.
- AI execution, provider invocation, workflow enforcement, locks, compliance,
  and security hardening remain deferred to Sprint X.
- The clean app is source/build/runtime isolated from the old app, but it
  intentionally uses the existing Supabase project as its business-data store.

## Executive readiness

- Standalone source and build isolation: **100%**
- Tested core Tender/Proposal/PDF human workflow: **90%**
- Pre-Sprint-X product readiness overall: **approximately 88%**

The remaining pre-Sprint-X work is concentrated in broader human acceptance
coverage and any product decision to add outbound CRM or Knowledgebase CRUD.
It is no longer a source-migration problem.
