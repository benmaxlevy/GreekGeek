# admin-dashboard Specification

## Purpose

Provides platform ADMIN with glass-styled dashboard flows to operate universities, organizations, memberships, permission grants, and user approval — using Phase 2 obsidian-glass theme and AppShell patterns.

## Requirements

### Requirement: Admin routes require active platform admin

Admin dashboard routes MUST be reachable only by authenticated users with role `ADMIN` and status `ACTIVE`. Non-admin or non-active users MUST be redirected or shown forbidden. Admin UI MUST use obsidian-glass styling and AppShell layout consistent with Phase 2.

#### Scenario: Admin accesses dashboard

- **WHEN** an ACTIVE platform ADMIN navigates to admin routes
- **THEN** the admin dashboard loads inside AppShell

#### Scenario: Non-admin blocked from admin routes

- **WHEN** a non-ADMIN or non-ACTIVE user navigates to admin routes
- **THEN** the app redirects to login or shows a forbidden state without exposing admin controls

### Requirement: Admin manages user approval with approve-or-deny workflow

The admin dashboard MUST provide a user management view at `/admin/users` listing users with status and filtering by status. For `PENDING` users, the UI MUST display requested university and organization (from `requestedOrganizationId`). For `ACTIVE` users without a membership, the UI MUST clearly indicate no organization or membership (e.g. show "None" or equivalent in the membership or organization column). ADMIN MUST be able to **approve** (confirm or override organization membership and activate) or **deny** (set `INACTIVE`). Permission grants MUST NOT be part of the approval flow. ADMIN MUST be able to reactivate `INACTIVE` users to `ACTIVE`. Officer pending-approval flows MUST NOT live under `/admin/*`; delegated approve/deny for officers belongs on the `/users` route for members with `members.manage_permissions`.

#### Scenario: Admin views pending users with requested org

- **WHEN** a platform ADMIN opens the admin user management page at `/admin/users`
- **THEN** users are listed with status, and PENDING users show their requested university and organization

#### Scenario: Admin views active users without membership

- **WHEN** a platform ADMIN opens the admin user management page at `/admin/users` and an ACTIVE user has no membership row
- **THEN** the user's membership or organization column clearly shows no organization (e.g. "None") rather than an empty or ambiguous value

#### Scenario: Admin approves and activates pending user from UI

- **WHEN** a platform ADMIN confirms or overrides the organization for a PENDING user and activates them through the admin dashboard
- **THEN** the user's status becomes ACTIVE, membership is created for the confirmed or override organization with zero permissions, and the list reflects the change

#### Scenario: Admin denies pending user from UI

- **WHEN** a platform ADMIN rejects a PENDING user by setting status INACTIVE through the admin dashboard
- **THEN** the user's status becomes INACTIVE and the list reflects the change

#### Scenario: Admin reactivates inactive user from UI

- **WHEN** a platform ADMIN sets an INACTIVE user's status to ACTIVE through the admin dashboard
- **THEN** the user's status becomes ACTIVE and the list reflects the change

#### Scenario: Non-admin cannot access admin user management

- **WHEN** a non-ADMIN user navigates to `/admin/users`
- **THEN** the app redirects away from admin routes without exposing admin user controls

### Requirement: Admin manages universities from dashboard

The admin dashboard MUST provide list, create, edit, and delete flows for universities.

#### Scenario: Admin creates university from UI

- **WHEN** a platform ADMIN submits the create-university form
- **THEN** the new university appears in the list

#### Scenario: Admin deletes empty university from UI

- **WHEN** a platform ADMIN deletes a university with no organizations
- **THEN** the university is removed from the list

#### Scenario: Admin sees error when deleting university with dependents

- **WHEN** a platform ADMIN attempts to delete a university that has organizations
- **THEN** the UI surfaces the 409 conflict and the university remains in the list

### Requirement: Admin manages organizations from dashboard

The admin dashboard MUST provide list (filterable by university), create, edit, and delete flows for organizations with type selection (`FRATERNITY` | `SORORITY`).

#### Scenario: Admin creates organization from UI

- **WHEN** a platform ADMIN submits the create-organization form with name, type, and university
- **THEN** the new organization appears in the list

#### Scenario: Admin sees error when deleting organization with memberships

- **WHEN** a platform ADMIN attempts to delete an organization that has memberships
- **THEN** the UI surfaces the 409 conflict and the organization remains in the list

