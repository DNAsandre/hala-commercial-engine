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

# Sprint 10 — Editor AI Pop-up + Bot Selector + Transcript Document Bots

Rollback point: `d82abfa9` (Sprint 9b Cost Estimation checkpoint)

## A) Data Model & Persistence
- [x] Create ai-runs.ts with AIRun interface and CRUD functions (createAIRun, applyAIRun, discardAIRun, getAIRunsForDocument)
- [x] Extend bot registry with bot_type (block/document), allowed_doc_types, allowed_block_types — EditorBot interface
- [x] Add mock document bots: Transcript Filler, Legal Reviewer, Spellcheck, Full Rewriter (8 bots total: 4 block + 4 document)

## B) Block AI Panel
- [x] Build BlockAIPanel component (left slide-in, non-modal, w-80)
- [x] Bot selector dropdown (filtered by bot_type=block, allowed_doc_types)
- [x] Provider/model shown read-only from bot config (Badge display)
- [x] Prompt editor textarea with template support
- [x] Insert/Replace toggle (segmented control)
- [x] Context preview (current block text, doc metadata, collapsible)
- [x] Generate Draft button → calls generateBlockContent → stores ai_run with status=draft
- [x] Draft preview with "AI Draft" badge (dashed amber border)
- [x] Apply to Block button → commits to block, marks is_ai_generated, ai_run status=applied
- [x] Discard Draft button → ai_run status=discarded
- [x] Audio record button (v1: toast placeholder, paste transcript text)
- [x] Upload transcript (.txt/.md) support with FileReader

## C) Document AI Panel
- [x] Build DocumentAIPanel component (left slide-in, non-modal, w-96)
- [x] Bot selector filtered to bot_type=document
- [x] Mandatory transcript input (upload or paste, word count badge)
- [x] Run mode dropdown (Fill missing, Rewrite all, Legal review, Spellcheck)
- [x] Multi-block preview with before/after for each block (expandable)
- [x] Per-block Apply checkbox
- [x] Apply Selected Changes button (count badge)
- [x] Single ai_run row with output json + status

## D) Integration & Safeguards
- [x] Wire BlockAIPanel into DocumentComposer (sparkle click opens panel)
- [x] Wire DocumentAIPanel into toolbar (AI Document button with active state)
- [x] AI never auto-commits — staged draft state only (Apply button required)
- [x] AI cannot write to pricing/ECR/gates/approvals (block permissions check)
- [x] Locked blocks cannot be AI-edited (guard in handleAIGenerate + locked blocks excluded in doc panel)
- [x] "AI Draft" badge on draft preview, is_ai_generated flag set on apply
- [x] Audit logging: ai_draft_created, ai_draft_applied, ai_draft_discarded (via syncAuditEntry)
- [x] Phase 0: graceful error state if Edge Functions not deployed (CloudOff banner)

## E) Acceptance
- [x] Block sparkle opens panel, generate draft, Apply inserts into block
- [x] Replace vs Insert toggle works
- [x] Document bot: paste transcript, generate multi-block suggestions, apply selected
- [x] Non-admin cannot apply to locked blocks (guard + locked blocks excluded)
- [x] ai_usage_logs populated (via createAIRun audit trail)
- [x] audit_log contains AI actions (ai_draft_created/applied/discarded)
- [x] 0 TypeScript errors

## F) Bug Fixes (Post-Testing)
- [x] FIX: handleBlockAIApply double state update — merged content + is_ai_generated into single setDocumentDirty
- [x] FIX: TipTap editor doesn't sync when content changes via state — added useEffect with prevContentRef to call editor.commands.setContent()
- [x] FIX: handleDocAIApply same TipTap sync issue — editors now sync via the same useEffect
- [x] FIX: handleAcceptAI (old staging) same double-update bug — merged into single setDocumentDirty
- [x] FIX: syncAuditEntry entity_type null — changed snake_case to camelCase (entityType/entityId/userId/userName)
- [x] Verify all flows in browser after fixes — ALL 6 TESTS PASS

---

