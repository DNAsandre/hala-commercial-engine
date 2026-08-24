# 04 — EDITOR / PREVIEW / EXPORT AUDIT
**Baseline:** `e0c7062` · Register refs → [07](07-DEFECT-AND-GAP-REGISTER.md).

## Editor (completeness ~78%)
**Genuinely strong core:** every content-bearing block type has a working human editor — real TipTap WYSIWYG (19 fully-aria-labeled toolbar controls: P/H1-H4, B/I/U, lists, quote, indent, align, link, HR, clear, per-field undo), cover designer (variables, style/mode/alignment, image + PDF upload), field-level pricing/SLA/signature/party editors. Add (custom/page-break/DB-library/reusable), duplicate (deep copy + provenance), remove (confirm, undoable), hide/show, arrow reorder — all real, persisted via autosave. Save-as-Template, Template Library (create/clone/version/publish/retire), branding profiles, version History + restore — all real data end-to-end. Nothing in the editor is a stub except the deliberately-deferred AI runtime.

**Defects:** Reset targets blocks[0] not a selected block (PDS-10 BLOCKER-adjacent, HIGH); undo/redo desyncs open rich-text editors — silent content reversion (PDS-11 HIGH); drag handle decorative (PDS-44); no add/remove row in pricing/SLA tables (PDS-37); volume membership frozen — user-added blocks silently excluded from volume exports (PDS-38); no beforeunload guard for the 2s autosave window; no keyboard undo at block level; zero test coverage on `useFinalPackBlocks` and all 20 editor components.

## Preview (fidelity ~55%)
**Faithful:** single renderer serves preview AND export (`buildPreviewHTML`; selection via one shared `selectRenderedBlocks`, test-pinned) — structural identity is exact. Data-bound empty states honest ("No pricing data captured yet" etc. — confirmed live). Watermark logic honest. Render failures surfaced.

**Breaks fidelity:** clause family never renders — boilerplate ships (PDS-02, live-confirmed); literal `{{recipient_name}}` (PDS-03, live-confirmed in both live packs); default prose masks un-captured sections (PDS-16); Bilingual pack English-only (PDS-08); "gallery" has no images (PDS-47); pagination marker-only with no page count, and the preview page **shrinks with the pane — 507px measured live vs the 595px export width** (PDS-34), so on-screen wraps ≠ PDF wraps; CDN font race (PDS-32); preview hardcoded to draft mode — final look never previewable (PDS-50).

## Export (fidelity ~85%)
**Truth table (per button):**
| Button | Pipeline | Artifact | Honesty |
|---|---|---|---|
| Draft/Test PDF | html2pdf raster (imported-cover: pdf-lib merge path) → print-window fallback | real .pdf or print dialog | delivery language precise |
| Final PDF | server stub (always null, flag inert) → html2pdf → print | same | dead server branch (PDS-73) |
| Print | print window only | Chrome Save-as-PDF dialog | explicitly "print_dialog_opened", cannot-confirm stated — **proven live in the Tender wave** |
| HTML | blob download | byte-exact .html (DRAFT-watermarked always) | signed-URL images expire in 1h (PDS-48) |
| All Volumes | N sequential HTML exports, hardwired final | N files | per-volume failures counted; user blocks excluded (PDS-38) |

**Engines:** 3 live renderers (print window — reference fidelity; html2pdf raster — mild losses; jsPDF text — severe, imported-cover fallback only) + pdf-lib merger. The old app's divergent server PDFKit-from-source engine is **confirmed absent** — the clean server route deliberately returns 501 and renders nothing. Every path serializes the same edited block state (test-pinned) — **no divergent renderer**.

**Residual dishonesty is silent downgrade, not false success:** text-only fallback indistinguishable in UI and audit (PDS-12 HIGH); false placeholder page on failed cover-merge print fallback (PDS-29); watermark on page 1 only in raster path (PDS-31); footer `show_page_numbers`/`show_completed_by` dead (PDS-30); filename convention gaps (PDS-45). Export audit rows (`doc_compiled_outputs`) are confirmed-not-assumed, failures audited — the most honest surface in the audit.

**Not exercised live:** no export buttons were clicked (read-only ruling — exports write audit rows). Confidence rests on source, 9 passing export tests + 19 fidelity tests, and the 2026-08-21 Tender-wave live export of the same pipeline (content-identity proven then).
