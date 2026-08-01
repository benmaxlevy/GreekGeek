## MODIFIED Requirements

### Requirement: Permission catalog is seeded and listable

The system MUST persist a permission catalog with string id, unique key, description, and timestamps. At minimum the seed MUST include keys `members.manage_permissions`, `events.create`, `events.manage`, and `tickets.manage`. The catalog MUST be listable via API for admin operations. Catalog CRUD beyond seed is out of scope this phase. The system MUST NOT seed `tickets.scan` in this phase.

#### Scenario: Seed populates permission catalog

- **WHEN** the development seed runs
- **THEN** permission rows exist for at least `members.manage_permissions`, `events.create`, `events.manage`, and `tickets.manage`

#### Scenario: Admin lists permission catalog

- **WHEN** a platform ADMIN requests the permission catalog
- **THEN** the system returns all seeded permissions including `tickets.manage`

## ADDED Requirements

### Requirement: tickets.manage gates ticketing operations

Seeded catalog key `tickets.manage` MUST authorize organization-scoped ticket operations as defined by the `ticketing` capability: host-org config and allocation management, and issue/list/void/mark-paid within the rules of that capability. Holding `tickets.manage` MUST NOT imply `events.manage` or `events.create`. Platform ADMIN MUST continue to bypass org permission checks for ticket operations. Missing `tickets.manage` MUST result in 403 on guarded ticket endpoints (except guest self-claim and holder mark-paid own ticket as defined in `ticketing`).

#### Scenario: tickets.manage allows host ticket config

- **WHEN** a member holds `tickets.manage` for the host organization
- **THEN** they may enable ticketing and manage allocations on hosted events

#### Scenario: tickets.manage without events.manage cannot edit event core fields

- **WHEN** a member holds `tickets.manage` but not `events.manage`
- **THEN** they may perform ticket operations per ticketing rules but cannot update unrelated event fields

#### Scenario: Admin bypasses tickets.manage check

- **WHEN** platform ADMIN performs a ticket operation without holding tickets.manage via membership
- **THEN** the operation is allowed

#### Scenario: Member without tickets.manage denied ticket management

- **WHEN** a member without `tickets.manage` attempts a guarded ticket management endpoint
- **THEN** the system returns 403 Forbidden
