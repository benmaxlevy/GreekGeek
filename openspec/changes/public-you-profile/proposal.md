## Why

The existing `/app/you` route exposes only a minimal session identity view, links, and logout, so users cannot manage their display name or see their membership capabilities and ticket context in one place. Rally already has authenticated identity, permission, and owned-ticket data; this change gives that data a stable profile contract and focused public-facing app surface without changing session security or adding verification scope.

## What Changes

- Add authenticated profile contracts and API support for reading the current profile summary and updating display name.
- Add a real `/app/you` page showing display name, email, account status, organization membership, capability-derived permission presentation, and ticket/upcoming summary.
- Keep email, status, membership, and permission grants read-only to the profile user.
- Preserve existing Payments, Pending approvals, Admin, and logout behavior, showing links only when existing authorization predicates allow them.
- Reuse existing ticket ownership and event data; do not add attendance visibility, social graph, photos, privacy, password, or verification features.

## Capabilities

### New Capabilities

- `you-profile`: Authenticated `/app/you` profile surface, profile summary contract, display-name edit flow, read-only identity and membership presentation, existing authorized links, and error/empty states.

### Modified Capabilities

- `session-auth`: Extend the authenticated current-user API with a Zod-validated display-name update while keeping email, role, status, membership, permissions, password, and session transport outside the caller's write authority.

## Impact

- `packages/contracts`: Add request/response schemas for profile update and summary boundaries; export inferred types.
- `apps/api/src/auth`: Extend current-user controller/service/types and add focused authorization, validation, persistence, and response tests.
- `apps/api/src/tickets` and event queries: Provide only the owned-ticket/upcoming data needed by the authenticated summary, without changing ticket authorization or ticket state transitions.
- `apps/web/src/routes/app.you.tsx` and API/query helpers: Replace the minimal page with the profile UI, edit state, summary cards, loading/error/empty handling, and existing authorized navigation.
- No verification-level model, migration, password flow, avatar storage, privacy model, or session behavior change.
