# Workflow: Automation Review

## Purpose
Review n8n workflows, triggers, and automations for safety, loop prevention, and cost control.

## When to Use
- Before deploying a new n8n workflow
- Before modifying existing automations
- When reviewing automation for safety issues

## Required Input
- Workflow definition
- Trigger configuration
- Connected systems

## Steps
1. Review workflow design with `automation-specialist`
2. Check for loop and cascade potential
3. Verify safety nodes (rate-limit, log, error boundary, fail-safe, dry-run)
4. Assess cost implications with cost control rules
5. Test in staging with dry-run mode
6. Produce automation safety report

## Required Skills
`automation-specialist`, `data-pipeline-specialist`, `security-specialist`

## Output Artifact
Automation review report

## Safety Checks
- No self-triggering workflows
- No circular dependencies
- All safety nodes present
- Rate limits configured
- Dry-run tested

## Completion Criteria
- All safety nodes verified
- No loop potential detected
- Cost implications assessed
- Staging test passed
