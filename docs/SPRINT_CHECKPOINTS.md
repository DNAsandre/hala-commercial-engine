# Sprint Checkpoints

## checkpoint_persist_wave2_verified

**Date:** 2026-03-02
**Checkpoint ID:** (see Manus checkpoint below)

### What Was Tested

Four truth tests were executed against the Almarai workspace (w5) to validate the end-to-end document persistence pipeline before beginning the Supabase-first migration sprint.

| Test | Description | Result |
|------|-------------|--------|
| TT1 | Workspace → New Quote → choose template → save → confirm it appears in Workspace Documents | PASS |
| TT2 | Hard refresh (Ctrl+Shift+R) → confirm the quote still appears | PASS |
| TT3 | Open Output Studio (View) → confirm tokens render as expected | PASS |
| TT4 | Click "Back to Workspace" → confirm it returns to workspace (not orphan page) → Documents tab accessible | PASS |

### What Passed

All four truth tests passed. The document creation, persistence, retrieval, and rendering pipeline is functional. The Documents tab now reads from the canonical `doc_instances` table (Wave 2 architecture) instead of the legacy `quotes` table.

### Pre-Test Fixes Applied

Two issues were discovered and fixed during Step 0 validation:

1. **Schema drift — missing `bindings` column:** The `doc_instance_versions` table was missing a `bindings` column (type: `jsonb`, NOT NULL, default `'{}'::jsonb`). This was fixed via `ALTER TABLE` SQL migration in Supabase. No application code was modified for this fix.

2. **Read-path mismatch — Documents tab:** The workspace Documents tab was reading from the legacy `quotes` table while the document creation flow writes to `doc_instances`. The read path in `WorkspaceDetail.tsx` was refactored to query `doc_instances` filtered by `workspace_id`, displaying title, doc_type, status, and created_at. The legacy `quotes` table remains intact for the Commercial tab's pricing data.

### Tables Verified

| Table | Row Exists | Key Fields Verified |
|-------|-----------|-------------------|
| doc_instances | Yes | id: doc-1772456107878, workspace_id: w5, customer_name: Almarai, doc_type: quote, status: draft |
| doc_instance_versions | Yes | id: doc-1772456107878-v1, 8 blocks, bindings JSON populated |
| compiled_documents | No (expected) | Compile was not run during testing |

### Supabase Project

Project name: `kositquaqmuousalmoar`

### Notes

- The `editInstance` URL parameter from Output Studio's "Back to Workspace" navigation is present but not consumed to auto-open the composer. This is a minor UX gap, not a blocker.
- The Commercial tab and Contracts tab still reference `wsQuotes` (legacy quotes table) for pricing data. This is intentional — those are legacy commercial summary records, not document instances.
