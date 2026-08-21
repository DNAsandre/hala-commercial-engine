# TENDER-15-STAGE-FUNCTIONAL-MANIFEST (current-state, pre-correction)

> Extracted verbatim from the lane agent's final report.

All verification is complete. Here is the deliverable.

---

# TENDER-15-STAGE-FUNCTIONAL-MANIFEST

**Scope:** `hala-clean-commercial-engine` @ branch master, tag `tender-closure-start` (HEAD `93799d3`). Read-only inventory; no fixes proposed. Every claim carries file:line evidence from this repo. Old app not needed for any finding below; no old-app code cited.

## 0. Shared architecture (applies to every stage)

**Route/entry.** `src/CleanApp.tsx:102-104` — `/tenders/:tenderId/final-pack` → `PdfStudio`, `/tenders/:id` → `TenderWorkspace`, `/tenders` → redirect `/workspaces/tenders` (`TenderPortfolio`, which links to detail at `src/pages/TenderPortfolio.tsx:267`). Deep link carries **only the tender id**: the active stage and tab are React state (`src/pages/TenderWorkspace.tsx:1551` `tab`, `:1555` `cognitionStage`); `cognitionStage` initializes from the persisted `internal_stage` (`:1568-1570` via `mapDbStageToInternalCognitionStage`, `src/lib/supabase-tender-data.ts:480-482`). Refresh always lands on the persisted stage's first tab; individual tabs are not deep-linkable.

**Stage registry.** The 15 stages are `TENDER_INTERNAL_STAGES` (`src/lib/tender-stage-source-truth.ts:39-175`), each with declared `storageFacets`. The stage→tabs map is `buildStageConfig` (`src/lib/tender-stage-config.ts:84-426`); per-stage `tabs:` arrays at :122-129 (identified), :143 (qualification), :157 (bid_no_bid), :171 (solution_design), :191 (pnl_pricing), :210 (tender_drafting), :228 (internal_review), :246 (approval_matrix), :260 (final_approved), :281 (submitted), :315 (clarification), :342 (client_evaluation), :363 (negotiation), :386 (awarded), :408 (lost_withdrawn). Tab names → ids via `toCleanTabId` + `SOLUTION_TAB_ID_OVERRIDES` (`TenderWorkspace.tsx:1419-1433`). Tab components are dispatched in `TenderWorkspace.tsx:1976-2236`.

**LOAD path (single source).** `useTenderWorkspaceData` (`src/hooks/useTenderWorkspaceData.ts:86-135`) → `fetchTenderWorkspaceBundleFromSupabase` (`src/lib/supabase-tender-data.ts:795-906`): one `commercial_tickets` row (`fetchTenderHeader` :661-685, identity-checked :677-681) + `commercial_ticket_audit` rows for activity/audit (:736-754). All stage data is projected from `type_details` (`mapCommercialTicketToTender` :602-646). Documents come from `type_details.documents` on the same row (:693-698). **Hard-stubbed empty on every load:** packs (:700-703), placeholders (:705-708), requiredDocuments (:725-728 `loaded:false`), complianceItems (:730-733 `loaded:false`), splitChecks (:756-759), packOutputs (:761-764), submissionEmails (:788-791); `insertTenderPackOutput` disabled (:766-786); `crmSyncStatus` constant `'not_synced'` (:900). Consequently `riskLevel` is always `'not_assessed'` (:868-879) and the header badge honestly says "Risk not assessed" (`TenderWorkspace.tsx:1443-1456`).

**SAVE path (single write layer).** All facet saves go through `saveTenderSourceRecord` (`src/lib/tender-source-record.ts:308-450`) → `updateActiveTender` (`src/lib/supabase-tender-source-record.ts:40-66`): `update … .eq('updated_at', expectedRevision).select('*').maybeSingle()` — success is only reported when the **stored row comes back** (:56), with `stale` detection (:60; `tender-source-record.ts:342-353, 383-385` returns "Tender changed after this edit began… retry without losing your entry"). So every `updateTender*` write is read-back-confirmed and optimistic-locked *at the write layer*. Two merge shapes matter:
- **Section-merge** (`mergeCanonicalTenderFacet`, `supabase-tender-actions.ts:205-248`): fresh read, patch one `type_details.<facet>.<section>` — used by identified/pricing/tender_drafting/approval_matrix/final_approved/submission/clarification/client_evaluation/negotiation_data/awarded_data/lost_withdrawn_data writers (`:987-1262`). Safe against sibling-section clobber.
- **Whole-facet merge** (`mergeCanonicalTenderDetails`, `:179-203`): writes the entire facet composed in the UI (`{...existing, section: data}` where `existing` is the page-load copy) — used by `sow_data` (:595), `customer_fit_data` (:648), `sow_qualification_data` (:705), `technical_qualification_data` (:760), `risk_snapshot_data` (:818), `bid_no_bid_data` (:878), `solution_design_data` (:935). **Cross-tab stale-overwrite risk inside these facets** (see stages 3–4).

**Audit writes.** Best-effort only: `runBestEffortAuditWrite` is not awaited, failures are `console.warn` (`supabase-tender-actions.ts:72-123`; header contract :12-22). `_insertAuditEvent` is a **no-op** (`:337-339` `void params`). The one confirmed audit write is `createActivityNote` (`:1438-1451` → `writeCanonicalTenderAuditConfirmed` :133-153).

**AI.** All AI generation in this build **throws** "AI generation is not available in this build (deferred to Sprint X — SX-001/SX-011)" (`src/lib/ai-runs.ts:29-38, 445-457, 459-469`; local stubs `DepartmentalReviewTab.tsx:30-33` used at `:376`, `FinalApprovedStage.tsx:38-40` used at `:432`).

**Disabled refusal stubs** (`supabase-tender-actions.ts`): `updatePackStatus` :1346, `updatePlaceholderStatus` :1360, `updateRequiredDocStatus` :1375, `updateComplianceStatus` :1389, `updateGateStatus` :1404, `logMockBypass` :1419, `logEmailSimulation` :1456. `logMockBypass`/`logEmailSimulation` have **zero component callers** (repo grep).

**Classification legend** (as specified): PERSISTS-CONFIRMED / PERSISTS-UNCONFIRMED / STATE-ONLY / DISABLED / FABRICATED / READ-ONLY-BY-DESIGN. Note: every `updateTender*` save is read-back-confirmed at the write layer, so persisted surfaces below are PERSISTS-CONFIRMED; where the *UI* never refreshes `ws` afterwards I flag it as a gap in the stage section, not a classification downgrade.

---

## Stage 1 — Identified

**Entry:** stage pill / "Browse Tender Stage" dropdown (`TenderWorkspace.tsx:1767-1838`); auto-selected when `internal_stage='identified'`. Tabs (`tender-stage-config.ts:122-129`): Tender Summary, Customer Snapshot, Intake & File Audit, Document Review, Compliance Matrix, Clarification Log. Dispatch: `TenderWorkspace.tsx:2211-2212, 2169-2180`.

