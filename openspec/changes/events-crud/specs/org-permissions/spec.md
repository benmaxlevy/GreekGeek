## ADDED Requirements

### Requirement: events.create and events.manage gate the events feature

Seeded catalog keys `events.create` and `events.manage` MUST authorize organization-scoped event operations as defined by the `events` capability. Holding `events.create` MUST NOT imply `events.manage`. Platform ADMIN MUST continue to bypass org permission checks for event operations.

#### Scenario: events.create alone allows create not manage

- **WHEN** a member holds `events.create` but not `events.manage`
- **THEN** create succeeds for their org and update/delete are forbidden

#### Scenario: events.manage alone allows manage not create

- **WHEN** a member holds `events.manage` but not `events.create`
- **THEN** update/delete/list of existing events in their org succeed and create is forbidden
