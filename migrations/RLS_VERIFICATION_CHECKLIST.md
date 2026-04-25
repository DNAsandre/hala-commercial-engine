# RLS & Migration Verification Checklist

Run these steps in the Supabase SQL Editor before Sprint 4 begins.

---

## Step 1 — Apply corrective migrations (if not yet applied)

Open **Supabase → SQL Editor** and run each file in order:

| # | File | What it does |
|---|------|-------------|
| 1 | `migrations/sprint2_rls_policies.sql` | Enables RLS on 9 core tables, creates authenticated + service_role policies |
| 2 | `migrations/010_rls_hardening.sql` | Extends RLS to bot, document engine, ECR, and CRM config tables |
| 3 | `migrations/sprint3_quotes_schema.sql` | Adds versioning, cost, validity, actor columns to `quotes` |
| 4 | `migrations/sprint3b_quotes_missing_columns.sql` | Adds missing pricing columns: `storage_rate`, `inbound_rate`, `outbound_rate`, `pallet_volume`, `monthly_revenue`, `annual_revenue`, `gp_amount`, `gp_percent` |
| 5 | `migrations/sprint6_generated_documents.sql` | Creates `generated_documents` table with RLS for PDF metadata |
| 6 | `migrations/sprint6b_generated_documents_chain.sql` | Adds `supersedes_document_id` + `last_downloaded_at` columns (corrective, safe to skip if running sprint6 fresh) |

All files are idempotent — safe to re-run if already partially applied.

---

## Step 2 — Verify RLS is enabled on core tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'customers', 'workspaces', 'quotes', 'proposals',
    'approval_records', 'escalation_events', 'signals',
    'audit_log', 'users'
  )
ORDER BY tablename;
```

**Expected:** `rowsecurity = true` for all 9 rows.

---

## Step 3 — Verify policies exist on quotes

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'quotes'
ORDER BY policyname;
```

**Expected policies:**
- `quotes_insert_auth` — INSERT, `{authenticated}`
- `quotes_select_auth` — SELECT, `{authenticated}`
- `quotes_service` — ALL, `{service_role}`
- `quotes_update_auth` — UPDATE, `{authenticated}`

---

## Step 4 — Verify pricing columns exist

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'quotes'
  AND column_name IN (
    'storage_rate', 'inbound_rate', 'outbound_rate', 'pallet_volume',
    'monthly_revenue', 'annual_revenue', 'gp_amount', 'gp_percent',
    'version_number', 'quote_number', 'status', 'state',
    'supersedes_quote_id', 'change_reason', 'discount_percent'
  )
ORDER BY column_name;
```

**Expected:** 15 rows, all present.

---

## Step 5 — Smoke test quote insert via API

After running the migrations, create one test quote through the UI (QuoteWizard) and verify:

1. Quote appears in the quotes list with correct GP%
2. No Supabase console errors about missing columns
3. `audit_log` gains a `quote.created` entry with a real `user_id`

---

## Notes

- **Never run these migrations against production** without a backup.
- The `service_role` bypass policy is required for the server-side Express routes which use `SUPABASE_SERVICE_ROLE_KEY`.
- If RLS is enabled but no policy exists for a table, all queries from authenticated users will return 0 rows (silent failure). Always run Step 2 after enabling RLS.
