## Why

Phase 1 ticketing supports issue, void, mark-paid, and guest list but cannot verify attendance at the door. Host orgs need QR-based check-in so paid holders present a scannable credential and door staff confirm entry once — without payment processors, scan logs, or invited-org scanners.

## What Changes

- Seed `tickets.scan` permission (separate from `tickets.manage`; not implied by it)
- Ticket model gains `checkedIn` (boolean, default false) and `checkedInAt` (nullable datetime); immutable after first successful check-in
- Paid tickets display QR from existing `credentialToken`; unpaid/void tickets have no valid scannable credential
- `POST` check-in API by credential token: atomic single-use check-in, capacity hard-stop, host-org `tickets.scan` or ADMIN only
- Host-org scanner UI (camera / paste) with clear error states; guest list shows read-only `checkedIn` / `checkedInAt`
- Holder QR on `/app/tickets` for paid tickets
- Admin grant/revoke `tickets.scan` via existing permissions UI (seed key only)
- **Non-goals:** `ticket_scan_log` table, offline queue, Wallet, geo-fencing, invited-org scanners, undo check-in

## Capabilities

### New Capabilities

_(none — extends existing ticketing and org-permissions)_

### Modified Capabilities

- `ticketing`: Check-in fields on tickets, QR display for paid holders, check-in API with capacity guard and single-use semantics, host-org scanner UI, guest list check-in columns
- `org-permissions`: Seed `tickets.scan`; gate check-in scanning on host org only; `tickets.manage` does not imply `tickets.scan`

## Impact

- **apps/api**: Prisma `Ticket` fields (`checkedIn`, `checkedInAt`); seed `tickets.scan`; check-in endpoint; integration tests (race, capacity, permission matrix)
- **packages/contracts**: Check-in request/response Zod schemas; ticket DTOs include check-in fields
- **apps/web**: Scanner tab on host event ticketing surface; QR on `/app/tickets`; guest list check-in columns; permission-gated scanner (`tickets.scan`)
- **prisma seed**: `tickets.scan` catalog row
- **Non-goals**: scan audit log, offline mode, Apple/Google Wallet, invited-org door staff
