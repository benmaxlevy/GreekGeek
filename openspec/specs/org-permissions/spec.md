# org-permissions Specification

## Purpose

Provides a seeded catalog of permission keys and direct grants to memberships, enabling org-scoped authorization without role indirection. Platform ADMIN bypasses all org permission checks.

## Requirements

### Requirement: Permission catalog is seeded and listable

The system MUST persist a permission catalog with string id, unique key, description, and timestamps. At minimum the seed MUST include keys `members.manage_permissions`, `events.create`, `events.manage`, `tickets.manage`, `tickets.scan`, and `payments.manage`. The catalog MUST be listable via API for admin operations. Catalog CRUD beyond seed is out of scope this phase.

#### Scenario: Seed populates permission catalog

- **WHEN** the development seed runs
- **THEN** permission rows exist for at least `members.manage_permissions`, `events.create`, `events.manage`, `tickets.manage`, `tickets.scan`, and `payments.manage`

#### Scenario: Admin lists permission catalog

- **WHEN** a platform ADMIN requests the permission catalog
- **THEN** the system returns all seeded permissions including `tickets.manage`, `tickets.scan`, and `payments.manage`

### Requirement: payments.manage gates Stripe Connect and org payments settings

Seeded catalog key `payments.manage` MUST authorize organization-scoped Stripe Connect operations and host event payout visibility as defined in `stripe-connect` and `event-payouts`: starting hosted onboarding, reading Connect status, and reading payout summaries and released history for events hosted by the organization. Manual payout release, hold, clear-hold, and retry operations MUST remain platform ADMIN-only. Holding `payments.manage` MUST NOT imply `tickets.manage` or `events.manage`. Holding `tickets.manage` MUST NOT imply `payments.manage`. Platform ADMIN MUST bypass org permission checks for Connect and payout operations. Missing `payments.manage` (and non-ADMIN) MUST result in 403 on guarded Connect and host payout read endpoints with no onboarding link, payout data, or payout CTA in API responses. Invited-organization members MUST not gain payout controls or a payout line for host events from permissions on their own organization.

#### Scenario: payments.manage allows Connect onboarding

- **WHEN** a member holds `payments.manage` for org O and requests Connect onboarding for org O
- **THEN** the request is allowed

#### Scenario: payments.manage allows host payout visibility

- **WHEN** a member holds `payments.manage` for the host organization of event E
- **THEN** the member can read E's payout summary and released history

#### Scenario: payments.manage does not grant manual payout actions

- **WHEN** a member with `payments.manage` but without platform ADMIN requests a manual payout action
- **THEN** the system returns 403 Forbidden

#### Scenario: Invited-org payments.manage does not control host payout

- **WHEN** a member holds `payments.manage` only for an invited organization on event E
- **THEN** the member cannot operate E's host payout or see a payout line

#### Scenario: tickets.manage without payments.manage denied Connect

- **WHEN** a member holds `tickets.manage` but not `payments.manage` and requests Connect onboarding
- **THEN** the system returns 403 Forbidden

#### Scenario: tickets.manage without payments.manage denied Connect and payout

- **WHEN** a member holds `tickets.manage` but not `payments.manage` and requests Connect or payout operations
- **THEN** the system returns 403 Forbidden

#### Scenario: payments.manage without tickets.manage allowed Connect only

- **WHEN** a member holds `payments.manage` but not `tickets.manage` and requests Connect status
- **THEN** the status read succeeds and ticket management endpoints remain forbidden

#### Scenario: payments.manage without tickets.manage allowed Connect and payout reads only

- **WHEN** a member holds `payments.manage` but not `tickets.manage` and requests Connect status or host payout summary
- **THEN** the read request succeeds while manual payout and ticket management endpoints remain forbidden

#### Scenario: Admin bypasses payments.manage check

- **WHEN** platform ADMIN performs a Connect operation without holding `payments.manage` via membership
- **THEN** the operation is allowed

#### Scenario: Admin bypasses payments.manage check for payouts

- **WHEN** platform ADMIN performs a Connect or payout operation without holding payments.manage via membership
- **THEN** the operation is allowed subject to payout business rules

#### Scenario: Member without payments.manage denied Connect

- **WHEN** a member without `payments.manage` attempts any guarded Connect endpoint
- **THEN** the system returns 403 Forbidden

