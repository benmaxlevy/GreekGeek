# stripe-connect Specification

## Purpose

Organization-scoped Stripe Connect Express onboarding and status sync so host chapters can become charge-ready before paid ticket sales, using hosted redirect flows and webhook-driven flags without exposing Stripe secrets to the client.

## Requirements

### Requirement: Stripe server configuration is required at boot

The API MUST require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION`, and `APP_URL` via Zod env validation at boot. `STRIPE_API_VERSION` MUST pin the Stripe API v2 preview version in use at implementation time (documented in `.env.example` that implementer sets current latest v2 preview). `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` MUST NOT be exposed to the web client or any public bundle.

#### Scenario: API boots with valid Stripe env

- **WHEN** the API starts with all required Stripe env vars set
- **THEN** the Stripe client initializes with the pinned API version

#### Scenario: API fails fast without STRIPE_SECRET_KEY

- **WHEN** the API boots without a valid `STRIPE_SECRET_KEY`
- **THEN** startup fails with a clear configuration error

#### Scenario: Web bundle contains no Stripe secret

- **WHEN** the web app is built for production
- **THEN** no `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or server-only Stripe values appear in client assets

### Requirement: Connect account is created idempotently per organization

The system MUST create at most one Stripe Connect account per organization. Creation MUST call Stripe `POST /v2/core/accounts` with: `identity.country` `"us"`, `entity_type` `company`, `configuration.recipient` and `configuration.merchant` enabled, `dashboard` `"express"`, and `defaults.responsibilities.losses_collector` `"application"`. Currency MUST be USD. If the organization already has `stripeAccountId`, the system MUST reuse that account and MUST NOT create a second Stripe account.

#### Scenario: First connect for org creates account

- **WHEN** an authorized actor starts Connect for an organization with no `stripeAccountId`
- **THEN** Stripe receives a v2 account create with company US recipient+merchant Express settings and the returned account id is persisted on the organization before any redirect

#### Scenario: Existing stripeAccountId reused

- **WHEN** an authorized actor starts Connect for an organization that already has `stripeAccountId`
- **THEN** no new Stripe account is created and the existing id is used for onboarding links

#### Scenario: stripeAccountId is unique across orgs

- **WHEN** two organizations would share the same `stripeAccountId`
- **THEN** the database unique constraint prevents the duplicate binding

### Requirement: Hosted onboarding uses account links with return and refresh routes

The system MUST create onboarding links via Stripe `POST /v2/core/account_links` with `use_case.type` `account_onboarding` and configurations `recipient` and `merchant`. `return_url` and `refresh_url` MUST be derived from `APP_URL`. The authorized officer MUST be redirected to `link.url` (hosted onboarding only — no embedded Connect components). `refresh_url` MUST mint a fresh account link when the prior link expired or was already used. `return_url` MUST trigger a server-side refetch of the Stripe account and update organization flags from Stripe response data; redirect alone MUST NOT be treated as proof of readiness. Re-verification after initial onboarding MUST use `use_case.type` `account_update` with the same configuration set.

#### Scenario: Officer redirected to Stripe hosted onboarding

- **WHEN** an authorized actor requests onboarding for an org with a persisted `stripeAccountId`
- **THEN** the response redirects the browser to a Stripe-hosted account link URL

#### Scenario: Refresh route mints new link

- **WHEN** an officer hits the refresh URL after an expired or consumed link
- **THEN** the system creates a new account link and redirects to Stripe

#### Scenario: Return route refetches account

- **WHEN** an officer returns from Stripe to the return URL
- **THEN** the server fetches the current Stripe account and updates organization flags from that data

#### Scenario: Re-verification uses account_update

- **WHEN** an authorized actor requests onboarding for an org that already completed initial onboarding but has outstanding requirements
- **THEN** the account link `use_case.type` is `account_update`

### Requirement: Connect status is readable by authorized actors

The system MUST expose organization Connect status including at minimum: `stripeAccountId` (nullable), `stripeChargesEnabled`, `stripePayoutsEnabled`, the Stripe transfers capability readiness, `stripeDetailsSubmitted`, `stripeRequirementsDue`, and `stripeAccountUpdatedAt`. Status reads MUST require platform ADMIN or `payments.manage` on the target organization. Callers without permission MUST receive 403 and MUST NOT receive onboarding CTAs from the API. Connect status MUST be sourced from the organization's Stripe Accounts v2 account and capability data, not client input.

