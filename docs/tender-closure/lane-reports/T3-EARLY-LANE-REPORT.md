# TCW-T3-EARLY lane report (verbatim)

> Extracted verbatim from the lane agent's final report.

The lane is complete and verified. Final report:

---

## TCW-T3-EARLY — final report (branch `tcw/t3-early`, 5 commits on baseline `4c2e423`, HEAD `d743b96`)

### Gates (exact numbers I saw)
- `pnpm check` (tsc --noEmit): **0 errors**
- FULL `npx vitest run`: **850 passed / 59 files** (baseline entry: 805 / 55 → +45 tests, +4 files, zero regressions)
- `pnpm build`: **2493 modules transformed**, built (baseline 2,493)
- Working tree clean; every changed file inside the T3-STAGES-EARLY grant.

### Files touched (24 components + 4 new test files, all under `.tcw-trees/t3-early/src/components/tender/`)
IdentifiedStageShared, IntakeFileAuditTab, TenderDocumentReviewTab, IdentifiedComplianceMatrixTab, IdentifiedClarificationLogTab, TenderCustomerSnapshotTab, ScopeOfWorkCapture, SowQualification, TechnicalQualification, CustomerFitQualification, RiskSnapshot, BidDecisionTab, WinStrategyTab, ResourceCommitmentTab, DecisionRecordTab, SolutionConfigurationTab, HOPOperationsModelTab, HAMManpowerModelTab, HIPSystemsIPModelTab, ScopeMatrixTab, SLAKPIModelTab, AssumptionsDependenciesTab, PnlPricingStage, TenderPnLCalculatorPanel + tests: `IdentifiedStageShared.test.ts`, `tcw-t3-tab-payloads.test.ts`, `IdentifiedClarificationLogTab.test.ts`, `ScopeOfWorkCapture.test.ts`. **TenderSummaryTab.tsx untouched** (read-only tab, no save surface).

### Payload keys, before → after
- **Bid/No-Bid (4 tabs)**: `{...pageLoadFacet, ownKeys}` → own keys only, via exported pure builders: `{decision, decision_checklist, recommendation}` | `{win_strategy}` | `{resource_commitment}` | `{decision_record}`.
- **Solution Design (7 tabs)**: `{...pageLoadFacet, key}` → exactly one own key each: `configuration | hop | ham | hip | scope_matrix | sla_kpi | assumptions_dependencies` (exported builders). This ends the TOP-GAP-1 cross-tab revert.
- **SOW capture + 4 Qualification tabs**: single-tab facets — full own-facet keys retained per pin P2b, now sent through the opts form `{ expectedRevision, reason? }`.
- **Identified tabs / Pricing**: section writers unchanged payloads; `expectedRevision` threaded as the 5th positional arg (`updateTenderIdentifiedData`, `updateTenderPricingData`).

