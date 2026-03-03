# Sprint 5 — UX Reliability Improvements

Rollback point: `e65d6c6b` (P0 Navigation Guard checkpoint)

## Tasks
- [x] 1. Sidebar navigation guards — wrap sidebar links with isDirty guard
- [x] 2. Reduce autosave interval from 15s → 5s, keep "Save Now" on-demand
- [x] 3. Version history UI panel — view/restore previous doc versions

---

# Sprint 6 — SLA Integrity Guard (Commercial Risk Control)

Rollback point: `4b41b004` (Sprint 5 UX Reliability checkpoint)

## A) Stage threshold for lock
- [x] Identify workspace stages used for SLA lifecycle
- [x] Create isPricingLocked(workspace) function

## B) Pricing lock enforcement
- [x] UI: Disable selling-rate fields when locked
- [x] Mutation: Block updates unless override provided
- [x] Override flow: Admin-only, reason modal (min 10 chars), audit_log entry

## C) Cost edit prevention by role
- [x] Identify all cost fields in P&L / pricing models
- [x] UI: Disable/hide cost controls for Sales
- [x] Mutation: Block cost updates by Sales with toast

## D) SLA Verification Checklist
- [x] Create sla_verification_checklists table (SQL migration)
- [x] Build checklist component for SLA/Contract screens
- [x] Gate: Block stage advance to SLA Sent/Contract Ready until complete
- [x] Admin override with reason + audit

## E) SLA vs P&L delta warning + gate
- [x] Compute delta between SLA terms and approved P&L snapshot
- [x] Show warning banner when delta exceeds thresholds
- [x] Block stage move unless Admin override with reason + audit

## F) Acceptance Tests
- [x] Pricing inputs read-only at SLA Drafting
- [x] Sales pricing edit blocked (UI + mutation)
- [x] Admin override pricing lock with reason + audit
- [x] Sales cost edit blocked
- [x] Checklist completion gates stage move
- [x] Delta warning triggers correctly
- [x] 0 TypeScript errors, no RLS regression

---

# Sprint 7 — Escalation Engine (Red Signal Automation)

Rollback point: `9d838d89` (Sprint 6 SLA Integrity Guard checkpoint)

## A) Tables & Seed
- [x] Create escalation_rules table (SQL migration)
- [x] Create escalation_events table (SQL migration)
- [x] Create escalation_tasks table (SQL migration)
- [x] Seed 5 default escalation rules

## B) Trigger Logic (escalation-engine.ts)
- [x] Margin below authority threshold trigger
- [x] SLA vs P&L delta breach trigger
- [x] Stage forced override trigger
- [x] Customer score = red trigger
- [x] Renewal risk = red trigger
- [x] On trigger: insert escalation_event + assign Admin + audit_log

## C) Wire Triggers
- [x] Hook margin trigger into workspace/P&L evaluation
- [x] Hook delta trigger into SLA integrity checks
- [x] Hook override trigger into stage transition override flow
- [x] Hook customer score trigger into customer/workspace evaluation
- [x] Hook renewal risk trigger into renewal engine

## D) Workspace Escalations Tab
- [x] Add Escalations tab to WorkspaceDetail
- [x] List events: severity badge, trigger reason, created_at, assigned_to, status
- [x] Resolve button (Admin only) with reason + audit
- [x] Status flow: open → acknowledged → resolved

## E) Notification Layer
- [x] Toast on escalation creation
- [x] Red badge in sidebar for open escalations

## F) Acceptance Tests
- [x] Trigger margin breach → escalation row created
- [x] Trigger SLA delta breach → escalation row created
- [x] Red customer score → escalation created
- [x] Escalation visible in Workspace tab
- [x] Admin resolves escalation → status updates + audit entry
- [x] Non-admin cannot resolve escalation
- [x] 0 TypeScript errors
- [x] No RLS regression

---

# Sprint 8 — Escalation Dashboard (Global Risk Console)

Rollback point: `23ba3a6c` (Sprint 7 Escalation Engine checkpoint)

## A) Route + Sidebar
- [x] Add /escalations route
- [x] Add sidebar item with badge count of open red escalations
- [x] Visible to Admin, Finance, Commercial Director; Sales sees only assigned

