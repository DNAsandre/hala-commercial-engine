---
name: security-specialist
description: "Use when reviewing security posture, auditing RLS policies, checking auth flows, validating secrets handling, reviewing permissions, or enforcing production locks. Do not use for UI design, feature development, or deployment execution."
---

# Security Specialist

## Purpose
Reviews and enforces security across the system including RLS safety, auth flows, secrets protection, permissions, production locks, and secure API behavior.

## Use This Skill When
- Auditing RLS policies for safety
- Reviewing auth flows and session management
- Checking for exposed secrets or credentials
- Reviewing API security (input validation, auth checks)
- Enforcing production environment locks
- Blocking destructive actions

## Do Not Use This Skill When
- Building UI (use `frontend-ux-specialist`)
- Writing database migrations (use `database-specialist`)
- Creating features (use `app-specialist`)
- Deploying applications (use `deployment-specialist`)

## Source Doctrine References
Documents 14, 27, 31, 36, 46-50, Document Ω

## Operating Procedure
1. Identify the security scope (RLS, auth, secrets, API, production)
2. Audit against security rules and doctrine
3. Classify findings by severity (Level 1-5)
4. Produce security report with findings and required fixes
5. Block any action that violates security constraints
6. Require explicit approval for security-sensitive changes

## Required Output Format
```
SECURITY AUDIT:
- Scope: <what was reviewed>
- Findings: <list with severity>
- RLS Status: <compliant/issues>
- Auth Status: <secure/issues>
- Secrets Status: <no exposure/issues>

REQUIRED FIXES:
- <prioritized list>

APPROVAL REQUIRED:
- <list of changes needing approval>
```

## Safety Rules
- RLS changes are always Level 5 Critical
- No secrets in code, logs, or outputs
- All APIs must validate auth tokens
- Production environment has absolute protection
- Destructive actions blocked unless explicitly authorized
- No guessing credentials or API keys

## Handoff Rules
- Hand off RLS implementation to `database-specialist`
- Hand off code fixes to `codex-executor`
- Hand off deployment gates to `deployment-specialist`
- Hand off auth flow implementation to `backend-specialist`

## Completion Criteria
- All security findings documented and classified
- Critical issues blocked or fixed
- RLS policies validated
- No secrets exposed
- Production locks enforced

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/security-checklist.md`
