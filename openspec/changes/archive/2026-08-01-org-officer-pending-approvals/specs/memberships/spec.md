## MODIFIED Requirements

### Requirement: Platform admin assigns and removes memberships

Only platform ADMIN MAY assign a user to an organization (create membership) and remove membership via the admin membership API. Members with `members.manage_permissions` in an organization MAY create membership for a `PENDING` user only through the org-scoped pending-approval approve flow, and only for that user's `requestedOrganizationId` when it equals the officer's organization. Request and response shapes MUST be validated with shared Zod schemas. New memberships MUST start with zero permission grants. Membership assignment during pending-user approve flow MUST create the membership atomically with activation, defaulting to the user's `requestedOrganizationId` unless the admin supplies an override organization.

#### Scenario: Admin assigns user to organization

- **WHEN** a platform ADMIN assigns a user without an existing membership to an organization
- **THEN** a membership row is created linking the user to that organization with no permissions granted

#### Scenario: Admin assigns membership during pending approve and activate

- **WHEN** a platform ADMIN approves a `PENDING` user by assigning organization membership (requested org or admin override)
- **THEN** a membership row is created with zero permissions and the user's status becomes `ACTIVE` in the same flow

#### Scenario: Officer assigns membership during delegated pending approve

- **WHEN** a member with `members.manage_permissions` approves a `PENDING` user whose `requestedOrganizationId` matches their organization
- **THEN** a membership row is created linking the user to that requested organization with zero permissions and the user's status becomes `ACTIVE` in the same flow

#### Scenario: Officer cannot assign membership outside approve flow

- **WHEN** a member with `members.manage_permissions` attempts to assign or remove membership via the admin membership API
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin removes membership

- **WHEN** a platform ADMIN removes a user's membership
- **THEN** the membership and its permission grants are deleted

#### Scenario: Non-admin cannot assign membership via admin API

- **WHEN** a non-ADMIN user without delegated approve context calls admin membership assign or remove endpoints
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin user cannot receive membership

- **WHEN** a platform ADMIN attempts to assign membership to another ADMIN user
- **THEN** the system rejects the request with a client error
