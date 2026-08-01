## MODIFIED Requirements

### Requirement: User accounts store hashed credentials and a single global role

The system MUST persist users with a unique email, a password hash, optional email-verified timestamp, a role enum of `USER` or `ADMIN`, a status enum of `ACTIVE`, `PENDING`, or `INACTIVE`, and an optional `requestedOrganizationId` foreign key to `Organization`. Passwords MUST be stored only as argon2 hashes — never in plaintext. Signup for `USER` role MAY omit `organizationId` in the signup request. When `organizationId` is omitted or empty, the system MUST create the user with status `ACTIVE`, `requestedOrganizationId` null, and no membership row. When `organizationId` is provided, the system MUST validate the organization exists, create the user with status `PENDING`, set `requestedOrganizationId` to that organization, and create no membership until approval. The selected organization implies the user's requested university for pending signups only.

#### Scenario: Signup creates a hashed pending user with requested organization

- **WHEN** a client submits a valid signup with email, password, name, and `organizationId` referencing an existing organization
- **THEN** the system creates a user with an argon2 password hash, default role `USER`, status `PENDING`, `requestedOrganizationId` set to the submitted organization, no membership row, and does not store the plaintext password

#### Scenario: Signup creates an active user without organization

- **WHEN** a client submits a valid signup with email, password, and name without `organizationId` or with an empty `organizationId`
- **THEN** the system creates a user with an argon2 password hash, default role `USER`, status `ACTIVE`, `requestedOrganizationId` null, no membership row, and does not store the plaintext password

#### Scenario: Signup rejects invalid requested organization

- **WHEN** a client submits a signup with an `organizationId` that does not exist
- **THEN** the system rejects the request with a client error and does not create a user

#### Scenario: Duplicate email is rejected

- **WHEN** a client attempts signup with an email that already exists
- **THEN** the system rejects the request with a client error and does not create a second user

### Requirement: Auth UI, session restore, and route guards

The web app MUST provide glass-styled `/login` and `/signup` (register) pages. Signup MUST offer cascading university then organization selectors (organizations filtered by selected university), but organization selection MUST be optional. A user who selects a university without selecting an organization MUST be treated as signing up without an organization. The client MUST load university and organization options from public read list endpoints without authentication. The client MUST attach the access token to API calls, attempt a single refresh on 401, then replay the failed request once. Auth state MUST be available to the UI (current user query). Authenticated route groups for the normal app MUST redirect unauthenticated users to `/login` and non-`ACTIVE` users to the appropriate status surface before loading protected pages. After a hard refresh with a valid refresh cookie, an `ACTIVE` user MUST remain signed in without re-entering credentials. After signup (both paths), the client MUST redirect to `/login` with success messaging and MUST NOT establish an authenticated session.

#### Scenario: Register offers optional university and organization

- **WHEN** a user opens the register UI
- **THEN** they can optionally select a university, optionally select an organization filtered to that university, and submit signup without selecting an organization

#### Scenario: Register redirects org-less signup to login with ready message

- **WHEN** a user completes signup without an organization through the register UI
- **THEN** the UI redirects to `/login` with messaging that the account is ready to sign in and does not navigate to authenticated home as a signed-in user

#### Scenario: Register redirects org signup to login with pending message

- **WHEN** a user completes signup with an organization through the register UI
- **THEN** the UI redirects to `/login` with messaging that the account awaits approval and does not navigate to authenticated home as a signed-in user

#### Scenario: Org-less active user can sign in after signup

- **WHEN** a user who signed up without an organization logs in with valid credentials
- **THEN** they receive an authenticated session as an `ACTIVE` user and can reach protected pages that do not require org membership

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
