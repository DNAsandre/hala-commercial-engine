# TENDER-SAVE-READBACK-LEDGER
**Wave:** Tender Functional Closure · **State:** post-correction (integration `0035872`) · **Author:** Fable
Current-state (pre-correction) evidence: `TENDER-DATA-CONTRACT-REGISTER.md` §2. Lane detail: `lane-reports/`.

## The contract (correction C), as now implemented
Every meaningful tender save runs through `saveTenderSourceRecord` (`src/lib/tender-source-record.ts`) → `updateActiveTender` (`src/lib/supabase-tender-source-record.ts`):
1. **Exact active tender**: `id = :tenderId AND ticket_type='tender' AND active=true`; identity re-asserted on the read; `not_found`/`invalid_identity` are distinct outcomes.
2. **Canonical source-record contract**: column whitelist (`MUTABLE_TENDER_COLUMNS`) + top-level-shallow `type_details` merge; facet writers are PATCH-MERGE (`{...currentFacet, ...patch}` — a tab sends only its own keys); section writers merge one section.
3. **Stale protection**: DB trigger bumps `updated_at`; the UPDATE carries `.eq('updated_at', expectedRevision)`. The UI-read-time token is now plumbed end-to-end: bundle `revisionToken` (verbatim `updated_at`) → `bundleToTenderWorkspace` → `ws.revisionToken` → every tab passes it (`wsRevisionToken`/`tenderRevisionTokenOf` accessors). Zero-row is disambiguated post-hoc: row gone → `not_found`; token moved → `stale` (current row returned, entry preserved, honest retry); else `failed`. **Zero-row is never success** (covers the RLS-200-empty case).
4. **Sibling preservation**: patch/section merges preserve unrelated facets AND unrelated sections; register item ops mutate ONE row by exact id and byte-preserve siblings (guard-proof-verified, incl. a Fable-run reintroduction on the merged tree: exact-id → `rawRows[0]` → 2 named failures → restored).
5. **Read-back**: success only from the returned stored row.
6. **Success UI**: green only after confirmation; `stale` → non-destructive retry; `saved_with_audit_warning` → amber with the real reason; failures carry the service's reason.
7. **Real actor**: session user via the auth-state mirror; fabricated literals removed (`"Current User"`, `"System"`, `"User"` fallbacks); signed-out = the honest `"Unauthenticated"`.
8. **Evidence/source references**: register rows carry `evidence`/`source_reference`/`linked_document_id`; audit notes carry changed-path context.
9. **Reload survival**: every write lands in the row the bundle re-reads; `onSaved={reload}` wired on every saving tab.

## Writer table (post-correction)
| Writer | Shape | expectedRevision | Audit |
|---|---|---|---|
| `updateTenderPhase` / `updateTenderCrmStage` (+ round-trip validation) / `updateTenderProbability` / `updateTenderTeamMembers` / `updateTenderExecutionScope` | column / top-level keys | in-call token (signatures unchanged — recorded gap G-L1) | awaited, warn-surfaced |
| 7 facet writers (sow, customer_fit, sow_qualification, technical_qualification, risk_snapshot, bid_no_bid, solution_design) | **patch-merge** | ✓ opts | awaited |
| 10 section writers (pricing, drafting, approval_matrix, final_approved, submission, identified, client_evaluation, clarification, negotiation, awarded, lost_withdrawn) | section merge | ✓ positional | awaited |
| `updateTenderSubmissionReadinessData` + `updatePlaceholderStatus` / `updateRequiredDocStatus` / `updateComplianceStatus` (correction A — rebuilt) | section rows / exact-item-id | ✓ opts | awaited |
| `updateBlockReviewStatus` (real reviewer default) / `saveBlockAIFlags` | per-block fields | ✓ | awaited |
| Document list ops (`addTenderDocument` / metadata / status / supersede) | whole-list replace under store guard | in-call token (G-L2: no caller-token param) | awaited |
| `createActivityNote` | audit row IS the payload | n/a | **confirmed insert** |
| `writeOrchestrationState` | whole-details merge | ✓ **guard added (P2c)** — refuses unguarded writes | own copy |
| Disabled by ruling: `updateGateStatus`, `logMockBypass`, `logEmailSimulation`, `updatePackStatus`, `insertTenderPackOutput` | — | — | — |

## Audit honesty (correction D)
Primary write confirmed → audit append AWAITED (8s cap) → failure = `saved_with_audit_warning` + reason (never silent, never blocking). No-op `_insertAuditEvent` deleted (12 call sites). One deduplicated `commercial_ticket_audit` feed serves Activity/Audit/drawer (F5); mock-word row-hiding removed (F6). Actor history: earlier live rows include `"Unauthenticated"` ×2 (pre-169aafd profile gap) and `"CRM Pipeline"` (kanban surface, shared-file, out of wave scope) — recorded, not rewritten.

## Recorded gaps (honest, non-blocking)
- **G-L1/G-L2**: `updateTenderProbability`/`updateTenderTeamMembers`/document ops expose no caller-token parameter — they remain guarded by their own fresh-read token (the pre-wave standard); UI-read-time threading covers the facet/section/register writers where cross-tab risk lived.
- `changeStage` (shared CRM kanban, out of scope): read-back + value-compare, bare-id targeting; recorded in the drift register.
- Live write-path behaviour (trigger, RLS outcomes) is proven by tests + the authenticated UAT, not by the read-only build phase.
