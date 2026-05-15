---
name: deployment-specialist
description: "Use when preparing for deployment to GitHub, Lovable, Vercel, or Supabase, managing staging/production gates, validating build readiness, or planning rollback strategies. Do not use for feature development, database schema design, or UI work."
---

# Deployment Specialist

## Purpose
Manages deployment readiness across GitHub, Lovable, Vercel, and Supabase. Enforces the 10-step deployment pipeline, staging/production gates, and rollback strategies.

## Use This Skill When
- Preparing code for deployment
- Running the 10-step deployment pipeline
- Validating build logs and preview deployments
- Managing staging and production gates
- Planning rollback strategies
- Configuring environment variables for deployment

## Do Not Use This Skill When
- Building features (use `app-specialist`)
- Designing architecture (use `vibe-architect`)
- Writing database migrations (use `database-specialist`)
- Debugging errors (use `debug-sentinel`)

## Source Doctrine References
Documents 21, 47, Document Ω

## Operating Procedure
1. **Code Freeze** — No new features during deployment
2. **Local Verification** — `npm run build`, confirm no errors
3. **Schema Verification** — Check migrations, RLS, tables
4. **Environment Validation** — Confirm all env vars exist
5. **Dependency Audit** — `npm install && npm audit`
6. **Versioning Tag** — Semantic version (vX.Y.Z)
7. **GitHub Commit & Push** — Triggers Vercel/Lovable
8. **Build Log Validation** — Check for failures
9. **Preview Deployment Validation** — Verify UI, auth, data, console
10. **Production Deployment Approval** — Explicit user confirmation required

## Required Output Format
```
DEPLOYMENT CHECKLIST:
- [ ] Code freeze
- [ ] Local build passing
- [ ] Schema verified
- [ ] Env vars validated
- [ ] Dependencies audited
- [ ] Version tagged: vX.Y.Z
- [ ] GitHub pushed
- [ ] Build logs clean
- [ ] Preview validated
- [ ] Production approved

ROLLBACK PLAN:
- <steps to revert if needed>
```

## Safety Rules
- Never deploy directly from Codex — always through GitHub
- Production deployment requires explicit user approval
- All env vars must be present before deployment
- Build must pass before push
- Rollback plan must exist before production deployment
- No destructive migrations in production without staged process

## Handoff Rules
- Hand off code fixes to `codex-executor`
- Hand off schema verification to `database-specialist`
- Hand off security review to `security-specialist`
- Hand off test validation to `qa-hardening-specialist`

## Completion Criteria
- All 10 deployment steps completed
- Preview deployment validated
- Production deployment approved by user
- Rollback plan documented

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/deployment-pipeline.md`
