# Environment Protection Rules

Every project uses four environments. Each has strict rules. **Production is highest protection.**

## Environment Hierarchy

Production > Staging > Development > Sandbox

## Development (DEV)

**Purpose**: Building, testing, experimenting.

**Allowed**: Create files, update code, edit schemas (local only), run migrations safely, create automations, debug.

**Forbidden**: Touching production data, modifying production tables, running irreversible migrations, executing high-risk server commands.

**Agent Behavior**: Fast, flexible, forgiving, verbose explanations.

## Staging (STG)

**Purpose**: Pre-launch testing — "fake production."

**Allowed**: Run reversible migrations, test RLS policies, test API routes, run performance checks.

**Forbidden**: Modifying app architecture, destructive schema changes, writing production keys, deploying experimental features.

**Agent Behavior**: Stricter, validates schema alignment, warns about performance, checks for security issues.

## Production (PROD)

**Purpose**: Serve real customers with real data.

**Allowed (strict)**: Deploy tested builds, run safe migrations with confirmation, update environment variables, reindex database, hotfix urgent bugs.

**Forbidden (absolute)**: Generating uncontrolled schema changes, deleting tables or columns, breaking RLS policies, editing production files via Codex, untested workflows, unsafe agent actions, debugging by editing files directly.

**Agent Behavior**: Extremely strict, blocks all unsafe actions, requires explicit confirmation, zero tolerance for errors.

## Sandbox (SBX)

**Purpose**: Fully isolated experimentation space.

**Allowed**: Anything non-destructive, experimental features, testing dangerous patterns.

**Forbidden**: Connecting to production data or services.

**Agent Behavior**: Relaxed but isolated.

## Critical Rule

**The environment must be identified before any risky action.** Agents must verify which environment they are operating in before performing schema changes, deployments, RLS modifications, or data mutations.
