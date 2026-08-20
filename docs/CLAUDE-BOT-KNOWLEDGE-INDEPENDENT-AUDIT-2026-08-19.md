# CLAUDE — BOT-OWNED KNOWLEDGE BASE: INDEPENDENT AUDIT

**Date:** 2026-08-19
**Audited commit:** `3e38c68` ("Replace global knowledgebase with bot-owned knowledge"), tag `bot-owned-knowledge-base-complete`
**Parent (pre-correction) commit:** `34d027f`
**Application:** `hala-clean-commercial-engine` · **Live app:** `http://localhost:5300` (restarted from the audited commit before inspection)
**Inspector:** Fable, orchestrating seven independent read-only lanes + 25 adversarial verifications + one completeness critic (33 agents, 0 errors)
**Model disclosure:** every agent was dispatched with **no model override** and therefore inherits the session model, which the architect set to `claude-opus-5` before this audit. That inheritance is the only model identity the orchestrator can verify.
**Write discipline:** no application code, schema, migration, configuration or record was changed by this audit. Every database call was a PostgREST `GET`/`HEAD` with the anon key. `git status --porcelain` was empty before and after all lanes (this report is the only file added).

---

## FINAL VERDICT

> **FAIL**
> A tested behavior is broken: **the bot cannot be saved.** In the running application, "Create Bot" never completes — the button enters "Writing…" and stays there indefinitely, no record is created, and no error is ever shown. Because save fails, reload / edit / duplicate / isolation could not be exercised at all.

**Full evidence, mechanism and scope are in the EXECUTED UAT section at the end of this report.** The verdict is about the running application, not the source contracts: the storage code audited below is correct in source and its tests pass — but the shipped build does not persist a bot through the UI, and it fails silently.

*(Historical note: the two earlier verdict sections below recorded BLOCKED while no authenticated session was available. The architect signed in on 2026-08-19 and the UAT was then executed; that execution supersedes them.)*

### Superseded first attempt — why it was BLOCKED at the time

**Exactly what prevented it:** the browser functional UAT (lane 2) requires an authenticated session, and **no session existed at that point**. `http://localhost:5300/system/bot-builder` renders the clean sign-in gate ("Clean application — sign in to your account"), verified three times during this audit at 09:5x, 10:2x and after the lanes completed. The inspector is not permitted to enter credentials into any application, so **no UAT bot was created, no knowledge text was pasted, and save / reload / edit / duplicate were never exercised in the running application.** A secondary environment limitation: the Browser pane is not displayed, so `computer{action:"screenshot"}` fails with "the page is not compositing frames" — screenshot capture is unavailable until the pane is visible.

**Nothing in this audit contradicts the correction's core claim.** The storage layer is sound in source and its contracts are test-guarded. But the architect's PASS wording requires proof "through save, reload, edit and duplicate", and that proof is browser evidence this audit could not obtain. **No live record in the database carries any bot knowledge** (0 of 39 version rows), so the end-to-end path has never been exercised with real data by anyone. Reporting PASS on source reading alone would be exactly the substitution this programme exists to prevent.

**To convert BLOCKED → PASS:** sign in at `localhost:5300`, display the Browser pane, and the prepared UAT (create `UAT - BOT OWNED KNOWLEDGE - 2026-08-19`, paste `HALA-UAT-KNOWLEDGE-819: Refrigerated transport requires temperature evidence.`, save → reload → edit → reload → duplicate → cross-check an unrelated bot → delete by exact captured id) is minutes of work. The live database currently contains **zero** bots matching `*UAT*`, so the starting state is clean.

---

## THE SEPARATE QUESTION THE ARCHITECT REQUIRED — ANSWERED WITHOUT CONFLATION

> **Can a live bot currently invoke an AI provider and demonstrably use this knowledge in a real response?**
> **NO. With certainty.**

Storage working is not invocation working, and this correction delivers storage plus string concatenation only. Evidence:

- Every generation entry point throws. `src/lib/ai-runs.ts:35-36` defines `AI_UNAVAILABLE = "AI generation is not available in this build (deferred to Sprint X — SX-001/SX-011)."`, thrown unconditionally at `ai-runs.ts:456` (`generateBlockContent`), `:468` (`generateDocumentContent`), `:554` (`generateAllBlocksSequentially`); `createAIRun`/`applyAIRun`/`discardAIRun` throw `AI_RUN_UNAVAILABLE` at `:157/:163/:169`; `DepartmentalReviewTab.tsx:376` and `FinalApprovedStage.tsx:421` call local `generateAIUnavailable()` throwers; `final-pack-bot-runtime.ts:68-89` returns `status:"error"` unconditionally.
- No client exists to invoke: no `ai-client.ts`, no `supabase/functions` directory, no OpenAI/Anthropic/Google SDK in `package.json`, and a repo-wide search for `chat/completions`, `:generateContent`, `/v1/messages` returns **zero** endpoint hits.
- The furthest an assembled prompt travels at runtime is a `.length` read for a `console.info` and a guard.

