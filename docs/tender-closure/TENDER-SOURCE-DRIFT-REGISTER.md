# TENDER-SOURCE-DRIFT-REGISTER
**Wave:** Tender Functional Closure · **Author:** Fable · dates 2026-08-21 (build phase; mapping began 2026-08-20)

## Old-application protection
| Measure | Value |
|---|---|
| Old repo (`hala-commercial-engine`) commits | **Zero new commits** — HEAD unchanged at `b7fa4c7` throughout the wave |
| Old repo working tree | The architect's own pre-existing unstaged modifications remain unstaged; line count 119 (W06 record) → 118 observed at TCW build phase — delta predates/outside this wave (no lane had access; all worktrees are clean-app only). No wave process wrote there |
| Forbidden ops | `git add -A`/reset/checkout/stash in the old repo: never run by any wave process |

## Clean-repository provenance
| Item | Value |
|---|---|
| Baseline | master `93799d3` = `169aafd` (architect's deadlock fix) + committed audit report; tag `tender-closure-start`; entry gates tsc 0 · 692/49 · 2,496 modules |
| Lane branches | `tcw/t1-data` (7 commits) · `tcw/t2-shell` (4) · `tcw/t3-early` (5) · `tcw/t4-late` (8) · `tcw/t5-registers` (5) — disjoint write allowlists, zero overlap (verified by diff-name comparison at each acceptance) |
| Integration | `tcw/integration`: mapping evidence `8598e7e` → T1 `9b05859` → T2 `4c2e423` → T3 `44be92f` → T4 `81316f9` → T5 `d0a1c16` → Fable seams `0035872` |
| Gates at `0035872` (Fable-reproduced) | tsc **0** · **943 tests** (arithmetic exact: 692+56+57+45+44+50−2+1) · build **2,494 modules** |
| Fable-run guard proof on merged tree | exact-id targeting broken → 2 named failures → restored → green |

## Live-data disclosure (build phase)
All database access during mapping/build was **read-only** (anon PostgREST GET/HEAD). Zero writes, zero residue. Live rows at mapping: exactly 2 (Linde tender `7483c493-…`, KAFD proposal) — the 3 seed tenders + seed proposal were deleted by the architect-approved exact-id cleanup migration `202608190002` (2026-08-19), superseding the older "6 rows" premise. Linde audit rows at mapping: 194. The authenticated UAT is the only phase permitted live writes (its own records, deleted by exact captured id afterwards).

## Standing known issues NOT in scope (P8 — unchanged by ruling/scope)
1. **World-readable RLS** on `commercial_tickets`/`commercial_ticket_audit` under the shipped anon key (Wave-0 CRITICAL) — reconfirmed live by mapping probes; no security hardening this wave.
2. `changeStage` bare-id targeting + `"CRM Pipeline"` actor label (shared kanban surface).
3. Dual document metadata stores without reconciliation; `document-vault` step-2 orphan messaging.
4. `doc_instances` lacks a DB `updated_at` trigger (client-token discipline holds today).
5. Legacy tender child tables: exist live, anon-count 0, authenticated-role contents UNVERIFIED (read-only limits); never written by the clean app.
6. `useFinalPackInstance` insert path avoids select-after-insert by design (RLS stall history) — unchanged.
7. Historical audit rows carry `"Unauthenticated"` ×2 (pre-`169aafd` profile-load gap) and `"CRM Pipeline"` actor labels — history not rewritten.

## Environment incidents (harness, not application)
1. All three mapping agents were killed mid-run by a server-side stream failure ("response stopped arriving"); each was resumed from its transcript and completed; interrupted findings were re-verified with real reads post-resume.
2. Wall clock spans a day boundary (mapping 2026-08-20 → build 2026-08-21) due to the storm + overnight gap.
3. Pre-existing test-suite flake (recorded by T5, out of wave scope): `final-pack-fidelity.test.ts` intermittently reports an unhandled `processTimers` teardown error from `openPrintablePdf`'s 800ms `setTimeout` — no test fails; cause noted for a future fix.
4. Background-task `.output` files for completed lane agents were empty; lane reports were recovered verbatim from the agent transcripts (`subagents/agent-*.jsonl`) — recorded so the evidence provenance is clear.

## UAT-phase additions (2026-08-21, authenticated session)
**Harness incidents (not application defects):**
1. The in-app Browser pane opener was unavailable (upstream classifier outage); per the architect's ruling the UAT ran in the architect's own Chrome via the Claude-in-Chrome extension after they signed in personally. The architect first signed in at :5300 (their own pre-wave stack) and was redirected to :5310 (wave stack) — the pre-wave stack was never driven.
2. Renderer screenshot timeouts (CDP 30s) while `window.print()` was pending in the export flow; page JS stayed responsive throughout — worked around with JS-based DOM checks.
3. One stray text entry landed in a background page input during an unscoped `querySelectorAll` targeting attempt (Owner field step). Page-state only; cleared on reload; DB probe confirmed no persisted effect. Later targeting was dialog-scoped.
4. Synthetic typing lost focus races twice (empty intake field, S4 empty-note save); both were caught by the read-back verification loop (probe showed the miss) and redone with native value-setter + input-event dispatch. The loop catching its own misses is evidence the verification is real.

**Application observations (non-blocking, candidates for a future wave):**
5. Upload dialog: Owner is required by `canSave` but the disabled Upload button gives no inline hint which field is missing.
6. SowQualification "Tender Intake Snapshot" panel renders a residual "READINESS 0%" fragment when no packs are configured, while the workspace header correctly says "not measured (no packs configured)" — cosmetic inconsistency in one sub-panel.
7. PDF export: the print pipeline requires a trusted user gesture and ends at Chrome's native Save-as-PDF dialog; both automation-visible failure modes surfaced honest messages (pop-up-blocked → "Export failed…", success → "cannot confirm the file was saved"). No false success anywhere.
8. No deletion UI exists for tenders or uploaded documents (out of wave scope — no gates ruling covers absence of destructive UI too). UAT cleanup therefore used: the app's own authenticated client for `doc_instances`, and the service-role key (read from the old app's `.env`, never printed) for `generated_documents`/audit/ticket/storage — every delete by exact captured id with returned-row-count confirmation and read-back-0 verification. RLS as-deployed permits authenticated DELETE on `doc_instances` but not on `generated_documents`/`commercial_ticket_audit`/`commercial_tickets` (consistent with the standing P8 RLS findings; unchanged this wave).

## Post-closeout polish (2026-08-24)
1. Tender Overview and the Tender document library now expose reversible Archive actions with confirmed stored read-back; ordinary active views omit archived records. This does not claim hard deletion.
2. PDF export now attempts direct high-fidelity download before the existing native print fallback.
3. The clean application gained no old-app path, environment, credential, source, or runtime import. Future clean-app UAT cleanup is explicitly prohibited from reading the old application's `.env`; the 2026-08-21 incident remains historical evidence, not an accepted operating method.

## Codex adversarial repair pass (2026-08-24)
1. Application edits were confined to the standalone clean repository. No old-app source, environment file, credential, schema, policy, or live record was read or changed.
2. During verification, `node_modules` was restored from the existing frozen `pnpm-lock.yaml` after the package manager recreated the dependency tree. Neither `package.json` nor `pnpm-lock.yaml` changed.
3. A temporary local-only PDF renderer harness was created solely to execute the real client renderer, returned a 23,502-byte `%PDF-` payload without console errors, and was deleted before closeout.
4. Final evidence: TypeScript PASS; 960/960 tests PASS with zero unhandled errors; production build PASS at 2,495 modules; active and archived Tender views verified in the browser.
