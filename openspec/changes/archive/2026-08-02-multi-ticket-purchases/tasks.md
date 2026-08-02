## 1. Schema and migration

- [x] 1.1 Rename Prisma `TicketPayment` → `Purchase`, enum `TicketPaymentStatus` → `PurchaseStatus`; add purchase fields (`buyerUserId`, `eventId`, `allocationId`, `quantity`, `subtotalCents`, `feeCents`, `amountCents`, `netCents`, `currency`, `status`, `stripePaymentIntentId` unique, `stripeChargeId`, `statusMismatch`, timestamps)
- [x] 1.2 Add nullable `Ticket.purchaseId` FK + indexes on `Purchase.eventId` and `Ticket.purchaseId`; drop payment-side `ticketId` unique
- [x] 1.3 Write migration: existing rows 1:1 → Purchase `quantity=1`; backfill `Ticket.purchaseId`; derive `eventId`/`allocationId` via ticket→allocation; keep status/`statusMismatch`; reversible or verified against seeded copy; no data loss
- [x] 1.4 Enforce write invariant helpers: `amountCents = subtotalCents + feeCents`, `netCents = subtotalCents`

## 2. Env and contracts

- [x] 2.1 Zod-validate `MAX_TICKETS_PER_USER_PER_EVENT` (default 2) and `PURCHASE_TTL_MINUTES` (default 5) at API/worker boot; confirm `.env.example` documents both (no `MAX_TICKETS_PER_PURCHASE`)
- [x] 2.2 Replace `packages/contracts` ticket-checkout schemas with purchase checkout (`allocationId` + `quantity`) request/response DTOs including itemized breakdown fields
- [x] 2.3 Update fee helper to compute on `subtotalCents = quantity * priceCents` with half-up rounding

## 3. Purchase checkout API

- [x] 3.1 Rename/refactor `ticket-payments.service` → purchase service; add `POST` checkout by `allocationId` + `quantity` with Zod parse at boundary
- [x] 3.2 Enforce preconditions: ticketing enabled, on_sale, allocation active, host `stripeChargesEnabled`, buyer eligible (own org or public pool); 403 when ineligible including ADMIN
- [x] 3.3 Atomic reservation: interactive txn + `SELECT FOR UPDATE` on allocation; create N unpaid tickets only if allocation remaining AND event capacity AND per-user headroom allow; over-request → 4xx with remaining count; no partial fulfillment
- [x] 3.4 Create/reuse open `requires_payment` Purchase for same buyer+allocation; one PI for `amountCents`; metadata `purchaseId`, `eventId`, `quantity`; idempotency key per purchase; DB lock only
- [x] 3.5 Set `holderUserId` = buyer on all reserved tickets; `purchaseId` set; officer-issued/free paths keep `purchaseId` null

## 4. Webhooks and void

- [x] 4.1 Update `stripe-payment-webhook.handlers`: succeeded → Purchase `succeeded`, capture `stripeChargeId`, flip all unpaid purchase tickets → paid + `paidAt` in one txn; idempotent replay
- [x] 4.2 Failed/canceled → Purchase failed/canceled; DELETE reserved unpaid tickets to free slots; void-ticket success path sets `statusMismatch`
- [x] 4.3 Void unpaid ticket on open Purchase cancels whole purchase (PI + release remaining reserved tickets); void of paid ticket does not alter purchase totals

## 5. TTL worker

- [x] 5.1 Register typed queue/repeatable job for abandoned purchase sweep on existing worker
- [x] 5.2 Sweep: `requires_payment` older than `PURCHASE_TTL_MINUTES` → cancel PI, Purchase `canceled`, DELETE unpaid reserved tickets; idempotent

## 6. Frontend

- [x] 6.1 Quantity selector on buy flow bounded by remaining allocation and per-user headroom; call purchase checkout API
- [x] 6.2 Itemized summary (e.g. `2 × $10.00 = $20.00`, Rally fee, Total); keep embedded Payment Element; prevent double-submit
- [x] 6.3 Success shows all N tickets with QR codes; paidAt/QR behavior unchanged for legacy single tickets
- [x] 6.4 Officer guest list groups tickets by purchase/buyer

## 7. Tests

- [x] 7.1 Unit: fee math on subtotal, half-up boundaries, and not-per-ticket-then-sum case
- [x] 7.2 Integration: buy N reserves exactly N; concurrent buys cannot oversell allocation or event capacity
- [x] 7.2b Integration: when all remaining seats are held unpaid on buyer A's open purchase, buyer B checkout fails (remaining 0); holds block others until release/pay
- [x] 7.3 Integration: over-request rejected with remaining count; per-user cap enforced
- [x] 7.4 Integration: webhook flips all N tickets once; replay no-op; failed/expired purchase releases all reserved tickets
- [x] 7.5 Migration test: legacy single payment renders identically after rename (paidAt + QR)

## 8. Demo

- [x] 8.1 Record demo: buyer purchases 2 tickets in one embedded checkout → single PI → both flip paid → 2 QRs scan → abandoned purchase releases held seats
