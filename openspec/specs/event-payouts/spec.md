# event-payouts Specification

## Purpose

Event payouts release eligible ticket-sale net proceeds to the host organization through Stripe Connect after the configured hold, while preserving Rally fees and auditable batch history.

## Requirements

### Requirement: Event payout batches persist immutable release identity

The system MUST persist `EventPayout` rows with `id`, `eventId`, `batchSeq`, `amountCents`, status `pending` | `released` | `failed` | `blocked`, optional `releasedAt`, optional `releaseMode` `auto` | `manual`, optional `releasedByUserId`, optional unique `stripeTransferId`, `attempts`, optional `lastError`, and timestamps. The system MUST enforce unique `(eventId, batchSeq)`. Hold state MUST live on Event via `heldAt` and `heldByUserId`; EventPayout MUST NOT require hold columns. EventPayout MUST NOT persist `eligibleAt`.

#### Scenario: New event payout batch has unique sequence
- **WHEN** eligible purchases exist for an event with no unreleased batch for its next sequence
- **THEN** the system creates one `pending` EventPayout with the next `batchSeq` and rejects any duplicate `(eventId, batchSeq)`

#### Scenario: Released batch identity remains stable
- **WHEN** an EventPayout reaches `released`
- **THEN** its `amountCents`, `batchSeq`, `stripeTransferId`, release mode, actor, and release timestamp remain historical facts and are not rewritten by later purchase events

### Requirement: Eligibility is computed from current event dates and environment

At query or sweep time, an event MUST be eligible for automatic release only when `COALESCE(endsAt, startsAt) + PAYOUT_HOLD_DAYS` days is at or before now, the event is not held, its date is usable, the host organization has `stripePayoutsEnabled` and the Stripe transfers capability, and at least one succeeded Purchase is not excluded and is not attached to a released EventPayout. `PAYOUT_HOLD_DAYS` MUST default to 5, MUST NOT be stored on EventPayout rows, and changing it MUST affect the next eligibility query immediately. An event's expected payout date MUST be computed from its event date and current environment value.

#### Scenario: End date controls hold
- **WHEN** an event has `endsAt` and `endsAt` plus current `PAYOUT_HOLD_DAYS` is not yet reached
- **THEN** automatic eligibility is false even when `startsAt` plus the hold has passed

#### Scenario: Start date is fallback
- **WHEN** an event has no `endsAt` and `startsAt` plus current `PAYOUT_HOLD_DAYS` has passed
- **THEN** automatic eligibility can proceed if all other rules pass

#### Scenario: Environment hold change moves eligibility
- **WHEN** an administrator changes `PAYOUT_HOLD_DAYS`
- **THEN** the next eligibility query uses the new value without migrating or rewriting existing EventPayout rows

#### Scenario: Held or unusable event is excluded
- **WHEN** an event is held or lacks a usable event date
- **THEN** automatic sweep skips it and exposes the hold or blocked reason to authorized administration

### Requirement: Batch amount uses eligible purchase net proceeds only

The batch amount MUST equal the sum of `netCents` for all eligible succeeded Purchases on the event, including purchases allocated to the host organization, invited organizations, and public pool. The amount MUST exclude every `feeCents` and MUST NOT use full `amountCents`. A zero eligible sum MUST produce no transfer and no empty EventPayout. A purchase exclusion MUST exclude the whole Purchase, including every ticket in a multi-ticket purchase.

#### Scenario: Batch includes all sale sources and excludes fees
- **WHEN** host, invited-organization, and public-pool purchases have succeeded
- **THEN** one batch sums their `netCents` and transfers none of their `feeCents` or `amountCents`

#### Scenario: Zero eligible proceeds create nothing
- **WHEN** an event has no eligible succeeded purchases or all succeeded purchases are excluded
- **THEN** the sweep creates no EventPayout and calls Stripe zero times

#### Scenario: Multi-ticket purchase is atomic for payout exclusion
- **WHEN** one multi-ticket Purchase is disputed, refunded, or voided before release
- **THEN** the whole Purchase is excluded rather than partially included by ticket

### Requirement: Release recomputes under lock and transfers exactly once

Before release, the system MUST lock the event payout scope, recompute eligible purchases and `amountCents`, and attach those purchases to the payout in the same successful database transaction. The Stripe transfer destination MUST be the host-only `event.organization.stripeAccountId`. Transfer metadata MUST include `eventId`, `batchSeq`, and `payoutId`. Each EventPayout MUST use its own stable Stripe idempotency key. Concurrent automatic and manual release attempts MUST result in at most one Stripe transfer through database uniqueness, locking, and idempotency. Purchases arriving after release MUST remain available for the next `batchSeq`.

