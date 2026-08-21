# TCW-T5-REGISTERS-DOCS lane report (verbatim)

> Extracted verbatim from the lane agent's final report.

All changed files are in-grant and the tree is clean. Final report follows.

---

# TCW-T5-REGISTERS-DOCS — Lane Report

**Worktree** `.tcw-trees/t5-registers`, branch `tcw/t5-registers`, baseline `4c2e423` (integration tip, T1+T2 accepted). Five commits, `aefbaa6..c3e8624`, all prefixed `TCW-T5:`. Working tree clean. I do not declare this integrated — Fable verifies.

## Gates (numbers I actually saw)
- `pnpm check`: **0 errors** (clean on baseline entry and after every slice)
- FULL `pnpm vitest run`: **855 passed / 58 files** (baseline 805/55 → **+50 tests / +3 files**), 0 failures on every run
- `pnpm build`: **2,493 modules transformed**, built successfully (matches entry gate)
- Observed pre-existing flake (NOT mine, no code change): the full-suite run intermittently reports 1 unhandled `processTimers` error "originated in src/lib/final-pack-fidelity.test.ts" (2 of 4 runs; a 3rd full run was completely clean with 0 errors; the file alone always passes). Cause by inspection: `openPrintablePdf` in `final-pack-export.ts` schedules `setTimeout(trigger, 800)` which can fire after worker teardown. Both files are outside my grant — recorded, untouched.

## Files touched (exact, all in-grant)
1. `src/components/tender/TenderPlaceholdersTab.tsx` — rebuilt; also hosts the shared register foundation (see gap G1)
2. `src/components/tender/TenderRequiredDocumentsTab.tsx` — rebuilt
3. `src/components/tender/TenderComplianceMatrixTab.tsx` — rebuilt
4. `src/components/tender/TenderSubmissionGatesTab.tsx` — honesty edit, stays unrouted
5. `src/components/tender/TenderDocumentModal.tsx` — chain honesty
6. `src/components/tender/TenderDocumentsLibrary.tsx` — download-failure surfacing
7. `src/components/tender/TenderSplitPackGenerator.tsx` — left-behind header comment only
8. `src/components/tender/TenderSubmissionEmailReview.tsx` — left-behind header comment only
9. NEW `src/components/tender/submission-readiness-tabs.test.tsx` (33 tests)
10. NEW `src/components/tender/tender-documents-chain.test.tsx` (11 tests)
11. NEW `src/lib/final-pack-tender-mapping.test.ts` (6 tests; placed beside the lib modules it pins)

Granted but deliberately untouched: `TenderDocumentDrawer.tsx` (verified; it already surfaces download failures via try/catch — no in-grant defect found), `TenderStageTaskShell.tsx` (pure re-export shim of the forbidden Proposal-shared shell — nothing to change). `PdfStudio.tsx` read+tested only. No file outside the grant was modified (diff vs baseline confirms exactly the 11 files above).

## 1. Register tab capabilities (exact)
All three tabs keep T2's dispatched signature `{ ws, tenderId, reload }` (TenderWorkspace.tsx:2067-2069) and are advisory-only — zero gating language.
- **Load**: each tab performs its OWN confirmed read of the canonical row via `readTenderSourceAggregate(createSupabaseTenderSourceRecordStore(supabase), tenderId)` → honest three-state view: loading spinner / failed-with-real-reason + Retry ("read failure, not an empty register") / loaded. Loaded-empty renders "No X recorded yet — add the first."
- **CRUD**: Add / Edit / Remove build the next full section from the RAW stored rows (never the normalized view — malformed siblings are byte-preserved) and call `updateTenderSubmissionReadinessData(tenderId, section, rows, { expectedRevision, reason })`. Edited rows get their `updated_at`/`updated_by` stamps cleared so the write layer re-stamps the true session actor. A `sectionCrudBlocker` pre-flight surfaces the write layer's own refusal reason when ALREADY-stored rows fail the contract (CRUD disabled with the reason shown; per-row status changes stay available).
- **Per-row status**: raw canonical statuses incl. `na` via a per-row Select → `updatePlaceholderStatus` / `updateRequiredDocStatus` / `updateComplianceStatus` with the exact row id, the section's name field, previous status, and `{ expectedRevision }`. Bare status changes pass `undefined` for value/evidence so stored values are never clobbered.
- **Outcomes**: green only after the action layer's read-back-confirmed success; `saved_with_audit_warning` → amber warning toast with the real reason; `stale` → warning toast "nothing was overwritten… Your entry is preserved", dialog stays open with the user's entry, register+token silently refreshed for retry; failure → error toast with the service's real reason. After a confirmed save: tab-local register refresh + `reload()` for the shell meters.
- **Section extras**: required-docs rows support `linked_document_id` selected from `ws.documents` (exact-id linking; FULL document-name display; a set-but-unresolvable id renders "Linked document not found (id …)" — never first-word fuzzy) plus `due_date`; compliance rows support `evidence` + `source_reference`; placeholders support `value`.
- **B20 removed**: the false "Status changes persist to Supabase" copy and the static green "Supabase-Backed" pill are gone; replaced with "Saves are confirmed against the stored register before success is shown" (pinned by test).

