## 1. Contracts

- [x] 1.1 Make `SignupRequestSchema.organizationId` optional in `packages/contracts/src/auth.ts` (treat omitted/empty as no-org)
- [x] 1.2 Rebuild or verify downstream `SignupRequest` type consumers compile

## 2. API

- [x] 2.1 Branch `auth.service.ts` signup: no org → `ACTIVE`, `requestedOrganizationId` null; with org → validate org, `PENDING`, set `requestedOrganizationId`
- [x] 2.2 Ensure signup response still returns `PublicUser` with correct `status` and no session tokens
- [x] 2.3 Add focused API/integration tests for org-less and with-org signup paths

## 3. Frontend — Signup

- [ ] 3.1 Make organization selector optional in `apps/web/src/routes/signup.tsx`; university-only submit omits `organizationId`
- [ ] 3.2 After signup success, redirect to `/login` with path-specific message (org-less: ready to sign in; with-org: awaiting approval)
- [ ] 3.3 Confirm signup does not store tokens or navigate to authenticated home

## 4. Frontend — Admin

- [ ] 4.1 Update `/admin/users` to show "None" (or equivalent) for ACTIVE users with no membership in org/membership column

## 5. E2E & Demo

- [ ] 5.1 E2E: org-less signup → login → reaches protected page as ACTIVE user without membership
- [ ] 5.2 E2E: org signup → login → awaiting-approval screen (unchanged pending path)
- [ ] 5.3 Record demo video covering both signup paths and admin view of org-less ACTIVE user
