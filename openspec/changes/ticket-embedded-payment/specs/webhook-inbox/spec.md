## ADDED Requirements

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
