# HALA Commercial Engine Recovery Plan

## Status

**Draft for review**

This plan replaces any implied assumption that governance, lockdown, policy gates, or AI control must arrive early.

It does **not**.

The system must remain **open, testable, and human-drivable** until:

1. core flows are real,
2. data is consistent,
3. integrations are working,
4. fake completion is removed,
5. users can test freely without the system blocking them.

Only after that do we add:

- policy enforcement,
- gate blocking,
- hard governance,
- AI restrictions and lock-down,
- final production operating controls.

## Non-Negotiable Rule

## Open System First, Governance Last

We will **not** build a prison before we build a product.

That means:

- No hard stage locks before full flow testing
- No approval gates that block user testing in early sprints
- No AI lockdowns before we verify where AI actually helps and where it fails
- No canonical policy enforcement before data paths are unified and trusted
- No "smart policing" before the product is functionally real

During all pre-governance sprints:

- the system stays open,
- actions are logged,
- warnings are allowed,
- humans can continue testing,
- failures are surfaced instead of silently blocked.

## Purpose

This recovery plan is designed to fix the issues identified in the product truth audit:

- split-brain architecture,
- fake completion surfaces,
- mock and in-memory business engines,
- incomplete CRM and AI execution,
- non-canonical document flow,
- unfinished downstream workflows,
- missing notifications,
- broken production readiness.

## Program Objectives

1. Make the product truthful
2. Make the core commercial workflow real
3. Remove mock behavior from live user paths
4. Consolidate to a single trusted data path
5. Finish integrations before governance
6. Test in the open before locking anything down
7. Add governance, gating, and AI restriction only in the final sprint

## Recovery Principles

### 1. No Fake Completion

If a feature is mock, simulated, or partial:

- it must be labeled,
- removed from primary flow,
- or rebuilt before being treated as real.

### 2. One Truth Path Per Business Flow

Each business action must have one authoritative path:

- one mutation path,
- one persistence model,
- one lifecycle owner,
- one status model.

### 3. Data Before AI

AI is downstream of:

- real document data,
- real workflow state,
- real permissions,
- real auditability.

### 4. Open Testing Before Enforcement

Pre-governance sprints use:

- warnings,
- telemetry,
- audit trails,
- dashboards,
- manual QA,
- scenario testing.

Not hard blocks.

### 5. Governance Comes Last

Final lockdown only happens after:

- UAT passes,
- flow integrity is confirmed,
- data drift is resolved,
- users understand real behavior.

## Target Program Shape

The recovery is split into **10 implementation sprints** plus **1 final governance sprint**.

### Sprint Sequence

1. Sprint 0 - Truth Alignment and Safety Cleanup
2. Sprint 1 - Build Stability and Runtime Readiness
3. Sprint 2 - Canonical Data Path Consolidation
4. Sprint 3 - Core Commercial Flow Unification
5. Sprint 4 - Real Document Pipeline
6. Sprint 5 - CRM Integration Completion
7. Sprint 6 - Admin, Identity, and Operational Backoffice
8. Sprint 7 - AI Runtime Completion, Still Open
9. Sprint 8 - Downstream Workflows: Renewals, Tenders, Handover
10. Sprint 9 - Notifications, Signals, and Operational Visibility
11. Sprint 10 - Full Open-System UAT and Data Integrity Hardening
12. Sprint 11 - Final Governance, Policy Enforcement, AI Lockdown

## Phase A - Make the Product Honest

## Sprint 0 - Truth Alignment and Safety Cleanup

**Goal:** stop misleading the team and users before deeper implementation continues.

**Outcome:** the visible system truthfully reflects what is real, partial, or mock.

### In Scope

- Label or hide mock-only routes from primary navigation
- Remove false success toasts for non-existent actions
- Mark non-operational integrations as planned or test-only
- Publish a live status matrix per major module
- Freeze creation of new mock business engines

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-0001 | Route truth audit pass | Review all top-level routes and classify as real, partial, mock, or placeholder | Critical | Every route has a truth status recorded |
| RP-0002 | Remove fake completion from navigation | Hide or relabel CRM mock, renewal mock, tender mock, handover mock, and legacy document mock surfaces in primary nav | Critical | No mock-only screen appears as a primary "done" capability |
| RP-0003 | Replace false action toasts | Remove success messages for actions that do not trigger real backend work | High | No user sees success for a fake action |
| RP-0004 | Add module status banner | Add visible "Live / Partial / Mock / Planned" status indicators to non-canonical screens | High | Partial/mock areas are visibly labeled |
| RP-0005 | Publish recovery tracker | Create a living tracker that maps each shell to sprint ownership | Medium | Team has one planning source of truth |