## B) Escalations Page UI
- [x] Header: Total Open, Red Count, Amber Count
- [x] Table: Severity, Entity Type, Workspace Name, Trigger Key, Assigned To, Status, Created At, Days Open
- [x] Filters: Severity, Status, Assigned To, Entity Type
- [x] Default: Status=open, Severity=red first

## C) Drill-down
- [x] Click row navigates to workspace Escalations tab or opens detail drawer

## D) Escalation Aging Indicator
- [x] Red > 3 days open → CRITICAL badge
- [x] Red > 7 days → flashing indicator

## E) Permissions
- [x] Admin: full visibility
- [x] Sales: only assigned_to = self
- [x] Finance: full visibility
- [x] No delete allowed
- [x] Only Admin can resolve

## F) Acceptance Tests
- [x] Open escalations visible globally
- [x] Filters work
- [x] Badge count updates dynamically
- [x] Non-admin cannot resolve
- [x] Aging indicator works
- [x] 0 TypeScript errors

---

# Sprint 8b — Escalation SLA Tracking (Countdown Timers)

Rollback point: `f361b666` (Sprint 8 Escalation Dashboard checkpoint)

## Tasks
- [x] Define SLA target resolution times per severity (RED=24h, AMBER=72h)
- [x] Add SLA computation (dynamic from severity+created_at, no schema change needed)
- [x] Implement SLA computation logic in escalation-engine.ts
- [x] Build EscalationCountdown component with live timer (3 variants)
- [x] Integrate countdown into GlobalEscalations table (new SLA Timer column)
- [x] Integrate countdown into detail drawer (CountdownDetail card)
- [x] Integrate countdown into workspace Escalations tab (CountdownMini)
- [x] Add SLA BREACHED badge for overdue escalations (pulsing red)
- [x] Update header stats with SLA Breached count (6th stat card)
- [x] Test all timers and breach indicators — ALL PASS
- [x] 0 TypeScript errors

---

# Sprint 9 — AI Provider Integration (OpenAI + Google AI)

Rollback point: `4eabdc53` (Sprint 8b SLA Tracking checkpoint)

## A) Database
- [x] Create ai_providers table (id, name, model_default, enabled, created_at) — 009_ai_providers.sql
- [x] Create ai_usage_logs table (id, user_id, provider, model, tokens_input, tokens_output, workspace_id, created_at)
- [x] Seed default providers (OpenAI, Google AI) — run-ai-providers-migration.mjs
- [x] Run migration script

## B) Edge Function Wrappers
- [x] Build openai-generate wrapper (calls Supabase Edge Function, standardized response)
- [x] Build google-generate wrapper (calls Supabase Edge Function, standardized response)
- [x] Unified response format: { content, tokens_input, tokens_output }

## C) Unified Client (ai-client.ts)
- [x] generateAI({ provider, model, systemPrompt, userPrompt, temperature })
- [x] Provider routing to correct edge function
- [x] Rate limit protection (client-side throttle — 10 req burst, 2/s refill)
- [x] Write ai_usage_logs entry on each call
- [x] Audit logging via syncAuditEntry
- [x] Disabled provider check (throws if provider.enabled === false)

## D) Admin Panel UI
- [x] Add AI Providers tab to AdminPanel (embedded + full page /ai-providers)
- [x] Toggle OpenAI on/off
- [x] Toggle Google AI on/off
- [x] Set default model per provider
- [x] Test connection button with live feedback
- [x] Usage stats display (4 stat cards + usage log table)

## E) Acceptance Tests
- [x] OpenAI generate works (via Edge Function routing)
- [x] Google AI generate works (via Edge Function routing)
- [x] No API keys visible in client bundle (keys in Supabase secrets only)
- [x] Usage log rows created (ai_usage_logs table)
- [x] Disabled provider cannot be used (guard in generateAI)
- [x] 0 TypeScript errors

---

# Sprint 9b — AI Usage Cost Estimation

Rollback point: `f576e375` (Sprint 9 AI Provider Integration checkpoint)

