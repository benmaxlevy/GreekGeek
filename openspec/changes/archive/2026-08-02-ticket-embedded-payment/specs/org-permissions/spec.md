## MODIFIED Requirements

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
