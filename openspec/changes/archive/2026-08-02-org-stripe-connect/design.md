## Context

Webhook inbox (`redis-bullmq-webhook-inbox`, archived) provides Stripe signature verification, `WebhookEvent` persistence, and BullMQ async processing. Ticketing supports `priceCents` on allocations and sale status transitions but has no payment processor. Organizations have no Stripe fields yet. Org permissions seed excludes `payments.manage`. See proposal.md for locked product decisions.

## Goals / Non-Goals

**Goals:**

- Organization-bound Stripe Connect Express (company, US, USD) via Stripe API v2 preview
- Hosted onboarding only (redirect); server holds all secrets
- Idempotent one-account-per-org; flags synced from Stripe via existing inbox worker
- `payments.manage` permission separate from `tickets.manage`
- Server-enforced gates on paid allocations and `on_sale`; free ticketing unchanged
- Org payments settings + ticketing banners + admin read-only Stripe status with link generation

**Non-Goals:**

- Stripe Checkout, PaymentIntents, refunds/disputes UI
- Payout schedule/transfers management UI
- Embedded Connect components or publishable key on FE
- Manual flag override (including ADMIN)
- Currency other than USD
- New webhook ingest path (must use inbox)

## Decisions

### 1. Stripe SDK and API version

- Use official Stripe Node SDK configured with `apiVersion: process.env.STRIPE_API_VERSION`
- Implementer pins current latest **v2 preview** string at code time; document in `.env.example`
- All Connect calls use v2 paths: `POST /v2/core/accounts`, `POST /v2/core/account_links`, account retrieve on return/refetch

**Rationale:** User-locked v2 preview; env pin avoids drift across deploys.

**Alternative rejected:** Hardcode version in source — harder to bump without code change.

### 2. Organization schema

```prisma
model Organization {
  // existing fields...
  stripeAccountId          String?   @unique
  stripeChargesEnabled     Boolean   @default(false)
  stripePayoutsEnabled     Boolean   @default(false)
  stripeDetailsSubmitted   Boolean   @default(false)
  stripeRequirementsDue    Json?
  stripeAccountUpdatedAt   DateTime?
}
```

**Rationale:** Single row per chapter; unique `stripeAccountId` prevents cross-org binding bugs.

### 3. Account creation idempotency

Flow in transaction:

1. Load org with row lock.
2. If `stripeAccountId` set → skip create.
3. Else call Stripe `accounts.create` (v2 shape), persist `stripeAccountId` before returning onboarding link.

**Rationale:** Prevents duplicate Express accounts on double-click or retry.

### 4. Hosted onboarding routes

| Route | Role |
|-------|------|
| `POST /orgs/:orgId/stripe/connect` | Create account if needed + create account_link → redirect |
| `GET /orgs/:orgId/stripe/refresh` | New account_link → redirect (expired link recovery) |
| `GET /orgs/:orgId/stripe/return` | Retrieve account from Stripe → `syncOrgFromStripeAccount` → redirect to payments settings |

`return_url` / `refresh_url` built from `APP_URL` + stable paths.

Initial onboarding: `use_case.type = account_onboarding`. Re-verification when `stripeDetailsSubmitted` and requirements outstanding: `account_update`.

**Rationale:** Redirect alone unreliable; return handler refetch matches locked decision #9.

### 5. Flag sync helper

Central `syncOrgFromStripeAccount(orgId, account)` maps Stripe account + capabilities to:

- `stripeChargesEnabled` — from charges capability / `charges_enabled` equivalent in v2 shape
- `stripePayoutsEnabled` — payouts capability
- `stripeDetailsSubmitted` — details submitted signal from account
- `stripeRequirementsDue` — serializable requirements snapshot (currently_due, etc.)
- `stripeAccountUpdatedAt` — `account.updated` timestamp or `new Date()` on successful refetch

**Out-of-order protection:** Before write, if existing `stripeAccountUpdatedAt` is newer than incoming event timestamp, refetch account from Stripe and apply refetched state; never set `stripeChargesEnabled` false if refetch shows true.