### Sprint Exit Criteria

- No obviously fake surface is presented as production-complete
- Team can distinguish real from partial without reading code

## Sprint 1 - Build Stability and Runtime Readiness

**Goal:** make the application buildable and operable before more business work lands.

**Outcome:** frontend and backend both build cleanly and can be deployed consistently.

### In Scope

- Fix backend typecheck and build blockers
- Standardize server runtime entry
- Validate environment assumptions
- Document required services and missing external dependencies
- Address high-risk bundle/perf hotspots

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-1001 | Fix server typecheck blockers | Resolve `bootstrap.ts`, `pdfkit`, and TS target/build issues | Critical | `npm run typecheck:server` passes |
| RP-1002 | Fix server production build | Make backend build artifact generation reliable | Critical | `npm run build:server` passes |
| RP-1003 | Validate full repo check | Align root TS config and package scripts | High | `npm run check` passes |
| RP-1004 | Runtime dependency register | Document every required external function/service and whether it exists in-repo or externally | High | No hidden dependency remains undocumented |
| RP-1005 | Frontend bundle reduction pass | Reduce the largest chunks and identify lazy-load boundaries | Medium | Main bundle risk is reduced and measured |

### Sprint Exit Criteria

- Repo builds cleanly
- Server startup path is stable
- Hidden deployment assumptions are documented

## Phase B - Make the Core System Real

## Sprint 2 - Canonical Data Path Consolidation

**Goal:** eliminate split-brain data behavior without introducing policy locks.

**Outcome:** each core commercial flow has one authoritative mutation path.

### In Scope

- Decide authoritative write path for commercial records
- Remove mixed direct-write vs server-write behavior where it affects core flows
- Replace in-memory state dependencies in live flows
- Define canonical status models for workspace, quote, proposal, SLA, document
- Preserve open testing: warnings only, no blocking gates

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-2001 | Core authority map | Define which layer owns reads and writes for each business object | Critical | Approved architecture map exists |
| RP-2002 | Remove mock state from stage transition path | Replace store-array dependencies in stage movement logic with persisted state | Critical | Stage transitions do not depend on mock arrays |
| RP-2003 | Consolidate commercial mutations | Align workspace, quote, proposal, and SLA mutation patterns | Critical | Core mutations follow one path per object |
| RP-2004 | Canonical status model cleanup | Normalize lifecycle statuses and remove contradictory state handling | High | Status meanings are consistent across UI and backend |
| RP-2005 | Telemetry before enforcement | Add detailed audit/warning telemetry for invalid states instead of blocking | High | Faults are visible without locking users out |

### Sprint Exit Criteria

- Core flows no longer rely on mock business arrays
- Data authority is consistent enough for real end-to-end testing

## Sprint 3 - Core Commercial Flow Unification

**Goal:** make the commercial workspace flow real from workspace through quote, proposal, and SLA progression.

**Outcome:** core commercial journey is testable end-to-end by humans without policy lockup.

### In Scope

- Workspace lifecycle reliability
- Quote flow completeness
- Proposal flow completeness
- SLA flow completeness
- Approval actions as workflow state changes, still open-testing mode

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-3001 | Workspace flow truth pass | Ensure workspace progression reflects real persisted data | Critical | Workspace state survives refresh and multi-step flow |
| RP-3002 | Quote lifecycle completion | Finish create, edit, submit, approve, reject, version flow consistently | Critical | Quote lifecycle works end-to-end |
| RP-3003 | Proposal lifecycle completion | Finish draft, review, status progression, versioning, CRM-ready state | Critical | Proposal lifecycle works end-to-end |
| RP-3004 | SLA lifecycle completion | Align SLA create/review/approve/version behavior across list and workspace views | Critical | SLA behavior is consistent in all surfaces |
| RP-3005 | Open testing mode for approvals | Keep approvals as visible state changes with warnings/logging but no hard gate lockouts | High | Test users can move through flow while issues are surfaced |

