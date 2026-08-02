## 1. Data + contracts + env + seed payments.manage

- [x] 1.1 Add Organization Stripe fields to Prisma (`stripeAccountId` unique nullable, booleans default false, `stripeRequirementsDue` jsonb, `stripeAccountUpdatedAt`); generate and apply migration
- [x] 1.2 Extend Zod env schema: `STRIPE_SECRET_KEY`, `STRIPE_API_VERSION`, `APP_URL` (document v2 preview pin in `.env.example`); ensure worker boot validates `STRIPE_SECRET_KEY` for refetch handlers
- [x] 1.3 Add `packages/contracts/src/stripe-connect.ts`: Connect status response, onboarding redirect response, org Stripe fields on Organization DTOs; validate at HTTP boundaries
- [x] 1.4 Seed `payments.manage` in `apps/api/prisma/seed.ts`
- [x] 1.5 Commit: `add org stripe fields contracts env and payments.manage seed`

## 2. Connect API (create/link/return/refresh/status) + perm checks

- [x] 2.1 Install/configure Stripe SDK with `STRIPE_API_VERSION`; `stripe.module.ts` + `stripe.service.ts` (v2 account create, account links, account retrieve)
- [x] 2.2 `POST` connect: idempotent account create (company US recipient+merchant Express), persist `stripeAccountId`, create account_link, redirect to hosted URL
- [x] 2.3 `GET` refresh: mint fresh account_link → redirect
- [x] 2.4 `GET` return: retrieve account, `syncOrgFromStripeAccount`, redirect to org payments settings
- [x] 2.5 `GET` status: return Stripe-derived org fields; guard with `payments.manage` or ADMIN
- [x] 2.6 `OrgPermissionGuard` on all Connect routes; 403 without CTA payload for unauthorized callers
- [x] 2.7 Commit: `add stripe connect api routes and permission guards`

## 3. Webhook handlers for account/capability → org flags

- [x] 3.1 Implement `syncOrgFromStripeAccount` with out-of-order protection (timestamp compare or refetch)
- [x] 3.2 Register inbox worker handlers for Stripe account/capability events; resolve org by `stripeAccountId`
- [x] 3.3 Unknown `stripeAccountId` → log and complete without retry storm
- [x] 3.4 Integration tests: webhook updates flags; stale event does not regress; unknown account no-op
- [x] 3.5 Commit: `add stripe connect webhook handlers and sync`

## 4. Sale gates (allocation + on_sale)

- [x] 4.1 Gate allocation create/update: `priceCents > 0` requires host org `stripeChargesEnabled`; 4xx with clear error code/message
- [x] 4.2 Gate `ticketSaleStatus` → `on_sale` when any allocation has `priceCents > 0`
- [x] 4.3 ADMIN does not bypass gates
- [x] 4.4 Integration tests: paid blocked / free allowed / on_sale matrix
- [x] 4.5 Commit: `gate paid ticketing on stripe charges enabled`

## 5. FE org settings + banners + admin

- [x] 5.1 Org payments settings page: not started / requirements due / ready / restricted states; Connect CTA for `payments.manage`; ask-officer copy otherwise
- [x] 5.2 Ticketing UI: blocking banner on paid allocation + on_sale when host org not ready; CTA gated on `payments.manage`
- [x] 5.3 Admin org detail: read-only Stripe status columns; generate onboarding link action (no flag toggles)
- [x] 5.4 Admin permissions UI lists `payments.manage` for grant/revoke
- [x] 5.5 Commit: `add stripe connect org settings ticketing banners and admin ui`

## 6. Verification / demos

- [x] 6.1 Demo: officer without Connect blocked on paid allocation; free allocation succeeds
- [x] 6.2 Demo: complete hosted onboarding (test mode) → webhook/refetch flips `stripeChargesEnabled` → paid allocation allowed
- [x] 6.3 Demo: `on_sale` with paid allocation blocked then allowed after ready
- [x] 6.4 Demo: user without `payments.manage` sees ask-officer message, no CTA
- [x] 6.5 Demo: admin views status and generates link without manual flag override
- [x] 6.6 Mark all tasks complete; archive when shipped
