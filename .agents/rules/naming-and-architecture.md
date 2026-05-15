# Naming & Architecture Rules

These naming and architecture conventions are **immutable law** across all projects.

## Folder Naming

- All folders: `lowercase-kebab-case`
- Semantic, minimal, single-responsibility
- Approved top-level folders: `/app`, `/components`, `/hooks`, `/services`, `/utils`, `/lib`, `/assets`, `/config`, `/routes`
- Disallowed: spaces, PascalCase, snake_case, unclear groupings

## File Naming

- **React Components**: `PascalCase.jsx` / `PascalCase.tsx` (e.g., `DashboardHeader.jsx`)
- **Non-component JS/TS**: `lowercase-kebab-case.js` (e.g., `auth-service.js`, `use-user.js`)
- **Configuration files**: Preserve original names (`tailwind.config.js`, `next.config.js`, `.env`)

## Component Naming Pattern

Format: `domain-type-component`

Examples: `user-profile-card`, `auth-login-form`, `billing-plan-selector`, `dashboard-stat-widget`

Every component must map to a domain.

## Database Naming

- Tables: **plural** (`users`, `profiles`, `sessions`, `transactions`)
- Columns: **lowercase_snake_case** (`id`, `created_at`, `updated_at`, `user_id`)
- Functions: **lowercase_snake_case** (`get_user_profile`, `update_subscription_status`)

## API Naming

- REST: `/api/<domain>/<action>` (e.g., `/api/user/create`, `/api/auth/login`)
- Supabase Edge Functions: `lowercase_snake_case.ts` (e.g., `create_user.ts`, `process_webhook.ts`)
- Function naming pattern: `<product>-<domain>-<action>-v<version>`

## Service Naming

- Service files: `<domain>-service.js` (e.g., `auth-service.js`, `billing-service.js`)

## Hook Naming

- Hook files: `use-<purpose>.js` (e.g., `use-user.js`, `use-auth.js`)

## Project & Repository Naming

Format: `productName-platform-purpose` (e.g., `skylink-web-core`, `skylink-api-auth`)

## Standard Frontend Architecture

```
/app
  /routes
  /layout
  /providers
/components
/hooks
/services
/utils
/lib
/assets
```

## Standard Backend Architecture (Supabase)

```
/supabase
  /migrations
  /functions
  /seed
```

## Separation of Concerns

- Never place UI logic in service modules
- Never place business logic in components
- Never mix concerns across layers
- Never generate multi-purpose files
- Never embed database logic in UI components
