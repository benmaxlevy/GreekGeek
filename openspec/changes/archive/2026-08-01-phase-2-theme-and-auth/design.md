## Context

See proposal.md for motivation. Phase 1 (separate change) establishes the pnpm/Turborepo monorepo under `rally/`: `apps/api` (NestJS + Prisma + Postgres), `apps/web` (Vite + React 19 + TanStack Router/Query + Tailwind v4), and `packages/contracts` for shared Zod schemas. This design assumes that scaffold exists before implementation starts.

Theme source of truth is `oldRally/src/styles.css` plus self-hosted fonts under `oldRally/src/assets/fonts`. Auth replaces the old app's auth approach with NestJS Passport; no third-party IdP.

Workspace conventions that shape the design: Zod validates HTTP request/response boundaries; named types and schemas live in feature `types/` / `dto/` files (shared auth shapes also in `packages/contracts`); helpers only when multi-line logic is reused.

## Goals / Non-Goals

**Goals:**

- Port a maintainable CSS-variable theme and shell so product UI does not regress into per-route palettes
- Deliver complete email/password session auth (API + web) with rotating refresh cookies
- Keep automated tests lean: Playwright e2e first; unit/integration only for non-UI edge cases

**Non-Goals:**

- Phase 1 monorepo bootstrap
- Marketing landing page port
- Organization-scoped roles / Membership models
- Email verification flows beyond storing `emailVerifiedAt`
- Visual regression / CSS snapshot tooling
- Production IdP, OAuth, or magic-link auth

## Decisions

### 1. Theme as CSS variables + Tailwind v4 utilities (not JS palettes)

**Choice:** Copy fonts and port `@font-face`, `@theme inline`, `:root` obsidian-glass tokens, and body ambient gradient (`rally-theme` class) into `apps/web`. Express `btn-chrome` and `surface-glass-panel` as Tailwind v4 `@utility` blocks wired into shadcn Button/Card variants.

**Why:** Old app's per-route `const C` palettes were unmaintainable. CSS variables keep one source of truth and match existing shadcn `cssVariables: true` setup.

**Alternatives considered:** CSS-in-JS theme object — rejected (duplicates tokens, fights Tailwind v4). Full copy of oldRally component tree — rejected (out of scope; landing page and route-local styles explicitly excluded).

### 2. Lean shadcn new-york primitive set

**Choice:** Init shadcn with new-york style, `baseColor: slate`, lucide icons. Install only: button, card, input, label, form, separator, badge, avatar, dropdown-menu, sonner, skeleton.

**Why:** Matches oldRally `components.json` and covers auth + shell needs without shipping unused primitives.

**Alternatives considered:** Custom components without shadcn — rejected (slower, worse a11y baseline). Broader primitive install — rejected (unnecessary for Phase 2).

### 3. AppShell layout constants from tokens

**Choice:** Sidebar 232px, content max 1160px, main padding `40px 48px`, mobile drawer `<768px`, 44px min tap targets. Brand via Wordmark/BrandLockup derived from oldRally favicon + BrandLockup.

**Why:** Preserves proven product chrome without inventing a new layout system.

### 4. Passport local + JWT with rotating httpOnly refresh

**Choice:**

- `passport-local` for credential exchange; `passport-jwt` for Bearer access validation
- argon2 for password hashing
- Access token ~15m in JSON body; refresh token as httpOnly, SameSite=Lax, path-scoped cookie; rotate refresh row on every successful refresh
- Prisma: extend `User` with `passwordHash`, `emailVerifiedAt`, `role` enum `USER|ADMIN`; add `RefreshToken` (`tokenHash`, `userId`, `expiresAt`, `revokedAt`)
- Global `JwtAuthGuard` with `@Public()` for signup/login/refresh/health (and logout as needed for cookie clear)
- Auth Zod schemas in `packages/contracts` and/or `apps/api` auth `types/`; parse at HTTP boundaries

**Why:** Nest-native, no third-party auth vendor, revocable sessions, XSS-resistant refresh storage.

**Alternatives considered:** Session cookies only (no JWT) — workable but less aligned with locked plan and SPA Bearer usage. Refresh token in localStorage — rejected (XSS risk). Multiple global role systems like oldRally — rejected (single enum now; Membership later).

### 5. Frontend auth client and guards

**Choice:** Glass `/login` and `/signup` (centered glass card, 44px inputs, chrome submit). Shared fetch wrapper: attach Bearer access token; on 401, single refresh attempt then one replay. TanStack Query `['me']` for auth state; TanStack Router `beforeLoad` on authenticated route group redirects to `/login`. Dev Prisma seed creates admin user.

**Why:** Matches locked UX from oldRally auth page treatment while fitting TanStack Router/Query.

### 6. Testing strategy (e2e-first, conditional unit/integration)

**Choice:**

- **Primary:** Playwright e2e running web + API against Docker Postgres — signup, logout, login, hard-refresh session restore, protected route 401/redirect when signed out; optional single theme smoke that login/shell expose expected theme class/tokens (skip if auth e2e already covers page presence)
- **Secondary (only if needed):** Nest Jest or Vitest for argon2 hash/verify helpers, refresh rotation/revocation edge cases, JWT strategy validation
- **Explicitly out:** CSS snapshot tests, broad visual regression, exhaustive component unit tests for theme

**Why:** User-facing auth and guards are highest-value coverage; crypto/token edge cases are awkward in the browser.

**Alternatives considered:** Unit-test-heavy approach — rejected (slower feedback for flows that are integration by nature). Full visual regression — rejected (high cost, low Phase 2 value).

## Risks / Trade-offs

- [Phase 1 not done] → Implementation of this change MUST wait on monorepo scaffold; tasks assume `apps/*` and `packages/contracts` exist
- [Docker unavailable in some WSL setups] → E2e and migrations need Docker Desktop WSL integration; document prerequisite in tasks/README rather than inventing a non-Postgres path
- [Refresh rotation races (parallel 401s)] → Client allows a single in-flight refresh; API rejects reused refresh tokens — cover with focused API integration test if e2e flaky
- [Cookie + Vite proxy SameSite/path quirks] → Scope refresh cookie path to `/api/auth` (or `/api`) and verify through Playwright against the proxied origin
- [Theme drift from oldRally] → Port tokens/fonts from source files listed above; do not reimagine palette values

## Migration Plan

1. Land Phase 1 monorepo (separate change)
2. Apply theme port and shadcn/shell (web-only, no data migration)
3. Migrate Prisma schema for auth fields + RefreshToken; run migration; run seed in development
4. Ship auth API then auth UI; verify with Playwright
5. Rollback: revert deploy + migrate down auth migration if needed; theme-only rollback is frontend revert with no DB impact

## Open Questions

- Exact refresh cookie `Path` (`/api/auth` vs `/api`) — decide during implementation based on proxy behavior; does not change specs
- Whether logout requires a valid access token in addition to the refresh cookie — prefer cookie-based logout that still clears/revokes when access is expired; confirm in implementation without changing endpoint list