# Sprint 11 — Bot Builder Integration + Knowledgebase Upload + Execution Wiring

Rollback point: `6b82904c` (Sprint 10 Bug Fixes checkpoint)

## Pre-Sprint Fixes
- [x] Fix Governance/Admin sidebar active state collision (/admin vs /admin-panel)
- [x] Build AI Run History sidebar in DocumentComposer right sidebar
- [x] Build EditorBotBuilder admin page with full CRUD for editor bots
- [x] Wire Edge Function integration (try real AI → fallback to mock)

## A) Knowledgebase Engine
- [x] Create knowledgebase.ts data model (collections, documents, chunks, embeddings, bot-KB links, bot runs)
- [x] Paragraph-aware chunking engine (1000-char target, 150-char overlap)
- [x] Keyword-based retrieval with relevance scoring
- [x] Citation extraction and formatting (extractCitations, formatRetrievedContext)
- [x] Seed data: 4 collections, 8 documents, pre-chunked
- [x] Supabase-first persistence with in-memory fallback

## B) Admin Knowledgebase Manager UI
- [x] Full page at /knowledgebase (collections grid, create form, doc upload/paste, chunk viewer)
- [x] Embedded tab in Admin Panel
- [x] Route registered with admin-only access

## C) Enhanced Bot Builder
- [x] KBAttachmentManager component: attach/detach KB collections with priority ordering
- [x] TestBotPanel with real KB retrieval: searches linked collections, shows chunks + relevance scores
- [x] Doc type context selector in test panel
- [x] Bot_run trace creation with retrieved chunks

## D) Execution Pipeline
- [x] generateBlockContent: KB retrieval → context injection → generateAI → bot_run trace → citations
- [x] BlockGenerateResult type with retrieved_chunks and citations
- [x] Bot_run records created for both real AI and mock fallback
- [x] Array.from(new Set()) for collection names (ES target fix)

## E) Citation Display
- [x] BlockAIPanel: KB Sources section (chunk count, source names, indices, snippet previews)
- [x] DocumentAIPanel: Per-block citations below each AI suggestion
- [x] BookOpen icon for citation sections

## F) Acceptance
- [x] 0 TypeScript errors
- [x] Browser test: Block AI with KB citations — sparkle opens panel, generate draft, apply replaces block content
- [x] Browser test: Document AI with per-block citations — transcript paste, generate suggestions, selective apply (2 of 3)
- [x] Browser test: Editor Bot Builder KB attachment + test panel — 8 bots (4 block + 4 doc), stats display
- [x] Browser test: Knowledgebase Manager collections + upload — 4 collections, 11 docs, 64 chunks
- [x] Browser test: AI Run History sidebar — shows 2 runs after block + doc AI operations

---

# Sprint 12 — CRM Production Integration + Sync Engine Hardening (Zoho + GHL)

Rollback point: `21d516dc` (Sprint 11 checkpoint)

## A) CRM Sync Engine (crm-sync-engine.ts)
- [x] CRMConnection interface (id, provider: zoho|ghl|salesforce|hubspot|custom, base_url, enabled, auth_method, last_sync_at, health_status)
- [x] CRMFieldMapping interface (local_table, local_field, crm_field, transform)
- [x] HardenedCRMSyncEvent interface (entity_type, entity_id, direction, status, payload, response, error, retry_count, max_retries, next_retry_at, processed_at)
- [x] Seed Zoho connection (active, connected) + GHL connection (enabled, configuring, migration mode)
- [x] Default field mappings for both providers (10 Zoho + 7 GHL)
- [x] Exponential backoff retry scheduler (1m → 5m → 15m → 1h → 6h)
- [x] Conflict resolution engine (timestamp comparison, last-write-wins with audit)

## B) Outbound Sync
- [x] triggerOutboundSync() — creates pending sync event, routes to Edge Function
- [x] Trigger on: workspace stage change, quote status change, proposal approved, SLA ready, customer CRUD
- [x] On success → status=success, processed_at set
- [x] On failure → retry_count++, next_retry_at computed
- [x] If retry_count > max_retries → status=failed + create escalation event (severity=amber, crm_sync_failed)
- [x] processRetryQueue() — processes all retrying events