This is a **declared capability boundary**, honestly surfaced to users — not a hidden failure. But any statement that this commit lets bots "use their knowledge in responses" would be false.

---

## WHAT THE AUDIT CONFIRMED (the correction's core holds)

| Architect question | Result | Key evidence |
|---|---|---|
| Admin has no separate Knowledgebase page | **CONFIRMED** | `grep -niE "knowledg" src/pages/Admin.tsx` → **zero hits** (was 16 at `34d027f`, incl. `TabsTrigger value="knowledgebase"` and `KnowledgebaseEmbed`). No knowledgebase route in `CleanApp.tsx:85-122`; no nav entry in `config/nav.ts:72-79`. |
| Global `kb_collections` unused by the clean runtime | **CONFIRMED** | Repo-wide search for `kb_collections\|kb_documents\|kb_chunks\|bot_kb_links` returns **exactly one line** — a comment at `bot-admin.ts:13`. Zero live reads, zero tests, zero fixtures. An unrestricted sweep of `src/pages` + `src/components` for "collection" returns **zero** lines. |
| Each bot version owns `knowledge_base_text` | **CONFIRMED** | Projection `ops-runtime.ts:798`; type `:822`; mapper `:846`; written on create (`bot-admin.ts:467` via `buildVersionPayload`), publish (same builder, `:722`) and duplicate (`:904`). Live column verified with a **control experiment**: correct name → HTTP 200 with a row; misspelled name → HTTP 400 `42703` whose hint names the real column. |
| Save / publish / duplicate preserve the bot's own knowledge | **CONFIRMED** | All three paths carry the field; all three repoint `current_version_id`; nothing writes knowledge to `ai_bots`. The highest-risk item (duplicate relying on a column list) is clean on **both** halves — explicit write key and `AI_BOT_VERSIONS_COLUMNS` contains the column. The critic additionally verified the duplicate path's **error and empty branches** (`bot-admin.ts:814-830`, `:879-888`): a failed read aborts with a reason and is never rendered as an empty knowledge base. |
| Read-back confirmation covers the knowledge field | **CONFIRMED (re-verified from the function, not its test)** | `bot-admin.ts:285-287` derives BOTH the projection and the comparison set from the payload keys, so `knowledge_base_text` is structurally guaranteed to be compared; `:256-258` makes an absent column mismatch → **failure**, never false success. Only `created_at`/`updated_at` are excluded (`:271`). |
| Runtime preparation uses that bot's knowledge text | **CONFIRMED (static)** | Three assembly sites read the resolved version row of the same bot and append `Knowledge Base:\n…` — `ai-runs.ts:266-268`, `:328-330`, `:417`. **No cross-contamination path found**: a bot's prompt only ever receives its own row's knowledge. Confirmed by code reading, **not** by execution (see BLOCKED). |
| No hard-coded legal / compliance / fabricated knowledge added | **CONFIRMED** | Every added string literal in the 140-insertion diff inspected: **zero** legal, compliance, regulatory, seed, demo or default knowledge content. The textarea ships with **no default value**. The diff is net-deleting (140 in / 1,319 out). |
| No collection picker remains in Bot Builder | **CONFIRMED** | Picker, `attachKnowledge`/`detachKnowledge`/`readKnowledgeCollections` imports and the three-state collection read are removed; replaced by a plain editable textarea (`BotBuilder.tsx:983`). |
| No old-app source or runtime dependency introduced | **CONFIRMED** | Zero executable references to `hala-commercial-engine`, `localhost:3001`, `api-client`, `bot-governance`. Built `dist/` contains **0** case-sensitive hits for all four patterns (the 9 case-insensitive `knowledgebase` hits are all the camelCase `knowledgeBaseText`). |
| Tender Workspace source documents not confused with bot knowledge | **CONFIRMED** | The tender knowledge package (`TenderKnowledgeBasePanel.tsx`, `TenderKnowledgeBaseSection.tsx`, `tender-knowledge-base.ts`) reads no `kb_*` table and was untouched by the correction. The two stores remain separate. |
| Correction document's claimed gates | **CONFIRMED — all four match exactly** | Re-run independently: `pnpm check` exit 0 · focused tests **111 passed** · full suite **692 passed / 49 files** · build exit 0, **2,496 modules**. `git status` clean and HEAD = `3e38c68` throughout, so those numbers describe the tagged artifact, not a dirty tree. |
| Old collection system disconnected, not silently presented | **CONFIRMED in the application** — **but see Finding 1 for the documentation layer** | No rendered string anywhere in the UI mentions collections. |

