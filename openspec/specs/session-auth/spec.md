# session-auth Specification

## Purpose

Lets users create accounts, sign in with email and password, maintain a revocable browser session via access token plus rotating refresh cookie, and access protected API routes and frontend pages only while authenticated.

## Requirements

### Requirement: User accounts store hashed credentials and a single global role

The system MUST persist users with a unique email, a password hash, optional email-verified timestamp, a role enum of `USER` or `ADMIN`, a status enum of `ACTIVE`, `PENDING`, or `INACTIVE`, and an optional `requestedOrganizationId` foreign key to `Organization`. Passwords MUST be stored only as argon2 hashes — never in plaintext. Signup for `USER` role MUST require `requestedOrganizationId`; the selected organization implies the user's requested university.

#### Scenario: Signup creates a hashed pending user with requested organization

- **WHEN** a client submits a valid signup with email, password, name, and `requestedOrganizationId` referencing an existing organization
- **THEN** the system creates a user with an argon2 password hash, default role `USER`, status `PENDING`, `requestedOrganizationId` set to the submitted organization, and does not store the plaintext password

#### Scenario: Signup rejects missing organization for user role

- **WHEN** a client submits a signup for role `USER` without `requestedOrganizationId`
- **THEN** the system rejects the request with a client error and does not create a user

#### Scenario: Signup rejects invalid requested organization

- **WHEN** a client submits a signup with a `requestedOrganizationId` that does not exist
- **THEN** the system rejects the request with a client error and does not create a user

#### Scenario: Duplicate email is rejected

- **WHEN** a client attempts signup with an email that already exists
- **THEN** the system rejects the request with a client error and does not create a second user

### Requirement: Refresh tokens are stored, rotated, and revocable

The system MUST persist refresh tokens as hashed values bound to a user, with expiry and optional revocation timestamps. Each successful refresh MUST rotate the refresh token (issue a new one and invalidate the previous). Logout MUST revoke the current refresh token and clear the refresh cookie.

#### Scenario: Refresh rotates the token

- **WHEN** a client with a valid refresh cookie calls refresh
- **THEN** the previous refresh token is invalidated, a new refresh cookie is set, and a new short-lived access token is returned in the response body

#### Scenario: Revoked or reused refresh token is rejected

- **WHEN** a client presents a revoked, expired, or already-rotated refresh token
- **THEN** the system rejects the refresh and does not issue a new access token

#### Scenario: Logout revokes session

- **WHEN** an authenticated client calls logout with a valid refresh cookie
- **THEN** the refresh token is revoked, the refresh cookie is cleared, and subsequent refresh attempts with that token fail

### Requirement: Auth HTTP endpoints and token transport

The API MUST expose signup, login, refresh, logout, and me endpoints under `/api/auth`. Successful login for any user with valid credentials MUST return a short-lived access token in the response body and set an httpOnly, SameSite=Lax, path-scoped refresh cookie regardless of `status`. Signup for a new user MUST NOT issue session tokens. Protected endpoints (excluding auth maintenance such as me and logout) MUST accept the access token as a Bearer credential and MUST reject non-`ACTIVE` callers. Request bodies and query/response shapes at these boundaries MUST be validated with shared Zod schemas. Public user profile responses MUST include `status`.

#### Scenario: Active user login returns access token and sets refresh cookie

- **WHEN** a client submits valid email and password to login for a user with status `ACTIVE`
- **THEN** the response body includes a short-lived access token and the response sets an httpOnly refresh cookie

#### Scenario: Pending user login returns access token and sets refresh cookie

- **WHEN** a client submits valid email and password to login for a user with status `PENDING`
- **THEN** the response body includes a short-lived access token and the response sets an httpOnly refresh cookie

#### Scenario: Inactive user login returns access token and sets refresh cookie

- **WHEN** a client submits valid email and password to login for a user with status `INACTIVE`
- **THEN** the response body includes a short-lived access token and the response sets an httpOnly refresh cookie

#### Scenario: Me returns the current user including status

- **WHEN** a client calls me with a valid Bearer access token
- **THEN** the system returns the authenticated user's public profile (at least id, email, name, role, status) regardless of status

#### Scenario: Invalid credentials are rejected

- **WHEN** a client submits an unknown email or wrong password to login
- **THEN** the system rejects the request without setting a new authenticated session

