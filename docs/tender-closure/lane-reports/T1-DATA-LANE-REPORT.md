# TCW-T1-DATA lane report (verbatim)

> Extracted verbatim from the lane agent's final report.

All work is committed and the tree is clean. Final report follows.

---

# TCW-T1-DATA — Lane Report

**Branch `tcw/t1-data`** (worktree `.tcw-trees/t1-data`, baseline `93799d3`), 7 commits `d6542fa..c181c9a`, all prefixed `TCW-T1:`. Working tree clean.

**Environment note for reproduction:** the fresh worktree lacked the untracked `.env`; without it 20 test files fail at import (`supabase.ts` startup throw). I copied `.env` from the main `hala-clean-commercial-engine` checkout (gitignored, not committed). Baseline gates were then reproduced exactly: tsc 0 · 692 tests / 49 files · build 2,496 modules.

## Files touched (exact, all within grant)

Modified: `src/lib/tender-source-record.ts` · `src/lib/supabase-tender-actions.ts` · `src/lib/supabase-tender-data.ts` · `src/lib/tender-stage-source-truth.ts` (only: `final_approved.storageFacets` + additive `submission_readiness` key in `projectTenderStageTruth`) · `src/lib/orchestration.ts` (only: `writeOrchestrationState` guard) · `src/lib/supabase-tender-actions.test.ts` · `src/lib/supabase-tender-data.test.ts`
New tests: `src/lib/tender-submission-readiness.test.ts` · `src/lib/tender-facet-writers.test.ts` · `src/lib/orchestration-write-guard.test.ts`

## What was built

**P1 — register storage + service.** New facet `type_details.submission_readiness` with sections `placeholders[]` / `required_documents[]` / `compliance_items[]`; row shapes exactly per pin (statuses: placeholder `pending|in_progress|approved|na`; required-doc `missing|in_progress|uploaded|approved|na`; compliance `pending|in_review|compliant|non_compliant|na`). Contract (types, normalizer, write validation) lives in `tender-source-record.ts` (grant allows no new non-test source files). Writes validate unique non-empty ids, name field, status union; sibling sections/rows/unknown keys are byte-preserved (the write patches the RAW stored facet — the read-side normalizer never round-trips into storage, so malformed legacy rows are never destroyed). All writes go through `saveTenderSourceRecord` (exact id + `updated_at` guard), are read-back compared against the confirmed stored row, and report zero-row as failure. Loader stubs replaced: registers are read from the confirmed header row itself (no new table, no independent failure mode); `loaded` flags are truthful (false + reason on every non-loaded path).

**P2a/P2b.** The 7 writers are patch-merge (`{...currentFacet, ...patch}`) with back-compat third arg. `expectedRevision` added to all section-merge writers. **P2c** orchestration guard with honest stale-vs-RLS classification on zero rows. **P2d** CRM round-trip refusal. **P3** audit appends awaited + confirmed (8s timeout race → honest reason); `_insertAuditEvent` + its 12 call sites deleted; pipe-format notes and stored row shape preserved; audit failure never blocks the primary. **P4** `updateBlockReviewStatus` reviewer defaults to session user; `actor()` signed-out fallback is auth-state's own literal `"Unauthenticated"`, never `"System"`. **F5** (in T1 grant scope) one `commercial_ticket_audit` query feeds both activity/audit projections. Mock-word row-hiding at the fetch layer: verified NOT present (grep), nothing to remove. `updateGateStatus`/`logMockBypass`/`logEmailSimulation`/`updatePackStatus`/`insertTenderPackOutput` remain disabled (left-behind register unchanged).

## New/changed signatures (exact TypeScript)

