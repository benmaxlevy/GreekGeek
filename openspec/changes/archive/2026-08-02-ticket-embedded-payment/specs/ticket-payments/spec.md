## Purpose

Holder checkout for unpaid tickets via embedded Stripe Payment Element: GreekGeek platform charges, fee math, TicketPayment persistence, and webhook-driven paid transition without transfers or hosted Checkout.

## ADDED Requirements

### Requirement: GreekGeek fee is computed server-side with half-up rounding

The system MUST read `RALLY_FEE_PERCENT` from environment as a percent number (default **10** when unset). For a ticket price `priceCents` (integer), `feeCents` MUST equal `round_half_up(priceCents * RALLY_FEE_PERCENT / 100)`. `amountCents` MUST equal `priceCents + feeCents`. `netCents` MUST equal `priceCents` (portion reserved for future transfer). Fee and total amounts MUST be computed only on the server from allocation `priceCents`; client-submitted amounts MUST be ignored. USD only.

#### Scenario: Ten percent fee on whole dollar

- **WHEN** `RALLY_FEE_PERCENT` is 10 and allocation `priceCents` is 1000
- **THEN** `feeCents` is 100 and `amountCents` is 1100

#### Scenario: Half-up at fifty-cent boundary

- **WHEN** `RALLY_FEE_PERCENT` is 10 and allocation `priceCents` is 1005
- **THEN** `feeCents` is 101 (half-up from 100.5) and `amountCents` is 1106

#### Scenario: Half-up below fifty-cent boundary

- **WHEN** `RALLY_FEE_PERCENT` is 10 and allocation `priceCents` is 1004
- **THEN** `feeCents` is 100 and `amountCents` is 1104

### Requirement: TicketPayment persists one payment row per ticket

The system MUST persist `TicketPayment` with: required unique `ticketId` foreign key to Ticket (one row per ticket), required unique `stripePaymentIntentId`, required `amountCents`, required `feeCents`, required `netCents`, required `currency` (`usd`), required `status` enum `requires_payment` | `succeeded` | `failed` | `canceled`, and timestamps. The row MUST be updated in place when reusing an open PaymentIntent or when status changes. Creating checkout for a ticket with an existing open `requires_payment` row MUST reuse that PaymentIntent rather than create a duplicate.

#### Scenario: First checkout creates TicketPayment

- **WHEN** a holder initiates checkout for an eligible unpaid ticket with no existing TicketPayment
- **THEN** a TicketPayment row is created with `status` `requires_payment` and the Stripe PaymentIntent id

#### Scenario: Reopen checkout reuses open PaymentIntent

- **WHEN** a holder initiates checkout and a TicketPayment with `status` `requires_payment` already exists for that ticket
- **THEN** the existing PaymentIntent is returned and the TicketPayment row is updated if amounts changed

#### Scenario: One payment row per ticket enforced

- **WHEN** the system attempts to create a second TicketPayment for the same `ticketId`
- **THEN** the unique constraint prevents duplicate rows

### Requirement: Holder-only checkout creates PaymentIntent on platform account

The system MUST expose an authenticated checkout endpoint that creates (or reuses) a Stripe PaymentIntent on the **GreekGeek platform** Stripe account with **no `transfer_data`**. The caller MUST be the ticket's `holderUserId`; all other callers including platform ADMIN MUST receive 403 Forbidden. Preconditions MUST all pass or the system returns a client error (4xx): event `ticketingEnabled` true, `ticketSaleStatus` `on_sale`, ticket `status` `unpaid`, ticket not void, allocation `status` `active`, allocation `priceCents` greater than zero, host organization `stripeChargesEnabled` true. The PaymentIntent amount MUST equal server-computed `amountCents`. Metadata on the PaymentIntent MUST include `ticketId`, `eventId`, and `organizationId` (host org). The endpoint MUST use an idempotency key to prevent duplicate intents on retry. Request and response shapes MUST be validated with shared Zod schemas in `packages/contracts`. The response MUST return `client_secret` and only minimal additional fields needed for the embedded UI (e.g. itemized price, fee, total for display).

#### Scenario: Holder receives client secret

- **WHEN** the ticket holder calls checkout for an eligible unpaid ticket
- **THEN** the response includes `client_secret` and server-computed fee breakdown

#### Scenario: Non-holder receives 403 including admin

- **WHEN** any user other than `holderUserId` including platform ADMIN calls checkout
- **THEN** the system returns 403 Forbidden

#### Scenario: Checkout rejected when not on sale

