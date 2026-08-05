## Context

Existing ticket checkout charges the GreekGeek platform and persists succeeded Purchase rows with `subtotalCents`, `feeCents`, `amountCents`, `netCents`, event identity, and Stripe charge/payment identifiers. Existing Connect state is organization-scoped and webhook-sourced. See proposal.md and the event-payouts delta specs for the behavior contract.

The change crosses Prisma data, event APIs, Stripe Connect transfers, the existing webhook inbox, BullMQ worker scheduling, host permissions, and admin/member UI. `PAYOUT_HOLD_DAYS` is runtime configuration, not payout-row state.

## Goals / Non-Goals

**Goals:**

- Add a durable, sequential EventPayout batch model with immutable released history.
- Compute eligibility and amounts from current database state at sweep/release time.
- Guarantee one transfer under concurrent automatic/manual requests and retries.
- Make event date migration explicit: wipe existing event-dependent data, then enforce non-null startsAt.
- Keep exclusion per Purchase, support clean partial release, and surface post-release exposure without clawback.
- Give host `payments.manage` users read-only financial summaries and give ADMIN operational controls with audit reasons.

**Non-Goals:**

- Refund initiation, dispute evidence, reverse transfers, clawback automation, instant payouts, payout schedule editing, cross-event rollups, or email.

## Decisions

### 1. Model payout batches separately from events and purchases

Create `EventPayout` with `(eventId, batchSeq)` uniqueness, status, amount, release metadata, Stripe transfer identity, attempts, and error state. Add nullable `Purchase.eventPayoutId` and nullable `Purchase.payoutExcludedReason`. Keep hold state on Event as `heldAt` and `heldByUserId`.

This separates current eligibility from historical transfer facts and supports late sales as later batch sequences. An `eligibleAt` column is deliberately omitted because eligibility depends on current `PAYOUT_HOLD_DAYS`, event dates, readiness, holds, and purchase state.

Alternative rejected: storing one payout total on Event. It cannot represent late sales, retries, partial exclusions, or immutable release history.

### 2. Use a two-phase release with database locking and Stripe idempotency

The release service first locks the event/payout scope, queries succeeded non-excluded purchases not attached to released payouts, recomputes the sum of `netCents`, and returns without creating a batch when the sum is zero. It creates or locks the next EventPayout, records a stable per-row idempotency key, calls Stripe Transfer to the host account with eventId, batchSeq, and payoutId metadata, then attaches purchases and marks the payout released in one success transaction. The implementation must ensure the database transaction does not claim purchases until transfer success, while the payout lock plus stable Stripe idempotency key makes retry/concurrent outcomes safe.

The destination is always `event.organization.stripeAccountId`; invited allocation organizations never become destinations. `feeCents` and `amountCents` are never used for transfer amount.

Alternative rejected: transfer first with no durable payout identity. A process crash could create an untracked transfer or duplicate it on retry.

### 3. Treat Stripe readiness as a host-only gate

Extend organization Stripe status synchronization to expose the payout-relevant transfers capability alongside `stripePayoutsEnabled`. Payout eligibility requires bound account, payouts enabled, and transfers capability enabled. Account and capability webhooks remain the source of truth; ADMIN cannot manually set readiness flags.

Alternative rejected: infer transfer readiness from `stripeChargesEnabled` or `stripeDetailsSubmitted`. Those flags do not prove the destination can receive transfers.

### 4. Use runtime date eligibility, fixed scheduler identity

Register one repeatable BullMQ payout sweep under a constant scheduler key. Every sweep reads current `PAYOUT_HOLD_DAYS` and applies `COALESCE(endsAt, startsAt)`. Manual ADMIN release bypasses only this time predicate; all other gates remain active. Event hold columns block auto and manual release until cleared.

Alternative rejected: materializing eligibility timestamps. Changing the environment hold would require row migrations and create stale eligibility.

### 5. Keep money-risk webhooks in the existing inbox

Add idempotent worker handlers for charge disputes/refunds and transfer lifecycle/failure events. Resolve purchases by Stripe charge/payment identity and payouts by transfer id or metadata. Unknown identities complete successfully. A pre-release exclusion updates only that Purchase. A post-release exclusion adds an exposure flag while preserving EventPayout amount and never initiating a reverse transfer.

Alternative rejected: synchronous webhook mutation or a second ingest route. It would duplicate durable inbox behavior and make retries/races harder to reason about.

### 6. Make permissions follow host ownership

Use `payments.manage` on the host organization for payout reads. Platform ADMIN alone performs manual release, hold, clear, and retry; ADMIN bypass remains. Invited organizations retain sales visibility but receive no payout line or host payout control. All manual actions require a non-empty reason and write audit data with actor and timestamp.

Alternative rejected: grant payout access based on allocation ownership. That could expose or route host proceeds to invited organizations.

### 7. Wipe existing event data before enforcing dates

Deploy the migration as an explicit destructive data reset for events and dependent rows, then add non-null `startsAt` and nullable `endsAt`. Do not synthesize dates. Update event API Zod schemas and both member/admin forms in the same rollout so every newly created event satisfies the invariant.

Alternative rejected: nullable backfill. It would leave payout eligibility ambiguous and violate the required-going-forward contract.

## Risks / Trade-offs

- [Stripe transfer succeeds while database commit fails] → Reuse the payout row's stable idempotency key and metadata on retry; reconcile transfer status from webhook/API before retrying, never mint a new key.
- [Concurrent purchase/dispute changes race release] → Lock the payout/event scope, recompute immediately before release, attach only after successful transfer, and make webhook exclusions idempotent.
- [Destructive migration removes local/demo event data] → Require an explicit deployment/migration step, document the wipe, verify dependent-row deletion order, and seed or recreate dates after migration.
- [Stripe readiness events arrive out of order] → Preserve existing timestamp/refetch protections and never regress newer Connect readiness state.
- [Environment hold changes operational expectations] → Display expected payout date as a runtime computation and expose current hold configuration in authorized payout views.
- [A transfer remains pending while webhook delivery is delayed] → Keep transfer identity and attempts on the payout, reconcile transfer lifecycle through inbox retries, and expose non-final state to ADMIN rather than creating another transfer.
- [Large events make a single release query expensive] → Index event/status/payout linkage and purchase exclusion fields, process events in bounded sweep pages, and retain one event-level lock per release.

## Migration Plan

1. Add and validate `PAYOUT_HOLD_DAYS` with default 5 in API and worker configuration.
2. Deploy the destructive event-data migration: delete dependent rows in foreign-key-safe order, delete all events, add non-null `startsAt`, add nullable `endsAt`, and add Event hold columns.
3. Add EventPayout and Purchase payout columns/indexes/constraints.
4. Deploy Connect transfers-capability synchronization, webhook handlers, release service, worker scheduler, and admin/host APIs behind the normal application rollout.
5. Seed or recreate events with startsAt, verify host Connect readiness, then enable the recurring payout scheduler.
6. Validate with dry-run/read-only eligibility reporting before allowing automatic transfers; review blocked and failed queues.

Rollback before any payout transfer: stop scheduler/workers, roll back application code, and restore schema from the deployment backup if needed. After transfers exist, do not roll back by deleting payout rows or reversing funds; preserve payout history, disable automatic release, and remediate through the admin queue. The event wipe is not reversible without the pre-migration backup.