**20 of 25 defect claims were killed by adversarial refutation** — including every claim that the write path drops, mis-copies or falsely confirms knowledge. Notably refuted: "whitespace-only knowledge produces a bare heading" (the write path collapses whitespace to `null` at `BotBuilder.tsx:266` before persistence) and "duplicate resolves a stale version" (structurally possible only after a partial publish; no live record can exhibit it).

---

## FINDINGS THAT SURVIVED ADVERSARIAL REFUTATION

**None of these breaks save / reload / edit / duplicate.** They are honesty, coverage and resolution issues, listed most consequential first.

### 1. `docs/FUNCTIONAL-CLOSURE-HUMAN-UAT-REPORT-2026-08-19.md:43` — a same-day sign-off report still advertises the removed Admin Knowledgebase surface (**major**)
Found independently by two lanes; both survived refutation. The repo ships two documents dated 2026-08-19 that contradict each other. Under the present-tense heading "Real data contracts verified", lines 43-44 state "Knowledgebase: 4 collections, 8 active documents, 9 chunks read from the real collection/document relationship", and lines 90-91 call it "the real embedded read surface". That surface no longer exists — the correction commit did not touch this report (it is not among the 13 changed files). A human reading `docs/` to sign off would believe the build has a capability it does not have. **This is the "disconnected but still advertised" condition the architect asked about, occurring at the documentation layer rather than in the UI.**

### 2. `src/lib/ai-runs.ts:305` + `:314` — the governed workflow resolves *which bot* by "most recently updated", and today's winner has no version rows (**major; pre-existing resolver, newly load-bearing**)
Verified independently by me against the live database. `loadGovernedBot` selects **all** active action bots for a domain ordered `updated_at desc` and takes `bots[0]`. Live probe using the identical filters and ordering:

```
[0] <== WINS   Tender TOC & Block Builder      updated_at 2026-06-22  current_version_id=null  versions=0
[1]            Tender Proposal Section Writer  updated_at 2026-05-29  current_version_id=d33116be…  versions=1
```

The winner has **zero** version rows, so `latestVersion` is undefined, the new knowledge branch at `:328` is falsy, and no bot-owned knowledge can reach that path at all — while the only tenders bot that *has* a version loses. Worse, the ordering key is written by five ordinary Bot Builder operations (`bot-admin.ts:545` archive, `:555` activate, `:593` create, `:711` publish, `:869` duplicate), so which bot's knowledge the tenders workflow would use changes whenever *any* bot sharing that domain is touched.

**Attribution, stated precisely:** I verified with `git diff 34d027f 3e38c68 -- src/lib/ai-runs.ts` that this resolver — the ordering, the `bots[0]` pick and the fallback prompt — is **pre-existing and was not introduced by the audited commit**. The correction's only change here was adding the knowledge line to `systemParts`. It is reported because the correction newly routes knowledge through this resolver, making a latent weakness load-bearing for the feature being audited.

### 3. `src/lib/ai-runs.ts:332` — a hardcoded generic prompt presents an unconfigured bot as a working one (**minor; pre-existing**)
When the selected bot has no version row (the live case above), `systemParts` is empty and the code falls through to the literal `"You are a helpful commercial assistant for Hala Supply Chain Services."`, returning `enabled: true`. Because a non-empty array comes back, the operator warning at `ProposalBlockWorkbenchTab.tsx:593-594` never fires. The sibling loader handling the identical condition does the opposite — `ai-runs.ts:252` logs "has NO PUBLISHED VERSIONS" and returns null.

### 4. `src/lib/ai-runs.ts:274` + `DepartmentalReviewTab.tsx:369` — knowledge text now inflates the "no system prompt" guard (**minor; introduced by this commit**)
The `< 50 chars` guard measures a `systemPrompt` that now includes the knowledge segment. A bot with `system_instruction = null`, `custom_instruction = null` and 800 characters of knowledge yields a 813-character prompt, so neither guard fires and the operator never sees "Bot … has NO system prompt … Update the Custom Instruction in Bot Builder". Before this commit the same bot produced a 0-character prompt and both guards fired. The `console.info` at `:272` compounds it by reporting "combined prompt length: 813" without naming knowledge as the source. Confirmed against the parent commit; no validation elsewhere requires an instruction.

