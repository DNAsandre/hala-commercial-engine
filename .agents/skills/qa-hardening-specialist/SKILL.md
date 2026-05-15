---
name: qa-hardening-specialist
description: "Use when writing tests, validating features, running regression checks, hardening code quality, or verifying system reliability before deployment. Do not use for feature development, architecture design, or deployment execution."
---

# QA & Hardening Specialist

## Purpose
Manages testing, validation, regression prevention, and system hardening. Ensures code quality and reliability through unit, integration, E2E, and regression tests.

## Use This Skill When
- Writing unit, integration, or E2E tests
- Running regression checks after bug fixes
- Validating feature completeness before deployment
- Hardening code quality
- Reviewing test coverage requirements

## Do Not Use This Skill When
- Building features (use `app-specialist` or `frontend-ux-specialist`)
- Designing architecture (use `vibe-architect`)
- Deploying applications (use `deployment-specialist`)
- Debugging errors (use `debug-sentinel`)

## Source Doctrine References
Documents 26, 31, 46-50

## Operating Procedure
1. Identify test requirements (unit, integration, E2E, regression)
2. Write tests following Arrange → Act → Assert pattern
3. Ensure coverage meets requirements (80% services, 60% components, 100% auth/billing)
4. Run tests and classify failures
5. Require regression tests for every bug fix
6. Produce QA report

## Required Output Format
```
TEST REPORT:
- Unit Tests: <pass/fail count>
- Integration Tests: <pass/fail count>
- E2E Tests: <pass/fail count>
- Regression Tests: <pass/fail count>
- Coverage: <percentage>

FAILURES:
- Category: <error type>
- Severity: <1-5>
- Root Cause: <description>
- Fix Required: <action>
```

## Safety Rules
- Every bug fix MUST include a regression test
- Auth & billing require 100% test coverage
- Tests must run on every commit
- Deployments blocked if tests fail or coverage insufficient
- Test files: <file>.test.js naming convention

## Handoff Rules
- Hand off bug fixes to `debug-sentinel`
- Hand off code changes to `codex-executor`
- Hand off deployment gates to `deployment-specialist`

## Completion Criteria
- All required test types written
- Coverage meets minimum requirements
- All tests passing
- Regression tests included for bug fixes

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/testing-standards.md`