### Sprint Exit Criteria

- Human can execute core commercial journey without touching mock surfaces
- No part of the core journey silently swaps to in-memory logic

## Sprint 4 - Real Document Pipeline

**Goal:** replace document illusion with one real output system.

**Outcome:** documents are compiled, stored, downloaded, versioned, and reopened through one real path.

### In Scope

- Retire legacy mock documents flow
- Replace HTML print-to-PDF fallback in the primary path
- Unify doc instance, compiled output, vault, and download behavior
- Remove synthetic/mock file dependency from user-facing vault behavior
- Preserve human editing and open testing

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-4001 | Canonical document path design | Define one source of truth from instance to compiled output to vault asset | Critical | Approved document lifecycle map exists |
| RP-4002 | Replace legacy Documents page | Migrate or retire the store-based Documents shell | Critical | No primary document page uses mock store data |
| RP-4003 | Real compile and download | Primary document flow generates real persisted outputs, not browser-print HTML workaround | Critical | User can compile, store, reopen, and download a real output |
| RP-4004 | Remove synthetic file bootstrap | Eliminate `initializeMockFiles()` from live document experience | Critical | Vault/viewer does not depend on synthetic files |
| RP-4005 | Real CRM export handoff for documents | Replace in-memory CRM export marker behavior with real integration-ready handoff state | High | Export state is persisted and auditable |

### Sprint Exit Criteria

- Document output is real, not representational
- Vault behavior reflects stored reality

## Phase C - Finish External Execution Systems

## Sprint 5 - CRM Integration Completion

**Goal:** turn CRM from console theater into a real controlled integration.

**Outcome:** qualified-stage sync and outbound commercial updates work through real execution paths.

### In Scope

- Complete edge/server execution path for CRM
- Implement missing connection test and sync functions
- Define supported sync scope for this phase
- Make attachment/export behavior real
- Keep sync advisory where needed; no workflow lockdown yet

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-5001 | CRM execution architecture | Finalize supported providers and actual sync boundary | Critical | Integration contract approved |
| RP-5002 | Implement missing CRM functions | Add repo-backed or documented deployed functions required by UI | Critical | UI no longer depends on missing hidden functions |
| RP-5003 | Qualified-stage workspace creation/update | Make intended CRM-to-workspace sync actually work | Critical | Qualified CRM record creates or updates workspace correctly |
| RP-5004 | Outbound stage and attachment sync | Send approved commercial outputs back to CRM through real path | High | Status and document handoff are auditable |
| RP-5005 | Conflict and retry behavior | Implement visible retry/conflict handling without pretending full autonomy | High | Failures are visible and recoverable |

### Sprint Exit Criteria

- CRM is no longer mock in primary flow
- Sync failures surface honestly

## Sprint 6 - Admin, Identity, and Operational Backoffice

**Goal:** finish the operational admin foundation without enabling final policy lockdown.

**Outcome:** user admin, role surfaces, and operational controls are real but still not hard-governed.

### In Scope

- Complete admin user management implementation
- Validate role model consistency
- Align admin screens to real backends
- Separate operational controls from final governance controls

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-6001 | Admin function parity | Bring admin-user-management implementation under explicit control | Critical | Admin user CRUD/reset/deactivate works end-to-end |
| RP-6002 | Role model normalization | Align frontend and backend role expectations | High | Same roles mean the same thing everywhere |
| RP-6003 | Remove admin phantom controls | Hide or relabel admin controls with no working backend | High | Admin panel reflects only real capabilities |
| RP-6004 | Operational audit surfacing | Improve admin visibility into errors, failed jobs, and dependency health | High | Admin can see operational state without needing code |
| RP-6005 | Open-mode admin testing | Ensure test users can still exercise flows without hard gate blocking | Medium | Admin does not accidentally lock the system early |

### Sprint Exit Criteria

- Admin is operational, not decorative
- Roles are consistent enough for UAT

## Sprint 7 - AI Runtime Completion, Still Open

**Goal:** make AI real before trying to police it.

**Outcome:** AI generation works through real providers and real audit paths, but remains human-controlled and non-blocking.

### In Scope

