# Handoff Logs

This folder contains agent-to-agent and tool-to-tool handoff logs, as well as post-feature retrospectives.

## Handoff Format

Each handoff log should follow this format:

```markdown
# Handoff: <From Skill> → <To Skill>

## Date
<!-- YYYY-MM-DD -->

## Context
<!-- What was being worked on? -->

## From
<!-- Which skill/agent is handing off? -->

## To
<!-- Which skill/agent is receiving? -->

## Status
<!-- What is complete? What remains? -->

## Files Affected
<!-- List of files created, modified, or needing attention -->

## Blockers
<!-- Any issues the receiving skill should know about -->

## Next Steps
<!-- What should the receiving skill do first? -->
```

## Naming Convention

Files: `handoff-YYYY-MM-DD-<from>-to-<to>.md` (e.g., `handoff-2026-01-15-architect-to-codex.md`)

## Retrospectives

Post-feature retrospectives also live here. See the `post-feature-retrospective` workflow for format.
