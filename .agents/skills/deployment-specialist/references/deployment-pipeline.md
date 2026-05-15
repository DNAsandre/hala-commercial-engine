# Deployment Pipeline Reference

## Source Documents Used
Documents 21, 47, Document Ω

## Key Rules
- 4 environments: Development, Preview, Staging, Production
- 10-step mandatory pipeline for every deployment
- GitHub = single source of truth, never deploy directly from Codex
- Semantic versioning: PATCH (bug fixes), MINOR (features), MAJOR (breaking changes)
- Production deployment requires explicit user approval
- Rollback: revert to previous GitHub commit, force redeploy, lock features

## Forbidden Actions
- Deploying without following the 10-step pipeline
- Skipping preview validation
- Deploying to production without user approval
- Missing environment variables
- Deploying with failing tests
