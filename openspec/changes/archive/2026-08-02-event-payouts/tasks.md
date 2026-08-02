## 1. Schema and configuration foundation

- [x] 1.1 Add Zod-validated `PAYOUT_HOLD_DAYS` with default 5 to API and worker configuration, and document it in `.env.example`.
- [x] 1.2 Add Event `startsAt` NOT NULL, nullable `endsAt`, nullable `heldAt`, and nullable `heldByUserId`; add date indexes needed by payout eligibility.
- [x] 1.3 Create the destructive migration that deletes all events and dependent rows in foreign-key-safe order before enforcing non-null startsAt; verify no nullable or synthetic date backfill exists.
- [x] 1.4 Add EventPayout with id, eventId, batchSeq, amountCents, status, release metadata, transfer identity, attempts, lastError, timestamps, unique `(eventId, batchSeq)`, and unique nullable `stripeTransferId`.
- [x] 1.5 Add nullable Purchase `eventPayoutId` foreign key and nullable `payoutExcludedReason` enum, with indexes and referential actions.
- [x] 1.6 Add audit persistence for payout hold, clear, release, and retry actions with actor, timestamp, action, and required reason.

## 2. Event date and hold contracts

- [x] 2.1 Update event create/edit DTOs and Zod request/response schemas to require startsAt, accept nullable endsAt, and reject endsAt earlier than startsAt.
- [x] 2.2 Update member and ADMIN event create/edit forms to collect dates, display validation errors, and show hold state where authorized.
- [x] 2.3 Add event hold and clear-hold API contracts with Zod validation, ADMIN authorization, and audited reasons.
- [x] 2.4 Add date migration and event API/UI tests covering required startsAt, nullable endsAt, endsAt >= startsAt, and dependent-row wipe.

## 3. Connect payout readiness

- [x] 3.1 Extend organization Stripe status types, persistence mapping, and Zod response schemas with transfers capability readiness.
- [x] 3.2 Synchronize transfers capability from Accounts v2 account/capability webhooks without allowing client or ADMIN writes.
- [x] 3.3 Implement host payout readiness evaluation requiring stripeAccountId, stripePayoutsEnabled, and transfers capability; return a distinct blocked reason for each missing condition.
- [x] 3.4 Add Connect readiness tests for ready host, missing account, payouts disabled, transfers disabled, stale webhook state, and invited-org readiness not gating host payout.

## 4. Eligibility and release domain

- [x] 4.1 Implement query-time eligibility using `COALESCE(endsAt, startsAt) + PAYOUT_HOLD_DAYS`, event hold state, host readiness, succeeded status, exclusion state, and unreleased payout linkage.
- [x] 4.2 Implement net-only batch amount calculation across host, invited-org, and public-pool allocations; exclude feeCents and amountCents; return no batch for zero eligible net.
- [x] 4.3 Implement locked batch creation/reuse with sequential batchSeq, stable per-payout Stripe idempotency key, and metadata eventId, batchSeq, and payoutId.
- [x] 4.4 Implement release recomputation under lock and attach eligible purchases to eventPayoutId only in the successful release path.
- [x] 4.5 Enforce host-only transfer destination from event.organization.stripeAccountId and preserve released amount/history after later purchase changes.
- [x] 4.6 Implement failed status, attempts, concise lastError, bounded retry state, and admin-visible failure details.
- [x] 4.7 Add release domain tests for date filter preferring endsAt then startsAt, current env hold, env hold changes without migration, all sale sources, fee exclusion, zero eligible, partial exclusion, and multi-ticket whole-purchase exclusion.

## 5. Automatic sweep and concurrency

- [x] 5.1 Add a typed BullMQ payout queue and recurring scheduler using one fixed scheduler key across replicas.
- [x] 5.2 Implement worker sweep pagination, current environment eligibility, idempotent release invocation, bounded retries, and PII-safe failure logging.
- [x] 5.3 Verify concurrent sweep and manual release produce exactly one EventPayout and one Stripe transfer through locking, uniqueness, and Stripe idempotency.
- [x] 5.4 Add sweep tests for once-only rerun, late sale creating batchSeq + 1, fixed scheduler deduplication, and failed retry visibility.

## 6. Dispute, refund, void, and transfer webhooks

- [x] 6.1 Add idempotent inbox handlers for charge.dispute.created and charge.refunded that resolve Stripe charge to Purchase and set per-purchase exclusion reason.
- [x] 6.2 Ensure pre-release exclusions remove only that Purchase from pending amount while clean purchases still release.
- [x] 6.3 Add transfer.created, transfer.failed, and relevant payout failure handlers that resolve payout by transfer id or metadata and update status/error idempotently.
- [x] 6.4 Add post-release dispute exposure flagging without rewriting EventPayout.amountCents, reverse_transfer, or automatic clawback.
- [x] 6.5 Make unknown charge/transfer events complete without retry storms and ensure all handlers run through existing inbox plus worker.
- [x] 6.6 Add webhook tests for dispute, refund, transfer success/failure, replay idempotency, post-release exposure, unchanged historical amount, and no automatic clawback.

## 7. Permissions, APIs, and audit surfaces

- [x] 7.1 Gate host payout reads with host-organization payments.manage, keep release/hold/clear/retry ADMIN-only, preserve ADMIN bypass, and deny invited-org payout control.
- [x] 7.2 Add validated payout summary, queue, release, hold, clear, retry, and audit API contracts; parse outbound/inbound HTTP payloads with Zod at boundaries.
- [x] 7.3 Add computed expected payout date from event date and current PAYOUT_HOLD_DAYS; never persist it as an EventPayout column.
- [x] 7.4 Add API tests for host read authorization, invited-org denial, non-admin action denial, ADMIN early release skipping only time gate, held-event skip/clear, retry, required reasons, and audit actor/timestamp data.

## 8. Host and admin UI

- [x] 8.1 Add host event payout summary showing gross amountCents, Rally fee feeCents, net netCents, released, pending, excluded totals, computed expected date, and released history.
- [x] 8.2 Add excluded purchase count, amount, and disputed/refunded/voided reason display plus post-release exposure flag.
- [x] 8.3 Add ADMIN payout queue for eligible now, pending, held, blocked, failed, and post-release dispute states with visible reasons.
- [x] 8.4 Add ADMIN release, hold, clear hold, and retry actions requiring reason and showing audit result.
- [x] 8.5 Ensure invited-org views expose sales visibility only, with no payout line; hide all payout controls/data from unauthorized users.
- [x] 8.6 Add UI tests for host summary, admin queue states/actions, expected-date recomputation, excluded reasons, historical released amount, permissions, and non-admin blocking.

## 9. End-to-end verification and demo

- [x] 9.1 Run end-to-end flow: host, invited, and public sales; event ends; hold or ADMIN early release; one host transfer of net only; Rally fee retained.
- [x] 9.2 Demonstrate one disputed purchase excluded while remaining purchases release, including multi-ticket whole-purchase behavior.
- [x] 9.3 Demonstrate late sale producing a second batchSeq and transfer eligibility.
- [x] 9.4 Demonstrate post-release dispute flagged for later clawback with historical amount unchanged and no automatic reverse transfer.
- [x] 9.5 Demonstrate job rerun creates no duplicate EventPayout or Stripe transfer.
- [x] 9.6 Run `openspec validate event-payouts --strict` and record all artifacts ready for implementation.
