## Context

See proposal.md for motivation. Phase 2 provides NestJS + Prisma + Postgres API, Passport JWT auth with global `JwtAuthGuard`, obsidian-glass web shell, and shared Zod contracts. Phase 3 layers organizational structure, direct-grant permissions, admin-gated onboarding, and an admin dashboard on that foundation.

Workspace conventions: Zod at HTTP boundaries; named types/schemas in feature `types/` / `dto/` and `packages/contracts`; helpers only for reused multi-line logic. IDs are cuid strings — no URL slugs.

## Goals / Non-Goals

**Goals:**

- Model universities, typed organizations, 1:1 memberships, and a seeded permission catalog with direct MemberPermission grants
- Platform ADMIN as sole operator for universities, organizations, memberships, user approval, and all permission grants; ADMIN bypasses org ACL
- Members with `members.manage_permissions` grant/revoke within own org via API (enforced even without member UI)
- User status lifecycle with admin approval before normal users can use the product
- Admin dashboard and updated register UX using Phase 2 obsidian-glass / AppShell patterns
- API + e2e coverage for ACL, uniqueness, approval flow

**Non-Goals:**

- Casbin, national-brand org hierarchy, multi-org membership, slugs
- Permission catalog CRUD (seed-only)
- Member-facing permission management UI
- Events feature (catalog keys only)
- Email/push notifications for approval
- Soft-delete complexity beyond minimal needs

## Decisions

### 1. Data model

**Choice:**

- `University`: `id`, `name`, `createdAt`, `updatedAt` — no slug
- `Organization`: `id`, `name`, `type` enum (`FRATERNITY` | `SORORITY`), `universityId` FK; `@@unique([universityId, name])` — no slug, no national brand
- `Membership`: `id`, `userId` (unique), `organizationId`, timestamps — enforces 1:1 user↔org; platform ADMIN never has a Membership row
- `Permission`: `id`, `key` (unique), `description`, timestamps — seeded catalog
- `MemberPermission`: `membershipId`, `permissionId`; composite unique — direct grants, default zero on join
- `User.status`: enum `ACTIVE` | `PENDING` | `INACTIVE` (default `PENDING` for signup; seed admin `ACTIVE`)

**Why:** Matches locked product decisions; simple relational model without role indirection.

**Alternatives considered:** Role tables mapping to permission sets — rejected (direct grants per decision). Multi-org membership — rejected.

### 2. Authorization layers

**Choice:** Two layers:

1. **Global role** (`User.role`): `ADMIN` bypasses all org-scoped checks and may perform any platform operation in this phase
2. **Org permission** (`MemberPermission`): checked via guard/decorator requiring specific permission key + resolved org context from route/body; skipped when caller is ADMIN

**Grant/revoke authorization:**

| Action | Who |
|--------|-----|
| University CRUD | ADMIN only |
| Organization CRUD | ADMIN only |
| Membership assign/remove | ADMIN only |
| Permission grant/revoke (any catalog key) | ADMIN, or member with `members.manage_permissions` in target org |
| User approve / reject / reactivate | ADMIN only |
| Permission catalog list | ADMIN (UI); authenticated API as needed for admin flows |

**Why:** ADMIN is explicit control plane; delegated permission management stays org-scoped.

### 3. User status lifecycle and auth gating

**Choice (locked):**

- Signup/register creates `User` with `status = PENDING`, `role = USER`; signup does **not** collect university or organization — admin assigns membership at approval (see Decision 10)
- Seed dev admin with `status = ACTIVE`
- `PENDING` and `INACTIVE` users **may authenticate**: login and refresh succeed and issue tokens
- Non-`ACTIVE` users are **not admitted** to the normal app: protected API routes, admin APIs, and org-scoped APIs return 401/403; authenticated frontend route groups redirect to status surfaces instead of app home
- Status surfaces (reachable when authenticated + non-`ACTIVE`): **awaiting approval** (`PENDING`), **blocked** (`INACTIVE`); plus `/api/auth/me`, logout, and other auth maintenance endpoints as needed
- `ACTIVE` users proceed through normal session restore and protected routes
- Public user profile responses include `status`

**Why:** Users know they are registered and can sign out; enforcement stays at route/API boundary without denying credential exchange.

**Alternatives considered:** Reject login/refresh with no tokens — rejected (locked decision). Allow PENDING limited read-only app — rejected (out of scope).

### 3b. Admin approval workflow (fill or kill)

**Choice (locked):**

- `PENDING → ACTIVE` is a distinct **approve** action
- Org/university handling at approval is **fill or kill**:
  - **Kill:** if the user's org/university situation is incorrect or not acceptable → set status `INACTIVE` (no hard-delete)
  - **Fill:** if correct → assign `Membership` to the right `Organization` (university implied via org) as part of (or immediately before) activation
- **Permissions are not part of approve** — grant/revoke only after user is `ACTIVE`
- ADMIN may later reactivate `INACTIVE → ACTIVE` (same status patch endpoint as approval; membership may need (re)assignment)

**Why:** Separates identity approval from org placement and permission delegation; rejected users remain auditable without deletion.

### 4. API surface (Nest modules)

**Choice:** Feature modules under `apps/api`:

- `universities` — ADMIN-only CRUD
- `organizations` — ADMIN-only CRUD, filtered/listable by university
- `memberships` — ADMIN assign (create), remove (delete); enforce unique `userId`
- `permissions` — list catalog; grant/revoke MemberPermission on membership
- `admin/users` — list users (filter by status), patch status (`PENDING` → `ACTIVE`, `PENDING` → `INACTIVE`, `INACTIVE` → `ACTIVE`); approve flow may create membership in same transaction

Routes scoped under `/api/admin/...` or RESTful `/api/universities`, etc., with `@Roles('ADMIN')` or equivalent global admin guard. Org-permission routes include org id in path or body for guard resolution.

Zod schemas in `packages/contracts`; parse at HTTP boundary per workspace rules.

### 5. Org-scoped permission guard

**Choice:** Nest decorator e.g. `@RequireOrgPermission('events.create')` + guard that:

1. If `user.role === ADMIN` → allow
2. Resolve user's Membership for the target org (from param/body)
3. Check MemberPermission for required key
4. Deny 403 if missing

Guard applies to org-scoped endpoints introduced this phase and future phases; Phase 3 uses it on permission grant/revoke and any test endpoints as needed.

### 6. Admin dashboard (web)

**Choice:** Authenticated ADMIN-only route group under AppShell (e.g. `/admin/*`):

| Page | Actions |
|------|---------|
| Users (pending queue) | List/filter by status; for `PENDING`: **fill** (assign org membership + activate) or **kill** (set `INACTIVE`); reactivate `INACTIVE` → `ACTIVE`; permission grants **not** on this page |
| Universities | List, create, edit, delete |
| Organizations | List (by university), create, edit, delete; type selector |
| Memberships | Assign user to org, remove membership (post-active management) |
| Permissions | List catalog (read-only); per-membership grant/revoke for `ACTIVE` members only |

Glass cards, tables, forms consistent with Phase 2 theme. TanStack Router `beforeLoad` requires ADMIN role + ACTIVE status.

**Why:** Brings operational control in-scope; reuses existing shell.

### 7. Register / signup UX

**Choice (locked):** Update `/signup` (public register):

- Collects email, password, name only — **no** university or organization selection (admin fills org at approval; see Decision 10)
- On success → pending-approval messaging (no session tokens, no redirect to authenticated home)
- After signup, user may log in; `PENDING` users land on **awaiting approval** screen; `INACTIVE` users land on **blocked** screen — not normal app routes

### 8. Dependent delete protection

**Choice (locked):** Hard delete of `University` or `Organization` MUST return **409 Conflict** when dependents exist (organizations for universities; memberships for organizations). Admin must remove dependents first.

### 9. Seed data

**Choice:**

- Permission catalog rows: `members.manage_permissions`, `events.create`, `events.manage` (minimum)
- Dev admin user: `ACTIVE`, `ADMIN`
- Optional sample university + organization for local admin UI smoke

No production data dump.

### 10. Signup org intent

**Choice (locked):** Public signup does **not** collect university or organization. Admin assigns the correct `Organization` (university implied via org FK) during the **fill** step of pending-user review, immediately before or as part of `PENDING → ACTIVE`.

**Why:** Keeps signup minimal; org placement is an admin verification decision, not user self-selection.

### 11. Testing strategy

**Choice:**

- **E2e (Playwright):** register → pending message; pending user login → awaiting-approval screen; admin fill+activate → reach protected page; admin kill → inactive blocked screen; admin reactivate; ADMIN CRUD smoke; permission grant post-active; unauthorized 403
- **API integration:** membership unique constraint, ADMIN bypass, grant gate without `members.manage_permissions`, non-ACTIVE blocked on protected routes (login/refresh succeed), delete-with-dependents 409

E2e-first; unit tests only for guard edge cases if awkward in browser.

## Risks / Trade-offs

- [Phase 2 signup e2e assumes immediate session] → Update e2e in Phase 3 tasks; breaking change expected
- [ADMIN-only dashboard grows large] → Single `/admin` section acceptable for this phase; split later if needed
- [1:1 membership reassignment] → Assign to new org must remove/replace existing membership atomically; document in API
- [Non-ACTIVE tokens exist] → Status guard on protected routes must be consistent across API and web; auth/me remains reachable for status routing

## Migration Plan

1. Add Prisma models + `User.status`; migrate
2. Backfill existing users to `ACTIVE` in migration (Phase 2 users should remain usable)
3. Deploy API with new endpoints and auth gating
4. Deploy admin UI + updated signup
5. Run seed for permission catalog
6. Rollback: revert deploy + migrate down if needed

## Locked decisions (summary)

All prior open questions resolved:

1. **Auth for non-ACTIVE:** Login and refresh succeed; tokens issued; only status surfaces + auth maintenance reachable — not normal app, admin, or org APIs (Decision 3).
2. **Fill or kill approval:** Kill → `INACTIVE`; fill → assign membership + `ACTIVE`; permissions only post-`ACTIVE` (Decision 3b).
3. **Signup org intent:** Admin fills org at approval; signup has no org pick (Decision 10).
4. **Reactivation:** ADMIN may set `INACTIVE` → `ACTIVE` (Decision 3b).
5. **Dependent delete:** University/org delete with dependents → 409 (Decision 8).
