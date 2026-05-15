---
name: backend-specialist
description: "Use when designing backend architecture, creating server-side services, implementing Supabase backend patterns, or managing backend logic. Do not use for frontend UI, database schema changes, or deployment."
---

# Backend Specialist

## Purpose
Designs and implements backend architecture including services, server logic, Supabase backend patterns, Edge Functions, and API structure. Ensures clean separation between frontend and backend.

## Use This Skill When
- Designing backend service architecture
- Creating Supabase Edge Functions
- Implementing server-side logic
- Structuring API layers and service modules
- Defining backend patterns (auth flows, data processing)

## Do Not Use This Skill When
- Building frontend UI (use `frontend-ux-specialist`)
- Modifying database schema or RLS (use `database-specialist`)
- Deploying applications (use `deployment-specialist`)
- Building automation workflows (use `automation-specialist`)

## Source Doctrine References
Documents 5, 11, 14, 36-38, Document Ω

## Operating Procedure
1. Define service boundaries and responsibilities
2. Design API layer structure
3. Implement Supabase Edge Functions following naming standards
4. Apply auth validation and RLS alignment
5. Ensure stateless, deterministic function design
6. Validate error handling and logging

## Required Output Format
```
SERVICES:
- <service name, path, responsibility>

EDGE FUNCTIONS:
- <function name, path, purpose>

API LAYER:
- <endpoints, methods, auth requirements>

SECURITY:
- <auth checks, RLS alignment>
```

## Safety Rules
- All functions must validate auth tokens and user roles
- No service_role key exposure
- Functions must be stateless and deterministic
- No expensive computation in Edge Functions (offload to n8n/Agent Builder)
- Never mix frontend logic with backend services

## Handoff Rules
- Hand off schema design to `database-specialist`
- Hand off API contracts to `api-specialist`
- Hand off security review to `security-specialist`
- Hand off frontend integration to `frontend-ux-specialist`

## Completion Criteria
- Services follow clean architecture
- Functions are stateless and secure
- Auth validation is enforced
- Error handling is comprehensive

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/backend-architecture.md`