```ts
// supabase-tender-actions.ts
export interface ActionResult { success: boolean; error?: string; status?: TenderSaveStatus; auditWarning?: string; }
export interface TenderFacetWriteOpts { expectedRevision?: string; actorName?: string; reason?: string; }

// The 7 (patch-merge; 3rd arg accepts legacy reason string OR opts):
export async function updateTenderSowData(tenderId: string, patch: Record<string, any>, reasonOrOpts?: string | TenderFacetWriteOpts): Promise<ActionResult>
// identical shape: updateTenderCustomerFitData, updateTenderSowQualificationData, updateTenderTechnicalQualificationData,
//                  updateTenderRiskSnapshotData, updateTenderBidNoBidData, updateTenderSolutionDesignData

// P1:
export async function updateTenderSubmissionReadinessData(tenderId: string, section: SubmissionReadinessSectionKey, sectionRows: Array<Record<string, any>>, reasonOrOpts?: string | TenderFacetWriteOpts): Promise<ActionResult>
export async function updatePlaceholderStatus(tenderId: string, placeholderId: string, label: string, previousStatus: string, newStatus: string, newValue?: string, opts?: TenderFacetWriteOpts): Promise<ActionResult>
export async function updateRequiredDocStatus(tenderId: string, docId: string, docName: string, previousStatus: string, newStatus: string, opts?: TenderFacetWriteOpts): Promise<ActionResult>
export async function updateComplianceStatus(tenderId: string, itemId: string, requirement: string, previousStatus: string, newStatus: string, evidence?: string, opts?: TenderFacetWriteOpts): Promise<ActionResult>

// Section-merge writers gained a 5th param `expectedRevision?: string` (positional, matching updateTenderDraftingData):
// updateTenderPricingData, updateTenderApprovalMatrixData, updateTenderFinalApprovedData, updateTenderSubmissionData,
// updateTenderIdentifiedData, updateTenderClientEvaluationData, updateTenderClarificationData, updateTenderNegotiationData,
// updateTenderAwardedData, updateTenderLostWithdrawnData

export async function updateBlockReviewStatus(tenderId: string, blockId: string, department: "ops"|"finance"|"legal", status: "Pending"|"Approved"|"Rejected", comment: string, reviewerName?: string): Promise<ActionResult>

// tender-source-record.ts (new exports)
export const SUBMISSION_READINESS_FACET_KEY = 'submission_readiness';
export const SUBMISSION_READINESS_SECTION_KEYS = ['placeholders','required_documents','compliance_items'] as const;
export type SubmissionReadinessSectionKey = (typeof SUBMISSION_READINESS_SECTION_KEYS)[number];
export interface SubmissionReadinessPlaceholder extends JsonObject { id: string; label: string; status: SubmissionPlaceholderStatus; value?: string; owner?: string; notes?: string; updated_at: string; updated_by: string; }
export interface SubmissionReadinessRequiredDocument extends JsonObject { id: string; document_name: string; status: SubmissionRequiredDocumentStatus; linked_document_id?: string; owner?: string; due_date?: string; notes?: string; updated_at: string; updated_by: string; }
export interface SubmissionReadinessComplianceItem extends JsonObject { id: string; requirement: string; status: SubmissionComplianceStatus; evidence?: string; source_reference?: string; owner?: string; notes?: string; updated_at: string; updated_by: string; }
export interface SubmissionReadinessFacet extends JsonObject { placeholders: SubmissionReadinessPlaceholder[]; required_documents: SubmissionReadinessRequiredDocument[]; compliance_items: SubmissionReadinessComplianceItem[]; }
export function normalizeSubmissionReadinessFacet(value: unknown): SubmissionReadinessFacet
export function isSubmissionReadinessSectionKey(value: unknown): value is SubmissionReadinessSectionKey
export function isValidSubmissionReadinessStatus(section: SubmissionReadinessSectionKey, status: unknown): boolean
export function validateSubmissionReadinessRows(section: SubmissionReadinessSectionKey, rows: unknown): string | null

// supabase-tender-data.ts (bundle additions)
export interface TenderSubmissionReadinessRead { loaded: boolean; error?: string; facet: SubmissionReadinessFacet; }
// TenderWorkspaceBundle gains: submissionReadiness: TenderSubmissionReadinessRead; revisionToken: string | null;
```

## Consumer contract (T2 / T3 / T5)

