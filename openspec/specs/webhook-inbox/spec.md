# webhook-inbox Specification

## Purpose

Durable generic webhook inbox for external providers: verify and persist inbound events idempotently, process them asynchronously with retries, and expose ADMIN operations for unprocessed and failed events.

## Requirements

### Requirement: WebhookEvent persistence model

The system MUST persist webhook events with: `id`, `service` (text), `externalId`, `type`, `payload` (JSON), `receivedAt`, optional `processedAt`, `attempts` (default 0), and optional `lastError`. There MUST be a unique constraint on `(service, externalId)`. There MUST be an index on `processedAt` to support unprocessed sweeps.

#### Scenario: First event persisted

- **WHEN** a new webhook for service `stripe` with externalId `evt_123` is ingested
- **THEN** a `WebhookEvent` row is created with `processedAt` null and `attempts` 0

#### Scenario: Duplicate external id rejected at storage layer

- **WHEN** a second ingest arrives for the same `(service, externalId)` as an existing row
- **THEN** no duplicate row is created

### Requirement: Stripe webhook verifies signature on raw body

The Stripe webhook HTTP route MUST verify the provider signature against the raw request body using `STRIPE_WEBHOOK_SECRET`. `STRIPE_WEBHOOK_SECRET` MUST be required at API boot via Zod env validation. An invalid signature MUST return HTTP 400 and MUST NOT persist any event.

#### Scenario: Valid Stripe signature

- **WHEN** Stripe sends a webhook with a valid signature and `STRIPE_WEBHOOK_SECRET` is configured
- **THEN** the event proceeds to persistence and enqueue

#### Scenario: Invalid Stripe signature

- **WHEN** a request arrives with an invalid or missing Stripe signature
- **THEN** the system returns HTTP 400 and does not insert a `WebhookEvent` row

#### Scenario: API fails fast without STRIPE_WEBHOOK_SECRET

- **WHEN** the API boots without a valid `STRIPE_WEBHOOK_SECRET`
- **THEN** startup fails with a clear configuration error

### Requirement: Stripe ingest is idempotent and acknowledges quickly

After signature verification, the system MUST insert the event and enqueue an async processing job, then return HTTP 200 immediately. If `(service, externalId)` already exists, the system MUST return HTTP 200 without re-enqueueing or reprocessing.

#### Scenario: New Stripe event ingested

- **WHEN** a verified Stripe event with a new `externalId` is received
- **THEN** the event row is inserted, a processing job is enqueued, and HTTP 200 is returned before processing completes

#### Scenario: Duplicate Stripe event replayed

- **WHEN** a verified Stripe event with an `externalId` that already exists is received
- **THEN** the system returns HTTP 200 without inserting a duplicate row or enqueueing a new processing job

### Requirement: Webhook processing is async with retries and idempotency

The worker MUST process jobs by `WebhookEvent` row id. On success, `processedAt` MUST be set. On failure, `attempts` MUST increment, `lastError` MUST store a concise error message, and the job MUST be retried per BullMQ default options. Reprocessing an event that already has `processedAt` set MUST be a no-op (idempotent).

#### Scenario: Successful processing marks event processed

- **WHEN** the worker processes an unprocessed `WebhookEvent` and the handler succeeds
- **THEN** `processedAt` is set and the event is considered processed

#### Scenario: Handler failure retries and records error

- **WHEN** the worker handler throws for an unprocessed event
- **THEN** `attempts` increments, `lastError` is stored, and BullMQ schedules a retry

#### Scenario: Reprocessing already-processed event is no-op

- **WHEN** a processing job runs for an event with `processedAt` already set
- **THEN** the handler does not mutate business state and completes without error

### Requirement: Unknown event types are stored and marked processed without error noise

For ingested events whose `type` has no registered business handler, the system MUST persist the event and mark it processed without surfacing handler errors or retry storms.

#### Scenario: Unknown Stripe event type

- **WHEN** a verified Stripe event with an unrecognized `type` is processed
- **THEN** the event is marked processed and no handler error is raised

### Requirement: ADMIN can list and re-enqueue webhook events

