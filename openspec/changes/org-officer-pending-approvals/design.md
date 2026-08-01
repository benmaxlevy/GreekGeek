## Context

Phase 3 delivers platform-ADMIN-only pending-user approval at `/admin/users` via `admin/users` API. `members.manage_permissions` already gates permission grant/revoke within an org (API). Public signup persists `requestedOrganizationId` on `PENDING` users. Officers need the same approve/deny outcome for applicants requesting **their** org — without admin dashboard access.

Workspace conventions: Zod at HTTP boundaries; types in feature `types/` / `packages/contracts`; `@RequireOrgPermission` guard with ADMIN bypass.

## Goals / Non-Goals

**Goals:**

- Org-scoped list of `PENDING` users where `requestedOrganizationId` equals the officer's organization
- Approve: `PENDING` → `ACTIVE` + create `Membership` for `requestedOrganizationId` (no org override for officers)
- Deny: `PENDING` → `INACTIVE`
- Authorize via `members.manage_permissions` in target org or platform ADMIN (all orgs; ADMIN may override org on approve per existing admin contract)
- Top-level `/users` UI for officers; `/admin/*` stays ADMIN-only
- API + e2e coverage for scope, gates, and regressions

**Non-Goals:**

- Officer reactivate/deactivate of `ACTIVE` / `INACTIVE` users
- Officer visibility into non-`PENDING` users or applicants for other orgs
- New permission catalog keys
- Email/notifications on approve/deny
- Moving or duplicating admin CRUD under `/users`

## Decisions

### 1. API surface (org-scoped pending approvals)

**Choice:** Nest module under org context, e.g. `organizations/:organizationId/pending-users`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/organizations/:organizationId/pending-users` | List `PENDING` users with `requestedOrganizationId = organizationId` |
| `PATCH` | `/api/organizations/:organizationId/pending-users/:userId` | Approve or deny one applicant |

**PATCH body (Zod in `packages/contracts`):**

```ts
{ status: 'ACTIVE' | 'INACTIVE' }
```

- `ACTIVE` on `PENDING` user → approve: membership to `user.requestedOrganizationId` (must equal `:organizationId`); reject if mismatch or missing requested org
- `INACTIVE` on `PENDING` user → deny
- Officers: body MUST NOT accept `organizationId` override (unlike admin patch)
- ADMIN: may support optional `organizationId` override on approve (same semantics as existing admin flow) when calling this endpoint or continue using admin API for cross-org work

**Authorization:**

1. Caller `ACTIVE`
2. If `role === ADMIN` → allow any `organizationId`
3. Else → `@RequireOrgPermission('members.manage_permissions')` on `:organizationId`; deny 403 otherwise

**List scope:** Officers and ADMIN both see only applicants for the path `organizationId` (ADMIN uses `/admin/users` for global queue; this list is intentionally org-scoped).

**Why:** Reuses existing org-permission guard; path param makes org context explicit; separates delegated flow from admin control plane.

### 2. Shared approve/deny logic

**Choice:** Extract or delegate to shared service method used by `AdminUsersService.approveAndActivate` and new officer endpoint — single transaction: create/replace membership + set `ACTIVE`, or set `INACTIVE` for deny.

Officer approve MUST verify:

- `user.status === 'PENDING'`
- `user.requestedOrganizationId === organizationId` from path
- No `organizationId` in request body for non-ADMIN callers

**Why:** Avoid divergent approval behavior between admin and officer paths.

### 3. Web routing — locked

**Choice:**

| Route group | Who | Purpose |
|-------------|-----|---------|
| `/admin/*` | Platform `ADMIN` + `ACTIVE` only | Full user management as today — all statuses, all orgs, reactivate/deactivate, org override on approve |
| `/users` (`/users/`) | `ACTIVE` members with `members.manage_permissions` in their membership org | Pending applicants for **that org only**; approve/deny only |

TanStack Router layout (matches `/admin`, `/app` pattern):

- `users.tsx` — `createFileRoute('/users')` layout: `beforeLoad` requires authenticated `ACTIVE` user + resolved `members.manage_permissions` for caller's membership org; redirect others to `/app`
- `users.index.tsx` — `createFileRoute('/users/')` pending list + approve/deny actions

Nav: show **Users** (or **Pending approvals**) link in `/app` AppShell nav when caller holds `members.manage_permissions` (not for ADMIN unless they also want a shortcut — ADMIN uses `/admin/users`).

**Why:** User confirmed `/users` as top-level route, not nested under `/app/...`; mirrors admin as sibling authenticated surface.

### 4. Contracts

**Choice:** Add `packages/contracts` schemas:

- `PendingApplicantSchema` — public user fields needed for queue (id, name, email, status, `requestedOrganizationId`, timestamps)
- `ListPendingApplicantsQuery` — optional pagination later; empty for v1
- `PatchPendingApplicantStatusSchema` — `{ status: 'ACTIVE' | 'INACTIVE', organizationId?: string }` where `organizationId` allowed only for ADMIN (document in schema comment; enforce in service)

Parse at HTTP boundary per workspace rules.

### 5. Admin dashboard unchanged

**Choice:** No officer UI under `/admin/*`. `admin-dashboard` spec delta clarifies ADMIN-only. Officer flows are solely `/users` + org-scoped API.

### 6. Testing

**Choice:**

- **API integration:** officer with permission lists only own-org pending; approve creates membership; deny sets INACTIVE; 403 without permission; 403/404 for wrong org applicant; officer cannot pass org override; ADMIN bypass
- **E2e:** officer login → `/users` → approve applicant → user reaches `/app`; deny → blocked; non-officer cannot access `/users`; ADMIN `/admin/users` regression

## Risks / Trade-offs

- [Two approval UIs] → `/admin/users` (global) vs `/users` (org-scoped); different audiences, shared backend logic
- [Caller org resolution] → `/users` UI must know officer's `organizationId` from membership/me; expose on profile or dedicated endpoint if missing today
- [Duplicate list endpoints] → Officers use org-scoped list; ADMIN global list stays on admin API — acceptable separation

## Migration Plan

1. Add contracts + API module with guard
2. Refactor shared approve/deny helper if needed
3. Add `/users` routes + client API helpers
4. Add nav link gated on permission
5. Tests + manual smoke

No schema migration required — uses existing `User.status`, `requestedOrganizationId`, `Membership`.