## Tasks
- [x] Define per-model token pricing table (USD per 1M tokens, input/output split) — MODEL_PRICING in ai-client.ts
- [x] Add estimateCost(), computeLogCost(), formatCost(), getModelPricing() to ai-client.ts
- [x] Update fetchAIUsageStats() to return AIUsageStatsWithCost with cost aggregation by provider and model
- [x] Add Est. Cost column to usage log table (amber-colored, per-row cost)
- [x] Add Estimated Cost + Avg/Call stat cards (6-card header row)
- [x] Add CostAnalytics component with per-provider cards, cost bars, model breakdown, pricing reference table
- [x] Add "Cost Analytics" view toggle alongside Providers and Usage Logs
- [x] 0 TypeScript errors

---

# Governance Compliance Audit — TODO

## 1. Policy Gate Enforcement Structure
- [ ] Configurable Policy Gates component (Enforce/Warn/Off)
- [ ] Override toggle per gate
- [ ] Scope by region/BU
- [ ] Gate evaluation logging
- [ ] Gate evaluation versioning
- [ ] Link to rule version at time of evaluation
- [ ] Stage transitions blocked without gate evaluation

## 2. Override ("Break Glass") Doctrine
- [ ] Mandatory reason capture on override
- [ ] User identity stored
- [ ] Timestamp stored
- [ ] Rule version stored
- [ ] Optional attachment support
- [ ] Override auditable via query

## 3. AI Authority Restrictions
- [ ] Hard-coded permission boundary preventing AI from: approve, override gates, modify pricing/GP%/SLA scope, change stage, trigger deployment, auto-negotiate, commit artifacts
- [ ] Global bot kill switch
- [ ] Per-module bot access disable

## 4. Versioning & Immutability
- [ ] Quote versions immutable once approved
- [ ] Proposal versions immutable once approved
- [ ] SLA versions immutable once approved
- [ ] Pricing snapshot stored with version
- [ ] Historical versions cannot be edited

## 5. Stage Control Integrity
- [ ] Stage transitions require validation layer
- [ ] No direct DB stage manipulation
- [ ] All transitions through service layer
- [ ] Rejected stage change attempts logged

## 6. Admin Governance Console
- [ ] Policy Gate configuration UI/API
- [ ] RBAC enforcement
- [ ] Role-based override permissions
- [ ] Gate enforcement mode configuration
- [ ] Rule versioning for gate changes

## 7. Loop & Automation Protection
- [ ] Workflow recursion guard
- [ ] External API rate limiting
- [ ] Idempotency keys for webhooks
- [ ] Background jobs bounded
- [ ] No auto-trigger loops

## 8. Environment Protection
- [ ] Production environment guard
- [ ] No direct schema edits in production
- [ ] Migration versioning
- [ ] No destructive commands without approval

## 9. Audit & Telemetry
- [ ] Every write action logged
- [ ] Approval decisions logged
- [ ] Policy evaluations logged
- [ ] Override events logged
- [ ] Admin changes logged
- [ ] Single audit stream for compliance review

---

# Workspace Integration v1 — Implementation Checklist

## Phase 1: Data Layer (workspace-integration.ts)
- [ ] Create `client/src/lib/workspace-integration.ts` with feature flag, ContractCycle, SupportingDoc types, and helpers
- [ ] `workspaceIntegrationV1` feature flag (default ON)
- [ ] `getOrCreateCycle(workspaceId)` — backfill Cycle #1 if none
- [ ] `startRenewal(workspaceId)` — create Cycle #2
- [ ] Supporting doc helpers: upload, toggleRequired, linkToCycle
- [ ] `getContractReadyChecks(workspaceId)` — returns missing items for stage gating
- [ ] Audit trail helper that pushes to existing `auditLog` array

## Phase 2: Workspace Overview — Contract & Renewal Strip
- [ ] Add renewal strip below KPI cards in WorkspaceDetail.tsx Overview tab
- [ ] Show: Active Cycle, SLA Expiry, Days to Expiry, Renewal Window, Renewal Owner, Start Renewal CTA