## C) Inbound Sync
- [x] processInboundWebhook() — validates signature, maps fields, upserts entity
- [x] Field mapping via crm_mappings table
- [x] Conflict detection (compare updated_at timestamps, local_wins resolution)
- [x] Write crm_sync_events row (direction=inbound)

## D) CRM Sync Console UI
- [x] Connection cards (Zoho + GHL) with status, last sync, toggle, Test/Resync/Disable buttons
- [x] Sync event table with 4 filters (connection, direction, status, entity_type) — 10 seed events
- [x] Manual retry button per failed/retrying event
- [x] Bulk resync button
- [x] Sync health stats (6 cards: total, pending, success, failed, retrying, avg latency)
- [x] Field mapping viewer (grouped by provider, direction badges, active toggles)
- [x] Conflict resolution log (entity, timestamps, resolution, detail)

## E) Integration & Safeguards
- [x] Wire into Admin Panel as CRM Sync tab (10th tab, embedded stats + connection cards)
- [x] Add /crm-sync-console route (admin-only) + sidebar link
- [x] Escalation integration: failed sync > max_retries → escalation event (crm_sync_failed)
- [x] Audit logging: crm_push_success, crm_push_failed, crm_conflict_resolved
- [x] Never block UI on CRM failure (async processing)
- [x] No direct client → CRM calls (Edge Functions only)

## F) Acceptance
- [x] Workspace stage change → crm_sync_event created (triggerOutboundSync)
- [x] Force failure → retry_count increments (processOutboundEvent)
- [x] After max retries → escalation created (createEscalation with crm_sync_failed)
- [x] Inbound webhook updates workspace correctly (processInboundWebhook)
- [x] Zoho + GHL connections visible and toggleable — BROWSER VERIFIED
- [x] No API keys in client bundle (keys in Supabase secrets only)
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


---

# Sprint 13 — CRM Dashboard Widget + Sync Badges + Workspace Integration

Rollback point: `936264fb` (Sprint 12 checkpoint)

## A) CRM Dashboard Widget
- [ ] Add compact CRM health indicator card to main Dashboard
- [ ] Show: last sync time, pending count, failed count, connection status
- [ ] Link to full CRM Sync Console
- [ ] Auto-refresh every 30 seconds

## B) CRM Sync Badges in Workspace
- [ ] Add CRM status badge to workspace cards (Synced / Pending / Failed / Not Synced)
- [ ] Add "Sync Now" button in WorkspaceDetail (admin-only)
- [ ] Show last CRM sync timestamp in workspace detail header
- [ ] Wire triggerOutboundSync to workspace stage changes

## C) CRM Entity Mapping Viewer
- [ ] Show CRM entity ID mapping in workspace detail (Zoho ID, GHL ID)
- [ ] Link to CRM record (external URL)
- [ ] Show sync history per workspace entity

## D) Acceptance
- [ ] Dashboard shows CRM health widget
- [ ] Workspace cards show sync status badge
- [ ] Admin can trigger manual sync from workspace
- [ ] 0 TypeScript errors

---

# Sprint 14 — Production PDF Engine (Commercial-Grade + Dual-Language EN/AR)

Rollback point: Sprint 13 checkpoint

## A) PDF Engine Core (pdf-engine.ts)
- [ ] PDFTemplate interface (id, name, doc_type, version, layout_config, header_config, footer_config, styling_config)
- [ ] PDFRenderConfig interface (branding, watermark, language, sections)
- [ ] Seed templates: Quote, Proposal, SLA/MSA, Service Order, Financial Proposal
- [ ] Rendering pipeline: Document Blocks → Structured Render Map → Layout Engine → Styled HTML → PDF
- [ ] Section-based rendering (cover, confidentiality, intro, scope, pricing, terms, SLA matrix, legal, signatures)

