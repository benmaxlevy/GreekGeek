## Context

Events CRUD, org permissions (`OrgPermissionGuard` + ADMIN bypass), and optional-org signup (ACTIVE guests without membership) are landed. `Event` has core fields only — no ticketing. See proposal.md for scope. This design adds inline ticketing on `Event`, `TicketAllocation`, and `Ticket` models plus member/admin/guest UI.

## Goals / Non-Goals

**Goals:**
- Inline ticketing config on `Event` (no separate config table)
- Org + optional public (`organizationId = null`) allocations
- Issue / void / mark-paid lifecycle; guest list = paid only
- `tickets.manage` + ADMIN bypass; invited-org scoped issue
- Guest self-claim on public pool; holder mark-paid own ticket
- Concurrent issue safety via txn + row lock
- Shared Zod contracts; member + admin + minimal guest UI

**Non-Goals:**
- `tickets.scan`, Stripe/Connect, Wallet
- Standing/fines, vendor/booking
- `User.universityId` or uni DB columns
- University-filtered "all orgs" allocations
- Real payment processing

## Decisions

### 1. Inline config on Event (not EventTicketConfig)

```prisma
enum TicketSaleStatus {
  draft
  on_sale
  closed
}

model Event {
  // existing fields...
  ticketingEnabled    Boolean           @default(false)
  ticketCapacity      Int?
  ticketSaleStatus    TicketSaleStatus?
  ticketSalesOpenAt   DateTime?
  ticketSalesCloseAt  DateTime?
  allocations         TicketAllocation[]
  // ...
}

model TicketAllocation {
  id             String        @id @default(cuid())
  eventId        String
  event          Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  organizationId String?       // null = public/guest pool
  organization   Organization? @relation(fields: [organizationId], references: [id])
  quantity       Int
  priceCents     Int?
  status         AllocationStatus @default(active) // active | closed
  tickets        Ticket[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([eventId, organizationId]) // Postgres: multiple nulls allowed; app enforces one public row
  // Add partial unique index in migration: UNIQUE (eventId) WHERE organizationId IS NULL
}

enum AllocationStatus {
  active
  closed
}

enum TicketStatus {
  unpaid
  paid
  void
}

model Ticket {
  id              String           @id @default(cuid())
  allocationId    String
  allocation      TicketAllocation @relation(fields: [allocationId], references: [id], onDelete: Restrict)
  status          TicketStatus     @default(unpaid)
  credentialToken String           @unique // opaque, scan-ready later
  holderUserId    String?
  holder          User?            @relation(fields: [holderUserId], references: [id])
  paidAt          DateTime?
  voidedAt        DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

- Rationale: fewer joins; config always loaded with event; matches locked product decision
- Alt: separate `EventTicketConfig` table — rejected per scope lock

### 2. Public allocation via nullable `organizationId`

- `organizationId = null` row = public/guest pool; at most one per event (partial unique index)
- NOT created by "all orgs" toggle — separate explicit option
- "All orgs" = `INSERT` one row per `Organization` (full table scan, no university filter)
- Rationale: explicit data model; invited-org officers never touch public alloc without host perms

### 3. Auth matrix

| Actor | Config / allocations | Issue / void / mark-paid | Guest list | Self-claim public |
|-------|---------------------|---------------------------|------------|-------------------|
| ADMIN | all events | all allocations | all | yes |
| Host + `tickets.manage` | hosted event | all allocations incl. public | hosted | yes |
| Invited org + `tickets.manage` | 403 | own org allocation only | per ticketing rules if exposed | yes (public pool) |
| ACTIVE holder (no manage) | 403 | mark-paid own unpaid only | 403 | yes when on_sale |
| No perm / non-ACTIVE | 403 | 403 | 403 | 403 |

- Enforcement: service-layer `assertTicketAccess(event, allocation, action)` after load; `OrgPermissionGuard` for host-org `tickets.manage` on config routes
- Invited-org scope: resolve allocation.organizationId === caller.membership.organizationId

### 4. Oversell prevention

```text
BEGIN;
  SELECT * FROM "TicketAllocation" WHERE id = $1 FOR UPDATE;
  COUNT non-void tickets for allocation;
  IF count >= quantity → ROLLBACK 409;
  INSERT Ticket;
COMMIT;
```

- Integration test: parallel issue requests against last slot — exactly one succeeds
- Alt: optimistic locking only — rejected; race oversell risk

### 5. Capacity rules

- `ticketCapacity` required when `ticketingEnabled`; must be ≤ `event.maxHeadcount`
- Sum of allocation `quantity` ≤ `ticketCapacity` (checked on alloc create/update)
- `on_sale`: alloc qty ≥ count(non-void issued) for that alloc

### 6. API shape (sketch)

- `PATCH /api/events/:id/ticketing` — config (host `tickets.manage` | ADMIN)
- `GET/POST /api/events/:eventId/allocations` — list/create (host | ADMIN)
- `PATCH /api/events/:eventId/allocations/:id` — update/close
- `POST /api/events/:eventId/allocations/:id/tickets` — issue
- `GET /api/events/:eventId/tickets` — list (filters: allocationId, organizationId, status)
- `GET /api/events/:eventId/guest-list` — paid only
- `POST /api/tickets/:id/mark-paid` — manage or holder self
- `POST /api/tickets/:id/void` — manage scoped
- `POST /api/events/:eventId/public-claim` — ACTIVE self-claim
- `GET /api/tickets/mine` — caller's held tickets

All bodies/query parsed with Zod from `@greekgeek/contracts`.

### 7. Sale status transitions

- `draft` → `on_sale`: requires ≥1 allocation
- `on_sale` → `closed`: host/ADMIN; blocks new issue/claim
- Optional window fields (`ticketSalesOpenAt`/`CloseAt`) validated but enforcement can be simple check in service

### 8. FE routing

- Member officer: `/app/events/$eventId/tickets`, `/app/events/$eventId/tickets/allocations`, `/app/events/$eventId/tickets/guest-list`
- Guest/self: `/app/tickets` (mine + claim CTA for on_sale public events)
- Admin: `/admin/events/$eventId/tickets`; list filter on `/admin/events` or dedicated ticketed-events nav
- Gate officer UI on `tickets.manage`; guest routes on ACTIVE auth only

### 9. Mark paid stub

- No Stripe; `mark paid` sets `paid` + `paidAt`
- Guest list inclusion immediate
- Payment UI copy indicates manual/stub phase

## Risks / Trade-offs

- [Postgres NULL unique] → Partial unique index for one public alloc per event; app-level check as backup
- [All-orgs alloc explosion] → Accept; org count expected small in demo/prod v1
- [Invited-org confusion] → UI labels allocation org; server enforces scope
- [Self-claim by org members] → Allowed per locked rule; document in UI
- [Free-form concurrent claim + issue] → Row lock on allocation prevents oversell; optional one-ticket-per-user-per-event reduces abuse

## Migration Plan

1. Prisma migration: Event fields + TicketAllocation + Ticket + partial unique index
2. Seed `tickets.manage` permission
3. Deploy contracts + API module
4. Deploy FE routes
5. Rollback: drop new tables/columns via down migration (pre-prod assumption)

## Open Questions

None — product decisions locked in proposal.
