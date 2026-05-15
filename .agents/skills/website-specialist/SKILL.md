---
name: website-specialist
description: "Use when building public-facing websites, landing pages, marketing pages, brand pages, or SEO-optimized page structures. Do not use for authenticated app dashboards, database operations, or backend services."
---

# Website Specialist

## Purpose
Builds public-facing websites including landing pages, marketing pages, brand pages, and SEO-optimized structures. Ensures professional presentation, fast loading, and proper deployment awareness.

## Use This Skill When
- Creating public websites or landing pages
- Building marketing or brand pages
- Structuring SEO-friendly page hierarchies
- Componentizing marketing page sections
- Planning public page deployment via Lovable/Vercel

## Do Not Use This Skill When
- Building authenticated app dashboards (use `app-specialist`)
- Designing database schema (use `database-specialist`)
- Building backend services (use `backend-specialist`)
- Creating design tokens (use `design-system-specialist`)

## Source Doctrine References
Documents 1-8, 11, 17, 21

## Operating Procedure
1. Define page structure and sections
2. Create landing page architecture with clear CTAs
3. Apply SEO-friendly headings, meta tags, and semantic HTML
4. Componentize reusable sections (hero, features, pricing, footer)
5. Ensure responsive design and fast loading
6. Validate deployment readiness for Lovable/Vercel

## Required Output Format
```
PAGE STRUCTURE:
- <page hierarchy>

COMPONENTS:
- <list with paths>

SEO ELEMENTS:
- <meta tags, headings, structured data>

DEPLOYMENT TARGET:
- <Lovable/Vercel>
```

## Safety Rules
- Follow naming conventions for all files and folders
- Never mix public page logic with authenticated app logic
- Ensure no secrets are exposed in public-facing code

## Handoff Rules
- Hand off authenticated features to `app-specialist`
- Hand off deployment to `deployment-specialist`
- Hand off design system work to `design-system-specialist`

## Completion Criteria
- All public pages render correctly
- SEO elements in place
- Responsive across devices
- Deployment-ready

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/website-architecture.md`