| Tab / component | Editable fields | Load | Save | Class |
|---|---|---|---|---|
| Tender Summary — `TenderSummaryTab.tsx:44-167` | none (intake summary + advisory signals display) | `ws.tender` columns + `ws.packs` signals (:54, always-empty packs) | — | READ-ONLY-BY-DESIGN |
| Customer Snapshot — `TenderCustomerSnapshotTab.tsx` | Win-probability slider (range 0-100, :289-298); owner/team chips (click select, dbl-click lead, :236-259) | `t.probabilityPercent`, `t.assignedOwner/assignedTeamMembers` (columns; :66-76, 102-112) | `updateTenderProbability` (:86 → `probability_percent` column) and `updateTenderTeamMembers` (:128 → `owner`,`team_members`); both `reload()` on success | PERSISTS-CONFIRMED |
| ↳ Scope of Work Capture — `ScopeOfWorkCapture.tsx` (embedded, :207-209 of snapshot tab) | 10 SOW subsections (scope_summary textarea; service_lines; warehousing; transport_lanes; technology; sla_kpis; sites; compliance; clarifications; internal_notes — options at :50-135) | `t.sowData` = `type_details.sow_data` (header :18-19) | `updateTenderSowData` (:269 → whole `sow_data` facet), `reload()` | PERSISTS-CONFIRMED |
| Intake & File Audit — `IntakeFileAuditTab.tsx` | received_files (textarea→list), missing_intake_items, source_channel, buyer_reference, tender_owner (text), deadline_status (select not_checked/confirmed/needs_clarification/missing), initial_notes (:61-67, 137-172) | `type_details.identified.intake_file_audit` (:54-55) | `updateTenderIdentifiedData(t.id,"intake_file_audit",…)` (:104), `reload()` | PERSISTS-CONFIRMED |
| Document Review — `TenderDocumentReviewTab.tsx` | review_status (select), reviewer, review_date (date), key_obligations, review_notes, missing_documents (:64-69, 196-216); "Link" action per unlinked doc (:124-135) | `type_details.identified.document_review` (:56-57); inventory from `ws.documents` filtered to Identified (:81-85) | `updateTenderIdentifiedData("document_review")` (:109); link via `updateTenderDocumentMetadata` (:127); both reload | PERSISTS-CONFIRMED |
| Compliance Matrix — `IdentifiedComplianceMatrixTab.tsx` | review_status, owner, review_date, risk_summary, notes (:51-55, 157-179) | notes from `type_details.identified.compliance_matrix_notes` (:44-45); **Requirement Matrix table reads `ws.complianceItems` which is always `[]`** (:66; stub `supabase-tender-data.ts:730-733`) → permanently "No compliance requirements captured yet." (:124) | `updateTenderIdentifiedData("compliance_matrix_notes")` (:89), reload | Notes: PERSISTS-CONFIRMED. Matrix table: READ-ONLY-BY-DESIGN over a never-loaded collection |
| Clarification Log — `IdentifiedClarificationLogTab.tsx` | row register (question, source_reference, category, owner, due_date; :173-194), per-row status select draft/ready/submitted/answered/closed + submitted/answered checkboxes (:212-229), notes textarea (:236-238) | `type_details.identified.clarification_log` + `clarification_log_notes` (:63-65) | **two sequential saves**: `updateTenderIdentifiedData("clarification_log")` then `("clarification_log_notes")` (:118-121); reload only if both succeed | PERSISTS-CONFIRMED (two-write, non-atomic pair) |

**False/hard-coded signals:** Stage indicator "Source Quality" is just `t.source` (`tender-stage-config.ts:118`). Sidebar segments honest.
**Gaps:** the two-write clarification save can persist the log but fail the notes (partial save, only surfaced by toast); the Compliance "Requirement Matrix" is a permanently empty display.

---

## Stage 2 — Qualification

**Entry:** stage pill; tabs (`tender-stage-config.ts:143`): SOW Qualification, Technical Qualification, Customer Fit, Risk Snapshot. Dispatch `TenderWorkspace.tsx:2215-2218` — **only SowQualification receives `onSaved={reload}`**.

| Tab | Editable fields (interfaces) | Load | Save | Class |
|---|---|---|---|---|
| SOW Qualification — `SowQualification.tsx` | `coverage_matrix` rows {area, status Clear/Partial/Unclear/NA, evidence, owner, risk, clarification_needed}; `clarity_assessment` (5 keys, Strong/Moderate/Weak/NA); `clarifications` rows {question, sow_area, source_reference, impact, owner, status, buyer_response}; `outcome` {recommendation, reason} (interfaces :58-95) | `t.sowQualificationData` = `type_details.sow_qualification_data` (:210-227, resync :232-246) | `updateTenderSowQualificationData` (whole-facet, :320), `onSaved?.()`→reload (:325) | PERSISTS-CONFIRMED |
| Technical Qualification — `TechnicalQualification.tsx` | `capability_assessment` 7 rows {…, **fit**, evidence, gap_or_concern}; `gaps`; `clarifications`; `recommendation` (interface :96-101; row :59-63) | `t.technicalQualificationData` (:212-227) | `updateTenderTechnicalQualificationData` (:341); **no reload/onSaved call** (:338-355) | PERSISTS-CONFIRMED (write layer); ws copy stays stale until some other reload |
| Customer Fit — `CustomerFitQualification.tsx` | `customer_snapshot`; `dimensions` rows (assessment); `evidence`; `gaps`; `recommendation` (interface at `CustomerFitData`: customer_snapshot, dimensions, evidence, gaps, recommendation) | `t.customerFitData` (:272-288) | `updateTenderCustomerFitData` (:422); **no reload** (:418-434) | PERSISTS-CONFIRMED; stale-ws gap |
| Risk Snapshot — `RiskSnapshot.tsx` | `register` rows (severity, bid_blocker, …); `assessment`; `mitigation_actions`; `clarifications`; `recommendation` (interface :106-112) | `t.riskSnapshotData` (:220-236) | `updateTenderRiskSnapshotData` (:364); **no reload** (:360-376) | PERSISTS-CONFIRMED; stale-ws gap |

**False signals — systemic sidebar key mismatch.** The Stage-Tasks progress meters read keys these tabs never write, so segments stay 0%/red after full data entry:
- SOW: builder reads `sq.clarification_questions`, top-level `overall_score/recommendation/qualification_status`, `output_wiring` (`TenderWorkspace.tsx:301-303`) — component saves `clarifications` and nested `outcome{recommendation,reason}`, no wiring key (`SowQualification.tsx` interface).
- Technical: builder reads `r.status` on capability rows, `requirement_gaps`, `clarification_questions`, `output_wiring` (`TenderWorkspace.tsx:318-323`) — component uses `r.fit`, `gaps`, `clarifications` (`TechnicalQualification.tsx:59-101`).
- Customer Fit: builder reads `cf.fit_dimensions` w/ `r.score`, `cf.evidence_register`, `cf.fit_gaps`, top-level scorecard (`TenderWorkspace.tsx:340-344`) — component saves `dimensions` (assessment), `evidence`, `gaps` (`CustomerFitData`).
- Risk: builder reads `rs.risk_register`, `rs.risk_assessment`, `rs.clarification_questions`, `overall_risk_level/summary_narrative` (`TenderWorkspace.tsx:359-365`) — component saves `register`, `assessment`, `clarifications`, and has no summary fields (`RiskSnapshot.tsx:106-112`).
Stage indicators also proxy "Technical Fit"/"Customer Fit" from pack compliance/doc percentages (`tender-stage-config.ts:137-139`), which are always 0 with empty packs.
**Gaps:** 3 of 4 tabs never refresh `ws` after save — switching away and back re-mounts from the stale bundle, making the just-saved data *appear* lost until a full page reload (it is persisted).

