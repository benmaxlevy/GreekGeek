## MODIFIED Requirements

### Requirement: Purchase persists multi-ticket checkout payment

The system MUST persist `Purchase` with: required `buyerUserId`, required `eventId`, required `allocationId`, required `quantity` (positive integer), required `subtotalCents`, required `feeCents`, required `amountCents`, required `netCents`, required `currency` (`usd`), required `status` enum `requires_payment` | `succeeded` | `failed` | `canceled` (`PurchaseStatus`), required unique `stripePaymentIntentId`, optional `stripeChargeId`, optional nullable `eventPayoutId` foreign key, optional nullable `payoutExcludedReason` enum `disputed` | `refunded` | `voided`, required `statusMismatch` boolean defaulting to false, and timestamps. Write paths MUST enforce `amountCents = subtotalCents + feeCents` and `netCents = subtotalCents`. The system MUST index `Purchase.eventId` and `Purchase.eventPayoutId`. Tickets belonging to a purchase MUST reference it via nullable `Ticket.purchaseId` (indexed); officer-issued and free tickets MUST have `purchaseId` null. The row MUST be updated in place when reusing an open PaymentIntent or when status changes. Creating checkout for the same buyer and allocation with an existing open `requires_payment` Purchase MUST reuse that PaymentIntent rather than create a duplicate. One purchase MUST cover exactly one event and one allocation. `eventPayoutId` MUST be nullable until a successful payout release attaches the purchase, and payout exclusion MUST apply to the whole Purchase rather than individual tickets.

#### Scenario: First checkout creates Purchase
- **WHEN** a buyer initiates checkout for an eligible allocation with quantity N and no open Purchase for that buyer and allocation
- **THEN** a Purchase row is created with quantity N, status requires_payment, payout fields null, and the Stripe PaymentIntent id

#### Scenario: Reopen checkout reuses open PaymentIntent
- **WHEN** a buyer initiates checkout and a Purchase with status requires_payment already exists for the same buyer and allocation
- **THEN** the existing PaymentIntent is returned and the Purchase row is updated if amounts or quantity changed

#### Scenario: stripePaymentIntentId uniqueness enforced
- **WHEN** the system attempts to create a second Purchase with an existing stripePaymentIntentId
- **THEN** the unique constraint prevents duplicate rows

#### Scenario: Amount invariant on write
- **WHEN** a Purchase is created or updated with subtotalCents 2000 and feeCents 200
- **THEN** amountCents is 2200 and netCents is 2000

#### Scenario: Purchase can attach to one payout
- **WHEN** a succeeded Purchase is included in a released EventPayout
- **THEN** eventPayoutId references that payout and the Purchase cannot be attached to another released payout

## ADDED Requirements

### Requirement: Purchase payout exclusion is per charge

The system MUST set `payoutExcludedReason` on a Purchase when its Stripe charge is disputed or refunded, or when its purchase is voided, and MUST leave clean purchases on the same event eligible. A multi-ticket Purchase MUST be excluded as one charge even when only one ticket is affected. Exclusion MUST be idempotent and MUST not rewrite the Purchase's historical subtotal, fee, amount, or net totals.

#### Scenario: Dispute excludes one purchase
- **WHEN** a succeeded Purchase's Stripe charge is disputed before release
- **THEN** its payoutExcludedReason becomes disputed and other succeeded purchases remain eligible

#### Scenario: Refund exclusion is idempotent
- **WHEN** the same refund notification is processed more than once
- **THEN** payoutExcludedReason remains refunded and no duplicate state transition occurs

#### Scenario: Void exclusion preserves totals
- **WHEN** a succeeded multi-ticket Purchase is voided
- **THEN** the whole Purchase is marked voided for payout eligibility while subtotalCents, feeCents, amountCents, and netCents remain unchanged
