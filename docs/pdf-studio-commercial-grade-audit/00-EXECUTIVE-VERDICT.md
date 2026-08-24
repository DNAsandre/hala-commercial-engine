# 00 — EXECUTIVE VERDICT
**PDF Studio / Final Pack Studio — Commercial-Grade Audit**
**Baseline:** branch `proposal-functional-closure` @ `e0c7062f1168ba5596cab6c3d52c453103e9efb2` (tag `proposal-functional-closure-complete`) · **Date:** 2026-08-24
**Method:** 11 parallel read-only inspection lanes (routes/identity, tender ingestion, proposal ingestion, editor, preview, export, persistence, documents/storage, automated evidence, clutter/contradictions, usability) + an authenticated read-only browser walkthrough at localhost:5310 serving this exact commit. Every lane claim was reconciled against source; cross-lane duplicates merged; browser-verifiable claims verified live where the read-only ruling allowed.

## Measured percentages (per verdict rules — no unmeasured superlatives)
| # | Dimension | Measured estimate | Basis |
|---|---|---|---|
| 1 | Editor completeness | **~78%** | every block type humanly editable, real rich text, real templates/branding/history; reset-wrong-block + undo desync + no row add/remove + decorative drag |
| 2 | Source-truth completeness | **~40%** (tender ~35%, proposal ~45%) | identity + pricing rows + 5 narrative slots flow; SOW/SLA/clauses/commercial-terms/quote/documents/Arabic do not |
| 3 | Preview fidelity | **~55%** | one shared renderer (structural identity exact, test-pinned); clauses never render, `{{recipient_name}}` literal, default prose masks gaps, page geometry drifts from A4 (507px measured vs 595) |
| 4 | Export fidelity | **~85%** | single serialization for all paths, honest delivery language, audited exports; silent text-fallback + raster losses + dead footer flags |
| 5 | Persistence / versioning | **~68%** | real optimistic concurrency + real versions + honest failure UI; false-conflict defect, no read-back, blocks-only restore, vestigial status, zero tests on the critical path |
| 6 | Tender handoff | **~85%** | three live entry points, exact-id threading, three-state reads, working drift detection; mislabeled refresh remedy |
| 7 | Proposal handoff | **~80%** | dedicated route + entry button + shared engine, live-verified; single entry point, tender wording, entity mislabel, scenario-picker dishonesty |
| 8 | Browser/UAT evidence | **~40%** | routes/identity/preview-truth/honesty-states/layout live-verified with zero console errors; write path (edit/save/export/create) deliberately not exercised (read-only), exact viewports not achievable (maximized window) |
| 9 | **Overall commercial readiness** | **~55%** | see below |

## The one-paragraph truth
The studio's **engineering skeleton is genuinely sound** — one renderer for preview and export, exact-id source threading, honest three-state reads, real optimistic-concurrency autosave, real version history, audited exports with the most truthful failure language in the codebase, zero old-app runtime dependence (0 hits in the built bundle), and 978/978 tests green at 2,495 modules. But **what lands inside the document is not yet commercial-grade**: internal cost/GP margins render in customer pricing tables (PDS-01), the legal/terms blocks ship placeholder boilerplate because fetched clause content is never rendered (PDS-02 — confirmed live in both existing packs), a literal `{{recipient_name}}` prints in the confidentiality clause (PDS-03 — confirmed live), the SLA pack's matrix is field-dead (PDS-04), most drafted content is silently dropped by five title heuristics (PDS-06), and the drift banner's "Refresh from source" restores stale content while claiming the opposite (PDS-05). These six blockers mean a real Hala tender or proposal exported today can contain wrong, internal, or placeholder content **while every surface signal tells the user it is fine**.

## Verdict
**DEFECTIVE-PARTIAL — not yet commercially usable for real Hala Tender and Proposal documents.**
It is an honest, well-architected drafting tool with a content-ingestion layer that is roughly one-third complete and six specific defects that put wrong content into customer documents. No gates, no fabricated success signals, and no old-app dependence were found; the failure mode is *missing and mis-mapped content*, not deception (with the two mislabeled controls as exceptions). The ordinary product work to close this is scoped in [11-COMMERCIAL-GRADE-COMPLETION-PLAN.md](11-COMMERCIAL-GRADE-COMPLETION-PLAN.md) — Phase 1 (six items) is the minimum bar before customer-facing export.

## Where everything is
01 feature manifest · 02 tender source map · 03 proposal source map · 04 editor/preview/export · 05 persistence/versioning · 06 browser UAT matrix · **07 defect & gap register (73 consolidated rows: 6 BLOCKER, 10 HIGH, 26 MEDIUM, 31 LOW/clutter)** · 08 left-behind/clutter · 09 automated evidence (measured) · 10 Sprint X deferred observations (11, no solutions) · 11 completion plan.

## Audit integrity statement
Read-only held: no application code, config, schema, DB row, or storage object was changed; no packs created, no edits typed, no exports clicked; the two existing packs still show their original 13 Jul / 22 Jun timestamps. The old application was consulted read-only (seed SQL, comparisons) and is untouched. The dev stack for the walkthrough was started from the exact audited commit. DB probes were anon-key GET/HEAD (+1 read-only storage list, disclosed) — the key was never printed. Stated honestly: the tasking brief expected 960/960 tests; the measured suite at this commit is **978/978** (two runs).

## Related same-day audit and binding rule (cross-reference)
A sibling audit at this same commit, `docs/ai-destination-readiness/TENDER-PROPOSAL-AI-DESTINATION-READINESS-AUDIT.md`, assesses a different axis — AI destination-contract readiness (verdict NOT READY; Tender 55% / Proposal 45%). The two audits were reconciled and do not conflict: identical measured gates (978/978, 2,495 modules); its ADR-09 (no machine-checkable field→PDF-block contract; "default template prose must never be treated as extracted customer truth") is the contract-level counterpart of this audit's PDS-02/PDS-16 content findings; its ADR-08 matches this audit's note that Proposal full write-UAT is outstanding. The binding `AI-BOT-CONFIGURATION-ARCHITECTURE-RULE.md` (2026-08-24) governs all future bot work. Compliance of this audited surface with that rule, from this audit's evidence: PDF Studio bot discovery is config-driven from `ai_bots`/`ai_bot_versions` with no hard-coded bot ids/prompts/knowledge/providers (`final-pack-bots.ts`), execution refuses (no activation or simulated output), and no governance logic lives in process stages — compliant today, with two register items relevant to the rule's spirit: PDS-40 (bots listed as runnable before the refusal) and the destination audit's ADR-03 (stale Tender "AI Orchestration Review" panel suggesting capability that does not exist — outside this audit's PDF-Studio scope but confirmed present).

**This audit stops here for Codex inspection and the architect's review.**
