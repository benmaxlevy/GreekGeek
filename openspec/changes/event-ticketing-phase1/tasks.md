## 1. Data model + seed

- [x] 1.1 Add Prisma enums (`TicketSaleStatus`, `AllocationStatus`, `TicketStatus`) and inline ticketing fields on `Event`
- [x] 1.2 Add `TicketAllocation` model (nullable `organizationId`, partial unique for public pool) and `Ticket` model (`credentialToken` unique, `holderUserId` optional)
- [x] 1.3 Generate migration with partial unique index: one public alloc per event (`organizationId IS NULL`)
- [x] 1.4 Seed `tickets.manage` in prisma seed (no `tickets.scan`)
- [x] 1.5 Commit: `add ticketing prisma models and seed tickets.manage`

## 2. Contracts

- [x] 2.1 Add `@rally/contracts` Zod schemas: event ticketing config patch, allocation create/update, ticket issue, list filters, guest list, mark-paid, void, public-claim, mine response
- [x] 2.2 Commit: `add ticketing zod contracts`

## 3. API — config + allocations (vertical slice 1)

- [x] 3.1 Nest tickets module: `PATCH /api/events/:id/ticketing` (host `tickets.manage` | ADMIN); validate capacity ≤ maxHeadcount; block `on_sale` without ≥1 allocation
- [x] 3.2 Allocation CRUD: create org rows, "all orgs" (every Organization), optional public pool; enforce sum qty ≤ ticketCapacity and unique constraints
- [x] 3.3 Allocation update rules: draft free edit; `on_sale` qty floor = non-void issued count
- [x] 3.4 Commit: `add ticketing config and allocation api`

## 4. API — tickets + guest flows (vertical slice 2)

- [x] 4.1 Issue ticket under allocation with txn + `SELECT FOR UPDATE`; generate opaque `credentialToken`
- [x] 4.2 Void ticket (frees slot); mark-paid (unpaid → paid); holder self mark-paid without `tickets.manage`
- [x] 4.3 Public self-claim endpoint for ACTIVE users when on_sale + active public alloc
- [x] 4.4 List tickets (filters: event, allocation, org, status); guest list (paid only, org label / "Public")
- [x] 4.5 Auth scoping: invited-org `tickets.manage` own alloc only; host full access; ADMIN bypass
- [x] 4.6 Commit: `add ticket issue void mark-paid and guest claim api`

## 5. API tests

- [x] 5.1 Integration: permission matrix (host, invited-org, no perm, ADMIN)
- [x] 5.2 Integration: capacity / over-allocate / on_sale qty floor
- [x] 5.3 Integration: concurrent issue oversell (parallel requests, one succeeds)
- [x] 5.4 Integration: guest self-claim + holder mark-paid; guest list paid-only
- [x] 5.5 Commit: `add ticketing api integration tests`

## 6. Frontend — member officer UI (vertical slice 3)

- [x] 6.1 `/app/events/$eventId/tickets` — config form, sale status, capacity; gate on host `tickets.manage`
- [x] 6.2 Allocations UI: select orgs, all orgs, public toggle; issue/list/void/mark-paid
- [x] 6.3 Invited-org scoped view: only caller's allocation controls
- [x] 6.4 Guest list tab: paid tickets with org / "Public" label
- [x] 6.5 Redirect / 403 when missing `tickets.manage` on officer routes
- [x] 6.6 Commit: `add member event ticketing ui`

## 7. Frontend — guest + admin UI (vertical slice 4)

- [x] 7.1 `/app/tickets` — my tickets, claim CTA for on_sale public events, mark-paid own unpaid
- [x] 7.2 `/admin/events/$eventId/tickets` — full config, allocations, issue/void/mark-paid, force closed
- [x] 7.3 Admin ticketed-events list with org filter; nav link
- [x] 7.4 Commit: `add guest my-tickets and admin ticketing ui`

## 8. Verification + demos

- [ ] 8.1 Demo: enable ticketing → Org A + Org B alloc (+ optional public) → issue → mark paid → guest list
- [ ] 8.2 Demo: void frees slot; oversell attempt fails
- [ ] 8.3 Demo (if feasible): guest signup → claim public → mark paid
- [ ] 8.4 Mark all tasks complete; archive when shipped
