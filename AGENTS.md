# Project Agent Instructions

## Existing App Context

This repository is an existing application, not a greenfield template.

Confirmed repo identity:

- App/package name: `hala-commercial-engine`
- Product identity in docs/source: Hala Commercial Engine / Hala Commercial
- Domain: commercial, tender, renewals, document, bot, ECR, governance, CRM sync, warehouse, and transportation workflows for Hala Supply Chain Services
- Frontend: Vite + React + TypeScript under `client/`
- Backend: Express + TypeScript under `server/`
- Data platform: Supabase migrations, Supabase client usage, and `supabase/functions/ghl-proxy`

Real codebase truth overrides template placeholders. If `.project/` docs, agent templates, or workflow examples conflict with the repository, agents must trust the inspected source tree and mark unresolved items as `UNCONFIRMED` instead of inventing reconciliation.

## Operating Model

Juan is the strategist and product owner.

AI agents are the engineering execution layer.

The project follows the **Vibe Coding System** — a structured, AI-first development methodology where the human provides vision, intent, and direction, while AI agents handle architecture, code, testing, deployment, and operations.

## Project Truth Files

Agents must inspect `.project/` files when planning any work:

- `.project/vision.md` — Product purpose, target user, success criteria
- `.project/architecture.md` — Frontend, backend, Supabase, automation structure
- `.project/schema-contract.md` — Tables, columns, RLS, API contracts
- `.project/decisions/` — ADR-style decision records
- `.project/tickets/` — Feature tickets and task tracking
- `.project/qa/` — QA reports, test plans, regression records
- `.project/handoffs/` — Agent-to-agent and tool-to-tool handoff logs

## Skill Routing

| Skill | When to Use |
|-------|-------------|
| `vibe-architect` | System design, architecture planning, folder structure, feature decomposition, lifecycle stages |
| `meta-to-codex` | Converting natural-language ideas into structured Codex-ready engineering prompts |
| `codex-executor` | Repo execution, file creation/editing, commands, implementation, Git operations |
| `frontend-ux-specialist` | React/Tailwind components, dashboards, forms, app screens, responsive layouts, UX flows |
| `website-specialist` | Public websites, landing pages, marketing pages, SEO-friendly structures |
| `app-specialist` | Authenticated apps, dashboards, portals, product workflows, app testing |
| `design-system-specialist` | Reusable components, design tokens, component libraries, layout consistency |
| `accessibility-specialist` | Usability review, accessibility audit, user flow friction, validation checkpoints |
| `backend-specialist` | Backend architecture, services, server logic, Supabase backend patterns |
| `database-specialist` | Supabase schema, migrations, RLS, relationships, data integrity |
| `api-specialist` | API routes, Edge Functions, webhooks, request/response contracts, rate limiting |
| `data-pipeline-specialist` | Data movement between Supabase, n8n, APIs, Edge Functions, and agents |
| `integration-specialist` | External integrations, third-party APIs, tool handoffs, payload mapping |
| `automation-specialist` | n8n workflows, triggers, cron jobs, webhooks, retries, background automations |
| `bot-building-specialist` | AI agents, embedded bots, chat interfaces, agent registries, background agents |
| `security-specialist` | Security review, RLS safety, auth, secrets, permissions, production locks |
| `qa-hardening-specialist` | Testing, validation, regression, verification, hardening |
| `deployment-specialist` | GitHub, Lovable, Vercel, Supabase deployment readiness |
| `debug-sentinel` | Debugging, root cause analysis, error classification, safe fixes |
| `orchestration-governor` | Agent routing, handoffs, safety hierarchy, conflict prevention, loop guards |
| `memory-context` | Project memory, decision records, context retention, knowledge management |
| `agent-personality` | Tone, role behavior, agent communication, user simplification layer |
| `project-manager` | Tickets, sprint planning, task phases, progress tracking, handoffs |

## Always-On Rules

The following rule files are **always active** and apply to every agent in every context:

- `.agents/rules/global-safety.md` — Destructive action prevention, safety hierarchy, confirmation triggers
- `.agents/rules/naming-and-architecture.md` — Folder, file, component, database, and API naming conventions
- `.agents/rules/tool-boundaries.md` — Which tool owns which domain, boundary laws
- `.agents/rules/environment-protection.md` — Dev/staging/production/sandbox rules
- `.agents/rules/no-loop-cost-control.md` — Loop prevention, API rate limits, cost governance

## Safety

Agents must **never**:

- Delete files without explicit approval
- Run destructive commands (`rm -rf`, `DROP TABLE`, `git push --force`, etc.)
- Modify schema or RLS without explicit approval
- Modify production without explicit approval
- Deploy without explicit approval
- Expose secrets, tokens, API keys, or credentials
- Invent schema, endpoints, credentials, APIs, or business facts
- Make assumptions about data that doesn't exist in the codebase or documentation

## Output Standard

For substantial tasks, agents must output:

1. **Summary** — What was done
2. **Relevant skill used** — Which skill governed the work
3. **Files affected** — List of created, modified, or deleted files
4. **Plan** — What the approach was
5. **Execution steps** — What was actually performed
6. **Validation steps** — How correctness was verified
7. **Risks or blockers** — Any concerns or dependencies
8. **Handoff or next action** — What should happen next
