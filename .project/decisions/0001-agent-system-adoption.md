# ADR-0001: Agent System Adoption

## Status

Accepted

## Date

2026-05-14

## Decision

Adopt the `.agents/` skill/rule system and `AGENTS.md` as the agent governance layer for this existing repository.

## Reason

The repository already contains an agent system scaffold, but the project truth documents were template placeholders. Agents need synchronized governance that recognizes this as the existing Hala Commercial Engine app and avoids replacing real codebase facts with template assumptions.

## Scope

This decision covers documentation and agent governance only.

In scope:

- `AGENTS.md`
- `.project/current-state.md`
- `.project/adoption-audit.md`
- `.project/architecture.md`
- `.project/schema-contract.md`
- `.project/decisions/0001-agent-system-adoption.md`

Out of scope:

- App source code changes
- Supabase migrations
- RLS policies
- Environment files
- Package dependencies
- Deployment settings
- Production configuration

## Files Added Or Updated

- Updated `AGENTS.md` with existing app context and the rule that real codebase truth overrides template placeholders.
- Added `.project/current-state.md`.
- Added `.project/adoption-audit.md`.
- Updated `.project/architecture.md`.
- Updated `.project/schema-contract.md`.
- Added `.project/decisions/0001-agent-system-adoption.md`.

## Risks

- Multiple migration roots make the authoritative live schema `UNCONFIRMED`.
- Some existing documentation is stale relative to the current route/source surface.
- `.project/vision.md` remains a placeholder because this task did not allow editing it.
- Generated Supabase types were not found.
- RLS and service-role behavior must not be changed or assumed without a dedicated security/database review.

## Rule

Real codebase truth overrides template placeholders.

If documentation, templates, or agent guidance conflict with inspected source files, agents must follow the source files and mark unresolved items as `UNCONFIRMED` instead of inventing missing schema, endpoints, product identity, integrations, or production settings.

## Next Step

Verify the authoritative Supabase migration history and generate a complete schema/type contract from the live project before making schema, RLS, or data-access changes.
