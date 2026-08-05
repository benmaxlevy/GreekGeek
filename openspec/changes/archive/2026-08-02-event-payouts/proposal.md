## Why

GreekGeek currently collects ticket payments but has no controlled path to transfer eligible event proceeds to the host organization. Event dates, payout holds, Stripe transfer readiness, disputes, and repeatable release operations must be defined together now so GreekGeek can release net proceeds exactly once while retaining its fee.

## What Changes

- Add event payout batches that compute eligible succeeded purchase `netCents`, transfer only that sum to the host organization, and retain `feeCents`.
- Add required event start dates, optional end dates, date validation, and event-date-based hold eligibility.
- Add configurable `PAYOUT_HOLD_DAYS` eligibility, event holds, automatic BullMQ sweeps, manual admin release/hold/retry, locking, idempotency, and audit records.
- Add per-purchase payout attachment and exclusion reasons for disputes, refunds, and voids; preserve released batch history and flag post-release exposure without clawback.
- Require host Connect payout readiness and transfer capability; show host payout summaries, excluded amounts, statuses, and admin operational queues.
- Extend Stripe webhook processing for purchase exclusions and transfer/payout status updates.

## Capabilities

### New Capabilities

- `event-payouts`: Compute, hold, release, retry, audit, and display event payout batches and purchase eligibility.

### Modified Capabilities

- `events`: Require `startsAt`, support nullable `endsAt`, validate date ordering, and persist event hold metadata.
- `ticket-payments`: Persist payout linkage and per-purchase exclusion reasons; expose purchase dispute/refund/void effects to payout eligibility.
- `stripe-connect`: Require host payout readiness and transfers capability for payout destinations.
- `job-queue`: Schedule a fixed-key recurring payout eligibility and release sweep with bounded retry behavior.
- `webhook-inbox`: Handle Stripe dispute, refund, and transfer lifecycle events idempotently through the existing inbox worker.
- `admin-dashboard`: Add payout queue, per-event payout summary, holds, release, retry, and audit reason surfaces.
- `org-permissions`: Apply `payments.manage` to host payout visibility while preserving ADMIN-only payout operations and ADMIN bypass.

## Impact

- Prisma schema and migration for Event dates/holds, EventPayout, Purchase payout fields, and audit records.
- API DTOs, Zod request/query/response validation, authorization, transactional release services, Stripe transfer integration, and webhook handlers.
- BullMQ queue registration, fixed repeatable scheduling, worker processors, locks, idempotency, and failure inspection.
- Event create/edit forms, host event payout summaries, admin payout queue/actions, and permission-gated navigation.
- Stripe Connect v2 account capability/readiness synchronization and `.env.example` payout hold configuration.