### Requirement: Admin manages memberships from dashboard

The admin dashboard MUST provide flows to assign a user to an organization and remove an existing membership, enforcing one membership per user.

#### Scenario: Admin assigns membership from UI

- **WHEN** a platform ADMIN assigns a user without membership to an organization
- **THEN** the membership is shown in the admin UI

#### Scenario: Admin removes membership from UI

- **WHEN** a platform ADMIN removes a user's membership
- **THEN** the membership no longer appears in the admin UI

### Requirement: Admin views organization Stripe Connect status from dashboard

The admin dashboard MUST show per-organization Stripe Connect status on the organization detail or list surface: `stripeAccountId` (nullable), `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted`, `stripeRequirementsDue`, and `stripeAccountUpdatedAt`. Platform ADMIN MUST be able to generate a hosted onboarding link for an organization (same server flow as officer Connect, subject to ADMIN bypass on permission checks). The admin UI MUST NOT provide controls to manually set or override Stripe readiness flags. Styling MUST match existing obsidian-glass admin pages. Non-admin users MUST be blocked from admin Stripe Connect controls.

#### Scenario: Admin views org Stripe status

- **WHEN** an ACTIVE platform ADMIN opens an organization's admin detail
- **THEN** current Stripe-derived flags and requirements are displayed read-only

#### Scenario: Admin generates onboarding link

- **WHEN** an ACTIVE platform ADMIN requests onboarding link generation for an organization
- **THEN** the UI receives a redirect URL or opens the hosted Stripe flow without mutating flags directly

#### Scenario: Admin cannot toggle charges enabled

- **WHEN** an ACTIVE platform ADMIN views organization Stripe settings
- **THEN** no control exists to manually set `stripeChargesEnabled` or related flags

#### Scenario: Non-admin blocked from admin Stripe controls

- **WHEN** a non-ADMIN user attempts to access admin Stripe Connect actions
- **THEN** the app redirects away without exposing those controls

### Requirement: Admin manages permission grants from dashboard

The admin dashboard MUST list the seeded permission catalog (read-only) and provide grant/revoke controls per membership for `ACTIVE` users only. The catalog listing MUST include `payments.manage` when seeded. Delegated grant/revoke by non-admin members is API-only this phase; admin UI covers ADMIN operations.

#### Scenario: Admin views permission catalog

- **WHEN** a platform ADMIN opens the permissions section
- **THEN** seeded permission keys are listed without catalog edit controls, including `payments.manage`

#### Scenario: Admin grants permission to active member from UI

- **WHEN** a platform ADMIN grants a catalog permission to an ACTIVE user's membership through the dashboard
- **THEN** the grant is reflected in the membership's permission list

#### Scenario: Admin revokes permission from UI

- **WHEN** a platform ADMIN revokes a permission from a membership through the dashboard
- **THEN** the grant is removed from the membership's permission list

### Requirement: Admin manages events from dashboard

The admin dashboard MUST provide an events view at `/admin/events` where platform ADMIN can list events (optional organization filter), create events with an organization picker, edit, and delete. The admin nav MUST include an Events link. Styling MUST match existing obsidian-glass admin pages.

#### Scenario: Admin opens events page

- **WHEN** an ACTIVE platform ADMIN navigates to `/admin/events`
- **THEN** the events management UI loads with list and create controls including organization selection

#### Scenario: Admin creates event for chosen organization

- **WHEN** a platform ADMIN submits a valid event form with an organization selected
- **THEN** the event appears in the admin events list for that organization

### Requirement: Admin manages event ticketing from dashboard

The admin dashboard MUST provide a ticketed-events view listing events with ticketing enabled (optional organization filter). Platform ADMIN MUST manage per-event ticketing at `/admin/events/$eventId/tickets`: edit inline ticketing config, set allocations (including public pool), issue/list/void/mark-paid tickets, force sale status closed, and adjust capacity subject to validation rules. The admin nav MUST include a link to ticketed events or ticket management when the user is ACTIVE platform ADMIN. Styling MUST match existing obsidian-glass admin pages. Non-admin users MUST be blocked from admin ticket routes.

#### Scenario: Admin opens ticketed events list

- **WHEN** an ACTIVE platform ADMIN navigates to the ticketed-events admin view
- **THEN** events with ticketing enabled are listed with optional org filter

