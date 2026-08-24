# 02 — TENDER SOURCE-TRUTH MAP
**Baseline:** `e0c7062` · Loader: `loadTenderPack` (`src/lib/final-pack-loader.ts:395-566`), per-block resolvers `:576-673`. Register refs → [07](07-DEFECT-AND-GAP-REGISTER.md).

| Tender source (commercial_tickets) | Pack destination | Verdict | Evidence / register |
|---|---|---|---|
| `ticket_title`, `customer_name` (+ legacy `type_details.tender.*`) | cover, confidentiality, signature, party details | COMPLETE | loader :679-713, :908-942 |
| `target_date` | cover date | PARTIAL — missing → silently today's date | :687, PDS-60 |
| Tender reference | cover "Ref:" | PARTIAL — no writer exists; UUID first-8 fallback renders customer-facing | :686, PDS-60 (live: "Ref: 7483c493") |
| `pricing.scenarios.rows` | pricing table blocks, rate card, VAT-bilingual table | PARTIAL/DEFECTIVE — 7 summary fields flow; internal cost/GP%/recommended/notes render customer-facing; raw unformatted strings | :812-857; preview :401-414; **PDS-01 BLOCKER** |
| `pricing.scenarios.selected_scenario` | default scenario pick | COMPLETE | :836-840 |
| Selected scenario revenue | totals number-to-words | DEFECTIVE — `parseFloat("1,200,000")` → SAR 1.00 | :888-897, PDS-09 |
| `pricing.commercial_terms` (payment, VAT, validity, surcharges, exclusions, assumptions — each with `include_in_proposal`) | — | MISSING — no reader | tender-pricing-types.ts:174-241, PDS-07 |
| `pricing.pnl_snapshot` / `cost_inputs` / `approval` | — | MISSING (rate card would be the natural consumer) | PDS-22 |
| `tender_drafting.proposal_blocks` content | 5 narrative slots (intro, scope list, closing, annexure A, annexure D) | PARTIAL — content flows (test-pinned) but title-heuristic matching, first-match-only; 13+ of 18 drafted block types have no destination, silently dropped | :715-774, **PDS-06 BLOCKER** |
| Drafted block `approval_status` / dept reviews | — | MISSING — ingested regardless (no-gate consistent; recorded as Sprint X observation, doc 10) | |
| `sow_data` (SOW capture) | scope.table | DEFECTIVE — dead mapping (`scope_items`/`deliverables` never written) | :776-780 vs sow-data-types.ts:57-97, PDS-21 |
| `solution_design_data.sla_kpi.kpis` | annexure B SLA matrix | DEFECTIVE — field mismatch (`kpi_name`/`measurement_method` vs `kpi`/`measurement`/`penalty`); claims "populated" | :961-966 vs SLAKPIModelTab.tsx:45-71, **PDS-04 BLOCKER** |
| other `solution_design_data` (config, HOP/HAM/HIP, scope matrix, assumptions) | — | MISSING | |
| `clause_library` published rows (EN+AR) | terms.standard, legal.clauses | DEFECTIVE — fetched into `content.clauses`, never rendered or editable; boilerplate ships marked "populated" | :467-479, :901-906; preview :360-369; **PDS-02 BLOCKER, live-confirmed** |
| `type_details.documents` (uploads) | — | MISSING — no resolver, absent from drift hash | PDS-23 |
| `submission_readiness` registers | — | MISSING from packs (Stage-9 checklist only — correct there) | |
| qualification / bid-no-bid / risk / compliance / approval facets | — | MISSING (internal-facing; exclusion arguably correct, undocumented) | |
| Arabic content | — | MISSING — no AR fields in tender model; clause `content_ar` loaded, never rendered | PDS-08 |

## Drift / refresh behavior
- Snapshot at creation: `_hash` (SHA-256 of `buildTenderSourceData` :270-285), `_original_blocks`, source data, layout, volumes (`useFinalPackInstance.ts:185-206`).
- Detection honest on the tender route: same projection both sides (W04-T09 correction), "could not check" ≠ "unchanged" (`useSourceDrift.ts:60-124`). **Observed live**: the July Linde pack correctly shows "Tender source has changed since this pack was created."
- **The remedy is mislabeled (PDS-05 BLOCKER)**: "Refresh from source" restores the frozen creation-time snapshot (`PdfStudio.tsx:641-643`; `useFinalPackBlocks.ts:19` "Does NOT re-read commercial_tickets"), discards edits, never updates `_hash` — the only real refresh is creating a new pack.
- Standalone-resume gap: drift keyed to URL param → silently skipped for connected docs resumed at `/pdf-studio` (PDS-19).
- Hash scope drift: includes never-ingested fields, excludes documents (PDS-59).

## Tender → Studio entry points (census)
1. TenderWorkspace header "Final Pack Studio" (`TenderWorkspace.tsx:1728-1734`, always enabled, no-gate) → route only.
2. Stage 9 "Open Final Pack Studio" (`FinalApprovedStage.tsx:727-733`; adjacent readiness checklist advisory-only).
3. Standalone TenderPicker (`PdfStudio.tsx:930-1025`; active tenders, process-isolation filtered).
4. Per-tender Resume list (`PackSelector.tsx:318-341`; `linked_entity_type='tender'` + exact id).
TenderSplitPackGenerator exists only in the old app — not an entry point here.

## Completeness: **~35% (PARTIAL)**
What reaches a rendered pack: identity/cover metadata, pricing summary rows + scenario choice, up to 5 title-matched narrative sections. What does not: entire SOW capture, 3 of 4 SLA columns, all commercial terms/VAT/validity, legal clause content, uploaded documents, most drafted block types, all Arabic, rate/cost detail. The snapshot/drift architecture is genuinely well-built; its headline remedy does not refresh. (Lane: tender-source-truth; full detail in the lane report within this audit's transcript.)
