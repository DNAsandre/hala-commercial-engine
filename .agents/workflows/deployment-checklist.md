# Workflow: Deployment Checklist

## Purpose
Execute the full 10-step deployment pipeline for safe, predictable deployment.

## When to Use
- Before any deployment to staging or production
- When user requests "deploy this"

## Required Input
- Code ready for deployment
- Target environment (staging/production)
- Version number

## Steps
1. **Code freeze** — No new features during deployment
2. **Local verification** — `npm run build`, confirm no errors
3. **Schema verification** — Check migrations, RLS, tables with `database-specialist`
4. **Environment validation** — Confirm all env vars exist
5. **Dependency audit** — `npm install && npm audit`
6. **Version tag** — Semantic version (vX.Y.Z)
7. **GitHub commit & push** — Triggers Vercel/Lovable
8. **Build log validation** — Check for failures
9. **Preview deployment validation** — Verify UI, auth, data
10. **Production deployment approval** — Explicit user confirmation

## Required Skills
`deployment-specialist`, `database-specialist`, `security-specialist`, `qa-hardening-specialist`

## Output Artifact
Deployment status report with rollback plan

## Safety Checks
- All 10 steps completed in order
- No skipped steps
- Production requires explicit user approval
- Rollback plan documented

## Completion Criteria
- All 10 pipeline steps completed
- Preview validated
- Production approved by user
- Rollback plan in place
