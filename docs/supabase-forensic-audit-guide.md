# Supabase Forensic Audit Guide

Date: 2026-05-21  
Owner: Hala Commercial Engine  
Status: Human-run audit step

## Purpose

This is the next safe phase after repo cleanup.

The codebase has been cleaned to stop future mock/seed pollution. Now we must inspect the live Supabase database to find what already exists there before any cleanup SQL is written.

## File To Run

Run this file manually in Supabase SQL Editor:

`docs/supabase-forensic-audit-readonly.sql`

It is SELECT-only. It does not update, delete, drop, create persistent objects, or mutate business data.

## What To Copy Back

Copy every result panel from Supabase back into the review thread, especially:

- Table inventory and row counts.
- Columns carrying `mock` or `test` vocabulary.
- `commercial_tickets` canonical ticket snapshot.
- Canonical lineage gaps.
- Legacy master table samples.
- Tender child parent map.
- Tender contamination fingerprints.
- Proposal/SLA/escalation child samples.
- Lineage-column inventory.

## What I Will Classify

After you paste the results back, I will classify every relevant row/table into:

- `canonical_keep`: already belongs in the real source of truth.
- `migrate_to_canonical`: real data, but currently attached to legacy table/id.
- `archive_only`: useful history, but not operational truth.
- `delete_candidate`: mock/test/seed junk with no business value.
- `needs_human_review`: ambiguous, must not be automatically touched.

## Current Expected Red Flags

The audit is specifically hunting:

- Legacy `tenders` rows if any remain.
- Legacy `commercial_opportunities` rows still used as proposal truth.
- Tender child rows pointing to old IDs like `tn-linde-001`.
- V2 tables or V2 rows.
- `commercial_mock_escalations`.
- `commercial_proposal_versions` and `commercial_sla_drafts` rows that look seeded/mock-like.
- Document vault or transportation rows that were previously seeded.
- Rows without source lineage.
- Any row containing `mock`, `test output`, `draft_mock`, `ready_mock`, `simulated`, `example-client`, or `hala.example`.

## Do Not Do Yet

Do not run cleanup SQL yet.

No delete, drop, update, table rename, or migration should happen until we have:

1. Audit output.
2. Row classification.
3. Human-approved migration/archive plan.
4. Human-reviewed SQL.

## Intended Next Step

After the audit output is pasted back:

1. Build a table-by-table migration/archive decision matrix.
2. Produce SQL for human review only.
3. Apply cleanup in controlled batches.
4. Verify app views after each batch.
