# ticket-payments Specification

## Purpose

Holder checkout for unpaid tickets via embedded Stripe Payment Element: Rally platform charges, fee math, TicketPayment persistence, and webhook-driven paid transition without transfers or hosted Checkout.

## Requirements

### Requirement: Rally fee is computed server-side with half-up rounding

The system MUST read `RALLY_FEE_PERCENT` from environment as a percent number (default **10** when unset). For a purchase, `subtotalCents` MUST equal `quantity * allocation.priceCents` (integer). `feeCents` MUST equal `round_half_up(subtotalCents * RALLY_FEE_PERCENT / 100)`. Fee MUST be computed on the purchase subtotal, not per ticket. `amountCents` MUST equal `subtotalCents + feeCents`. `netCents` MUST equal `subtotalCents` (portion reserved for future transfer). Fee and total amounts MUST be computed only on the server from allocation `priceCents` and quantity; client-submitted amounts MUST be ignored. USD only.

#### Scenario: Ten percent fee on two-ticket subtotal

- **WHEN** `RALLY_FEE_PERCENT` is 10, allocation `priceCents` is 1000, and quantity is 2
- **THEN** `subtotalCents` is 2000, `feeCents` is 200, and `amountCents` is 2200

#### Scenario: Half-up at fifty-cent boundary on subtotal

- **WHEN** `RALLY_FEE_PERCENT` is 10 and `subtotalCents` is 1005
- **THEN** `feeCents` is 101 (half-up from 100.5) and `amountCents` is 1106

#### Scenario: Half-up below fifty-cent boundary on subtotal

- **WHEN** `RALLY_FEE_PERCENT` is 10 and `subtotalCents` is 1004
- **THEN** `feeCents` is 100 and `amountCents` is 1104

#### Scenario: Fee not applied per ticket then summed

- **WHEN** `RALLY_FEE_PERCENT` is 10, allocation `priceCents` is 1005, and quantity is 2
- **THEN** `subtotalCents` is 2010, `feeCents` is 201 (half-up from 201.0), not 202 from rounding each ticket separately

### Requirement: Purchase persists multi-ticket checkout payment

The system MUST persist `Purchase` with: required `buyerUserId`, required `eventId`, required `allocationId`, required `quantity` (positive integer), required `subtotalCents`, required `feeCents`, required `amountCents`, required `netCents`, required `currency` (`usd`), required `status` enum `requires_payment` | `succeeded` | `failed` | `canceled` (`PurchaseStatus`), required unique `stripePaymentIntentId`, optional `stripeChargeId`, required `statusMismatch` boolean defaulting to false, and timestamps. Write paths MUST enforce `amountCents = subtotalCents + feeCents` and `netCents = subtotalCents`. The system MUST index `Purchase.eventId`. Tickets belonging to a purchase MUST reference it via nullable `Ticket.purchaseId` (indexed); officer-issued and free tickets MUST have `purchaseId` null. The row MUST be updated in place when reusing an open PaymentIntent or when status changes. Creating checkout for the same buyer and allocation with an existing open `requires_payment` Purchase MUST reuse that PaymentIntent rather than create a duplicate. One purchase MUST cover exactly one event and one allocation.

#### Scenario: First checkout creates Purchase

- **WHEN** a buyer initiates checkout for an eligible allocation with quantity N and no open Purchase for that buyer and allocation
- **THEN** a Purchase row is created with `quantity` N, `status` `requires_payment`, and the Stripe PaymentIntent id

#### Scenario: Reopen checkout reuses open PaymentIntent

- **WHEN** a buyer initiates checkout and a Purchase with `status` `requires_payment` already exists for the same buyer and allocation
- **THEN** the existing PaymentIntent is returned and the Purchase row is updated if amounts or quantity changed

#### Scenario: stripePaymentIntentId uniqueness enforced

- **WHEN** the system attempts to create a second Purchase with an existing `stripePaymentIntentId`
- **THEN** the unique constraint prevents duplicate rows

#### Scenario: Amount invariant on write

- **WHEN** a Purchase is created or updated with `subtotalCents` 2000 and `feeCents` 200
- **THEN** `amountCents` is 2200 and `netCents` is 2000

### Requirement: Buyer checkout creates PaymentIntent for allocation quantity