### Requirement: Member permissions are direct grants with zero default

The system MUST persist member permissions as join rows linking membershipId and permissionId with a composite unique constraint. Assigning membership MUST NOT auto-grant any permission.

#### Scenario: New membership has no permissions

- **WHEN** a user is assigned to an organization
- **THEN** the membership has zero MemberPermission rows until explicitly granted

### Requirement: Authorized actors grant and revoke member permissions

Permission grant and revoke MUST be allowed for platform ADMIN on any membership belonging to an `ACTIVE` user, or for a member who holds `members.manage_permissions` in the same organization as the target membership. Grants MUST NOT be allowed for memberships of non-`ACTIVE` users. All other callers MUST receive 403. Request shapes MUST be validated with shared Zod schemas.

#### Scenario: Admin grants permission to member

- **WHEN** a platform ADMIN grants a catalog permission to a membership
- **THEN** a MemberPermission row is created and subsequent org-scoped checks for that key succeed for that member

#### Scenario: Admin revokes permission from member

- **WHEN** a platform ADMIN revokes a granted permission from a membership
- **THEN** the MemberPermission row is removed

#### Scenario: Delegated manager grants permission in own org

- **WHEN** a member with `members.manage_permissions` grants a permission to another membership in the same organization
- **THEN** the grant succeeds

#### Scenario: Delegated manager cannot grant outside own org

- **WHEN** a member with `members.manage_permissions` in org A attempts to grant a permission on a membership in org B
- **THEN** the system returns 403 Forbidden

#### Scenario: Member without manage permission cannot grant

- **WHEN** a member without `members.manage_permissions` attempts to grant or revoke any permission
- **THEN** the system returns 403 Forbidden

### Requirement: Org-scoped permission guard with admin bypass

Protected org-scoped endpoints MUST verify the caller holds the required permission key for the target organization, unless the caller is platform ADMIN. ADMIN MUST bypass all org permission checks without holding a membership.

#### Scenario: Admin bypasses org permission check

- **WHEN** a platform ADMIN calls an org-scoped endpoint requiring a permission key they do not hold via membership
- **THEN** the request is allowed

#### Scenario: Member with permission succeeds

- **WHEN** a member with the required permission key for the target org calls the guarded endpoint
- **THEN** the request is allowed

#### Scenario: Member without permission denied

- **WHEN** a member without the required permission key calls the guarded endpoint
- **THEN** the system returns 403 Forbidden

#### Scenario: User without membership denied

- **WHEN** a non-ADMIN user with no membership for the target org calls the guarded endpoint
- **THEN** the system returns 403 Forbidden

### Requirement: events.create and events.manage gate the events feature

Seeded catalog keys `events.create` and `events.manage` MUST authorize organization-scoped event operations as defined by the `events` capability. Holding `events.create` MUST NOT imply `events.manage`. Platform ADMIN MUST continue to bypass org permission checks for event operations.

#### Scenario: events.create alone allows create not manage

- **WHEN** a member holds `events.create` but not `events.manage`
- **THEN** create succeeds for their org and update/delete are forbidden

#### Scenario: events.manage alone allows manage not create

- **WHEN** a member holds `events.manage` but not `events.create`
- **THEN** update/delete/list of existing events in their org succeed and create is forbidden

### Requirement: tickets.manage gates ticketing operations

Seeded catalog key `tickets.manage` MUST authorize organization-scoped ticket operations as defined by the `ticketing` capability: host-org config and allocation management, and issue/list/void within the rules of that capability. Mark-paid is ADMIN-only per `ticketing`, not gated by `tickets.manage`. Holding `tickets.manage` MUST NOT imply `events.manage` or `events.create`. Platform ADMIN MUST continue to bypass org permission checks for ticket operations. Missing `tickets.manage` MUST result in 403 on guarded ticket endpoints (except guest self-claim as defined in `ticketing`). Holder checkout at `/app/tickets/$id/pay` is authorized by ticket ownership (`holderUserId`), not by `tickets.manage`.

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

#### Scenario: Holder checkout does not require tickets.manage

- **WHEN** an ACTIVE user who is `holderUserId` calls checkout without `tickets.manage`
- **THEN** checkout is allowed if ticket-payments preconditions pass

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