- **Revision threading (T3 + T5 + T4):** read `bundle.revisionToken` (verbatim `updated_at`; `tender.updatedAt` is date-sliced — never a token) at load; pass it as `expectedRevision` (opts object on the 7 + item ops; 5th positional arg on section writers). `result.status === 'stale'` → non-destructive retry UX (entry preserved, message in `result.error`). `result.status === 'saved_with_audit_warning'` → amber "Saved — audit entry not recorded: `result.auditWarning`" (still `success:true`). Omitting `expectedRevision` keeps today's in-call-token behaviour (back-compat until T3 lands).
- **Patch-merge (T3):** send ONLY your tab's keys — semantics apply immediately even via legacy string calls. Solution design keys: `configuration|hop|ham|hip|scope_matrix|sla_kpi|assumptions_dependencies`; bid/no-bid: `decision+decision_checklist+recommendation | win_strategy | resource_commitment | decision_record`; the 5 single-tab facets send their full key set.
- **Registers (T5):** consume `bundle.submissionReadiness.facet` (raw canonical rows, exact statuses incl. `na`); full-row CRUD via `updateTenderSubmissionReadinessData`; per-item status via the three ops using the register row `id` verbatim. The legacy `bundle.placeholders/requiredDocuments/complianceItems` arrays are a documented LOSSY projection (mapped ids are the register ids; checklist `na`→`approved`; compliance `pending/in_review/na`→`not_reviewed` — verdicts never fabricated) kept only so existing renderers compile.
- **Progress (T2):** `buildRequiredDocumentsProgress` (NOT edited — T2's file) works as-is with `bundle.requiredDocuments` + `requiredDocumentsAssessed` (now true on loaded rows; empty set hits its honest "nothing recorded" branch; name matching is full-name containment). For linked-id matching per P1, T2 must extend its input to accept uploaded document ids and read `linked_document_id` from `bundle.submissionReadiness.facet.required_documents` — data is exposed; the input-shape change is T2-side.
- **Drawer/counters (T2/T4):** `activityEvents` and `auditEntries` are two projections of ONE deduplicated feed — count one, never the sum.
- **Stage truth (T4 drawer):** `stageData.final_approved.submission_readiness` now exists (additive key; existing `final_approved` keys untouched).

## Gates (personally observed, on committed HEAD `c181c9a`)

- `pnpm check`: exit 0, no errors.
- `npx vitest run` (full): **748 passed / 52 files, 0 failed** (baseline 692 / 49 → +56 tests, +3 files). Per-file: actions 15→18, data 19→27, new suites 20+20+5.
- `pnpm build`: **2,496 modules transformed**, built (matches baseline count).
- 3 pre-existing data tests were updated truthfully because the semantics changed: the registers ARE now read from the loaded row, so `riskInputsAssessed`/`requiredDocumentsAssessed` become true on loaded bundles — while `riskLevel` stays `not_assessed` when nothing is recorded (empty register carries no verdict; green requires recorded rows with zero recorded gaps). This empty-register→`not_assessed` rule was my honesty call under P5 — flagging it explicitly for Fable review.

## Guard proofs (3 run, defect → named failure → restored → green)

1. **Sibling clobber:** removed `...rawFacet` spread in `persistSubmissionReadinessSection` → failed: "replaces ONE section, preserves sibling sections…" + "mutates ONLY the target row… preserves every sibling byte" (2 failures). Restored.
2. **Orchestration guard removal:** deleted `.eq("updated_at", revisionToken)` → failed: "the UPDATE carries the exact revision token…" + "a concurrent edit… honest stale error, NOT success, nothing overwritten" (silent last-write-wins reported success). Restored.
3. **First-row targeting:** item op mutated `index === 0` instead of exact id → failed: "mutates ONLY the target row…". Restored.

## Gaps left / NOT verified

- All verification is mock-level + tsc + build. **No live Supabase write was performed** — live behaviour of the `updated_at` predicate (trigger-updated vs client-set) and RLS outcomes are unverified by me; the P8 world-readable-RLS standing issue is untouched.
- `changeStage` (shared CRM kanban) untouched per P2d — its bare-id targeting risk stands, recorded here.
- The 8s audit-timeout path returns `saved_with_audit_warning` with "may or may not exist" — the honest ambiguity is by design; no test covers the timeout branch (would need fake timers against the race).
- Legacy activity-event params (`category`, `severity`, `actionLabel`, `metadata`) were dropped from the audit helper — they were never persisted (only title|description|Reason reached `notes`); stored row shape is unchanged, but any future consumer expecting those params must not assume they existed.
- UI rendering of the new statuses/warnings is T2/T3/T5 work; I did not touch or verify any component.
- I do not declare integration or completion — Fable reproduces the above before acceptance. (Reproduction prerequisite: copy `.env` into the worktree first.)
