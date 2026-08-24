# 06 — BROWSER UAT MATRIX (read-only walkthrough)
**Session:** 2026-08-24, authenticated as Amin Al-Rashid (admin) in the architect's Chrome (Claude-in-Chrome), localhost:5310 serving branch `proposal-functional-closure` @ `e0c7062` (vite 5310 + clean server 5301, fresh stack started for this audit from the exact baseline). **Strictly read-only:** no pack created, no edit typed, no export clicked, no button with a write effect pressed. Write-absence evidence: no edits were performed; both existing packs still display their original `updated 13 Jul 2026` / `updated 22 Jun 2026` timestamps after the walkthrough.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Tender → Final Pack Studio (`/tenders/7483c493…/final-pack`, Linde — read-only reference, viewing only) | **PASS** | Correct title + customer identity; honest pricing empty-state banner; Resume Existing lists the July pack; 5 create cards |
| 2 | Open existing Tender pack in editor + preview | **PASS (with findings)** | Composer loaded: 13 blocks, per-block controls, "Hala Premium — Gold Accent" branding persisted, DRAFT badge, History + Save-as-Template present |
| 3 | Drift banner on a genuinely-changed source | **PASS (detection) / FAIL (remedy not exercised)** | "Tender source has changed since this pack was created" shown — correct (tender changed 2026-08-19, pack from 13 Jul). Refresh button NOT clicked (write); source analysis shows it would restore the stale snapshot (PDS-05) |
| 4 | Honest content notes | **PASS** | "5 blocks have no content captured yet · Pricing block has no pricing scenarios captured · 1 block is showing default content only" |
| 5 | Preview content truth (Linde pack, full iframe text extracted) | **FAIL ×2 / PASS elsewhere** | Literal `{{recipient_name}}` in confidentiality (PDS-03); "Terms are loaded from the Clause Library…" boilerplate as T&C (PDS-02); genuine captured tender narrative present; honest "No pricing data captured yet" + 2 "not captured" markers |
| 6 | Proposal → Final Pack Studio (`/proposals/089447d6…/final-pack`, KAFD) | **PASS** | Correct proposal title/customer; "Back to Proposal"; proposal-worded pricing banner ("for this proposal") — truthful for KAFD (0 P&L versions, DB-probed read-only); Resume lists the June pack |
| 7 | Open existing Proposal pack | **PASS (with findings)** | Composer 14 blocks; preview: same `{{recipient_name}}` + terms boilerplate findings; no drift banner — consistent (hash-relevant fields empty at creation and now) |
| 8 | Standalone `/pdf-studio` | **PASS** | StartScreen: 5 real cards + "Duplicate Existing Document — Coming soon" (honestly-disclosed stub); "Open Connected Source" copy says tender-only (PDS-69) |
| 9 | Resume Existing (all-instances list) | **PASS (with findings)** | 4 instances listed; 2 with empty customer render "— Full Commercial Proposal" (PDS-72); **all 4 status `draft`** — vestigial lifecycle live-confirmed (PDS-42) |
| 10 | Console errors across all routes | **PASS — zero** | onlyErrors sweeps at each stop: none |
| 11 | Layout: double-scroll defect (UX-01 prediction) | **CONFIRMED** | In the open composer: `main.scrollHeight − clientHeight = 104px` — the predicted h-screen-in-shell overflow, at full desktop size |
| 12 | Layout: preview not A4-fixed (UX-03 prediction) | **CONFIRMED** | `.fps-preview-iframe.offsetWidth = 507px` (596px expected for A4) — preview wraps ≠ export wraps |
| 13 | Nested scroll containers | **3 measured** on the composer view (UX-12) |
| 14 | Desktop 1366×768 exact | **NOT TESTED** — window maximized; extension resize accepted but not applied by the OS (innerWidth stayed 1536). Measurements captured at 1536×839 instead |
| 15 | Mobile 390×844 | **NOT TESTED** — same cause. Source-computed prediction (composer unusable, ~38px editor sliver, zero media queries) stands unverified live |
| 16 | Editor interactions (typing, undo, reorder, reset), pack creation, export clicks | **NOT TESTED** — read-only ruling (all mutate `doc_instances`/audit tables). Covered by source lanes + existing tests + the 2026-08-21 Tender-wave live UAT of the same export pipeline |
| 17 | Naming consistency | **CONFIRMED**: "PDF Studio" (nav) vs "Final Pack Studio" (header) vs "Document Studio" (standalone breadcrumb) — three names, one surface (PDS-68) |

**Screenshots on record (session transcript):** dashboard, Linde selector, Linde composer (top + block list bottom + preview cover/confidentiality), KAFD selector, standalone StartScreen, Resume list.
**Walkthrough scope honestly stated:** ~40% of the commercial workflow was live-exercised (routes, identity, existing-pack loading, preview truth, honesty states, layout measurements); the write path (edit/save/version/export) was deliberately not exercised in this read-only audit.
