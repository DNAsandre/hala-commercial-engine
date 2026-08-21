# TCW-T2-SHELL lane report (verbatim)

> Extracted verbatim from the lane agent's final report.

All four commits landed; working tree clean and identical to the gated state. Final report follows.

---

# TCW-T2-SHELL — Lane Report

**Branch** `tcw/t2-shell` @ baseline `93799d3`, worktree `C:\ANtigravity Apps\Hala App - Amin review\.tcw-trees\t2-shell`. Four commits: `02fcb68`, `a4f2a4e`, `98c2053`, `2750a70`. Working tree clean. I do not declare completion — Fable verifies.

## Files touched (exact, all in grant)
- `src/lib/tender-stage-config.ts` (+ NEW `src/lib/tender-stage-config.test.ts`)
- `src/pages/TenderWorkspace.tsx` (+ NEW `src/pages/TenderWorkspace.stage-meters.test.ts`)
- `src/lib/tender-workspace-data.ts` (+ extended existing `src/lib/tender-workspace-data.test.ts`)
- `src/pages/TenderOverview.tsx` (+ NEW `src/pages/TenderOverview.attention.test.ts`)
- Untracked/ignored env setup only: copied `.env` from the main checkout into the worktree so the suite can run (page tests import the supabase module, which throws without env). Not committed; `git check-ignore` confirmed.

## Correction B — I FIXED the indicators, did not delete
P5 offers deletion only if "no consumer **will exist**" — unprovable from my worktree while T3/T4/T5 run in parallel, so I took P5's primary path (derive or "Not recorded") and kept the `StageConfig` shape stable. Consumer evidence for Fable: `buildStageConfig` is imported only by TenderWorkspace.tsx and only `.tabs` is consumed; no module imports `Indicator`/`Signal`/`buildSignals`. Deletion remains available to Fable at integration.

## Indicator/meter changes (before → after)
**tender-stage-config.ts**
- B1 `final_approved` "Final Approval": hardcoded `"Approved"` → derived from `type_details.final_approved.approval_record.decision` (`approved`/`not_approved`/`pending` → Approved/Not Approved/Pending, absent → "Not recorded").
- B2 "Version Integrity": hardcoded `"Verified"` → `"Not recorded"` (nothing records that check).
- B3 `client_evaluation` "Evaluation": hardcoded `"In Progress"` → derived from `client_evaluation.evaluation_status` (`overall_status` → technical → commercial, title-cased), absent → "Not recorded".
- B4 `internal_review`: Ops/Finance states were pack-section proxies and "Legal Review" was hardcoded `"Not Started"` → all three derive from `proposal_blocks[].{ops,finance,legal}_status` per the dept→volume map the Review Dashboard meter already uses; no blocks → "Not recorded". "Review Completion" switched from pack sections to block approvals across the three departments.
- B5-B7 `qualification`: "Technical Fit"←packs-compliancePct, "Customer Fit"←packs-docsPct, "Requirement Cover"←packs-docsPct → derived assessed-ratios from `capability_assessment[].fit`, `dimensions[].assessment`, `coverage_matrix[].status`; facet absent → status "Not assessed". First indicator became "Qualification Facets Recorded" (n/4 facets present) instead of pack-mean readiness.
- B24 `buildSignals`: compliance-gap signal now requires `ws.riskInputsAssessed`.

**TenderWorkspace.tsx sidebar meters** (each key verified read-only against the component source)
- SOW: `clarification_questions`→`clarifications`; outcome `overall_score/recommendation/qualification_status`→`outcome.recommendation` (≠"Not decided") + `outcome.reason`; snapshot `sq.tender_title…`(never written)→the 8 tender intake fields the read-only snapshot section renders; `output_wiring`→`percent:null` + "Informational — …nothing is recorded".
- Technical: capability counted `.status≠"Not Assessed"` (pre-seeded "Open" rows ⇒ fabricated 100%) → `.fit≠"Not Assessed"`; `requirement_gaps`→`gaps`; `clarification_questions`→`clarifications`; recommendation → `recommendation.outcome/reason`; summary derives from the same capability rows (the section renders their stats); wiring → null+note.
- Customer Fit: top-level fields→`customer_snapshot.*` (10 fields); `fit_dimensions[].score`→`dimensions[].assessment`; `evidence_register`→`evidence`; `fit_gaps`→`gaps`; scorecard = projection of dimension assessments; recommendation → `outcome/reason`.
- Risk: `risk_register`→`register`; `risk_assessment`→`assessment`; `clarification_questions`→`clarifications`; summary derives from register; recommendation → `outcome/reason`; wiring → null+note.
- Drafting: `cc.items`→`compliance_coverage.requirements` (assessed = status≠"Not Started"); `ae.items[].title`→`appendices_evidence.evidence_gaps[].missing_evidence` (label now "Evidence Gaps Captured").
- Stage-8 + Final Approved approval meters: legacy-only `tenderDraftingData.approval_matrix` → `projectTenderStageTruth(...).approval_matrix` (canonical-first, legacy fallback — reused, not duplicated; covers the live Linde legacy location).
- Constant-100%: `:1156` "Governance Note", `:1183` "Governance Rules", plus the same-defect `approval_record` "Governance" (old `:1342`) → `percent:null` + "Advisory text — nothing is recorded for this section" (existing null+note meter pattern; renders slate with tooltip).

