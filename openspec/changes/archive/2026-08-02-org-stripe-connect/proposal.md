## Why

Ticketing supports paid allocations (`priceCents > 0`) but has no payment processor — hosts cannot legally collect card revenue. Host organizations need Stripe Connect Express onboarding so GreekGeek can gate paid ticket sales until Stripe confirms charges are enabled, without building Checkout or payout UI in this phase.

## What Changes

### Config and secrets

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (existing inbox), pinned `STRIPE_API_VERSION` (Stripe API v2 preview — implementer pins current latest at code time), `APP_URL`
- All Stripe keys server-side only; never in web bundle

### Organization schema

- `stripeAccountId` (unique, nullable), `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted` (default false), `stripeRequirementsDue` (jsonb), `stripeAccountUpdatedAt`
- Account bound to Organization, never user

### Connect account lifecycle

- Idempotent `POST /v2/core/accounts`: `entity_type` company, `identity.country` US, `configuration.recipient` + `configuration.merchant`, Express dashboard, `defaults.responsibilities.losses_collector: application`
- Persist `stripeAccountId` before redirect; never two accounts per org
- Hosted onboarding via `POST /v2/core/account_links` (`account_onboarding`, configurations recipient+merchant); `return_url` re-fetches account from Stripe; `refresh_url` mints fresh link; later re-verification uses `account_update`
- Redirect alone never flips flags — only Stripe data (webhook worker or explicit refetch)

### Status sync

- Stripe `account.*` / `capability.*` events → existing webhook inbox → BullMQ worker updates org flags and `stripeAccountUpdatedAt`
- Out-of-order events: refetch account or compare timestamps — never regress flags
- Flags written only from Stripe data — no manual override including ADMIN

### Permission

- Seed `payments.manage` separate from `tickets.manage`; ADMIN bypasses; else require permission on target org; missing → 403 and no CTA

### Sale gates (server-enforced)

- Allocation create/update with `priceCents > 0` → 4xx unless host org `stripeChargesEnabled`
- `on_sale` transition with any paid allocation → 4xx unless enabled
- `priceCents = 0` unaffected

### UI

- Org payments settings: not started / requirements due / ready / restricted; CTA to hosted flow
- Paid allocation and on_sale forms: blocking banner + CTA when not ready
- Users without `payments.manage`: "ask an officer with payments access" — no CTA
- Admin: per-org Stripe status, generate onboarding link; cannot fake flags

### Non-goals

- Payouts/schedule/transfers UI, refunds/disputes UI, Stripe Checkout itself (Connect readiness only)
- Embedded Connect components; publishable key on FE
- Currency other than USD

## Capabilities

### New Capabilities

- `stripe-connect`: Organization-bound Stripe Express Connect account creation, hosted onboarding links, status read API, webhook-driven flag sync via existing inbox/worker, and sale-readiness semantics

### Modified Capabilities

- `organizations`: Stripe Connect fields on Organization model and API exposure for status reads
- `org-permissions`: Seed `payments.manage`; gate Connect and payments settings separately from `tickets.manage`
- `ticketing`: Server gates on paid allocations and `on_sale` when host org charges not enabled; UI blocking banners
- `admin-dashboard`: ADMIN per-org Stripe status and onboarding-link generation (no flag override)

## Impact

- **apps/api**: Prisma Organization Stripe fields; `stripe` module (v2 SDK, env); Connect routes (create/link/return/refresh/status); webhook handlers for account/capability events; ticketing gate middleware/service; seed `payments.manage`; integration tests
- **packages/contracts**: Connect request/response Zod schemas; extended Organization DTOs; gate error shapes
- **apps/web**: Org payments settings page; paid-allocation / on_sale banners; admin org Stripe panel
- **.env.example**: `STRIPE_SECRET_KEY`, `STRIPE_API_VERSION`, `APP_URL` (alongside existing `STRIPE_WEBHOOK_SECRET`)
- **Dependency**: Reuses archived `webhook-inbox` + `job-queue` — no new ingest path
