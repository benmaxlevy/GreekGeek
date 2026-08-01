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

### Requirement: Admin manages permission grants from dashboard

The admin dashboard MUST list the seeded permission catalog (read-only) and provide grant/revoke controls per membership for `ACTIVE` users only. Delegated grant/revoke by non-admin members is API-only this phase; admin UI covers ADMIN operations.

#### Scenario: Admin views permission catalog

- **WHEN** a platform ADMIN opens the permissions section
- **THEN** seeded permission keys are listed without catalog edit controls

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
