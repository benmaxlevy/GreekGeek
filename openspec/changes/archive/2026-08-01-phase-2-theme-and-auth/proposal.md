## Why

Phase 1 scaffolds the monorepo (NestJS API + Vite web + contracts) but leaves the product without a design system or authentication. Phase 2 ports the proven obsidian-glass theme from oldGreekGeek and adds first-party Passport JWT auth so developers can sign in, protect routes, and build authenticated features on a consistent visual foundation.

## What Changes

- Port obsidian-glass design tokens, self-hosted Playfair Display + Instrument Sans fonts, and ambient body gradient from oldGreekGeek into `apps/web`
- Initialize shadcn/ui (new-york, CSS variables) with a lean primitive set; wire `btn-chrome` and `surface-glass-panel` as Button/Card variants
- Add AppShell (232px sidebar, 1160px content max, mobile drawer, 44px tap targets) plus Wordmark/BrandLockup
- Extend Prisma `User` with `passwordHash`, `role` (`USER` | `ADMIN`), and a revocable `RefreshToken` model; add a dev admin seed
- Implement NestJS Passport auth (`passport-local` + `passport-jwt`), argon2 hashing, short-lived access token (body) + httpOnly rotating refresh cookie
- Expose `POST /api/auth/signup|login|refresh|logout` and `GET /api/auth/me` with a global `JwtAuthGuard` and `@Public()` opt-out
- Add glass-styled `/login` and `/signup`, a fetch wrapper with refresh-on-401, and TanStack Router `beforeLoad` guards
- Add lean Playwright e2e coverage for auth flows and protected-route behavior; unit/integration tests only where e2e cannot cover (argon2, token rotation/revocation, JWT strategy)

## Capabilities

### New Capabilities

- `obsidian-glass-theme`: Design tokens, fonts, shadcn primitives, glass Button/Card variants, AppShell, and brand lockup for the web app
- `session-auth`: Email/password signup and login, JWT access + rotating refresh-cookie sessions, protected API/routes, and auth UI

### Modified Capabilities

- (none — `openspec/specs/` is empty; no existing capability requirements)

## Impact

- **Depends on Phase 1** monorepo scaffold (`apps/api`, `apps/web`, `packages/contracts`, Docker Postgres) — not part of this change
- **apps/web**: styles, fonts, UI primitives, AppShell, auth routes, fetch/auth client, router guards
- **apps/api**: Prisma schema/migration, auth module, Passport strategies, global JWT guard, seed script
- **packages/contracts**: shared Zod schemas for auth request/response bodies
- **Dependencies**: `@nestjs/passport`, `passport-local`, `passport-jwt`, `argon2`, shadcn primitives, Playwright for e2e
- **Non-goals**: marketing landing page port; per-route `const C` palettes; organization-scoped roles / Membership; third-party IdP
