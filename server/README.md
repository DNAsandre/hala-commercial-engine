# Hala Commercial Engine — Backend API Server

## Overview

This is the backend API server for the Hala Commercial Engine. It sits between the frontend and Supabase, providing:

- **Server-side validation** — request bodies are validated with Zod before touching the database
- **Audit logging** — every mutation is logged with before/after state
- **Dangerous field protection** — clients cannot overwrite `id`, `created_at`, or `created_by`
- **Secure Supabase access** — uses the service role key (never exposed to frontend)

## Sprint 1 Status

✅ Server skeleton with Express + TypeScript  
✅ Server-side Supabase client (service role key)  
✅ Customer routes (GET, GET/:id, PATCH/:id)  
✅ Workspace routes (GET with filters, GET/:id, PATCH/:id)  
✅ Escalation routes (GET, open-count, acknowledge, resolve)  
✅ Dashboard summary (basic pipeline stats)  
✅ Request validation (Zod schemas)  
✅ Audit logging helper (best-effort, non-blocking)  
✅ Frontend API client wrapper  

### What Is NOT Implemented Yet (Intentionally)

- ❌ Authentication middleware (Sprint 2)
- ❌ Role-based access control (Sprint 2)
- ❌ RLS policies (Sprint 2)
- ❌ POST/CREATE routes for new entities (Sprint 3+)
- ❌ Quote/Proposal/SLA routes (Sprint 3-5)
- ❌ PDF generation (Sprint 6)
- ❌ CRM integration (Sprint 8)
- ❌ Email notifications (Sprint 9)
- ❌ Policy gates and enforcement (Sprint 12 — LAST)

> ⚠️ **No policy gates, locks, or enforcement logic are active in this sprint.**  
> The system is fully open and testable.

## Setup

### 1. Environment Variables

Add these to the `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_ORIGIN=http://localhost:3000
```

Get your service role key from:  
**Supabase Dashboard → Settings → API → Project API keys → `service_role` (secret)**

> ⚠️ The service role key has FULL database access. Never commit it to git or expose to the frontend.

### 2. Running the Server

```bash
# Run API server only (with hot reload)
pnpm dev:server

# Run frontend only (existing behaviour)
pnpm dev

# Run both together (requires concurrently)
pnpm dev:all
```

The server runs on **http://localhost:3001** by default.

### 3. TypeScript Check

```bash
pnpm typecheck:server
```

## Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check — returns service status and timestamp |
| GET | `/api/customers` | List all customers |
| GET | `/api/customers/:id` | Get single customer |
| PATCH | `/api/customers/:id` | Update customer fields |
| GET | `/api/workspaces` | List workspaces (optional `?type=` and `?stage=` filters) |
| GET | `/api/workspaces/:id` | Get single workspace |
| PATCH | `/api/workspaces/:id` | Update workspace fields |
| GET | `/api/escalations` | List escalations (optional `?status=` filter) |
| GET | `/api/escalations/open-count` | Count of open/pending escalations |
| PATCH | `/api/escalations/:id/acknowledge` | Mark escalation as acknowledged |
| PATCH | `/api/escalations/:id/resolve` | Mark escalation as resolved |
| GET | `/api/dashboard/summary` | Pipeline stats (workspace count, customer count, stage distribution) |

## Error Responses

All errors follow this format:

```json
{
  "error": "Human readable message",
  "code": "MACHINE_CODE",
  "details": [
    { "field": "name", "message": "Required" }
  ]
}
```

Error codes:
- `VALIDATION_ERROR` — request body failed Zod validation
- `EMPTY_BODY` — PATCH request had no body
- `NOT_FOUND` — entity does not exist
- `DB_ERROR` — Supabase query failed
- `HTTP_ERROR` — generic HTTP error

## Architecture

```
server/
├── index.ts              # Express app, middleware, route mounting
├── tsconfig.json         # Server-specific TypeScript config
├── README.md             # This file
├── lib/
│   ├── supabase.ts       # Service role Supabase client
│   ├── validate.ts       # Zod validation middleware + helpers
│   └── audit.ts          # Best-effort audit logging
└── routes/
    ├── customers.ts      # /api/customers
    ├── workspaces.ts     # /api/workspaces
    ├── escalations.ts    # /api/escalations
    └── dashboard.ts      # /api/dashboard
```

## Audit Logging

Every PATCH mutation logs:
- `actorId` — who did it (placeholder `api-user` until Sprint 2 auth)
- `action` — what happened (`customer.updated`, `workspace.updated`, etc.)
- `entityType` + `entityId` — what was changed
- `before` / `after` — full row state before and after the change
- `source` — `api` (will also support `bot` and `system` in later sprints)

Audit logging is **best-effort** — if the audit table write fails, the mutation still succeeds. A console warning is logged instead.
