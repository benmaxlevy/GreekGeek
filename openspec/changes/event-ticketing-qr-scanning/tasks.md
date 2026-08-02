## 1. Data model + seed

- [x] 1.1 Add `checkedIn Boolean @default(false)` and `checkedInAt DateTime?` to Prisma `Ticket` model
- [x] 1.2 Generate and apply migration
- [x] 1.3 Seed `tickets.scan` permission in `apps/api/prisma/seed.ts` (alongside existing catalog keys)
- [x] 1.4 Commit: `add ticket check-in fields and seed tickets.scan`

## 2. Contracts

- [x] 2.1 Add Zod schemas in `packages/contracts/src/ticketing.ts`: check-in request body (`credentialToken`), check-in response (ticket id, event id, allocation org id nullable, holder user id nullable, `checkedInAt`)
- [x] 2.2 Extend ticket / guest-list response schemas with `checkedIn` and `checkedInAt`
- [x] 2.3 Commit: `add ticketing check-in zod contracts`

## 3. API — check-in endpoint

- [x] 3.1 `POST` check-in by credential: resolve ticket → event; auth ADMIN or `tickets.scan` on host org only
- [x] 3.2 Reject unpaid, void, unknown token, already checked in; map errors for FE states
- [x] 3.3 Transaction: event capacity count (`checkedIn` true ≥ `ticketCapacity` → reject); atomic `UPDATE … WHERE checkedIn = false`
- [x] 3.4 Include check-in fields in guest list and ticket list responses
- [x] 3.5 Commit: `add ticket check-in api`

## 4. API tests

- [x] 4.1 Integration: first scan succeeds → `checkedIn` + `checkedInAt` set
- [x] 4.2 Integration: second scan same token fails (already in)
- [x] 4.3 Integration: unpaid / void / unknown credential rejected
- [x] 4.4 Integration: invited-org `tickets.scan` → 403; `tickets.manage` without scan → 403
- [x] 4.5 Integration: at-capacity reject when checked-in count ≥ `ticketCapacity`
- [x] 4.6 Integration: concurrent scan race — at most one success
- [x] 4.7 Commit: `add ticket check-in integration tests`

## 5. Frontend — holder QR (`/app/tickets`)

- [x] 5.1 Render QR from `credentialToken` for paid tickets
- [x] 5.2 Hide or disable QR for unpaid and void tickets
- [x] 5.3 Commit: `add holder ticket qr display`

## 6. Frontend — host scanner

- [x] 6.1 Scanner tab/sub-route on `/app/events/$eventId/tickets`; gate on host `tickets.scan` (not `tickets.manage` alone)
- [x] 6.2 Camera scan + manual credential paste; call check-in API
- [x] 6.3 Distinct UI states: success, already in, unpaid, void, invalid, at capacity, forbidden
- [x] 6.4 Commit: `add host event ticket scanner ui`

## 7. Frontend — guest list check-in columns

- [x] 7.1 Guest list (manage UI): show read-only `checkedIn` and `checkedInAt`; no undo control
- [x] 7.2 Commit: `add guest list check-in columns`

## 8. Verification + demo

- [ ] 8.1 Demo: host scanner checks in paid QR once → columns set on guest list
- [ ] 8.2 Demo: second scan same QR fails (already in)
- [ ] 8.3 Demo: invited-org scanner → forbidden
- [ ] 8.4 Demo: at-capacity reject works
- [ ] 8.5 Demo: manage-only member cannot access scanner
- [ ] 8.6 Mark all tasks complete; archive when shipped