## B) Cover Page Generator
- [ ] Full-page cover with navy blue gradient + wave design (matching Hala's actual PDFs)
- [ ] Dynamic title, subtitle, customer name, reference number, date
- [ ] Optional background image support
- [ ] Cover page variants: Style A (wave design), Style B (minimal corporate)

## C) Header/Footer System
- [ ] Repeating header: Hala logo (left) + document title (center) + customer logo (right)
- [ ] Repeating footer: "COMPLETED BY: Hala SCS | DATE: DD MM YYYY | REF: HSCS_DDMMYYYY"
- [ ] Page numbering: "Page X of Y" right-aligned
- [ ] Arabic header variant for bilingual documents

## D) Professional Table Rendering
- [ ] Pricing tables with dark header row, clean borders, SAR currency formatting
- [ ] Totals row with emphasis styling
- [ ] VAT row support
- [ ] Multi-option pricing (Option 1, Option 2, Option 3 columns)
- [ ] SLA Matrix table with response times, escalation tiers, severity highlighting

## E) Signature Section
- [ ] Dual-party signature block (Hala + Customer)
- [ ] Bilingual labels (English + Arabic)
- [ ] Company stamp placeholder
- [ ] Date and designation fields
- [ ] "who warrants that he is duly authorized to sign" text

## F) Arabic Translation Bot
- [ ] New AI bot type: "arabic_translator" in ai-runs.ts
- [ ] Translate document sections from English to Arabic
- [ ] Support for legal/commercial Arabic terminology
- [ ] Human review before applying translations
- [ ] Translation memory/cache for consistent terminology
- [ ] Bot appears in Editor Bot Builder with KB attachment support

## G) Dual-Language PDF Support
- [ ] Two-column layout: English (left) + Arabic (right, RTL)
- [ ] Arabic font support (Noto Naskh Arabic or Amiri)
- [ ] RTL text direction for Arabic columns
- [ ] Bilingual section headings
- [ ] Bilingual table headers
- [ ] Bilingual signature blocks
- [ ] Language toggle: English-only, Arabic-only, Dual-language

## H) PDF Studio UI (Admin Page)
- [ ] Template manager with CRUD operations
- [ ] Live PDF preview panel
- [ ] Template configuration: cover style, table style, signature layout, margins, header/footer variants
- [ ] Document type selector (Quote, Proposal, SLA, Service Order)
- [ ] Language mode selector (EN, AR, EN+AR)
- [ ] Watermark mode selector (Draft, Confidential, Final)
- [ ] Brand profile selector
- [ ] Generate PDF button with download
- [ ] Admin Panel tab integration

## I) Workspace PDF Generation
- [ ] "Generate PDF" button in workspace document tabs
- [ ] Template selection dropdown
- [ ] Language mode selection
- [ ] Preview before download
- [ ] Audit logging for PDF generation events

## J) Acceptance
- [ ] Quote PDF matches Hala's actual design quality
- [ ] Proposal PDF has proper section hierarchy
- [ ] SLA/MSA PDF has dual-language layout
- [ ] Pricing tables render with SAR formatting
- [ ] Cover page renders with wave design
- [ ] Header/footer repeat on every page
- [ ] Arabic text renders RTL correctly
- [ ] Translation bot produces Arabic output
- [ ] 0 TypeScript errors


---

# Bug Fixes — User Feedback Round 1

## Fix 1: Back to Editor navigation broken
- [ ] Output Studio "Back to Editor" navigates to wrong URL instead of returning to the document editor
- [ ] Must work for quotes, proposals, SLAs, tenders — any document type

## Fix 2: Delete button for draft documents
- [ ] Add delete button on draft quotes, proposals, SLAs in workspace Documents tab
- [ ] Only show delete on drafts (not approved/sent documents)
- [ ] Confirm dialog before deletion

## Fix 3: Compile view not inserting editor content properly
- [ ] Output Studio must pull actual editor block content into the PDF pages
- [ ] Match the professional layout from Hala's uploaded PDF examples
- [ ] Cover page, pricing tables, scope of work, terms — all must show real content
