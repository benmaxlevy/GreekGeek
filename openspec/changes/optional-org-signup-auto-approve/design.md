## Context

See `proposal.md` for motivation. Today signup always requires `organizationId` in `SignupRequestSchema`, `auth.service.ts` always creates `PENDING` users with `requestedOrganizationId`, and the signup UI requires org selection before submit. University selection is FE-only; the API has no `universityId` on User.

## Goals / Non-Goals

**Goals:**

- Single signup endpoint with optional `organizationId` branching to `ACTIVE` (no org) vs `PENDING` (with org).
- Preserve existing org-signup approval flow unchanged.
- Redirect both signup paths to `/login` with distinct success messaging; no session tokens on signup.
- Admin users list clearly surfaces org-less `ACTIVE` users.

**Non-Goals:**

- Join-org-later self-service flow.
- Persisting `universityId` on User.
- Changing officer pending-approval rules or APIs.
- Auto-creating membership for org-less users.

## Decisions

### 1. Contract: optional `organizationId` via Zod

Change `SignupRequestSchema.organizationId` from `z.string().min(1)` to `z.string().min(1).optional()` (or equivalent optional/empty-string normalization). API treats omitted, `undefined`, and `""` as no-org.

**Alternative considered:** Separate `/signup` and `/signup-with-org` endpoints — rejected; one endpoint matches current UX and reduces FE branching.

### 2. API signup branch in `auth.service.ts`

```
if (organizationId present and non-empty) {
  validate org exists → create PENDING + requestedOrganizationId
} else {
  create ACTIVE + requestedOrganizationId null, skip org lookup
}
```

No membership row in either path at signup. Response shape unchanged (`SignupResponse` with `PublicUser` including `status`).

**Alternative considered:** Default missing org to first org in university — rejected; explicit product decision is auto-approve without org.

### 3. FE signup: optional org, university-only = no-org

Keep uni→org cascade. Remove required validation on org field. Submit sends `organizationId` only when user picked an org. University-only selection omits `organizationId` from payload.

Post-success: `navigate('/login', { state: { message } })` — org-less: account ready; with-org: awaiting approval. No token storage, no auto-login.

**Alternative considered:** Inline success banner on signup page — rejected; locked decision is redirect to `/login`.

### 4. Admin users UI: explicit "None" for no membership

In `/admin/users` table, derive membership/org display from membership join (or admin list DTO). When `ACTIVE` and no membership, render "None" (or equivalent label) in org/membership column. Avoid blank cells that look like data bugs.

No API change required if list already returns membership null; UI-only if data present.

### 5. Testing strategy

- API/integration: signup without org → `ACTIVE`, null `requestedOrganizationId`; signup with org → unchanged `PENDING`.
- E2E: org-less signup → login → protected route; org signup → login → awaiting approval.
- Demo video: both paths.

## Risks / Trade-offs

- **[ACTIVE users without membership may hit org-scoped features]** → Expected; out of scope for join-later. Existing route guards should already handle missing membership where required.
- **[Empty string vs omitted orgId inconsistency]** → Normalize in Zod preprocess or service: treat `""` as absent.
- **[Admin confusion on org-less ACTIVE users]** → Mitigated by explicit "None" in admin UI (spec requirement).

## Migration Plan

1. Deploy contracts + API (backward compatible: clients sending `organizationId` unchanged).
2. Deploy FE signup + admin UI.
3. No data migration; existing users unaffected.

Rollback: revert FE first, then API/contracts. Org-less signups created during rollout remain valid `ACTIVE` users.

## Open Questions

_None — locked product decisions cover scope._
