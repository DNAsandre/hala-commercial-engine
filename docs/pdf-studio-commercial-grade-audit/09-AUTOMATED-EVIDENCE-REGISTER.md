# 09 — AUTOMATED EVIDENCE REGISTER
**Measured 2026-08-24 at `e0c7062`** (branch `proposal-functional-closure`, clean tree). All numbers measured this session — none inherited.

## Gates
| Gate | Command | Measured result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **0 errors** |
| Full suite (run 1) | `npx vitest run` | **70 files / 978 tests — all pass**, 13.55s |
| Full suite (run 2) | `npx vitest run` | **70 / 978 — all pass**, 12.31s |
| Unhandled errors/timers | grep of both outputs | **0** — the known `openPrintablePdf` 800ms teardown flake did not appear in any of 3 runs (non-occurrence ≠ impossibility; timer still never cleared — PDS-73) |
| Build ×2 | `npx vite build` | **PASS, 2,495 modules**; 1 warning: 5 chunks >500kB (TenderWorkspace 1,189kB · html2pdf 976kB · PdfStudio 636kB · ProposalWorkspace 634kB · index 529kB) |
| Baseline-integrity note | — | The tasking brief cited "expected 960/960"; the measured suite at this commit is **978/978** (two runs). Reported as measured. |

## PDF-Studio test inventory (verbose-run measured: 13 files, 101 tests, all pass)
| File | Tests | Asserts |
|---|---|---|
| PdfStudio.sources.test.ts | 1 | tender-picker classification (active tenders only, seeds excluded) |
| PackSelector.test.tsx | 8 | date formatting never "Invalid Date" |
| ExportToolbar.test.tsx | 4 | export-outcome honesty language |
| VersionHistoryPanel.test.tsx | 7 | date formatting |
| WarningBanner.test.tsx | 6 | volume-scoped warning counts, no reorder |
| final-pack-reads.test.ts | 10 | honest errors ≠ empties; drift projection parity; "unknown" on failure |
| final-pack-export.test.ts | 9 | delivery truth (file vs print-dialog vs failure); audit rows confirmed-not-assumed |
| final-pack-fidelity.test.ts | 19 | recipe round-trip; preview/export same selection; drift-hash parity; server-PDF off = null never fake success; honest empty rendering |
| final-pack-proposal.test.ts | 2 | proposal projection into the contract; drift inclusion |
| final-pack-tender-mapping.test.ts | 6 | edited blocks reach the doc; never-drafted = not_captured, no fabricated HTML |
| FinalApprovedStage.checklist.test.ts | 15 | register reads; archived docs can't satisfy; actor truth |
| document-vault.test.ts | 9 | version path resolution; archive/restore confirmed |
| useTemplates.test.ts | 5 | template writes: summary only when both rows land |

## Missing-coverage census (import-graph measured; not line coverage)
Zero test references: `final-pack-layout`, `final-pack-volumes`, `final-pack-snapshot-contract`, `normalize-final-pack-snapshot`, all 3 bot-runtime modules, all 3 source adapters, `document-source`, `template-variables`, `useCustomBlocks`, and **20 components** (BlockEditor, BlockCard, BlockPicker, CoverEditor, PricingEditor, SlaEditor, SignatureEditor, RichTextToolbar, PreviewPane, RecipeEditor, dialogs, StartScreen, SourceDriftBanner, TemplateBuilder, TemplatePicker, UndoRedoToolbar, …).
Zero-coverage behaviors: editor interactions (PdfStudio.tsx 1,025 lines / 1 helper test), undo/redo stack, **the entire active autosave + concurrency path**, version append/restore logic, popup-blocked export branch, the real (unmocked) html2pdf/jsPDF renderer, imported-PDF cover path, image handling, RTL.

## Scans
| Scan | Result |
|---|---|
| `src/` old-app refs (`hala-commercial-engine`, `localhost:3001`) | 5 hits — all comments/negative-test; **0 functional** |
| `dist/` (81 assets, post-build) | **0 hits** for both strings |
| Import-graph escape (`../` ×2+, dynamic imports, aliases, file: deps) | **0 escapes** — nothing resolves outside the repo |
| Mock/fabricated-success markers in the FPS surface | 34 lines — 22 in tests (mock scaffolding), 12 production, **all honest comments/features**; 0 TODO/FIXME/lorem |

## Read-only DB probes (anon key, GET only; key never printed)
`doc_instances`, `doc_instance_versions`, `doc_compiled_outputs`, `generated_documents` → 200 `[]` (tables exist; contents authenticated-only — absence proves nothing). One storage list probe returned folder names from the private `documents` bucket under anon — reconfirms the standing Wave-0 RLS finding (Sprint X list, doc 10). Live composer reads during the walkthrough confirmed real instance data renders (4 instances, correct customers).