ADMIN-only endpoints MUST list webhook events filterable by unprocessed and/or failed status. ADMIN MUST be able to manually re-enqueue processing for a failed event. Request and response shapes MUST be validated with shared Zod contracts.

#### Scenario: Admin lists unprocessed events

- **WHEN** an ACTIVE platform ADMIN requests unprocessed webhook events
- **THEN** the response lists events where `processedAt` is null

#### Scenario: Admin lists failed events

- **WHEN** an ACTIVE platform ADMIN requests failed webhook events
- **THEN** the response lists events that exhausted retries or have `lastError` per the API's failed filter definition

#### Scenario: Admin re-enqueues failed event

- **WHEN** an ACTIVE platform ADMIN re-enqueues a failed event by id
- **THEN** a new processing job is enqueued for that event row

#### Scenario: Non-admin blocked from webhook admin API

- **WHEN** a non-ADMIN user calls webhook admin list or re-enqueue endpoints
- **THEN** the system returns 403 Forbidden

### Requirement: Stripe worker handles payment_intent lifecycle events

The existing webhook inbox worker MUST register business handlers for Stripe `payment_intent.succeeded`, `payment_intent.payment_failed`, and `payment_intent.canceled` event types. Handlers MUST resolve the ticket via PaymentIntent metadata `ticketId` and/or `TicketPayment.stripePaymentIntentId`. Handler behavior MUST follow `ticket-payments` requirements for paid transition, failure recording, idempotency, and void-ticket mismatch handling. Handlers MUST NOT create a new HTTP ingest route. Unknown PaymentIntent (no matching TicketPayment or ticket) MUST log and complete without retry storm.

#### Scenario: payment_intent.succeeded processed via inbox

- **WHEN** a verified `payment_intent.succeeded` event is enqueued and processed
- **THEN** the ticket-payments paid transition runs per spec and the WebhookEvent is marked processed

#### Scenario: payment_intent.payment_failed updates TicketPayment

- **WHEN** a verified `payment_intent.payment_failed` event is processed for a known ticket payment
- **THEN** TicketPayment status becomes `failed` and ticket remains unpaid

#### Scenario: Unknown PaymentIntent no-op

- **WHEN** a payment_intent event references a PaymentIntent with no TicketPayment row
- **THEN** the handler logs and completes without error retry storm

### Requirement: Stripe payout and purchase-risk events update payout state through inbox

The existing verified Stripe webhook inbox and worker MUST register idempotent handlers for `charge.dispute.created`, `charge.refunded`, `transfer.created`, `transfer.failed`, and relevant Stripe payout failure events. Charge handlers MUST resolve the Purchase by Stripe charge or payment metadata, set its `payoutExcludedReason` (`disputed` or `refunded`), and flag exposure when that Purchase is attached to a released EventPayout. Transfer handlers MUST resolve the payout by transfer id or metadata and update its status and error state without rewriting a released amount. Unknown charge or transfer identifiers MUST complete without retry storms. No parallel webhook ingest route is allowed.

#### Scenario: Dispute excludes purchase before release
- **WHEN** the worker processes charge.dispute.created for a succeeded Purchase not attached to a released payout
- **THEN** the Purchase is marked disputed and its net proceeds are removed from future payout eligibility

#### Scenario: Refund excludes purchase
- **WHEN** the worker processes charge.refunded for a known Purchase
- **THEN** the Purchase is marked refunded and the handler is safe to replay

#### Scenario: Post-release dispute flags exposure
- **WHEN** charge.dispute.created references a Purchase on a released EventPayout
- **THEN** the released payout is flagged for admin follow-up, its amount remains unchanged, and no reverse transfer is created

#### Scenario: Transfer success updates payout
- **WHEN** transfer.created references a known EventPayout
- **THEN** the payout records the Stripe transfer identity and reaches the appropriate released state idempotently

#### Scenario: Transfer failure updates payout
- **WHEN** transfer.failed or a relevant payout failure event references a known EventPayout
- **THEN** the payout records failed status and a concise error for bounded retry and ADMIN visibility

#### Scenario: Unknown payout event is a no-op
- **WHEN** a valid Stripe charge or transfer event has no matching Purchase or EventPayout
- **THEN** the worker marks the inbox event processed without mutating business state or retry storm
