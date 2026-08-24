# TENDER-LEFT-BEHIND-INVENTORY
**Wave:** Tender Functional Closure · integration `0035872` · **Author:** Fable (from TCW-MAP-SIGNALS census — full evidence in `TCW-SIGNALS-CENSUS.md` — plus lane dispositions)

## Removed this wave (conclusive orphan proof at removal)
| Item | Evidence / disposition |
|---|---|
| Packs/tender_builder mega-branch in `TenderWorkspace.tsx` (~155 lines incl. `PackCard`, no-op advisory buttons, "Review Submission Email" opener) | No stage tab list produces those tab ids; interceptors above claimed the rest; build module count −3 confirms the orphaned components left the graph (T2) |
| `submission_readiness` → gates-tab route; split-pack/email-review dialog openers + state | Same proof (T2) |
| No-op `_insertAuditEvent` + 12 call sites | Was `void params` — implied a second audit stream that never existed (T1) |
| Mock-word row-hiding in Activity/AuditTrail tabs (F6) | Stored rows containing "mock"/"sample"/etc. were silently hidden; filters removed, counters over the full set (T4) |
| Hardcoded 14-item `REQUIRED_DOCS` + first-word fuzzy matching (F4/B17/B18) | Replaced by the recorded submission_readiness register; empty → honest "no requirement set recorded" (T4) |
| Mount-time `DEFAULT_KPI_NAMES` seeding (F7) | Template rows no longer persist as captured scope; suggestions are click-to-add (T3) |
| `deriveTenderAssessmentFlags` helper (T2) | Superseded at integration — T1's single-register-read model made a two-input helper vacuous (Fable) |
| `TenderSubmissionGatesTab.tsx`, `TenderSplitPackGenerator.tsx`, `TenderSubmissionEmailReview.tsx` | Proven unreachable by the source graph and removed in the 2026-08-24 polish pass |
| `updatePackStatus`, `updateGateStatus`, `logMockBypass`, `logEmailSimulation`, `insertTenderPackOutput` | Zero callers after the dead surfaces were removed; refusal-only APIs removed in the 2026-08-24 polish pass |

## Left behind — compatibility projections retained
| Item | State |
|---|---|
| Legacy read-stub bundle fields (`packs`, `splitChecks`, `packOutputs`, `submissionEmails`, `crmSyncStatus:'not_synced'`) | Honest empties; consumers of the removed branch gone; header CRM badge remains a recorded-value display |
| Legacy lossy projections `bundle.placeholders/requiredDocuments/complianceItems` | Kept so pre-wave renderers compile; documented LOSSY (canonical truth = `bundle.submissionReadiness.facet`) |

## Explicitly out of scope (standing rulings, unchanged)
AI generation/drafting/review (throws SX-001/SX-011 — labels now honest); RBAC on review tabs (documented TODO A15); approval enforcement/gates/locks (none exist, none added); `changeStage`/CrmPipeline shared kanban internals; `ai-runs.ts`/`ProcessStageTaskShell` (boundary/shared files, untouched); Proposal/Renewals/System surfaces (untouched by construction).

## Dead code candidates surviving for a future clutter pass (recorded, not removed)
Unreachable AI success paths behind always-throwing generation (`FinalApprovedStage` 423-439-class, `DepartmentalReviewTab` 378-460-class, TOC/chain success branches); stale header comments in those regions; `intake-save.updateTicket` (zero callers, dormant hazard noted in the data register). `deactivateTicket` is now the confirmed-write archive operation used by Tender Overview.

## 2026-08-24 repair disposition
- The prior absence of Tender recovery is closed: Archived Tenders can be listed and restored through a confirmed stored write with read-back.
- The prior dual-document-store archive risk is closed for the user workflow: archive coordinates both records where present, supports canonical-only records, and compensates to the exact previous vault status on failure.
- Archived documents are no longer treated as active Tender evidence or readiness inputs.
- Hard deletion remains intentionally absent. Reversible archive is the available human command.
- The remaining dead-code candidates listed above concern deferred AI execution paths and are not part of this human-first Tender repair.
