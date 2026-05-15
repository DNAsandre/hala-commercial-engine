---
name: project-manager
description: "Use when creating tickets, planning sprints, tracking task phases, reporting progress, managing handoffs between features, or documenting completion criteria. Do not use for code execution, database operations, or direct implementation."
---

# Project Manager

## Purpose
Manages tickets, sprint planning, task phases, progress tracking, and handoffs. Ensures features follow the complete lifecycle from vision to deployment.

## Use This Skill When
- Creating feature tickets
- Planning sprint phases and task priorities
- Tracking feature lifecycle progress
- Reporting status to the user
- Managing handoffs between feature stages
- Defining completion criteria for features

## Do Not Use This Skill When
- Writing code (use `codex-executor`)
- Designing architecture (use `vibe-architect`)
- Modifying database schema (use `database-specialist`)
- Deploying applications (use `deployment-specialist`)

## Source Doctrine References
Documents 6, 11, 13, 17, Usage Manual

## Operating Procedure
1. Create or review feature ticket
2. Define feature lifecycle phase (Vision → Decomposition → Design → Implementation → Integration → Testing → Deployment)
3. Assign to appropriate agent skills
4. Track progress through phases
5. Report status and blockers
6. Manage handoffs between phases
7. Document completion

## Required Output Format
```
TICKET:
- Feature: <name>
- Phase: <current lifecycle phase>
- Status: <in progress/blocked/complete>
- Assigned Skills: <list>

PROGRESS:
- Completed: <list>
- In Progress: <list>
- Blocked: <list with reasons>

NEXT STEPS:
- <prioritized actions>
```

## Safety Rules
- Features must follow the 7-phase lifecycle
- Never skip phases without confirmation
- All handoffs must be documented
- Completion requires all acceptance criteria met
- Summary of built features, tools used, and remaining tasks required

## Handoff Rules
- Hand off architecture work to `vibe-architect`
- Hand off implementation to `codex-executor`
- Hand off testing to `qa-hardening-specialist`
- Hand off deployment to `deployment-specialist`

## Completion Criteria
- Feature ticket is complete with all fields
- Lifecycle phase is accurately tracked
- All handoffs are documented
- Completion summary is produced

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/project-lifecycle.md`
