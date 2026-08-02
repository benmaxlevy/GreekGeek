## MODIFIED Requirements

### Requirement: Tickets are issued, voided, and marked paid under allocation limits

The system MUST persist tickets with: required `allocationId`, required `status` enum `unpaid` | `paid` | `void`, required unique opaque `credentialToken`, optional `holderUserId` foreign key to User, required `checkedIn` boolean defaulting to false, optional `checkedInAt` datetime, and timestamps (`paidAt`, `voidedAt` as applicable). Issuing a ticket MUST increment the non-void issued count for that allocation and MUST NOT exceed allocation quantity. Voiding a ticket MUST set status to `void`, record `voidedAt`, and free the allocation slot for re-issue. Marking paid MUST transition `unpaid` → `paid` and set `paidAt`. Once `checkedIn` is true, `checkedIn` and `checkedInAt` MUST NOT be cleared or updated by any API or UI. Concurrent issue MUST NOT oversell: interactive transaction with row lock on the allocation (`SELECT FOR UPDATE` or equivalent). Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Issue ticket within allocation

- **WHEN** an authorized actor issues a ticket against an active allocation with remaining capacity
- **THEN** an unpaid ticket is created with a unique credentialToken, checkedIn false, and optional holderUserId

#### Scenario: Issue exceeds allocation quantity rejected

- **WHEN** issuing would bring non-void tickets for the allocation above its quantity
- **THEN** the system returns a client error and does not create a ticket

#### Scenario: Void frees slot

- **WHEN** an authorized actor voids a non-void ticket
- **THEN** the ticket status becomes void and a new issue may succeed up to allocation quantity

#### Scenario: Mark paid transitions unpaid to paid

- **WHEN** an authorized actor marks an unpaid ticket paid
- **THEN** the ticket status becomes paid and paidAt is set

#### Scenario: Concurrent issue does not oversell

- **WHEN** two concurrent issue requests would exceed allocation quantity if both succeeded
- **THEN** at most one succeeds and the other receives a client error

#### Scenario: New ticket is not checked in

- **WHEN** a ticket is issued or marked paid
- **THEN** checkedIn is false and checkedInAt is null

### Requirement: Guest list shows paid tickets only

The guest list for an event MUST include only tickets with status `paid`. Each entry MUST show holder identity (when holderUserId is set), allocation organization label (organization name for org allocations, or "Public" for null organizationId), ticket status, `checkedIn`, and `checkedInAt` when set. Unpaid tickets MUST NOT appear on the guest list.

#### Scenario: Paid ticket appears on guest list

- **WHEN** an authorized actor requests the guest list for an event with paid tickets
- **THEN** only paid tickets are returned with allocation org label or "Public", checkedIn, and checkedInAt

#### Scenario: Unpaid ticket excluded from guest list

- **WHEN** an event has unpaid and paid tickets
- **THEN** the guest list includes only paid tickets

#### Scenario: Guest list shows check-in state

- **WHEN** a paid ticket has been checked in
- **THEN** the guest list entry shows checkedIn true and the checkedInAt timestamp

### Requirement: Member ticket UI is permission-gated

The web app MUST provide ticket management for hosted events at `/app/events/$eventId/tickets` (sub-routes as needed) for ACTIVE users with `tickets.manage` on the host org: config, allocations (select orgs, all orgs, public toggle), issue/list/void/mark-paid, guest list. Invited-org members with `tickets.manage` MUST see issue/list/void/mark-paid only for their org's allocation. Users without `tickets.manage` MUST NOT see officer ticket controls; redirect or 403 without UI leak. ACTIVE users with `tickets.scan` on the host org MUST have a scanner surface on the host event ticketing page (tab or dedicated sub-route) supporting camera scan and manual credential paste. Scanner UI MUST show distinct states for success, already checked in, unpaid, void, invalid token, event at capacity, and forbidden (wrong org or missing permission). Users with `tickets.manage` but not `tickets.scan` MUST NOT see scanner controls. Guest list UI MUST show allocation org label, status, and read-only `checkedIn` / `checkedInAt` with no undo check-in control. ACTIVE users MUST have a minimal surface at `/app/tickets` (or equivalent) to view own tickets, claim from on_sale public events, and display a QR code for each paid ticket derived from `credentialToken`. Unpaid and void tickets MUST NOT show a scannable QR on the holder surface.

#### Scenario: Host manager opens ticket config

- **WHEN** an ACTIVE member with `tickets.manage` for the host org navigates to `/app/events/$eventId/tickets`
- **THEN** ticketing config and allocation controls load

#### Scenario: Invited-org manager sees scoped ticket UI

- **WHEN** an ACTIVE member with `tickets.manage` for an invited org opens ticket UI for a multi-org event
- **THEN** only their allocation's issue/list/void/mark-paid controls are shown

#### Scenario: User without tickets.manage redirected from officer ticket UI

- **WHEN** a member without `tickets.manage` navigates to `/app/events/$eventId/tickets`
- **THEN** the app redirects away without exposing officer ticket controls

#### Scenario: Active user views own tickets and claim

- **WHEN** an ACTIVE user navigates to `/app/tickets`
- **THEN** they see their held tickets, may claim from eligible on_sale public events, and see QR for paid tickets

