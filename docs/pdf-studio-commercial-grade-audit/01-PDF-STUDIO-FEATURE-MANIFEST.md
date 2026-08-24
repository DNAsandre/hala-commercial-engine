# 01 — PDF STUDIO FEATURE MANIFEST
**Baseline:** `e0c7062` · 2026-08-24 · Verdicts: COMPLETE / PARTIAL / MISSING / DEFECTIVE / NOT TESTED / SPRINT X DEFERRED. Register refs → [07](07-DEFECT-AND-GAP-REGISTER.md).

## Routes and entry points
| Feature | Verdict | Notes |
|---|---|---|
| `/tenders/:tenderId/final-pack` (PackSelector → composer) | COMPLETE | id-threaded end-to-end; three honest read states; live-verified (Linde) |
| `/proposals/:proposalId/final-pack` | PARTIAL | works, live-verified (KAFD); tender wording + `linked_entity_type='tender'` mislabel (PDS-18, PDS-43) |
| `/pdf-studio` standalone (StartScreen) | COMPLETE | 5 real cards + 1 disclosed "Coming soon" stub; no mock customer data |
| Tender entry points ×3 (workspace header, Stage-9 button, standalone picker) | COMPLETE | all live, non-gating |
| Proposal entry point ×1 (Drafting-stage "Open PDF Studio") | PARTIAL | single entry; no header button, no standalone picker inclusion (PDS-69) |
| Back links | COMPLETE | "Back to Tender"/"Back to Proposal"/state-reset "Back to Pack Selector" — all resolve |

## Pack creation and source ingestion
| Feature | Verdict | Notes |
|---|---|---|
| 5 pack templates (Full Proposal, Std Quotation, SLA, MSA, Bilingual) | PARTIAL | cards + recipes real; Bilingual is English-only in output (PDS-08); SLA matrix field-dead (PDS-04) |
| Pricing scenario selection at creation | PARTIAL | works for tenders; proposal P&L versions never listed (PDS-20) |
| Cover / identity / signature / party ingestion | COMPLETE | minor: UUID-prefix Ref, today-date fallback (PDS-60) |
| Pricing scenario rows → pricing blocks | DEFECTIVE | values flow but internal cost/GP%/notes render customer-facing (PDS-01); raw unformatted strings |
| Totals number-to-words | DEFECTIVE | parseFloat breaks on "1,200,000" (PDS-09) |
| Drafted narrative blocks → pack | PARTIAL/DEFECTIVE | 5 title-heuristic slots only; everything else silently dropped (PDS-06) |
| Clause library → terms/legal blocks | DEFECTIVE | fetched, never rendered; boilerplate ships (PDS-02, live-confirmed) |
| Commercial terms / Quote stage → pack | MISSING | no reader (PDS-07) |
| SOW capture → scope table | DEFECTIVE (dead mapping) | reads fields no writer produces (PDS-21) |
| SLA KPIs → SLA matrix | DEFECTIVE | field-name mismatch (PDS-04) |
| Supporting documents → pack | MISSING | no resolver (PDS-23) |
| Arabic content | MISSING | zero RTL/AR render path (PDS-08) |
| Source snapshot + drift detection | PARTIAL | real hash/snapshot, honest unknown-state; "Refresh from source" restores stale snapshot (PDS-05); standalone-resume drift silently skipped (PDS-19) |

## Editor
| Feature | Verdict | Notes |
|---|---|---|
| Block editors for all 22 render_keys | COMPLETE | real TipTap rich text; cover designer with uploads; structured field editors |
| Pricing/SLA cell editing | PARTIAL | no add/remove row (PDS-37) |
| Add block (custom, page break, DB library, reusable) | COMPLETE | real reads |
| Duplicate / remove / hide / arrow reorder | COMPLETE | persisted via autosave |
| Drag reorder | MISSING | decorative handle (PDS-44) |
| Undo/redo (50-deep block stack) | DEFECTIVE | desyncs open rich-text editors (PDS-11); keystroke-granular evictions; no keybinding |
| Reset block from source | DEFECTIVE | always resets blocks[0] (PDS-10) |
| Autosave + optimistic concurrency + conflict banner | PARTIAL | genuine token guard + honest "Not saved"/Retry; false conflict after branding change (PDS-13); no payload read-back; no beforeunload guard |
| Save as Template / Template Library / branding profiles | COMPLETE | real inserts, append-only versions, real branding rows ("User" literal in saveRecipeVersion — PDS-54) |
| Version history + restore | PARTIAL | real doc_instance_versions writes + History UI; restore is blocks-only (PDS-53) |
| Volumes | PARTIAL | select/export per volume works; membership frozen — user blocks excluded silently (PDS-38) |
| AI sparkle menus | SPRINT X DEFERRED | real Bot Builder discovery; execution refuses honestly on click; misleading at listing (PDS-40) |