#### Scenario: Invalid auth payloads are rejected

- **WHEN** a client sends a malformed signup or login body
- **THEN** the system returns a 4xx validation error and does not mutate auth state

### Requirement: Global authentication with public opt-out

API routes MUST require a valid access token by default. Routes that must be reachable without a session (auth endpoints and health) MUST be explicitly marked public. Unauthenticated requests to protected routes MUST receive 401.

#### Scenario: Protected route rejects missing token

- **WHEN** a client calls a protected API route without a Bearer access token
- **THEN** the response is 401 Unauthorized

#### Scenario: Public route remains reachable

- **WHEN** a client calls a marked-public route such as login or health without an access token
- **THEN** the request is not rejected solely for missing authentication

### Requirement: Auth UI, session restore, and route guards

The web app MUST provide glass-styled `/login` and `/signup` (register) pages. Signup MUST collect university then organization using cascading selectors (organizations filtered by selected university). The client MUST load university and organization options from public read list endpoints without authentication. The client MUST attach the access token to API calls, attempt a single refresh on 401, then replay the failed request once. Auth state MUST be available to the UI (current user query). Authenticated route groups for the normal app MUST redirect unauthenticated users to `/login` and non-`ACTIVE` users to the appropriate status surface before loading protected pages. After a hard refresh with a valid refresh cookie, an `ACTIVE` user MUST remain signed in without re-entering credentials.

#### Scenario: Register collects university and organization

- **WHEN** a user opens the register UI
- **THEN** they can select a university, then an organization filtered to that university, before submitting signup

#### Scenario: Register shows pending approval messaging

- **WHEN** a user completes signup through the register UI
- **THEN** the UI communicates that the account awaits admin approval and does not navigate to authenticated home as a signed-in user

#### Scenario: Pending user lands on awaiting approval after login

- **WHEN** a user with status `PENDING` logs in through the UI
- **THEN** they are routed to an awaiting-approval screen and cannot reach normal app pages

#### Scenario: Inactive user lands on blocked screen after login

- **WHEN** a user with status `INACTIVE` logs in through the UI
- **THEN** they are routed to a blocked/inactive screen and cannot reach normal app pages

#### Scenario: Active user login then session works in the browser

- **WHEN** an approved (`ACTIVE`) user logs in through the UI
- **THEN** they receive an authenticated session and can reach a protected page

#### Scenario: Logout then login round-trip

- **WHEN** a signed-in user logs out and then logs in again with valid credentials
- **THEN** the prior session is ended and a new authenticated session is established

#### Scenario: Hard refresh restores session via refresh cookie

- **WHEN** a signed-in `ACTIVE` user hard-refreshes the browser
- **THEN** the client obtains a new access token via the refresh cookie and remains on authenticated pages without prompting for credentials

#### Scenario: Protected frontend route redirects when signed out

- **WHEN** an unauthenticated user navigates to a protected frontend route
- **THEN** the app redirects them to `/login`

#### Scenario: Refresh-on-401 recovers a single expired access token

- **WHEN** an API call returns 401 because the access token expired and a valid refresh cookie exists for an `ACTIVE` user
- **THEN** the client refreshes once, retries the original request, and succeeds without forcing a full re-login

### Requirement: Dev admin seed

In development, the system MUST provide a seed that creates an admin user with status `ACTIVE` so local developers can log in without manual signup or approval.

#### Scenario: Seeded admin can log in

- **WHEN** the development seed has been applied
- **THEN** a known admin email/password can authenticate via login

### Requirement: Lean automated coverage for auth

Auth behavior MUST be covered primarily by Playwright end-to-end tests against the web app and API with Postgres. Unit or API integration tests MUST be added only for concerns e2e cannot reliably cover (argon2 hash verification logic, refresh-token rotation/revocation edge cases, JWT strategy validation). The suite MUST NOT add fluff snapshot tests.

#### Scenario: E2e covers core auth flows

- **WHEN** the Phase 2 e2e suite runs
- **THEN** it verifies signup, logout, login, session survival across hard refresh, and protected-route rejection or redirect when signed out

#### Scenario: Narrow unit or integration tests for non-UI edge cases

