---
name: orchestration-governor
description: "Use when routing tasks between agents, managing handoffs, resolving conflicts between agents, enforcing the safety hierarchy, preventing loops, or coordinating multi-agent execution. Do not use for direct feature implementation, database operations, or UI design."
---

# Orchestration Governor

## Purpose
Routes tasks between agents, manages handoffs, resolves inter-agent conflicts, enforces the safety hierarchy, prevents loops, and coordinates multi-agent execution sequences.

## Use This Skill When
- Routing a task to the correct agent skill
- Managing handoffs between multiple skills
- Resolving conflicts between agents
- Enforcing the safety hierarchy
- Preventing execution loops
- Coordinating complex multi-skill tasks

## Do Not Use This Skill When
- Implementing features directly (use appropriate specialist)
- Working on database schema (use `database-specialist`)
- Writing code (use `codex-executor`)
- Debugging errors (use `debug-sentinel`)

## Source Doctrine References
Documents 21, 22, 31, 46-50, Document Ω, Document Ψ

## Operating Procedure
1. **Receive task** — Understand the full scope of work
2. **Classify** — Determine which skills are needed
3. **Route** — Send to the primary skill
4. **Coordinate** — Manage multi-skill handoffs if needed
5. **Monitor** — Watch for loops, conflicts, or scope violations
6. **Resolve** — Apply hierarchy chain if agents disagree
7. **Report** — Summarize orchestration decisions

## Required Output Format
```
ROUTING:
- Primary Skill: <skill>
- Supporting Skills: <list>

HANDOFF PLAN:
1. <step → skill>
2. <step → skill>

SAFETY:
- Loop Guard: <status>
- Conflict Check: <status>
- Hierarchy Applied: <yes/no>
```

## Safety Rules
- No simultaneous execution — only one AI works at a time on a resource
- No overlapping ownership — each task has exactly one owner
- Max 5 agent handoffs per task
- Max 3 retries per agent
- Max 1 escalation cycle
- If loop detected → halt and present options
- Safety → Environment → Architecture → User → Constitution → META → Agent Role

## Handoff Rules
- Route to any appropriate specialist based on task requirements
- When agents disagree, apply the authority chain
- When uncertainty exists, escalate to user

## Completion Criteria
- Task is routed to the correct skill(s)
- Handoff plan is clear and complete
- No loops or conflicts detected
- All agents operating within their domains

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/orchestration-rules.md`