**expectedRevision adaptation (report, not a deviation from P2 semantics)**: the tasking said thread `ws.revisionToken`, but neither the `TenderWorkspace` type nor T2's props carry the bundle's `revisionToken` (`bundleToTenderWorkspace` does not map it; TenderWorkspace.tsx:1589 doesn't destructure `bundle`). Without touching T1/T2 files, each tab threads the `updated_at` token from its own confirmed read of the same row — identical optimistic-guard semantics, tab-owned and refreshed after every save. Fable may prefer to pass the bundle at integration.

## 2. Gates tab (B19) — remains UNROUTED
`TenderSubmissionGatesTab.tsx` has zero importers (grep-verified; only removal comments in TenderWorkspace.tsx reference it). Kept unrouted per instruction; the FILE is now honest: "(Live from Supabase)" heading, "✓ All Clear" verdict, and the always-0/0 pack-derived rows (clean bundle loads no packs) are gone; counts derive from the register-backed workspace projections with "Not assessed" for empty sections ("'Not assessed' … is not a pass"), and the banner states plainly that the panel is an unreachable left-behind register entry and that no gate exists anywhere. `deriveGatesTabRows` exported + tested.

## 3. Documents chain — verification + in-grant fixes
Chain re-verified line-by-line: `uploadDocument` (document-vault.ts:392-399 storage upload, 406-430 `generated_documents` insert confirmed via `.select().single()`, both throw) → `addTenderDocument` → `updateTenderDocumentList` (supabase-tender-actions.ts:388-432: fresh aggregate read, guarded `saveTenderSourceRecord` on `type_details.documents`, zero-row = failure) → bundle read `documentsFromTenderRow` (supabase-tender-data.ts:736-741) → stage filtering `tenderDocumentMatchesStage`/`documentsForTenderStage` (tender-workspace-data.ts:375-385, incl. Tender/Proposal-Drafting aliasing) → `getSignedDownloadUrl` (document-vault.ts:341-344).

Defects found and fixed in-grant:
- **TenderDocumentModal**: a step-3 failure after steps 1-2 succeeded surfaced as generic "Document save failed", inviting a duplicate re-upload. Now `performDocumentUploadChain` (exported, injectable) reports it as `uploaded_not_linked` — the toast names the vault record id, the real reason, and warns "Do not upload the file again — that would store a duplicate copy"; dialog closes + reload so the true state shows. A step-3 THROW is reported the same way, not swallowed. `saved_with_audit_warning` now renders amber on both upload and metadata paths (was silently plain success). Metadata failure keeps the dialog open with the entry preserved.
- **TenderDocumentsLibrary**: `openDocument` had no try/catch — a signing-transport failure was an unhandled rejection (dead button). Now surfaces the real reason (drawer already did).

**Contract gap (reported, no fix possible in-grant)**: the T1-landed document writers `addTenderDocument(tenderId, document)` / `updateTenderDocumentMetadata(tenderId, documentId, patch)` / `changeTenderDocumentStatus(tenderId, documentId, status)` accept NO `expectedRevision`/opts parameter — threading the UI-read-time revision at my call sites is impossible without editing `supabase-tender-actions.ts` (T1's file). They self-guard with their own fresh-read token inside `updateTenderDocumentList`, so the store write is revision-guarded, but the UI-read→save stale window is not covered for documents. Noted in the modal's header comment.

## 4. Split-pack / email-review
Both confirmed dead (zero importers; T2 removed their only openers with orphan proof). One honest left-behind header comment each, marked "pending integration ruling"; zero functional investment; files not deleted.

## 5. FinalPack handoff + PDF — verification evidence (PdfStudio untouched)
- `loadTenderPack` (final-pack-loader.ts:340-511) reads `commercial_tickets` via the shared `TENDER_SOURCE_SELECT` projection, maps `tender_drafting.proposal_blocks` edited content (`content_html || editor_content || draft_content || content_text`) into intro/scope/closing blocks; missing sections → `not_captured` with no fabricated html.
- doc_instances persistence: `useFinalPackInstance.createInstance` explicit-id insert with 20s timeout; PdfStudio `saveBlocks` (lines 175-225) guarded update `.eq('updated_at', lastToken)` with zero-row honesty ("not confirmed saved") and non-destructive conflict advisory (Keep mine / Reload latest).
- Drift check hashes the SAME projection (`useSourceDrift` → `TENDER_SOURCE_SELECT` + `buildTenderSourceData` + `computeSourceHash`; "could not check" ≠ "no drift").
- Export renders the EDITED preview HTML client-side: `executeExport` → `buildPreviewHTML(req.blocks)` → native print, or html2pdf → jsPDF text fallback (final-pack-pdf.ts) for the imported-cover merge; `isServerPdfEnabled()` is false without `VITE_FPS_SERVER_PDF`, `tryServerFinalPdf` resolves null → client fallback. All pinned (mine + pre-existing fidelity suite).
- **Proposed diffs — NOT applied** (files not in grant):
  - `src/hooks/useFinalPackInstance.ts:231` — replace `created_by: "User"` with the P4 session actor: add `import { getCurrentUser } from "@/lib/auth-state";` and use `created_by: getCurrentUser().name || "Unauthenticated"`.
  - `src/pages/PdfStudio.tsx` (same defect class, lines 153, 730, 745, 778): `appUser?.email || appUser?.id || "User"` stamps presence, reusable blocks, templates and authoring with the literal "User" when signed out — same one-line replacement of the `"User"` fallback with the auth-state module's honest literal. No other PdfStudio defect found warranting a diff; the `onResetBlock` "first block as example" behavior (lines 522-528) is a documented UX shortcut, recorded as an observation only.

## Tests added (50) + guard proofs (2, lane-run)
- `submission-readiness-tabs.test.tsx` (33): three-state load projection (raw rows preserved verbatim for CRUD), outcome mapping (saved/amber/stale/failed), exact-id + name-field + expectedRevision threading for all three per-item ops and the section writer (recording stubs), row helpers + stamp clearing + CRUD pre-flight, exact-id linked-document matching with an explicit anti-fuzzy pin, status metadata incl. `na`, rendered-markup pins (loading state, failed-with-reason, empty add-first, B20 copy absent, advisory truth present), gates-tab derivation.
- `tender-documents-chain.test.tsx` (11): step-1/2 failure = nothing stored; step-3 failure/throw = uploaded-not-linked with vault id + duplicate warning (never saved); audit-warning amber; missing-reason honesty; metadata path.
- `final-pack-tender-mapping.test.ts` (6): edited proposal_blocks reach the mapped blocks (never library defaults), not_captured stays empty, hashed source_data carries `tender_drafting` (edits ARE drift-visible), server flag absent → `isServerPdfEnabled()` false + `tryServerFinalPdf` null.
- **GUARD 1**: made `describeTenderWriteOutcome` return `{kind:'saved'}` unconditionally (register save reports success without consulting the confirmed result) → **6 named tests failed**, incl. "GUARD: a failed ActionResult is a FAILURE outcome with the real reason — never saved" → restored, suite green.
- **GUARD 2**: made `performDocumentUploadChain` swallow the step-3 failure into success → **4 named tests failed**, incl. "GUARD: a step-3 failure after steps 1-2 succeeded is NEVER reported as saved" → restored, suite green.

## Gaps / items for Fable
- **G1**: the shared register foundation (hook, outcome mapper, row helpers, notices) lives inside `TenderPlaceholdersTab.tsx` and is imported by the other two tabs — kept there because the grant enumerates only the tab files (+ new tests). Trivial to extract to its own module at integration if preferred.
- **G2**: document writers' missing `expectedRevision` parameter (T1 contract gap above) — needs a T1-side signature change if the UI-read-time guard is wanted for documents.
- **G3**: `ws.revisionToken` does not exist (bundle-only) — register tabs self-read instead; T2/T1 could pass the bundle through if a single shared read is preferred.
- **G4**: pre-existing flaky teardown timer error in the full suite from final-pack-fidelity.test.ts (details under Gates) — out-of-grant.
- **G5**: `document-vault.uploadDocument` step-2 failure after step-1 leaves an orphaned storage object with a generic thrown message — document-vault.ts is out of grant; my modal reports whatever it throws honestly, but the vault-side message could name the orphan.
- Not verified (out of lane scope): live UAT against Supabase (no live writes performed by this lane; all verification is code-level + hermetic house-mock tests).