- **WHEN** the holder calls checkout while `ticketSaleStatus` is not `on_sale`
- **THEN** the system returns a client error and does not create a PaymentIntent

#### Scenario: Checkout rejected when charges disabled

- **WHEN** the holder calls checkout and host org `stripeChargesEnabled` is false
- **THEN** the system returns a client error

#### Scenario: Checkout rejected for void ticket

- **WHEN** the holder calls checkout for a void ticket
- **THEN** the system returns a client error

#### Scenario: Checkout rejected for free allocation

- **WHEN** allocation `priceCents` is zero
- **THEN** the system returns a client error and does not call Stripe

#### Scenario: PaymentIntent has no transfer_data

- **WHEN** checkout succeeds
- **THEN** the created PaymentIntent charges the platform account without `transfer_data`

### Requirement: Embedded pay UI uses Payment Element on dedicated route

The web app MUST provide `/app/tickets/$id/pay` as a dedicated pay page for the ticket holder. The page MUST embed Stripe Payment Element (not hosted Checkout redirect) initialized with `client_secret` from the checkout API. Payment Element MUST use `automatic_payment_methods`. Apple Pay and Google Pay MUST appear only when Stripe offers them for the registered domain — no custom wallet plumbing in application code. Domain registration for wallet methods is a Stripe Dashboard operations task, not application code. The UI MUST show itemized pricing (e.g. `$10.00 + $1.00 GreekGeek fee = $11.00`). The UI MUST handle states: loading, error, processing, success; MUST prevent double-submit while processing. On client-side payment confirmation success, the UI MUST refetch the ticket; QR MUST appear per existing ticketing rules when status becomes `paid`. Client-side confirmation MUST NOT directly set ticket status to paid. The web app MUST require `VITE_STRIPE_PUBLISHABLE_KEY` documented in `.env.example`.

#### Scenario: Holder opens pay page

- **WHEN** an ACTIVE holder navigates to `/app/tickets/$id/pay` for their unpaid paid-allocation ticket
- **THEN** the Payment Element loads with itemized fee display

#### Scenario: Success refetches ticket for QR

- **WHEN** payment confirmation succeeds and webhook has marked the ticket paid
- **THEN** the UI refetches and shows QR per paid-ticket rules

#### Scenario: Double-submit prevented

- **WHEN** the holder clicks pay while processing is in flight
- **THEN** a second submission is blocked until the first completes or fails

### Requirement: Webhook marks ticket paid idempotently

On `payment_intent.succeeded` processed by the existing webhook inbox worker: when the linked ticket is `unpaid`, the system MUST set ticket `status` to `paid` and set `paidAt`. TicketPayment `status` MUST become `succeeded`. Reprocessing the same event MUST be a no-op for ticket state (idempotent). On `payment_intent.payment_failed` or `payment_intent.canceled`, TicketPayment `status` MUST be updated to `failed` or `canceled` respectively; ticket MUST remain `unpaid`. Client-side payment confirmation MUST NEVER flip ticket status — only the webhook worker may transition ticket to `paid`.

#### Scenario: Succeeded webhook marks unpaid ticket paid

- **WHEN** the worker processes `payment_intent.succeeded` for a ticket with status `unpaid`
- **THEN** ticket becomes `paid` with `paidAt` set and TicketPayment becomes `succeeded`

#### Scenario: Webhook replay is idempotent

- **WHEN** the same `payment_intent.succeeded` is processed again
- **THEN** ticket state is unchanged and no error is raised

#### Scenario: Failed payment leaves ticket unpaid

- **WHEN** the worker processes `payment_intent.payment_failed`
- **THEN** TicketPayment is `failed` and ticket remains `unpaid`

#### Scenario: Succeeded on voided ticket does not flip ticket

- **WHEN** the worker processes `payment_intent.succeeded` but ticket status is `void`
- **THEN** TicketPayment is `succeeded`, ticket remains `void`, and a status-mismatch indicator is available for soft review (no dispute UI)

### Requirement: Free tickets are paid immediately without Stripe

When a ticket is issued or claimed and its allocation `priceCents` is zero, the system MUST create the ticket with `status` `paid` and `paidAt` set immediately. No Stripe API call and no TicketPayment row MUST be created for free tickets.

#### Scenario: Free issue creates paid ticket

- **WHEN** an authorized actor issues a ticket against an allocation with `priceCents` 0
- **THEN** the ticket is created with status `paid` and `paidAt` set

#### Scenario: Free self-claim creates paid ticket

- **WHEN** an ACTIVE user claims from a public allocation with `priceCents` 0
- **THEN** the ticket is created with status `paid` and `paidAt` set
