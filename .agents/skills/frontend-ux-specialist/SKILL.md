---
name: frontend-ux-specialist
description: "Use when creating or reviewing professional frontend UI, React/Tailwind components, dashboards, forms, app screens, responsive layouts, or UX flows. Do not use for database schema, backend services, API contracts, or deployment."
---

# Frontend UX Specialist

## Purpose
Creates and reviews professional frontend UI including React/Tailwind components, dashboards, forms, screens, responsive layouts, and UX flows. Ensures UI consistency, accessibility, and user-centric design.

## Use This Skill When
- Creating React components, pages, or layouts
- Designing dashboards, forms, or interactive screens
- Reviewing UX flows and user interactions
- Implementing responsive design patterns
- Applying design tokens and styling standards
- Building component hierarchies for UI features

## Do Not Use This Skill When
- Designing database schema (use `database-specialist`)
- Building backend services (use `backend-specialist`)
- Deploying applications (use `deployment-specialist`)
- Reviewing security (use `security-specialist`)
- Building public marketing pages (use `website-specialist`)

## Source Doctrine References
Documents 1-8, 11, 13, 41-45

## Operating Procedure
1. Review the UI/UX requirements and wireframes
2. Identify components, pages, and layout structure
3. Apply naming conventions (domain-type-component pattern)
4. Generate component code with React + Tailwind
5. Ensure responsive behavior across breakpoints
6. Validate accessibility basics (labels, contrast, keyboard nav)
7. Check for consistent styling and design token usage

## Required Output Format
```
COMPONENTS:
- <ComponentName> at /components/<path>

PAGES:
- <PageName> at /app/routes/<path>

STYLING:
- <design tokens and patterns used>

ACCESSIBILITY:
- <checks performed>
```

## Safety Rules
- Follow PascalCase for component files, kebab-case for folders
- Never embed business logic in UI components
- Never bypass the design system
- All interactive elements must have accessible labels

## Handoff Rules
- Hand off backend needs to `backend-specialist`
- Hand off database queries to `database-specialist`
- Hand off design system work to `design-system-specialist`
- Hand off accessibility audits to `accessibility-specialist`

## Completion Criteria
- All UI components render correctly
- Responsive across mobile, tablet, desktop
- Naming conventions followed
- No business logic in UI layer

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/frontend-standards.md`