### Outcome handling (every save handler)
Shared, tested orchestrator `runTenderTabSave` + `resolveTenderTabSaveOutcome` in IdentifiedStageShared: plain green only on confirmed saves; `saved_with_audit_warning` → amber "Saved — audit entry not recorded" with the service's verbatim reason (still a confirmed save; onSaved fires); `stale` → non-destructive: entry kept (dirty guards every resync path), service's honest message shown, bundle refreshed underneath where a `reload` handle exists, and a one-shot **informed retry** armed. `onSaved`/`onConfirmed` fire on confirmed saves ONLY. New `onSaved` prop added to TechnicalQualification, CustomerFitQualification, RiskSnapshot and all 7 Solution Design tabs (T2's spread dispatch is now live); verified SowQualification + 4 Bid/No-Bid tabs call theirs on success only.

### Badge truth (item 4) and F7
`IdentifiedStageShell` now passes `saved` through to ProcessStageTaskShell (call-site only — shell untouched); 5 Identified tabs pass `saved = confirmedSaveThisSession && !dirty` (`identifiedSavedBadgeState`, tested); Customer Snapshot also lifts the embedded SOW capture's dirty state into the stage badge. F7: the mount-time `DEFAULT_KPI_NAMES` seeding is deleted; empty stays empty (honest empty-state line added); the names are click-to-add suggestion chips that enter local state only on user action (`initialSowState` / `kpiSuggestionsFor`, tested).

### Item 6 — what I implemented (clarification pair)
Kept two writes — `updateTenderIdentifiedData` persists exactly one section per call, so a single save is impossible without changing T1's writer (out of grant). Exported `saveClarificationPair`: UI token threaded into write 1 only; **the first write's new revision is NOT available** (ActionResult carries no token), so write 2 passes no explicit token and the section writer's own fresh in-call read supplies the post-write-1 revision — the "reload between" fallback the brief allows. Partial failures report exactly which half saved ("questions saved, notes NOT saved: <reason>"), audit warnings aggregate naming the half; retry re-saves the rows unchanged then the notes.

### Item 7 — PnL panel
All three `pnl_snapshot` writes (draft/snapshot/submit) thread `expectedRevision` from the **same bundle** that supplies the patch base (`pnlData` derives from the current `ws` prop at save time), so a stale base now refuses instead of silently overwriting snapshots; reload-after-save covers the rest. All other behavior kept. In `PnlPricingStage` (my file) I also fixed `useSectionForm`'s **unconditional resync**, which wiped unsaved edits whenever any reload landed — now dirty-guarded (house pattern), with the baseline still tracking the stored copy so "Unsaved changes" stays honest.

### Tests added: 45 across 4 files
House projection-enforcing stateful mock (copied from `tender-facet-writers.test.ts`, PostgREST-faithful `updated_at` predicate) drives the REAL writers with my builders; pure-function tests for outcomes, pair, F7, badge. Coverage per brief: own-keys payloads (11 builders + 2 DB-level sibling-survival proofs), expectedRevision threading, stale → non-destructive (nothing reaches the DB, onSaved not fired), audit warning surfaced amber while the primary landed, onSaved on success only, armed-retry semantics.

### GUARD proof (lane-run)
Reintroduced the whole-facet-spread defect class in `buildHopPatch` (sibling `configuration` key in the payload) → **2 named tests failed**: "GUARD: buildHopPatch emits ONLY the hop key (whole-facet spreads are forbidden)" and "HOP save … stored configuration/ham … survive" → restored → 15/15 green.

### Gaps (for Fable)
1. **CRITICAL cross-lane gap — `ws.revisionToken` is not plumbed to tabs.** The bundle carries it (`supabase-tender-data.ts:1039`), but `bundleToTenderWorkspace` (T1 file) does not copy it onto `TenderWorkspace`, and the interface (T2 file, `tender-workspace-data.ts:775`) lacks the field; `Tender.updatedAt` is date-only, unusable. Both files are out of my grant, so per worktree discipline I did NOT edit them. My tabs consume the pinned contract field via `tenderRevisionTokenOf(ws)`; until the one-line mapping (+ interface field) lands in the owning files, it resolves `undefined` at runtime and writers fall back to their in-call token (the pre-existing guard). The moment it lands, threading goes live with zero tab changes; my tests already prove the threading with the field present.
2. `updateTenderProbability` / `updateTenderTeamMembers` (Customer Snapshot) expose **no expectedRevision parameter** in T1's signatures — outcome handling added; UI-token threading needs a T1 signature change.
3. Stale-retry semantics: after an informed stale refusal, the next attempt intentionally omits the known-stale token (save layer's fresh read = "reload between"); patch-merge means the retry can only overwrite the tab's own keys. Documented in code and tests — flag if you want a different resolution.
4. TenderSummaryTab still shows the default grey "Not Saved" badge (read-only tab, nothing to save) — outside item 4's defect definition; left as-is.
5. Line-ending note: RiskSnapshot/TechnicalQualification were briefly LF-flipped by a sed step; restored to CRLF inside the same commit — cumulative diffs vs baseline are clean (~68/66 lines).

I do not declare this lane complete — Fable verifies.