---

## Stage 3 — Bid / No-Bid

**Tabs** (`tender-stage-config.ts:157`): Bid Decision, Win Strategy, Resource Commitment, Decision Record. Dispatch `TenderWorkspace.tsx:2221-2224` — all four get `onSaved={reload}`. All save via `updateTenderBidNoBidData` (whole-facet `bid_no_bid_data`, `supabase-tender-actions.ts:878-922`).

| Tab | Editable fields | Facet keys written | Class |
|---|---|---|---|
| Bid Decision — `BidDecisionTab.tsx` | `decision` {decision, decision_owner, decision_date, approval_required, executive_approval, decision_reason} (:44-51); `decision_checklist` rows {question, status, evidence, owner} (:53-58); `recommendation` {next_step, conditions} (:60-63) | `{...existing, decision, decision_checklist, recommendation}` (:178-183) | PERSISTS-CONFIRMED |
| Win Strategy — `WinStrategyTab.tsx` | `rationale` {why_bid, why_win, client_values}; `win_themes` rows; `differentiators` rows; `evaluation_alignment` rows (interfaces :40-77) | `{...existing, win_strategy: data}` (:196) | PERSISTS-CONFIRMED |
| Resource Commitment — `ResourceCommitmentTab.tsx` | `rows` {status Available/Constrained/…}; `effort` {estimated_effort, deadline_pressure, can_submit_on_time, proposal_complexity}; `actions` rows; `recommendation` {recommendation, reason} (:38-72) | `{...existing, resource_commitment:{rows,effort,actions,recommendation}}` (:197-200) | PERSISTS-CONFIRMED |
| Decision Record — `DecisionRecordTab.tsx` | `formal` (8 fields: decision, decision_date, decision_owner, approver, approval_status, decision_summary, conditions, clarifications_required); `if_bid`; `if_no_bid`; `evidence` rows (:36-71) | `{...existing, decision_record:{formal,if_bid,if_no_bid,evidence}}` (:195-198) | PERSISTS-CONFIRMED |

**Revision/stale handling:** each tab spreads the page-load `existing` and rewrites the whole facet — if two Bid tabs are edited before a reload lands, the later save reverts the earlier tab's section (write-layer optimistic lock does not protect this because each save re-reads fresh and then overwrites the sibling sections with the stale UI copy). Mitigated (not eliminated) by `onSaved={reload}` on success.
**False signals:** downstream readers use a **wrong key** for this stage's decision: `ProposalArchitectureTOCTab.tsx:166 & :319` read `bnb.bid_decision?.decision` — the tab writes `decision.decision` — so TOC Source Intelligence shows "Not captured" and the (disabled) AI context omits the bid decision forever. (`FinalApprovedStage.tsx:116-118` handles it correctly via `bnd?.decision?.decision`.)

---

## Stage 4 — Solution Design

**Tabs** (`tender-stage-config.ts:171`): Solution Configuration, HOP Operations Model, HAM Manpower Model, HIP Systems & IP Model, Scope Matrix, SLA / KPI Model, Assumptions & Dependencies. Dispatch `TenderWorkspace.tsx:2227-2233` — **none receives `reload`/`onSaved`**. All save via `updateTenderSolutionDesignData` (whole-facet `solution_design_data`, `supabase-tender-actions.ts:935-974`).

| Tab | Editable fields | Facet key | Class |
|---|---|---|---|
| Solution Configuration — `SolutionConfigurationTab.tsx` | `customer_problem{statement,evidence,owner}`, `customer_operating_road`, `selected_modules`, `market_entry_mode`, `customer_pain_categories[]`, `solution_package`, `deployment_type`, `expansion_path[]`, `notes` (:137-146) | `configuration` (:197) | PERSISTS-CONFIRMED |
| HOP — `HOPOperationsModelTab.tsx` | `warehouse` {storage_required, storage_type, capacity_value/unit, facility, city, region, facility_ownership, activities[], evidence, notes} (:73-84); `transport` {transport_required, transport_model[], vehicle_types[], lanes[] 10-field rows} (:87-97); `operational_flow` step rows (:100-102); `recommendation` | `hop` (:173) | PERSISTS-CONFIRMED |
| HAM — `HAMManpowerModelTab.tsx` | `staffing` rows (9 fields, :55); `governance` (8 owner fields + customer_spoc_required, :57); `shift` (4 fields, :58); `mobilization` rows (:56); `recommendation` | `ham` (:97) | PERSISTS-CONFIRMED |
| HIP — `HIPSystemsIPModelTab.tsx` | `systems` rows; `integration` (6 fields, :61); `sops` rows (:62); `reports` rows (:63); `recommendation` | `hip` (:103) | PERSISTS-CONFIRMED |
| Scope Matrix — `ScopeMatrixTab.tsx` | rows {scope_item, included, hala/customer/third_party_responsibility, evidence_source, commercial_impact, clarification_needed, notes} (:47-52) | `scope_matrix.rows` (:97) | PERSISTS-CONFIRMED |
| SLA/KPI — `SLAKPIModelTab.tsx` | `kpis` rows (8 fields, :44-47); `governance` (5 fields, :48-51); `recommendation` | `sla_kpi` (:84) | PERSISTS-CONFIRMED |
| Assumptions & Dependencies — `AssumptionsDependenciesTab.tsx` | `assumptions` rows (:59); `dependencies` rows (:60); `exclusions` rows (:61); `clarifications` rows (:62); `recommendation` | `assumptions_dependencies` (:108) | PERSISTS-CONFIRMED |

**Revision/stale handling — worst in app:** every tab writes `{...existing, <section>: data}` **and no tab reloads `ws`** (handlers end at toast; e.g. `HOPOperationsModelTab.tsx:171-178`). Editing HOP, saving, then editing HAM and saving **reverts HOP in the database to the page-load copy** carried inside HAM's spread. Also, saved data disappears from view on tab switch (remount from stale `ws`).
**False signals:** stage indicators "Feasibility"/"Scope Clarity" derive from empty pack compliance/docs (`tender-stage-config.ts:165-166`) → always red/0.

---

## Stage 5 — P&L / Pricing

**Tabs** (`tender-stage-config.ts:191`): P&L Calculator, Pricing Scenarios, Commercial Terms, Pricing Approval. Dispatch `TenderWorkspace.tsx:2188-2193`. All writes are **section-merge** `updateTenderPricingData` (`supabase-tender-actions.ts:987-1011`, normalizes via `normalizeTenderPricingData`) — sibling-safe, and all reload.