## Preview
| Feature | Verdict | Notes |
|---|---|---|
| Single renderer preview=export | COMPLETE | one `buildPreviewHTML`, selection pinned by tests |
| WYSIWYG content rendering | PARTIAL | clauses family never renders (PDS-02); `{{recipient_name}}` literal (PDS-03, live); default prose masks un-captured (PDS-16) |
| Pagination | PARTIAL | explicit markers only; no page count; honest tooltip; preview page shrinks with pane — 507px measured vs 595 (PDS-34, live) |
| Watermark (DRAFT/TEST) | COMPLETE | honest; final never previewable (PDS-50) |
| Images | PARTIAL | signed-URL covers; silent drop on failure (PDS-49); Facility "Gallery" has no images (PDS-47) |
| Bilingual/RTL | MISSING | (PDS-08) |
| Honest empty states | PARTIAL | data-bound blocks honest; HTML blocks masked by defaults (PDS-16) |

## Export
| Feature | Verdict | Notes |
|---|---|---|
| Draft/Test PDF (html2pdf raster) | PARTIAL | real file; raster losses (fonts race, single watermark) (PDS-31/32) |
| Final PDF | PARTIAL | server branch dead stub → html2pdf → print fallback; honest delivery language |
| Print | COMPLETE | honest "print_dialog_opened", popup-block error honest — proven live in the Tender wave |
| HTML export | COMPLETE | byte-exact; signed-URL images expire (PDS-48) |
| All Volumes | PARTIAL | HTML-only, hardwired final; user blocks excluded (PDS-38/46) |
| Imported-PDF cover merge | PARTIAL/DEFECTIVE | pdf-lib merge real; silent text-only fallback (PDS-12); false placeholder page on fallback (PDS-29) |
| Export audit rows (`doc_compiled_outputs`) | COMPLETE | confirmed-not-assumed, failures audited, tested |
| Failure reporting | COMPLETE (near) | best-in-audit honesty; silent downgrades are the residual gap (PDS-12) |

## Persistence
| Feature | Verdict | Notes |
|---|---|---|
| Create/load/list instances | COMPLETE | honest three-state reads, tested |
| Autosave contract | PARTIAL | see editor row; no zero-row disambiguation vs tender standard |
| Versioning | PARTIAL | real, throttled ≥30s; race-prone numbering (PDS-52) |
| Status lifecycle | DEFECTIVE (vestigial) | all instances "draft" forever (PDS-42, live-confirmed ×4) |
| Actor truth | PARTIAL | created_by real or "Unauthenticated"; `last_edited_by` never written (PDS-54) |

## Documents/storage feeding the studio
| Feature | Verdict | Notes |
|---|---|---|
| Tender 3-step upload chain | COMPLETE | compensating rollback + honest step-3 disclosure (old-app orphan messaging FIXED); orphan invisible afterwards (PDS-14) |
| Proposal supporting-doc download | DEFECTIVE | silent no-op (PDS-15) |
| Export → document store | MISSING | no vault capture of exported finals (PDS-25) |
| Archive semantics | PARTIAL | dual-store archive works in Library; category destroyed (PDS-26); archived still counted in buckets (PDS-28) |

## Automated evidence (measured 2026-08-24)
tsc 0 errors · vitest **978/978, 70 files** (×2 runs) · build PASS **2,495 modules** · PDF-studio suite 101 tests/13 files · dist scan: 0 old-app strings, 0 localhost:3001 · no `../` escapes the repo. Note: the tasking brief cited "960/960 expected"; the measured suite at this commit is 978/978.
