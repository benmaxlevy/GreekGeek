## MODIFIED Requirements

### Requirement: Permission catalog is seeded and listable

The system MUST persist a permission catalog with string id, unique key, description, and timestamps. At minimum the seed MUST include keys `members.manage_permissions`, `events.create`, `events.manage`, `tickets.manage`, `tickets.scan`, and `payments.manage`. The catalog MUST be listable via API for admin operations. Catalog CRUD beyond seed is out of scope this phase.

#### Scenario: Seed populates permission catalog

- **WHEN** the development seed runs
- **THEN** permission rows exist for at least `members.manage_permissions`, `events.create`, `events.manage`, `tickets.manage`, `tickets.scan`, and `payments.manage`

#### Scenario: Admin lists permission catalog

- **WHEN** a platform ADMIN requests the permission catalog
- **THEN** the system returns all seeded permissions including `tickets.manage`, `tickets.scan`, and `payments.manage`

## ADDED Requirements

### Requirement: payments.manage gates Stripe Connect and org payments settings

Seeded catalog key `payments.manage` MUST authorize organization-scoped Stripe Connect operations and org payments settings as defined in `stripe-connect`: starting hosted onboarding, reading Connect status, and return/refresh routes for the target organization. Holding `payments.manage` MUST NOT imply `tickets.manage` or `events.manage`. Holding `tickets.manage` MUST NOT imply `payments.manage`. Platform ADMIN MUST bypass org permission checks for Connect operations. Missing `payments.manage` (and non-ADMIN) MUST result in 403 on guarded Connect endpoints with no onboarding link or CTA in API responses.

#### Scenario: payments.manage allows Connect onboarding

- **WHEN** a member holds `payments.manage` for org O and requests Connect onboarding for org O
- **THEN** the request is allowed

#### Scenario: tickets.manage without payments.manage denied Connect

- **WHEN** a member holds `tickets.manage` but not `payments.manage` and requests Connect onboarding
- **THEN** the system returns 403 Forbidden

#### Scenario: payments.manage without tickets.manage allowed Connect only

- **WHEN** a member holds `payments.manage` but not `tickets.manage` and requests Connect status
- **THEN** the status read succeeds and ticket management endpoints remain forbidden

#### Scenario: Admin bypasses payments.manage check

- **WHEN** platform ADMIN performs a Connect operation without holding `payments.manage` via membership
- **THEN** the operation is allowed

#### Scenario: Member without payments.manage denied Connect

- **WHEN** a member without `payments.manage` attempts any guarded Connect endpoint
- **THEN** the system returns 403 Forbidden
