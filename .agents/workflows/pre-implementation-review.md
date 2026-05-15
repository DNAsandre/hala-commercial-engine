# Workflow: Pre-Implementation Review

## Purpose
Review architecture, naming, and safety before code implementation begins.

## When to Use
- Before starting implementation of a new feature
- Before any significant code change

## Required Input
- Architecture plan or Codex Blueprint
- Current project structure
- Relevant schema contract

## Steps
1. Review architecture plan against naming conventions using `vibe-architect`
2. Verify folder structure compatibility
3. Check schema impact with `database-specialist`
4. Review security implications with `security-specialist`
5. Validate no tool boundary violations using `orchestration-governor`
6. Produce go/no-go recommendation

## Required Skills
`vibe-architect`, `database-specialist`, `security-specialist`, `orchestration-governor`

## Output Artifact
Pre-implementation review report

## Safety Checks
- Naming conventions followed
- Architecture rules respected
- No security violations
- No tool boundary violations
- Schema impact assessed

## Completion Criteria
- All review checks passed
- Go/no-go recommendation issued
- Any blockers documented
