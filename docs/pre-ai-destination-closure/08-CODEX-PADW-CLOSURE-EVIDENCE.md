# Pre-AI Destination and PDF Truth Closure - Codex Evidence

**Date:** 2026-08-25

**Application:** `hala-clean-commercial-engine`

**Execution branch:** `padw/integration`

**Starting commit:** `b27a246`
**Scope:** Human-first Tender and Proposal intake, tracker persistence, FinalPack handoff, responsive behavior, and source isolation. No AI runtime, bots, gates, locks, compliance enforcement, or Sprint X work was performed.

## Executive Verdict

The approved human workflow is functionally ready for the next AI-integration build phase:

1. A user can create a Proposal or Tender through CRM intake.
2. The new record opens under the correct clean-app identity.
3. CRM and internal tracker stages save to the correct commercial ticket and survive reload.
4. Proposal stage payloads save to all 11 destination envelopes and survive reload.
5. Tender data saves into its established stage-owned destinations without losing sibling data.
6. Proposal and Tender records open their own FinalPack Studio documents.
7. Edited FinalPack content survives reload and appears in the preview.
8. The clean app builds in a scratch directory that contains no old Hala source tree.

This evidence supports starting AI integration against published destination contracts. It is not a claim that an AI extraction or population runtime already exists.

## Live UAT Records

Two synthetic records were created through the normal CRM intake UI:

| Flow | Ticket ID | Source reference |
|---|---|---|
| Proposal | `c029b477-205f-4b72-8254-f2e37f3d5ab9` | `CODEX-UAT-PROPOSAL-20260825` |
| Tender | `b4d599c9-d27a-4c88-99c9-8a7270c91432` | `CODEX-UAT-TENDER-20260825` |

The first Proposal intake click coincided with a session refresh and sent no POST request. That was a browser-session race, not a false-success product defect. The successful attempt produced the ticket listed above.

## Proposal Evidence

- All 10 CRM-stage moves were persisted and audited.
- The internal Proposal tracker recorded 30 changes during the round-trip, move-save, and correction tests.
- All 11 stage destinations exist under `commercial_tickets.type_details.proposal_workspace`:
  - `qualified`
  - `discovery`
  - `solution_design`
  - `pnl_pricing`
  - `quote`
  - `proposal_drafting`
  - `proposal_sent`
  - `negotiation`
  - `commercial_approval`
  - `contract_signed`
  - `go_live`
- Each destination has a corresponding audit entry proving a confirmed save.
- Saved blank checkpoints reload as **Saved** instead of being discarded as empty.
- A tracker move followed immediately by a payload save succeeds without a stale-revision error.
- Legacy/title-case stage values normalize for display without rewriting stored truth.
- FinalPack created a Proposal-owned 13-block pack. The edited text `CODEX UAT Proposal Pack Narrative 2026-08-25` survived route reload and appeared in the preview.

## Tender Evidence

- All 15 internal stages rendered and were navigable.
- The internal tracker recorded 19 audited changes, including all 15 stage positions, the Awarded branch, and return to Identified.
- All 10 CRM-stage positions were persisted and audited, returning to Prospecting.
- The Intake & File Audit value `CODEX UAT tender source document inventory` saved, reloaded, and displayed **Saved**.
- The Qualification SOW evidence `CODEX UAT warehouse scope source evidence` and owner `CODEX UAT scope owner` saved and reloaded.
- Saving a Tender field after a tracker move succeeded without stale-revision loss.
- The Tender header now renders the human label `Saved CRM stage: Prospecting`, not the raw key `prospecting`.
- Persisted Stage 1 data now renders honest save badges across Intake, Clarifications, Compliance, Document Review, and Customer Snapshot surfaces.
- FinalPack created a Tender-owned 13-block pack. The edited text `CODEX UAT Tender Pack Narrative 2026-08-25` survived route reload and appeared in the preview.

## Defects Repaired In This Pass

| Defect | Repair |
|---|---|
| Intake modal retained a previous customer search after close or success | Added one complete reset path for form and visible customer-search state. |
| New ticket defaults used labels that did not match canonical stored stage keys | New records now use canonical lowercase CRM, Proposal, Tender, Renewal, and SLA values. |
| Proposal legacy/title-case values could display in the wrong tracker position | Added explicit CRM and Proposal stage normalization. |
| A Proposal tracker move invalidated the next stage payload save | The confirmed tracker write now returns and propagates the new `updated_at` revision token. |
| JSONB key order could produce a false save/read-back mismatch | Read-back comparison now uses stable JSON serialization. |
| Intentionally saved blank Proposal stages reloaded as Not Saved | Saved envelopes are recognized by their saved timestamp even when `data` is empty. |
| Persisted Tender Stage 1 values reloaded with a false Not Saved badge | Save state now hydrates from real persisted checkpoints. |
| Tender CRM header exposed a raw database key | It now maps to the human CRM label without changing stored data. |
| Proposal mobile tracker header overlapped its move-stage control | Header and action now stack on mobile and retain the desktop row layout. |

## Browser Verification

Authenticated browser UAT was run against `http://localhost:5310`.

| Surface | Desktop | Mobile 390 x 844 | Result |
|---|---|---|---|
| Tender workspace | Verified | Verified | Trackers, header, stage task area, and controls visible without incoherent overlap. |
| Proposal workspace | Verified | Verified after repair | Tracker header no longer overlaps the move control. |
| Tender FinalPack selector/editor | Verified | Verified | Correct identity, pack resume, toolbar, warnings, blocks, and preview visible. |
| Proposal FinalPack selector/editor | Verified | Verified | Correct identity, pack resume, templates, and truthful pricing-empty state visible. |

The browser viewport override was reset after mobile verification.

## Automated Verification

| Check | Result |
|---|---|
| Focused persistence and stage tests | 41 / 41 passed |
| Full test suite | 87 files, 1,152 tests passed |
| TypeScript | `pnpm check` passed with 0 errors |
| Production build | Passed, 2,490 modules transformed |
| Patch whitespace | `git diff --check` passed |
| Old-runtime source scan | 0 functional references; remaining matches are explanatory comments/package prose |
| Production bundle scan | 0 matches for old-app path, `/clean/`, `client/src`, or `localhost:3001` |
| Scratch isolation build | Install, type-check, and production build passed outside the workspace with no old-app source present |

## Test Data Disposition

The two synthetic tickets, their two FinalPack instances, two instance versions, and 85 audit rows remain in the test database. Exact-ID cleanup was attempted only after evidence capture, but the available Supabase execution connection rejected the first update as a read-only transaction. The transaction changed zero rows. No old-app credential was used and no unrelated record was touched.
