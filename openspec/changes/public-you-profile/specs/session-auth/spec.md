## MODIFIED Requirements

### Requirement: Auth HTTP endpoints and token transport

The API MUST expose signup, login, refresh, logout, and me endpoints under `/api/auth`. Successful login for any user with valid credentials MUST return a short-lived access token in the response body and set an httpOnly, SameSite=Lax, path-scoped refresh cookie regardless of `status`. Signup for a new user MUST NOT issue session tokens. Protected endpoints (excluding auth maintenance such as me and logout) MUST accept the access token as a Bearer credential and MUST reject non-`ACTIVE` callers. Request bodies and query/response shapes at these boundaries MUST be validated with shared Zod schemas. Public user profile responses MUST include `status`. The API MUST additionally expose an authenticated `PATCH /api/auth/me` endpoint for ACTIVE callers to update only the display name. Its request body MUST contain only the display-name field, reject blank or over-limit values, and return the updated public user response. Email, role, status, requested organization, membership, permissions, password, verification state, and session tokens MUST NOT be writable through this endpoint.

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

#### Scenario: Active user updates display name

- **WHEN** an ACTIVE authenticated user submits a valid display-name-only PATCH to `/api/auth/me`
- **THEN** the system persists the new display name and returns the updated validated public profile without rotating or replacing the session

#### Scenario: Profile update rejects unauthorized fields

- **WHEN** a caller submits email, role, status, membership, permissions, password, verification, or session fields to `/api/auth/me`
- **THEN** the system returns a 4xx validation error and leaves the account and session unchanged

#### Scenario: Profile update rejects blank display name

- **WHEN** an ACTIVE caller submits a blank, whitespace-only, or over-limit display name
- **THEN** the system returns a 4xx validation error and preserves the existing display name

#### Scenario: Non-active profile update is blocked

- **WHEN** a PENDING or INACTIVE authenticated caller submits a display-name update
- **THEN** the system returns 403 Forbidden and does not mutate the user

#### Scenario: Invalid credentials are rejected

- **WHEN** a client submits an unknown email or wrong password to login
- **THEN** the system rejects the request without setting a new authenticated session

#### Scenario: Invalid auth payloads are rejected

- **WHEN** a client sends a malformed signup, login, or profile-update body
- **THEN** the system returns a 4xx validation error and does not mutate auth state