| Tab | Editable | Load | Save | Class |
|---|---|---|---|---|
| P&L Calculator — `TenderPnLCalculatorPanel.tsx` | calculator state (via `PnLCalculatorCore`, :334-338); Target-GP override number (:317); actions: Save Working Draft (:153-168), Create Snapshot (:171-207), Submit for Pricing Approval (:210-222) | `pricing.pnl_snapshot` (working_draft, snapshots, active_snapshot_id) :119-131; context read-only grid :296-311; legacy cost inputs read-only :446-478 | 3 writes to `pnl_snapshot` section (:164, :203, :218), each reload | PERSISTS-CONFIRMED |
| Pricing Scenarios — `PnlPricingStage.tsx` `PricingScenariosTab` | scenario `rows` (register), `selected_scenario`, computed comparison `summary` (:390-400) | `pricing.scenarios` (:389) | section `scenarios` (:368 via `usePricingSave`), reload | PERSISTS-CONFIRMED |
| Commercial Terms — `CommercialTermsTab` | payment_tax_validity, mobilization_notice_forecast, insurance_liability, surcharges[], customer_responsibilities[], exclusions[], assumptions[] (option lists :36-79) | `pricing.commercial_terms` | section `commercial_terms` (:534) | PERSISTS-CONFIRMED |
| Pricing Approval — `PricingApprovalTab` | `summary.approval_status` (select :760), current_approver; `approval_chain[]`; `approval_checks[]`; `conditions[]` (:733-737) | `pricing.approval` (:727) | section `approval` (:735) | PERSISTS-CONFIRMED |

**False/business-signal notes:** "Pricing Approval" is pure self-recorded data entry — any user can set `approval_status` to Approved; no role check (`canEditCosts` imported at :32 but the approval select has no `disabled` gating from it in the summary section :760). "Submit for Pricing Approval" only flips a snapshot's status string (:214-218) — no routing, no notification.
**Snapshot integrity:** the panel claims "Approved snapshots are protected from silent overwrite" (:367) — the only mechanism is the write-layer revision token; nothing prevents a new snapshot or draft overwrite of `pnl_snapshot` (patch spreads `pnlData` from page load, :163, :202 — same stale-spread pattern *within* the section).

---

## Stage 6 — Tender Drafting

**Tabs** (`tender-stage-config.ts:210`): Proposal Architecture / TOC, Proposal Block Workbench, Technical Volume, Commercial Volume, Compliance Coverage, Appendices & Evidence. Router `TenderDraftingStage.tsx:27-36`. All persisted writes are section-merge `updateTenderDraftingData` (`supabase-tender-actions.ts:1024-1051`; supports explicit `expectedRevision`).

| Tab | Editable | Load | Save | Class |
|---|---|---|---|---|
| TOC — `ProposalArchitectureTOCTab.tsx` | TOC sections CRUD: section_number, section_title, volume, section_purpose, source_stages, required_source_data, required_evidence, document_assembly_target, owner, include_in_proposal, status (:42-56); tocStatus select; reorder/duplicate/delete (:238-288); "Create Blocks" (:600-670) | `tender_drafting.proposal_architecture.toc_versions` (:206-222) | `updateTenderDraftingData("proposal_architecture")` (:698, `onSaved`+reload); block creation writes `proposal_blocks` then `proposal_architecture` (:648-663, reload) | PERSISTS-CONFIRMED |
| ↳ "Generate TOC Suggestion" / bot-chain draft | buttons present (:291-360, chain state :229-236) | — | `generateBlockContent` throws (`ai-runs.ts:445-457`) → toast error | DISABLED |
| Block Workbench — `ProposalBlockWorkbenchTab.tsx` | full block register CRUD: title, block_key/type, volume, owner, notes, editor content (`TenderProposalEditorBlock`, stages structure/sprint/canon, `is_canon_locked`), `draft_status` select (:799), `approval_status` select (sets approved_at when Approved, :806), reviewer (:813); Manual Block Intake section (:104-107) | `tender_drafting.proposal_blocks` (:157-185 normalize) | `updateTenderDraftingData("proposal_blocks", blocks)` (:335, `onSaved`+reload); AI-draft apply also writes (:700) but generation itself throws | Register: PERSISTS-CONFIRMED. AI drafting: DISABLED |
| Technical Volume — `TechnicalVolumeTab.tsx:30-63` | none — filtered read of blocks (Technical/Shared) | `tender_drafting.proposal_blocks` | — | READ-ONLY-BY-DESIGN |
| Commercial Volume — `CommercialVolumeTab.tsx` (mirror of above) | none | same | — | READ-ONLY-BY-DESIGN |
| Compliance Coverage — `ComplianceCoverageTab.tsx` | requirement rows {requirement_id, requirement_text, source_document, linked_block_id (select of blocks), status (6 options :19), owner} (:63-86, 194-227) | `tender_drafting.compliance_coverage.requirements` (:52-57) | `updateTenderDraftingData("compliance_coverage",{requirements})` (:91, `onSaved`+reload) | PERSISTS-CONFIRMED |
| Appendices & Evidence — `AppendicesEvidenceTab.tsx` | evidence-gap rows {missing_evidence, required_for, linked_block_id, linked_section, owner, due_date, status (5 options :19), notes} (:67-80) | `tender_drafting.appendices_evidence.evidence_gaps` (:52-56); register shows stage documents (:53) | `updateTenderDraftingData("appendices_evidence",{evidence_gaps})` (:85) | PERSISTS-CONFIRMED |

**False signals (key mismatches):** sidebar meter for `compliance_coverage` reads `cc.items` (`TenderWorkspace.tsx:735-737`) but the tab saves `requirements` (`ComplianceCoverageTab.tsx:91`) → segment permanently 0%. Same for `appendices_evidence`: meter reads `ae.items` w/ `title` (`TenderWorkspace.tsx:744-747`), tab saves `evidence_gaps` (`AppendicesEvidenceTab.tsx:85`) → permanently 0%.
**Document links:** TOC/blocks carry `required_evidence` / `document_assembly_target` free-text; Appendices tab lists `documentsForTenderStage(ws.documents,"tender_drafting")`.

---

## Stage 7 — Internal Review

**Tabs** (`tender-stage-config.ts:228`): Review Dashboard, Operations Review, Finance Review, Legal Review, Exceptions. Router `InternalReviewStage.tsx:25-37` (RBAC explicitly TODO, :22-23).

| Tab | Editable | Load | Save | Class |
|---|---|---|---|---|
| Review Dashboard — `InternalReviewDashboardTab.tsx:65-90` | none (dept stats, readiness %, AI-flag list) | `tender_drafting.proposal_blocks` per-dept `<dept>_status` fields | — | READ-ONLY-BY-DESIGN |
| Ops/Finance/Legal Review — `DepartmentalReviewTab.tsx` (dept param + volumes, router :28-33) | per-block Approve (:224-239), Reject w/ comment textarea (:241-258), Reset (:260-274) | blocks filtered by dept volumes; briefing panel from prior-stage facets (:80+) | `updateBlockReviewStatus` (`supabase-tender-actions.ts:1474-1511`: fresh aggregate + `expectedRevision` + writes `<dept>_status/_comment/_reviewer/_reviewed_at` into `proposal_blocks`), reload | PERSISTS-CONFIRMED |
| ↳ "Run AI Review" | button | — | `generateAIUnavailable()` at :376 throws → toast; **exception:** if *all* blocks are empty, pre-AI auto-flags "BLOCK NOT DRAFTED" are persisted via `saveBlockAIFlags` (:303-318 → `supabase-tender-actions.ts:1520-1580`) | DISABLED (with one persisted pre-AI path) |
| Exceptions — `InternalReviewExceptionsTab.tsx` | "Resubmit" per rejected entry (:83-94) | rejected entries derived from block `<dept>_status === "Rejected"` (:59-77) | `updateBlockReviewStatus(…,"Pending","","Resubmitted by drafter")` (:86), reload | PERSISTS-CONFIRMED |

