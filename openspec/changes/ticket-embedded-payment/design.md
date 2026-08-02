## Context

Archived `redis-bullmq-webhook-inbox` provides Stripe signature verification, `WebhookEvent` persistence, and BullMQ async processing with account/capability handlers. Archived `org-stripe-connect` gates paid allocations and `on_sale` on host org `stripeChargesEnabled`. Ticketing supports `priceCents`, issue/void, holder self mark-paid stub, and QR for paid tickets — no real payment processor. See proposal.md for locked product decisions.

## Goals / Non-Goals

**Goals:**

- `TicketPayment` model (one row per ticket) tracking PI lifecycle
- Server-side Rally fee via `RALLY_FEE_PERCENT` with half-up rounding
- Holder-only checkout API creating/reusing PaymentIntent on **platform** account (no `transfer_data`)
- Embedded Payment Element at `/app/tickets/$id/pay`
- Webhook worker flips ticket `paid`; client confirmation never does
- Free tickets (`priceCents = 0`) paid immediately on issue/claim
- ADMIN-only mark-paid; void cancels open PI
- Integration + unit tests per proposal

**Non-Goals:**

- Transfers, payouts, refunds, dispute UI, saved payment methods
- Payment pools / group collection
- Hosted Stripe Checkout redirect
- Currency other than USD
- New webhook ingest HTTP route

## Decisions

### 1. Prisma TicketPayment schema

```prisma
model TicketPayment {
  id                    String   @id @default(cuid())
  ticketId              String   @unique
  ticket                Ticket   @relation(fields: [ticketId], references: [id])
  stripePaymentIntentId String   @unique
  amountCents           Int
  feeCents              Int
  netCents              Int
  currency              String   @default("usd")
  status                TicketPaymentStatus
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum TicketPaymentStatus {
  requires_payment
  succeeded
  failed
  canceled
}
```

**Rationale:** Unique `ticketId` enforces one payment per ticket; unique PI id supports webhook lookup.

**Alternative rejected:** PaymentIntent-only without local row — loses fee audit and status between webhook and client.

### 2. Fee helper

```typescript
// packages/contracts or apps/api fee module
export function computeRallyFee(priceCents: number, feePercent: number): {
  feeCents: number;
  amountCents: number;
  netCents: number;
} {
  const feeCents = Math.round((priceCents * feePercent) / 100); // half-up for positive ints
  return { feeCents, amountCents: priceCents + feeCents, netCents: priceCents };
}
```

Env: `RALLY_FEE_PERCENT` Zod-validated at API boot (default 10).

**Rationale:** `Math.round` on positive values matches half-up; unit tests lock `.5` boundaries.

### 3. Checkout endpoint

| Item | Choice |
|------|--------|
| Route | `POST /tickets/:ticketId/checkout` (or nested under ticketing module) |
| Auth | Session required; `caller.id === ticket.holderUserId` else 403 (no ADMIN bypass) |
| PI create | `stripe.paymentIntents.create` on platform key; `automatic_payment_methods: { enabled: true }` |
| Idempotency | Stripe idempotency key `ticket-checkout-{ticketId}` |
| Reuse | If TicketPayment `requires_payment` exists, retrieve PI; update amounts if allocation price changed |
| Metadata | `{ ticketId, eventId, organizationId: event.organizationId }` |
| Response | `{ clientSecret, priceCents, feeCents, amountCents, currency }` — Zod in contracts |

Precondition checks in service layer (single function `assertCheckoutEligible(ticket)`).

**Rationale:** Holder-only matches spec; idempotency prevents duplicate PIs on refresh.

### 4. Void → cancel PI

On void in ticketing service: load TicketPayment where `status = requires_payment`; call `stripe.paymentIntents.cancel`; set TicketPayment `canceled`. Failures logged but void still proceeds.

**Rationale:** Prevents payment after void; Stripe cancel is best-effort.

### 5. Free ticket auto-pay

In issue and self-claim paths: if `allocation.priceCents === 0` (or null treated as 0), set `status: paid`, `paidAt: now()` at create time.

**Rationale:** No Stripe call for free; matches spec.

### 6. Mark-paid restriction

Remove holder branch from mark-paid controller/service. Keep ADMIN-only (existing admin bypass).

**Rationale:** Breaking change per proposal; ADMIN escape hatch for support.

### 7. Webhook handlers (stripe module / inbox worker registry)

Register in existing worker dispatch map:

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Load TicketPayment by PI id; if ticket `unpaid` → `paid` + `paidAt`; if `void` → TicketPayment `succeeded`, flag mismatch (optional `paymentStatusMismatch` on TicketPayment or log + admin filter later); idempotent if already `paid` |
| `payment_intent.payment_failed` | TicketPayment → `failed` |
| `payment_intent.canceled` | TicketPayment → `canceled` |

All in transaction with row lock on ticket.

**Rationale:** Reuses archived inbox; no new ingest.

### 8. Frontend Payment Element

- `@stripe/stripe-js` + `@stripe/react-stripe-js`
- Route: `/app/tickets/$id/pay` — loader fetches ticket + calls checkout API
- `Elements` with `clientSecret`; `PaymentElement`; `stripe.confirmPayment({ elements, redirect: 'if_required' })`
- On success → poll/refetch ticket until `paid` or timeout message ("payment processing")
- Remove mark-paid button from holder `/app/tickets` UI; add "Pay" link for unpaid + `priceCents > 0`
- Env: `VITE_STRIPE_PUBLISHABLE_KEY` in `apps/web/.env.example`

**Rationale:** Embedded Element per locked decision; no hosted Checkout.

### 9. Status mismatch (void + succeeded PI)

Store TicketPayment `succeeded` even when ticket `void`. Surface via optional boolean `statusMismatch` on TicketPayment or derive in admin list query. No dispute UI this slice.

**Rationale:** Money captured but ticket voided needs ops visibility without building disputes.

## Risks / Trade-offs

- **[Platform account charges without transfer]** → Accept for this slice; `netCents` stored for future transfer phase
- **[Client success before webhook]** → UI refetches/polls; QR only when ticket `paid`; copy explains delay
- **[Void after PI created but before pay]** → Void handler cancels PI; race if pay completes simultaneously → webhook sees void, records mismatch
- **[Wallet domain not registered]** → Cards still work; Apple/Google Pay ops task in Stripe Dashboard
- **[Removing holder mark-paid]** → Breaking for any holder using stub; free tickets no longer need it

## Migration Plan

1. Deploy schema migration (`TicketPayment`) + API with checkout endpoint
2. Deploy webhook handlers before enabling pay UI in production
3. Deploy FE pay page; remove holder mark-paid UI
4. Existing unpaid tickets on paid allocations: holders use new pay flow
5. Rollback: disable pay route; ADMIN mark-paid still works

## Open Questions

_(none — locked decisions cover scope)_
