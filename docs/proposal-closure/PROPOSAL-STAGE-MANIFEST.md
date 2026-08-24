# Proposal Stage Manifest

**Date:** 2026-08-24  
**Scope:** Human-first Proposal workflow destinations before AI integration.

All stage rows below use the shared exact-row, revision-aware, read-back-confirmed persistence contract in `proposal-workspace-persistence.ts`.

| # | Stage | Main destination | Persistence state | Downstream handoff |
|---:|---|---|---|---|
| 1 | Qualified | Qualification facts, contacts, requirements | Implemented and contract-tested | Discovery |
| 2 | Discovery | Discovery findings and customer needs | Implemented and contract-tested | Solution Design |
| 3 | Solution Design | Proposed operating solution | Implemented and contract-tested | P&L / Pricing |
| 4 | P&L / Pricing | Revenue, costs, overhead, margin scenarios | Implemented and contract-tested | Quote can copy working P&L |
| 5 | Quote | Commercial quote tied to working P&L | Implemented and contract-tested | Proposal Drafting |
| 6 | Proposal Drafting | TOC, source map, blocks, volumes, evidence, review | Implemented and contract-tested | Final Pack Studio |
| 7 | Proposal Sent | Sent version, attachments, delivery notes | Implemented and contract-tested | Negotiation |
| 8 | Negotiation | Negotiation notes and revised document versions | Implemented and contract-tested | Commercial Approval |
| 9 | Commercial Approval | Human-recorded approval information | Implemented and contract-tested | Contract Signed; no enforcement added |
| 10 | Contract Signed | Contract facts and real signed-document reference | Implemented and contract-tested | Go Live |
| 11 | Go Live | Handover and activation record | Implemented and contract-tested | Operational follow-through |

## Cross-stage rules now enforced by code

- A stage save owns only its stage envelope and preserves every other stage.
- A stale browser revision cannot silently overwrite newer Proposal truth.
- A saved badge follows confirmed persistence, not a local click.
- Archived documents are not offered as live source material.
- Document relationships store actual document IDs rather than free-text names.
- Only one P&L scenario can be working/approved at a time.
- Quote can use the selected working P&L instead of retyping commercial truth.
- Proposal Drafting can open the same Final Pack Studio used for export.
- No AI output, approval result, CRM synchronization, or audit success is fabricated.

## Human-UAT status

The current real Proposal at `/proposals/089447d6-6d4f-4921-9df3-92483f36233a` passed an authenticated read-only browser walkthrough at Stage 6. Write/reload coverage across every stage remains the final human sign-off run.
