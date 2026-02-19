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