#### Scenario: Concurrent release makes one transfer
- **WHEN** automatic sweep and manual release target the same eligible event simultaneously
- **THEN** exactly one EventPayout and one Stripe transfer are created, and the losing request observes the existing result

#### Scenario: Late sale creates next batch
- **WHEN** a succeeded Purchase arrives after a prior EventPayout is released
- **THEN** the purchase is assigned to a later batch with `batchSeq` increased by one

#### Scenario: Transfer targets host only
- **WHEN** an event has sales allocated to multiple organizations
- **THEN** Stripe receives one transfer to `event.organization.stripeAccountId`, never an invited organization's account

### Requirement: Automatic sweep is fixed-key and retry-safe

The system MUST run a repeatable BullMQ payout sweep with one fixed scheduler key shared across replicas. The sweep MUST find eligible events, create or lock a payout, release it, and retry bounded failures without creating a second transfer. A transfer failure MUST mark the EventPayout `failed`, increment `attempts`, store a concise `lastError`, and expose it to administrators. Re-running a successful sweep MUST be a no-op.

#### Scenario: Sweep releases eligible event
- **WHEN** the repeatable payout sweep runs with an eligible event
- **THEN** it creates or resumes one payout and transfers the recomputed net amount to the host

#### Scenario: Failed transfer is visible and retryable
- **WHEN** Stripe rejects a transfer
- **THEN** the payout becomes `failed` with bounded retry state and an administrator can retry it without changing released history

#### Scenario: Sweep rerun creates nothing new
- **WHEN** the same sweep runs after a payout is released
- **THEN** no second EventPayout and no second Stripe transfer are created

### Requirement: Administrators can release, hold, clear, and retry with audit

An authorized platform ADMIN MUST be able to release an event before its time gate, hold an event, clear its hold, and retry a failed payout. Manual early release MUST skip only the time gate; all other eligibility, readiness, non-empty amount, lock, and idempotency rules remain required. Manual releases MUST set `releaseMode` to `manual` and `releasedByUserId`. Hold, clear, release, and retry actions MUST record actor, timestamp, and visible reason. A held event MUST be skipped by automatic sweep until cleared.

#### Scenario: Admin early release skips only time gate
- **WHEN** ADMIN manually releases an event before the hold period ends
- **THEN** release proceeds only if readiness, non-held state, and eligible positive net proceeds pass, with manual actor and reason recorded

#### Scenario: Held event becomes releasable after clear
- **WHEN** ADMIN holds an event, runs a sweep, then clears the hold
- **THEN** the held sweep does nothing and the next eligible sweep can release the payout

#### Scenario: Manual actions are auditable
- **WHEN** ADMIN performs hold, clear, release, or retry
- **THEN** audit data contains the actor, timestamp, action, and required reason

### Requirement: Purchase exclusions support pre-release partial loss and post-release exposure

When a succeeded Purchase is disputed, refunded, or voided before release, the system MUST set its `payoutExcludedReason` and remove its `netCents` from the pending batch while allowing other clean purchases to release. When the Purchase is already attached to a released EventPayout, the system MUST retain the released amount unchanged, mark the Purchase excluded for future batches, and surface an exposure flag against that released payout. This phase MUST NOT automatically call `reverse_transfer` or otherwise claw back funds.

#### Scenario: Partial dispute pays clean purchases
- **WHEN** Purchase A is excluded before release while Purchases B and C remain clean
- **THEN** the payout transfers only B plus C `netCents`, and the event summary shows A's excluded count, amount, and reason

#### Scenario: Post-release dispute preserves history
- **WHEN** a Purchase attached to a released payout becomes disputed
- **THEN** the released EventPayout amount is unchanged, the payout is flagged for admin follow-up, and no automatic clawback occurs

### Requirement: Authorized hosts see payout state and reasons

An ACTIVE host-organization member with `payments.manage` MUST be able to view pending net proceeds, computed expected payout date, released history, and per-event gross, Rally fee, net, released, pending, and excluded totals. Invited organizations MUST see sales visibility without a payout line. Excluded purchase counts, amounts, and reasons, blocked reasons, held reasons, failed errors, and post-release exposure flags MUST be visible where applicable. Non-authorized members MUST receive no payout controls or payout data.

#### Scenario: Host sees computed summary
- **WHEN** a host member with `payments.manage` opens an event payout summary
- **THEN** the UI shows gross from `amountCents`, Rally fees from `feeCents`, net from `netCents`, pending/released/excluded totals, and expected date computed from current hold configuration

#### Scenario: Invited organization sees no payout line
- **WHEN** an invited-organization member views event sales
- **THEN** they can see permitted sales visibility but no host payout destination or payout amount line

#### Scenario: Exclusion reason is visible
- **WHEN** a purchase is excluded
- **THEN** authorized payout summary shows excluded count, excluded amount, and `disputed`, `refunded`, or `voided` reason
