## ADDED Requirements

### Requirement: Worker runs one fixed-key event payout sweep

The BullMQ worker MUST register a recurring event payout sweep using a fixed scheduler key shared by all API and worker replicas. The sweep MUST evaluate current `PAYOUT_HOLD_DAYS`, find eligible events, and invoke idempotent event payout release. Scheduler registration MUST prevent duplicate schedules across replicas. The sweep MUST use bounded retries and retain failed jobs for ADMIN inspection without logging payload PII.

#### Scenario: One scheduler exists across replicas
- **WHEN** multiple API or worker replicas start
- **THEN** they converge on one recurring event payout schedule rather than creating duplicate sweep schedules

#### Scenario: Sweep uses current hold configuration
- **WHEN** `PAYOUT_HOLD_DAYS` changes before a scheduled sweep
- **THEN** the sweep evaluates eligibility using the new environment value without row migration

#### Scenario: Sweep rerun is idempotent
- **WHEN** a scheduled sweep runs again after an event payout has released
- **THEN** it creates no duplicate payout and no duplicate Stripe transfer

#### Scenario: Failed payout job is retained safely
- **WHEN** payout processing exhausts bounded retries
- **THEN** the failed job remains inspectable, the payout contains a concise error, and logs omit payload values and PII
