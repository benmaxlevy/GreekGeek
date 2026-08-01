## MODIFIED Requirements

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
