# TENDER-DATA-CONTRACT-REGISTER (current-state, pre-correction)

> Extracted verbatim from the lane agent's final report.

All verification is complete. Here is the deliverable.

---

# TENDER DATA-CONTRACT REGISTER + SAVE/READ-BACK LEDGER (current-state) — TCW-MAP-DATA

Clean app: `C:\ANtigravity Apps\Hala App - Amin review\hala-clean-commercial-engine` @ `master` = `93799d3`, tag `tender-closure-start`. Old app used as read-only reference. All DB evidence below is from read-only PostgREST GET/HEAD probes with the clean app's anon key (never printed). Probes executed 2026-08-20/21.

**Headline correction to the briefing context:** the "6 live rows" premise is stale. Migration `supabase/migrations/202608190002_functional_closure_uat_cleanup.sql` (approved exact-id cleanup, 2026-08-19) deleted the 3 seed tenders and the seed proposal. Live anon-visible truth is **2 rows**: the Linde tender and the KAFD proposal. Per-id evidence in §6.

---

## §1 THE CANONICAL MODEL AS IMPLEMENTED

### 1.1 One physical store: `commercial_tickets` + `commercial_ticket_audit`

The "tender source-record store" is **not a separate table**. `createSupabaseTenderSourceRecordStore` (`src/lib/supabase-tender-source-record.ts:25-96`) binds the abstract `TenderSourceRecordStore` contract (`src/lib/tender-source-record.ts:66-75`) onto exactly two tables:

- `readActiveTender` — `from('commercial_tickets').select('*').eq('id', tenderId).eq('ticket_type','tender').eq('active', true).maybeSingle()` (supabase-tender-source-record.ts:28-38)
- `updateActiveTender` — same predicates **plus** `.eq('updated_at', args.expectedRevision)` (:40-66)
- `insertAudit` / `listAudit` — `commercial_ticket_audit` (:68-93)

The singleton is instantiated once: `const tenderSourceRecordStore = createSupabaseTenderSourceRecordStore(supabase);` (`src/lib/supabase-tender-actions.ts:59`).

### 1.2 Revision model

