## Why

Phase 3 routes all pending-user approve/deny through platform ADMIN. Chapter officers who already hold `members.manage_permissions` cannot act on applicants requesting their organization without waiting for central admin — slowing onboarding and contradicting delegated permission management. Officers need org-scoped approval for applicants who selected their chapter at signup.

## What Changes

- Add org-scoped API for listing `PENDING` users whose `requestedOrganizationId` matches the officer's organization and for **approve** (`PENDING` → `ACTIVE` + membership to requested org) or **deny** (`PENDING` → `INACTIVE`)
- Authorize those endpoints for platform ADMIN (all orgs, org override on approve if already supported) or for `ACTIVE` members holding `members.manage_permissions` in the target org only
- Officers MUST NOT see, approve, or deny applicants for other organizations; officers MUST NOT reassign approve to a different org (membership always uses `requestedOrganizationId`)
- Add top-level `/users` web route (TanStack Router file route `/users`, index at `/users/`) for officers with `members.manage_permissions` — list org-scoped pending applicants with approve/deny actions
- `/admin/*` unchanged: platform ADMIN only; ADMIN continues to manage **all** pending users (approve/deny/reactivate/deactivate) as today
- Reactivate `INACTIVE` → `ACTIVE` and deactivate `ACTIVE` → `INACTIVE` remain ADMIN-only via `/admin/users`
- Reuse existing permission catalog key `members.manage_permissions`; no new permission keys
- Shared Zod contracts for officer pending-user list and approve/deny payloads

## Capabilities

### New Capabilities

- `officer-pending-approvals`: Org-scoped pending-applicant list/approve/deny API and `/users` UI for members with `members.manage_permissions`

### Modified Capabilities

- `session-auth`: Delegated officer approve/deny for `PENDING` users scoped to matching `requestedOrganizationId`; ADMIN retains full user-status control
- `memberships`: Officers may create membership atomically on delegated approve (requested org only); ADMIN assign/remove unchanged
- `admin-dashboard`: Clarify ADMIN-only scope; officer pending-approval UX lives at `/users`, not under `/admin/*`

## Impact

- **apps/api**: New org-scoped pending-approval module/endpoints; extend authorization beyond ADMIN-only user-status paths; reuse approve/deny transaction logic where possible
- **apps/web**: New `/users` route group with permission guard and pending-applicant UI; nav link visible only to officers with `members.manage_permissions`; `/admin/*` unchanged
- **packages/contracts**: Zod schemas for officer pending-user list and approve/deny request/response shapes
- **Tests**: API integration for org scope, permission gate, and officer cannot override org; e2e for officer approve/deny via `/users` and regression that `/admin/users` remains ADMIN-only
