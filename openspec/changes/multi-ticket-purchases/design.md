## Context

Today `TicketPayment` is 1:1 with `Ticket` (`ticketId` unique). Checkout is `POST` by ticket id; fee is per-ticket; webhook flips one ticket. Env already documents `MAX_TICKETS_PER_USER_PER_EVENT` and `PURCHASE_TTL_MINUTES`. BullMQ worker + Stripe webhook inbox exist. See proposal.md for product lock; specs for behavior.

## Goals / Non-Goals

**Goals:**

- Rename `TicketPayment` → `Purchase` with reversible/verified migration (1:1 quantity=1 backfill)
- Allocation+quantity checkout with atomic reservation under allocation + event capacity + per-user cap
- Fee on purchase subtotal; one PI; webhook settles all N tickets; TTL releases abandoned holds
- Quantity UI + multi-QR success + guest list grouping

**Non-Goals:**

- Cross-event/cross-allocation carts, transfers, named guests, partial refunds, saved payment methods
- Redis mutex / distributed locks beyond Postgres `SELECT FOR UPDATE`
- `MAX_TICKETS_PER_PURCHASE` env
- New webhook HTTP ingest route

## Decisions

### 1. Prisma Purchase schema (rename + reshape)

```prisma
enum PurchaseStatus {
  requires_payment
  succeeded
  failed
  canceled
}

model Purchase {
  id                    String         @id @default(cuid())
  buyerUserId           String
  buyer                 User           @relation(...)
  eventId               String
  event                 Event          @relation(...)
  allocationId          String
  allocation            TicketAllocation @relation(...)
  quantity              Int
  subtotalCents         Int
  feeCents              Int
  amountCents           Int
  netCents              Int
  currency              String         @default("usd")
  status                PurchaseStatus
  stripePaymentIntentId String         @unique
  stripeChargeId        String?
  statusMismatch        Boolean        @default(false)
  tickets               Ticket[]
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  @@index([eventId])
  @@index([buyerUserId, allocationId, status]) // reuse open purchase lookup
}

// Ticket gains:
purchaseId String?
purchase   Purchase? @relation(fields: [purchaseId], references: [id])
@@index([purchaseId])
```

**Migration:** rename table/enum; drop `ticketId` unique; add columns; backfill `quantity=1`, `subtotalCents` from old net/price fields, `Ticket.purchaseId` from old FK; derive `eventId`/`allocationId` via ticket→allocation; verify against seeded copy or provide down migration.

**Rationale:** FK from Ticket→Purchase supports N tickets; nullable covers free/officer paths.

**Alternative rejected:** Keep `TicketPayment` name with `ticketIds[]` JSON — weaker integrity, worse queries.

### 2. Checkout route and contracts

| Item | Choice |
|------|--------|
| Route | `POST /ticket-purchases/checkout` (or `/purchases/checkout`) body `{ allocationId, quantity }` |
| Auth | Session; buyer eligible for allocation (org member or public); else 403 including ADMIN |
| Reuse | Open `requires_payment` Purchase for same `(buyerUserId, allocationId)` |
| Idempotency | Stripe key `purchase-checkout-{purchaseId}` |
| Metadata | `{ purchaseId, eventId, quantity }` |
| Lock | Interactive txn + `SELECT FOR UPDATE` allocation row only |

Replace `packages/contracts` ticket-checkout schemas with purchase schemas. Deprecate/remove `POST /tickets/:ticketId/checkout`.

**Rationale:** Matches locked product; allocation is the sellable unit.

**Alternative rejected:** Keep ticket-id checkout and add quantity param — fights 1:1 model and reservation semantics.

### 3. Fee on subtotal

```typescript
const subtotalCents = quantity * allocation.priceCents;
const feeCents = Math.round((subtotalCents * feePercent) / 100); // half-up for positive
const amountCents = subtotalCents + feeCents;
const netCents = subtotalCents;
```

Unit tests lock half-up boundaries and "not per-ticket then sum" case (e.g. 2×1005 at 10% → fee 201 not 202).

### 4. Reservation and failure release

On checkout success path inside txn: lock allocation → compute remaining (allocation qty − non-void tickets; event capacity − non-void for event; per-user headroom) → if `quantity > remaining` return 4xx with remaining → else create N unpaid tickets + Purchase.

On `payment_failed` / `canceled` / TTL: DELETE unpaid tickets with that `purchaseId` (hard delete reserved holds). Paid tickets never deleted by these paths.

**Rationale:** DELETE frees slots cleanly; void of paid tickets stays soft-void and does not rewrite purchase totals.

**Alternative rejected:** Soft-void reserved unpaid on failure — pollutes guest/ops views and complicates "remaining" math.

### 5. Void while purchase open

If void targets an unpaid ticket on `requires_payment` Purchase: cancel whole purchase (PI cancel + Purchase `canceled` + delete remaining unpaid reserved tickets). Avoids PI amount / ticket count mismatch mid-checkout.

**Rationale:** Simpler than resizing PaymentIntent mid-flight.

### 6. TTL sweep on existing worker

Register typed queue job (repeatable every ~1 min or similar) in worker process. Query `requires_payment` where `createdAt < now() - PURCHASE_TTL_MINUTES`. Process each with same release helper as webhook cancel path.

**Rationale:** Reuses BullMQ; no Redis mutex for checkout.

### 7. FE buy flow

Quantity selector on allocation buy surface → checkout API → existing Payment Element pattern (may keep `/app/tickets/$id/pay` as redirect-to-purchase or move to `/app/events/$eventId/buy` / purchase pay route). Success lists all purchase tickets + QRs. Guest list groups by `purchaseId` then holder.

## Risks / Trade-offs

- [Migration rename breaks API/clients] → Update contracts + FE in same change; migration tested against seed copy
- [Abandoned holds starve inventory] → TTL default 5 minutes + failed/canceled DELETE path
- [Concurrent oversell] → `SELECT FOR UPDATE` on allocation; tests for concurrent buys
- [Void mid-open purchase cancels whole cart] → Documented; prefer cancel-all over PI resize
- [Capability folder stays `ticket-payments` while model is Purchase] → Avoids orphaning main spec path; purpose text updated at archive

## Migration Plan

1. Deploy Prisma migration (rename + backfill + indexes) with expand/contract if needed for zero-downtime; otherwise single deploy with API rename
2. Ship API + contracts + worker TTL together so open checkouts use Purchase
3. Ship FE quantity + multi-QR + guest grouping
4. Rollback: reverse migration only if verified down path exists; otherwise restore from pre-migrate backup / seeded verification copy
5. Confirm legacy single paid ticket still shows same QR/`paidAt` after rename

## Open Questions

None — product decisions locked in proposal.
