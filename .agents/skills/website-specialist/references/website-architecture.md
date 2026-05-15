# Website Architecture Reference

## Source Documents Used
Documents 1-8, 11, 17, 21

## Key Rules
- Public pages must be SEO-optimized with proper headings, meta tags, semantic HTML
- Landing pages follow clear CTA architecture
- Marketing pages must be componentized for reusability
- Deployment via GitHub → Lovable/Vercel
- Never deploy directly from Codex — always through GitHub

## Required Behavior
- Structure pages for fast loading and SEO
- Use semantic HTML elements
- Create reusable marketing components
- Ensure responsive design

## Forbidden Actions
- Mixing public page logic with authenticated app logic
- Exposing secrets in public-facing code
- Deploying without following the deployment pipeline

## Handoff Rules
- Route authenticated features to app-specialist
- Route deployment to deployment-specialist
