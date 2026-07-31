## 1. Prerequisites

- [x] 1.1 Confirm Phase 1 monorepo is present (`apps/api`, `apps/web`, `packages/contracts`, Docker Postgres, `/api/health`)
- [x] 1.2 Ensure Docker Postgres is running and `DATABASE_URL` / `JWT_SECRET` / `WEB_ORIGIN` are set for local API

## 2. Theme tokens and fonts

- [x] 2.1 Copy self-hosted woff2 fonts from `oldRally/src/assets/fonts` into `apps/web/src/assets/fonts`
- [x] 2.2 Port `@font-face`, `@theme inline`, and `:root` obsidian-glass tokens from `oldRally/src/styles.css` into `apps/web` styles
- [x] 2.3 Apply `rally-theme` (or equivalent) body class with ambient page gradient; expose layout tokens (`--sidebar-width: 232px`, `--content-max: 1160px`, `--nav-height`)
- [x] 2.4 Verify no per-route `const C` palette pattern is introduced — CSS variables only

## 3. UI primitives and shell

- [x] 3.1 Init shadcn (new-york, `cssVariables: true`, `baseColor: slate`, lucide) and add primitives: button, card, input, label, form, separator, badge, avatar, dropdown-menu, sonner, skeleton
- [x] 3.2 Port `btn-chrome` and `surface-glass-panel` as Tailwind v4 `@utility` blocks and wire as Button/Card variants
- [x] 3.3 Build Wordmark and BrandLockup from oldRally favicon / BrandLockup references
- [x] 3.4 Build AppShell: 232px sticky sidebar, 1160px content max, `40px 48px` main padding, mobile drawer `<768px`, 44px min tap targets

## 4. Auth data model and contracts

- [ ] 4.1 Extend Prisma `User` with `passwordHash`, `emailVerifiedAt`, and `role` enum `USER | ADMIN`
- [ ] 4.2 Add `RefreshToken` model (`tokenHash`, `userId`, `expiresAt`, `revokedAt`) and run migration
- [ ] 4.3 Add shared Zod auth schemas + inferred types in `packages/contracts` (signup/login/refresh responses, public user)
- [ ] 4.4 Add Prisma seed script that creates a known development admin user

## 5. Auth API

- [ ] 5.1 Add Nest auth module deps: `@nestjs/passport`, `passport-local`, `passport-jwt`, `argon2`; place request DTOs under auth `types/`
- [ ] 5.2 Implement LocalStrategy (argon2 verify) and JwtStrategy (Bearer access → user)
- [ ] 5.3 Register global JwtAuthGuard with `@Public()`; mark signup/login/refresh/health (and logout as designed) public
- [ ] 5.4 Implement `POST /api/auth/signup`, `POST /api/auth/login` — validate body with Zod, hash password, return access token in body, set httpOnly SameSite=Lax path-scoped refresh cookie
- [ ] 5.5 Implement `POST /api/auth/refresh` with hashed-token lookup, rotation (revoke old, issue new), and `POST /api/auth/logout` that revokes + clears cookie
- [ ] 5.6 Implement `GET /api/auth/me` returning public profile for the authenticated user

## 6. Auth UI and client session

- [ ] 6.1 Build glass-styled `/login` and `/signup` routes (centered glass card, Playfair heading, 44px inputs, chrome submit)
- [ ] 6.2 Implement fetch wrapper: attach Bearer access token; on 401 attempt single refresh then one replay; coalesce concurrent refreshes
- [ ] 6.3 Wire TanStack Query `['me']` auth state and TanStack Router `beforeLoad` guard on authenticated route group → redirect `/login`
- [ ] 6.4 Mount authenticated placeholder page inside AppShell to exercise shell + guard together

## 7. E2e tests (primary coverage)

- [ ] 7.1 Add Playwright config targeting web + API against Docker Postgres (create/cleanup test user strategy)
- [ ] 7.2 E2e: signup → reach protected page; logout → login round-trip
- [ ] 7.3 E2e: hard refresh keeps session via refresh cookie; signed-out visit to protected route redirects to `/login` (and/or protected API returns 401)
- [ ] 7.4 Optional lean theme smoke: assert login/shell pages expose expected theme class or key token-backed classes — skip if 7.2–7.3 already cover page presence; no CSS snapshots

## 8. Unit / integration tests (only where e2e cannot cover)

- [ ] 8.1 API unit/integration: argon2 hash + verify for known password (Nest Jest or Vitest)
- [ ] 8.2 API integration: refresh rotation invalidates prior token; revoked/expired refresh rejected
- [ ] 8.3 API unit: JwtStrategy rejects invalid/missing bearer payloads

## 9. Phase 2 verification

- [ ] 9.1 Manually smoke: seed admin login, signup path, logout/login, hard refresh, protected 401 when signed out
- [ ] 9.2 Run Playwright e2e suite (and conditional unit/integration suite) green against local Docker Postgres