### 5. `src/lib/ai-runs.ts:266/:328/:417` — the correction's headline behaviour has zero test coverage (**minor**)
There is no `src/lib/ai-runs.test.ts` at either commit, and no test anywhere asserts the `Knowledge Base:` heading, the version-selection rule or the null branch. `bot-admin.test.ts` covers only the write payloads; `ops-runtime.reads.test.ts:322` asserts only the **null** case of the mapper. A future edit could silently drop the knowledge segment — the doc's own central claim ("Governed bot loading adds the version's knowledge text to the bot prompt") — with every test still green.

### 6. `src/lib/ai-runs.ts:328` — the knowledge-bearing prompt is discarded by 100% of its callers (**minor**)
`loadGovernedBot` composes the prompt into `EditorBot.system_prompt`, but both consumers keep only `bots[0].id` (`ProposalArchitectureTOCTab.tsx:345`, `ProposalBlockWorkbenchTab.tsx:597`), and `generateBlockContent`'s signature (`ai-runs.ts:445-453`) has no slot for a system prompt or bot config. So even if the Sprint X refusal were removed tomorrow, that assembly's output still could not reach a model without a signature change.

---

## EVIDENCE GAPS RECORDED HONESTLY (not defects)

- **Zero live data behind the feature.** `knowledge_base_text` is NULL in **39 of 39** anon-visible version rows (verified by a complementary `is.null` / `not.is.null` pair summing to 39 / 0). The newest version row predates the migration by two months. Expected for a nullable column added days ago — but it means nothing in the live database demonstrates the feature end to end.
- **`kb_*` preservation is unobservable from this vantage.** All four `kb_*` tables return HTTP 200 with zero rows to anon. PostgREST cannot distinguish "genuinely empty" from "RLS-hidden", and catalogue introspection is blocked (`PGRST205`). The correction's "records were not deleted or altered" is a scope-of-change statement (no `kb_*` DDL/DML exists in the commit — verified), not an inventory claim.
- **`knowledge_base_ids` is not "cleared" retroactively.** New rows are inserted with `[]`; existing rows are never updated. No live row has ever been written since the correction, so that code has not yet executed against real data.
- **RLS behaviour on an authenticated INSERT is untested.** Proving live persistence requires a write, which every lane was forbidden to perform.

---

## WHAT THIS AUDIT DOES NOT CLAIM

1. It does **not** claim the AI bot runtime is functional. It is not — see the invocation answer above.
2. It does **not** claim save/reload/edit/duplicate work in the running application. That is exactly what BLOCKED covers.
3. It does **not** claim the `kb_*` records still exist or were preserved.
4. Green gates (tsc, 692 tests, 2,496-module build) mean the build compiles, the tests pass and the correction document's numbers are honest. They do not mean the correction is architecturally complete.

---

## RECOMMENDED SEQUENCE (architect's decision; no repairs were made)

1. Sign in and run the prepared browser UAT to lift BLOCKED.
2. Reconcile `FUNCTIONAL-CLOSURE-HUMAN-UAT-REPORT-2026-08-19.md` with the correction (Finding 1) — it is the document a sign-off reader trusts most.
3. Decide on Finding 2: whether the governed workflow should resolve a bot deterministically rather than by "most recently touched", given the live winner carries no version.

*Audit method: 7 read-only lanes → 25 adversarial refutations (each verifier instructed to default to "refuted") → 1 completeness critic that re-verified the three weakest CONFIRMED checks and found the resolution gap every lane missed. The orchestrator independently re-verified the critic's major finding against the live database before publishing it.*

---

## ADDENDUM — SECOND UAT ATTEMPT, 2026-08-19 (verdict unchanged: BLOCKED)

The architect reported being signed in at `localhost:5300` and authorised the browser UAT only (no further agents, no source re-audit, no repairs). The UAT **still could not start**. Verdict remains **BLOCKED**; no PASS or FAIL can be issued, because not one of save / reload / edit / duplicate was exercised. Diagnosis performed, in order:

1. **In-app Browser pane — no session.** `localStorage`, `sessionStorage` and `document.cookie` on `http://localhost:5300` are **all empty** (`lsKeys: []`, `ssKeys: []`, `cookies: 0`); the SPA sits at `/login`. Re-checked four times over ~4 minutes; unchanged. No sign-in has occurred in this surface.
2. **Connected Chrome "Browser 1" cannot reach this host.** With the architect's explicit selection (browser-choice question asked and answered, per protocol), `http://localhost:5300`, `http://[::1]:5300`, `http://127.0.0.1:5301` and `http://localhost:5301` **all render Chrome error pages**. Since the clean server binds `0.0.0.0:5301` and would answer any request originating on this machine, this is conclusive: **the browser reported `isLocal:true` is not on this host** — the same false-local condition recorded in the Wave 06 drift register. Nothing was typed into it, no credentials were entered, and it was left on an error page.
3. **The pane cannot be signed into while hidden.** `computer{action:"screenshot"}` fails with "the Browser pane is not displayed, so the page is not compositing frames"; fronting the tab (`tabs_select`) did not change this. The pane must be **made visible in the application UI** before anyone can sign in through it.

