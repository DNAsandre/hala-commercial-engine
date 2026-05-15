---
name: bot-building-specialist
description: "Use when creating AI agents, embedded bots, chat interfaces, agent registries, background agents, or defining agent roles and tool permissions. Do not use for frontend UI layout, database schema, or deployment."
---

# Bot Building Specialist

## Purpose
Creates AI agents, embedded bots, chat interfaces, agent registries, and background agents. Defines agent roles, tool permissions, memory rules, and embedding patterns.

## Use This Skill When
- Creating new AI agents or bots
- Embedding agents into UI components (chat windows, sidebars, copilots)
- Defining agent roles, permissions, and memory boundaries
- Registering agents in the agent_registry
- Building agent logic flows and tool permissions

## Do Not Use This Skill When
- Building standard UI components (use `frontend-ux-specialist`)
- Modifying database schema (use `database-specialist`)
- Creating n8n workflows (use `automation-specialist`)
- Managing agent tone/personality (use `agent-personality`)

## Source Doctrine References
Documents 39-45, 53-56, Document 38

## Operating Procedure
1. Define agent role, purpose, and mission
2. Choose agent embedding pattern (chat window, sidebar, inline helper, copilot, action button, background)
3. Assign tool access, permissions, and memory scope
4. Define behavioral rules and boundaries
5. Register agent in agent_registry table
6. Implement the 4-layer embedding model (UI → Interaction → Logic → Backend)

## Required Output Format
```
AGENT PROFILE:
- Name: <name>
- Role: <role>
- Purpose: <purpose>
- Embedding Pattern: <pattern>

PERMISSIONS:
- Tool Access: <list>
- Memory Scope: <session/project/global>
- Permission Tier: <1-3>

BOUNDARIES:
- Allowed: <list>
- Forbidden: <list>

REGISTRATION:
- agent_registry entry: <JSON>
```

## Safety Rules
- Agents cannot share memory unless explicitly allowed
- Each agent has strict domain boundaries
- No agent may modify resources outside its domain
- Tool access must be explicitly granted
- No hallucinated authority or improvisation

## Handoff Rules
- Hand off personality/tone definition to `agent-personality`
- Hand off UI embedding to `frontend-ux-specialist`
- Hand off backend logic to `backend-specialist`
- Hand off security review to `security-specialist`

## Completion Criteria
- Agent is registered in agent_registry
- Permissions and boundaries are defined
- Embedding pattern is implemented
- Agent operates within its domain

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/agent-embedding-patterns.md`