**False/hard-coded signals (stage header indicators, `tender-stage-config.ts:214-229`):** "Ops Review: In Review/Not Started" and "Finance Review: Complete/Pending" are derived from **pack section counts** (always 0 → Ops "Not Started", Finance "Pending") — not from the real block review data; and **"Legal Review" state is the hardcoded literal `"Not Started"`** (:224) regardless of any legal approvals recorded.
**Orphaned storage:** `tender_drafting.departmental_reviews` (declared storage facet, `tender-stage-source-truth.ts:100`) has **no writer anywhere**; readers `TenderWorkspace.tsx:1291`, `FinalApprovedStage.tsx:149,364`, `PreviousStageIntelligence.tsx:523` — so "departments reviewed" checks can never become true from this app.

---

## Stage 8 — Approval Matrix

**Tabs** (`tender-stage-config.ts:246`): Approval Matrix, Signoff Tracker, Exception Notes, Governance Log. Component `ApprovalMatrixStage.tsx` (dispatch :330-350).

| Surface | Editable | Load | Save | Class |
|---|---|---|---|---|
| Approval participants | Add participant {role label text, type approval/feasibility} (:188-224); per-participant Approve/Reject with comment (:227-253); Reset (:256-271); Remove (:273-291) | canonical `type_details.approval_matrix.approvals` with legacy fallback to `tender_drafting.approval_matrix` (:143-167) | `updateTenderApprovalMatrixData(tenderId,"approvals",…)` (:184-186 → section-merge `supabase-tender-actions.ts:1053-1069`), reload each action | PERSISTS-CONFIRMED |
| Data Sources / Signoff Tracker / Exception Notes / Governance Log | none | GP% extracted only from tender pricing (:60-79), pallets from solution design (:83-101); audit list | — | READ-ONLY-BY-DESIGN |

**False signals:**
- **Approver identity is fabricated:** decisions record `decided_by: "Current User"` — a string literal, not the logged-in user (`ApprovalMatrixStage.tsx:235`).
- **Location mismatch with the rest of the app:** the stage writes canonical `type_details.approval_matrix`, but the sidebar progress builder reads only `t.tenderDraftingData.approval_matrix` (`TenderWorkspace.tsx:1139-1141`) and Stage-9's task-progress builder likewise (`TenderWorkspace.tsx:1280,1293-1295`) → for tenders whose approvals live only in the canonical facet, the Stage-8 meter and the Final-Approved "allApproved" segment show 0 despite recorded approvals. (`FinalApprovedStage` itself reads correctly via `approvalMatrixFor`, :97-103.)
- Sidebar "Governance Note" segment is constant 100% (`TenderWorkspace.tsx:1156`), "Governance Rules" constant 100% (:1183).

---

## Stage 9 — Final Approved

**Tabs** (`tender-stage-config.ts:260`): Submission Readiness, Final Pack, Submission Checklist, Approval Record. Component `FinalApprovedStage.tsx` (dispatched `TenderWorkspace.tsx:1978-1980`).

| Tab | Editable | Load | Save | Class |
|---|---|---|---|---|
| Submission Readiness (:222-…) | none — 7-item stage checklist + readiness signals | `deriveStageChecklist` (:105-173) over facets; compliance/doc counts over always-empty collections (:226-231) | — | READ-ONLY-BY-DESIGN |
| Final Pack (:313-…) | "Run Final Check" button (:358-441); Open Final Pack Studio link (:536-542, always enabled) | `tender_drafting.final_approval_check` (:349) | `generateAIUnavailable()` at :432 **throws before any write** → the `updateTenderDraftingData("final_approval_check", …, ran_by:"Current User")` at :429-436 is unreachable | DISABLED |
| Submission Checklist (:608-660) | none | **hardcoded 14-item `REQUIRED_DOCS` list** (:57-72) fuzzy-matched: "Uploaded" if any document name contains the requirement's **first word** (:637 `n.includes(doc.doc.toLowerCase().split(" ")[0])`) | — | FABRICATED (verdict list not backed by any stored requirement set; match heuristic can false-positive) |
| Approval Record (:670-…) | final approval record: decision select pending/approved/not_approved, approved_by, approved_at (datetime), reference, notes (:735-…) | `type_details.final_approved.approval_record` (:686-696) | `updateTenderFinalApprovedData("approval_record")` (:702-712), reload; stamps `recorded_by: "Current User"` literal (:709) | PERSISTS-CONFIRMED (with fabricated recorder identity) |

**False/hard-coded signals:** stage header indicators: **"Final Approval: Approved"** hardcoded (`tender-stage-config.ts:253`) and **"Version Integrity: Verified"** hardcoded (:256) — shown for every tender that merely browses this stage, regardless of any approval or version data. Checklist "Internal Review" item depends on never-written `departmental_reviews` (:149-158) → permanently "No departments reviewed yet". Sidebar `submission_checklist` segment is the honest W04-C4 rewrite (percent `null` + note; `TenderWorkspace.tsx:1324-1332`, `tender-workspace-data.ts:548-565`) — but the tab body still renders the fabricated 14-row table.

---

## Stage 10 — Submitted

**Tabs** (`tender-stage-config.ts:281`): Submission Log, Submitted Version, CRM Sync, Audit Trail. Shell `SubmittedStage.tsx` (note: each view renders the **same child under both section keys** — e.g. SubmissionLogTab twice, :96-101, :128-133, :160-165 — section tabs are cosmetic). All writes are section-merge `updateTenderSubmissionData` (`supabase-tender-actions.ts:1093-1112`).

| Tab | Editable fields | Load / Save | Class |
|---|---|---|---|
| Submission Log — `SubmissionLogTab.tsx` | submitted_at (datetime), submitted_by, submission_method (5 options :25-31), method_detail, reference_number, attachments_count (number), recipient name/email/org, submission_notes, receipt_confirmed (switch), receipt_confirmed_at, receipt_notes (:38-50, form :124-206) | `type_details.submission.submission_record` (:35-36); save :75, reload | PERSISTS-CONFIRMED |
| Submitted Version — `SubmittedVersionTab.tsx` | version_label, frozen_at (datetime), frozen_by, document_hash, total_pages, file_size_mb, volumes_included[] toggles, version_notes (:31-38) | `type_details.submission.submitted_version` (:29); save :73, reload | PERSISTS-CONFIRMED |
| CRM Sync — `CrmSyncTab.tsx` | crm_stage_before/after (selects over 10 stages :24-35), sync_status (pending/synced/failed/manual), synced_at, synced_by, sync_notes (:51-56) | `type_details.submission.crm_sync` (:47); save :74, reload | PERSISTS-CONFIRMED |
| Audit Trail | none — `TenderAuditTrailTab` over `ws.auditEntries` (commercial_ticket_audit) | — | READ-ONLY-BY-DESIGN |

**False signals:** "Submitted Version" claims "This locks the version for audit trail purposes" (banner) and shows a "Block Snapshot" — but the block list is the **live** `tender_drafting.proposal_blocks` (:45-49), which remain fully editable in Stage 6; nothing is frozen. "CRM Sync" is a *record about* a sync — it does not move `commercial_tickets.crm_pipeline_stage` (only the CRM strip does); the header CRM badge is independently always "Not Synced" (`supabase-tender-data.ts:900`).

