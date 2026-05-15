# Debugging Workflow Reference

## Source Documents Used
Documents 20, 24, 26, 46-50

## Key Rules
- Error Lexicon categories: syntax-error, runtime-error, data-error, api-error, ui-error, infra-error
- Severity levels 1-5 matching migration risk framework
- Debugging workflow: Diagnose → Classify → Fix → Validate
- Every bug fix requires a regression test
- Never overwrite code to fix a bug — apply minimal changes

## Required Behavior
- Identify root cause before proposing fix
- Offer 2-3 recovery paths
- Apply the safest fix option
- Write regression test immediately after fix
- Report in structured format

## Forbidden Actions
- Guessing root causes
- Regenerating entire modules to fix a bug
- Skipping regression tests
- Applying fixes without validation