- **WHEN** a concern cannot be asserted through browser e2e (for example argon2 verify, refresh rotation/revocation races, JWT payload validation)
- **THEN** a focused Nest/Jest or Vitest unit or integration test covers that concern only

### Requirement: Non-active users are authenticated but not admitted to the normal app

Users with status `PENDING` or `INACTIVE` MUST be able to authenticate (login and refresh succeed with tokens issued) but MUST NOT access protected API routes, admin APIs, org-scoped APIs, or normal authenticated frontend pages. They MUST be routed to status surfaces: awaiting approval (`PENDING`) or blocked (`INACTIVE`). Auth maintenance endpoints (`/api/auth/me`, logout) MUST remain reachable. Signup MUST NOT issue session tokens.

#### Scenario: Signup does not establish session

- **WHEN** a new user completes signup via the API or register UI
- **THEN** no access token or refresh cookie is issued and the user remains unauthenticated

#### Scenario: Refresh succeeds for non-active user

- **WHEN** a client attempts refresh with a valid refresh cookie for a user whose status is `PENDING` or `INACTIVE`
- **THEN** the system issues a new access token

#### Scenario: Protected route rejects non-active authenticated caller

- **WHEN** a request reaches a protected route (other than auth maintenance) with credentials tied to a non-`ACTIVE` user
- **THEN** the response is 401 or 403 and the request is not processed as an admitted app user

#### Scenario: Status change blocks subsequent protected access

- **WHEN** an authenticated `ACTIVE` user's status becomes `PENDING` or `INACTIVE`
- **THEN** subsequent requests to protected routes are rejected while auth maintenance remains available

### Requirement: Platform admin manages user status

Platform ADMIN MUST be able to list users filtered by status and update user status between `PENDING`, `ACTIVE`, and `INACTIVE` via admin API and admin UI. User list/detail for admin MUST include `requestedOrganizationId` and implied university for `PENDING` users. Approving a `PENDING` user (`PENDING` → `ACTIVE`) MUST be a distinct **approve** action that validates the requested org/university: if acceptable, assign membership to the requested organization (admin MAY override organization in the approve request); if not acceptable, **deny** by setting status `INACTIVE`. Permission grants MUST NOT occur during approval. Rejecting a pending user MUST set status `INACTIVE` (deny). ADMIN MUST be able to reactivate `INACTIVE` → `ACTIVE`. Members with `members.manage_permissions` MUST be able to approve or deny `PENDING` users only when `requestedOrganizationId` matches their organization via the org-scoped pending-approval API (not the admin user-status API); they MUST NOT reassign organization on approve, reactivate, or deactivate users. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Admin approves pending user with requested org

- **WHEN** a platform ADMIN approves a `PENDING` user whose requested organization is acceptable and sets status `ACTIVE`
- **THEN** the user's status is `ACTIVE`, a membership row links the user to the requested organization (or admin override) with zero permissions, and the user can reach normal app routes on subsequent login

#### Scenario: Admin approves pending user with org override

- **WHEN** a platform ADMIN approves a `PENDING` user by overriding the organization in the approve request and setting status `ACTIVE`
- **THEN** the user's status is `ACTIVE` and membership is created for the override organization with zero permissions

#### Scenario: Admin denies pending user with invalid requested org

- **WHEN** a platform ADMIN rejects a `PENDING` user by setting status `INACTIVE`
- **THEN** the user's status is persisted as `INACTIVE` and the user is routed to the blocked screen when authenticated

#### Scenario: Admin reactivates inactive user

- **WHEN** a platform ADMIN sets an `INACTIVE` user's status to `ACTIVE`
- **THEN** the user's status is persisted as `ACTIVE` and the user can reach normal app routes on subsequent login

#### Scenario: Non-admin cannot use admin user status API

- **WHEN** a non-ADMIN user calls the admin user status management API
- **THEN** the system returns 403 Forbidden

#### Scenario: Officer approves via org-scoped API not admin API

- **WHEN** a member with `members.manage_permissions` approves a `PENDING` user whose `requestedOrganizationId` matches their organization through the org-scoped pending-approval API
- **THEN** the user's status is `ACTIVE`, membership is created for the requested organization with zero permissions, and the admin user-status API was not required

#### Scenario: Officer cannot use admin user status API

- **WHEN** a member with `members.manage_permissions` calls the admin user status management API
- **THEN** the system returns 403 Forbidden
