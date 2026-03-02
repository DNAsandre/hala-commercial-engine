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

---

## checkpoint_sprint1_guardrails_tokens

**Date:** 2026-03-02
**Checkpoint ID:** (see Manus checkpoint below)

### What Was Implemented

Sprint 1 Runbook — three steps executed in sequence:

| Step | Description | Result |
|------|-------------|--------|
| Step 1 | Storage policy check, in-memory array annotation, shared Supabase error handler | PASS |
| Step 2A | Output Studio "Back to Workspace" navigates to workspace Documents tab | PASS |
| Step 2B | 6 missing tokens (title, subtitle, customer_name, ref_number, date, recipient_name) bound | PASS |

### Step 1 — Guardrails

The `policy:storage` script (`scripts/policy-storage.mjs`) scans `client/src/` for forbidden storage usage (`localStorage`, `sessionStorage`, `indexedDB`). Only `ThemeContext.tsx` uses `localStorage` (allowed exception for theme preference). Eight in-memory business arrays in `store.ts` are flagged as warnings — tracked migration debt for Wave 3A.

A shared error handler (`client/src/lib/supabase-error.ts`) replaces all 23 bare `console.error()` calls in `supabase-sync.ts` with `handleSupabaseError()`, which provides toast notifications, structured console logging, and a ring buffer for recent errors.

### Step 2A — Navigation Fix

Output Studio's "Back to Workspace" button now navigates to `/workspaces/{id}?tab=documents` instead of the generic workspace URL. `WorkspaceDetail.tsx` reads the `?tab=` URL parameter to deep-link directly to the Documents tab.

### Step 2B — Token Bindings

Six short-key token aliases were added to both the async resolver (`token-resolver.ts`) and the sync resolver (`DocumentComposer.tsx`). A timing bug was also fixed — the Output Studio preview now auto-re-renders when the async resolution context updates (added `resolutionCtx` to the useEffect dependency array).

| Token | Resolved Value (Almarai example) |
|-------|----------------------------------|
| {{title}} | Almarai — Standard Quotation |
| {{subtitle}} | Supply Chain Services |
| {{customer_name}} | Almarai |
| {{ref_number}} | HCS-QT-2026-7878 |
| {{date}} | 2026-03-02 |
| {{recipient_name}} | Almarai |

### Files Modified

| File | Change |
|------|--------|
| client/src/lib/supabase-error.ts | NEW — shared error handler utility |
| client/src/lib/supabase-sync.ts | Replaced 23 console.error calls with handleSupabaseError |
| client/src/lib/token-resolver.ts | Added short-key aliases + docTitle/customerName props |
| client/src/pages/OutputStudio.tsx | Pass docTitle/customerName, re-render on context update, back nav fix |
| client/src/components/DocumentComposer.tsx | Added short-key entity bindings to resolution context |
| client/src/pages/WorkspaceDetail.tsx | Read ?tab= URL param for deep-linking |
| scripts/policy-storage.mjs | NEW — storage policy check script |
| package.json | Added policy:storage script |

### TypeScript

0 errors (`npx tsc --noEmit`).

### Supabase Project

Project name: `kositquaqmuousalmoar`

---

## checkpoint_wave3a_core_entities_migrated

**Date:** 2026-03-02
**Checkpoint ID:** (see Manus checkpoint below)

### What Was Implemented

Sprint 2 — Wave 3A Core Entity Migration. Eight legacy in-memory business arrays in `store.ts` were migrated to Supabase reads. Two new features were added: `customer_contacts` table with primary contact resolution, and `company_name` token binding.

| Step | Description | Result |
|------|-------------|--------|
| Step 0 | Freeze Sprint 1 baseline (checkpoint 961ed0dc) | PASS |
| Step 1 | Enumerate 8 arrays, map to pages and Supabase tables | PASS |
| Slice 1 | Migrate Customers — OutputStudio.tsx from array to useCustomer() hook | PASS |
| Slice 2 | Migrate Workspaces — workspace-integration.ts from arrays to Supabase fetches | PASS |
| Slice 3 | Migrate remaining arrays (quotes, proposals, auditLog) | PASS |
| Step 3 | Add customer_contacts table + recipient_name from primary contact | PASS |
| Step 4 | Add company_name token binding from branding profile | PASS |

