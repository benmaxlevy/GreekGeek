## MODIFIED Requirements

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

#### Scenario: tickets.manage without payments.manage denied Connect and payout
- **WHEN** a member holds `tickets.manage` but not `payments.manage` and requests Connect or payout operations
- **THEN** the system returns 403 Forbidden

#### Scenario: payments.manage without tickets.manage allowed Connect and payout reads only
- **WHEN** a member holds `payments.manage` but not `tickets.manage` and requests Connect status or host payout summary
- **THEN** the read request succeeds while manual payout and ticket management endpoints remain forbidden

#### Scenario: Admin bypasses payments.manage check
- **WHEN** platform ADMIN performs a Connect or payout operation without holding payments.manage via membership
- **THEN** the operation is allowed subject to payout business rules

#### Scenario: Member without payments.manage denied Connect and payout
- **WHEN** a member without payments.manage attempts any guarded Connect or payout endpoint
- **THEN** the system returns 403 Forbidden
