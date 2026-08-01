## Why

Events CRUD exists but chapters cannot sell or allocate tickets, track paid guests, or let guests self-claim from a public pool. Phase 1 adds org-scoped ticketing on existing `Event` records with stub pay (`mark paid`), guest self-claim, and officer/admin management — without Stripe, scan/check-in, or a separate ticketed-events entity.

## What Changes

- Inline ticketing config on `Event` (`ticketingEnabled`, capacity, sale status, sale windows) — no separate `EventTicketConfig` table
- New `TicketAllocation` rows per event: org-scoped (one per org) and optional public pool (`organizationId = null`)
- New `Ticket` rows: issue, void, mark paid; unique `credentialToken`; guest list = paid tickets only
- Seed `tickets.manage` permission; platform ADMIN bypasses all org ticket checks
- Host org with `tickets.manage`: full config, all allocations, issue/list/void/mark-paid, guest list
- Invited-org member with `tickets.manage`: issue/list/void/mark-paid within their org's allocation only
- ACTIVE users may self-claim unpaid tickets from active public allocation when event is `on_sale`
- Guest mark-paid own ticket only; no `tickets.manage` UI for guests
- Member UI `/app/events/$eventId/tickets` (+ minimal `/app/tickets` for own tickets/claim)
- Admin UI `/admin/events/$eventId/tickets` with org filter on ticketed-events list
- Shared Zod contracts in `packages/contracts`; concurrent issue guarded with txn + `SELECT FOR UPDATE`
- **Non-goals:** `tickets.scan`, Stripe/Connect, Wallet, standing/fines, vendor/booking, `User.universityId`, separate config table

## Capabilities

### New Capabilities

- `ticketing`: Event-inline ticketing config, org/public allocations, ticket lifecycle (issue/void/mark-paid), guest self-claim, guest list, oversell prevention, member + admin + guest UI surfaces

### Modified Capabilities

- `events`: Event model gains inline ticketing fields; host may enable/update ticketing config; capacity rules tie to `maxHeadcount`
- `org-permissions`: Seed `tickets.manage`; document that it gates all org-scoped ticket operations (no `tickets.scan`)
- `admin-dashboard`: Admin ticketed-events list, per-event ticket management at `/admin/events/$eventId/tickets`, nav link

## Impact

- **apps/api**: Prisma `TicketAllocation`, `Ticket`; Event field additions; tickets module; migration; integration tests (oversell, permission matrix)
- **packages/contracts**: Ticketing Zod schemas (config, allocations, tickets, list filters)
- **apps/web**: Member ticket routes under `/app/events/$eventId/tickets` and `/app/tickets`; admin routes under `/admin/events/$eventId/tickets`; permission-gated nav
- **prisma seed**: `tickets.manage` catalog row
- **Non-goals**: payment processor, scan/check-in API, university-scoped allocation filters