**The single remaining blocker:** display the in-app Browser pane, sign in there (it is the only surface that can reach this dev server), and the prepared UAT runs unchanged. The live database still contains **zero** bots matching `*UAT*` and **zero** version rows carrying knowledge text, so the starting state remains clean and nothing from these attempts was written.

---

## EXECUTED UAT — 2026-08-19, authenticated · **VERDICT: FAIL**

The architect signed in as **Amin Al-Rashid (admin, amin@halascs.com)** in the in-app Browser pane. Session verified live (`hala-clean-auth` present, token valid ~50 min remaining, `/dashboard` rendering). The UAT was then executed against the audited commit `3e38c68` served on `localhost:5300`.

### What failed

**Step 1 of the UAT — save the bot — never completes.** Clicking **Create Bot** switches the button to "Writing…" and it remains there permanently. Observed for **75+ seconds** on the final attempt and reproduced **4 times**, including twice within ~25 seconds of a fresh full page load.

| Observation | Measurement |
|---|---|
| Button state after click | "Writing…" — never returns to idle, on any attempt |
| Error shown to the user | **None.** No toast, no inline message, no console error (`read_console_messages` shows only Vite HMR lines) |
| Supabase requests issued after the click | **ZERO** — measured with the Performance Resource Timing API, which records every request regardless of which `fetch` reference the client captured |
| Web Locks state during the hang | `{held: [], pending: []}` — not a lock deadlock |
| Record created | **None.** `ai_bots` contains no row matching `*UAT*`; `ai_bot_versions` still holds exactly 39 rows, **0** with knowledge text |

The write therefore stalls **before it reaches the network**, and the UI reports nothing.

### What this is NOT

- **Not a dead client or a down app.** On the very same page instances, the app's own reads completed normally: `users` (474 ms / 767 ms), `ai_bots` (221 ms), `ai_providers` (208 ms). `/system/bots` rendered "39 bots recorded active, 40 bot records read".
- **Not a network or DNS problem.** A raw `fetch` to the Supabase REST endpoint from the same page returned in **285 ms**.
- **Not a session problem.** Access token valid, refresh token present, profile reads authorised.
- **Not attributable to the knowledge-storage code.** The source audit (below) confirms `knowledge_base_text` is written on all three paths, read back and compared before success, and carried by the shared projection constant; 692 tests pass. The defect is that the running application never gets as far as issuing the insert.

### Consequences for the requested test steps

| UAT step | Result |
|---|---|
| Create the temporary bot + paste `HALA-UAT-KNOWLEDGE-819…` | **Executed** — form accepted the text; character counter and Bot Summary both read exactly **77 characters** |
| Save the bot | **FAIL — never completes, no record, no error** |
| Reload and confirm text persists | **NOT TESTED** — blocked by the save failure |
| Edit the text, save, reload, confirm | **NOT TESTED** |
| Duplicate and confirm the copy carries the knowledge | **NOT TESTED** |
| Confirm an unrelated bot does not receive the knowledge | **NOT TESTED** |
| Remove temporary records | **NOTHING TO REMOVE** — verified by live probe: zero `*UAT*` bots, `ai_bot_versions` unchanged at 39 rows. No residue was created by any attempt. |

### Product-quality finding independent of the root cause

Whatever wedges the write, the UI's behaviour is itself a defect: **an indefinite spinner with no timeout, no failure message and no recovery.** The user is given no way to distinguish "still saving" from "will never save". This is the same class the programme's honesty contract targets from the other direction — that contract forbids claiming success without confirmation, and this build also never reports *failure*.

### Recommended next diagnostic (not performed — no repairs were authorised)

Reproduce against a **production build** (`pnpm build && pnpm preview`) rather than the Vite dev server, to establish whether the stall is a dev-runtime artifact or ships in the built application. That single comparison decides whether this is a release blocker or an environment quirk. No source change is needed to run it.

### Evidence discipline

Screenshots were captured at each step (sign-in state, populated form, 77-character counter, Bot Summary, and the persistent "Writing…" state). No application code, schema, migration or configuration was modified during the UAT; the only repository change remains this report. Working tree at `3e38c68`, tag `bot-owned-knowledge-base-complete`.
