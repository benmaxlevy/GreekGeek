## Context

Rally API today: NestJS + Prisma + Postgres, health checks database only, no Redis or background workers. Ticketing uses stub mark-paid — Stripe integration is next. Webhooks need fast HTTP ack, durable storage, and async processing with retries. See proposal.md for locked scope.

## Goals / Non-Goals

**Goals:**

- Local dev: `docker compose up` brings Postgres + Redis; API and worker share one codebase
- Fail-fast env validation for `REDIS_URL` and `STRIPE_WEBHOOK_SECRET`
- Single shared BullMQ connection; typed queue name map; sensible default job options
- Worker process with graceful shutdown (drain in-flight jobs)
- Health reports `database` and `redis`; `status: degraded` when either down
- Generic `WebhookEvent` inbox with Stripe ingest as first `service`
- Idempotent ingest + processing; ADMIN ops for failed/unprocessed events

**Non-Goals:**

- Stripe Checkout / payment handler implementations
- Handlers for non-Stripe services (only `service` text column extensibility)
- Public-facing webhook UI
- Separate worker repo or language

## Decisions

### 1. Redis in docker-compose

```yaml
redis:
  image: redis:7-alpine
  container_name: rally-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - rally_redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 10
```

- `.env.example`: `REDIS_URL=redis://localhost:6379`
- Rationale: matches existing Postgres pattern; pinned `7-alpine` for reproducibility
- Alt: managed Redis only — rejected for local one-command dev

### 2. Env schema extensions

```typescript
REDIS_URL: z.string().url(),
STRIPE_WEBHOOK_SECRET: z.string().min(1),
```

- Both required at API boot (and worker boot for `REDIS_URL`)
- Rationale: fail-fast; no silent no-op queue or unsigned webhooks

### 3. Queue module layout

```
apps/api/src/queue/
  queue.constants.ts    # QUEUE_NAMES = { prove: 'prove', webhookProcess: 'webhook-process' } as const
  queue.module.ts       # BullModule.forRoot({ connection: { url: REDIS_URL } })
  queue-defaults.ts     # shared DefaultJobOptions
```

Default job options:

```typescript
{
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: false,
}
```

- Queue names ONLY via `QUEUE_NAMES` map — no raw string literals at register/processor sites
- Rationale: typo prevention; single connection config

### 4. Worker entrypoint

- `apps/api/src/worker.main.ts` — NestJS context bootstrapping processors only (no HTTP)
- Root / `@rally/api` script: `"start:worker": "node dist/worker.main.js"` (dev: `nest start --entryFile worker.main --watch` or tsx equivalent)
- Same `AppModule` subtree or dedicated `WorkerModule` importing queue processors
- Rationale: separate process scales independently; shares Prisma + services

### 5. Graceful shutdown

- Register `onApplicationShutdown` / BullMQ `Worker.close()` + `Queue.close()` on SIGTERM/SIGINT
- `worker.close()` waits for active jobs to finish (BullMQ default drain)
- Rationale: avoid mid-handler corruption during deploy

### 6. Health extension

```typescript
// packages/contracts/src/health.ts
export const HealthResponseSchema = z.object({
  status: HealthStatusSchema, // 'ok' | 'degraded'
  database: z.enum(['up', 'down']),
  redis: z.enum(['up', 'down']),
  timestamp: z.string().datetime(),
});
```

- `status: 'ok'` only when both `database` and `redis` are `'up'`
- Redis probe: `PING` via ioredis connection (BullMQ's underlying client) or lightweight standalone ping
- API healthy without worker running — worker absence does not degrade health
- Rationale: ops visibility; matches existing database pattern

### 7. Prove job (slice 0 E2E)

- ADMIN-only `POST /api/admin/queue/prove` enqueues `{ message: string }` to `QUEUE_NAMES.prove`
- Processor logs `job.id` + payload keys at info level
- On failure: log `job.id` + Object.keys(payload) only — no full payload / PII
- Rationale: validates enqueue → Redis → worker path before webhook complexity

### 8. WebhookEvent Prisma model

```prisma
model WebhookEvent {
  id          String    @id @default(cuid())
  service     String    // "stripe" | future
  externalId  String    // provider event id
  type        String
  payload     Json
  receivedAt  DateTime  @default(now())
  processedAt DateTime?
  attempts    Int       @default(0)
  lastError   String?

  @@unique([service, externalId])
  @@index([processedAt])
}
```

- `processedAt IS NULL` → unprocessed; failed = `processedAt` null + `attempts > 0` + `lastError` set (or explicit failed filter in admin query)
- Rationale: generic inbox; idempotency via unique constraint

### 9. Stripe webhook ingest

- Route: `POST /api/webhooks/stripe` (public, no session auth)
- Raw body required for signature — use Nest raw body middleware for this route only
- Verify with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` (add `stripe` package)
- Invalid signature → `400`, no DB write
- Valid: upsert attempt — `create` with `externalId = event.id`; on `P2002` unique violation → return `200` immediately (duplicate, no re-enqueue)
- On successful insert → enqueue `QUEUE_NAMES.webhookProcess` with `{ webhookEventId }` → return `200`
- Rationale: Stripe retry semantics; idempotent at DB layer

### 10. Webhook processing worker

```text
load WebhookEvent by id
if processedAt set → return (no-op, idempotent)
switch (service, type):
  stripe + known types → stub handler (log + mark processed)
  stripe + unknown type → mark processed (no error)
  default → mark processed
on success → processedAt = now()
on failure → attempts++, lastError = message, rethrow for BullMQ retry
```

- After max attempts, job stays in failed set (`removeOnFail: false`); row remains unprocessed with `lastError`
- Rationale: unknown types shouldn't poison queue; business handlers come later

### 11. Admin API

- `GET /api/admin/webhook-events?status=unprocessed|failed|all` — ADMIN only
- `POST /api/admin/webhook-events/:id/requeue` — ADMIN only; re-enqueues processing job if not currently processed (or always for failed)
- Contracts: list response, query schema, requeue response
- Rationale: ops visibility without public exposure

### 12. Admin FE

- Route: `/admin/webhook-events` — table with service, type, externalId, receivedAt, processedAt, attempts, lastError (truncated)
- Filters: unprocessed / failed / all
- Re-enqueue button on failed rows
- Nav link in admin shell alongside existing admin pages
- Styling: obsidian-glass Card/Badge/Button patterns from `/admin/users`

## Risks / Trade-offs

- [Raw body + JSON parser] → Register raw body capture only on webhook route; global JSON parser elsewhere unchanged
- [Worker not running] → Events accumulate unprocessed; health still ok; admin inbox surfaces backlog
- [Redis data loss] → In-flight BullMQ jobs lost; `WebhookEvent` rows remain — admin re-enqueue recovers
- [STRIPE_WEBHOOK_SECRET in dev] → Document test secret in `.env.example` comment; use Stripe CLI for local forwarding
- [Duplicate enqueue on race] → Unique constraint + catch P2002 prevents double row; job idempotency handles double enqueue edge case

## Migration Plan

1. Deploy docker-compose Redis + env vars
2. Run Prisma migration for `WebhookEvent`
3. Deploy API (webhook route + admin endpoints)
4. Deploy worker process separately (`start:worker`)
5. Configure Stripe webhook endpoint URL in Stripe dashboard
6. Rollback: stop worker; webhook route can remain (events stored unprocessed); drop table via down migration if needed

## Open Questions

None — product and infra decisions locked in proposal.
