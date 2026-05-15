# Current State

Date: 2026-05-14

## Actual App Identity

Confirmed identity from `package.json`, `.env.example`, `server/README.md`, `server/index.ts`, and source text:

- App/package name: `hala-commercial-engine`
- Product name: Hala Commercial Engine / Hala Commercial
- Business domain: commercial engine for Hala Supply Chain Services, with commercial pipeline, tender, renewals, document generation, bot governance, escalation, ECR, CRM sync, warehouse capacity, transportation, and Commercial OS reporting workflows.

The existing codebase does not identify itself as "CEO Orchestrator". That phrase was not found in the inspected repo files.

## Actual Stack

- Frontend: Vite, React 19, TypeScript, Wouter routing.
- Styling/UI: Tailwind CSS 4 via `@tailwindcss/vite`, Radix UI primitives, local `client/src/components/ui/*`, lucide-react icons, sonner toasts, next-themes.
- Data/client: `@supabase/supabase-js`, direct frontend Supabase calls in `client/src/lib/*`, and authenticated frontend context in `client/src/contexts/AuthContext.tsx`.
- Backend: Express 4, TypeScript, `tsx`, Zod validation, CORS, server-side Supabase service role client.
- Documents/PDF: TipTap, pdfkit, jsPDF, html2pdf.js, html2canvas, document composer/viewer utilities.
- Charts/data UI: Recharts.
- Package manager: pnpm, confirmed by `packageManager` in `package.json` and `pnpm-lock.yaml`.
- Local dev: Vite on port 3000; Express API on port 3001 through `pnpm dev:server`; both through `pnpm dev:all`.

## Actual Folder Structure

- `client/` - Vite frontend root.
- `client/src/App.tsx` - main Wouter route map, auth guard, lazy page loading.
- `client/src/pages/` - route/page modules for dashboard, customers, workspaces, commercial, tenders, renewals, docs, bots, ECR, governance, CRM sync, Commercial OS, and admin screens.
- `client/src/components/` - shared application components, dashboard panels, commercial panels, tender panels, document/bot UI, and local UI primitives.
- `client/src/contexts/` - auth, theme, and composer dirty-state contexts.
- `client/src/hooks/` - data and workflow hooks.
- `client/src/lib/` - Supabase clients, domain engines, API clients, document/PDF utilities, governance, CRM, bots, ECR, and commercial/tender data helpers.
- `server/` - Express API server, route modules, server libs, scripts, types, and backend README/security docs.
- `server/routes/` - API modules mounted from `server/index.ts`.
- `server/lib/` - Supabase service client, auth/RBAC middleware, validation, audit, PDF, provider health, signal scanner, render context.
- `shared/` - shared constants.
- `supabase/functions/ghl-proxy/` - Supabase Edge Function for GoHighLevel/DNA Supersystems API proxying.
- `supabase/migrations/` - timestamped Supabase migrations.
- `migrations/` - additional sprint migrations, including RLS hardening and feature tables.
- top-level `supabase_migration_*.sql` - legacy/standalone migration files for documents, tenders/renewals, CRM config, ECR, and bots.
- `scripts/` and `server/scripts/` - seed, migration, policy, and verification helpers.
- `_audit_tests/` - auth/RBAC/final verification scripts.
- `docs/`, `docs-amin/`, `Zachie MDs/` - existing project/reference documentation.
- `excell/` - CSV/XLSX source data and helper scripts.
- `scratch/` - scratch scripts and experiments; use caution.

## Actual Routes/Pages

Confirmed from `client/src/App.tsx`.

Public/auth route:

- `/login`

Protected core routes:

