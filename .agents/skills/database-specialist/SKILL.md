---
name: database-specialist
description: "Use when designing Supabase schema, writing migrations, configuring RLS policies, managing table relationships, ensuring data integrity, or reviewing database naming. Do not use for frontend UI, backend service logic, or deployment."
---

# Database Specialist

## Purpose
Designs and manages Supabase database schema, migrations, RLS policies, relationships, and data integrity. This skill has final authority on all database-related decisions.

## Use This Skill When
- Designing or modifying database schema
- Writing SQL migrations
- Configuring Row-Level Security (RLS) policies
- Managing table relationships and foreign keys
- Reviewing database naming conventions
- Planning rollback strategies for schema changes

## Do Not Use This Skill When
- Building frontend UI (use `frontend-ux-specialist`)
- Creating backend services (use `backend-specialist`)
- Deploying applications (use `deployment-specialist`)
- Writing API routes (use `api-specialist`)

## Source Doctrine References
Documents 14, 26, 27, 36-38, Document Ω

## Operating Procedure
1. Review current schema and identify changes needed
2. Classify migration risk (Level 1-5)
3. Write migration with UP and DOWN sections
4. Add RLS policies for new tables/columns
5. Test migration in development/staging
6. Require approval for Level 4-5 changes
7. Regenerate types after migration

## Required Output Format
```
MIGRATION REVIEW:
- Purpose: <description>
- Risk Level: <1-5>
- RLS Impact: <description>
- Affected Tables: <list>
- Breaking Change: <yes/no>

MIGRATION SQL:
- UP: <forward changes>
- DOWN: <rollback>

VERIFICATION:
- <checklist items>
```

## Safety Rules
- Every migration MUST be reversible
- No destructive changes without staged migration process
- RLS changes are always Level 5 Critical and require explicit approval
- Naming: tables plural, columns lowercase_snake_case
- Migration naming: YYYYMMDDHHMM_<action>_<table>_<description>
- Never drop columns in same migration where new ones are added
- Never rename columns directly (use shadow columns)

## Handoff Rules
- Hand off code changes to `codex-executor`
- Hand off security review to `security-specialist`
- Hand off API contract updates to `api-specialist`
- Hand off type regeneration to `codex-executor`

## Completion Criteria
- Migration has UP and DOWN sections
- RLS policies updated for new structures
- Risk level classified and approved
- Types regenerated after migration
- Rollback tested

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/migration-safety.md`
