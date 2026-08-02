## 1. Schema + fee math + contracts + env

- [x] 1.1 Add Prisma `TicketPayment` model and `TicketPaymentStatus` enum per design; generate and apply migration
- [x] 1.2 Add `RALLY_FEE_PERCENT` to API Zod env schema (default 10); document in `.env.example`
- [x] 1.3 Implement `computeRallyFee(priceCents, feePercent)` with half-up rounding; unit tests for whole-dollar, `.5` boundary above, `.5` boundary below
- [x] 1.4 Add `packages/contracts/src/ticket-payments.ts`: checkout request/response Zod schemas (clientSecret, priceCents, feeCents, amountCents, currency)
- [x] 1.5 Document `VITE_STRIPE_PUBLISHABLE_KEY` in `apps/web/.env.example`
- [x] 1.6 Commit: `add ticket payment schema fee helper and contracts`

## 2. Free auto-pay + ADMIN-only mark-paid + void cancel PI

- [x] 2.1 Issue path: when allocation `priceCents` is 0, create ticket `paid` with `paidAt`
- [x] 2.2 Self-claim path: when public allocation `priceCents` is 0, create ticket `paid` with `paidAt`
- [x] 2.3 Restrict mark-paid endpoint to platform ADMIN only; remove holder self mark-paid branch
- [x] 2.4 Void path: cancel open Stripe PaymentIntent via TicketPayment; set TicketPayment `canceled`
- [x] 2.5 Integration tests: free issue/claim paid immediately; non-admin mark-paid 403; void cancels open PI
- [x] 2.6 Commit: `free tickets auto paid admin only mark paid void cancels pi`

## 3. Checkout API (holder-only PaymentIntent)

- [x] 3.1 `TicketPaymentsService`: `assertCheckoutEligible` (ticketing on, on_sale, unpaid, not void, allocation active, priceCents > 0, stripeChargesEnabled)
- [x] 3.2 `POST /tickets/:ticketId/checkout`: holder-only (403 for non-holder including ADMIN); create or reuse PI on platform account; no `transfer_data`; metadata ticketId/eventId/organizationId; idempotency key
- [x] 3.3 Upsert TicketPayment row; reuse `requires_payment` PI when present
- [x] 3.4 Integration tests: happy path client_secret; non-holder 403; unready org 4xx; closed sale 4xx; void 4xx; free allocation 4xx
- [x] 3.5 Commit: `add holder only ticket checkout api`

## 4. Webhook PI handlers

- [x] 4.1 Register `payment_intent.succeeded` / `payment_failed` / `canceled` in existing inbox worker
- [x] 4.2 `succeeded`: unpaid ticket → paid + paidAt; TicketPayment succeeded; idempotent replay; void ticket → succeeded payment + mismatch flag, ticket stays void
- [x] 4.3 `payment_failed` / `canceled`: update TicketPayment; ticket stays unpaid
- [x] 4.4 Integration tests: webhook replay idempotent; failed payment leaves unpaid; void mismatch case
- [x] 4.5 Commit: `add payment intent webhook handlers for ticket payments`

## 5. Frontend — pay page + holder UI

- [x] 5.1 Add `@stripe/stripe-js` and `@stripe/react-stripe-js`; Stripe provider with `VITE_STRIPE_PUBLISHABLE_KEY`
- [x] 5.2 Route `/app/tickets/$id/pay`: loader calls checkout API; Payment Element with `automatic_payment_methods`; itemized fee display
- [x] 5.3 States: loading, error, processing, success; double-submit guard; `confirmPayment` with `redirect: 'if_required'`
- [x] 5.4 On success: refetch ticket until paid (poll/refresh); navigate to ticket detail with QR
- [x] 5.5 `/app/tickets`: remove holder mark-paid button; add Pay CTA for unpaid paid-allocation tickets
- [x] 5.6 Commit: `add embedded ticket payment page and holder pay cta`

## 6. Verification / demos

- [x] 6.1 Playwright demo: connected org → paid allocation → holder pays via embedded Element → worker flips paid → QR visible + host scan succeeds
- [x] 6.2 Playwright demo: non-holder blocked from checkout/pay page
- [x] 6.3 Playwright demo: unready org cannot create paid allocation (existing gate regression)
- [x] 6.4 Manual: `stripe listen` + test card; verify fee line item at 10%
- [x] 6.5 Mark all tasks complete; archive when shipped
