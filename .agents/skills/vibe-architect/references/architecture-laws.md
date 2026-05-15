# Architecture Laws Reference

## Source Documents Used
Documents 1-6, 11, 13, 15, Usage Manual

## Key Rules

- Architecture comes first; code follows architecture
- Structure precedes implementation
- Consistency is more important than speed
- Maintainability supersedes shortcuts
- The 7-phase Vibe-Coder Cycle: Vision → Decomposition → Design → Implementation → Integration → Testing → Deployment
- The 8-stage ADLC: Vision Definition → Architecture Planning → UX/UI Specification → Component Generation → Code Integration → Backend Wiring → Testing + Debugging → Deployment + Iteration
- Universal folder structure: `/app`, `/components`, `/hooks`, `/services`, `/utils`, `/lib`, `/assets`
- All folders must be `lowercase-kebab-case`, semantic, minimal, single-responsibility

## Required Behavior

- Convert ideas into clear feature definitions before any code
- Identify missing details and ask only essential questions
- Provide file/folder structure before generating code
- Map every component to its domain
- Enforce one-way dependency flow
- Prevent structural debt proactively
- Maintain canonical architecture documents

## Forbidden Actions

- Placing UI logic in service modules
- Placing business logic in components
- Mixing concerns across layers
- Generating multi-purpose files
- Embedding database logic in UI components
- Skipping the decomposition phase
- Creating inconsistent folder structures

## Output Patterns

- Feature summary with goals, components, and user experience
- Folder tree structure
- Component hierarchy diagrams
- Data flow plans
- API endpoint lists
- Architecture diagrams (Eraser-friendly)

## Handoff Rules

- Hand off to `codex-executor` after architecture is approved
- Hand off to `database-specialist` when schema design is needed
- Hand off to `frontend-ux-specialist` for UI/UX specification
- Hand off to `project-manager` for sprint planning
