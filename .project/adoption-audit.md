# Agent System Adoption Audit

Date: 2026-05-14

## What The Agent System Expected

The installed governance system expected:

- `AGENTS.md` as the top-level operating guide.
- `.agents/rules/` containing always-on safety, naming, tool-boundary, environment, and cost-control rules.
- `.agents/skills/` containing specialist skill instructions.
- `.project/` as the project truth layer, including vision, architecture, schema contract, decisions, tickets, QA reports, and handoffs.
- Architecture and schema docs to be populated with actual project facts before agents rely on them.
- Real source truth to override assumptions and generated templates.

## What The Existing App Actually Contains

The real repository is an existing Hala Commercial Engine app, not a blank template.

Confirmed contents:

- Vite + React + TypeScript frontend in `client/`.
- Express + TypeScript backend API in `server/`.
- Supabase client usage in frontend and server.
- Supabase Edge Function `supabase/functions/ghl-proxy`.
- Multiple Supabase/migration locations: `supabase/migrations/`, `migrations/`, top-level `supabase_migration_*.sql`, and `scripts/*.sql`.
- Large route surface for commercial pipeline, customers, tenders, renewals, docs, bots, governance, ECR, CRM sync, Commercial OS, transportation, operations signals, escalations, and monthly reporting.
- Existing docs in `docs/`, `docs-amin/`, `server/README.md`, and `server/SECURITY.md`.

## Mismatches Found

- `.project/architecture.md` was still a generic template before this adoption pass.
- `.project/schema-contract.md` contained generic `users` and `profiles` examples that did not reflect the real schema surface.
- `.project/vision.md` remains a template placeholder. It was not edited because it is outside this task's allowed file list.
- `server/README.md` says "Sprint 1" and lists some features as intentionally not implemented, while source now includes many later route modules and auth/RBAC middleware. This appears stale.
- `AGENTS.md` referenced template-style project truth files before the real app identity was added.
- There are multiple schema/migration roots, so the effective schema source of truth is not singular.
- Generated Supabase TypeScript types were not found.

## Documentation Conflicts

- `.project/schema-contract.md` previously documented generic `users` and `profiles` tables/policies that were not sufficient for this repo.
- `.project/architecture.md` previously documented a generic `/app`, `/components`, `/hooks`, `/services` layout, while the actual frontend root is `client/src/` and backend is `server/`.
- Existing architecture in `server/README.md` is useful but stale compared with the current route set.
- `docs-amin/` contains extensive product documentation and plans. Some parts describe future integrations such as OpenClaw/Zoho; these are not confirmed as active runtime integrations from inspected source.

## Codebase Identity Conflicts

- No source or docs match the template example "CEO Orchestrator".
- The repo consistently identifies as Hala Commercial Engine / Hala Commercial.
- Source and docs reference Hala Supply Chain Services, commercial engine workflows, warehousing/logistics, tenders, transportation, Commercial OS, and GHL/DNA Supersystems.
- Any future template text naming a different product must be treated as an identity mismatch and not silently reconciled.

## Missing Docs

- Root `README.md` was not found.
- `.project/current-state.md` did not exist before this task.
- `.project/adoption-audit.md` did not exist before this task.
- First adoption ADR did not exist before this task.
- `.project/vision.md` is still a placeholder and needs a separate allowed update.

## Missing Schema Info

- No generated Supabase database types were found.
- Effective production schema is `UNCONFIRMED`.
- Effective production RLS policy set is `UNCONFIRMED`.
- Applied migration history is `UNCONFIRMED`.
- Complete table/column contract needs consolidation because schema facts are spread across several SQL roots.

## Recommended Safe Next Actions

1. Confirm which migration directory is authoritative for the live Supabase project.
2. Generate or commit Supabase database types after the authoritative schema is verified.
3. Update `.project/vision.md` in a separate authorized task to replace the placeholder with Hala-specific product facts.
4. Reconcile `server/README.md` with current route/auth state in a separate source-doc task.
5. Run a security/RLS audit before any schema, policy, service-role, or auth changes.
6. Create a schema verification report from the live Supabase project before treating `.project/schema-contract.md` as complete.
