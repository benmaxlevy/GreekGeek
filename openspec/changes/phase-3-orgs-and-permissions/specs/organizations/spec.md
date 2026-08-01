## Purpose

Represents a fraternity or sorority chapter at a specific university, the unit to which users are assigned via membership.

## ADDED Requirements

### Requirement: Organization records are typed and university-bound

The system MUST persist organizations with a string id, name, type enum (`FRATERNITY` or `SORORITY`), universityId foreign key, and timestamps. Organization names MUST be unique within a university (`@@unique([universityId, name])`). Organizations MUST NOT use URL slugs or national-brand hierarchy fields.

#### Scenario: Organization enforces unique name per university

- **WHEN** a create or update would duplicate an organization name at the same university
- **THEN** the system rejects the request with a client error

#### Scenario: Organization requires valid university

- **WHEN** a client creates an organization with a non-existent universityId
- **THEN** the system rejects the request with a client error

### Requirement: Platform admin manages organizations

Only platform ADMIN MAY create, read, update, and delete organizations via the API. List endpoints MUST support filtering by university. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Admin creates organization

- **WHEN** a platform ADMIN submits a valid create-organization request with name, type, and universityId
- **THEN** the organization is persisted and returned

#### Scenario: Admin lists organizations by university

- **WHEN** a platform ADMIN requests organizations filtered by universityId
- **THEN** the system returns matching organizations

#### Scenario: Admin updates organization

- **WHEN** a platform ADMIN submits a valid update for an existing organization
- **THEN** the organization fields are updated and returned

#### Scenario: Admin deletes organization without memberships

- **WHEN** a platform ADMIN deletes an organization that has no memberships
- **THEN** the organization is removed

#### Scenario: Non-admin cannot manage organizations

- **WHEN** a non-ADMIN user calls any organization management endpoint
- **THEN** the system returns 403 Forbidden

#### Scenario: Delete blocked when memberships exist

- **WHEN** a platform ADMIN attempts to delete an organization that has memberships
- **THEN** the system returns 409 Conflict and does not delete the organization
