## 1. Data + contracts + env + seed payments.manage

- [x] 1.1 Add Organization Stripe fields to Prisma (`stripeAccountId` unique nullable, booleans default false, `stripeRequirementsDue` jsonb, `stripeAccountUpdatedAt`); generate and apply migration
- [x] 1.2 Extend Zod env schema: `STRIPE_SECRET_KEY`, `STRIPE_API_VERSION`, `APP_URL` (document v2 preview pin in `.env.example`); ensure worker boot validates `STRIPE_SECRET_KEY` for refetch handlers
- [x] 1.3 Add `packages/contracts/src/stripe-connect.ts`: Connect status response, onboarding redirect response, org Stripe fields on Organization DTOs; validate at HTTP boundaries
- [x] 1.4 Seed `payments.manage` in `apps/api/prisma/seed.ts`
- [x] 1.5 Commit: `add org stripe fields contracts env and payments.manage seed`

## 2. Connect API (create/link/return/refresh/status) + perm checks

- [ ] 2.1 Install/configure Stripe SDK with `STRIPE_API_VERSION`; `stripe.module.ts` + `stripe.service.ts` (v2 account create, account links, account retrieve)
- [ ] 2.2 `POST` connect: idempotent account create (company US recipient+merchant Express), persist `stripeAccountId`, create account_link, redirect to hosted URL
- [ ] 2.3 `GET` refresh: mint fresh account_link → redirect
- [ ] 2.4 `GET` return: retrieve account, `syncOrgFromStripeAccount`, redirect to org payments settings
- [ ] 2.5 `GET` status: return Stripe-derived org fields; guard with `payments.manage` or ADMIN
- [ ] 2.6 `OrgPermissionGuard` on all Connect routes; 403 without CTA payload for unauthorized callers
- [ ] 2.7 Commit: `add stripe connect api routes and permission guards`

## 3. Webhook handlers for account/capability → org flags

- [ ] 3.1 Implement `syncOrgFromStripeAccount` with out-of-order protection (timestamp compare or refetch)
- [ ] 3.2 Register inbox worker handlers for Stripe account/capability events; resolve org by `stripeAccountId`
- [ ] 3.3 Unknown `stripeAccountId` → log and complete without retry storm
- [ ] 3.4 Integration tests: webhook updates flags; stale event does not regress; unknown account no-op
- [ ] 3.5 Commit: `add stripe connect webhook handlers and sync`

## 4. Sale gates (allocation + on_sale)

- [ ] 4.1 Gate allocation create/update: `priceCents > 0` requires host org `stripeChargesEnabled`; 4xx with clear error code/message
- [ ] 4.2 Gate `ticketSaleStatus` → `on_sale` when any allocation has `priceCents > 0`
- [ ] 4.3 ADMIN does not bypass gates
- [ ] 4.4 Integration tests: paid blocked / free allowed / on_sale matrix
- [ ] 4.5 Commit: `gate paid ticketing on stripe charges enabled`

## 5. FE org settings + banners + admin

- [ ] 5.1 Org payments settings page: not started / requirements due / ready / restricted states; Connect CTA for `payments.manage`; ask-officer copy otherwise
- [ ] 5.2 Ticketing UI: blocking banner on paid allocation + on_sale when host org not ready; CTA gated on `payments.manage`
- [ ] 5.3 Admin org detail: read-only Stripe status columns; generate onboarding link action (no flag toggles)
- [ ] 5.4 Admin permissions UI lists `payments.manage` for grant/revoke
- [ ] 5.5 Commit: `add stripe connect org settings ticketing banners and admin ui`

## 6. Verification / demos

- [ ] 6.1 Demo: officer without Connect blocked on paid allocation; free allocation succeeds
- [ ] 6.2 Demo: complete hosted onboarding (test mode) → webhook/refetch flips `stripeChargesEnabled` → paid allocation allowed
- [ ] 6.3 Demo: `on_sale` with paid allocation blocked then allowed after ready
- [ ] 6.4 Demo: user without `payments.manage` sees ask-officer message, no CTA
- [ ] 6.5 Demo: admin views status and generates link without manual flag override
- [ ] 6.6 Mark all tasks complete; archive when shipped
