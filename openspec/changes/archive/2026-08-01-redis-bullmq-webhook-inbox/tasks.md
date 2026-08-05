## 1. Slice 0 — Redis + BullMQ infra

- [x] 1.1 Add Redis service to `docker-compose.yml` (`redis:7-alpine`, named volume, port 6379, healthcheck); keep Postgres unchanged
- [x] 1.2 Add `REDIS_URL` to `.env.example` and `envSchema` (fail-fast); document in README or env comment
- [x] 1.3 Install `bullmq` + `@nestjs/bullmq` in `@greekgeek/api`
- [x] 1.4 Create shared queue module: typed `QUEUE_NAMES` const map, single Redis connection, default job opts (exponential backoff, bounded `removeOnComplete`, `removeOnFail: false`)
- [x] 1.5 Add worker entrypoint (`worker.main.ts`) + `start:worker` script; graceful shutdown drains in-flight jobs
- [x] 1.6 Extend `@greekgeek/contracts` `HealthResponseSchema` with `redis: 'up'|'down'`; update `HealthService` to ping Redis; `status: degraded` when database or redis down
- [x] 1.7 ADMIN-only `POST /api/admin/queue/prove` enqueue endpoint + prove processor (log job id; failures log id + payload keys only)
- [x] 1.8 Integration test: enqueue prove job → worker processes; health reports redis up/down
- [x] 1.9 Commit: `add redis bullmq queue module and worker entrypoint`

## 2. Slice A — Webhook schema, contracts, API, worker

- [x] 2.1 Add Prisma `WebhookEvent` model (`service`, `externalId`, `type`, `payload`, `receivedAt`, `processedAt?`, `attempts`, `lastError?`); unique `(service, externalId)`; index on `processedAt`; generate migration
- [x] 2.2 Add `STRIPE_WEBHOOK_SECRET` to env schema + `.env.example`; install `stripe` package
- [x] 2.3 Add `@greekgeek/contracts` schemas: webhook event DTOs, admin list query/response, re-enqueue request/response
- [x] 2.4 Stripe webhook route `POST /api/webhooks/stripe`: raw body middleware, signature verify (400 on bad sig), insert + enqueue on new event, 200 short-circuit on duplicate
- [x] 2.5 Webhook process worker: load by id, skip if `processedAt` set, increment attempts + `lastError` on failure, set `processedAt` on success; unknown types → mark processed
- [x] 2.6 ADMIN API: `GET /api/admin/webhook-events` (unprocessed/failed/all filters), `POST /api/admin/webhook-events/:id/requeue`
- [x] 2.7 Integration tests: replay Stripe event → single processing, 200 both times; failing handler retries then appears in failed list; signature failure → 400 no row
- [x] 2.8 Commit: `add webhook inbox schema stripe ingest and processing worker`

## 3. Slice A — Admin FE

- [x] 3.1 Add admin API client helpers (`listWebhookEvents`, `requeueWebhookEvent`) in `apps/web`
- [x] 3.2 Create `/admin/webhook-events` route: table, unprocessed/failed/all filters, re-enqueue action on failed rows; obsidian-glass styling
- [x] 3.3 Add admin nav link to webhook events (ADMIN only)
- [x] 3.4 Commit: `add admin webhook events inbox ui`

## 4. Verification / demos

- [x] 4.1 Manual verify: `docker compose up` + API + `start:worker` → prove smoke then removed; health `redis:up` without worker required
- [x] 4.2 Manual verify: Stripe CLI forward → event stored, processed once; replay → 200 no duplicate processing
- [x] 4.3 Manual verify: induce handler failure → retries → visible in admin failed list → re-enqueue succeeds
- [x] 4.4 Mark all tasks complete; archive when shipped
