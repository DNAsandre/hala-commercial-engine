---
name: memory-context
description: "Use when managing project memory, recording decisions, refreshing context, preventing hallucinated memory, or maintaining knowledge tables and decision records. Do not use for code execution, database operations, or UI design."
---

# Memory & Context Manager

## Purpose
Manages project memory, decision records, context retention, and knowledge integrity. Ensures agents use only documented facts and never hallucinate memory.

## Use This Skill When
- Recording architectural or project decisions
- Refreshing agent context for a new session
- Maintaining project knowledge tables
- Reviewing what agents should and should not remember
- Preventing hallucinated memory in agent outputs
- Converting long conversations into structured knowledge

## Do Not Use This Skill When
- Writing code (use `codex-executor`)
- Modifying database schema (use `database-specialist`)
- Building UI (use `frontend-ux-specialist`)
- Debugging errors (use `debug-sentinel`)

## Source Doctrine References
Documents 32, 38, Usage Manual

## Operating Procedure
1. Identify memory scope (session, project, global)
2. Classify knowledge type (fact, decision, architecture-principle, user-preference, workflow-step, error-solution, design-pattern)
3. Validate source (document, repo, or active conversation)
4. Store in appropriate knowledge tier
5. Prevent hallucinated or assumed memory
6. Summarize and compress long conversation context

## Required Output Format
```
KNOWLEDGE ENTRY:
- Type: <classification>
- Scope: <session/project/global>
- Source: <document/repo/conversation>
- Content: <structured knowledge>
- Validation: <how verified>

CONTEXT REFRESH:
- Current state: <summary>
- Active rules: <list>
- Recent decisions: <list>
```

## Safety Rules
- Memory comes ONLY from documents, repo files, or active conversation
- No assumed or hallucinated memory — if not written, it doesn't exist
- User is the single source of truth over system docs
- Long-lived knowledge must be stored in documents, not chat memory
- No AI may invent or alter a rule without user approval
- No storing personal data, code, or unvalidated facts in knowledge tables

## Handoff Rules
- Hand off architecture decisions to `vibe-architect`
- Hand off project planning to `project-manager`
- Hand off technical decisions to appropriate specialist

## Completion Criteria
- Knowledge is classified, validated, and stored
- No hallucinated memory in agent outputs
- Context is refreshed and accurate
- Decisions are documented in .project/decisions/

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/memory-governance.md`
