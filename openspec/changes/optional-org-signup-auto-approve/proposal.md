## Why

Signup currently forces every new user to pick an organization and wait for approval, even when they only want a platform account. Optional organization signup lets users register immediately as `ACTIVE` when no org is chosen, while preserving the existing pending-approval path for org join requests.

## What Changes

- Make signup `organizationId` optional in shared contracts and API validation.
- **No organization** (omitted, empty, or university selected without org): create user with `status=ACTIVE`, `requestedOrganizationId=null`, no membership row — auto-approved.
- **Organization provided**: unchanged behavior — `status=PENDING`, `requestedOrganizationId` set, officer/admin approval later.
- Signup still does **not** issue session tokens; after signup redirect to `/login` with path-specific success messaging (org-less: account ready; with-org: awaiting approval).
- Signup UI: university→org cascade remains but organization becomes optional; university-only selection counts as no-org.
- Admin users UI: clearly display `ACTIVE` users with no membership (e.g. membership/org column shows "None").
- Out of scope: join-org-later flow, adding `universityId` to User model, changing officer pending rules for org signups.

## Capabilities

### New Capabilities

_None — behavior extends existing auth and admin capabilities._

### Modified Capabilities

- `session-auth`: Optional org on signup; org-less auto-approve to `ACTIVE`; signup UI and post-signup redirect messaging.
- `admin-dashboard`: Admin user list must clearly show `ACTIVE` users without membership.

## Impact

- `packages/contracts/src/auth.ts` — `SignupRequestSchema.organizationId` becomes optional.
- `apps/api/src/auth/auth.service.ts` — branch signup on presence of `organizationId`.
- `apps/web/src/routes/signup.tsx` — optional org selector, conditional submit, redirect to `/login` with messaging.
- `apps/web` admin users view — membership/org column clarity for org-less `ACTIVE` users.
- E2E and demo tests for both signup paths.