- `/`, `/dashboard`
- `/customers`, `/customers/:id`
- `/workspaces/:id`
- `/workspaces` redirects to `/commercial`
- `/quotes`
- `/proposals`, `/proposals/:id`
- `/slas`, `/slas/:id`
- `/approvals`
- `/pnl`
- `/crm-sync`
- `/documents` redirects to `/document-vault`
- `/document-vault`
- `/pdf-studio`
- `/tenders`, `/tenders/:id`, `/tenders-overview`, `/tender-board`
- `/commercial`, `/commercial-overview`
- `/renewals`, `/renewals/:id`, `/renewals-overview`
- `/handover`
- `/editor`
- `/ecr`, `/ecr-scoring`
- `/composer/:docInstanceId/view`
- `/workspaces/:workspaceId/compose/:docType`
- `/compose/:docInstanceId/edit`
- `/escalations`
- `/commercial-os`
- `/commercial-os/pipeline`
- `/commercial-os/capacity`
- `/commercial-os/forecast`
- `/commercial-os/revenue`
- `/commercial-os/actions`
- `/commercial-os/customers`
- `/commercial-os/customers/:customerId`
- `/commercial-os/transportation`
- `/commercial-os/ops-signals`
- `/commercial-os/escalations`
- `/commercial-os/reports/monthly`

Admin-role guarded routes:

- `/admin`
- `/admin-panel`
- `/audit`
- `/bot-registry`
- `/bot-builder`
- `/signal-engine`
- `/bot-audit`
- `/ecr-metrics`
- `/ecr-rule-sets`
- `/ecr-snapshots`
- `/ecr-connectors`
- `/renewal-gates`
- `/revenue-exposure`
- `/ecr-upgrades`
- `/template-manager`
- `/branding-profiles`
- `/block-library`
- `/block-builder`
- `/variables`
- `/templates/:templateId/designer`
- `/ai-providers`
- `/editor-bot-builder`
- `/knowledgebase`
- `/crm-sync-console`

## Actual Backend API Surface

Confirmed from `server/index.ts` and `server/routes/*`.

- `/api/health`
- `/api/customers`
- `/api/workspaces`
- `/api/escalations`
- `/api/dashboard/summary`
- `/api/workspaces/:workspaceId/quotes`
- `/api/quotes/:id` and quote submit/approve/reject/create-version actions
- `/api/workspaces/:workspaceId/proposals`
- `/api/proposals/:id` and proposal review/CRM/sent/negotiation/approve/reject/create-version actions
- `/api/slas`, `/api/workspaces/:workspaceId/slas`, `/api/slas/:id`, SLA lifecycle actions, and workspace contract-status routes
- `/api/documents/*` and workspace/customer document queries
- `/api/templates/*`
- `/api/branding/*`
- `/api/blocks/*`
- `/api/doc-instances/*`
- `/api/bots/*`, `/api/bot-providers/*`, `/api/bot-connectors/*`, `/api/signal-rules/*`, `/api/signal-events/*`, `/api/bot-invocations`, `/api/bot-settings`, bot invocation and health-check actions
- `/api/system-settings`
- `/api/system-health`
- `/api/integration-status`
- `/api/handovers/*`
- `/api/ecr/rule-sets`

Most server route modules call `requireAuth`. Some mutation/approval actions call `requireRole`.

## Actual Supabase Structure

- Supabase client usage exists in frontend and server.
- `server/lib/supabase.ts` creates a service-role Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `client/src/lib/supabase.ts` creates a frontend Supabase client.
- Auth uses Supabase Auth sessions and looks up linked app users from the `users` table by `auth_id`.
- Supabase Edge Function: `supabase/functions/ghl-proxy/index.ts` for GoHighLevel/DNA Supersystems.
- Migration locations are split across `supabase/migrations/`, `migrations/`, top-level `supabase_migration_*.sql`, and `scripts/*.sql`.
- Generated Supabase TypeScript database types were not found.

Confirmed schema domains include:

- Core commercial/tender: `customers`, `workspaces`, `tenders`, commercial quote/scenario/PnL/capacity/proposal/SLA/activity/audit tables, tender packs/sections/placeholders/documents/gates/activity/audit tables.
- Commercial OS: opportunities, opportunity phasing, flags, warehouse locations/chambers/capacity, closed won deals, revenue actuals, forecasts, dashboard snapshots, leadership actions.
- Documents: document blocks, templates, versions, instances, compiled outputs, vault assets, generated documents, variable definitions/sets/overrides.
- Bots/AI: editor bots, AI runs, providers, usage logs, bot definitions/versions/invocations/settings/connectors, signal rules/events, knowledge base tables.
- Governance/ECR/escalations: governance gates/audit log, ECR metrics/rules/snapshots/values/scores/audit, escalation events/tasks/rules, commercial escalations, operations signals.
- CRM/integrations: `crm_config`, `crm_contact_map`, `crm_opportunity_map`, GHL proxy function.
- Renewals/handover/transportation/monthly reports: renewal workspaces, contract baselines, handover processes, transportation opportunities/metrics/customer links, monthly commercial reports.

