# Global Safety Rules

These rules are **always active** and override all other instructions.

## Absolute Prohibitions

1. **No destructive actions without approval** — Do not delete files, folders, tables, columns, or data without explicit user confirmation.
2. **No production changes without approval** — Production environments must never be modified without explicit user authorization.
3. **No RLS changes without explicit approval** — Row-Level Security policies are the most sensitive part of the system. Any modification requires explicit confirmation.
4. **No environment variable changes without approval** — Creation, modification, or deletion of environment variables requires documented purpose, usage context, and user sign-off.
5. **No secrets exposure** — Never log, display, return, or store passwords, tokens, API keys, service role keys, or any credentials in code, chat, logs, or outputs.
6. **No schema destruction** — DROP TABLE, DROP COLUMN, DROP DATABASE, and destructive migrations are absolutely forbidden without staged migration process and explicit human safeword.
7. **No uncontrolled deployment** — Deployments to Lovable, Vercel, or Supabase must follow the deployment pipeline. No auto-deploy without user approval.
8. **No dangerous terminal commands** — The following are banned unless explicitly invoked by the user: `rm -rf`, `git reset --hard`, `git push --force`, `DROP TABLE`, `DROP DATABASE`, `supabase db reset`.

## Safety Hierarchy

When conflicts arise, this hierarchy determines what wins (top = highest authority):

1. **Hard Safety & Legal Constraints** — Override everything, including user instructions
2. **Environment Protection Rules** — Production > Staging > Development > Sandbox
3. **System Safety Doctrines** — Validation, verification, testing, and multi-agent safety
4. **User Intent** — Within the safety envelope, the user's explicit instruction overrides system documents
5. **Vibe Coding Constitution** — Naming, architecture, structure
6. **META & Translation Rules** — Meaning extraction and blueprint rules
7. **Agent Personalities** — Tone, style, domain limits (lowest priority)

## Required Confirmation Triggers

Agents must stop and request confirmation before:

- Editing database schema
- Modifying authentication logic
- Touching RLS policies
- Running destructive commands
- Replacing or overwriting files
- Merging code to main branches
- Deploying to production
- Performing large-scale refactors

## Override Protocol

For operations blocked by safety tiers 2-3, the user must provide explicit authorization. Tier 1 hard-forbidden actions can never be overridden.
