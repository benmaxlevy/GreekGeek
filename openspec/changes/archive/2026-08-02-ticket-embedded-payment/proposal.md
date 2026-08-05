## Why

Connect readiness gates paid allocations, but holders still cannot pay — only stub mark-paid exists. Host orgs need real card collection via embedded Stripe Payment Element on GreekGeek's platform account so unpaid tickets become paid through webhooks, without hosted Checkout or transfers this slice.

## What Changes

### Fee and amounts

- `RALLY_FEE_PERCENT` env (percent number, default **10**)
- `feeCents = round_half_up(priceCents * pct / 100)`; unit tested including `.5` boundaries
- Buyer pays fee on top; UI itemized (e.g. `$10.00 + $1.00 GreekGeek fee = $11.00` at 10%)
- Amounts computed **server-side** from allocation `priceCents` + fee; client amounts ignored

### TicketPayment model (one row per ticket)

- `ticketId` (unique FK — one payment per ticket)
- `stripePaymentIntentId` unique
- `amountCents` (total charged = price + fee), `feeCents`, `netCents` (price portion for future transfer)
- `currency` (`usd`)
- `status`: `requires_payment` | `succeeded` | `failed` | `canceled`
- timestamps; update in place when reusing PI / status changes

### Checkout creation API

- Endpoint creates PaymentIntent; Zod-validated request/response in `packages/contracts`
- **Holder only** — caller must be `holderUserId` of unpaid ticket; everyone else **403 including ADMIN**
- Preconditions: ticketing enabled, `on_sale`, ticket unpaid and not void, allocation active, `priceCents > 0`, host org `stripeChargesEnabled`
- Returns **`client_secret`** plus minimal FE fields; metadata on PI: `ticketId`, `eventId`, `organizationId`
- Reuses open PI for same ticket; idempotency key prevents duplicate intents
- Charges on **GreekGeek platform** Stripe account; **no `transfer_data`**

### Embedded payment UI

- Dedicated route `/app/tickets/$id/pay` with Stripe Payment Element (no hosted Checkout redirect)
- `automatic_payment_methods` enabled; Apple/Google Pay only when Stripe offers for domain
- States: loading, error, processing, success; double-submit prevented
- On success: refetch ticket; QR appears per existing rules
- `VITE_STRIPE_PUBLISHABLE_KEY` on web (document in `.env.example`)

### Webhook → paid

- `payment_intent.succeeded` via **existing** webhook inbox worker → ticket unpaid → `paid`, set `paidAt`; idempotent on replay
- `payment_intent.payment_failed` / `canceled` recorded on TicketPayment; ticket stays unpaid
- Client-side confirmation NEVER flips ticket status
- Success for voided ticket → record TicketPayment succeeded, ticket NOT flipped; surfaced for soft review (status mismatch badge — no dispute UI)

### Free + admin paths

- `priceCents = 0` → ticket paid immediately on issue/claim, no Stripe call
- Mark-paid remains **ADMIN-only** (support escape hatch)
- **BREAKING:** remove non-admin holder self mark-paid
- Void blocks checkout and cancels any open PI

### Non-goals

No transfers, payouts, refunds, dispute UI, saved payment methods, payment pools/group collection

## Capabilities

### New Capabilities

- `ticket-payments`: TicketPayment persistence, GreekGeek fee math, holder-only PaymentIntent checkout API, embedded pay UI, webhook-driven paid transition, free-ticket auto-pay

### Modified Capabilities

- `ticketing`: Remove holder self mark-paid; free tickets auto-paid on issue/claim; void cancels open PI and blocks checkout; holder pay route and unpaid-ticket CTA; ADMIN-only mark-paid
- `webhook-inbox`: Register `payment_intent.succeeded` / `payment_intent.payment_failed` / `payment_intent.canceled` handlers in existing Stripe worker
- `org-permissions`: Update `tickets.manage` exception wording — holder mark-paid removed; checkout is holder-only not permission-gated

## Impact

- **apps/api**: Prisma `TicketPayment` model; fee helper + `RALLY_FEE_PERCENT` env; checkout endpoint; void cancels PI; free-ticket auto-pay on issue/claim; webhook PI handlers; integration tests
- **packages/contracts**: Checkout request/response Zod schemas; fee breakdown DTOs
- **apps/web**: `/app/tickets/$id/pay` Payment Element page; itemized fee display; pay CTA on unpaid tickets; remove holder mark-paid UI
- **.env.example**: `RALLY_FEE_PERCENT`, `VITE_STRIPE_PUBLISHABLE_KEY`
- **Dependencies**: Reuses archived `redis-bullmq-webhook-inbox` (inbox + worker) and `org-stripe-connect` (`stripeChargesEnabled` gate)
