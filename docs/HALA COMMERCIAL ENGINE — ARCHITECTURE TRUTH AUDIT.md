# HALA COMMERCIAL ENGINE --- ARCHITECTURE TRUTH AUDIT {#hala-commercial-engine-architecture-truth-audit}

**Audit Date:** 2026-05-14 **Auditor:** Architecture Intelligence (no sprint defense) **Status:** CRITICAL FINDINGS --- READ BEFORE NEXT SPRINT

# ARTIFACT 1 --- MASTER OBJECT RELATIONSHIP MAP {#artifact-1-master-object-relationship-map}

## Three Distinct Application Domains

[DOMAIN 3: Tender WorkspaceTendersTender PacksPlaceholdersRequired DocumentsCompliance ItemsMock GatesSplit ChecksPack OutputsSubmission EmailsDOMAIN 2: Commercial OS (Intelligence)DashboardPipelineCapacityForecastRevenueCustomers/360TransportationOps SignalsOS EscalationsMonthly ReportCustomer PackDocument VaultDOMAIN 1: Commercial Ops (Execution)Workspace (189KB!)Quote ScenariosPricing LinesP&L SnapshotsProposalsNegotiationsSLA DraftsCustomer ScoreCapacity FitRevenue RealizationWorkspace Escalations]{.mark}

## Object Truth Table

| Object                   | Source of Truth                       | Data Type               | Read/Write                        | Domain |
|--------------------------|---------------------------------------|-------------------------|-----------------------------------|--------|
| **Customer**             | Supabase customer_master              | Live DB                 | Read-only (OS) / Read-write (Ops) | Both   |
| **Tender**               | Supabase tenders                      | Live DB (Linde seed)    | Read via Supabase                 | Tender |
| **Tender Workspace**     | Supabase (20+ tables)                 | Live DB                 | Read + limited write              | Tender |
| **Commercial Workspace** | Supabase (commercial\_\* tables)      | Live DB + Mock fallback | Read + mock write                 | Ops    |
| **Proposal**             | Supabase commercial_proposal_versions | Live DB                 | Read-only display                 | Ops    |
| **Quote Scenario**       | Supabase commercial_quote_scenarios   | Live DB                 | Read-only display                 | Ops    |
| **SLA Draft**            | Supabase commercial_sla_drafts        | Live DB                 | Read-only display                 | Ops    |
| **Revenue Record**       | Supabase revenue_actuals              | Batch import (Excel)    | Read-only                         | OS     |
| **Forecast Record**      | Supabase forecast_monthly             | Batch import            | Read-only                         | OS     |
| **Capacity Snapshot**    | Supabase warehouse_capacity_snapshots | Batch import            | Read-only                         | OS     |
| **Pipeline Opportunity** | Supabase commercial_opportunities     | Batch import            | Read-only                         | OS     |
| **Signal (Ops)**         | Supabase operations_signals           | Seed data               | Read-only                         | OS     |
| **Escalation (OS)**      | Supabase commercial_escalations       | Seed data               | Read-only                         | OS     |
| **Monthly Report**       | Client-side computed                  | No persistence          | Read-only                         | OS     |
| **Customer Review Pack** | Client-side computed                  | No persistence          | Read-only                         | OS     |
| **Document Vault**       | Supabase document_vault               | Seed metadata only      | Read-only                         | OS     |
| **KPI Registry**         | Supabase kpi_source_registry          | Seed data               | Read-only                         | OS     |
| **Assumptions**          | Supabase default_assumptions          | Seed data               | Read-only                         | OS     |
| **GP Cost Basis**        | Supabase gp_deal_cost_basis           | Seed data               | Read-only                         | OS     |

WARNING

**CRM Dependency:** Zero. CRM sync exists as UI shell only (mock/simulated). No live CRM integration. **ERP Dependency:** Zero. All financial data is Excel batch import.

# ARTIFACT 2 --- END-TO-END COMMERCIAL FLOW MAP {#artifact-2-end-to-end-commercial-flow-map}

## Current State: Flow Is Fragmented Across 3 Domains

[Lead → \[NOT IN SYSTEM\]]{.mark}

[↓]{.mark}

[Opportunity → Commercial OS Pipeline (Excel import, batch-level, read-only)]{.mark}

[↓]{.mark}

[Tender → Tender Workspace (Linde SIGAS seeded, Supabase-backed, deep)]{.mark}

[↓]{.mark}

[Proposal → Commercial Workspace (Supabase-backed, display-only after creation)]{.mark}

[↓]{.mark}

[Quote Pricing → Commercial Workspace (scenario-level, 3 options seeded)]{.mark}

