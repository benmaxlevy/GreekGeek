## 1. Shared Contracts

- [x] 1.1 Add strict display-name update request schema with trim, non-empty, and bounded-length validation in `packages/contracts/src/auth.ts`.
- [x] 1.2 Add profile summary response schemas for non-void ticket count, upcoming event count, and nullable next-event metadata without ticket credentials or holder data.
- [x] 1.3 Export new schemas and inferred types through `packages/contracts/src/index.ts` and re-export them from API auth DTOs.

## 2. Authenticated API

- [x] 2.1 Add authenticated `PATCH /api/auth/me` and `GET /api/auth/me/summary` controller handlers using Zod request pipes and response parsing.
- [x] 2.2 Implement display-name persistence in `AuthService` using existing `User.name`, then reload the full `PublicUser` shape so membership and permission data stay current without rotating tokens.
- [x] 2.3 Implement caller-owned summary queries using `holderUserId`, excluding `void` tickets, counting distinct future events, selecting the earliest future event, and returning only contract-approved fields.
- [x] 2.4 Preserve global JWT and active-user guard behavior so unauthenticated callers receive 401 and PENDING or INACTIVE callers receive 403 on update and summary routes.

## 3. API Validation Coverage

- [x] 3.1 Add API integration coverage for successful active-user display-name update, updated `PublicUser` response, and unchanged refresh/access session state.
- [x] 3.2 Add API validation and authorization coverage for blank, whitespace-only, over-limit, unknown-field, read-only-field, unauthenticated, PENDING, and INACTIVE update requests.
- [x] 3.3 Add API summary coverage for caller ownership, paid/unpaid inclusion, void exclusion, distinct upcoming-event counts, earliest next event, no-upcoming null state, and omission of credential or other-user data.

## 4. Web Data Layer

- [x] 4.1 Add API helpers for display-name update and profile summary that validate outbound payloads and parse all successful responses with shared Zod contracts.
- [x] 4.2 Add React Query keys/options or equivalent cache helpers for profile summary and update the existing `me` cache from the validated update response.
- [x] 4.3 Ensure API error handling exposes validation, authorization, and persistence failures to the profile UI without fabricating identity or summary values.

## 5. `/app/you` Profile Surface

- [x] 5.1 Replace the minimal `/app/you` body with identity sections for display name, email, status, membership/no-membership, stored global role, and exact or safely mapped permission capabilities.
- [x] 5.2 Add display-name edit, save, cancel, pending, success, validation-error, and persistence-error states; keep email, status, membership, permissions, password, verification, photo, privacy, social, and attendance fields read-only or absent.
- [x] 5.3 Add ticket count, upcoming-event count, next-event card, ticket navigation, loading, empty, and recoverable summary-error states from the summary query.
- [x] 5.4 Preserve existing Payments, Pending approvals, Admin, and logout links/actions with their current authorization predicates and session-revocation flow.
- [x] 5.5 Preserve `/app/you` route guards and AppShell/bottom-navigation behavior for unauthenticated and non-ACTIVE users.

## 6. Web Acceptance and Validation

- [ ] 6.1 Add focused web/e2e coverage for member, org-less active user, and ADMIN profile rendering, authorized links, display-name update, read-only identity fields, logout, summary empty/error states, and excluded controls.
- [x] 6.2 Run contract/API/web typecheck, lint, and relevant API and Playwright tests; fix regressions without adding verification or adjacent profile scope.
