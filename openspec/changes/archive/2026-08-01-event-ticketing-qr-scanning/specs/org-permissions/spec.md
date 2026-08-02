## MODIFIED Requirements

### Requirement: Permission catalog is seeded and listable

The system MUST persist a permission catalog with string id, unique key, description, and timestamps. At minimum the seed MUST include keys `members.manage_permissions`, `events.create`, `events.manage`, `tickets.manage`, and `tickets.scan`. The catalog MUST be listable via API for admin operations. Catalog CRUD beyond seed is out of scope this phase.

#### Scenario: Seed populates permission catalog

- **WHEN** the development seed runs
- **THEN** permission rows exist for at least `members.manage_permissions`, `events.create`, `events.manage`, `tickets.manage`, and `tickets.scan`

#### Scenario: Admin lists permission catalog

- **WHEN** a platform ADMIN requests the permission catalog
- **THEN** the system returns all seeded permissions including `tickets.manage` and `tickets.scan`

## ADDED Requirements

### Requirement: tickets.scan gates ticket check-in scanning

Seeded catalog key `tickets.scan` MUST authorize check-in scanning for events hosted by the member's organization (`event.organizationId`). Holding `tickets.scan` MUST NOT imply `tickets.manage`, `events.manage`, or `events.create`. Holding `tickets.manage` MUST NOT imply `tickets.scan`. Platform ADMIN MUST bypass org permission checks for check-in. Invited-org members with `tickets.scan` on their own organization MUST receive 403 when scanning tickets for a host-org event they do not host. Missing `tickets.scan` (and non-ADMIN) MUST result in 403 on the check-in endpoint. Grant and revoke of `tickets.scan` MUST use the existing admin permissions UI and membership grant/revoke API.

#### Scenario: Host-org scanner with tickets.scan succeeds

- **WHEN** an ACTIVE member holds `tickets.scan` for the host organization and calls check-in for a paid ticket on that org's hosted event
- **THEN** the check-in is allowed if business rules pass

#### Scenario: tickets.manage without tickets.scan denied check-in

- **WHEN** an ACTIVE member holds `tickets.manage` but not `tickets.scan` for the host organization and calls check-in
- **THEN** the system returns 403 Forbidden

#### Scenario: Invited-org tickets.scan denied on host event

- **WHEN** an ACTIVE member holds `tickets.scan` for org B (not the host) and calls check-in for a ticket on a host-org event
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin bypasses tickets.scan check

- **WHEN** platform ADMIN calls check-in without holding `tickets.scan` via membership
- **THEN** the check-in is allowed if business rules pass

#### Scenario: Admin grants tickets.scan via permissions UI

- **WHEN** a platform ADMIN grants `tickets.scan` to a membership through the existing permissions UI
- **THEN** subsequent host-org check-in authorization succeeds for that member
