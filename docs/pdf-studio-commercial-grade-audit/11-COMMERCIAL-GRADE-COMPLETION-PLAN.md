# 11 — COMMERCIAL-GRADE COMPLETION PLAN
Ordinary product work only — no gates, locks, enforcement, or AI activation. Ordered by what stops a real Hala document from being right, then by what stops the human from trusting the tool, then polish. Register refs → [07](07-DEFECT-AND-GAP-REGISTER.md). Estimates are relative sizes (S/M/L), not commitments.

## Phase 1 — Document content correctness (the six blockers)
| # | Work item | Fixes | Size |
|---|---|---|---|
| 1.1 | Customer-facing pricing projection: render revenue/description columns only in customer_facing packs; format numbers (SAR, GP rounding) at projection time | PDS-01, PSRC-08 | M |
| 1.2 | Render the clause library: `clauses` branch in `renderBlock` (EN, `content_ar` where present) + clause-aware editor; honest empty state when no published clauses | PDS-02 | M |
| 1.3 | Interpolate block variables (`{{recipient_name}}` et al.) in `renderHtmlBlock`; add `recipient_name` to the standalone variable map; surface unresolved tokens via the existing `findUnresolvedVariables` in WarningBanner | PDS-03, PDS-41 | S |
| 1.4 | Fix the SLA matrix field mapping (`kpi_name`/`measurement_method`; decide penalty source honestly); honor `include_in_proposal` | PDS-04 | S |
| 1.5 | Drafting ingestion: match on `block_type`/`document_assembly_target` with title fallback; ingest unmatched drafted blocks as additional sections; push loader warnings for anything dropped | PDS-06 | M/L |
| 1.6 | Locale-tolerant revenue parsing + honest "cannot parse" state in totals | PDS-09 | S |

## Phase 2 — Truthful controls in the edit loop
| # | Work item | Fixes | Size |
|---|---|---|---|
| 2.1 | Real "Refresh from source": re-run `loadTenderPack`, rebuild `_original_blocks`/`_hash`, preserve edited blocks with a per-block diff choice — or, minimum viable, relabel to "Restore original snapshot" and add a "Rebuild from current source" that creates a fresh instance | PDS-05 | M (relabel: S) |
| 2.2 | Per-card "Reset from source" wired to the actual block; remove the toolbar item | PDS-10 | S |
| 2.3 | Re-seed open rich-text editors on external content change (undo/reset/restore/reload-latest) | PDS-11 | S/M |
| 2.4 | Sync the concurrency token after self-writes (branding); add zero-row recheck disambiguation (deleted vs conflict) to match the tender-wave standard; read back the stored payload on save | PDS-13, PDS-51-adjacent | M |
| 2.5 | Surface the text-only renderer fallback distinctly (renderer value + outcome text); fallback-aware cover placeholder | PDS-12, PDS-29 | S |
| 2.6 | Honest default-prose handling: check `source_status==="not_captured"` before `default_content`, or badge template text visibly | PDS-16 | S |

## Phase 3 — Missing capability that real documents need
| # | Work item | Fixes | Size |
|---|---|---|---|
| 3.1 | Commercial-terms + Quote-stage resolvers (rows flagged `include_in_proposal` → terms/annexure blocks; quotation packs reflect the recorded quote) | PDS-07 | M |
| 3.2 | Bilingual pack: real EN/AR rendering (dir=rtl, AR fonts, VAT columns) — or relabel the card until built | PDS-08 | L (relabel: S) |
| 3.3 | Proposal parity: thread `sourceKind` (labels + `linked_entity_type`), normalize before the scenario picker, proposal solution-design → SLA/scope projections, header entry button + standalone picker inclusion | PDS-18/20/24/43, PDS-69 | M |
| 3.4 | Documents into packs: evidence/annexure resolver over active (non-archived) documents; include in drift hash | PDS-23, PDS-59 | M |
| 3.5 | Export capture: optional "save to vault" after final export (existing writer); fix the 501 route's false claim | PDS-25 | S/M |
| 3.6 | Proposal supporting-docs download fix; vault/register orphan reconciliation view + relink | PDS-15, PDS-14 | M |
| 3.7 | Pricing/SLA row add/remove; volume membership editing or "not in any volume" indicator | PDS-37, PDS-38 | M |
| 3.8 | Status lifecycle: truthful transition on final export (or drop the badge); write `last_edited_by`; real actor in `saveRecipeVersion` | PDS-42, PDS-54 | S |
| 3.9 | SOW → scope.table real mapping (or retire the block); rate-card resolver or rename | PDS-21, PDS-22 | S/M |

## Phase 4 — Layout, fidelity, hygiene
| # | Work item | Fixes | Size |
|---|---|---|---|
| 4.1 | Composer sizing: fill the layout slot (kill the 104px double scroll); fixed-A4 preview with scale-to-fit | PDS-33, PDS-34 | S/M |
| 4.2 | One responsive breakpoint: stack panes, wrap header, touch-target pass | PDS-35 | M |
| 4.3 | Dialog a11y (Esc, focus, role=dialog), aria-label pass, keyboard resizer | PDS-36 | S/M |
| 4.4 | Export determinism: await `document.fonts.ready` + image decode; per-page watermark in raster path; honor-or-remove footer flags; filename ref/customer + Unicode | PDS-30/31/32/45/46 | M |
| 4.5 | Route identity guard on param change (mirror W04-T08-A); drift keyed to instance `linked_entity_id`; ticket_type check on connected routes | PDS-17/19/58 | S |
| 4.6 | Delete dead code (legacy sync, unused hook saves, inert server branch, "Image cover" mode, drag handles or wire DnD); one name for the studio; tender wording pass | PDS-44/56/66/68/43 | S |
| 4.7 | Tests: active autosave/concurrency path, undo/redo stack, version append/restore, popup-blocked export, real renderer smoke, editor components; clear the 800ms print timer | PDS-73 | M |
| 4.8 | Remaining polish: archived badges/filters, register archive category preservation, metadata single-writer, HTML export image inlining, blank-doc refNumber, empty-customer resume labels | PDS-26/27/28/48/57/72 | M |

## Sequencing note
Phase 1 + items 2.1–2.3 are the minimum before a real Hala tender or proposal document should be exported for a customer: they are the difference between "the document contains what the user believes it contains" and today's state. Phases 3–4 make the studio dependable and pleasant; none of it requires schema changes beyond additive columns/flags, and nothing here introduces gates or locks.
