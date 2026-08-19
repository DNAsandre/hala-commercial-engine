# Sprint X Deferred Register

Date recorded: 2026-08-19

Status: **DEFERRED BY ARCHITECTURE**

No item in this file was changed during Functional Closure. These findings are
recorded so they do not interrupt human workflow completion.

## SX-2026-08-19-001 — Database security advisor backlog

The Supabase security advisor reports pre-existing findings including:

- exposed public tables without RLS, including ECR, CRM/legacy sync, bot/AI,
  document-vault, and quarantine tables;
- security-definer functions executable by anonymous or authenticated roles;
- functions with mutable `search_path`;
- one RLS-enabled table without a policy;
- leaked-password protection disabled.

Reference: https://supabase.com/docs/guides/database/database-linter

Treatment: Sprint X only. Do not add RLS, revoke function execution, change
authentication policy, or introduce permission gates before architect
authorization for Sprint X.

## SX-2026-08-19-002 — Database performance advisor backlog

The performance advisor reports a large pre-existing backlog across the shared
database, dominated by unindexed foreign keys, unused indexes, repeated policy
evaluation, and multiple permissive policies. This is broader than the clean
application and was not created by the two Functional Closure migrations.

Reference: https://supabase.com/docs/guides/database/database-linter

Treatment: inventory and prioritise in Sprint X or a separately authorized
database-performance programme. No index or policy churn belongs in Functional
Closure.
