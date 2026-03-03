# Sprint 5 — UX Reliability Improvements

Rollback point: `e65d6c6b` (P0 Navigation Guard checkpoint)

## Tasks
- [x] 1. Sidebar navigation guards — wrap sidebar links with isDirty guard
- [x] 2. Reduce autosave interval from 15s → 5s, keep "Save Now" on-demand
- [x] 3. Version history UI panel — view/restore previous doc versions

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
