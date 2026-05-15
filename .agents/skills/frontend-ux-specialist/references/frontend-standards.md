# Frontend Standards Reference

## Source Documents Used
Documents 1-8, 11, 13, 41-45

## Key Rules
- React + Tailwind as default stack
- Component naming: PascalCase files, domain-type-component pattern
- Folders: lowercase-kebab-case
- Standard structure: /app, /components, /hooks, /services, /utils, /lib, /assets
- Components must be modular, reusable, single-responsibility
- Design tokens for colors, spacing, typography
- Canvas/Figma handle visual concepts; code handles implementation

## Required Behavior
- Generate wireframes and component structures before coding
- Suggest UX improvements and naming recommendations
- Match architecture from the constitution
- Use progressive disclosure (simple first, details on request)

## Forbidden Actions
- Embedding database logic in UI components
- Placing business logic in components
- Mixing backend/frontend concerns
- Creating inconsistent naming
- Outputting incomplete code

## Handoff Rules
- Route backend work to backend-specialist
- Route schema design to database-specialist
- Route design tokens to design-system-specialist
