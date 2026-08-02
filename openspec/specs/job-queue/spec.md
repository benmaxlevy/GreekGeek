# job-queue Specification

## Purpose

Provides Redis-backed BullMQ job infrastructure for Rally: shared connection, typed queues, a dedicated worker process, and health visibility for Redis connectivity.

## Requirements

### Requirement: Redis is available for local development via docker-compose

The project's `docker-compose.yml` MUST include a Redis service using image `redis:7-alpine` (pinned), a named volume for data persistence, and a host port mapping for local development. The existing Postgres service MUST remain unchanged. A single `docker compose up` command MUST start both Postgres and Redis.

#### Scenario: Developer starts local infrastructure

- **WHEN** a developer runs `docker compose up` from the project root
- **THEN** both Postgres and Redis containers start and Redis is reachable on the mapped local port

### Requirement: API requires REDIS_URL at boot

The API MUST validate `REDIS_URL` via the Zod env schema and MUST fail fast at application startup when `REDIS_URL` is missing or invalid. `.env.example` MUST document `REDIS_URL`.

#### Scenario: API starts without REDIS_URL

- **WHEN** the API boots without a valid `REDIS_URL`
- **THEN** startup fails with a clear configuration error and the HTTP server does not accept traffic

#### Scenario: API starts with valid REDIS_URL

- **WHEN** the API boots with a valid `REDIS_URL` pointing at a reachable Redis instance
- **THEN** the application starts successfully

### Requirement: Shared queue module registers Redis once with typed queue names

The API MUST register a single BullMQ Redis connection via a shared queue module. Queue names MUST be defined in a typed constant map (not ad-hoc string literals at registration or processor sites). Default job options MUST include: retry with exponential backoff, bounded `removeOnComplete`, and `removeOnFail` retained for inspection.

#### Scenario: Queue registered with default job options

- **WHEN** a job is enqueued without overriding options
- **THEN** the job inherits exponential backoff retries, bounded completion cleanup, and failed job retention per the shared defaults

### Requirement: Worker runs as a separate process entrypoint

The codebase MUST provide a dedicated worker entrypoint (e.g. `start:worker`) that runs in a separate process from the HTTP API, sharing the same application code and queue configuration.

#### Scenario: Worker processes enqueued job

- **WHEN** the worker process is running and a job is enqueued to a registered queue
- **THEN** the worker picks up and executes the job processor

#### Scenario: API healthy without worker

- **WHEN** the API is running and Redis and database are reachable but the worker process is not running
- **THEN** the health endpoint reports overall status consistent with database and Redis only (not degraded solely because the worker is absent)

### Requirement: Worker shuts down gracefully

On shutdown signals, the worker MUST drain in-flight jobs (complete active work before exit) before terminating.

#### Scenario: Graceful shutdown completes active job

- **WHEN** the worker receives a shutdown signal while processing a job
- **THEN** the in-flight job completes before the process exits

### Requirement: Health endpoint reports Redis connectivity

The health response contract MUST include a `redis` field with values `up` or `down`. Overall health `status` MUST be `degraded` when either `database` or `redis` is `down`. Overall `status` MUST be `ok` only when both are `up`.

#### Scenario: Redis reachable

- **WHEN** a client calls the health endpoint and Redis responds to a connectivity check
- **THEN** the response includes `redis: 'up'` and `status: 'ok'` when the database is also up

#### Scenario: Redis unreachable

- **WHEN** a client calls the health endpoint and Redis is unreachable
- **THEN** the response includes `redis: 'down'` and `status: 'degraded'`

#### Scenario: Database down degrades health

- **WHEN** a client calls the health endpoint and the database is down but Redis is up
- **THEN** the response includes `status: 'degraded'`

### Requirement: Job failure logs omit PII

On job failure, worker logs MUST include the job id and payload key names only — MUST NOT dump full payload values or PII.

#### Scenario: Failed job logs safely

- **WHEN** a queue job fails in the worker
- **THEN** error logs include the job id and payload object keys but not full payload content

### Requirement: Abandoned purchase TTL sweep runs on the worker

The job-queue worker MUST run a recurring or polled sweep that finds Purchases with `status` `requires_payment` older than `PURCHASE_TTL_MINUTES` (env, default **5**, Zod-validated at API/worker boot). For each expired Purchase the sweep MUST cancel the Stripe PaymentIntent, set Purchase `status` to `canceled`, and DELETE reserved unpaid tickets for that purchase so allocation and capacity slots are freed. The sweep MUST be idempotent: re-processing an already `canceled` Purchase MUST be a no-op. The typed queue map MUST include a queue name for this sweep (or a scheduled job on an existing typed queue). `.env.example` MUST document `PURCHASE_TTL_MINUTES`.

#### Scenario: Worker expires abandoned purchase

- **WHEN** the worker sweep runs and a Purchase has been `requires_payment` longer than `PURCHASE_TTL_MINUTES`
- **THEN** the PaymentIntent is canceled, Purchase becomes `canceled`, and unpaid tickets for that purchase are deleted

#### Scenario: Sweep skips non-open purchases

- **WHEN** the worker sweep runs and a Purchase status is `succeeded`, `failed`, or `canceled`
- **THEN** the sweep does not modify that Purchase or its tickets

#### Scenario: Sweep replay is idempotent

- **WHEN** the sweep encounters a Purchase already marked `canceled` after a prior expiry
- **THEN** no error is raised and ticket state remains unchanged