[↓]{.mark}

[SLA → Commercial Workspace (draft-level, sections/KPIs/promise gaps)]{.mark}

[↓]{.mark}

[Contract → \[NOT IN SYSTEM\]]{.mark}

[↓]{.mark}

[Delivery → \[NOT IN SYSTEM --- capacity snapshots are point-in-time imports\]]{.mark}

[↓]{.mark}

[Revenue → Commercial OS Revenue (GL import, read-only)]{.mark}

[↓]{.mark}

[Renewal → Renewal Engine (Supabase-backed, operational)]{.mark}

### Where Commercial Ops Runs Execution

- **Workspace Detail** (WorkspaceDetail.tsx --- 189KB, the largest file in the app)

- Quote scenarios, pricing lines, P&L, proposals, negotiations, SLAs, activity, audit

- All backed by Supabase via supabase-commercial-data.ts

### Where Commercial OS Runs Intelligence

- **13 pages** under /commercial-os/\*

- Pipeline, capacity, forecast, revenue, customers, transportation, ops signals, escalations, reports, documents

- All backed by batch-imported data via commercial-os-data.ts (78KB)

### Where Governance Runs Controls

- **AdminGovernance** (/admin) --- governance rules, bot registry

- **KPI Registry** --- definitions, formulas, source mappings

- **Assumption Registry** --- confidence tiers, owners

- **Document Vault** --- metadata registry (NO actual file governance)

CAUTION

**Critical Gap:** There is NO automated flow between domains. A tender win doesn\'t create a revenue record. A proposal doesn\'t link to pipeline. Capacity doesn\'t feed back to quotes. Each domain is an island.

# ARTIFACT 3 --- FULL ROUTE + MODULE TRUTH TABLE {#artifact-3-full-route-module-truth-table}

## Commercial OS Pages (13 pages --- /commercial-os/\*) {#commercial-os-pages-13-pages-commercial-os}

| Route                                    | Page                  | Data Source     | Live/Placeholder                | Writes? | Strategic Value | Sprint Drift Risk |
|------------------------------------------|-----------------------|-----------------|---------------------------------|---------|-----------------|-------------------|
| /commercial-os                           | Dashboard (66KB)      | Supabase batch  | **LIVE** --- real imported data | No      | **HIGH**        | Low               |
| /commercial-os/pipeline                  | Pipeline (39KB)       | Supabase batch  | **LIVE**                        | No      | **HIGH**        | Low               |
| /commercial-os/capacity                  | Capacity (24KB)       | Supabase batch  | **LIVE**                        | No      | **HIGH**        | Low               |
| /commercial-os/forecast                  | Forecast (25KB)       | Supabase batch  | **LIVE**                        | No      | **HIGH**        | Low               |
| /commercial-os/revenue                   | Revenue (19KB)        | Supabase batch  | **LIVE**                        | No      | **HIGH**        | Low               |
| /commercial-os/customers                 | Customers (13KB)      | Supabase batch  | **LIVE**                        | No      | **HIGH**        | Low               |
| /commercial-os/customers/:id             | Customer 360 (25KB)   | Supabase batch  | **LIVE**                        | No      | **HIGH**        | Low               |
| /commercial-os/transportation            | Transportation (11KB) | Supabase batch  | **LIVE**                        | No      | Medium          | Low               |
| /commercial-os/actions                   | Actions (2KB)         | Supabase batch  | **LIVE**                        | No      | Medium          | Low               |
| /commercial-os/ops-signals               | Ops Signals (14KB)    | Supabase seed   | **SEED DATA**                   | No      | Low             | **HIGH**          |
| /commercial-os/escalations               | Escalations (17KB)    | Supabase seed   | **SEED DATA**                   | No      | Low             | **HIGH**          |
| /commercial-os/reports/monthly           | Monthly Report (23KB) | Client-computed | **COMPUTED** --- no persistence | No      | Medium          | Medium            |
| /commercial-os/documents                 | Document Vault (13KB) | Supabase seed   | **SEED METADATA**               | No      | **LOW**         | **HIGH**          |
| /commercial-os/customers/:id/review-pack | Customer Pack (26KB)  | Client-computed | **COMPUTED**                    | No      | Medium          | Medium            |

## Commercial Ops Pages (Workspace Domain)

