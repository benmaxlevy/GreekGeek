## MODIFIED Requirements

### Requirement: Platform admin manages organizations

Only platform ADMIN MAY create, update, and delete organizations via the API. Admin list endpoints MUST support filtering by university. Request and response shapes MUST be validated with shared Zod schemas. Deleting an organization that has memberships OR events MUST return 409 Conflict and MUST NOT delete the organization.

#### Scenario: Admin creates organization

- **WHEN** a platform ADMIN submits a valid create-organization request with name, type, and universityId
- **THEN** the organization is persisted and returned

#### Scenario: Admin lists organizations by university

- **WHEN** a platform ADMIN lists organizations with a universityId filter
- **THEN** only organizations for that university are returned

#### Scenario: Admin updates organization

- **WHEN** a platform ADMIN updates an organization's name or type
- **THEN** the organization fields are updated and returned

#### Scenario: Admin deletes organization without memberships or events

- **WHEN** a platform ADMIN deletes an organization that has no memberships and no events
- **THEN** the organization is removed

#### Scenario: Non-admin cannot mutate organizations

- **WHEN** a non-ADMIN user calls any organization create, update, or delete endpoint
- **THEN** the system returns 403 Forbidden

#### Scenario: Delete blocked when memberships exist

- **WHEN** a platform ADMIN attempts to delete an organization that has memberships
- **THEN** the system returns 409 Conflict and does not delete the organization

#### Scenario: Delete blocked when events exist

- **WHEN** a platform ADMIN attempts to delete an organization that has events
- **THEN** the system returns 409 Conflict and does not delete the organization
