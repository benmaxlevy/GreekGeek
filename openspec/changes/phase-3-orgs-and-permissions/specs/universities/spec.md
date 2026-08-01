## Purpose

Represents academic institutions that host fraternity and sorority chapters, providing the top-level geographic anchor for organizations in Rally.

## ADDED Requirements

### Requirement: University records store identity and timestamps

The system MUST persist universities with a string id, name, createdAt, and updatedAt. Universities MUST NOT use URL slugs.

#### Scenario: University has required fields

- **WHEN** a university is created
- **THEN** it is stored with a unique id, non-empty name, and timestamps

### Requirement: Platform admin manages universities

Only platform ADMIN MAY create, read, update, and delete universities via the API. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Admin creates university

- **WHEN** a platform ADMIN submits a valid create-university request
- **THEN** the university is persisted and returned in the response

#### Scenario: Admin lists universities

- **WHEN** a platform ADMIN requests the university list
- **THEN** the system returns all universities

#### Scenario: Admin updates university

- **WHEN** a platform ADMIN submits a valid update for an existing university
- **THEN** the university name is updated and returned

#### Scenario: Admin deletes university without dependents

- **WHEN** a platform ADMIN deletes a university that has no organizations
- **THEN** the university is removed

#### Scenario: Non-admin cannot manage universities

- **WHEN** a non-ADMIN user calls any university management endpoint
- **THEN** the system returns 403 Forbidden

#### Scenario: Delete blocked when organizations exist

- **WHEN** a platform ADMIN attempts to delete a university that has organizations
- **THEN** the system returns 409 Conflict and does not delete the university