`revisionFrom(row)` → `{ token: row.updated_at, updatedAt: row.updated_at }` (`tender-source-record.ts:202-204`). The token is honest because the DB bumps it: trigger `trg_ct_updated_at` `BEFORE UPDATE ... NEW.updated_at = now()` (old-app migration `20260520_intake001_unified_lineage.sql:141-153` — the live schema's origin). There is no numeric revision column; `updated_at` **is** the optimistic token.

### 1.3 `commercial_tickets` columns the clean app touches

All confirmed live by select-projection control experiment (§6.4): `id, ticket_title, customer_name, customer_id, contact_name, contact_email, contact_phone, company, owner, team_members, region, industry, crm_pipeline_stage, internal_stage, estimated_value, target_gp_percent, probability_percent, target_date, notes, ticket_type, active, created_from_intake, source_type, source_reference, source_file, source_sheet, source_row_id, source_document_id, legacy_workspace_id, legacy_opportunity_id, legacy_tender_id, lineage_status, type_details, created_at, updated_at`. (`submission_deadline` is **not** a column — 42703; it lives in `type_details` or falls back to `target_date`, `tender-ticket-adapter.ts:53-64`.)

Tender writes are whitelisted to `MUTABLE_TENDER_COLUMNS` (`tender-source-record.ts:152-171`): `ticket_title, customer_name, customer_id, contact_name, contact_email, contact_phone, company, owner, team_members, region, industry, crm_pipeline_stage, internal_stage, estimated_value, target_gp_percent, probability_percent, target_date, notes`. Anything else → status `invalid_change` (:213-216, 297-306).

### 1.4 The `type_details` key map (who writes / who reads)

Merge semantics: `mergeTenderTypeDetails(current, patch)` is a **top-level shallow spread** `{ ...objectOrEmpty(current), ...patch }` (`tender-source-record.ts:224-226`) — a patched key is replaced wholesale, sibling keys preserved verbatim.

| type_details key | Writer (fn → file:line) | Reader |
|---|---|---|
| `identified.{intake_file_audit, document_review, compliance_matrix_notes, clarification_log}` | `updateTenderIdentifiedData` (supabase-tender-actions.ts:1121) via facet merge | `projectTenderStageTruth` (tender-stage-source-truth.ts:239-242); Identified tabs |
| `sow_data` (whole object) | `updateTenderSowData` (:595) | stage truth; `mapCommercialTicketToTender` (supabase-tender-data.ts:633); FinalPack `resolveScopeTable` (final-pack-loader.ts:721) |
| `customer_fit_data`, `sow_qualification_data`, `technical_qualification_data`, `risk_snapshot_data` | `updateTenderCustomerFitData` (:648), `updateTenderSowQualificationData` (:705), `updateTenderTechnicalQualificationData` (:760), `updateTenderRiskSnapshotData` (:818) — whole-object replace | qualification stage truth (tender-stage-source-truth.ts:243-248); workspace tabs |
| `bid_no_bid_data` | `updateTenderBidNoBidData` (:878) | stage truth :249 |
| `solution_design_data` | `updateTenderSolutionDesignData` (:935) | stage truth :250; FinalPack `resolveSlaMatrix` (final-pack-loader.ts:889-914) |
| `pricing.{cost_inputs, scenarios, pnl_snapshot, commercial_terms, approval}` | `updateTenderPricingData` (:987) — **section-level** merge via `mergeCanonicalTenderFacet` with `normalizeTenderPricingData` | stage truth :251; FinalPack `resolvePricing`/`resolveTotals` |
| `tender_drafting.{proposal_architecture, proposal_blocks, compliance_coverage, appendices_evidence, departmental_reviews, approval_matrix(legacy), final_approval_check}` | `updateTenderDraftingData` (:1024); `updateBlockReviewStatus` (:1474); `saveBlockAIFlags` (:1520); ComplianceCoverageTab.tsx:91; AppendicesEvidenceTab etc. | stage truth :252-257 (internal_review projects `proposal_blocks` + `departmental_reviews` out of drafting); FinalPack `resolveNarrative` (final-pack-loader.ts:660-719) |
| `approval_matrix` (top-level, with fallback to `tender_drafting.approval_matrix`) | `updateTenderApprovalMatrixData` (:1053) | stage truth :234-236, 258 |
| `final_approved` | `updateTenderFinalApprovedData` (:1071) | stage truth :259 |
| `submission` (legacy alias `submitted`) | `updateTenderSubmissionData` (:1093) | stage truth :260 (`details.submission ?? details.submitted`); alias normalizer `tender-type-details.ts:20` |
| `clarification.{qa_log, response, margin_impact, status}` | `updateTenderClarificationData` (:1172) | stage truth :261 |
| `client_evaluation.{request_log, client_clarifications, bafo, margin_impact, evaluation_status}` (+ legacy `technical_review`/`commercial_review` folded in) | `updateTenderClientEvaluationData` (:1144) | stage truth :262; legacy fold `tender-type-details.ts:25-46` |
| `negotiation_data` (alias `negotiation`) | `updateTenderNegotiationData` (:1197) | stage truth :263 |
| `awarded_data` (alias `awarded`) | `updateTenderAwardedData` (:1222) | stage truth :264 |
| `lost_withdrawn_data` (alias `lost_withdrawn`) | `updateTenderLostWithdrawnData` (:1243) | stage truth :265 |
| `documents` (array of TenderDocument objects) | `addTenderDocument`/`updateTenderDocumentMetadata`/`changeTenderDocumentStatus`/`markTenderDocumentSuperseded` (:1264-1340) via `updateTenderDocumentList` | `documentsFromTenderRow` (supabase-tender-data.ts:693-698); aggregate `.documents` (tender-source-record.ts:265) |
| `execution_regions, target_sites, execution_type, geographic_complexity, site_count, execution_notes` (six top-level keys) | `updateTenderExecutionScope` (:526) + column patch `{notes}` | `mapCommercialTicketToTender` (supabase-tender-data.ts:620-625) |
| `orchestration` | `writeOrchestrationState` (orchestration.ts:146-196) — **the only writer outside the guarded store** | `readOrchestrationState` (orchestration.ts:133-139); review UI |
| `extraction.evidence` | no clean-app writer found (read side only) | `evidenceFrom` → aggregate `.evidenceLinks` (tender-source-record.ts:193-196, 266) |
| `source`, `tender` (metadata), `linked_workspace_id` | no clean-app writer; read-only legacy fallbacks | supabase-tender-data.ts:618; final-pack-loader.ts:255-264; pipeline-tickets.ts:115-121 |

The 15-stage registry with per-stage `storageFacets` is declared in `TENDER_INTERNAL_STAGES` (`tender-stage-source-truth.ts:39-175`) — this is the codebase's own declaration of canonical storage per stage.

### 1.5 The aggregate

`buildTenderSourceAggregate` (`tender-source-record.ts:228-273`) projects one row into: `identity` (sourceRecordId/type/title/customer/owner), `processState` (internalStage, crmPipelineStage), `customerContext`, `stageData` (15-stage truth), `commercialData`, `documents`, `evidenceLinks`, `drafting`, `lifecycleMemory`, `audit[]`, `revision`, raw `typeDetails`. Identity is re-asserted: `isActiveTenderRow` requires `row.id === requestedId && row.ticket_type === 'tender' && row.active === true` (:198-200).

### 1.6 How the ACTIVE tender is identified per save path

- **Workspace saves:** route param `:id` — `const { id } = useParams<{ id: string }>()` (`src/pages/TenderWorkspace.tsx:1550`) — passed verbatim into every action (`updateTenderCrmStage(id!, …)` :1744, `updateTenderPhase(id!, …)` :2337, all tabs get `tenderId={id!}`). The store then re-filters `id + ticket_type='tender' + active=true` and returns `not_found`/`invalid_identity` otherwise (`tender-source-record.ts:321-338`).
- **Load identity guard:** `useTenderWorkspaceData` refuses to hand out a bundle loaded for a different id (`src/hooks/useTenderWorkspaceData.ts:57-65`), and the read layer errors on identity mismatch (`supabase-tender-data.ts:677-681`).
- **Kanban stage move:** `changeStage(dragTicketId, …)` uses the dragged card's id with **only** `.eq('id', ticketId)` — no `ticket_type`/`active` predicate (`intake-save.ts:313-317`).
- **FinalPack:** route `/tenders/:tenderId/final-pack` (`PdfStudio.tsx:5,83`); loader reads by exact id with **no** ticket_type/active filter (`final-pack-loader.ts:349-353`).
- **Process isolation (read side only):** `mayTenderIdBeAllowed` rejects only the 3 exact legacy seed ids pre-fetch; `isAllowedTenderTicket` admits Linde by exact id, `created_from_intake===true` rows, and Linde name-aliases (`src/lib/process-isolation.ts:261-282`). No write path consults the allowlist.

### 1.7 Save discipline (the contract every guarded write inherits)

`saveTenderSourceRecord` (`tender-source-record.ts:286-451`): validate columns → read active row → status `not_found`/`invalid_identity` → pre-compare `expectedRevision` (caller-supplied or the just-read token) → guarded UPDATE with `.eq('updated_at', expectedRevision)` → **zero-row is never success**: the store disambiguates post-hoc — re-read; row gone → `not_found`; token moved → `stale` (with current row); else `failed` with `'Tender save affected no row. The entered values remain available for retry.'` (`supabase-tender-source-record.ts:55-65`). Result statuses: `saved | saved_with_audit_warning | stale | not_found | invalid_identity | invalid_change | failed` (`tender-source-record.ts:15-22`). This satisfies the RLS caveat in the briefing: an RLS-suppressed UPDATE (200, zero rows) is reported as failure, not success.

---

## §2 EVERY EXISTING TENDER WRITE PATH

Legend — **Rev guard**: U = `.eq('updated_at', token)` via store; U+T = caller passes a UI-read-time token; RB = read-back verify only; none. **Sibling-safe**: does the write preserve unrelated `type_details` keys. **Audit**: BE = best-effort fire-and-forget (`runBestEffortAuditWrite`, swallowed); C = confirmed.

| # | Function (supabase-tender-actions.ts unless noted) | Writes | Targeting | Rev guard | Sibling-safe | Read-back / success meaning | Actor | Audit |
|---|---|---|---|---|---|---|---|---|
| 1 | `updateTenderPhase` :346 | col `internal_stage` (validated `isTenderInternalStageKey` :352) | :id | U (in-call token) | yes (column only) | store row returned; success = ticket moved only | `getCurrentUser()` | BE |
| 2 | `updateTenderCrmStage` :395 | col `crm_pipeline_stage` — **no value validation, no restorability check** despite `isRestorableCrmPipelineStage` existing (supabase-tender-data.ts:446) | :id | U (in-call) | yes | store row returned | real user | BE |
| 3 | `updateTenderProbability` :437 | col `probability_percent` | :id | U (in-call) | yes | store row | real user | BE |
| 4 | `updateTenderTeamMembers` :479 | cols `owner`, `team_members` | :id | U (in-call) | yes | store row | real user | BE |
| 5 | `updateTenderExecutionScope` :526 | 6 top-level `type_details` keys + col `notes` | :id | U (in-call) | yes (shallow top-level merge) | store row | real user | BE |
| 6–12 | `updateTenderSowData` :595, `CustomerFit` :648, `SowQualification` :705, `TechnicalQualification` :760, `RiskSnapshot` :818, `BidNoBid` :878, `SolutionDesign` :935 | one `type_details.<facet>` **whole-object replace** | :id | U (in-call) | yes across facets; **no** within the facet (client sends full object) | store row | real user | BE |
| 13 | `updateTenderPricingData` :987 | `type_details.pricing.<section>` | :id | **U+T** (`aggregate.revision.token`, :232) | yes; pricing sections merged `{...currentFacet,[section]:data}` :236-239 | store row | real user | BE |
| 14 | `updateTenderDraftingData` :1024 | `tender_drafting.<section>` | :id | **U+T**, accepts explicit `expectedRevision` param :1029 | yes | store row | real user | BE |
| 15–23 | `ApprovalMatrix` :1053, `FinalApproved` :1071, `Submission` :1093, `Identified` :1121, `ClientEvaluation` :1144, `Clarification` :1172, `Negotiation` :1197, `Awarded` :1222, `LostWithdrawn` :1243 | `type_details.<facet>.<section>` | :id | **U+T** (aggregate token read in `mergeCanonicalTenderFacet`) | yes | store row | real user | BE |
| 24 | `addTenderDocument` :1264 / `updateTenderDocumentMetadata` :1285 / `changeTenderDocumentStatus` :1309 / `markTenderDocumentSuperseded` :1335 | `type_details.documents` whole-array replace via `updateTenderDocumentList` :250 | :id | **U+T** :282 | yes across keys; array replaced atomically | store row; before/after counts audited | real user | BE |
| 25 | `updateBlockReviewStatus` :1474 | `tender_drafting.proposal_blocks` (per-block dept fields) | :id | **U+T** — token captured at its own aggregate read, passed through :1509 | yes | store row | `reviewerName` param, **default `"System"`** :1480 | BE |
| 26 | `saveBlockAIFlags` :1520 | `tender_drafting.proposal_blocks` (ai_flags + quality_scores; idempotent per dept) | :id | **U+T** :1579 | yes | store row | real user + `botId` in payload | BE |
| 27 | `createActivityNote` :1438 | `commercial_ticket_audit` row (the note IS the row) | :id | n/a (insert) | n/a | **C** — awaited insert + `.select('id').maybeSingle()`; zero-row → explicit RLS-aware failure (:133-153) | real user | C |
| 28 | Disabled: `updatePackStatus` :1346, `updatePlaceholderStatus` :1360, `updateRequiredDocStatus` :1375, `updateComplianceStatus` :1389, `updateGateStatus` :1404, `logMockBypass` :1419, `logEmailSimulation` :1456 | **nothing** | — | — | — | `{success:false, error:'…disabled until it is rebuilt on verified commercial_tickets lineage. Legacy tender child tables must not be repopulated.'}` :61-66 | — | none |
| 29 | `createTicket` (`intake-save.ts:169`) | INSERT commercial_tickets, `created_from_intake:true, active:true` :212-218 | new id | n/a | n/a | `.select().single()`; `!row?.id` → error :246-248 | `userName` param; session required :207 | awaited but **failure only console.error** :161-163 |
| 30 | `updateTicket` (`intake-save.ts:266`) — **no callers in src** | arbitrary sanitized cols incl. **whole `type_details` replace** if passed :132 | exact id, no ticket_type filter | **none** (`.single()` errors on 0 rows, but no token) | **NO** if `type_details` passed | `.single()` | `userName` param | swallowed |
| 31 | `changeStage` (`intake-save.ts:306`) | col `crm_pipeline_stage` or `internal_stage` | exact id, **no ticket_type/active filter** | **RB** — `.select(...)` zero-row → explicit error; stored value compared :321-335 | yes | value-compare read-back | `userName` param — Kanban passes literal `"CRM Pipeline"` (`CrmPipeline.tsx:217`) | awaited, failure console.error only |
| 32 | `deactivateTicket` (`intake-save.ts:350`) — no callers | col `active:false` | exact id | RB :368-377 | yes | read-back | param | swallowed |
| 33 | `writeOrchestrationState` (`orchestration.ts:146-196`) — via `createOrchestrationPackage`/`addOrchestrationSuggestion`/`updateOrchestrationSuggestionStatus` | **whole `type_details` replace** `{ ...currentDetails, orchestration: nextState }` :176 | exact id + ticket_type + active | **NONE** — no `updated_at` predicate; client even sets `updated_at` itself :177 (overridden by trigger) | **read-time snapshot only** — a concurrent sibling write between read (:151-157) and update is clobbered | `.select('id')` count; 0 rows → `'Update failed — no rows affected (possible RLS block…)'` :184-186 | real user | BE (own copy :71-103) |
| 34 | Blocked legacy: `syncTenderCreate`/`syncTenderUpdate` (`supabase-sync.ts:133-150`) console.warn no-op; `insertTenderPackOutput` disabled (`supabase-tender-data.ts:766-786`) | nothing | — | — | — | returns false/void | — | — |
| 35 | `uploadDocument` (`document-vault.ts:379-478`) | Storage `documents` bucket + `generated_documents` INSERT | tenderId → `source_type:'tender', source_id` | n/a | n/a | both steps throw on failure; insert `.select().single()` | `generated_by: getCurrentUser().id \|\| "system"` :421 | none |
| 36 | `persistVaultStatus` (`document-vault.ts:480-488`) | `generated_documents.status` | doc id | none | n/a | **fire-and-forget, silent handler** — badge can lie | — | none |
| 37 | `uploadSupportingDoc`/`archiveSupportingDoc`/`restoreSupportingDoc` (`workspace-integration.ts:219-369`) | `generated_documents` | workspace id | RB — confirmed row + stored-value compare; zero-row = failure :279-287, 331-343 | n/a | confirmed | real user | none |
| 38 | `writeReviewAudit` (`supabase-commercial-actions.ts:87-117`) | `commercial_ticket_audit` (review acks; proposal-side) | resolved ticket id (by id or legacy_workspace_id) | n/a | n/a | insert error surfaced; **no returning-id check** | actor param | C-ish |
| 39 | FinalPack: `createInstance` (`useFinalPackInstance.ts:210-253`), auto-save (`PdfStudio.tsx:182-209`), branding (`PdfStudio.tsx:376-386`) | `doc_instances` only | instance id; `linked_entity_id` = tender id | auto-save: **client-token optimistic** `.eq('updated_at', lastUpdatedAtRef)` + zero-row → conflict advisory (:188-199); no DB trigger on doc_instances (verified: none in 20260604 schema) | n/a | zero-row on first save → explicit "not confirmed saved" :200-207; branding write is fire-and-forget console-only :384-386 | `created_by: "User"` **hardcoded** (`useFinalPackInstance.ts:231`) | none |

**Reload survival:** every guarded write lands in the same `commercial_tickets` row the workspace re-reads; tabs call `reload()` → `fetchTenderWorkspaceBundleFromSupabase` re-reads header + audit; all keys in §1.4 have a read projection, so guarded writes survive reload. Orchestration state survives too (own reader). The only non-persisted UI state found: supporting-doc `isRequiredForContractReady`/`linkedCycleId` are session-scoped by design (`workspace-integration.ts:134-137, 294-299`).

**Auth-callback check (per briefing):** the only `onAuthStateChange` is `AuthContext.tsx:102`; the profile DB read is deferred out of the callback via `setTimeout(..., 0)` with cleanup (:111-118) — no remaining in-callback Supabase queries found anywhere in `src`. The initial `getSession().then` path awaits `loadProfile` but is not inside the auth callback (:90-100). Client also bypasses Navigator.locks (`supabase.ts:34-43`).

---

## §3 THE THREE DISABLED OPERATIONS

### 3.1 Where the data comes from TODAY: nowhere (honest stubs)

- `fetchTenderPlaceholders` → `return []` (`supabase-tender-data.ts:705-708`).
- `fetchTenderRequiredDocuments` / `fetchTenderComplianceItems` → `{ loaded: false, items: [] }` (:725-733), with the W04-C4 comment: *"These two collections have no verified source in the clean app: the legacy tender child tables are read-disabled and nothing replaced them"* (:710-719). `loaded:false` drives `riskInputsAssessed=false` → `riskLevel:'not_assessed'` (:868-879) and `requiredDocumentsAssessed:false` (:899).
- Consequence: `TenderPlaceholdersTab` renders `"No placeholders registered yet."` (`TenderPlaceholdersTab.tsx:204-205`); compliance tab reads `ws.complianceItems` (`TenderComplianceMatrixTab.tsx:144`); required-docs tab reads `ws.requiredDocuments`. All three collections are always empty, so the modal buttons that call the disabled writes (`TenderPlaceholdersTab.tsx:40`, `TenderComplianceMatrixTab.tsx:29`, `TenderRequiredDocumentsTab.tsx:45`) are **unreachable in practice**; if reached they return the disabled error (§2 row 28). No hardcoded seed lists remain (W04-C4 removed the 14-item hardcoded required-doc list — comment `tender-workspace-data.ts:522-535`).

### 3.2 What the OLD app did (reference only)

Old app HEAD has the same disabled stubs (old repo `client/src/lib/supabase-tender-actions.ts:1305-1344`). The original SUPA-008 implementation (old repo commit `149881f`, 2026-05-13) wrote directly to legacy child tables, e.g.:

```ts
const { error } = await supabase
  .from('tender_placeholders')
  .update(updates)          // { status, last_updated, value? }
  .eq('id', placeholderId); // no tender scoping, no read-back
```
plus fire-and-forget rows into `tender_activity_events` / `tender_audit_events`. Same pattern for `tender_required_documents` and `tender_compliance_items`. That path was deliberately killed.

### 3.3 Legacy child tables that must NOT be repopulated (probed live, §6.6)

`tenders, tender_packs, tender_pack_sections, tender_placeholders, tender_required_documents, tender_compliance_items, tender_activity_events, tender_audit_events, tender_split_checks, tender_pack_outputs, tender_submission_emails, tender_submission_email_attachments, tender_submission_gates, tender_stage_history, tender_customer_links` — all exist live, all anon-count 0 (see §6.6 for the RLS caveat). `tender_governance_config` exists with 4 rows (config, not tender data). The disabled-write error text itself is the doctrine: *"Legacy tender child tables must not be repopulated."* (`supabase-tender-actions.ts:64`).

### 3.4 Canonical storage options the codebase itself already suggests (evidence, not design)

1. **`type_details` facet sections via `mergeCanonicalTenderFacet`** — the live pattern for exactly this class of record. Working precedents with live audit rows on the Linde tender (§6.5): `identified.compliance_matrix_notes` (`IdentifiedComplianceMatrixTab` → `updateTenderIdentifiedData`; 2 live audit rows), `identified.document_review` (`TenderDocumentReviewTab.tsx:57,109`; 2 rows), `tender_drafting.compliance_coverage` (`ComplianceCoverageTab.tsx:52,91` saves `{ requirements }`; 2 rows), `tender_drafting.appendices_evidence` (2 rows). A compliance-item status register is structurally identical to `compliance_coverage.requirements`.
2. **Per-document status inside `type_details.documents[]`** — `changeTenderDocumentStatus` already flips `status` on a document entry under the revision guard; the `TenderDocument` shape carries `required_for_submission`, `linked_requirement_id` (`tender-workspace-data.ts:227-259`) — the required-docs overlap already has fields.
3. **The required-docs progress contract** — `buildRequiredDocumentsProgress` (`tender-workspace-data.ts:548-583`) requires "a recorded requirement set" plus `requiredDocumentsAssessed`; satisfied by statuses or full-name match against uploaded `type_details.documents` names. Whatever key stores the requirement list must feed this exact contract.
4. **Declaration point:** any new facet belongs in the stage's `storageFacets` registry (`tender-stage-source-truth.ts`), and in `projectTenderStageTruth` for aggregate visibility.
5. **Source-record kinds:** the store has no kind column — "kinds" are `type_details` keys on the single tender row + `changedFieldPaths` in audit. A new placeholder/compliance bucket is just another key the store already supports (`SaveTenderSourceRecordInput.typeDetailsPatch` + `changedFieldPaths`, `tender-source-record.ts:119-131`).

The placeholders concept has **no** live `type_details` precedent — the codebase offers only option 1's mechanism, not an existing key. Do not invent one in this register.

---

## §4 AUDIT / ACTIVITY HISTORY

- **Single physical trail:** `commercial_ticket_audit` — columns confirmed live `id, ticket_id, action, field_changed, old_value, new_value, user_name, notes, created_at` (200 on that projection; `actor_id` → 42703 does-not-exist). `action` is CHECK-constrained to `created|updated|stage_changed|lineage_verified|lineage_rejected|quarantined|promoted|deactivated`; FK `ticket_id → commercial_tickets(id) ON DELETE RESTRICT`; immutable (no UPDATE/DELETE policies) (old-app migration 20260520:206-241).
- **Tender-specific:** yes, keyed by `ticket_id`. Both the Activity tab and the Audit tab are projections of the same table (`fetchTenderActivityEvents`/`fetchTenderAuditEntries`, `supabase-tender-data.ts:736-754`).
- **Human-readable:** yes — plain-text pipe-joined notes. Live sample (Linde, latest): `stage_changed | stage_change | notes: "Tender Stage Change | Phase changed from \"internal_review\" to \"tender_drafting\". Manual internal Tender stage change | Reason: …"`.
- **Actor-attributed:** free-text `user_name` only. Live distribution on Linde's 194 rows: `{'Amin Al-Rashid': 192, 'Unauthenticated': 2}` — the 2 `Unauthenticated` rows are the two most recent stage changes (2026-08-19 09:37/09:38), i.e. writes where the Supabase session was authenticated (RLS update passed) but the app-level profile had not loaded — the `auth-state.ts` fallback (`DEFAULT_USER.name = "Unauthenticated"`, :19-25) leaked into the trail. Kanban moves write `user_name:"CRM Pipeline"` (`CrmPipeline.tsx:217`).
- **Structured audit contract is dead code:** the store's `insertAudit` writes a rich JSON note (`contract:'W2-S001-v1'` with `actor_id, origin, previous_revision, new_revision, changed_field_paths, evidence_ids, suggestion_ids` — `supabase-tender-source-record.ts:11-23`), but **all four** `saveTenderSourceRecord` call sites pass `recordAudit: false` (`supabase-tender-actions.ts:165, 191, 242, 287`); no other caller exists (grep). Every live audit row comes from the plain-text best-effort path instead.
- **Silent swallowing — exact quotes:**
  - `runBestEffortAuditWrite` (`supabase-tender-actions.ts:72-90`): `if (error) console.warn('[SUPA-008] Canonical tender audit insert failed:', …)` / `.catch(… console.warn('… skipped:', …))` — not awaited, 4s timeout, caller already returned `{success:true}`. The module header states it plainly: *"the append is BEST EFFORT … a missing audit row is invisible to both the caller and the user. It is therefore never part of the success claim"* (:12-18).
  - `intake-save.writeAudit` (:161-163): `if (error) { console.error("[intake-save] Audit write failed:", error.message); }` while `createTicket`/`changeStage` return success — and the file header admits the old "audit is mandatory" claim was false (:13-19).
  - `orchestration.writeOrchestrationAudit` (:96-99): same console.warn-only pattern.
- **The one confirmed path:** `createActivityNote` → `writeCanonicalTenderAuditConfirmed` (:133-153) — awaited insert, id read back, zero-row → *"…commercial_ticket_audit returned no stored row, so the note is not confirmed saved. It may have been blocked by row-level security."* No path reports a **failed** audit write as success where the audit row is the payload; for side-write audits, success is (documented) silence.

---

## §5 DOCUMENTS + FINALPACK/PDF CHAIN

### 5.1 Supporting/tender document model

Upload (`TenderDocumentModal.tsx:120-170`) is a three-step chain:
1. **File bytes** → Supabase Storage bucket **`documents`** (private; *"the ONLY bucket is `documents` (PRIVATE)"*, `cover-asset-storage.ts:6-23`), path `customers/{customerId}/workspaces/{…}/{category}/{date}-{name}-{rand}.{ext}` (`document-vault.ts:389-399`), throw on failure.
2. **Vault metadata row** → `generated_documents` insert (`source_type:'tender'`, `source_id: tenderId`, `storage_path`, `generated_by`) `.select().single()`, throw on failure (:406-430).
3. **Tender-side metadata** → `addTenderDocument` appends the `TenderDocument` object (id = generated_documents id, `storage_path` carried) into `type_details.documents` under the revision guard (§2 row 24).

Classification lives in the JSONB entry: `document_category` (Source/Supporting/Generated/Submission/Archived), `document_type` (35-option list), `status` (9 states), `stage_relevance[]` with per-stage filtering via `documentsForTenderStage` (`tender-workspace-data.ts:383-385`) and stage-label mapping (:324-365). Knowledge-base metadata is additive on the same entries (`source_role`, `orchestration_included`, `extraction_readiness`, `primary_source`, :249-259) patched via `updateTenderDocumentMetadata` (`TenderKnowledgeBaseSection.tsx:35`). Downloads are signed URLs from the private bucket (`getSignedDownloadUrl`, `document-vault.ts:341-344`). Note the two metadata stores (generated_documents row vs type_details entry) have no reconciliation job; step-3 failure after step-2 success leaves a vault row + storage object with no tender-side entry.

### 5.2 FinalPack handoff and the PDF renderer

- **Entry:** `/tenders/:tenderId/final-pack` (`PdfStudio.tsx:5`); `PackSelector` reads the tender row read-only (`PackSelector.tsx:118-121`); tender list is process-isolation filtered (`PdfStudio.tsx:73-80`).
- **Snapshot:** `loadTenderPack` (`final-pack-loader.ts:340-511`) reads the shared projection `TENDER_SOURCE_SELECT` (:251-252), maps tender content to blocks by **explicit block_key** (cover/scope/pricing/SLA/narratives from `tender_drafting.proposal_blocks`, `pricing.scenarios`, `solution_design_data.sla_kpi`, `sow_data`), and computes a SHA-256 `source_hash` over `buildTenderSourceData` (:270-285, 933-939). Header guarantee: *"NEVER calls .update() / .upsert() / .delete() on commercial_tickets"* (:13).
- **Instance:** `createInstance` persists blocks + `source_snapshot` (hash, original blocks, source_data, template/layout/volumes) into `doc_instances` with `linked_entity_id = tenderId` (`useFinalPackInstance.ts:184-247`); edits auto-save to `doc_instances.blocks` under a client-token optimistic guard with conflict advisory (`PdfStudio.tsx:182-209`).
- **Drift:** `useSourceDrift`/`checkSourceDrift` re-reads the SAME projection and re-hashes with the SAME function (W04-T09 fix: *"Both sides now hash the SAME projection"*, `useSourceDrift.ts:52-59`); "could not check" is distinct from "no drift" (:37-43).
- **Export renders the user-edited content:** the client renders the **preview HTML** — html2pdf.js (html2canvas+jsPDF), falling back to a jsPDF text body, falling back to browser print (`final-pack-pdf.ts:1-79`); imported-PDF covers are merged byte-for-byte with pdf-lib (:30-50).
- **The divergent renderer exists but is OFF:** *"the existing server PDF route (`/api/documents/generate-pdf`) renders with PDFKit from SOURCE data … it does NOT render FinalPackStudio's edited-block HTML … Routing Final PDF through it would produce a DIFFERENT document than the one the user edited"* — therefore feature-flagged off, `isServerPdfEnabled()` = `VITE_FPS_SERVER_PDF === "true"` else null-fallback to client (`server-pdf.ts:5-17, 41-63`). Current state: exported PDF = same edited content; no divergence on the active path.

---

## §6 LIVE PROBE RESULTS (read-only; anon key; exact HTTP evidence)

Base: `https://kositquaqmuousalmoar.supabase.co/rest/v1` (from `.env:3`). All probes GET/HEAD only.

### 6.1 Row census — the "6 rows" premise is stale

`HEAD /commercial_tickets?select=id` + `Prefer: count=exact` → `HTTP 200`, `Content-Range: 0-1/2` — **2 rows anon-visible, total 2 under the anon-visible policy**.

### 6.2 Per-id verdicts (each probed individually; audit table is independently anon-readable)

| id | `GET /commercial_tickets?id=eq.<id>` | `HEAD /commercial_ticket_audit?ticket_id=eq.<id>` (count=exact) | Verdict |
|---|---|---|---|
| `7483c493-0098-40a9-9e5f-76007bc62cd1` (Linde) | 200 `[{"id":"7483c493…","ticket_type":"tender","active":true}]` — `internal_stage:"tender_drafting"`, `crm_pipeline_stage:"proposal_sent"`, `updated_at:"2026-08-19T09:38:11.074248+00:00"` | `Content-Range: 0-193/194` | **VISIBLE, active tender** |
| `089447d6-6d4f-4921-9df3-92483f36233a` (KAFD) | 200 `[{"id":"089447d6…","ticket_type":"proposal","active":true}]` | `Content-Range: 0-3/4` | **VISIBLE, active proposal** |
| `a1100000-0000-4000-8000-000000000030` (seed tender ARV2) | 200 `[]` | `Content-Range: */0` | **provably-absent-to-anon; corroborated DELETED** |
| `a1100000-0000-4000-8000-000000000040` (seed proposal) | 200 `[]` | `Content-Range: */0` | same |
| `a1200000-0000-4000-8000-000000000001` (W2-S001 seed) | 200 `[]` | `Content-Range: */0` | same |
| `a1200000-0000-4000-8000-000000000002` (W2-S002 seed) | 200 `[]` | `Content-Range: */0` | same |

**Honest classification chain:** (a) `commercial_tickets` SELECT policy in-repo is `ct_read_all … USING (true)` and `commercial_ticket_audit` is `cta_read_all … USING (true)` (old-app migration 20260520:178-181, 228-232) — and anon demonstrably reads other rows in BOTH tables, so a permissive anon read path is live; (b) the clean repo contains `202608190002_functional_closure_uat_cleanup.sql` deleting **exactly these four ids** from `commercial_ticket_audit` then `commercial_tickets` (*"Exact-id cleanup approved by the Human Architect on 2026-08-19. No title, prefix, date, or wildcard deletion is permitted"*); (c) the FK is `ON DELETE RESTRICT`, so the ticket deletes could only succeed after the audit deletes — the observed joint zero on two independently readable tables is precisely that migration's postcondition. Residual caveat, stated honestly: anon-side evidence alone cannot 100% exclude a *replaced* tailored RLS policy that hides exactly these rows from anon; ruling that out needs an authenticated or service-role read. On the balance of in-repo DDL + observed behavior: **deleted**.

### 6.3 `type_details` top-level keys per live row (keys only, no dumps)

Linde `7483c493` — 16 keys, all objects: `awarded_data, bid_no_bid_data, clarification, client_evaluation, customer_fit_data, identified, lost_withdrawn_data, negotiation_data, pricing, risk_snapshot_data, solution_design_data, sow_data, sow_qualification_data, submission, technical_qualification_data, tender_drafting`. Notable **absent** keys: `documents` (no tender documents recorded), `approval_matrix`, `final_approved`, `internal_review`, `orchestration`, the six execution-scope keys, `tender`, `extraction`. Empty-object facets: `awarded_data, client_evaluation, identified, lost_withdrawn_data, negotiation_data, submission` (keys exist, no sections). Populated second-level highlights: `tender_drafting.{approval_matrix, final_approval_check, proposal_architecture, proposal_blocks[14]}` (approval matrix currently lives at the LEGACY drafting location — the read fallback at `tender-stage-source-truth.ts:234-236` is what surfaces it), `pricing.{approval, commercial_terms, cost_inputs, pnl_snapshot, scenarios}`, `sow_data` fully populated (9 service lines, 5 SLA KPIs, 2 sites…), `clarification.qa_log[1]`.

KAFD `089447d6` (proposal, out of tender scope): `discovery_status, pricing_status, proposal_version, proposal_workspace`.

### 6.4 Column-existence control experiment (method proven both directions)

- `select=id,probability_percent` → **200**.
- `select=id,probability_percentt` → **400** `{"code":"42703", "hint":"Perhaps you meant … probability_percent", "message":"column commercial_tickets.probability_percentt does not exist"}`.
- 35-column projection (full §1.3 list) → **200** — all exist.
- `select=id,submission_deadline` → **400 42703** — not a column.
- `commercial_ticket_audit` 9-column projection → **200**; `actor_id` → **400 42703**.

### 6.5 Source-record store physical table + per-kind tallies (Linde)

Physical store = the `commercial_tickets` row itself (kinds = `type_details` keys; no kind column exists) + `commercial_ticket_audit` as the write ledger. Linde audit: **194 rows**; per-kind write tally (action | field_changed → count), top entries: `updated|tender_drafting.proposal_blocks 22`, `updated|solution_design_update 21`, `updated|bid_no_bid_update 12`, `stage_changed|crm_stage_change 7`, `updated|tender_drafting.proposal_architecture 6`, `updated|sow_qualification_update 6`, `updated|clarification.qa_log 6`, `updated|clarification.margin_impact 5`, `updated|clarification.status 5`, then 3-row groups across `identified.*`, `pricing.*`, `submission.*`, `client_evaluation.*`, `negotiation_data.*`, `awarded_data.*`, `lost_withdrawn_data.*`, 2-row groups incl. `tender_drafting.compliance_coverage` and `tender_drafting.appendices_evidence`, plus `stage_changed|stage_change 2`, `created 1`, `probability_change 1`. Actor split: `Amin Al-Rashid 192 / Unauthenticated 2`.

### 6.6 Legacy tender child tables (all exist live)

`HEAD /<table>?select=*` + `Prefer: count=exact`: `tenders */0, tender_packs */0, tender_pack_sections */0, tender_placeholders */0, tender_required_documents */0, tender_compliance_items */0, tender_activity_events */0, tender_audit_events */0, tender_split_checks */0, tender_pack_outputs */0, tender_submission_emails */0, tender_submission_email_attachments */0, tender_submission_gates */0, tender_stage_history */0, tender_customer_links */0` — and `tender_governance_config 0-3/4` (4 rows, config). **Caveat:** these tables' in-repo SELECT policies are `auth.role() = 'authenticated'` (20260506 parity migration RLS loop :348-364), so anon `*/0` = "anon sees zero" — genuinely-empty is corroborated by the Wave-0 baseline but **UNVERIFIED live for the authenticated role**. (Curiously `tender_governance_config` returns rows to anon — it evidently carries a permissive policy.)

### 6.7 Documents / FinalPack tables and bucket

- `generated_documents` → `Content-Range: */0`; Linde-filtered (`or=(source_id.eq.…,workspace_id.eq.…)`) → 0 rows. Policy is `FOR SELECT TO authenticated` (sprint6 migration :33) → **anon-invisible; true contents UNVERIFIED** read-only.
- `doc_instances` → `*/0` total and 0 Linde-linked; policy `di_read … auth.role()='authenticated'` (20260604 :237) → **anon-invisible, UNVERIFIED** (the 2026-08-19 cleanup deleted 8 instances by exact id; what remains needs an authenticated read).
- Storage bucket `documents`: `GET /storage/v1/bucket/documents` → 400 `{"statusCode":"404","error":"Bucket not found"}` for anon (management endpoint does not disclose); object listing is a POST (forbidden here) → **bucket contents UNVERIFIED read-only**. Code truth: it is the only bucket and private (`cover-asset-storage.ts:6-23`). FPS-009 memory records 2 orphaned QA cover objects — unverifiable from here.
- `users` → `*/0` (anon-invisible; the actor profile read works only authenticated — consistent with the `Unauthenticated` audit rows).

### 6.8 Are authenticated-role writes testable read-only? **No.**

Proving the write discipline (RLS zero-row-as-failure, `updated_at` guard behavior, trigger bump) requires an authenticated JWT issuing UPDATE/INSERT — out of scope for this read-only audit by rule (no POST/PATCH/DELETE). Write-path proof stays with the unit tests (`src/lib/supabase-tender-actions.test.ts`, `src/lib/intake-save.test.ts` — which covers changeStage zero-row and value-mismatch cases, `src/lib/supabase-tender-data.test.ts`) and live UAT.

---

## §7 STALE-WRITE VERDICT

**What exists today (evidence):**
1. DB-side monotonic token: `trg_ct_updated_at` bumps `updated_at` on every UPDATE (20260520:141-153).
2. Guarded UPDATE: `.eq('updated_at', args.expectedRevision)` + `maybeSingle`; zero-row is disambiguated to `stale` (returning the current row) / `not_found` / `failed`, never success (`supabase-tender-source-record.ts:45-66`).
3. Pre-flight compare + non-destructive stale UX: `'Tender changed after this edit began. Review the current value and retry without losing your entry.'` and attempted values preserved in the result (`tender-source-record.ts:340-353, 371-388`).
4. Caller-supplied tokens where it matters most: facet/section writers and both proposal-block writers pass a read-time `aggregate.revision.token` (`supabase-tender-actions.ts:232, 282, 1509, 1579`); `updateTenderDraftingData` exposes `expectedRevision` as a public parameter (:1029).

**Coverage gaps (facts):**
- `orchestration.writeOrchestrationState` — read-modify-write of the **whole** `type_details` with **no** `updated_at` predicate (orchestration.ts:173-181): last-write-wins over every sibling facet.
- Column writers via `updateCanonicalTenderTicket`/`mergeCanonicalTenderDetails` acquire the token **inside** the save call, so the guard only spans the in-call read→write window — it does not detect that the UI's form was loaded against an older revision (facet-level last-write-wins for `sow_data` etc.).
- `intake-save.changeStage`/`updateTicket`: read-back verification only, no token.

**Smallest honest mechanisms the existing model already supports for correction C (options with evidence — not a design decision):**
- **Option A — thread the UI-read-time token:** every workspace tab already receives a bundle whose header row carries `updated_at`; `SaveTenderSourceRecordInput.expectedRevision` (`tender-source-record.ts:120`) and the `updateTenderDraftingData` parameter (:1029) are the existing plumbing; the `stale` status + preserved `attemptedChanges` already define the retry UX. Zero schema change.
- **Option B — bring orchestration inside the guard:** either add the same `.eq('updated_at', …)` predicate to its update (mirroring `supabase-tender-source-record.ts:51`) or route it through `saveTenderSourceRecord` as an ordinary facet — its own header claims it "mirrors the exact read-merge-write-audit pattern" of the store (orchestration.ts:6-9); today it mirrors everything except the guard.
- **Option C — `updated_at` predicate on `changeStage`:** the function already selects the row back; adding the token predicate reuses the trigger that exists. (Its current read-back already catches RLS-zero-row, so this only adds lost-update protection.)
- A numeric revision column or a source-record child table would be **new schema** — nothing in the codebase requires it; the `updated_at` token is the model's native mechanism.

---

## §8 TOP DATA-INTEGRITY RISKS (ordered)

1. **Unguarded whole-`type_details` replace in orchestration** (`orchestration.ts:146-196`): the only `type_details` writer without the `updated_at` guard; a suggestion write concurrent with any guarded facet save silently reverts the sibling facet to the stale read. It also targets the same single JSONB the entire tender lives in.
2. **Best-effort audit trail** (`supabase-tender-actions.ts:72-123`; `intake-save.ts:161-163`; `orchestration.ts:96-99`): fire-and-forget, 4s timeout, console-only failure — the ledger can be silently incomplete while every business success is honest. The structured W2-S001-v1 audit contract (revisions, actor_id, changed paths) is dead code because all four store call sites pass `recordAudit:false`.
3. **Actor attribution is app-level free text and demonstrably leaks fallbacks:** live rows show `Unauthenticated` (2, from the pre-169aafd profile-load gap), Kanban writes the surface name `"CRM Pipeline"` as the actor (`CrmPipeline.tsx:217`), `updateBlockReviewStatus` defaults to `"System"` (:1480), `doc_instances.created_by` is hardcoded `"User"` (`useFinalPackInstance.ts:231`). No DB-level actor id anywhere.
4. **Facet-level last-write-wins for the details writers** (`sow_data`, `solution_design_data`, qualification facets): the token is acquired in-call, so two editors of the same facet overwrite each other's entire facet with no stale signal (correction C's exact target; §7 Option A).
5. **CRM stage vocabulary divergence + no validation:** Kanban stores Title-Case labels ("Proposal Sent"), the workspace stores snake_case keys (`proposal_sent`, live value on Linde); both read paths normalize, but raw values fork, and `updateTenderCrmStage` validates nothing despite `isRestorableCrmPipelineStage` existing precisely to prevent writes that read back as a different stage (`supabase-tender-data.ts:425-448`).
6. **`changeStage` targets by bare id** — no `ticket_type`/`active` predicate (`intake-save.ts:313-317`); it trusts the UI's card id entirely (read-back mitigates silent no-ops, not wrong-row writes if a wrong id is ever passed).
7. **World-readable tender data on the anon key** — reconfirmed live by this audit's own probes: full `commercial_tickets` content (pricing, P&L, win strategy) and the entire audit trail are readable with the shipped anon key (`ct_read_all`/`cta_read_all USING (true)`). Known Wave-0 CRITICAL; unchanged.
8. **Stale "6 rows" context** — the seed rows and their audit are deleted (2026-08-19 migration); any register, test fixture, or probe still targeting `a1100000-*/a1200000-*` ids will hit absent rows (the store would surface `not_found`, but tooling premises must be updated).
9. **Dual document metadata stores without reconciliation** (`generated_documents` + `type_details.documents`): a failure between vault insert and `addTenderDocument` leaves an orphan storage object/vault row invisible to the tender; `persistVaultStatus` is additionally fire-and-forget-silent (`document-vault.ts:480-488`). Live check blocked by RLS (anon-invisible tables) — authenticated sweep needed.
10. **Dormant hazards:** `intake-save.updateTicket` would replace whole `type_details` unguarded if ever wired to a caller (:132, no callers today); `doc_instances` has no DB `updated_at` trigger, so FPS's optimistic token is client-maintained (correct today because all writers set it, but fragile against any future writer that forgets).

**Verification honesty ledger:** VERIFIED live — commercial_tickets census, per-id status, columns, type_details keys, audit contents/counts/actors, legacy child-table anon-counts. UNVERIFIED (read-only/anon limits, stated where relied on) — authenticated-role contents of `doc_instances`, `generated_documents`, `users`, storage bucket objects, legacy child tables under the authenticated role, actual applied-status of migrations beyond their observable effects, and all write-path behaviors (tests+UAT own those).
