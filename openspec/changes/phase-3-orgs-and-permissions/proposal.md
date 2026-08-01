## Why

Phase 2 delivers authentication and the obsidian-glass shell, but Rally still lacks the organizational model that defines who belongs to which fraternity or sorority chapter and what they can do. Phase 3 introduces universities, organizations, one-to-one memberships, a direct-grant permission catalog, admin-gated user approval, and the admin dashboard to operate all of it — so the platform can onboard real chapters with controlled access before building event features.

## What Changes

- Add `User.status` enum (`ACTIVE` | `PENDING` | `INACTIVE`); public signup/register creates `PENDING` users awaiting platform ADMIN approval
- **BREAKING (auth behavior):** Signup no longer immediately grants a usable session for normal users; `PENDING` and `INACTIVE` users may authenticate (login/refresh issue tokens) but are admitted only to status surfaces (awaiting approval / blocked), not the normal app — protected routes and admin/org APIs remain blocked until `ACTIVE`
- Add Prisma models: `University`, `Organization` (type `FRATERNITY` | `SORORITY`, unique per university name), `Membership` (1:1 user↔org, unique `userId`), `Permission` catalog, `MemberPermission` join
- Platform ADMIN is the full control plane: CRUD universities and organizations, assign/remove memberships, grant/revoke any permission (post-`ACTIVE` only), approve users (`PENDING` → `ACTIVE` with fill-or-kill org assignment), reject pending users (`PENDING` → `INACTIVE`), reactivate (`INACTIVE` → `ACTIVE`); ADMIN holds no Membership and bypasses all org-scoped ACL checks
- Members with `members.manage_permissions` may grant/revoke permissions within their own org only (API-enforced; no separate member-facing permission UI this phase unless covered by admin flows)
- Default on membership join: zero permissions; permission catalog seeded (including `members.manage_permissions`, `events.create`, `events.manage` as forward-looking keys — events feature not built)
- Nest admin/org APIs with shared Zod contracts in `packages/contracts`; org-scoped permission guard/decorator with ADMIN bypass
- Admin dashboard UI (obsidian-glass / AppShell): universities CRUD, organizations CRUD, membership assign/remove, permission grant/revoke, user approval queue and status management, permission catalog list (seed-only — no catalog CRUD UI)
- Public register/signup UX updated to communicate awaiting admin approval (signup does not collect org/university — admin assigns membership at approval)
- Status surfaces for non-`ACTIVE` authenticated users: awaiting-approval (`PENDING`) and blocked (`INACTIVE`) screens
- Seed: permission catalog, dev admin user (ACTIVE), optional sample university/org
- E2e/API tests: membership uniqueness, ADMIN bypass, permission grant gates, unauthorized denial, user approval flow

## Capabilities

### New Capabilities

- `universities`: University entity and platform-ADMIN-only CRUD API
- `organizations`: Organization entity (typed, university-bound) and platform-ADMIN-only CRUD API
- `memberships`: One-to-one user↔organization membership assign/remove (platform ADMIN only)
- `org-permissions`: Permission catalog, direct MemberPermission grants, org-scoped authorization with ADMIN bypass
- `admin-dashboard`: Glass-styled admin UI for universities, organizations, memberships, permissions, and user approval/management

### Modified Capabilities

- `session-auth`: User status lifecycle, PENDING signup, status-gated route admission (tokens allowed; app/admin/org APIs blocked for non-`ACTIVE`), awaiting/blocked status surfaces, updated register/signup UX

## Impact

- **Depends on Phase 2** (`session-auth`, `obsidian-glass-theme`) — JWT auth, AppShell, glass UI patterns
- **apps/api**: Prisma schema/migration, universities/organizations/memberships/permissions modules, user status on auth, admin user-management endpoints, org permission guard, seed updates
- **apps/web**: Admin dashboard routes and pages, updated `/signup` (register) pending messaging, awaiting-approval and blocked status routes for authenticated non-`ACTIVE` users
- **packages/contracts**: Zod schemas for universities, organizations, memberships, permissions, user status/admin operations
- **Non-goals**: Casbin or role-based permission indirection, national org brands, multi-org membership, URL slugs, permission catalog CRUD UI, member-facing permission management UI, events product feature (catalog keys only), email notifications for approval