- Implement missing AI execution functions
- Remove mock output fallback from production-intended paths
- Keep AI advisory and editable
- Improve traceability, provider state, and failure handling
- Do not add final AI lock-down yet

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-7001 | Real AI execution path | Implement or wire actual provider functions expected by the client | Critical | AI actions call real execution endpoints |
| RP-7002 | Remove silent mock AI fallback | Production paths must fail honestly, not fabricate usable-looking content | Critical | AI failure is explicit and auditable |
| RP-7003 | Human acceptance workflow | Ensure generated content remains draft/review/apply, never auto-promoted | High | Human remains in control |
| RP-7004 | AI run traceability completion | Persist prompts, outputs, provider, model, status, citations where applicable | High | Every run is attributable and reviewable |
| RP-7005 | Bot/admin UI truth pass | Rebuild bot governance screens against real runtime state or downgrade them to planned | High | Bot screens no longer overstate reality |

### Sprint Exit Criteria

- AI is real but still open for learning and testing
- No fake AI success path remains in production-intended flow

## Phase D - Finish the Missing Business Shells

## Sprint 8 - Downstream Workflows: Renewals, Tenders, Handover

**Goal:** replace the most misleading structured prototypes with real persisted workflows.

**Outcome:** renewals, tenders, and handover become actual business modules or are explicitly deferred.

### In Scope

- Renewal workspace lifecycle
- Tender lifecycle and persistence
- Handover lifecycle tied to contract-ready / signed state
- Supporting docs and workspace-linked operational records

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-8001 | Renewal domain architecture | Define persisted model and lifecycle for renewals | Critical | Renewal shell no longer depends on seeded arrays |
| RP-8002 | Renewal workflow implementation | Build baseline, comparison, version, decision, and outcome flow on persisted data | Critical | Renewal journey is real end-to-end |
| RP-8003 | Tender workflow implementation | Replace tender mock engine with persisted workflow and history | Critical | Tender board and detail reflect real state |
| RP-8004 | Handover implementation | Replace mock handover checklist with persisted cross-functional workflow | Critical | Contract-to-handover path is real |
| RP-8005 | Supporting docs unification | Move contract/supporting docs off in-memory lists into persisted flows | High | Supporting docs survive refresh and are auditable |

### Sprint Exit Criteria

- Downstream workflows are either real or explicitly postponed out of the product shell

## Sprint 9 - Notifications, Signals, and Operational Visibility

**Goal:** make the system communicative and observable without turning signals into police.

**Outcome:** signals remain advisory, escalations are real, notifications work, and operators can see failures.

### In Scope

- Notification center
- Email/event notifications
- External dependency health
- Signal visibility
- Escalation routing based on real data, not mock datasets

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-9001 | Notification service implementation | Build in-app notification persistence and read states | High | Users receive real in-app notifications |
| RP-9002 | Email event implementation | Send real emails for approvals, stage changes, and expiry alerts | High | Key emails send successfully in test environment |
| RP-9003 | Signal engine data rebasing | Rewire signals/escalations away from mock store inputs toward canonical data | Critical | Signal generation uses real persisted data only |
| RP-9004 | External health dashboard | Show CRM, AI, email, and job health in admin | Medium | Operators can see dependency state |
| RP-9005 | Advisory-only validation | Confirm signals never block or mutate workflow in pre-governance mode | High | Signals inform only |

### Sprint Exit Criteria

- Operational communication is real
- Signals are informative, not controlling

## Phase E - Open-System Validation

## Sprint 10 - Full Open-System UAT and Data Integrity Hardening

**Goal:** test the full system while it is still open and human-drivable.

**Outcome:** we know where the faults are before locking anything down.

### In Scope

- End-to-end UAT across all core and downstream flows
- Data integrity checks
- Cross-shell consistency checks
- Integration failure drills
- Bug fixing and cleanup only

### Required Test Journeys

- CRM qualified record -> workspace
- Workspace -> quote -> approval
- Quote -> proposal -> review -> send
- Proposal -> SLA -> contract-ready
- Document compile -> vault -> reopen -> export
- Manual ECR -> dashboard -> downstream visibility
- Contract -> renewal
- Contract signed -> handover
- Signals -> escalation -> notification
- AI draft -> human review -> accepted output

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-10001 | UAT runbook creation | Define exact real-user scenario tests and expected outcomes | Critical | Shared UAT runbook approved |
| RP-10002 | Cross-shell integrity checks | Verify statuses, IDs, docs, and ownership stay consistent across modules | Critical | No major cross-shell drift remains |
| RP-10003 | Integration fault testing | Simulate CRM, AI, email, and storage failures | High | Failures are visible and recoverable |
| RP-10004 | Data repair and migration cleanup | Fix drift, stale mock remnants, and bad legacy assumptions found in testing | Critical | UAT blockers resolved |
| RP-10005 | Go/no-go review for governance sprint | Decide whether final enforcement is allowed to begin | Critical | Governance sprint starts only after explicit signoff |

