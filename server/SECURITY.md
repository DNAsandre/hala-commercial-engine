# SECURITY.md — Hala Commercial Engine

## Sprint 2: Authentication & Data Security

### Overview

Sprint 2 establishes identity verification and database protection.
It does NOT enforce commercial gates, role restrictions, or approval requirements.

### Authentication Flow

```
User → Login Page → Supabase Auth (email/password)
     → Session JWT created
     → AuthContext fetches app user from `users` table via auth_id
     → setGlobalAuthUser() called for engine files
     → ProtectedApp wraps all routes — redirects to /login if no session
```

### Backend Auth Flow

```
Frontend → API request with Authorization: Bearer <JWT>
         → server/lib/auth.ts → requireAuth middleware
         → Supabase verifies JWT → fetches app user profile
         → req.authUser attached with: userId, name, email, role, region
         → Route handler executes with real identity
         → Audit log written with actor identity
```

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | ✅ Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access server key | ✅ Server |
| `FRONTEND_ORIGIN` | CORS origin | ✅ Server |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` has FULL database access.
> Never expose to frontend. Never commit to git.

### RLS Policy Summary

All core tables have Row Level Security enabled:

| Table | Read | Write | Anonymous |
|-------|------|-------|-----------|
| customers | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| workspaces | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| quotes | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| proposals | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| approval_records | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| escalation_events | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| signals | ✅ Authenticated | ✅ Authenticated | ❌ Blocked |
| audit_log | ✅ Read only | ✅ Insert only | ❌ Blocked |
| users | ✅ Authenticated | ❌ Service role only | ❌ Blocked |

**No role-based restrictions active.** All authenticated users see all data.
Role-based filtering is planned for Sprint 12 (Governance).

### Migration

Apply RLS policies by running:
```
migrations/sprint2_rls_policies.sql
```
in the Supabase SQL Editor.

### Test Users

8 users exist in the `users` table, each linked to a Supabase Auth account:

| User | Role | Region |
|------|------|--------|
| Amin Al-Rashid | admin | East |
| Ra'ed Al-Harbi | regional_sales_head | East |
| Albert Fernandez | salesman | East |
| Hano Kim | salesman | Central |
| Yazan Khalil | regional_ops_head | East |
| Mohammed Al-Qahtani | director | East |
| Tariq Nasser | ceo_cfo | East |
| Samer Khoury | regional_sales_head | Central |

### Audit Logging

Every mutation via the backend API logs:
- `user_id` — app user ID from authenticated session
- `user_name` — real name
- `action` — what happened (customer.updated, escalation.resolved, etc.)
- `entity_type` + `entity_id` — what was changed
- `details` — JSON with before/after state, actor_role, source

Audit logging is **best-effort** — failures don't block the mutation.

### What Is NOT Enforced (Intentionally)

- ❌ Role-based access control (Sprint 12)
- ❌ Commercial approval gates (Sprint 12)
- ❌ Stage transition restrictions (Sprint 12)
- ❌ Margin threshold blocking (Sprint 12)
- ❌ SLA creation prerequisites (Sprint 12)

> All enforcement and gates are reserved for Sprint 12 (Phase 5 — Governance).
> The system remains fully open and testable until then.

### Dev Fallback Rules

- The sidebar shows `effectiveUser` — falls back to a display-only placeholder if no profile is loaded
- The `auth-state.ts` DEFAULT_USER has `id: "anonymous"` — this is checked by `isAuthenticated()`
- Production builds should never silently operate as anonymous for mutations
- The backend API rejects all requests without a valid JWT (401)
