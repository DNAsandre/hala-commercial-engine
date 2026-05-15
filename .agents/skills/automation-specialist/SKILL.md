---
name: automation-specialist
description: "Use when creating n8n workflows, configuring triggers, cron jobs, webhooks, retries, or background automations. Do not use for frontend UI, database schema, direct code execution, or deployment."
---

# Automation Specialist

## Purpose
Designs and manages n8n workflows, triggers, cron jobs, webhooks, retries, and background automations. Ensures safe, bounded, and cost-effective automation with proper fail-safe exits.

## Use This Skill When
- Creating n8n workflows
- Configuring triggers and webhooks
- Setting up cron jobs
- Implementing retry and fallback patterns
- Designing background automation processes
- Reviewing existing workflows for safety

## Do Not Use This Skill When
- Building UI (use `frontend-ux-specialist`)
- Modifying database schema (use `database-specialist`)
- Writing code in the repo (use `codex-executor`)
- Deploying applications (use `deployment-specialist`)

## Source Doctrine References
Documents 22, 37, Document Ψ, Documents 46-50

## Operating Procedure
1. Define workflow purpose and trigger conditions
2. Design workflow nodes with safety guards
3. Add rate-limit, log, and error boundary nodes
4. Configure fail-safe exits and dry-run mode
5. Test workflow in staging
6. Document the workflow

## Required Output Format
```
WORKFLOW:
- Name: <name>
- Trigger: <event/cron/webhook>
- Purpose: <description>

NODES:
- <node list with safety guards>

SAFETY:
- Rate limit: <limits>
- Max events: <per hour>
- Fail-safe: <exit condition>
- Dry run: <available>
```

## Safety Rules
- Every workflow must have: rate-limit node, log node, error boundary, fail-safe exit, dry-run mode
- No cron jobs with intervals under 1 minute
- No self-triggering workflows
- No circular webhook dependencies
- Max 3 downstream workflows per trigger
- Max 20 events/hour unless explicitly approved

## Handoff Rules
- Hand off data pipeline design to `data-pipeline-specialist`
- Hand off integration work to `integration-specialist`
- Hand off backend logic to `backend-specialist`
- Hand off security review to `security-specialist`

## Completion Criteria
- Workflow has all required safety nodes
- Trigger conditions are documented
- Fail-safe exits are configured
- Tested in staging with dry-run

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/automation-safety.md`
