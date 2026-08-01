# session-auth Specification

## Purpose

Lets users create accounts, sign in with email and password, maintain a revocable browser session via access token plus rotating refresh cookie, and access protected API routes and frontend pages only while authenticated.

## Requirements

### Requirement: User accounts store hashed credentials and a single global role

The system MUST persist users with a unique email, a password hash, optional email-verified timestamp, and a role enum of `USER` or `ADMIN`. Passwords MUST be stored only as argon2 hashes — never in plaintext.

#### Scenario: Signup creates a hashed user

- **WHEN** a client submits a valid signup with email, password, and name
- **THEN** the system creates a user with an argon2 password hash and default role `USER`, and does not store the plaintext password

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

The API MUST expose signup, login, refresh, logout, and me endpoints under `/api/auth`. Successful login and signup MUST return a short-lived access token in the response body and set an httpOnly, SameSite=Lax, path-scoped refresh cookie. Protected endpoints MUST accept the access token as a Bearer credential. Request bodies and query/response shapes at these boundaries MUST be validated with shared Zod schemas.

#### Scenario: Login returns access token and sets refresh cookie

- **WHEN** a client submits valid email and password to login
- **THEN** the response body includes a short-lived access token and the response sets an httpOnly refresh cookie

#### Scenario: Me returns the current user

- **WHEN** a client calls me with a valid Bearer access token
- **THEN** the system returns the authenticated user's public profile (at least id, email, name, role)

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

The web app MUST provide glass-styled `/login` and `/signup` pages. The client MUST attach the access token to API calls, attempt a single refresh on 401, then replay the failed request once. Auth state MUST be available to the UI (current user query). Authenticated route groups MUST redirect unauthenticated users to `/login` before loading protected pages. After a hard refresh with a valid refresh cookie, the user MUST remain signed in without re-entering credentials.

#### Scenario: Signup then session works in the browser

- **WHEN** a user completes signup through the UI
- **THEN** they receive an authenticated session and can reach a protected page

#### Scenario: Logout then login round-trip

- **WHEN** a signed-in user logs out and then logs in again with valid credentials
- **THEN** the prior session is ended and a new authenticated session is established

#### Scenario: Hard refresh restores session via refresh cookie

- **WHEN** a signed-in user hard-refreshes the browser
- **THEN** the client obtains a new access token via the refresh cookie and remains on authenticated pages without prompting for credentials

#### Scenario: Protected frontend route redirects when signed out

- **WHEN** an unauthenticated user navigates to a protected frontend route
- **THEN** the app redirects them to `/login`

#### Scenario: Refresh-on-401 recovers a single expired access token

- **WHEN** an API call returns 401 because the access token expired and a valid refresh cookie exists
- **THEN** the client refreshes once, retries the original request, and succeeds without forcing a full re-login

### Requirement: Dev admin seed

In development, the system MUST provide a seed that creates an admin user so local developers can log in without manual signup.

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
