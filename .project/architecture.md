# Architecture

Date: 2026-05-14

## System Overview

Hala Commercial Engine is an existing commercial operations application for Hala Supply Chain Services. It combines a Vite/React frontend, an Express API server, Supabase-backed data/auth, a GHL proxy Edge Function, and a broad set of commercial workflow modules.

The application is not a generic template. Real source files are the source of truth. Unknowns are marked `UNCONFIRMED`.

## Frontend Architecture

### Framework

- Vite app rooted at `client/`.
- React 19 + TypeScript.
- Wouter route definitions in `client/src/App.tsx`.
- Lazy-loaded page modules for heavier screens.
- Auth-protected shell wraps all routes except `/login`.

### Main Frontend Structure

```text
client/
  index.html
  public/
    _redirects
  src/
    App.tsx
    main.tsx
    index.css
    const.ts
    components/
    contexts/
    hooks/
    lib/
    pages/
```

### Routing Model

- `client/src/App.tsx` defines the route map.
- `AuthProvider` provides Supabase session/app user state.
- `ProtectedApp` redirects unauthenticated users to `/login`.
- `DashboardLayout` wraps authenticated routes.
- `RequireRole` protects admin routes using the `admin` role.
- `PageErrorBoundary` and `Suspense` wrap lazy route components.

### Page Domains

- Dashboard/customer/workspace workflow.
- Quotes, proposals, SLAs, approvals, PnL.
- Commercial, tenders, renewals, handover.
- Document vault/composer/PDF/output studio.
- Bot registry/builder/audit, AI providers, signal engine, knowledge base.
- ECR dashboard, scoring, metrics, rules, snapshots, connectors, upgrades.
- Governance/admin/audit/global escalations.
- Commercial OS dashboard, pipeline, capacity, forecast, revenue, actions, customers, transportation, operations signals, escalations, monthly reports.

### State And Data Access

- React context: `AuthContext`, `ThemeContext`, `ComposerDirtyContext`.
- Data hooks: `client/src/hooks/*`.
- Frontend data/service utilities: `client/src/lib/*`.
- Supabase is called directly from frontend utilities and hooks for many reads/writes.
- API wrappers exist for server-backed calls, including `client/src/lib/api-client.ts`, `admin-api.ts`, `api-blocks.ts`, and domain-specific clients.

### Styling And UI

- Tailwind CSS 4 with `@tailwindcss/vite`.
- Local UI primitives under `client/src/components/ui/`.
- Radix UI primitives.
- lucide-react icons.
- sonner toasts.
- next-themes theme provider.

## Backend Architecture

### Platform

- Express + TypeScript API server under `server/`.
- Entry flow: `server/bootstrap.ts` loads `.env`, then imports `server/index.ts`.
- API server default port: `3001`.
- Frontend dev server default port: `3000`.
- Server uses Zod validation helpers and a Supabase service-role client.

### Backend Structure

```text
server/
  index.ts
  bootstrap.ts
  README.md
  SECURITY.md
  lib/
    audit.ts
    auth.ts
    document-render-context.ts
    llm-provider.ts
    pdf-generator.ts
    provider-health.ts
    signal-scanner.ts
    supabase.ts
    validate.ts
  routes/
    blocks.ts
    bot-governance.ts
    branding.ts
    customers.ts
    dashboard.ts
    doc-instances.ts
    documents.ts
    ecr-rules.ts
    escalations.ts
    handovers.ts
    proposals.ts
    quotes.ts
    slas.ts
    system-health.ts
    system-settings.ts
    templates.ts
    workspaces.ts
```

### API Route Mounts

Confirmed from `server/index.ts`:

- `/api/customers`
- `/api/workspaces`
- `/api/escalations`
- `/api/dashboard`
- `/api` for quotes, proposals, SLAs, documents, templates, branding, blocks, doc instances, bot governance, system settings, and system health route modules
- `/api/handovers`
- `/api/ecr`

### Auth And Authorization

- Frontend auth uses Supabase Auth in `client/src/contexts/AuthContext.tsx`.
- App user profile lookup reads from `users` by `auth_id`.
- Server auth middleware in `server/lib/auth.ts` verifies Supabase JWTs with the service-role client.
- Server route modules generally apply `requireAuth`.
- Role enforcement exists through `requireRole(allowedRoles)` for approval/mutation actions.
- Effective live auth/RLS posture is `UNCONFIRMED` until checked against the live Supabase project.

## Supabase Architecture

### Confirmed Files

```text
supabase/
  functions/
    ghl-proxy/
      index.ts
  migrations/
    *.sql
migrations/
  *.sql
supabase_migration_*.sql
scripts/*.sql
```

### Edge Functions

- `ghl-proxy` proxies GoHighLevel / DNA Supersystems API requests.
- Required secrets mentioned in source: `GHL_API_KEY`, `GHL_LOCATION_ID`.

### Database/Migrations

Confirmed migration domains:

- Core customers/workspaces/tenders/commercial workflow.
- Commercial OS warehouse, opportunity, revenue, capacity, forecast, dashboard, and leadership action data.
- Documents, templates, generated documents, document instances, vault assets, variables.
- Bots, AI providers, AI usage, signal rules/events, knowledge base.
- Governance, ECR, escalations, operations signals.
- CRM config and CRM mapping.
- Renewals, handovers, transportation, monthly reporting.

Authoritative migration path is `UNCONFIRMED` because multiple migration roots exist.

## External Integrations

| Service | Confirmed Purpose | Auth/Config |
|---|---|---|
| Supabase | Auth, database, service-role backend access, Edge Function runtime | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; frontend Supabase client |
| GoHighLevel / DNA Supersystems | CRM proxy/sync configuration | `GHL_API_KEY`, `GHL_LOCATION_ID`, `crm_config`, `crm_contact_map`, `crm_opportunity_map` |
| AI providers | Internal provider registry, bot governance, usage logging | `ai_providers`, `ai_usage_logs`, bot governance tables |
| OpenClaw | Mentioned in planning docs | Runtime integration `UNCONFIRMED` |
| Zoho CRM | Mentioned in planning docs | Runtime integration `UNCONFIRMED` |

## Deployment Architecture

Confirmed:

- Vite build outputs to `dist/public`.
- Server build uses `tsc --project server/tsconfig.json`.
- Production server start script runs `node dist/server/index.js`.
- `client/public/_redirects` contains SPA fallback `/* /index.html 200`.

UNCONFIRMED:

- Production hosting provider.
- Preview/staging URL patterns.
- CI/CD pipeline.
- Whether frontend and API deploy together or separately.

## Caution Areas

- `server/lib/supabase.ts` uses service role and bypasses RLS.
- `server/lib/auth.ts` controls server auth/RBAC.
- `client/src/lib/supabase.ts` hard-codes the Supabase URL and anon key.
- `server/routes/*` contain authenticated mutation paths.
- `client/src/hooks/useMutations.ts` includes update/delete calls.
- SQL and migration files must not be changed without explicit schema/RLS authorization.
