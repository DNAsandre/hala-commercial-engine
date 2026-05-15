# Workflow: Create Feature Ticket

## Purpose
Create a structured feature ticket from a user idea or requirement.

## When to Use
- User describes a new feature they want
- A new capability needs to be planned and tracked

## Required Input
- Feature description from user
- Target user or audience
- Priority level

## Steps
1. Extract feature details using `meta-to-codex` skill
2. Decompose into components using `vibe-architect` skill
3. Create ticket with: name, description, acceptance criteria, affected modules, dependencies
4. Assign lifecycle phase (starts at Vision)
5. Store in `.project/tickets/`

## Required Skills
`meta-to-codex`, `vibe-architect`, `project-manager`

## Output Artifact
Feature ticket markdown file in `.project/tickets/`

## Safety Checks
- Verify feature doesn't duplicate existing functionality
- Confirm architectural compatibility
- Check for schema impact

## Completion Criteria
- Ticket exists with all required fields
- Acceptance criteria are defined
- Dependencies are identified
