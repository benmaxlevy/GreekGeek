## ADDED Requirements

### Requirement: Stripe payout and purchase-risk events update payout state through inbox

The existing verified Stripe webhook inbox and worker MUST register idempotent handlers for `charge.dispute.created`, `charge.refunded`, `transfer.created`, `transfer.failed`, and relevant Stripe payout failure events. Charge handlers MUST resolve the Purchase by Stripe charge or payment metadata, set its `payoutExcludedReason` (`disputed` or `refunded`), and flag exposure when that Purchase is attached to a released EventPayout. Transfer handlers MUST resolve the payout by transfer id or metadata and update its status and error state without rewriting a released amount. Unknown charge or transfer identifiers MUST complete without retry storms. No parallel webhook ingest route is allowed.

#### Scenario: Dispute excludes purchase before release
- **WHEN** the worker processes charge.dispute.created for a succeeded Purchase not attached to a released payout
- **THEN** the Purchase is marked disputed and its net proceeds are removed from future payout eligibility

#### Scenario: Refund excludes purchase
- **WHEN** the worker processes charge.refunded for a known Purchase
- **THEN** the Purchase is marked refunded and the handler is safe to replay

#### Scenario: Post-release dispute flags exposure
- **WHEN** charge.dispute.created references a Purchase on a released EventPayout
- **THEN** the released payout is flagged for admin follow-up, its amount remains unchanged, and no reverse transfer is created

#### Scenario: Transfer success updates payout
- **WHEN** transfer.created references a known EventPayout
- **THEN** the payout records the Stripe transfer identity and reaches the appropriate released state idempotently

#### Scenario: Transfer failure updates payout
- **WHEN** transfer.failed or a relevant payout failure event references a known EventPayout
- **THEN** the payout records failed status and a concise error for bounded retry and ADMIN visibility

#### Scenario: Unknown payout event is a no-op
- **WHEN** a valid Stripe charge or transfer event has no matching Purchase or EventPayout
- **THEN** the worker marks the inbox event processed without mutating business state or retry storm