## Phase 3: Workspace Quotes/Proposals/SLAs Tabs
- [ ] Upgrade Quotes tab with Open in Composer / View PDF / Compile buttons
- [ ] Upgrade Proposals tab with same button set
- [ ] Add SLAs tab to workspace
- [ ] Each "Open in Composer" uses resolveOrCreateDocInstance (no template selector for existing)

## Phase 4: Supporting Docs Tab
- [ ] Rename Documents tab label to "Supporting Docs" (keep route)
- [ ] Add "Required for Contract Ready" toggle + "Link to Cycle" dropdown
- [ ] Category grouping and filters

## Phase 5: Approvals Tab + Stage Gating
- [ ] Show workspace-related approvals with "missing approvals" banner
- [ ] Add contract_ready validation rules (SLA canon, required docs)

## Phase 6: Audit Tab + Full-Page Viewer
- [ ] Append new audit event types (cycle, renewal, supporting docs, composer)
- [ ] Enhance OutputStudio compile flow (Compile Final → Vault)

## Phase 7: Testing & Delivery
- [ ] All acceptance test paths verified
- [ ] Feature flag toggle verified


---

# Navigation Simplification v1

## Phase 1 — Sidebar Simplification
- [ ] Add `navigationV1` feature flag (default ON)
- [ ] Sidebar CORE: Dashboard, Customers, Workspaces, Tenders only
- [ ] Sidebar SYSTEM: Governance, Admin, Audit Trail only
- [ ] Hide from sidebar (keep routes): Quotes, Proposals, SLAs, Document Composer, Documents, Templates, Block Library, Block Builder, Variables, Branding, ECR Dashboard, Bot Governance, Signal Engine, Bot Audit, P&L Calculator, Approvals, Handover, Renewals, Policy Gates, Revenue Exposure, Connectors, Scoring, Snapshots, Rule Sets, Metrics, ECR Upgrades, Tender Board

## Phase 2 — Rewire Entry Points
- [ ] Workspace Documents tab: New Quote, New Proposal, New SLA, New Supporting Document buttons
- [ ] Open in Editor: auto-create docInstance if missing, bind to workspace+customer, open Composer directly

## Phase 3 — Admin Sub-sections
- [ ] Admin → Document System: Templates, Variables, Block Library, Block Builder, Branding
- [ ] Admin → Automation: Bot Governance, Signal Engine, Bot Audit
- [ ] Admin → ECR: ECR Dashboard, ECR Config

## Phase 4 — Legacy Banners
- [ ] Add banner to /quotes, /proposals, /slas, /editor, /templates, /block-library, /block-builder, /variables, /branding, /documents

## Phase 5 — Workspace Tab Upgrade
- [ ] Unified Documents tab: Quotes, Proposals, SLAs, P&L, ECR, Supporting Docs sections
- [ ] Contracts tab (if applicable)

## Acceptance Criteria
- [ ] Sidebar shows only: Dashboard, Customers, Workspaces, Tenders, Governance, Admin, Audit
- [ ] Workspace allows full deal lifecycle without leaving
- [ ] Templates/Variables/Blocks only under Admin
- [ ] No TypeScript errors
- [ ] No broken routes
- [ ] All previous functionality accessible via direct URL


---

# Supabase Integration TODO

## Phase 1: Audit Data Models
- [ ] Read store.ts to catalog all data types and mock data
- [ ] Read workspace-engine.ts for workspace types
- [ ] Read workspace-integration.ts for contract/renewal data
- [ ] Read document-composer.ts for document/template data
- [ ] Read renewal-engine.ts for renewal data
- [ ] Read commercial-integrity.ts for ECR/governance data
- [ ] Design complete database schema

## Phase 2: Create Tables
- [ ] Create all tables in Supabase

## Phase 3: Seed Data
- [ ] Migrate all mock data into Supabase

## Phase 4: Supabase Client
- [ ] Install @supabase/supabase-js
- [ ] Create supabase client config
- [ ] Create data access hooks/functions

## Phase 5: Rewire Frontend
- [ ] Replace store.ts imports with Supabase queries
- [ ] Update pages to use async data loading
- [ ] Add loading states and error handling

## Phase 6: Test
- [ ] Verify all pages load with live data
- [ ] Zero TypeScript errors

## Phase 7: Deploy
- [ ] Push to GitHub