**TenderOverview.tsx (B23)**: `getTenderAttention` green fallthrough → new `"unknown"`/"Not enough data" level when deadline, days_in_status and target GP are all absent (unparseable deadline = absent); rendered as a grey badge; exported for tests. Single consumer verified.

## Routing changes (P6)
- Stage 9 (`final_approved`) tab list += "Placeholders", "Required Documents", "Compliance" → routed to TenderPlaceholdersTab / TenderRequiredDocumentsTab / TenderComplianceMatrixTab with the CURRENT props (`ws`, `tenderId`, `reload`); `"compliance"` id added to the compliance route condition and icon map.
- **Removed with conclusive orphan proof** (each recorded in code comments): the packs/tender_builder mega-branch (no stage tab list produces those ids; `final_pack`/`submitted_version` are intercepted by the stage-gated branches above it); the `submission_readiness`→TenderSubmissionGatesTab route (id intercepted by FinalApprovedStage); the split-pack/email-review dialogs + state (only openers lived inside the removed branch); never-rendered `PackCard`. Corroboration: build module count dropped 2,496→2,493 — exactly the three orphaned components; the component FILES are untouched (T5-owned).
- **Left in place + recorded**: the generic `activity`/`audit_trail` routes (also shadow-dead, but P6 says keep — T4 fixes F5/F6 around them); remaining pack-derived indicators not named B1-B7 (identified "Tender Capture", bid_no_bid "Strategic Fit"/"Resource Burden", solution_design "Feasibility"/"Scope Clarity", approval_matrix "Approval Readiness", final_approved "Submission Ready"/"Open Signals") — same fabrication family but outside my named mandate; flagged for the drift register.

## Reload wiring
`onSaved={reload}` now reaches every saving stage-tab dispatch: the qualification three (Technical/CustomerFit/Risk) and all seven Solution Design tabs via `{...{ onSaved: reload }}` — compile-safe today (JSX spreads bypass excess-prop checks; tsc 0) and live the instant T3 adds `onSaved?: () => void`. Sow/Bid four/TenderDraftingStage already had it directly. Stage shells (InternalReview, ApprovalMatrix, etc.) receive `reload` directly — no gap found there.

## Integration TODOs for Fable
1. **T3**: add `onSaved?: () => void` to TechnicalQualification, CustomerFitQualification, RiskSnapshot + the 7 Solution Design tabs and call it after confirmed saves — my dispatch side is pre-wired (source-pin test guards it).
2. **T1**: route real loader flags through `deriveTenderAssessmentFlags` (tender-workspace-data.ts) when assembling the bundle, and feed the P1 register rows into `ws.requiredDocuments` — `buildRequiredDocumentsProgress` already accepts both shapes, honours `na`, `linked_document_id` (ids now passed from `ws.documents`), full-name-only matching.
3. **T5**: my three register routes pass current props (`ws/tenderId/reload`); align if T5's rebuilt props differ.
4. Gates tab (B19 shell side): dead route removed; component + honest labels are T5's; if a reachable home is ever ruled, that's a new T2 routing decision.

## Tests
57 added (13 stage-config pins, 33 workspace meter/wiring, 7 workspace-data register/flags, 4 overview attention): meter-truth (saved→nonzero, empty→honest zero/null), B-fix pins incl. a 15-stage sweep that no dormant hardcoded verdict survives on empty data, canonical/legacy/canonical-wins matrix cases, constant-100 gone, stage-9 tab list, B23 fallback, reload wiring as a line-wise source pin (the only non-DOM way to pin JSX dispatch).

## Gates (numbers I actually saw, final tree = committed tip)
- `pnpm check`: **0 errors**
- `pnpm test` (FULL): **52 files / 749 tests passed** (baseline 49/692; +3 files/+57 tests, no regressions)
- `pnpm build`: **✓ 2,493 modules transformed** (baseline 2,496; −3 accounted for above)

## Guard proof (run in-lane)
Reintroduced `clarifications`→`clarification_questions` in `buildSowQualificationTaskProgress`; named test "SOW Qualification meter reads the keys SowQualification.tsx writes › saved clarifications and outcome register as progress" **failed** (1 failed / 32 passed); restored; file back to 33/33 and full suite re-green.

## Gaps / honest notes
- The spread-wired `onSaved` is inert until T3 lands the prop (by design; recorded above).
- `deriveTenderAssessmentFlags` is defined+tested but not yet called by the read layer (T1's file — out of my grant).
- Scorecard/summary segments mirror their source-row ratios (those sections are pure projections); if Fable prefers distinct semantics, it's a one-line change each.
- Left-behind pack-proxy indicators listed above remain; nothing else in my files was changed or verified beyond what is stated here.
