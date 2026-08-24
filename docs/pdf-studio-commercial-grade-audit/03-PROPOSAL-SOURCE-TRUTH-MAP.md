# 03 — PROPOSAL SOURCE-TRUTH MAP
**Baseline:** `e0c7062` ("Complete Proposal workflow and PDF handoff") · Ingestion path: `normalizeCommercialTicketDetails` (`src/lib/final-pack-loader.ts:292-340`) — projects `type_details.proposal_workspace` into the tender-shaped contract, then the SAME loader/renderer as tenders (no divergent path; pinned by `final-pack-proposal.test.ts`, 20/20 relevant tests pass). Register refs → [07](07-DEFECT-AND-GAP-REGISTER.md).

## What the projection reads
Exactly **two of the eleven** stage envelopes: `proposal_workspace.proposal_drafting` and `proposal_workspace.pnl_pricing`.

| # | Workspace stage / field | Pack destination | Verdict |
|---|---|---|---|
| 1 | Qualified (4 groups) | none | MISSING |
| 2 | Discovery (5 groups) | none | MISSING |
| 3 | Solution Design (8 groups incl. serviceScope, SLA expectations) | none — SLA/scope blocks read tender-shaped keys proposals never write | MISSING (PDS-24) |
| 4a | P&L `pnlVersions` (revenue/cost incl. 10% overhead, GP, notes) | pricing tables, rate card, totals | COMPLETE values; PDS-01 internal-column exposure applies; raw strings, long floats (PSRC-08) |
| 4b | `activePnlVersion` | selected scenario | COMPLETE |
| 4c | costInputs, pricingLines, marginScenarios, **commercialTerms**, assumptions | none | MISSING (PDS-07) |
| 5 | Quote stage (summary, scope, pricing summary, terms, versions) | none — even quotation packs price from the P&L projection | MISSING (PDS-07) |
| 6a | Drafting `proposalDraftBlocks` | projected into `tender_drafting.proposal_blocks` → the 5 title-heuristic narrative slots | PARTIAL/DEFECTIVE (PDS-06) — proposal `block_key = sectionId` (generated `toc-N`), so matching rides on title text only |
| 6b | `proposalTocSections` | title fallback | PARTIAL |
| 6c | sourceMap, technical/commercial volumes, evidenceItems, appendixNotes, finalDraftReview | none | MISSING |
| 7–11 | Proposal Sent / Negotiation / Commercial Approval / Contract Signed / Go-Live | none | MISSING (defensible for post-send lifecycle; negotiation/contract pricing changes also can't inform a regenerated pack) |
| — | Ticket columns (title, customer, target_date) | cover/confidentiality/signature/party | COMPLETE |
| — | Supporting documents (real vault IDs recorded in stages 6–10) | none | MISSING — parity-equal with tender |

## Proposal → Studio handoff
| Aspect | Status |
|---|---|
| Route `/proposals/:proposalId/final-pack` | WORKS — live-verified (KAFD): correct title/customer, "Back to Proposal", existing pack resumed, preview rendered |
| Entry points | ONE — Drafting-stage "Open PDF Studio" (`ProposalStageWorkbench.tsx:2174-2178`); no workspace-header button, no standalone-picker inclusion (tender has 3) (PDS-69) |
| Identity threading | Correct incl. legacy-workspace-id → `crmDealId` mapping (`proposal-identity.ts:53-54`) |
| Instance labeling | `linked_entity_type='tender'` mislabel (PDS-18) — self-consistent resume, wrong provenance |
| Scenario picker at handoff | reads RAW `td.pricing` → proposal P&L versions never listed; banner claim false when versions exist (PDS-20). **Live note:** KAFD has 0 P&L versions, so the observed banner was truthful; the defect arms only when versions exist |
| Drift detection | includes the proposal projection (test-pinned); live KAFD pack showed no banner — consistent: its hash-relevant fields (drafting/P&L) were empty at creation and remain empty (DB-probed read-only) |
| Tender wording on the proposal path | 6+ unconditional strings (PDS-43); conditional branches (not-found, pricing banner "for this proposal", back-link) correct — pricing banner wording confirmed live |
| Export content | same renderer as tender; `{{recipient_name}}` + terms boilerplate confirmed live in the KAFD pack preview (PDS-02/03) |

## Completeness
- **Proposal source-truth ingestion: ~45%** — weighted across the eight source-dependent content families: cover/meta 1.0, narrative 0.5 (five slots, silent drops), pricing 0.85, totals 1.0, scope 0, SLA 0, quote-stage 0, documents 0 (parity-equal).
- **Proposal handoff: ~80%** — route, entry button, dual-source selector, instance create/resume, drift inclusion, back-nav, shared engine all code-verified and live-walked; docked for single entry point, scenario-picker dishonesty, tender wording, entity-type mislabel.
