# QA Reports

This folder contains QA reports, test plans, and regression records.

## Report Format

Each QA report should follow this format:

```markdown
# QA Report: <Feature or Sprint Name>

## Date
<!-- YYYY-MM-DD -->

## Scope
<!-- What was tested? -->

## Test Results

### Unit Tests
- Total: 
- Passed: 
- Failed: 
- Coverage: 

### Integration Tests
- Total: 
- Passed: 
- Failed: 

### E2E Tests
- Total: 
- Passed: 
- Failed: 

### Regression Tests
- Total: 
- Passed: 
- Failed: 

## Failures

| Test | Category | Severity | Root Cause | Fix Required |
|------|----------|----------|------------|--------------|
| | | | | |

## Deployment Readiness
<!-- Ready / Not Ready — with reason -->

## Notes
<!-- Additional observations -->
```

## Naming Convention

Files: `qa-YYYY-MM-DD-<scope>.md` (e.g., `qa-2026-01-15-auth-flow.md`)
