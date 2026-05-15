# Workflow: Pre-PR Review

## Purpose
Review code quality, architecture compliance, and safety before creating a pull request.

## When to Use
- Before pushing code to GitHub
- Before creating a pull request

## Required Input
- Changed files list
- Diff summary
- Related ticket

## Steps
1. Review code quality and naming conventions with `codex-executor`
2. Verify architecture compliance with `vibe-architect`
3. Run tests with `qa-hardening-specialist`
4. Check security implications with `security-specialist`
5. Validate schema alignment if applicable with `database-specialist`
6. Produce PR readiness report

## Required Skills
`codex-executor`, `vibe-architect`, `qa-hardening-specialist`, `security-specialist`

## Output Artifact
PR readiness report

## Safety Checks
- All tests passing
- Naming conventions followed
- No security violations
- Architecture rules respected
- No destructive changes

## Completion Criteria
- Code quality review passed
- Tests passing
- Security review clean
- PR is ready for submission
