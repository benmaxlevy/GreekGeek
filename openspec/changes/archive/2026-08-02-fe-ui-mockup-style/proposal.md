## Why

GreekGeek's existing web UI does not consistently express the greekgeek-mockup-handoff design system across its routes and shared components. Aligning the frontend now creates one coherent visual language for member and executive portals while preserving existing routes, interactions, and feature behavior.

## What Changes

- Restyle all existing web routes and shared web components against the mockup handoff.
- Port mockup design tokens, typography utilities, glass-panel recipe, shared visual primitives, and white primary button treatment.
- Apply a full-width, desktop-first responsive shell; remove the 480px phone-column constraint from member web layouts.
- Add distinct portal ambient treatments: warmer member presentation; cooler executive presentation with a persistent top rail.
- Keep existing routes and frontend features intact; change shell chrome and visual presentation only.
- Do not add photography or hero images in this change.
- Do not change API, Prisma, Stripe, authentication, permissions, or other backend behavior.

## Capabilities

### New Capabilities

### Modified Capabilities

- `obsidian-glass-theme`: expand the shared theme contract to cover the mockup handoff tokens, full-width responsive shell, portal-specific ambient treatments, typography utilities, and consistent white primary actions across every existing web route.

## Impact

- Affects the GreekGeek web app's global styles, shell/layout components, shared UI primitives, and route-level presentation classes.
- No API endpoints, request/response contracts, Prisma schema, Stripe integration, or backend dependencies change.
- Existing URLs, navigation, data flows, and feature interactions remain available.
- Visual verification must cover representative member, executive, auth/onboarding, ticketing, money, chapter, scanner, admin, agency, and production routes at desktop and responsive widths.
