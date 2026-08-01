# memberships Specification

## Purpose

Links exactly one user to exactly one organization, establishing org context for permission checks. Platform ADMIN does not hold a membership.

## Requirements

### Requirement: Membership enforces one organization per user

The system MUST persist memberships with a string id, userId (unique), organizationId, and timestamps. Each user MUST have at most one membership. Platform ADMIN users MUST NOT have membership rows.

#### Scenario: User can belong to only one organization

- **WHEN** a membership assign is attempted for a user who already has a membership
- **THEN** the system rejects the request or atomically replaces the existing membership per API contract, and never stores two memberships for the same user

#### Scenario: Membership references valid user and organization

- **WHEN** a client assigns membership with invalid userId or organizationId
- **THEN** the system rejects the request with a client error

### Requirement: Platform admin assigns and removes memberships

Only platform ADMIN MAY assign a user to an organization (create membership) and remove membership via the API. Request and response shapes MUST be validated with shared Zod schemas. New memberships MUST start with zero permission grants. Membership assignment during pending-user approve flow MUST create the membership atomically with activation, defaulting to the user's `requestedOrganizationId` unless the admin supplies an override organization.

#### Scenario: Admin assigns user to organization

- **WHEN** a platform ADMIN assigns a user without an existing membership to an organization
- **THEN** a membership row is created linking the user to that organization with no permissions granted

#### Scenario: Admin assigns membership during pending approve and activate

- **WHEN** a platform ADMIN approves a `PENDING` user by assigning organization membership (requested org or admin override)
- **THEN** a membership row is created with zero permissions and the user's status becomes `ACTIVE` in the same flow

#### Scenario: Admin removes membership

- **WHEN** a platform ADMIN removes a user's membership
- **THEN** the membership and its permission grants are deleted

#### Scenario: Non-admin cannot assign membership

- **WHEN** a non-ADMIN user calls membership assign or remove endpoints
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin user cannot receive membership

- **WHEN** a platform ADMIN attempts to assign membership to another ADMIN user
- **THEN** the system rejects the request with a client error
