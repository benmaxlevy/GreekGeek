## ADDED Requirements

### Requirement: Admin views organization Stripe Connect status from dashboard

The admin dashboard MUST show per-organization Stripe Connect status on the organization detail or list surface: `stripeAccountId` (nullable), `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted`, `stripeRequirementsDue`, and `stripeAccountUpdatedAt`. Platform ADMIN MUST be able to generate a hosted onboarding link for an organization (same server flow as officer Connect, subject to ADMIN bypass on permission checks). The admin UI MUST NOT provide controls to manually set or override Stripe readiness flags. Styling MUST match existing obsidian-glass admin pages. Non-admin users MUST be blocked from admin Stripe Connect controls.

#### Scenario: Admin views org Stripe status

- **WHEN** an ACTIVE platform ADMIN opens an organization's admin detail
- **THEN** current Stripe-derived flags and requirements are displayed read-only

#### Scenario: Admin generates onboarding link

- **WHEN** an ACTIVE platform ADMIN requests onboarding link generation for an organization
- **THEN** the UI receives a redirect URL or opens the hosted Stripe flow without mutating flags directly

#### Scenario: Admin cannot toggle charges enabled

- **WHEN** an ACTIVE platform ADMIN views organization Stripe settings
- **THEN** no control exists to manually set `stripeChargesEnabled` or related flags

#### Scenario: Non-admin blocked from admin Stripe controls

- **WHEN** a non-ADMIN user attempts to access admin Stripe Connect actions
- **THEN** the app redirects away without exposing those controls

## MODIFIED Requirements

### Requirement: Admin manages permission grants from dashboard

The admin dashboard MUST list the seeded permission catalog (read-only) and provide grant/revoke controls per membership for `ACTIVE` users only. The catalog listing MUST include `payments.manage` when seeded. Delegated grant/revoke by non-admin members is API-only this phase; admin UI covers ADMIN operations.

#### Scenario: Admin views permission catalog

- **WHEN** a platform ADMIN opens the permissions section
- **THEN** seeded permission keys are listed without catalog edit controls, including `payments.manage`

#### Scenario: Admin grants permission to active member from UI

- **WHEN** a platform ADMIN grants a catalog permission to an ACTIVE user's membership through the dashboard
- **THEN** the grant is reflected in the membership's permission list

#### Scenario: Admin revokes permission from UI

- **WHEN** a platform ADMIN revokes a permission from a membership through the dashboard
- **THEN** the grant is removed from the membership's permission list