---

## Stage 11 — Clarification

**Tabs** (`tender-stage-config.ts:315`): Q&A Log, Response Drafts, Impact Analysis, Clarification Status. Shell `ClarificationStage.tsx:236-245`. All section-merge `updateTenderClarificationData` (`supabase-tender-actions.ts:1172-1191`; bucket isolated from client_evaluation, comment :1169).

| Tab | Editable fields | Store section | Class |
|---|---|---|---|
| Q&A Log — `ClarificationQALogTab.tsx` | question rows (QAEntry) with status pending/in_progress/responded/overdue (:87-90); row CRUD | `clarification.qa_log` (:71, save :103) | PERSISTS-CONFIRMED |
| Response Drafts — `ClarificationResponseTab.tsx` | response_status (not_started/drafting/under_review/submitted/not_applicable), received_date, due_date, scope_changes, revised_price (number), revised_gp (number), pricing_notes, submitted_date, response_notes (:40-48) | `clarification.response` (:71) | PERSISTS-CONFIRMED |
| Impact Analysis — `ClarificationMarginImpactTab.tsx` | current_value, current_gp (numbers), impact_notes, scope_change_notes (:29-32) | `clarification.margin_impact` (:50) | PERSISTS-CONFIRMED |
| Clarification Status — `ClarificationStatusTab.tsx` | round_status, expected_resolution_date, client_contact, round_number, status_notes (:43-47) | `clarification.status` (:66) | PERSISTS-CONFIRMED |

All four reload on success. No fabricated verdicts found in this stage's own components; stage indicators derive from the saved bucket (`tender-stage-config.ts:285-316`).

---

## Stage 12 — Client Evaluation

**Tabs** (`tender-stage-config.ts:342`): Request Log, Client Clarifications, BAFO Manager, Margin Impact, Evaluation Status. Shell `ClientEvaluationStage.tsx:270-279`. All section-merge `updateTenderClientEvaluationData` (`supabase-tender-actions.ts:1144-1163`).

| Tab | Editable fields | Store section | Class |
|---|---|---|---|
| Request Log — `ClientRequestLogTab.tsx` | request rows (RequestEntry) with type/status (:24, :72-75) | `client_evaluation.request_log` (:112) | PERSISTS-CONFIRMED |
| Client Clarifications — `ClientClarificationsTab.tsx` | rows {date_received, client_contact, question_or_request, category (7), response_owner, response_due, response_status (Open/In Progress/Responded/Closed), client_priority, bafo_impact, pricing_impact, scope_impact, response_summary, documents_required (bool), notes} (:33-49) + notes | `client_evaluation.client_clarifications {rows, notes, updated_at}` (:251-260) | PERSISTS-CONFIRMED |
| BAFO Manager — `ClientBafoManagerTab.tsx` | bafo_status (not_requested/…/submitted), received_date, due_date, scope_changes, revised_price, revised_gp, pricing_notes, submitted_date, response_notes (:42-50) | `client_evaluation.bafo` (:74) | PERSISTS-CONFIRMED |
| Margin Impact — `ClientMarginImpactTab.tsx` | current_value, current_gp, impact_notes (+original_pricing_label) (:32-34) | `client_evaluation.margin_impact` (:53) | PERSISTS-CONFIRMED |
| Evaluation Status — `ClientEvaluationStatusTab.tsx` | technical_status, commercial_status (pending/…), overall_status (derived), expected_decision_date, client_contact, contact_notes, competitor_intelligence, evaluation_notes (:47-53) | `client_evaluation.evaluation_status` (:75) | PERSISTS-CONFIRMED |

