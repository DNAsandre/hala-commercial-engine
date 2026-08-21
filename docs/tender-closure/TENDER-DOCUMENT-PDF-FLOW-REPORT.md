# TENDER-DOCUMENT-PDF-FLOW-REPORT
**Wave:** Tender Functional Closure · **State:** post-correction (integration `0035872`) · **Author:** Fable (from TCW-T5 verification + TCW-MAP-DATA §5; lane detail in `lane-reports/T5-REGISTERS-DOCS-LANE-REPORT.md`)

## The human workflow, end to end
supporting document → linked Tender stage → Tender drafting content → FinalPack Studio → preview → exported PDF

### 1. Upload (three-step chain, honest at every failure point)
`TenderDocumentModal` → `performDocumentUploadChain` (exported, tested):
1. File bytes → Supabase Storage private bucket `documents` (path `customers/{customerId}/…`), throws on failure — nothing stored.
2. Vault row → `generated_documents` insert confirmed via `.select().single()` (`source_type:'tender'`, `source_id`, `storage_path`), throws on failure — nothing tender-visible.
3. Tender metadata → `addTenderDocument` appends the entry into `type_details.documents` under the store guard.
**Fixed this wave (T5):** a step-3 failure after 1–2 succeeded is now reported as `uploaded_not_linked` naming the vault id + "do not upload again" duplicate warning (was: generic failure inviting duplicates); step-3 THROW no longer swallowed; `saved_with_audit_warning` renders amber. GUARD-proof: swallowing the step-3 failure → 4 named test failures.

### 2. Classification + stage linking
Entry fields: `document_category` (Source/Supporting/Generated/Submission/Archived), `document_type` (35 options), `status` (9 states), `stage_relevance[]`; per-stage filtering `documentsForTenderStage`; Identified → Document Review tab links documents (`updateTenderDocumentMetadata`); required-docs register rows link uploads by **exact `linked_document_id`** (fuzzy first-word matching abolished — B18/F4). Downloads: signed URLs from the private bucket; library download failures now surface their reason (was an unhandled rejection).

### 3. Drafting content
`tender_drafting.proposal_blocks` (Block Workbench, revision-threaded saves; TOC block-creation's second write result now checked — C1).

### 4. FinalPack Studio handoff (no gate)
Header link + Stage-9 link → `/tenders/:id/final-pack` (`PdfStudio`). `loadTenderPack` reads `commercial_tickets` via the shared `TENDER_SOURCE_SELECT` projection and maps the USER-EDITED `proposal_blocks` content (`content_html || editor_content || draft_content || content_text`) into the pack blocks; missing sections → `not_captured`, never fabricated. Writes go ONLY to `doc_instances` (header contract: no update/upsert/delete on commercial_tickets). Auto-save carries a client-token optimistic guard with a non-destructive conflict advisory. Drift check re-reads the SAME projection and re-hashes with the SAME function; "could not check" ≠ "no drift".

### 5. Preview → exported PDF (same-document guarantee)
Export renders the **edited preview HTML** client-side: native print / html2pdf (html2canvas+jsPDF) / jsPDF text fallback; imported PDF covers merged byte-for-byte (pdf-lib). The divergent server PDFKit route exists but is **OFF**: `isServerPdfEnabled()` is false without `VITE_FPS_SERVER_PDF`; `tryServerFinalPdf` → null → client path. **Pinned by tests** (`final-pack-tender-mapping.test.ts`): edited blocks reach the mapped output (never library defaults), `not_captured` stays empty, the drift hash covers `tender_drafting` (edits are drift-visible), export path stays client-side without the flag.

### Actor truth on the chain (P4, integration commit)
`doc_instances.created_by` and PdfStudio presence/authoring labels: fabricated `"User"` → session actor, signed-out = honest `"Unauthenticated"`.

### Recorded, not fixed (out of scope / register entries)
Dual metadata stores (`generated_documents` + `type_details.documents`) have no reconciliation job — orphan vault rows possible on step-3 failure (now at least reported); `document-vault.uploadDocument` step-2 failure leaves an orphan storage object with a generic message (vault module out of grant); `doc_instances` has no DB `updated_at` trigger (client-maintained token — correct today, fragile to future writers); FPS-009 memory records 2 orphaned QA cover objects in the bucket (standing backlog). Live persistence of the chain is proven in the authenticated UAT.