#### Scenario: Admin manages event tickets

- **WHEN** an ACTIVE platform ADMIN opens `/admin/events/$eventId/tickets`
- **THEN** they can edit ticketing config, allocations, issue/void/mark-paid, and view guest list

#### Scenario: Admin force-closes ticket sales

- **WHEN** an ACTIVE platform ADMIN sets ticketSaleStatus to closed for an event
- **THEN** the sale status updates and new claims/issues respect closed state per API rules

#### Scenario: Non-admin blocked from admin ticket routes

- **WHEN** a non-ADMIN user navigates to `/admin/events/$eventId/tickets`
- **THEN** the app redirects away without exposing admin ticket controls

### Requirement: Admin manages webhook events inbox from dashboard

The admin dashboard MUST provide a webhook events view at `/admin/webhook-events` for ACTIVE platform ADMIN users. The UI MUST list webhook events with service, type, externalId, receivedAt, processedAt, attempts, and truncated lastError. The UI MUST support filtering by unprocessed, failed, and all. For failed events, ADMIN MUST be able to trigger re-enqueue from the UI. The admin nav MUST include a link to webhook events when the user is ACTIVE platform ADMIN. Styling MUST match existing obsidian-glass admin pages. Non-admin users MUST be blocked from the route.

#### Scenario: Admin opens webhook events inbox

- **WHEN** an ACTIVE platform ADMIN navigates to `/admin/webhook-events`
- **THEN** webhook events are listed with filter controls for unprocessed, failed, and all

#### Scenario: Admin re-enqueues failed event from UI

- **WHEN** an ACTIVE platform ADMIN clicks re-enqueue on a failed webhook event row
- **THEN** the UI calls the re-enqueue API and refreshes the list to reflect updated state

#### Scenario: Non-admin blocked from webhook events route

- **WHEN** a non-ADMIN user navigates to `/admin/webhook-events`
- **THEN** the app redirects away without exposing webhook admin controls

### Requirement: Admin operates event payout queue

The admin dashboard MUST provide an event payout operations view for ACTIVE platform ADMIN users. The view MUST distinguish eligible now, pending, held, blocked, failed, and post-release dispute exposure states, including blocked and failure reasons. ADMIN MUST be able to release an eligible event early, hold an event, clear a hold, and retry a failed transfer. Every action MUST require and display a visible reason, actor, and timestamp. Non-admin users MUST be blocked from payout routes and controls.

#### Scenario: Admin sees payout queue states
- **WHEN** an ACTIVE platform ADMIN opens the payout operations view
- **THEN** events are listed with eligible-now, pending, held, blocked, failed, and post-release dispute states and reasons

#### Scenario: Admin releases early
- **WHEN** ADMIN submits an early release with a reason for an otherwise eligible positive-net event
- **THEN** one manual payout release is attempted, the actor and reason are shown, and time gate is the only skipped rule

#### Scenario: Admin holds and clears event
- **WHEN** ADMIN holds an event and later clears the hold with reasons
- **THEN** the queue shows held state while held, then returns event to computed eligibility after clear

#### Scenario: Admin retries failed transfer
- **WHEN** ADMIN retries a failed payout with a reason
- **THEN** the existing payout retry is queued without creating a second transfer, and updated attempts/error state is shown

#### Scenario: Non-admin cannot operate payouts
- **WHEN** a non-ADMIN user navigates to payout operations or calls its actions
- **THEN** the route or API returns forbidden without exposing payout controls

### Requirement: Admin sees event payout financial summary

The admin dashboard MUST show per-event gross (`amountCents` sum), GreekGeek fees (`feeCents` sum), net (`netCents` sum), released, pending, and excluded totals. It MUST show excluded purchase count, amount, and reason, host Connect readiness, payout batch sequence/status, transfer identity when present, and post-release dispute exposure. Historical released EventPayout amounts MUST remain displayed unchanged.

#### Scenario: Admin reviews partial exclusion
- **WHEN** an event has one excluded purchase and other clean purchases
- **THEN** the summary shows excluded count, amount, reason, and remaining net available for release

#### Scenario: Admin reviews released history
- **WHEN** an event has a released payout and later receives a disputed purchase
- **THEN** the summary preserves released amount and displays an exposure flag for follow-up
