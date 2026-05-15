# Workflow: Supabase Change Review

## Purpose
Review and approve database schema changes, migrations, and RLS policy modifications.

## When to Use
- Before any database schema change
- Before any migration deployment
- Before any RLS policy modification

## Required Input
- Proposed schema changes or migration SQL
- Current schema state
- Affected tables and relationships

## Steps
1. Classify migration risk (Level 1-5) using `database-specialist`
2. Review RLS impact using `security-specialist`
3. Verify rollback path exists
4. Check for breaking changes to existing queries
5. Validate type regeneration plan
6. Require explicit user approval for Level 4-5 changes

## Required Skills
`database-specialist`, `security-specialist`

## Output Artifact
Migration review report with risk classification

## Safety Checks
- Migration is reversible
- RLS policies updated for new structures
- No destructive changes without staged process
- Types will be regenerated after migration

## Completion Criteria
- Risk level classified
- RLS impact assessed
- Rollback path verified
- User approval obtained for high-risk changes
