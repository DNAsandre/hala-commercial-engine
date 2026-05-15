# App Patterns Reference

## Source Documents Used
Documents 1-8, 11, 17, 26

## Key Rules
- Authenticated apps require proper auth flow: Supabase auth → auth-service.js → useAuth hook → UI
- Components, hooks, and services must be separated
- Critical features (auth, billing, user data) require integration tests
- Dashboard metrics must combine DB + UI properly
- Testing: 80% min coverage for services, 100% for auth/billing

## Required Behavior
- Design complete authenticated user flows
- Implement proper state management
- Use hooks for state, services for data, components for UI
- Write tests for all critical features

## Forbidden Actions
- Bypassing authentication checks
- Mixing business logic in components
- Skipping tests for critical features
- Using fake data in production flows

## Handoff Rules
- Route database schema to database-specialist
- Route public pages to website-specialist
- Route testing to qa-hardening-specialist
