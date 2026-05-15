# Backend Architecture Reference

## Source Documents Used
Documents 5, 11, 14, 36-38, Document Ω

## Key Rules
- Supabase Edge Functions follow: /supabase/functions/<function-name>/index.ts
- Function naming: <product>-<domain>-<action>-v<version>
- All functions must be stateless, deterministic, explicitly typed
- Auth token + RLS alignment + role validation required
- Every function needs: index.ts, types.ts, utils.ts, README.md
- API versioning is mandatory (v1, v2, etc.)

## Required Behavior
- Design clean service boundaries
- Validate all inputs explicitly
- Handle errors gracefully with try/catch
- Log requests (timestamp, user ID, action, status, execution time)
- Never return raw database errors to clients

## Forbidden Actions
- Giant monolithic functions
- Bypassing RLS
- Inline SQL without parameterization
- Global state in functions
- Calling external APIs without timeout
- Running expensive loops in Edge Functions
- Modifying database without auth checks
