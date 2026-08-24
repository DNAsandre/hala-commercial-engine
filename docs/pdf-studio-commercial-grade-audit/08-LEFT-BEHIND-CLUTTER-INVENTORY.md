# 08 — LEFT-BEHIND / CLUTTER INVENTORY
**Baseline:** `e0c7062`. Items that are dead, duplicated, misnamed, or misleading — not functional gaps (those live in [07](07-DEFECT-AND-GAP-REGISTER.md)).

## Dead / unreachable code
| Item | Location | State |
|---|---|---|
| Server Final-PDF branch | `src/lib/server-pdf.ts:56-61` (`tryServerFinalPdf` returns null even with flag), `final-pack-export.ts:162-165` (`renderer:"server"` + unchecked `window.open`) | Dead; flag `VITE_FPS_SERVER_PDF` inert |
| Legacy hook save path | `useFinalPackInstance.ts:335-431` (`saveInstance`/`updateBlocks`/`updateStatus`/`updateBranding`) | Zero callers; contract-defective if ever wired (PDS-56) |
| Legacy doc-instance sync | `supabase-sync.ts:336-475` | Zero callers; writes `bindings`/`is_compiled`/`current_version_id` model nothing reads; delete targets wrong table name (`compiled_documents`) |
| `doc_instances` columns never written | `bindings`, `current_version_id`, `last_edited_by`, `is_compiled`, `compiled_at` | Written only by the dead sync path |
| AI runtime dead imports | `final-pack-bot-runtime.ts` (unused `supabase`, `buildUserPrompt`, `validateBlockAIOutput`, local `allowsBlock`); `final-pack-bot-validation.ts` unreachable | Sprint-X-deferred surface, retained |
| Never-called exports | `buildUserPrompt` (`final-pack-bot-context.ts:141`), `findUnresolvedVariables` (`template-variables.ts:44` — exists precisely for PDS-41 and is unused) | Orphan functions |
| `scope.table` resolver | `final-pack-loader.ts:776-780` | Reads fields no writer produces (PDS-21) |
| `content.clauses` payload | fetched by loader, read by nothing | The PDS-02 blocker's dead half |
| Footer flags | `show_page_numbers`, `show_completed_by` (`final-pack-preview.ts:36-42`) | Declared, never rendered |
| "Image cover" mode | `CoverEditor.tsx:155-172` | Persisted value nothing consumes (only `imported_pdf` read) |
| `max_images` on Facility Gallery | block schema | Dead — no image capability exists |

## False affordances / misleading labels
| Item | Reality |
|---|---|
| Drag handles with grab cursor on every block card | No DnD wired anywhere (inherited from old app) — PDS-44 |
| "Refresh from source" | Restores stale snapshot — PDS-05 |
| "Reset selected block from source" | Resets blocks[0]; no selection exists — PDS-10 |
| "Bilingual Quotation (EN/AR)… English and Arabic" | English-only output — PDS-08 |
| "Annexure C — Rate Card" | Renders P&L summary, not rates — PDS-22 |
| "Facility Gallery" ("asset" chip) | 3-row text table, no images — PDS-47 |
| AI sparkle "runnable" bots | Every run refuses (Sprint-X build) — honest at click, misleading at listing — PDS-40 |
| "Server PDF"/"Generate Final PDF" card (ProposalWorkspace) | Route always 501s; stale "Sprint 6… fully audited" comment — PDS-39 |
| Status badge `draft` | No lifecycle transitions exist — PDS-42 |
| Green ✓ on print exports | Only the dialog opened (outcome line is precise) — PDS-67 |
| `final-pack-pdf.ts:8` "Deterministic + unit-tested" | The real renderer has zero direct tests (only mocks) — PDS-73 |

## Naming / wording clutter
- Three names for one surface: "PDF Studio" / "Final Pack Studio" / "Document Studio" (live-confirmed) — PDS-68.
- 6+ unconditional "tender" strings on the proposal path — PDS-43.
- Stale file-header comment `PdfStudio.tsx:5` lists only the tender route (three are registered).
- Snapshot field names `tender_id`/`tender_title` carried for proposal packs.

## Old-app relationship (clean)
- **Zero** functional references: 5 src hits for `hala-commercial-engine`/`localhost:3001` are comments + one negative test assertion; **0 hits in dist/** after build; no `../` import escapes the repo; aliases resolve inside the repo; no `file:` deps. Legacy DocumentComposer/pdf-compiler/PDFKit renderers absent from src.
- Old app consulted read-only for seed SQL + comparison; untouched.

## Honest-and-keep (explicitly NOT clutter)
"Duplicate Existing Document — Coming soon" (disclosed stub); the sparkle menu's "Preview-only · controlled in Bot Builder" footer; honest "Not captured yet"/"No pricing data captured yet" markers; `source_mode_legacy` display-only normalization flags; the no-toast discipline of the studio surface.
