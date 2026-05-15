---
name: meta-to-codex
description: "Use when converting natural-language ideas, feature requests, or user intent into structured Codex-ready engineering prompts. Captures meaning, emotion, architecture, and constraints using the META extraction framework. Do not use for writing code, database operations, deployment, or UI design."
---

# META-to-Codex Translation

## Purpose

Captures the user's high-level ideas, intent, and vision and converts them into structured, complete, safe engineering instructions for the Codex execution agent. This skill is the bridge between human intelligence and machine logic.

## Use This Skill When

- The user provides a natural-language feature request or idea
- Converting vague or conceptual instructions into engineering prompts
- Ensuring no human nuance, intent, or meaning is lost before code is written
- Building the Codex Prompt Blueprint (CONTEXT, OBJECTIVE, REQUIREMENTS, FILES, ARCHITECTURE, ACCEPTANCE CRITERIA, SAFEGUARDS)
- Performing META extraction (Meaning, Emotion, Thought, Architecture)

## Do Not Use This Skill When

- Writing actual code (use `codex-executor`)
- Designing database schema (use `database-specialist`)
- Building UI components (use `frontend-ux-specialist`)
- Debugging errors (use `debug-sentinel`)

## Source Doctrine References

- Documents 53-56 (META-to-Codex Protocol, Codex Interpretation Protocol)
- Usage Manual
- Document 16 (Vibe Codex)

## Operating Procedure

1. **Receive input** — Listen to the user's idea or feature request
2. **Extract META** — Identify Purpose, Pain, Goal, Feature, Architecture, Constraint, Priority, Data Flow, User Story, Behavior, Success criteria
3. **Apply 5-I Method** — Identify → Interpret → Integrate → Imagine → Instruct
4. **Create PRTM** — Build the Prompt-Ready Thought Model
5. **Generate Codex Blueprint** — Produce structured prompt with all 7 sections
6. **Validate completeness** — Ensure the blueprint is unambiguous and complete
7. **Hand off to Codex** — Send the structured blueprint for execution

## Required Output Format

```
[CONTEXT]
- What system or repo Codex is working on

[OBJECTIVE]
- The explicit goal

[REQUIREMENTS]
- Technical rules Codex must follow

[FILES + PATHS]
- Which files get created, edited, or deleted

[ARCHITECTURE]
- Component structure, flows, dependencies

[ACCEPTANCE CRITERIA]
- What "done correctly" looks like

[SAFEGUARDS]
- What Codex must NOT change
```

## Safety Rules

- Never skip META extraction
- Never send ambiguous instructions to Codex
- Never generate code directly (that is Codex's job)
- Never modify files or run commands
- Never pass raw emotional text directly to Codex without structuring it
- Always preserve the user's intent and meaning

## Handoff Rules

- Hand off completed blueprints to `codex-executor`
- Hand off architecture questions to `vibe-architect`
- Hand off database schema questions to `database-specialist`

## Completion Criteria

- Codex Blueprint contains all 7 required sections
- No ambiguity remains in the instructions
- META tags classify all user meaning
- PRTM is complete and validated
- Blueprint is ready for direct Codex execution

## Anti-Overlap Rule

If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files

- `references/meta-extraction-framework.md`
