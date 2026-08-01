## 1. Shared contracts

- [x] 1.1 Add Zod schemas in `packages/contracts` for pending-applicant list response, org-scoped list query (if any), and patch status body (`ACTIVE` | `INACTIVE`; optional `organizationId` documented ADMIN-only)
- [x] 1.2 Export inferred types; wire into API feature `types/` re-exports per workspace conventions

## 2. API — org-scoped pending approvals

- [x] 2.1 Add Nest module for org-scoped pending applicants under `organizations/:organizationId/pending-users`
- [x] 2.2 `GET` list: return `PENDING` users where `requestedOrganizationId = organizationId`; parse params/query with Zod
- [x] 2.3 `PATCH :userId` approve/deny: validate caller org scope; officer approve uses `requestedOrganizationId` only (reject override); deny sets `INACTIVE`
- [x] 2.4 Apply `@RequireOrgPermission('members.manage_permissions')` with ADMIN bypass on both endpoints
- [x] 2.5 Reject approve/deny when target user's `requestedOrganizationId` does not match path `organizationId`
- [x] 2.6 Extract or reuse shared approve/deny transaction logic with `AdminUsersService` (membership + status atomically)

## 3. API integration tests

- [x] 3.1 Officer with `members.manage_permissions` lists only matching-org `PENDING` users
- [x] 3.2 Officer approve creates membership to requested org and sets `ACTIVE`
- [x] 3.3 Officer deny sets `INACTIVE` without membership
- [x] 3.4 403 without `members.manage_permissions`; 403 listing another org
- [x] 3.5 Officer cannot approve applicant whose `requestedOrganizationId` differs from path org
- [x] 3.6 Officer body with `organizationId` override rejected; ADMIN override still works where supported
- [x] 3.7 Non-ADMIN still blocked from admin user-status API (regression)

## 4. Web — `/users` route group

- [ ] 4.1 Add `users.tsx` layout: `createFileRoute('/users')`; `beforeLoad` requires `ACTIVE` + `members.manage_permissions` for caller's membership org; redirect others to `/app`
- [ ] 4.2 Add `users.index.tsx`: `createFileRoute('/users/')` pending-applicant table with approve/deny actions calling org-scoped API
- [ ] 4.3 Resolve officer `organizationId` from membership (extend me/profile or dedicated query if needed)
- [ ] 4.4 Add client API helpers with Zod parse on responses
- [ ] 4.5 Show `/users` nav link in `/app` AppShell only when caller holds `members.manage_permissions`
- [ ] 4.6 Style with obsidian-glass / AppShell patterns; no reactivate/deactivate/org-override controls

## 5. E2e tests

- [ ] 5.1 Seed or fixture: officer with `members.manage_permissions`, pending applicant for same org
- [ ] 5.2 Officer navigates to `/users`, approves applicant → applicant logs in and reaches `/app`
- [ ] 5.3 Officer denies applicant → applicant lands on blocked screen
- [ ] 5.4 Member without permission cannot access `/users` (redirect/forbidden)
- [ ] 5.5 Regression: `/admin/users` remains ADMIN-only; admin global approve/deny still works

## 6. Verification

- [ ] 6.1 Run API integration + e2e suites green
- [ ] 6.2 Manual smoke: officer `/users` approve/deny; admin `/admin/users` unchanged