#### Scenario: Officer with payments.manage reads status

- **WHEN** a member with `payments.manage` for org O requests Connect status for org O
- **THEN** the response includes current charges, payouts, transfers capability, details, and requirements state

#### Scenario: Member without payments.manage denied

- **WHEN** a member without `payments.manage` (and not ADMIN) requests Connect status
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin reads any org status

- **WHEN** platform ADMIN requests Connect status for any organization
- **THEN** the response includes current Stripe-derived flags and transfer capability state

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

### Requirement: Webhook handlers sync account flags via existing inbox

Stripe `account.*` and `capability.*` events MUST be processed through the existing webhook inbox and BullMQ worker (no parallel ingest path). Handlers MUST resolve the organization by `stripeAccountId` and update `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted`, `stripeRequirementsDue`, and `stripeAccountUpdatedAt` from Stripe account data only. Manual API MUST NOT allow writing these flags. For out-of-order or stale events, the handler MUST refetch the account from Stripe or compare event/account timestamps and MUST NOT regress flags to a less-ready state.

#### Scenario: Account updated webhook flips charges enabled

- **WHEN** a verified `account.updated` (or equivalent capability) webhook is processed for a known `stripeAccountId` and Stripe reports charges enabled
- **THEN** the organization's `stripeChargesEnabled` becomes true and `stripeAccountUpdatedAt` is updated

#### Scenario: Unknown stripeAccountId ignored without error storm

- **WHEN** a webhook references a `stripeAccountId` not bound to any organization
- **THEN** the handler completes without retry storm and does not mutate org rows

#### Scenario: Stale event does not regress flags

- **WHEN** an older webhook would set `stripeChargesEnabled` false but a newer `stripeAccountUpdatedAt` or refetched account shows charges enabled
- **THEN** `stripeChargesEnabled` remains true

#### Scenario: Admin cannot override flags via API

- **WHEN** platform ADMIN calls any organization update endpoint with Stripe flag fields
- **THEN** those flag fields are not writable and remain sourced from Stripe only

### Requirement: Sale readiness is defined by stripeChargesEnabled

An organization is sale-ready for paid ticketing when `stripeChargesEnabled` is true. `stripePayoutsEnabled` and `stripeDetailsSubmitted` MUST be stored and displayed but MUST NOT alone satisfy paid-sale gates in this phase.

#### Scenario: Charges enabled means sale-ready

- **WHEN** an organization has `stripeChargesEnabled` true
- **THEN** paid allocation and on_sale gates (defined in `ticketing`) pass for that host org

#### Scenario: Details submitted without charges not sale-ready

- **WHEN** an organization has `stripeDetailsSubmitted` true but `stripeChargesEnabled` false
- **THEN** paid allocation and on_sale gates remain blocked

### Requirement: Org payments settings UI reflects Connect state

The web app MUST provide organization payments settings showing one of: not started (no `stripeAccountId`), requirements due (`stripeRequirementsDue` non-empty or charges not enabled with outstanding requirements), ready (`stripeChargesEnabled` true), or restricted (charges disabled with blocking requirements). Users with `payments.manage` on the org MUST see a "Connect payout account" (or equivalent) CTA that starts the hosted flow. Users without `payments.manage` MUST see messaging to ask an officer with payments access and MUST NOT see the Connect CTA.

#### Scenario: Officer with payments.manage sees Connect CTA when not ready

- **WHEN** a member with `payments.manage` opens org payments settings and the org is not charge-ready
- **THEN** a Connect CTA is shown and starts hosted onboarding on action

#### Scenario: Member without payments.manage sees ask-officer message

- **WHEN** a member without `payments.manage` opens org payments settings
- **THEN** no Connect CTA is shown and copy directs them to an officer with payments access

#### Scenario: Ready state after webhook sync

- **WHEN** webhooks have set `stripeChargesEnabled` true
- **THEN** the payments settings UI shows ready state without requiring another manual refresh beyond normal data fetch
