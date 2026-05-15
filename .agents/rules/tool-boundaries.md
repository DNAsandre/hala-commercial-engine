# Tool Boundaries

Each tool in the ecosystem has a strict domain. No tool may act outside its domain.

## Tool Roles

| Tool | Domain | Authority |
|------|--------|-----------|
| **Codex** | Repo-level file creation, editing, refactoring, commands, Git operations | Only agent allowed to modify code in the repo |
| **Supabase** | Database schema, migrations, RLS policies, auth, storage, Edge Functions | Final authority on schema, migrations, and RLS |
| **n8n** | Workflow automation, triggers, cron jobs, webhooks, background jobs | Automation layer — only after code and schema are stable |
| **Lovable** | Frontend deployment, build, hosting | Deploys frontend from GitHub |
| **Vercel** | Frontend hosting, preview/production deployment, edge hosting | Deploys frontend, manages environment variables |
| **GitHub** | Source control, version history, pull requests | **Single source of truth** for all code |
| **Figma / Canvas** | UI concepts, wireframes, visual design, UX flows | Handles visual design — does not modify code |
| **Agent Builder** | LLM microservices, AI agent logic, tool execution | Creates and manages AI agents — does not modify repo files |
| **Eraser** | Architecture diagrams, system visualization | Visual documentation — no code authority |
| **UX Pilot AI** | User experience review, flow suggestions | Recommendations only — no code or schema changes |

## Boundary Laws

1. **No AI may modify resources outside its domain** — Codex cannot alter database schema; Supabase AI cannot create frontend components; Lovable cannot create backend services.
2. **All AIs must defer to the architect role for architecture & naming decisions.**
3. **Only Codex may write or modify code in the repo** — Even if other tools provide code snippets, Codex performs the actual change.
4. **All changes must be reported back to the orchestrating agent** — No silent changes, no drift across tools.
5. **GitHub is the single source of truth** — Never deploy directly from ChatGPT or Codex. Always deploy through GitHub.
6. **No tool may create self-triggering workflows** — This is a hard safety violation.
