## Purpose

Provides platform ADMIN with glass-styled dashboard flows to operate universities, organizations, memberships, permission grants, and user approval — using Phase 2 obsidian-glass theme and AppShell patterns.

## ADDED Requirements

### Requirement: Admin routes require active platform admin

Admin dashboard routes MUST be reachable only by authenticated users with role `ADMIN` and status `ACTIVE`. Non-admin or non-active users MUST be redirected or shown forbidden. Admin UI MUST use obsidian-glass styling and AppShell layout consistent with Phase 2.

#### Scenario: Admin accesses dashboard

- **WHEN** an ACTIVE platform ADMIN navigates to admin routes
- **THEN** the admin dashboard loads inside AppShell

#### Scenario: Non-admin blocked from admin routes

- **WHEN** a non-ADMIN or non-ACTIVE user navigates to admin routes
- **THEN** the app redirects to login or shows a forbidden state without exposing admin controls

### Requirement: Admin manages user approval with fill-or-kill workflow

The admin dashboard MUST provide a user management view listing users with status and filtering by status. For `PENDING` users, ADMIN MUST be able to **fill** (assign organization membership and activate) or **kill** (set `INACTIVE`). Permission grants MUST NOT be part of the approval flow. ADMIN MUST be able to reactivate `INACTIVE` users to `ACTIVE`.

#### Scenario: Admin views pending users

- **WHEN** a platform ADMIN opens the user management page
- **THEN** users are listed with status and PENDING users are identifiable

#### Scenario: Admin fills and activates pending user from UI

- **WHEN** a platform ADMIN assigns an organization to a PENDING user and activates them through the dashboard
- **THEN** the user's status becomes ACTIVE, membership is created with zero permissions, and the list reflects the change

#### Scenario: Admin kills pending user from UI

- **WHEN** a platform ADMIN rejects a PENDING user by setting status INACTIVE through the dashboard
- **THEN** the user's status becomes INACTIVE and the list reflects the change

#### Scenario: Admin reactivates inactive user from UI

- **WHEN** a platform ADMIN sets an INACTIVE user's status to ACTIVE through the dashboard
- **THEN** the user's status becomes ACTIVE and the list reflects the change

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