**False/hard-coded signal:** stage header indicator **"Evaluation: In Progress"** is a hardcoded literal for every tender on this stage (`tender-stage-config.ts:335`), independent of the recorded `evaluation_status` (the stage's own intel metrics do read the record, `ClientEvaluationStage.tsx:255-259`).

---

## Stage 13 — Negotiation

**Tabs** (`tender-stage-config.ts:363`): Negotiation Log, Requested Changes, Negotiation Margin, Revised Versions. Shell `NegotiationStage.tsx`. All section-merge `updateTenderNegotiationData` → `type_details.negotiation_data` (`supabase-tender-actions.ts:1197-1216`).

| Tab | Editable fields | Section | Class |
|---|---|---|---|
| Negotiation Log — `NegotiationLogTab.tsx` | meeting entries (LogEntry) with outcome positive/neutral/challenging (:61-63) | `negotiation_log` (:79) | PERSISTS-CONFIRMED |
| Requested Changes — `NegotiationChangesTab.tsx` | change items with hala_position accept/reject/counter/pending and status incl. agreed (:73-75) | `requested_changes` (:99) | PERSISTS-CONFIRMED |
| Negotiation Margin — `NegotiationMarginTab.tsx` | current_value, current_gp, round_number, concessions_summary, red_lines, impact_notes (:35-40) | `margin_impact` (:58) | PERSISTS-CONFIRMED |
| Revised Versions — `NegotiationRevisedTermsTab.tsx` | terms rows (TermEntry, status agreed/disputed/unchanged/…), overall_notes, contract_readiness (not_ready/near_ready/ready) (:58-63) | `revised_terms` (:86) | PERSISTS-CONFIRMED |

All reload on success. Stage indicators derive from the bucket (`tender-stage-config.ts:346-364`).

---

## Stage 14 — Awarded

**Tabs** (`tender-stage-config.ts:386`): Award Notice, Contract Prep, SLA Prep, Handover Prep. Shell `AwardedStage.tsx`. All section-merge `updateTenderAwardedData` → `type_details.awarded_data` (`supabase-tender-actions.ts:1222-1241`).

| Tab | Editable fields | Section | Class |
|---|---|---|---|
| Award Notice — `AwardNoticeTab.tsx` | award_date, award_reference, award_type, client_contact, award_conditions, awarded_value (num, defaults estimatedValue), awarded_gp (num), contract_duration, start_date, notes (:29-38) | `award_notice` (:55) | PERSISTS-CONFIRMED |
| Contract Prep — `AwardContractPrepTab.tsx` | contract_status (not_started/…/signed), contract_reference, draft/target_sign/actual_sign dates, hala_legal_owner, client_legal_contact, redline_notes, checklist{bool map}, notes (:50-59) | `contract_prep` (:82) | PERSISTS-CONFIRMED |
| SLA Prep — `AwardSlaPrepTab.tsx` | sla_status, sla_owner, target_sla_date, service_lines, kpi_summary, penalty_structure, reporting_cadence, review_period, exclusions, notes (:44-53) | `sla_prep` (:68) | PERSISTS-CONFIRMED |
| Handover Prep — `AwardHandoverTab.tsx` | handover_status, ops_manager, ops_team, handover_date, mobilization_date, checklist{bool map}, lessons_learned, notes (:51-58) | `handover` (:77) | PERSISTS-CONFIRMED |

All reload. Indicators honest (`tender-stage-config.ts:367-388`).

---

## Stage 15 — Lost / Withdrawn

**Tabs** (`tender-stage-config.ts:408`): Loss Reason, Lessons Learned, Competitor Intelligence, Rebid Potential. Shell `LostWithdrawnStage.tsx`. All section-merge `updateTenderLostWithdrawnData` → `type_details.lost_withdrawn_data` (`supabase-tender-actions.ts:1243-1262`).

| Tab | Editable fields | Section | Class |
|---|---|---|---|
| Loss Reason — `LossReasonTab.tsx` | outcome_type, primary_reason, client_feedback, winning_bidder, winning_price, our_price, loss_date, notified_by, contributing_factors, notes (:42-51) | `loss_reason` (:67) | PERSISTS-CONFIRMED |
| Lessons Learned — `LessonsLearnedTab.tsx` | what_went_well, what_went_wrong, lessons[] rows w/ impact (:55-57) | `lessons_learned` (:80) | PERSISTS-CONFIRMED |
| Competitor Intelligence — `CompetitorIntelTab.tsx` | competitors[] rows, market_notes (:37-38) | `competitor_intel` (:61) | PERSISTS-CONFIRMED |
| Rebid Potential — `RebidPotentialTab.tsx` | likelihood (none/low/medium/high), expected_timeline, current_contract_duration, conditions_for_rebid, strategy_notes, client_relationship, next_steps (:36-42) | `rebid_potential` (:56) | PERSISTS-CONFIRMED |

All reload. Indicators honest (`tender-stage-config.ts:390-409`).

---

## Cross-stage surfaces

| Surface | Findings | Class |
|---|---|---|
| **TenderSummaryTab** | covered in Stage 1 (read-only) | READ-ONLY-BY-DESIGN |
| **TenderActivityTab** (`TenderActivityTab.tsx`) | Add-note form (title, description) → `createActivityNote` (confirmed audit insert, :141-160). **But the tab is unreachable:** its render branch (`TenderWorkspace.tsx:2186`) requires tab ids `activity`/`clarification_log`/`negotiation_log`/`submission_log`/`response_history` — `clarification_log` is claimed by Identified (:2178), `negotiation_log` by NegotiationStage (:1998), `submission_log` by SubmittedStage (:1983), and no stage config contains `Activity`/`Response History` (the only `["Overview","Activity"]` config is the unreachable default, `tender-stage-config.ts:412-424`) | Orphaned surface (dead code path); note capture survives via the Global Intelligence drawer |
| **TenderAuditTrailTab** | read-only view of `commercial_ticket_audit`; reachable only inside SubmittedStage `audit_trail` (:1983 → `SubmittedStage.tsx:191-193`); the generic branch at `TenderWorkspace.tsx:2187` is dead (`approval_record` claimed by Stage 9 at :1978) | READ-ONLY-BY-DESIGN |
| **TenderPlaceholdersTab** | renders `ws.placeholders` (always `[]`, loader stub) and its "Mark approved" calls `updatePlaceholderStatus` refusal (`TenderPlaceholdersTab.tsx:39-48`; stub `supabase-tender-actions.ts:1360-1370`). **Additionally unreachable** — no stage tab id `placeholders` exists | DISABLED + dead surface |
| **TenderRequiredDocumentsTab** | same pattern: `updateRequiredDocStatus` refusal (`:44-52`; stub :1375-1384); collections empty; no stage exposes `required_documents`/`technical_evidence` | DISABLED + dead surface |
| **TenderComplianceMatrixTab** | "Mark compliant" → `updateComplianceStatus` refusal (`:27-37`; stub :1389-1399); `compliance_matrix` tab id is claimed by Identified's own tab first (:2175 vs :2183) | DISABLED + dead surface |
| **TenderSubmissionGatesTab** | informational only; explicit "Gates Not Yet Active / Hardening Phase" banner (`:80-95`); derives from always-empty collections; **unreachable** (`submission_readiness` claimed by Stage 9 at :1978 before :2185) | READ-ONLY-BY-DESIGN + dead surface |
| **Documents: Library / Drawer / Modal** | Upload is real: file → Supabase Storage + `generated_documents` row (`document-vault.ts:379-431`) + metadata entry in `type_details.documents` via `addTenderDocument` (`TenderDocumentModal.tsx:120-180`; list-update with revision token, `supabase-tender-actions.ts:250-293`). Metadata edit / status / supersede via `updateTenderDocumentMetadata`/`changeTenderDocumentStatus` (:1285-1340). Drawer opens per-stage filtered view (`TenderDocumentDrawer.tsx:91-142`); downloads via signed URL (`TenderDocumentsLibrary.tsx:39-53`) | PERSISTS-CONFIRMED |
| **TenderSplitPackGenerator** | `if (!masterPack) return null;` (`:45`) — packs always empty → **renders nothing, ever**; even when reachable its "Run Checks" is local state + toast (:37-42) | STATE-ONLY + dead surface |
| **Submission pack prep / email** | "Review Submission Email" only reachable inside the dead Packs branch (`TenderWorkspace.tsx:2012-2026`, no stage exposes `packs`/`tender_builder`); `TenderSubmissionEmailReview` renders "Supabase submission email data not found" without `ws.submissionEmails` (always empty, `:25-74`); `logEmailSimulation` has no callers and refuses anyway (:1456-1463) | DISABLED + dead surface |
| **FinalPack Studio handoff** | Header link `/tenders/:id/final-pack` always enabled, explicitly NO-GATE (`TenderWorkspace.tsx:1690-1701`); Stage-9 assembly link too (`FinalApprovedStage.tsx:536-542`); PdfStudio reads commercial_tickets, writes only `doc_instances` (`PdfStudio.tsx:1-16`), standalone entry `/pdf-studio` with TenderPicker (:765, :913, :993) | PERSISTS-CONFIRMED (own store) |
| **CRM tracker vs Internal tracker** | Two independent movers: CRM strip → `updateTenderCrmStage` (writes only `crm_pipeline_stage`, `supabase-tender-actions.ts:389-432`; guarded by `isRestorableCrmPipelineStage` round-trip check, `supabase-tender-data.ts:446-448`, refusal toast `TenderWorkspace.tsx:1737-1742, 2297-2303`); Internal tracker browse is view-only until "Set … as Current Stage" dialog → `updateTenderPhase` (writes only `internal_stage`, validated key, :346-386; dialog `TenderWorkspace.tsx:2317-2348`). Independence documented at `supabase-tender-actions.ts:391-393` and `CrmPipelineStrip.tsx:1-10` | PERSISTS-CONFIRMED (both movers) |
| **TenderGlobalIntelligenceDrawer** | unified activity+audit feed + Add Note → confirmed `createActivityNote` (`:183-192`) — the only reachable note-capture path | PERSISTS-CONFIRMED |
| **PreviousStageIntelligence / SuggestedProposalBlocksPanel** | read-only aggregations (panel header explicitly "does NOT save/generate", `SuggestedProposalBlocksPanel.tsx:2-15`) | READ-ONLY-BY-DESIGN |
| **TenderKnowledgeBaseSection** | document knowledge-tags via `updateTenderDocumentMetadata` (`src/components/tenders/TenderKnowledgeBaseSection.tsx:16,35`) | PERSISTS-CONFIRMED |
| **TenderOrchestrationReviewSection** | Wave-2 review-only AI-suggestion surface; "human review required before official tender update" (`TenderOrchestrationReviewSection.tsx:11,60`) | READ-ONLY-BY-DESIGN |

---

## Summary — classification counts by stage

| Stage | PERSISTS-CONFIRMED | STATE-ONLY | DISABLED | FABRICATED signals | READ-ONLY |
|---|---|---|---|---|---|
| 1 Identified | 6 save surfaces (prob, team, SOW, intake, doc-review+link, compliance-notes, clar-log) | 0 | 0 | 0 | summary tab; empty compliance table |
| 2 Qualification | 4 | 0 | 0 | 4 sidebar meters (key mismatches) | — |
| 3 Bid/No-Bid | 4 | 0 | 0 | downstream `bid_decision` key misread | — |
| 4 Solution Design | 7 (all with cross-tab clobber + no reload) | 0 | 0 | 2 pack-proxy indicators | — |
| 5 P&L/Pricing | 4 (calculator draft/snapshot/submit + 3 tabs) | 0 | 0 | 0 (self-declared approval, no enforcement) | context/legacy panels |
| 6 Tender Drafting | 4 (TOC, blocks, compliance-coverage, appendices) | 0 | 2 (TOC AI, block AI) | 2 sidebar meters (`items` mismatches) | 2 volume views |
| 7 Internal Review | 2 (block review decisions, resubmit) | 0 | 1 (AI review; empty-block pre-flags persist) | 3 header verdicts incl. hardcoded Legal "Not Started" | dashboard |
| 8 Approval Matrix | 1 (approvals CRUD/decisions) | 0 | 0 | `decided_by:"Current User"`; 2 constant-100 segments; stale-location readers | 3 tabs |
| 9 Final Approved | 1 (approval record; `recorded_by` literal) | 0 | 1 (Final Check bot) | "Approved"+"Verified" hardcoded; 14-doc fuzzy checklist; dead `departmental_reviews` check | readiness tab |
| 10 Submitted | 3 (submission record, version, crm-sync record) | 0 | 0 | "locked version" claim over live blocks | audit view |
| 11 Clarification | 4 | 0 | 0 | 0 | — |
| 12 Client Evaluation | 5 | 0 | 0 | header "Evaluation: In Progress" hardcoded | — |
| 13 Negotiation | 4 | 0 | 0 | 0 | — |
| 14 Awarded | 4 | 0 | 0 | 0 | — |
| 15 Lost/Withdrawn | 4 | 0 | 0 | 0 | — |
| Cross-stage | docs upload/edit, notes, 2 stage movers, KB tags | split-pack "checks" | 4 dead-stub tabs + email sim | — | gates, audit, intel panels |

**No STATE-ONLY editable field that a user can actually reach was found in the 15 stage tabs** — every reachable editable surface either persists through the confirmed write layer or is a disabled/dead surface. The data-loss risks are instead *overwrite* (stage 3/4 stale-spread) and *stale-view* (missing reloads), plus signal fabrication.

---

## TOP-GAPS (ordered by user impact)

1. **Solution Design cross-tab data destruction** — all 7 tabs write `{...pageLoadCopy, section: data}` over the whole `solution_design_data` facet with **no reload after save** (`HOPOperationsModelTab.tsx:173`, `HAMManpowerModelTab.tsx:97`, `HIPSystemsIPModelTab.tsx:103`, `ScopeMatrixTab.tsx:97`, `SLAKPIModelTab.tsx:84`, `AssumptionsDependenciesTab.tsx:108`, `SolutionConfigurationTab.tsx:197`; no `reload` prop passed, `TenderWorkspace.tsx:2227-2233`). Saving tab B after tab A in one session silently reverts A in the database. Same pattern (mitigated by reload-on-success) in Bid/No-Bid (`BidDecisionTab.tsx:178-183` etc.).
2. **Stage 9 fabricated verdicts** — "Final Approval: Approved" and "Version Integrity: Verified" are unconditional literals (`tender-stage-config.ts:253,256`); the Submission Checklist is a hardcoded 14-item list with first-word fuzzy matching (`FinalApprovedStage.tsx:57-72,637`).
3. **Approval evidence integrity** — approval decisions and final-approval records attribute to the literal `"Current User"` (`ApprovalMatrixStage.tsx:235`, `FinalApprovedStage.tsx:435,709`), while the stage-8 meter and stage-9 checklist read the **legacy** `tender_drafting.approval_matrix` location instead of the canonical `type_details.approval_matrix` the stage writes (`TenderWorkspace.tsx:1139-1141,1280,1293` vs `supabase-tender-actions.ts:1053-1059`).
4. **Internal Review false verdicts + orphaned store** — header shows hardcoded "Legal Review: Not Started" and pack-proxy Ops/Finance states (`tender-stage-config.ts:222-224`); `departmental_reviews` has readers but no writer, so "3/3 departments reviewed" is unreachable (`tender-stage-source-truth.ts:100`; readers `FinalApprovedStage.tsx:149`).
5. **Sidebar progress meters lie across 4 stages** — Qualification (all 4 tabs), Drafting compliance/appendices (`items` vs `requirements`/`evidence_gaps`), and Risk/Technical/CustomerFit key mismatches (evidence in stage sections above): honest saved work renders as 0% forever.
6. **Client Evaluation "In Progress"** hardcoded for every tender on that stage (`tender-stage-config.ts:335`).
7. **Stale-view after save in 3 Qualification tabs** — Technical/CustomerFit/Risk persist but never refresh `ws` (`TechnicalQualification.tsx:338-355`, `CustomerFitQualification.tsx:418-434`, `RiskSnapshot.tsx:360-378`; no `onSaved` passed, `TenderWorkspace.tsx:2216-2218`) — users see their saved data vanish on tab switch.
8. **Downstream misread of the Bid decision** — TOC Source Intelligence reads nonexistent `bid_decision` key (`ProposalArchitectureTOCTab.tsx:166,319`), and its AI context reads `risk.risk_rows` where the store key is `register` (:327 vs `RiskSnapshot.tsx:107`).
9. **"Submitted Version locks nothing"** — the frozen-version banner and block snapshot show live, still-editable drafting blocks (`SubmittedVersionTab.tsx:45-49`).
10. **Dead surfaces with refusal actions** — Placeholders / Required Documents / Compliance Matrix (generic) / Submission Gates / Packs+Split Pack / Submission Email are all simultaneously (a) fed by hard-stubbed empty collections (`supabase-tender-data.ts:700-733,756-791`), (b) unreachable through any of the 65 stage tab ids, and (c) backed by refusal stubs (`supabase-tender-actions.ts:1346-1427,1456-1463`) — plus the note-taking `TenderActivityTab` is itself unreachable (notes survive only via the Global Intelligence drawer).
11. **All AI features are silent dead buttons** — TOC generate, block drafting/chaining, three departmental AI reviews, Final Approval Check all throw SX-001/SX-011 refusals (`ai-runs.ts:445-457`; `DepartmentalReviewTab.tsx:376`; `FinalApprovedStage.tsx:432`) — visible buttons whose only outcome is an error toast (one exception: empty-block "NOT DRAFTED" flags do persist).
12. **Audit trail is best-effort for everything except notes** — stage/field saves report success once the ticket row moves; the audit row may silently not exist (`supabase-tender-actions.ts:12-22,72-123`), and `_insertAuditEvent` is a no-op (:337-339). Non-atomic paired write in Identified clarification log (:118-121 of the tab) can also half-save.