| Route           | Page                      | Data Source | Live/Placeholder        | Writes?       | Strategic Value |
|-----------------|---------------------------|-------------|-------------------------|---------------|-----------------|
| /commercial     | Commercial Pipeline       | Supabase    | **LIVE**                | Limited       | **HIGH**        |
| /workspaces/:id | Workspace Detail (189KB!) | Supabase    | **LIVE** (Linde seeded) | Yes (actions) | **CRITICAL**    |
| /tenders        | Tenders (77KB)            | Supabase    | **LIVE** (Linde seeded) | No            | **HIGH**        |
| /tenders/:id    | Tender Workspace          | Supabase    | **LIVE**                | Yes (outputs) | **CRITICAL**    |
| /proposals      | Proposals (16KB)          | Supabase    | **LIVE**                | No            | **HIGH**        |
| /proposals/:id  | Proposal Detail           | Supabase    | **LIVE**                | No            | **HIGH**        |
| /slas           | SLAs (18KB)               | Supabase    | **LIVE**                | No            | **HIGH**        |
| /renewals       | Renewals (40KB)           | Supabase    | **LIVE**                | Yes           | **HIGH**        |

## Other Pages

| Route           | Page                      | Data Source | Status                 | Drift Risk |
|-----------------|---------------------------|-------------|------------------------|------------|
| /               | Dashboard (45KB)          | Supabase    | **LIVE**               | Low        |
| /customers      | Customer List             | Supabase    | **LIVE**               | Low        |
| /quotes         | Quotes                    | Supabase    | **LIVE**               | Low        |
| /pdf-studio     | PDF Studio (63KB)         | Client-side | **FUNCTIONAL**         | Low        |
| /document-vault | Document Vault (14KB)     | Supabase    | **LIVE** (tender docs) | Low        |
| /escalations    | Global Escalations (30KB) | Supabase    | **LIVE**               | Low        |
| /ecr            | ECR Dashboard             | Supabase    | **LIVE**               | Low        |

IMPORTANT

**Duplicate Detection:**

- **Document Vault × 2**: /document-vault (tender/ops domain, Supabase-backed) AND /commercial-os/documents (DOC-001, seed metadata only). These are DIFFERENT systems with DIFFERENT purposes but the same name.

- **Escalations × 2**: /escalations (global, Supabase-backed, operational) AND /commercial-os/escalations (OS, seed data, read-only). Different data sources.

- **Customer views × 2**: /customers/:id (ops detail, 48KB) AND /commercial-os/customers/:id (OS 360 view, 25KB). Complementary but could confuse.

# ARTIFACT 4 --- DATA SOURCE + IMPORT MAP {#artifact-4-data-source-import-map}

## Import Pipeline

| Source                        | Destination Table            | Import Method           | Matching Keys        | Risk                                 |
|-------------------------------|------------------------------|-------------------------|----------------------|--------------------------------------|
| Hala_Commercial_Pipeline.xlsx | commercial_opportunities     | Batch import → Supabase | batch_id             | **Medium** --- no dedup beyond batch |
| Revenue_Actuals_GL.xlsx       | revenue_actuals              | Batch import            | batch_id             | **Medium** --- GL codes must match   |
| Warehouse_Capacity.xlsx       | warehouse_capacity_snapshots | Batch import            | batch_id + warehouse | **Low**                              |
| Closed_Won_Deals.xlsx         | closed_won_deals             | Batch import            | batch_id             | **Medium**                           |
| Linde SIGAS seed SQL          | 20+ tender tables            | Direct SQL insert       | tender_id            | **Low** --- idempotent               |
| Manual seed SQL               | operations_signals           | Direct SQL insert       | N/A                  | **HIGH** --- fake signals            |
| Manual seed SQL               | commercial_escalations       | Direct SQL insert       | N/A                  | **HIGH** --- fake escalations        |
| Manual seed SQL               | document_vault               | Direct SQL insert       | N/A                  | **HIGH** --- metadata only           |

## GP Logic Chain

[Pipeline Opportunity → gpBasis + gpMarginPct + gpConfidenceStatus]{.mark}

[↓]{.mark}

[gp_deal_cost_basis table → verified vs assumed split]{.mark}

[↓]{.mark}

[CommercialOsCustomerReviewPack → computeGpV2Summary() helper]{.mark}

[↓]{.mark}

[DEFAULT: 25% GP margin (dangerous default, flagged in UI)]{.mark}

CAUTION

**Double Counting Risk:** Revenue actuals (GL import) and pipeline opportunities (Excel import) are NOT deduped. A won deal could appear in both closed_won_deals and revenue_actuals with different amounts. No reconciliation exists.

WARNING

**Missing Integrations:**

- No ERP connection (all GL data is manual Excel)

- No CRM connection (mock/simulated only)

- No automated import pipeline (all manual batch)

- No tender → revenue linkage

- No proposal → invoice linkage

# ARTIFACT 5 --- SPRINT DRIFT + RISK REGISTER {#artifact-5-sprint-drift-risk-register}

