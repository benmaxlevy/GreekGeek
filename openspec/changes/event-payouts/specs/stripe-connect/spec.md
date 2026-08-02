## MODIFIED Requirements

### Requirement: Connect status is readable by authorized actors

The system MUST expose organization Connect status including at minimum: `stripeAccountId` (nullable), `stripeChargesEnabled`, `stripePayoutsEnabled`, the Stripe transfers capability readiness, `stripeDetailsSubmitted`, `stripeRequirementsDue`, and `stripeAccountUpdatedAt`. Status reads MUST require platform ADMIN or `payments.manage` on the target organization. Callers without permission MUST receive 403 and MUST NOT receive onboarding CTAs from the API. Connect status MUST be sourced from the organization's Stripe Accounts v2 account and capability data, not client input.

#### Scenario: Officer with payments.manage reads status
- **WHEN** a member with `payments.manage` for org O requests Connect status for org O
- **THEN** the response includes current charges, payouts, transfers capability, details, and requirements state

#### Scenario: Member without payments.manage denied
- **WHEN** a member without `payments.manage` (and not ADMIN) requests Connect status
- **THEN** the system returns 403 and no payout readiness details

#### Scenario: Admin reads any org status
- **WHEN** platform ADMIN requests Connect status for any organization
- **THEN** the response includes current Stripe-derived flags and transfer capability state

## ADDED Requirements

### Requirement: Host organization is payout-ready only with payouts and transfers capability

An event payout destination MUST be considered usable only when the host organization's Accounts v2 Connect account has a non-null `stripeAccountId`, `stripePayoutsEnabled` true, and the Stripe transfers capability enabled. Missing or false readiness MUST block automatic and manual payout release with an admin-visible reason. Invited organizations' readiness MUST NOT affect the host payout destination.

#### Scenario: Payout-ready host can receive transfer
- **WHEN** the host organization has a bound Accounts v2 account with payouts enabled and transfers capability enabled
- **THEN** the event can pass the Connect readiness gate

#### Scenario: Host missing payout readiness is blocked
- **WHEN** the host organization lacks a usable account, payouts enabled flag, or transfers capability
- **THEN** the payout is blocked with a reason identifying the missing readiness condition and Stripe is not called

#### Scenario: Invited-org readiness does not gate host
- **WHEN** an invited organization has no payout-ready Connect account but the host is payout-ready
- **THEN** invited sales remain included in the host event's net payout

### Requirement: Payout readiness follows Stripe webhook synchronization

The existing Stripe webhook inbox handlers MUST update payout readiness from verified Stripe account and capability data. Manual API callers, including ADMIN, MUST NOT set payout readiness flags directly. Stale or out-of-order account events MUST NOT regress a newer ready state.

#### Scenario: Capability webhook enables payout readiness
- **WHEN** a verified account or capability webhook reports payouts and transfers capability enabled
- **THEN** the organization status reflects payout readiness for subsequent payout eligibility queries

#### Scenario: Admin cannot override payout readiness
- **WHEN** ADMIN submits an organization update containing payout readiness fields
- **THEN** those fields are ignored or rejected and remain Stripe-sourced