## Actual Services, Hooks, Components

Confirmed hook files:

- `useCommercialOsData`, `useCommercialWorkspaceData`, `useCommercialWorkspaceSignals`, `useComposition`, `useDocuments`, `useEntity`, `useGovernance`, `useMobile`, `useMutations`, `usePersistFn`, `useResolveDocInstance`, `useSupabase`, `useTenderWorkspaceData`, `useTenderWorkspaceSignals`, `useUnsavedChangesGuard`, `useVariables`.

Confirmed contexts:

- `AuthContext`, `ComposerDirtyContext`, `ThemeContext`.

Confirmed client lib/service areas:

- API/admin clients, AI clients/runs, blocks, auth state, bot governance, commercial integrity/data/actions/signals/OS/formulas/workspace data, CRM sync/GHL client, document composer/vault/PDF utilities, ECR, escalation, governance, knowledge base, optimistic locking, portfolio, renewals, semantic variables, signal engine, SLA integrity, stage transitions, Supabase data/sync/tender/governance/variables helpers, tender engine/workspace data, token/variable resolution.

Confirmed component areas:

- Dashboard layout and dashboard panels.
- Quote/proposal/SLA/document/composer/viewer/wizard panels.
- Commercial and tender workflow panels.
- Bot/AI panels.
- ECR/escalation/governance controls.
- shadcn/Radix-style local UI primitives.

## Actual Known Integrations

- Supabase database/auth/Edge Functions.
- GoHighLevel / DNA Supersystems CRM via `ghl-proxy`, `client/src/lib/ghl-client.ts`, and CRM config/map tables.
- AI provider registry and usage logging (`ai_providers`, `ai_usage_logs`, bot governance routes/libs).
- Document/PDF generation libraries.
- Existing docs mention OpenClaw/Zoho concepts, but source-confirmed runtime integration is GHL proxy plus internal bot/AI provider tables. OpenClaw/Zoho runtime status is `UNCONFIRMED`.

## Unknowns

- Which migration root is authoritative for production: `supabase/migrations/`, `migrations/`, top-level `supabase_migration_*.sql`, or scripts.
- Which migrations have actually been applied to the live Supabase project.
- Whether the top-level legacy migrations are historical, pending, or manually applied.
- Complete effective RLS state in the live database.
- Complete production deployment platform. Vite config and Netlify-style `_redirects` exist, but no Vercel/Netlify deployment config was confirmed.
- Root README is missing. `server/README.md` exists.
- Generated Supabase types are missing or not stored in the repo.

## Risks

- Existing `.project/architecture.md` and `.project/schema-contract.md` were template placeholders and did not match the real app before this adoption pass.
- Schema information is fragmented across multiple migration roots.
- Some RLS policies are broad (`USING (true)`) in migration files; effective live policy posture requires security review before production assumptions.
- Frontend contains a hard-coded Supabase URL and anon key in `client/src/lib/supabase.ts`. The anon key is not a service role secret, but configuration ownership should be reviewed.
- Server uses a Supabase service-role key and bypasses RLS by design. API route validation, auth, RBAC, and audit behavior require caution.
- `scratch/`, seed scripts, and migration runner scripts can mutate data; do not run without an explicit scope.
- `client/src/hooks/useMutations.ts` contains delete/update paths and should be handled carefully.

## Files That Require Caution

- `client/src/lib/supabase.ts`
- `server/lib/supabase.ts`
- `server/lib/auth.ts`
- `server/routes/*`
- `client/src/contexts/AuthContext.tsx`
- `client/src/hooks/useMutations.ts`
- `client/src/lib/supabase-sync.ts`
- `client/src/lib/ghl-client.ts`
- `supabase/functions/ghl-proxy/index.ts`
- `supabase/migrations/*`
- `migrations/*`
- `supabase_migration_*.sql`
- `scripts/*`
- `server/scripts/*`
- `.env.example` and any local `.env` files