| Sprint Ticket                        | Classification             | Verdict   | Rationale                                                                                                                                                                                                                                  |
|--------------------------------------|----------------------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **DATA-002B** (OS Schema + Seed)     | **VALID CORE**             | ✅ KEEP   | Foundation for all Commercial OS pages. Real batch imports.                                                                                                                                                                                |
| **CUST-001** (Customer Master)       | **VALID CORE**             | ✅ KEEP   | Customer 360 is operationally critical.                                                                                                                                                                                                    |
| **GP-001/GP-002** (GP Visibility)    | **VALID CORE**             | ✅ KEEP   | GP basis visibility prevents fake margin reporting.                                                                                                                                                                                        |
| **DATA-003B** (KPI Registry)         | **VALID CORE**             | ✅ KEEP   | Formula-native comparison mode is unique value.                                                                                                                                                                                            |
| **ASSUMP-001** (Assumption Registry) | **VALID CORE**             | ✅ KEEP   | Assumption transparency prevents dangerous defaults.                                                                                                                                                                                       |
| **TPT-001** (Transportation)         | **VALID BUT LOW PRIORITY** | ⚠️ REVIEW | Useful but not critical path.                                                                                                                                                                                                              |
| **RPT-001** (Monthly Report)         | **VALID BUT LOW PRIORITY** | ⚠️ REVIEW | Computed on each load, no persistence. Useful but not operationally deep.                                                                                                                                                                  |
| **RPT-002** (Customer Pack)          | **VALID BUT LOW PRIORITY** | ⚠️ REVIEW | Same --- computed, no persistence. Good UX but shallow.                                                                                                                                                                                    |
| **OPS-001** (Ops Signals)            | **PLACEHOLDER SHELL**      | 🔴 FLAG   | Seed data only. No real signal generation. No integration with ops systems. Presents seeded rows as if they were live operational signals.                                                                                                 |
| **ESC-001** (OS Escalations)         | **PLACEHOLDER SHELL**      | 🔴 FLAG   | Seed data only. Duplicates the existing global /escalations system which IS Supabase-backed. Creates confusion about which escalation system is real.                                                                                      |
| **DOC-001** (Document Vault)         | **GOVERNANCE BLEED**       | 🔴 FLAG   | Registers 10 hardcoded metadata rows. No actual file tracking. No version history. No upload. The name \"Document Vault\" conflicts with the existing /document-vault page (tender docs). Creates false impression of document governance. |
| **PDF Studio**                       | **VALID CORE**             | ✅ KEEP   | Real PDF generation capability. Operational value.                                                                                                                                                                                         |
| **Tender Workspace** (SUPA-006)      | **VALID CORE**             | ✅ KEEP   | Deep, Supabase-backed, Linde-seeded. Most mature domain.                                                                                                                                                                                   |
| **Commercial Workspace** (SUPA-003)  | **VALID CORE**             | ✅ KEEP   | Deep, Supabase-backed. Core execution layer.                                                                                                                                                                                               |
| **ECR Engine**                       | **VALID CORE**             | ✅ KEEP   | Rule sets, scoring, snapshots. Real persistence.                                                                                                                                                                                           |
| **Renewal Engine**                   | **VALID CORE**             | ✅ KEEP   | Supabase-backed, operational.                                                                                                                                                                                                              |

### Tickets That Should Pause

| Ticket      | Reason                                                                                                                 |
|-------------|------------------------------------------------------------------------------------------------------------------------|
| **DOC-001** | Rename to \"Artifact Registry\" and remove \"Document Vault\" branding. It conflicts with the existing document vault. |
| **OPS-001** | Seed data creates false operational signals. Should only show real computed signals or be clearly marked as demo data. |
| **ESC-001** | Duplicates /escalations. Either merge into global escalations or clearly separate scope.                               |

### Tickets That Should Not Exist

| Ticket                                | Reason                                                                                                    |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Any future \"governance pack\" sprint | Governance is a control, not a product feature. Don\'t build governance UIs that don\'t control anything. |

# ARTIFACT 6 --- DOCUMENT DOMAIN SEPARATION {#artifact-6-document-domain-separation}

## Current State: Document Confusion

