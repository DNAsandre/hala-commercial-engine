# Design Token Standards Reference

## Source Documents Used
Documents 3, 4, 8, 41-45

## Key Rules
- Design tokens define colors, spacing, typography, shadows, and border-radius
- Components must use tokens, never hardcoded values
- Component naming: domain-component-type (e.g., auth-login-form)
- All components must be modular, reusable, and single-responsibility
- Layout grid must be defined and consistent across apps

## Required Behavior
- Centralize all design tokens in config/theme files
- Create component primitives that compose into complex UIs
- Document all component props and variants
- Ensure responsive behavior

## Forbidden Actions
- Hardcoding colors, spacing, or fonts
- Creating one-off components that bypass the design system
- Inconsistent naming across components
