## ADDED Requirements

### Requirement: Admin operates event payout queue

The admin dashboard MUST provide an event payout operations view for ACTIVE platform ADMIN users. The view MUST distinguish eligible now, pending, held, blocked, failed, and post-release dispute exposure states, including blocked and failure reasons. ADMIN MUST be able to release an eligible event early, hold an event, clear a hold, and retry a failed transfer. Every action MUST require and display a visible reason, actor, and timestamp. Non-admin users MUST be blocked from payout routes and controls.

#### Scenario: Admin sees payout queue states
- **WHEN** an ACTIVE platform ADMIN opens the payout operations view
- **THEN** events are listed with eligible-now, pending, held, blocked, failed, and post-release dispute states and reasons

#### Scenario: Admin releases early
- **WHEN** ADMIN submits an early release with a reason for an otherwise eligible positive-net event
- **THEN** one manual payout release is attempted, the actor and reason are shown, and time gate is the only skipped rule

#### Scenario: Admin holds and clears event
- **WHEN** ADMIN holds an event and later clears the hold with reasons
- **THEN** the queue shows held state while held, then returns event to computed eligibility after clear

#### Scenario: Admin retries failed transfer
- **WHEN** ADMIN retries a failed payout with a reason
- **THEN** the existing payout retry is queued without creating a second transfer, and updated attempts/error state is shown

#### Scenario: Non-admin cannot operate payouts
- **WHEN** a non-ADMIN user navigates to payout operations or calls its actions
- **THEN** the route or API returns forbidden without exposing payout controls

### Requirement: Admin sees event payout financial summary

The admin dashboard MUST show per-event gross (`amountCents` sum), GreekGeek fees (`feeCents` sum), net (`netCents` sum), released, pending, and excluded totals. It MUST show excluded purchase count, amount, and reason, host Connect readiness, payout batch sequence/status, transfer identity when present, and post-release dispute exposure. Historical released EventPayout amounts MUST remain displayed unchanged.

#### Scenario: Admin reviews partial exclusion
- **WHEN** an event has one excluded purchase and other clean purchases
- **THEN** the summary shows excluded count, amount, reason, and remaining net available for release

#### Scenario: Admin reviews released history
- **WHEN** an event has a released payout and later receives a disputed purchase
- **THEN** the summary preserves released amount and displays an exposure flag for follow-up