### Arrays Migrated

All 8 business data arrays in `store.ts` now have zero direct importers. Only types and pure utility functions remain.

| Array | Previous Importer | Migration |
|-------|-------------------|-----------|
| customers | OutputStudio.tsx | → useCustomer() Supabase hook |
| workspaces | OutputStudio.tsx, workspace-integration.ts | → useWorkspace() hook, fetchWorkspaceById() |
| quotes | workspace-integration.ts | → fetchQuotesByWorkspace() |
| proposals | workspace-integration.ts | → fetchProposalsByWorkspace() |
| auditLog | workspace-integration.ts, document-vault.ts | → syncAuditEntry() only (removed in-memory push) |
| approvalRecords | (no importers) | Already clean |
| signals | (no importers) | Already clean |
| policyGates | (no importers) | Already clean |

### New Table: customer_contacts

Created via ALTER TABLE migration in Supabase SQL Editor. Schema:

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PRIMARY KEY |
| customer_id | text | NOT NULL, FK → customers(id) |
| name | text | NOT NULL |
| email | text | |
| phone | text | |
| role | text | DEFAULT 'primary' |
| is_primary | boolean | DEFAULT false |
| notes | text | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

Seeded with 10 contacts across 9 customers. Primary contact for Almarai: Faisal Al-Marai.

### Token Resolution (Updated)

| Token | Resolved Value (Almarai example) | Source |
|-------|----------------------------------|--------|
| {{title}} | Almarai — Standard Quotation | doc title |
| {{subtitle}} | Supply Chain Services | doc type mapping |
| {{customer_name}} | Almarai | workspace customer |
| {{ref_number}} | HCS-QT-2026-6480 | auto-generated |
| {{date}} | 2026-03-02 | current date |
| {{recipient_name}} | Faisal Al-Marai | Supabase customer_contacts (primary) |
| {{company_name}} | Hala Supply Chain Services | branding profile / static default |

### Acceptance Tests

| Test | Description | Result |
|------|-------------|--------|
| AT1 | New Quote → Save → Appears in Documents (Quotes 5) | PASS |
| AT2 | Navigate with ?tab=documents → all quotes visible | PASS |
| AT3 | Output Studio → 6/6 tokens resolved, 0 missing | PASS |
| AT4 | Back to Workspace → Documents tab, no orphan page | PASS |
| Policy | pnpm run policy:storage → zero violations | PASS |
| DB | doc_instances: 5 rows for w5, customer_contacts: 10 rows | PASS |

### Bug Fix Applied

A React hooks ordering violation was discovered and fixed in `WorkspaceDetail.tsx`. A `useEffect` for contract cycle loading was placed after an early return (`if (loading) return ...`), causing "Rendered more hooks than during the previous render" on first load. The hook was moved above the early return to ensure consistent hook count across renders.

### Files Modified

| File | Change |
|------|--------|
| client/src/pages/OutputStudio.tsx | Replaced customers/workspaces array imports with useCustomer/useWorkspace hooks |
| client/src/lib/workspace-integration.ts | Refactored to accept workspace data as params, async Supabase queries |
| client/src/lib/document-vault.ts | Removed auditLog.push, kept syncAuditEntry only |
| client/src/pages/WorkspaceDetail.tsx | Async contract cycle/ready checks, hook ordering fix |
| client/src/lib/supabase-data.ts | Added customer_contacts CRUD functions |
| client/src/hooks/useSupabase.ts | Added useCustomerContacts hook |
| client/src/lib/token-resolver.ts | Added primary contact fetch for recipient_name, company_name binding |
| client/src/components/DocumentComposer.tsx | Added company_name binding |

### TypeScript

0 errors (`npx tsc --noEmit`).

