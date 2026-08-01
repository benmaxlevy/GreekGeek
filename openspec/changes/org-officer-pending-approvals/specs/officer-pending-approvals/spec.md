## Purpose

Lets org officers with `members.manage_permissions` review and approve or deny pending signup applicants who requested their organization, via org-scoped API and a dedicated `/users` web surface.

## ADDED Requirements

### Requirement: Org-scoped pending applicant list

The system MUST expose an API to list users with status `PENDING` whose `requestedOrganizationId` equals a given organization id. The list MUST include at least id, email, name, status, and `requestedOrganizationId`. Callers MUST be platform ADMIN or hold `members.manage_permissions` for that organization. All other callers MUST receive 403. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Officer lists pending applicants for own org

- **WHEN** a member with `members.manage_permissions` requests the pending-applicant list for their organization
- **THEN** the system returns only `PENDING` users whose `requestedOrganizationId` matches that organization

#### Scenario: Officer cannot list pending applicants for another org

- **WHEN** a member with `members.manage_permissions` in org A requests the pending-applicant list for org B
- **THEN** the system returns 403 Forbidden

#### Scenario: Member without manage permission cannot list

- **WHEN** a member without `members.manage_permissions` requests the pending-applicant list for any organization
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin lists pending applicants for a specific org

- **WHEN** a platform ADMIN requests the pending-applicant list for an organization
- **THEN** the system returns only `PENDING` users whose `requestedOrganizationId` matches that organization

### Requirement: Org-scoped approve and deny for pending applicants

The system MUST expose an API to approve or deny a `PENDING` user scoped to an organization id in the request path. **Approve** (`PENDING` → `ACTIVE`) MUST create a membership linking the user to `user.requestedOrganizationId` when that value equals the path organization id, with zero permission grants, in the same atomic flow as activation. **Deny** (`PENDING` → `INACTIVE`) MUST set status `INACTIVE` without creating membership. Officers (non-ADMIN callers) MUST NOT supply an organization override on approve — membership MUST use the user's `requestedOrganizationId`. Platform ADMIN MUST retain the ability to override organization on approve when supported by the request contract. Callers MUST be platform ADMIN or hold `members.manage_permissions` for the path organization. Attempts on users whose `requestedOrganizationId` does not match the path organization MUST be rejected. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Officer approves pending applicant for own org

- **WHEN** a member with `members.manage_permissions` approves a `PENDING` user whose `requestedOrganizationId` matches the officer's organization
- **THEN** the user's status becomes `ACTIVE`, a membership row links the user to that requested organization with zero permissions, and the user can reach normal app routes on subsequent login

#### Scenario: Officer denies pending applicant for own org

- **WHEN** a member with `members.manage_permissions` denies a `PENDING` user whose `requestedOrganizationId` matches the officer's organization
- **THEN** the user's status becomes `INACTIVE` and no membership is created

#### Scenario: Officer cannot approve applicant for different org

- **WHEN** a member with `members.manage_permissions` in org A attempts to approve or deny a `PENDING` user whose `requestedOrganizationId` is org B via org A's endpoint
- **THEN** the system rejects the request with a client error or 403 and does not change user status

#### Scenario: Officer cannot override organization on approve

- **WHEN** a non-ADMIN member with `members.manage_permissions` attempts to approve a `PENDING` user while supplying a different organization than `requestedOrganizationId`
- **THEN** the system rejects the request and does not create membership

#### Scenario: Admin approves via org-scoped endpoint with override

- **WHEN** a platform ADMIN approves a `PENDING` user through the org-scoped endpoint and supplies an organization override acceptable to the admin contract
- **THEN** the user's status becomes `ACTIVE` and membership is created for the override or requested organization per admin semantics

#### Scenario: Member without manage permission cannot approve or deny

- **WHEN** a member without `members.manage_permissions` calls the org-scoped approve or deny endpoint
- **THEN** the system returns 403 Forbidden

### Requirement: Officer pending-approvals UI at /users

The web app MUST provide a top-level `/users` route (index at `/users/`) reachable only by authenticated `ACTIVE` users who hold `members.manage_permissions` in their membership organization. Non-qualifying users MUST be redirected or shown forbidden without exposing applicant data. The page MUST list `PENDING` applicants for the officer's organization only (via org-scoped API) and MUST provide **approve** and **deny** actions. The UI MUST NOT expose reactivate, deactivate, org override, or applicants for other organizations. Styling MUST use obsidian-glass and AppShell patterns consistent with Phase 2.

#### Scenario: Officer accesses pending approvals page

- **WHEN** an `ACTIVE` member with `members.manage_permissions` navigates to `/users`
- **THEN** the pending-applicant list for their organization loads inside AppShell

#### Scenario: Non-officer blocked from /users

- **WHEN** an `ACTIVE` member without `members.manage_permissions` navigates to `/users`
- **THEN** the app redirects to `/app` or shows forbidden without listing applicants

#### Scenario: Officer approves applicant from UI

- **WHEN** an officer approves a pending applicant from `/users`
- **THEN** the applicant's status becomes `ACTIVE` with membership to the requested org and the list reflects the change

#### Scenario: Officer denies applicant from UI

- **WHEN** an officer denies a pending applicant from `/users`
- **THEN** the applicant's status becomes `INACTIVE` and the list reflects the change

#### Scenario: App nav shows Users link for officers

- **WHEN** an `ACTIVE` member with `members.manage_permissions` uses the normal app shell
- **THEN** a navigation link to `/users` is visible

#### Scenario: App nav hides Users link without permission

- **WHEN** an `ACTIVE` member without `members.manage_permissions` uses the normal app shell
- **THEN** no link to `/users` is shown
