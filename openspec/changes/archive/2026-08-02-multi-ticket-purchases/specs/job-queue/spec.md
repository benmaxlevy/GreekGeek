## ADDED Requirements

### Requirement: Abandoned purchase TTL sweep runs on the worker

The job-queue worker MUST run a recurring or polled sweep that finds Purchases with `status` `requires_payment` older than `PURCHASE_TTL_MINUTES` (env, default **5**, Zod-validated at API/worker boot). For each expired Purchase the sweep MUST cancel the Stripe PaymentIntent, set Purchase `status` to `canceled`, and DELETE reserved unpaid tickets for that purchase so allocation and capacity slots are freed. The sweep MUST be idempotent: re-processing an already `canceled` Purchase MUST be a no-op. The typed queue map MUST include a queue name for this sweep (or a scheduled job on an existing typed queue). `.env.example` MUST document `PURCHASE_TTL_MINUTES`.

#### Scenario: Worker expires abandoned purchase

- **WHEN** the worker sweep runs and a Purchase has been `requires_payment` longer than `PURCHASE_TTL_MINUTES`
- **THEN** the PaymentIntent is canceled, Purchase becomes `canceled`, and unpaid tickets for that purchase are deleted

#### Scenario: Sweep skips non-open purchases

- **WHEN** the worker sweep runs and a Purchase status is `succeeded`, `failed`, or `canceled`
- **THEN** the sweep does not modify that Purchase or its tickets

#### Scenario: Sweep replay is idempotent

- **WHEN** the sweep encounters a Purchase already marked `canceled` after a prior expiry
- **THEN** no error is raised and ticket state remains unchanged