**Rationale:** Webhooks can arrive out of order; refetch is source of truth.

### 6. Webhook handlers (inbox worker)

Register handlers in stripe module for types including (exact strings per Stripe v2 preview):

- `account.updated` (and related account events)
- Capability update events as emitted for recipient/merchant

Handler steps:

1. Parse `account` id from payload.
2. Find org by `stripeAccountId`; if none → log + return success (no retry storm).
3. Call `syncOrgFromStripeAccount` with event account snapshot or refetch.

**No new HTTP route** — ingest stays on existing `POST /webhooks/stripe`.

**Rationale:** Archived inbox AC; Connect only adds business handlers.

### 7. Permission: `payments.manage`

- Seed in `prisma/seed.ts` alongside existing keys
- `OrgPermissionGuard` on Connect routes with key `payments.manage`
- ADMIN bypass per existing guard pattern
- Separate from `tickets.manage` — no implication either direction

Connect CTAs hidden in FE when 403 on status/onboarding endpoints.

### 8. Sale gates (ticketing service)

Inject check before allocation persist and before `ticketSaleStatus` → `on_sale`:

```typescript
function assertHostOrgChargeReady(hostOrg: Organization, priceCents: number | null | undefined) {
  if ((priceCents ?? 0) <= 0) return;
  if (!hostOrg.stripeChargesEnabled) throw new UnprocessableEntityException('CONNECT_REQUIRED');
}
```

For `on_sale`: if any allocation on event has `priceCents > 0`, require host org `stripeChargesEnabled`.

**ADMIN does not bypass** — flags are not grantable.

**Rationale:** Locked decision; prevents admin workaround of Stripe compliance.

### 9. API module layout

```
apps/api/src/stripe/
  stripe.module.ts
  stripe.service.ts          # SDK client, account create, account links, retrieve
  stripe-connect.controller.ts
  stripe-webhook.handlers.ts # registered with webhook processor
  stripe-sync.ts             # syncOrgFromStripeAccount
```

Contracts in `packages/contracts/src/stripe-connect.ts` (Zod at HTTP boundary).

### 10. Frontend surfaces

| Surface | Path (suggested) | Gate |
|---------|------------------|------|
| Org payments settings | `/app/orgs/$orgId/payments` | `payments.manage` for CTA; read message only otherwise |
| Ticketing banners | existing ticket routes | `tickets.manage` sees banner; CTA only if also `payments.manage` |
| Admin org Stripe | `/admin/organizations/$orgId` section or column | ADMIN only |

No `STRIPE_PUBLISHABLE_KEY` in web env.

### 11. Env schema additions

```typescript
STRIPE_SECRET_KEY: z.string().min(1),
STRIPE_API_VERSION: z.string().min(1),
APP_URL: z.string().url(),
// STRIPE_WEBHOOK_SECRET already required
```

Worker process does not need `STRIPE_SECRET_KEY` unless handlers refetch (handlers run in worker — **worker needs STRIPE_SECRET_KEY** for refetch-on-stale).

## Risks / Trade-offs

- **[v2 preview API drift]** → Pin `STRIPE_API_VERSION`; integration tests against Stripe test mode; document bump procedure in `.env.example`
- **[Out-of-order webhooks]** → Refetch-on-stale in sync helper
- **[Officer confusion tickets vs payments]** → Separate permissions and distinct settings page
- **[ADMIN cannot force paid sales]** → Intentional; must complete Stripe onboarding
- **[Return URL before webhook]** → Return handler refetch gives immediate UX; webhook remains authoritative

## Migration Plan

1. Deploy migration adding Organization Stripe columns (defaults safe).
2. Deploy API with Connect routes + handlers; gates active immediately (blocks new paid allocations until onboarded).
3. Deploy web UI for settings and banners.
4. Seed `payments.manage`; officers grant to treasury role manually or via admin.
5. Rollback: revert gate checks in API if needed; Stripe columns nullable — no data loss.

## Open Questions

_(none — locked decisions cover entity type, API version, currency, onboarding mode, permissions, and non-goals)_
