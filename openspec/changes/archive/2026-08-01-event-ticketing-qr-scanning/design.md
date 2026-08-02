## Context

Phase 1 ticketing is archived: `Ticket` has `credentialToken`, status `unpaid` | `paid` | `void`, allocations, guest list, and `tickets.manage` gating. Org permissions seed explicitly excluded `tickets.scan`. See proposal.md for scope. This design adds immutable check-in fields, host-org-only scan authorization, and QR/scanner surfaces without audit logs or offline support.

## Goals / Non-Goals

**Goals:**
- `checkedIn` / `checkedInAt` on `Ticket`; immutable after first success
- Seed `tickets.scan`; separate from `tickets.manage`
- `POST` check-in by `credentialToken` with Zod contracts
- Atomic single-use check-in (`UPDATE … WHERE checkedIn = false`)
- Capacity hard-stop at event level (checked-in count ≥ `ticketCapacity`)
- Host-org scanner UI + holder QR on `/app/tickets`
- Guest list read-only check-in columns

**Non-Goals:**
- `ticket_scan_log` table or scan history
- Offline scan queue / sync
- Apple/Google Wallet passes
- Geo-fencing or device binding
- Invited-org door scanners
- Undo / clear check-in API or UI
- New `scanned` ticket status enum

## Decisions

### 1. Check-in fields on Ticket (not separate scan log)

```prisma
model Ticket {
  // existing fields...
  checkedIn   Boolean   @default(false)
  checkedInAt DateTime?
}
```

**Rationale:** Single source of truth for door state; guest list and scanner read same row. No audit trail requirement this phase.

**Alternative rejected:** `ticket_scan_log` table — explicit non-goal; adds query complexity without AC.

### 2. Atomic check-in via conditional update

Check-in runs in a transaction:

1. Resolve ticket by `credentialToken` (include allocation → event).
2. Validate auth (ADMIN or `tickets.scan` on `event.organizationId`).
3. Validate `status === paid`, `!checkedIn`.
4. Count `checkedIn = true` for `eventId`; if `≥ ticketCapacity` → 409/422 at-capacity.
5. `UPDATE ticket SET checkedIn = true, checkedInAt = now() WHERE id = ? AND checkedIn = false`.
6. If `count === 0` → already checked in (concurrent race).

**Rationale:** `WHERE checkedIn = false` gives race-safe single-use without advisory locks. Second concurrent request gets zero rows updated.

**Alternative rejected:** `SELECT FOR UPDATE` on ticket only — works but conditional update is simpler and idempotent error path.

### 3. Capacity hard-stop at event level

Reject check-in when `COUNT(tickets WHERE eventId = E AND checkedIn = true) >= event.ticketCapacity` **before** the conditional update, re-checked inside the transaction.

**Rationale:** AC requires hard-stop even if allocations "should" prevent oversell (data drift, admin overrides, bugs). Door is last line of defense.

**Alternative rejected:** Allocation-level only — does not satisfy AC.

### 4. Auth: host org only for `tickets.scan`

`OrgPermissionGuard` (or equivalent) MUST resolve permission against `event.organizationId`, not the ticket's allocation `organizationId`.

**Rationale:** Invited-org `tickets.scan` → 403. Door staff are host-org members.

**Alternative rejected:** Allow allocation org scanners — explicit non-goal.

### 5. `tickets.scan` not implied by `tickets.manage`

Separate seed key; check-in endpoint requires `tickets.scan` explicitly. Manage UI and scanner UI are independently gated.

**Rationale:** Officers who configure tickets ≠ door staff. Reduces accidental broad grants.

### 6. QR encodes existing `credentialToken`

Holder UI renders QR from `credentialToken` (e.g. `qrcode` lib). No rotation, no JWT, no separate scan secret.

**Rationale:** Phase 1 already generated opaque unique tokens "scan-ready later." Reuse avoids migration.

**Post-check-in:** Token still renders for holder display; check-in endpoint rejects on `checkedIn`.

### 7. No undo

No API route, no UI control, no admin override to clear `checkedIn`. Immutable per AC.

**Mitigation for mistakes:** Manual DB fix out of band (document in ops, not product feature).

### 8. Error mapping (API → UI)

| Condition | HTTP | Scanner UI state |
|-----------|------|------------------|
| Success | 200 | success |
| Already checked in | 409 or 422 | already in |
| Unpaid | 422 | unpaid |
| Void | 422 | void |
| Unknown token | 404 | invalid |
| At capacity | 409 or 422 | at capacity |
| Wrong org / no scan perm | 403 | forbidden |

Exact status codes chosen at implementation; contracts carry discriminated error codes for FE.

### 9. Scanner placement

Host event ticketing surface (`/app/events/$eventId/tickets`) — new tab or sub-route `…/scan`. Camera via browser `BarcodeDetector` or lightweight lib (e.g. `html5-qrcode`); fallback paste field always available.

## Risks / Trade-offs

- **[Risk] Camera permissions denied on mobile browsers** → Mitigation: paste credential always available; demo uses paste if camera blocked.
- **[Risk] Capacity check race at exact capacity** → Mitigation: capacity count + conditional update in same transaction; second scanner at cap fails.
- **[Risk] No scan audit trail** → Accepted non-goal; support must use DB if dispute.
- **[Risk] QR screenshot sharing** → Accepted; single-use check-in limits replay at door.

## Migration Plan

1. Deploy migration adding `checkedIn` / `checkedInAt` (default false / null).
2. Seed `tickets.scan` permission row.
3. Deploy API + contracts.
4. Deploy FE (QR, scanner, guest list columns).
5. Grant `tickets.scan` to door staff via admin permissions UI.

Rollback: revert FE/API; columns nullable-safe; no data loss if check-ins occurred (do not drop columns without backup).

## Open Questions

_(none — AC locked by parent)_