### Known Issue (pre-existing)

The `audit_log_pkey` duplicate key constraint violation on workspace load is a seed data collision from the initial data seeding. It does not affect document creation, save, or view flows. Should be addressed in a future cleanup sprint.

### Supabase Project

Project name: `kositquaqmuousalmoar`

---

## checkpoint_sprint3_hygiene_contacts_dashboard

**Date:** 2026-03-02
**Checkpoint ID:** (see Manus checkpoint below)

### What Was Implemented

Sprint 3 — Hygiene, Contacts UI, and Dashboard verification. Three steps executed: audit_log idempotent seeding fix, Customer Contacts management UI, and Dashboard Supabase verification.

| Step | Description | Result |
|------|-------------|--------|
| Step A | Fix audit_log_pkey duplicate key toast — idempotent upsert + DB-generated IDs | PASS |
| Step B | Customer Contacts UI on CustomerDetail page — full CRUD + primary toggle | PASS |
| Step C | Dashboard stats verification — already Supabase-native (getDashboardStats is dead code) | PASS |

### Step A — Audit Log Fix

The `audit_log` table was modified to use DB-generated UUIDs as default IDs (`ALTER TABLE audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`). Ten conflicting seed rows (al1–al10) were deleted. The `syncAuditEntry()` function was changed from `.insert()` to `.upsert()` with `{ onConflict: 'id', ignoreDuplicates: true }`. In-memory `auditLog.unshift()` calls were removed from `stage-transition.ts` (2 calls) and `tender-engine.ts` (3 calls). A duplicate `createAuditEntry()` call was removed from `workspace-integration.ts`.

### Step B — Customer Contacts UI

A full Contacts management tab was added to the CustomerDetail page, positioned between Documents and Opportunities. The tab displays all contacts for the customer with avatar initials, name, job title, email, and phone. Features include Add Contact dialog (with form validation), Edit Contact dialog (pre-fills form), Delete Contact (with confirmation), and Primary Contact toggle (single-primary enforcement via `setPrimaryContact()`). The primary contact is highlighted with an amber border and crown badge. The first contact added is automatically set as primary.

### Step C — Dashboard Stats

Investigation revealed that `getDashboardStats()` in `store.ts` is dead code with zero importers. The Dashboard page (`Dashboard.tsx`) already uses Supabase hooks directly: `useWorkspaces()`, `useCustomers()`, `useSignals()`, and `useApprovalRecords()`. The function was annotated as `@deprecated` in store.ts. No migration was needed.

### Acceptance Tests

| Test | Description | Result |
|------|-------------|--------|
| AT1 | Open workspace — no audit_log duplicate toast | PASS |
| AT2 | Add contact, set primary, hard refresh — persists from Supabase | PASS |
| AT3 | Dashboard loads with live Supabase data, no console errors | PASS |
| AT4 | Full document flow: New Quote → Save → Output Studio (6/6 tokens) → Back to Workspace | PASS |

### Files Modified

| File | Change |
|------|--------|
| client/src/lib/supabase-sync.ts | syncAuditEntry changed from insert to upsert with ignoreDuplicates |
| client/src/lib/stage-transition.ts | Removed 2 auditLog.unshift() calls |
| client/src/lib/tender-engine.ts | Removed 3 auditLog.unshift() calls |
| client/src/lib/workspace-integration.ts | Removed duplicate createAuditEntry() call |
| client/src/pages/CustomerDetail.tsx | Added Contacts tab with full CRUD UI, fixed hooks ordering |
| client/src/lib/store.ts | Annotated getDashboardStats as @deprecated dead code |

### SQL Migrations Applied

```sql
ALTER TABLE audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
DELETE FROM audit_log WHERE id IN ('al1','al2','al3','al4','al5','al6','al7','al8','al9','al10');
NOTIFY pgrst, 'reload schema';
```

### TypeScript

0 errors (`npx tsc --noEmit`).

### Supabase Project

Project name: `kositquaqmuousalmoar`
