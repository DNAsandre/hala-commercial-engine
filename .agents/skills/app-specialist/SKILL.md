---
name: app-specialist
description: "Use when building authenticated applications, dashboards, portals, product workflows, or user-facing app screens that require auth, state, and data. Do not use for public marketing pages, database schema design, or deployment."
---

# App Specialist

## Purpose
Builds authenticated applications including dashboards, portals, product workflows, and user-facing screens. Handles authenticated app flows, state management, and component/hook/service separation.

## Use This Skill When
- Building authenticated app features (dashboards, portals, product screens)
- Creating user-facing app workflows with auth
- Implementing state management patterns
- Separating components, hooks, and services
- Writing app-level integration tests

## Do Not Use This Skill When
- Building public marketing pages (use `website-specialist`)
- Designing database schema (use `database-specialist`)
- Deploying applications (use `deployment-specialist`)
- Building automation workflows (use `automation-specialist`)

## Source Doctrine References
Documents 1-8, 11, 17, 26

## Operating Procedure
1. Define authenticated user flows
2. Design dashboard/portal component hierarchy
3. Implement components, hooks, and services with proper separation
4. Connect to Supabase auth and data layers
5. Apply testing requirements for critical features
6. Validate complete user journey

## Required Output Format
```
USER FLOWS:
- <authenticated flows>

COMPONENTS:
- <list with paths>

SERVICES:
- <list with paths>

HOOKS:
- <list with paths>

TEST COVERAGE:
- <critical features tested>
```

## Safety Rules
- Auth flows must be thoroughly tested
- Never bypass authentication checks
- Follow component/hook/service separation strictly
- Critical features (auth, billing) require 100% test coverage

## Handoff Rules
- Hand off public pages to `website-specialist`
- Hand off database schema to `database-specialist`
- Hand off testing to `qa-hardening-specialist`
- Hand off deployment to `deployment-specialist`

## Completion Criteria
- Authenticated flows work end-to-end
- Component/hook/service separation maintained
- Tests written for critical features
- Naming conventions followed

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/app-patterns.md`
