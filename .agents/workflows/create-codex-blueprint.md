# Workflow: Create Codex Blueprint

## Purpose
Convert a user's idea into a fully structured Codex-ready engineering prompt.

## When to Use
- User provides a natural-language feature request
- A feature ticket needs to become actionable code instructions

## Required Input
- User's idea or feature description
- Existing architecture context
- Relevant project files

## Steps
1. Extract META from user input (Meaning, Emotion, Thought, Architecture)
2. Apply 5-I Method (Identify → Interpret → Integrate → Imagine → Instruct)
3. Build PRTM (Prompt-Ready Thought Model)
4. Generate 7-section Codex Blueprint (CONTEXT, OBJECTIVE, REQUIREMENTS, FILES, ARCHITECTURE, ACCEPTANCE CRITERIA, SAFEGUARDS)
5. Validate blueprint completeness
6. Hand off to `codex-executor`

## Required Skills
`meta-to-codex`, `vibe-architect`

## Output Artifact
Codex Blueprint document

## Safety Checks
- Blueprint must have all 7 sections
- SAFEGUARDS section must be present
- No ambiguous instructions

## Completion Criteria
- Blueprint is complete and unambiguous
- Ready for direct Codex execution