#### Scenario: Host scanner with tickets.scan opens scanner

- **WHEN** an ACTIVE member with `tickets.scan` for the host org opens the event ticketing scanner
- **THEN** camera and paste inputs are available

#### Scenario: Manage-only user cannot open scanner

- **WHEN** an ACTIVE member with `tickets.manage` but not `tickets.scan` opens event ticketing
- **THEN** scanner controls are not shown

#### Scenario: Paid holder sees QR unpaid does not

- **WHEN** an ACTIVE user views their paid ticket on `/app/tickets`
- **THEN** a QR encoding the credentialToken is displayed; unpaid and void tickets show no valid QR

### Requirement: Ticketing API routes are authenticated with server-side org checks

All ticket-related API routes MUST require authentication. Org and allocation authorization MUST be enforced server-side (not UI-only). Admin ticket routes MUST require platform ADMIN. Check-in MUST require platform ADMIN or `tickets.scan` on the event's host organization only. Shared Zod schemas in `packages/contracts` MUST validate request bodies, query params, and parsed responses at HTTP boundaries.

#### Scenario: Unauthenticated ticket request rejected

- **WHEN** an unauthenticated client calls a ticket endpoint
- **THEN** the system returns 401 Unauthorized

#### Scenario: Admin bypasses org ticket checks

- **WHEN** platform ADMIN performs any ticket operation on any event
- **THEN** the operation succeeds if business rules pass

## ADDED Requirements

### Requirement: Check-in by credential token is atomic and single-use

The system MUST expose `POST` check-in by credential token with Zod-validated request body containing the credential. Authorization MUST be platform ADMIN or ACTIVE member with `tickets.scan` on `event.organizationId` (host org). The endpoint MUST reject: unknown credential token, ticket status `unpaid`, ticket status `void`, ticket already checked in (`checkedIn` true), and event at capacity (count of tickets with `checkedIn` true for the event ≥ `ticketCapacity` when ticketing is enabled). Successful check-in MUST atomically set `checkedIn` true and `checkedInAt` to the current timestamp using an update conditioned on `checkedIn = false` so concurrent scans of the same token yield at most one success. Response MUST include ticket id, event id, allocation organization id (nullable), holder user id (nullable), and `checkedInAt`. There MUST be no undo or clear check-in endpoint. Ticket `status` MUST remain `unpaid` | `paid` | `void` (no scanned status enum). The `credentialToken` MUST remain usable for QR display after check-in but subsequent scan attempts MUST fail as already checked in.

#### Scenario: First scan of paid ticket succeeds

- **WHEN** an authorized scanner posts a valid credential for a paid unchecked-in ticket and event is below capacity
- **THEN** the ticket has checkedIn true, checkedInAt set, and the response includes ticket id, event, allocation org, holder, and checkedInAt

#### Scenario: Second scan of same ticket rejected

- **WHEN** an authorized scanner posts the same credential after a successful check-in
- **THEN** the system returns a client error indicating already checked in and does not change checkedInAt

#### Scenario: Unpaid ticket scan rejected

- **WHEN** an authorized scanner posts a credential for a ticket with status unpaid
- **THEN** the system returns a client error and does not set checkedIn

#### Scenario: Void ticket scan rejected

- **WHEN** an authorized scanner posts a credential for a ticket with status void
- **THEN** the system returns a client error and does not set checkedIn

#### Scenario: Unknown credential rejected

- **WHEN** an authorized scanner posts a credential that does not match any ticket
- **THEN** the system returns a client error

#### Scenario: Event at capacity rejects check-in

- **WHEN** the count of checked-in tickets for the event is already ≥ ticketCapacity and an authorized scanner posts a valid unpaid-checked-in paid credential
- **THEN** the system returns a client error and does not set checkedIn

#### Scenario: Concurrent scans race-safe

- **WHEN** two authorized scanners post the same credential concurrently before either check-in completes
- **THEN** at most one succeeds and the other receives already-checked-in or equivalent client error

#### Scenario: Invited-org scanner forbidden

- **WHEN** a member with tickets.scan only on an invited org posts check-in for a host-org event ticket
- **THEN** the system returns 403 Forbidden

#### Scenario: Manage-only member forbidden on check-in

- **WHEN** a member with tickets.manage but not tickets.scan posts check-in
- **THEN** the system returns 403 Forbidden

### Requirement: QR credential encodes existing token for paid tickets only

Paid tickets MUST expose QR (or equivalent scannable encoding) derived from the existing `credentialToken` on the holder `/app/tickets` surface and anywhere officers preview a ticket credential. Unpaid and void tickets MUST NOT present a credential that the check-in endpoint will accept. Display of QR MUST NOT mutate ticket state.

#### Scenario: Paid ticket QR encodes credentialToken

- **WHEN** a holder views a paid ticket
- **THEN** the displayed QR encodes the ticket's credentialToken

#### Scenario: Unpaid ticket has no valid scan QR

- **WHEN** a holder views an unpaid ticket
- **THEN** no scannable QR is shown or scan of any displayed placeholder is rejected by check-in

#### Scenario: Void ticket has no valid scan QR

- **WHEN** a holder views a void ticket
- **THEN** no scannable QR is shown or scan is rejected by check-in
