## ADDED Requirements

### Requirement: Organization stores Stripe Connect account binding and status

The system MUST persist on Organization: nullable unique `stripeAccountId`, boolean `stripeChargesEnabled` default false, boolean `stripePayoutsEnabled` default false, boolean `stripeDetailsSubmitted` default false, jsonb `stripeRequirementsDue`, and nullable `stripeAccountUpdatedAt`. The Stripe Connect account MUST be bound to the Organization record, not to any User. These fields MUST be readable on organization responses for authorized callers per `stripe-connect` and `org-permissions` rules. They MUST NOT be writable through organization create/update APIs except `stripeAccountId` assignment during Connect account creation flow (server-side only).

#### Scenario: New organization has default Stripe fields

- **WHEN** an organization is created
- **THEN** `stripeAccountId` is null and all Stripe boolean flags default false

#### Scenario: stripeAccountId unique when set

- **WHEN** Connect account creation persists `stripeAccountId` on an organization
- **THEN** no other organization may hold the same `stripeAccountId`

#### Scenario: Stripe flags not writable via org CRUD

- **WHEN** a client attempts to PATCH organization with `stripeChargesEnabled` or related Stripe flags
- **THEN** the system ignores or rejects those fields and flags remain Stripe-sourced only