The system MUST expose an authenticated checkout endpoint that accepts `allocationId` and `quantity`, validated with shared Zod schemas in `packages/contracts`. The caller MUST be an ACTIVE authenticated buyer eligible for the allocation (member of the allocation's organization, or any ACTIVE user for a public pool); all other callers including platform ADMIN MUST receive 403 Forbidden when ineligible. Preconditions MUST all pass or the system returns a client error (4xx): event `ticketingEnabled` true, `ticketSaleStatus` `on_sale`, allocation `status` `active`, allocation `priceCents` greater than zero, host organization `stripeChargesEnabled` true. Quantity MUST be bounded by `min(allocation remaining, event capacity remaining, per-user headroom under MAX_TICKETS_PER_USER_PER_EVENT)`; over-request MUST return a client error that includes the remaining count, with no partial fulfillment. Checkout MUST atomically reserve seats: `SELECT FOR UPDATE` on the allocation row and create exactly N unpaid tickets with `holderUserId` equal to the buyer and `purchaseId` set only when both allocation remaining and event capacity allow. The system MUST create (or reuse) a Stripe PaymentIntent on the **Rally platform** Stripe account with **no `transfer_data`**. The PaymentIntent amount MUST equal server-computed `amountCents`. Metadata on the PaymentIntent MUST include `purchaseId`, `eventId`, and `quantity`. The endpoint MUST use an idempotency key per purchase to prevent duplicate intents on retry. Concurrency control MUST use the database row lock only (no Redis mutex). The response MUST return `client_secret` and itemized display fields (unit price, quantity, subtotal, fee, total).

#### Scenario: Buyer receives client secret for quantity two

- **WHEN** an eligible buyer calls checkout with allocationId and quantity 2 and capacity allows
- **THEN** the response includes `client_secret`, two unpaid tickets are reserved under the Purchase, and the fee breakdown uses purchase subtotal

#### Scenario: Ineligible caller receives 403 including admin

- **WHEN** a user not eligible for the allocation including platform ADMIN calls checkout
- **THEN** the system returns 403 Forbidden

#### Scenario: Over-request rejected with remaining count

- **WHEN** a buyer requests quantity greater than remaining allocation or capacity headroom
- **THEN** the system returns a client error including the remaining count and creates no tickets and no PaymentIntent

#### Scenario: Concurrent checkouts do not oversell

- **WHEN** two concurrent checkout requests would exceed allocation remaining or event capacity if both succeeded
- **THEN** at most one reserves its full quantity and the other receives a client error with remaining count

#### Scenario: Open unpaid holds block other buyers

- **WHEN** buyer A has an open `requires_payment` Purchase whose unpaid reserved tickets consume all remaining allocation or event capacity
- **THEN** buyer B's checkout for that allocation receives a client error with remaining count 0 (or equivalent) and creates no tickets; unpaid holds count against remaining until paid, failed/canceled, or TTL release

#### Scenario: Checkout rejected when not on sale

- **WHEN** the buyer calls checkout while `ticketSaleStatus` is not `on_sale`
- **THEN** the system returns a client error and does not create a PaymentIntent

#### Scenario: Checkout rejected when charges disabled

- **WHEN** the buyer calls checkout and host org `stripeChargesEnabled` is false
- **THEN** the system returns a client error

#### Scenario: Checkout rejected for free allocation

- **WHEN** allocation `priceCents` is zero
- **THEN** the system returns a client error and does not call Stripe

#### Scenario: PaymentIntent has no transfer_data

- **WHEN** checkout succeeds
- **THEN** the created PaymentIntent charges the platform account without `transfer_data`

### Requirement: Embedded pay UI uses Payment Element on dedicated route

The web app MUST provide a dedicated pay page for purchase checkout (existing ticket pay route MAY redirect or be replaced by allocation-based buy flow). The page MUST embed Stripe Payment Element (not hosted Checkout redirect) initialized with `client_secret` from the checkout API. Payment Element MUST use `automatic_payment_methods`. Apple Pay and Google Pay MUST appear only when Stripe offers them for the registered domain — no custom wallet plumbing in application code. Domain registration for wallet methods is a Stripe Dashboard operations task, not application code. The UI MUST show a quantity selector bounded by remaining allocation capacity and the buyer's remaining per-user headroom under `MAX_TICKETS_PER_USER_PER_EVENT`. The UI MUST show itemized pricing (e.g. `2 × $10.00 = $20.00`, Rally fee `$2.00`, Total `$22.00`). The UI MUST handle states: loading, error, processing, success; MUST prevent double-submit while processing. On client-side payment confirmation success, the UI MUST refetch and show all N tickets in the purchase with QR codes per existing ticketing rules when status becomes `paid`. Client-side confirmation MUST NOT directly set ticket status to paid. The web app MUST require `VITE_STRIPE_PUBLISHABLE_KEY` documented in `.env.example`.

#### Scenario: Buyer opens pay page with quantity selector

- **WHEN** an ACTIVE eligible buyer navigates to the buy/pay flow for a paid allocation
- **THEN** the Payment Element loads with a quantity selector and itemized fee display for the selected quantity

#### Scenario: Success shows all tickets with QR

- **WHEN** payment confirmation succeeds and webhook has marked the purchase tickets paid
- **THEN** the UI refetches and shows QR for each of the N paid tickets

#### Scenario: Double-submit prevented

- **WHEN** the buyer clicks pay while processing is in flight
- **THEN** a second submission is blocked until the first completes or fails

### Requirement: Webhook marks ticket paid idempotently

On `payment_intent.succeeded` processed by the existing webhook inbox worker: the system MUST set Purchase `status` to `succeeded`, capture `stripeChargeId` when present, and in one transaction flip all unpaid tickets linked via `purchaseId` to `paid` with `paidAt` set. Reprocessing the same event MUST be a no-op for purchase and ticket state (idempotent). On `payment_intent.payment_failed` or `payment_intent.canceled`, Purchase `status` MUST be updated to `failed` or `canceled` respectively; the system MUST DELETE all reserved unpaid tickets for that purchase so slots are freed. Client-side payment confirmation MUST NEVER flip ticket status — only the webhook worker may transition purchase tickets to `paid`. When a linked ticket is already `void` at success time, Purchase MUST become `succeeded` with `statusMismatch` true for soft review; that void ticket MUST remain `void`.

#### Scenario: Succeeded webhook marks all unpaid tickets paid

- **WHEN** the worker processes `payment_intent.succeeded` for a Purchase with N unpaid tickets
- **THEN** Purchase becomes `succeeded`, `stripeChargeId` is stored when available, and all N tickets become `paid` with `paidAt` set in one transaction

#### Scenario: Webhook replay is idempotent

- **WHEN** the same `payment_intent.succeeded` is processed again
- **THEN** purchase and ticket state are unchanged and no error is raised

#### Scenario: Failed payment releases reserved tickets

- **WHEN** the worker processes `payment_intent.payment_failed`
- **THEN** Purchase is `failed` and all reserved unpaid tickets for that purchase are deleted

#### Scenario: Canceled payment releases reserved tickets

- **WHEN** the worker processes `payment_intent.canceled`
- **THEN** Purchase is `canceled` and all reserved unpaid tickets for that purchase are deleted

#### Scenario: Succeeded with voided ticket sets statusMismatch

- **WHEN** the worker processes `payment_intent.succeeded` but one linked ticket status is `void`
- **THEN** Purchase is `succeeded` with `statusMismatch` true, that ticket remains `void`, and other unpaid tickets in the purchase become `paid`

### Requirement: Free tickets are paid immediately without Stripe

When a ticket is issued or claimed and its allocation `priceCents` is zero, the system MUST create the ticket with `status` `paid` and `paidAt` set immediately. No Stripe API call and no Purchase row MUST be created for free tickets. Officer-issued tickets (including paid allocations issued by officers) MUST have `purchaseId` null unless created through the buyer purchase checkout path.

#### Scenario: Free issue creates paid ticket without Purchase

- **WHEN** an authorized actor issues a ticket against an allocation with `priceCents` 0
- **THEN** the ticket is created with status `paid`, `paidAt` set, and `purchaseId` null

#### Scenario: Free self-claim creates paid ticket without Purchase

- **WHEN** an ACTIVE user claims from a public allocation with `priceCents` 0
- **THEN** the ticket is created with status `paid`, `paidAt` set, and `purchaseId` null

### Requirement: Abandoned purchases expire and release reserved tickets

The system MUST expire Purchases with `status` `requires_payment` whose age exceeds `PURCHASE_TTL_MINUTES` (env, default **5**). Expiry MUST cancel the Stripe PaymentIntent, set Purchase `status` to `canceled`, and DELETE all reserved unpaid tickets for that purchase so allocation and capacity slots are freed. Expiry MUST be driven by the job-queue worker sweep (see `job-queue`).

#### Scenario: TTL expiry releases seats

- **WHEN** a Purchase remains `requires_payment` longer than `PURCHASE_TTL_MINUTES`
- **THEN** the PaymentIntent is canceled, Purchase becomes `canceled`, and its unpaid tickets are deleted

#### Scenario: Succeeded purchase is not expired

- **WHEN** a Purchase has `status` `succeeded`
- **THEN** the TTL sweep does not alter the Purchase or its tickets

### Requirement: Void of paid ticket does not alter purchase totals

Voiding an individual ticket that belongs to a succeeded Purchase MUST set that ticket to `void` and free its allocation slot per ticketing rules, but MUST NOT change the Purchase `quantity`, `subtotalCents`, `feeCents`, `amountCents`, or `netCents`.

#### Scenario: Void paid ticket leaves purchase amounts unchanged

- **WHEN** an authorized actor voids one paid ticket on a Purchase with quantity 2 and amountCents 2200
- **THEN** the ticket is void and the Purchase totals remain unchanged
