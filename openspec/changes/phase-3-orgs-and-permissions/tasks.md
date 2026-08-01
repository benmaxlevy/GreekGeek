## 1. Prerequisites

- [x] 1.1 Confirm Phase 2 complete (session-auth, AppShell, JWT guard, signup/login flows)
- [x] 1.2 Ensure Docker Postgres running and dev admin seed accessible

## 2. Data model and migration

- [x] 2.1 Add `UserStatus` enum (`ACTIVE`, `PENDING`, `INACTIVE`) and `User.status` column (default `PENDING` for new signups)
- [x] 2.2 Add `University`, `Organization` (type enum, `@@unique([universityId, name])`), `Membership` (unique `userId`), `Permission`, `MemberPermission` models
- [x] 2.2b Add `User.requestedOrganizationId` nullable FK to `Organization` (required on signup for `USER` role)
- [x] 2.3 Run migration; backfill existing Phase 2 users to `ACTIVE`
- [x] 2.4 Update seed: permission catalog keys (`members.manage_permissions`, `events.create`, `events.manage`), dev admin `ACTIVE`, optional sample university/org

## 3. Shared contracts

- [x] 3.1 Add Zod schemas + inferred types in `packages/contracts` for universities, organizations, memberships, permissions, user status/admin ops
- [x] 3.1b Extend signup/register schema with `organizationId` → persisted as `requestedOrganizationId` (required for `USER` role)
- [x] 3.2 Extend auth user/public profile schemas with `status` field
- [x] 3.2b Extend admin user list/detail schemas with requested org (and implied university) for pending queue

## 4. User status and auth gating

- [x] 4.1 Update signup to create `PENDING` users with `requestedOrganizationId`; no session tokens; reject signup without org for `USER` role
- [x] 4.2 Allow login and refresh for `PENDING` and `INACTIVE` users (issue tokens); keep credential rejection for invalid email/password only
- [x] 4.3 Add global status guard on protected routes and admin/org APIs — block non-`ACTIVE`; allow `/api/auth/me`, logout, and other auth maintenance
- [x] 4.4 Implement ADMIN user-management API: list users (filter by status), patch status (`PENDING` → `ACTIVE`, `PENDING` → `INACTIVE`, `INACTIVE` → `ACTIVE`); approve/fill may create membership atomically
- [x] 4.5 Place request DTOs under feature `types/` folders; parse at HTTP boundaries

## 5. Universities API

- [x] 5.1 Nest `universities` module: ADMIN-only create/update/delete endpoints
- [x] 5.1b Public `@Public` list-universities endpoint for signup (read-only; no auth)
- [x] 5.2 Return 409 when delete blocked by existing organizations

## 6. Organizations API

- [x] 6.1 Nest `organizations` module: ADMIN-only create/update/delete; admin list filter by `universityId`
- [x] 6.1b Public `@Public` list-organizations-by-university endpoint for signup (read-only; filter by `universityId`; no auth)
- [x] 6.2 Enforce unique name per university; return 409 when delete blocked by existing memberships

## 7. Memberships API

- [x] 7.1 Nest `memberships` module: ADMIN assign/remove; enforce unique `userId`
- [x] 7.2 Reject membership for ADMIN users; new membership starts with zero grants; support assign during pending-user fill flow

## 8. Permissions API and guard

- [x] 8.1 Nest `permissions` module: list catalog; grant/revoke MemberPermission on membership
- [x] 8.2 Enforce grant/revoke gate: ADMIN or `members.manage_permissions` in same org; reject grants for non-`ACTIVE` users
- [x] 8.3 Implement `@RequireOrgPermission(key)` decorator + guard with ADMIN bypass
- [x] 8.4 Apply guard to permission grant/revoke endpoints (and test fixture endpoint if needed)

## 9. Register, login, and status surfaces

- [x] 9.1 Update `/signup` register flow: email/password/name + cascading university → organization pickers; persist `requestedOrganizationId`; success → pending-approval screen (no authenticated redirect)
- [x] 9.2 Add awaiting-approval route for authenticated `PENDING` users; blocked route for authenticated `INACTIVE` users
- [x] 9.3 Route guards: non-`ACTIVE` authenticated users redirect to status surface, not app home or admin
- [x] 9.4 `ACTIVE` user login and session restore unchanged

## 10. Admin dashboard UI

- [x] 10.1 Add `/admin/*` route group with ADMIN + ACTIVE `beforeLoad` guard
- [x] 10.2 Users page (pending queue): list/filter by status; show requested university/org; **fill** (confirm or override org + activate) or **kill** (`INACTIVE`); reactivate `INACTIVE` → `ACTIVE`; no permission grants on this page
- [x] 10.3 Universities page: list, create, edit, delete (surface 409 when dependents exist)
- [x] 10.4 Organizations page: list by university, create/edit/delete with type selector (surface 409 when memberships exist)
- [x] 10.5 Memberships page: assign user to org, remove membership (post-active management)
- [x] 10.6 Permissions page: read-only catalog list; grant/revoke per membership for `ACTIVE` members only
- [x] 10.7 Style with obsidian-glass / AppShell patterns from Phase 2

## 11. E2e tests

- [x] 11.1 Register with university/org selection → pending message; no authenticated home access
- [x] 11.1b Public university/org list endpoints reachable without auth for signup form
- [x] 11.2 Pending user login → awaiting-approval screen; cannot reach protected app page
- [x] 11.3 Admin fill (requested org or override) + activate → user reaches protected page
- [x] 11.4 Admin kill pending user → `INACTIVE` login → blocked screen
- [x] 11.5 Admin reactivate `INACTIVE` → `ACTIVE`
- [x] 11.6 Admin CRUD smoke: university + organization create
- [x] 11.7 Membership assign; atomic reassign keeps one membership per user
- [x] 11.8 ADMIN grants permission post-active; delegated member with `members.manage_permissions` grants in own org
- [x] 11.9 Unauthorized: non-admin university CRUD 403; member without manage permission grant 403

## 12. API integration tests

- [x] 12.1 Membership unique constraint
- [x] 12.2 ADMIN bypass on org permission guard
- [x] 12.3 Grant gate without `members.manage_permissions` returns 403
- [x] 12.4 PENDING/INACTIVE login and refresh succeed; protected routes return 401/403
- [x] 12.5 University/org delete with dependents returns 409
- [x] 12.6 Signup stores/rejects `organizationId` (unknown → 400); public list + mutation 403 covered by e2e 11.1b/11.9

## 13. Phase 3 verification

- [ ] 13.1 Manual smoke: signup with org selection; admin review pending (requested org visible); fill+activate or kill; create uni/org; grant permission post-active
- [x] 13.2 Run e2e + API test suites green against Docker Postgres
- [x] 13.3 Update Phase 2 auth e2e that assumed immediate post-signup session