| System                             | Location                 | What It Actually Does                                                                                |
|------------------------------------|--------------------------|------------------------------------------------------------------------------------------------------|
| **Document Vault** (tender domain) | /document-vault          | Real Supabase-backed tender document tracking. Version history, status. **OPERATIONAL.**             |
| **Document Vault** (OS DOC-001)    | /commercial-os/documents | 10 hardcoded metadata rows describing existing tables/pages. No actual files. **METADATA REGISTRY.** |
| **PDF Studio**                     | /pdf-studio              | Real PDF generation from templates. **OPERATIONAL.**                                                 |
| **Document Composer**              | /editor, /compose/\*     | Real document authoring with blocks, templates, variables. **OPERATIONAL.**                          |
| **Tender Required Documents**      | Inside tender workspace  | Per-pack document checklist (native, signed PDF, stamps). **OPERATIONAL.**                           |

## What Should Own What

| Document Type                   | Correct Owner                         | NOT                    |
|---------------------------------|---------------------------------------|------------------------|
| RFP / Bid / Scope / Compliance  | **Tender Workspace**                  | Not Commercial OS      |
| Quotes / Pricing / Revisions    | **Commercial Workspace**              | Not Commercial OS      |
| SLA / Service Schedules / Legal | **Commercial Workspace** → SLA tab    | Not Document Vault     |
| Customer Review Packs           | **Commercial OS** (RPT-002)           | Correct                |
| Monthly Reports                 | **Commercial OS** (RPT-001)           | Correct                |
| KPI Registry / Assumptions      | **Commercial OS** (governance tables) | Not \"Document Vault\" |
| PDF Outputs                     | **PDF Studio**                        | Correct                |

CAUTION

**Commercial OS should NOT own \"documents.\"** It should own:

- Intelligence dashboards (pipeline, capacity, forecast, revenue)

- Customer analytics (360, review packs)

- Governance registries (KPI, assumptions, GP basis)

- Reports (monthly, customer)

\"Document Vault\" in Commercial OS is architecturally misscoped. It\'s a metadata index pretending to be document governance.

# EXECUTIVE SUMMARY

## Current Architecture Truth

| Domain                               | Maturity | Data Quality                | Strategic Value |
|--------------------------------------|----------|-----------------------------|-----------------|
| **Tender Workspace**                 | HIGH     | Supabase-backed, Linde seed | **CRITICAL**    |
| **Commercial Workspace**             | HIGH     | Supabase-backed             | **CRITICAL**    |
| **Commercial OS** (core 7 pages)     | HIGH     | Batch import, real data     | **HIGH**        |
| **Commercial OS** (sprint additions) | LOW      | Seed/computed only          | **LOW**         |
| **ECR Engine**                       | HIGH     | Supabase-backed             | **HIGH**        |
| **Renewal Engine**                   | HIGH     | Supabase-backed             | **HIGH**        |

## Broken Architecture

1.  **Domain Bleed:** Commercial OS sprint tickets (OPS-001, ESC-001, DOC-001) created governance shells that present seed data as operational truth

2.  **Naming Collision:** Two \"Document Vaults\" exist --- one real (tender), one metadata (OS)

3.  **Escalation Duplication:** Two escalation systems --- global (real) and OS (seed)

4.  **No Cross-Domain Linkage:** Tender wins don\'t flow to revenue. Pipeline doesn\'t feed capacity.

5.  **No Persistence for Reports:** RPT-001 and RPT-002 compute on every page load

## Priority Rebuild Order

1.  **IMMEDIATE:** Rename DOC-001 from \"Document Vault\" to \"Artifact Registry\" to eliminate naming collision

2.  **IMMEDIATE:** Add clear \"SEED DATA\" banners to OPS-001 and ESC-001 pages

3.  **NEXT SPRINT:** Build tender → revenue linkage (won deal creates revenue record)

4.  **NEXT SPRINT:** Add report snapshot persistence (save computed reports to monthly_commercial_reports / customer_review_packs tables)

5.  **FUTURE:** Evaluate merging OS escalations into global escalation system

## Safe Sprint Order for Remaining Tickets

| Priority | What                                             | Why                                     |
|----------|--------------------------------------------------|-----------------------------------------|
| 1        | Fix naming collisions + seed data labels         | Prevents architectural misunderstanding |
| 2        | Report persistence (RPT-001/RPT-002 snapshots)   | Gives reports operational value         |
| 3        | Cross-domain linkage (tender → revenue)          | Closes the commercial loop              |
| 4        | Real ops signal generation (from data, not seed) | Makes OPS-001 valuable                  |
| 5        | Import automation                                | Removes manual Excel dependency         |

**Final Verdict:** The core architecture is SOUND. The three domains (Tender, Commercial Ops, Commercial OS) are well-separated and Supabase-backed. The drift is in SPRINT ADDITIONS --- OPS-001, ESC-001, and DOC-001 created governance shells with seed data that risk being mistaken for operational truth. Fix the naming, add seed labels, and focus next sprints on cross-domain linkage rather than more read-only governance shells.