### Sprint Exit Criteria

- Product is fully testable end-to-end
- Team is satisfied with flow integrity
- Data integrity is acceptable
- Major fake completion has been removed

## Final Sprint - Governance Last

## Sprint 11 - Final Governance, Policy Enforcement, AI Lockdown

**Goal:** add enforcement only after the system is proven.

**Outcome:** policy, governance, and AI controls are applied to a system we already trust.

### In Scope

- Final gate enforcement
- Approval blocking where required
- Override doctrine finalization
- Admin-controlled policy configuration
- AI restriction enforcement
- Final lock behavior for canon/promotion paths

### Important Rule

This sprint does **not** invent process.

It only formalizes and enforces process that has already been tested in open mode.

### Tickets

| ID | Title | Description | Priority | Acceptance Criteria |
|---|---|---|---|---|
| RP-11001 | Persisted governance engine | Move policy configs, evaluations, overrides, and audit into canonical persisted services | Critical | Governance is no longer in-memory |
| RP-11002 | Stage and approval enforcement | Convert validated warning-mode paths into real enforced rules where approved | Critical | Approved gates now block correctly |
| RP-11003 | Final AI operating restrictions | Enforce approved AI boundaries on editing, promotion, export, and unsafe actions | Critical | AI cannot exceed approved authority |
| RP-11004 | Admin governance console finalization | Rebuild governance UI against real persisted enforcement services | High | Admin changes affect real system behavior |
| RP-11005 | Governance regression pass | Re-run all major flows under final enforcement mode | Critical | Enforcement does not create accidental prison behavior |

### Sprint Exit Criteria

- Enforcement is real
- Users understand the locked behaviors
- Governance only blocks what has already been proven necessary

## Definition of Done for the Recovery Program

The recovery program is complete only when:

1. no primary user flow depends on mock or in-memory business state,
2. no major screen pretends to be real when it is not,
3. core commercial flow works end-to-end,
4. documents are real outputs,
5. CRM and AI execute through real controlled paths,
6. downstream workflows are real or intentionally removed,
7. notifications and operational visibility exist,
8. data integrity has been tested in open mode,
9. only then governance and AI lockdown are applied.

## What Is Explicitly Not Allowed Before the Final Sprint

- Hard policy gates on stage movement
- Hard commercial lockouts during exploratory testing
- AI editing lockdown before AI workflow is tested
- Governance-driven blocking on partially implemented modules
- Canon enforcement on flows still undergoing UAT
- Admin settings that can accidentally freeze incomplete modules

## Recommended Ticketing Structure

Use these ticket types:

- `ARCH` - architecture and authority model
- `CORE` - workspace/quote/proposal/SLA
- `DOC` - document pipeline
- `CRM` - CRM execution
- `ADMIN` - identity/admin/backoffice
- `AI` - AI runtime and traceability
- `OPS` - notifications, jobs, health
- `DOWN` - renewals/tenders/handover
- `UAT` - validation and repair
- `GOV` - final governance sprint only

Example prefix mapping:

- `ARCH-2xx`
- `CORE-3xx`
- `DOC-4xx`
- `CRM-5xx`
- `ADMIN-6xx`
- `AI-7xx`
- `DOWN-8xx`
- `OPS-9xx`
- `UAT-10xx`
- `GOV-11xx`

## Recommended Delivery Discipline

Every sprint before Sprint 11 must end with:

1. a live truth review,
2. a list of what is still fake or partial,
3. a manual test summary,
4. a data integrity summary,
5. a decision on whether the next sprint can proceed.

## Final Note

This program succeeds only if we remain disciplined about one thing:

**do not mistake control for correctness.**

We are not trying to make the system strict first.
We are trying to make it true first.

Only after it is true do we make it strict.
