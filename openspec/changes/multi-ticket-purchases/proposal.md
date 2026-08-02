## Why

Holders can buy only one ticket per checkout because `TicketPayment` is 1:1 with `Ticket`. Buyers need multi-quantity purchases for the same event allocation in one PaymentIntent, with server-enforced inventory and per-user caps, without cross-event carts or transfers.

## What Changes

### Purchase model (**BREAKING** rename)

- Rename Prisma `TicketPayment` → `Purchase` (table + model); enum `TicketPaymentStatus` → `PurchaseStatus` (same values: `requires_payment` | `succeeded` | `failed` | `canceled`)
- Keep `stripePaymentIntentId` unique; drop `ticketId` unique on the payment side
- `Ticket.purchaseId` nullable FK → Purchase (null for officer-issued and free tickets)
- Purchase fields: `buyerUserId`, `eventId`, `allocationId`, `quantity`, `subtotalCents`, `feeCents`, `amountCents`, `netCents`, `currency`, `status`, `stripePaymentIntentId`, `stripeChargeId`, `statusMismatch`, timestamps
- Write invariant: `amountCents = subtotalCents + feeCents`, `netCents = subtotalCents`
- Indexes on `Purchase.eventId` and `Ticket.purchaseId`
- Migration: existing rows 1:1 → Purchase `quantity=1`; backfill `Ticket.purchaseId` from old `ticketId`; derive `eventId`/`allocationId` via ticket→allocation; reversible or verified against seeded copy; no data loss
- Existing paid tickets keep `paidAt` and QR behavior unchanged

### Scope and caps

- One purchase = one event + one allocation; no cross-event or cross-allocation carts
- Quantity bounded by `min(allocation remaining, event capacity remaining, per-user headroom under MAX_TICKETS_PER_USER_PER_EVENT)` — no `MAX_TICKETS_PER_PURCHASE` env
- Env only: `MAX_TICKETS_PER_USER_PER_EVENT` (default 2), `PURCHASE_TTL_MINUTES` (default 5) — already in `.env` / `.env.example`
- Buyer holds all N tickets (`holderUserId` = buyer); reassignment/transfer out of scope
- Prior "one active ticket per user per event" relaxed to server-enforced per-user cap

### Multi-ticket checkout

- Endpoint takes `allocationId` + `quantity`; Zod-validated in `packages/contracts`
- Preconditions: ticketing enabled, `on_sale`, allocation active, host org `stripeChargesEnabled`, buyer eligible for allocation (own org or public pool)
- Atomic reservation: `SELECT FOR UPDATE` on allocation; create N unpaid tickets only if allocation remaining AND event capacity allow; over-request → 4xx with remaining count (no partial fulfillment)
- Pricing server-side: `subtotalCents = quantity * allocation.priceCents`; `feeCents = round_half_up(subtotalCents * RALLY_FEE_PERCENT / 100)` on purchase subtotal (not per ticket); one PaymentIntent for `amountCents`; metadata: `purchaseId`, `eventId`, `quantity`
- Existing open purchase (`requires_payment`) for same buyer/allocation reused; idempotency key per purchase; DB row lock only (no Redis mutex)

### Settlement and TTL

- `payment_intent.succeeded` → purchase `succeeded`, capture `stripeChargeId`, flip all unpaid tickets → `paid` with `paidAt` in one transaction; idempotent replay
- `payment_intent.payment_failed` / `canceled` → purchase failed/canceled; DELETE reserved unpaid tickets to free slots
- Abandoned purchases expire after `PURCHASE_TTL_MINUTES` via worker sweep; PI canceled; tickets released
- Void of an individual paid ticket does NOT alter purchase totals

### UI

- Quantity selector on buy flow, bounded by remaining allocation and per-user cap
- Itemized summary (e.g. `2 × $10.00 = $20.00`, Rally fee `$2.00`, Total `$22.00`); embedded Payment Element unchanged
- Success shows all N tickets with QR codes; officer guest list groups tickets by purchase/buyer

### Non-goals

No cross-event carts, named guest assignment, transfers, partial refunds, or saved payment methods

### Demo

Buyer purchases **2** tickets (not 4) in one embedded checkout → single PI → both flip paid → 2 QRs scan → abandoned purchase releases held seats

## Capabilities

### New Capabilities

<!-- none — reshape existing ticket-payments + ticketing; TTL via job-queue -->

### Modified Capabilities

- `ticket-payments`: Rename TicketPayment→Purchase; multi-quantity checkout by allocation; fee on purchase subtotal; webhook settles all tickets in purchase; TTL expiry release; void of paid ticket leaves purchase totals unchanged
- `ticketing`: Relax one-ticket-per-user to `MAX_TICKETS_PER_USER_PER_EVENT`; atomic multi-ticket reservation; guest list grouped by purchase/buyer; holder UI quantity selector and multi-QR success
- `job-queue`: Register recurring/sweep job for abandoned purchase TTL (`PURCHASE_TTL_MINUTES`) that cancels open PaymentIntents and releases reserved unpaid tickets

## Impact

- **apps/api**: Prisma Purchase migration; rename services/controllers/webhooks; checkout by allocation+quantity; reservation + TTL worker; integration tests (fee math, concurrency, caps, webhook, migration)
- **packages/contracts**: Replace ticket-scoped checkout schemas with purchase checkout (`allocationId` + `quantity`) and purchase DTOs
- **apps/web**: Quantity selector + itemized multi-ticket summary on buy flow; success multi-QR; guest list grouping
- **.env / .env.example**: `MAX_TICKETS_PER_USER_PER_EVENT`, `PURCHASE_TTL_MINUTES` (already present)
- **Dependencies**: Reuses Stripe platform PaymentIntent + webhook inbox; BullMQ worker for TTL sweep
