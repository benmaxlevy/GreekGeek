## Purpose

Provides authenticated users with one user-facing profile surface for identity, organization context, capability visibility, owned-ticket context, and existing account actions without exposing private social or verification data.

## ADDED Requirements

### Requirement: Authenticated profile summary API

The system MUST expose an authenticated `GET /api/auth/me/summary` endpoint for an ACTIVE caller. The response MUST be validated by a shared Zod schema and MUST contain only caller-owned summary data: non-void ticket counts, upcoming event count, and the next upcoming event when one exists. The next event MUST include only its event id, name, start time, optional location, and caller ticket count; it MUST NOT include credential tokens, other users, attendance state, or social data. Ticket counts MUST be derived from tickets held by the caller, and upcoming events MUST use event start times after the current time.

#### Scenario: Active user receives owned ticket summary

- **WHEN** an ACTIVE authenticated user requests `GET /api/auth/me/summary`
- **THEN** the API returns validated non-void ticket totals and upcoming-event data limited to that user's held tickets

#### Scenario: Summary excludes void tickets

- **WHEN** the caller has paid, unpaid, and void tickets
- **THEN** total and upcoming counts exclude void tickets

#### Scenario: Summary returns next event without credentials

- **WHEN** the caller has a held ticket for a future event
- **THEN** `nextEvent` contains event metadata and caller ticket count but no `credentialToken`, other holder identity, or attendance fields

#### Scenario: Summary handles no upcoming event

- **WHEN** the caller has no non-void ticket for an event starting after the current time
- **THEN** `upcomingEventCount` is zero and `nextEvent` is null

#### Scenario: Non-active caller cannot read profile summary

- **WHEN** a PENDING or INACTIVE authenticated user requests the summary endpoint
- **THEN** the API returns forbidden and does not return summary data

#### Scenario: Unauthenticated caller cannot read profile summary

- **WHEN** a caller without a valid access token requests the summary endpoint
- **THEN** the API returns 401 Unauthorized

### Requirement: User-facing profile page presents current account context

The web app MUST provide an authenticated `/app/you` page inside the existing member AppShell. For an ACTIVE user it MUST show display name, email, account status, membership organization when present, and stored global role or exact permission capabilities without inventing unsupported role labels. It MUST show the ticket/upcoming summary from the authenticated API and provide loading, failed-request, no-membership, and no-upcoming-data states.

#### Scenario: Active member views profile identity and membership

- **WHEN** an ACTIVE user with an organization membership opens `/app/you`
- **THEN** the page shows the user's display name, email, ACTIVE status, organization name, and permission-derived capability presentation

#### Scenario: Active user without membership views profile

- **WHEN** an ACTIVE user has no membership
- **THEN** the page shows an explicit no-organization state and does not fabricate a role, organization, or permission grant

#### Scenario: Admin profile does not fabricate membership

- **WHEN** an ACTIVE platform ADMIN opens `/app/you`
- **THEN** the page presents the stored ADMIN role or admin capability and shows no organization membership unless the existing identity contract supplies one

#### Scenario: Profile shows ticket and upcoming summary

- **WHEN** the profile summary request succeeds
- **THEN** the page shows non-void ticket context, upcoming event count, and next event details when available, with a link to existing ticket surfaces where appropriate

#### Scenario: Profile handles summary failure

- **WHEN** the summary request fails after identity loads
- **THEN** the page shows a recoverable error state and does not display fabricated counts or event data

#### Scenario: Profile route preserves authentication guard

- **WHEN** an unauthenticated or non-ACTIVE user navigates to `/app/you`
- **THEN** the existing login or status-surface routing applies before profile content is shown

### Requirement: Display name is the only editable profile field

The profile page MUST provide an edit control for display name only. Email, account status, global role, organization membership, permission grants, password, verification state, photos, privacy settings, attendance visibility, and social data MUST be read-only or absent from this surface. A successful save MUST refresh the displayed identity without requiring a new session.

#### Scenario: User saves valid display name

- **WHEN** an ACTIVE user submits a non-empty display name within the API limit
- **THEN** the display name is persisted, the API returns the updated validated profile, and the page reflects the new value

#### Scenario: User cannot edit read-only identity fields

- **WHEN** a profile update request includes email, status, role, membership, permission, password, or verification fields
- **THEN** validation rejects the request and none of those fields change

#### Scenario: Blank display name is rejected

- **WHEN** a user submits a blank or whitespace-only display name
- **THEN** the API returns a 4xx validation error and preserves the previous name

#### Scenario: Profile update requires active authentication

- **WHEN** an unauthenticated, PENDING, or INACTIVE caller submits a display-name update
- **THEN** the API returns 401 or 403 and does not mutate the account

#### Scenario: Profile update handles persistence failure

- **WHEN** display-name persistence fails
- **THEN** the page shows an actionable error and retains the last confirmed display name

### Requirement: Existing account actions remain authorization-gated

The profile page MUST preserve existing Payments, Pending approvals, Admin, and logout actions. Payments MUST remain conditional on the existing organization context, Pending approvals MUST use the existing approval capability predicate, Admin MUST require the existing platform ADMIN predicate, and logout MUST use the existing session-revocation flow. The page MUST NOT add links or controls for excluded features.

#### Scenario: Member sees authorized payments link

- **WHEN** an ACTIVE user has the existing organization membership context
- **THEN** the profile page provides the existing Payments link for that organization

#### Scenario: Approvals link follows existing capability

- **WHEN** an ACTIVE user satisfies the existing pending-approval management predicate
- **THEN** the profile page shows Pending approvals; otherwise it does not show that link

#### Scenario: Admin link follows stored role

- **WHEN** an ACTIVE user has stored global role ADMIN
- **THEN** the profile page shows the existing Admin link; non-admin users do not receive that link

#### Scenario: Logout revokes current session

- **WHEN** a signed-in user activates logout from the profile page
- **THEN** the existing logout request revokes the current refresh session, clears client auth state, and navigates to login

#### Scenario: Excluded profile features remain absent

- **WHEN** a user views or edits `/app/you`
- **THEN** no password-change, photo/avatar, privacy, verification, friends, Circles, social-graph, or attendance-visibility control is exposed
