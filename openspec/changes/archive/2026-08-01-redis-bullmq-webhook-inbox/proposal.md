## Why

GreekGeek needs durable async job processing before payment webhooks land. Stripe (and future providers) must accept HTTP quickly, persist events idempotently, and process them in a separate worker with retries — without blocking API requests or losing events on crash.

## What Changes

### Slice 0 — Redis + BullMQ infra

- `docker-compose.yml`: add Redis service (`redis:7-alpine` pinned), named volume, port mapped for local dev; keep existing Postgres — one-command local stack
- `REDIS_URL` in env + `.env.example`; API fails fast at boot if missing (Zod env schema)
- Install `bullmq` + `@nestjs/bullmq`
- Shared queue module registers Redis connection once; queue names in a typed const map (not string literals)
- Default job opts: retries with exponential backoff, `removeOnComplete` bounded, `removeOnFail` retained for inspection
- Worker runs as own process/entrypoint (`start:worker`), same codebase
- Graceful shutdown drains in-flight jobs
- Health endpoint reports Redis reachable (`redis: 'up'|'down'`; overall status degraded if Redis or database down); extend `@greekgeek/contracts` `HealthResponseSchema`
- Job failures logged with job id + payload keys (no PII dumps)
- Temporary ADMIN prove enqueue used for smoke only — removed after confirmed

### Slice A — Generic webhook inbox

- `WebhookEvent` schema: `id`, `service` (text — `stripe` now), `externalId`, `type`, `payload` jsonb, `receivedAt`, `processedAt?`, `attempts`, `lastError?`
- Unique `(service, externalId)`; index on `processedAt` for unprocessed sweeps
- Stripe webhook route verifies signature against raw body; bad signature → 400, nothing stored
- `STRIPE_WEBHOOK_SECRET` required at boot (fail-fast like `REDIS_URL`)
- Verified event inserted; duplicate `(service, externalId)` → short-circuit 200, no reprocessing
- After insert, enqueue processing job; return 200 immediately
- Worker processes by event row id, sets `processedAt`; failure increments `attempts`, stores `lastError`, BullMQ retries
- Handlers idempotent — reprocessing succeeded event changes nothing
- Unknown event types stored and marked processed (no error noise)
- Admin-only list endpoint: unprocessed or failed events; manual re-enqueue for failed event (ADMIN)
- Admin FE at `/admin/webhook-events` matching obsidian-glass admin patterns

### Out of scope

- Stripe Checkout/payments handlers
- Non-Stripe webhook service handlers beyond `service` text field
- Public FE beyond admin inbox

## Capabilities

### New Capabilities

- `job-queue`: Redis + BullMQ infrastructure, shared queue module, worker entrypoint, graceful shutdown, health Redis probe
- `webhook-inbox`: `WebhookEvent` persistence, Stripe signature verification + ingest, async processing with idempotency and retries, ADMIN ops API (list failed/unprocessed, re-enqueue)

### Modified Capabilities

- `admin-dashboard`: ADMIN webhook events inbox UI at `/admin/webhook-events` (list, filter unprocessed/failed, re-enqueue)

## Impact

- **docker-compose.yml**: new Redis service + volume
- **apps/api**: env schema (`REDIS_URL`, `STRIPE_WEBHOOK_SECRET`), queue module, worker bootstrap, health service, webhook module, Prisma `WebhookEvent`, integration tests
- **packages/contracts**: extended `HealthResponseSchema`, webhook event + admin list/re-enqueue Zod schemas
- **apps/web**: `/admin/webhook-events` route, admin nav link, API client helpers
- **package.json** (`@greekgeek/api`): `start:worker` script; new deps `bullmq`, `@nestjs/bullmq`
- **Non-goals**: payment business logic, non-Stripe handlers, public webhook UI
