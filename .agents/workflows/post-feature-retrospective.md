# Workflow: Post-Feature Retrospective

## Purpose
Review a completed feature for lessons learned, quality, and process improvement.

## When to Use
- After a feature is deployed to production
- After a significant development milestone

## Required Input
- Feature ticket
- Implementation history
- Test results
- Deployment status

## Steps
1. Summarize what was built using `project-manager`
2. Review architecture decisions with `vibe-architect`
3. Assess code quality with `qa-hardening-specialist`
4. Document lessons learned
5. Identify process improvements
6. Update `.project/decisions/` with any new ADRs
7. Archive ticket

## Required Skills
`project-manager`, `vibe-architect`, `qa-hardening-specialist`, `memory-context`

## Output Artifact
Retrospective report in `.project/handoffs/`

## Safety Checks
- All acceptance criteria were met
- Tests are passing
- Documentation is updated
- Decisions are recorded

## Completion Criteria
- Retrospective report complete
- Lessons learned documented
- Process improvements identified
- Knowledge base updated
