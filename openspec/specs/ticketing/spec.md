# ticketing Specification

## Purpose

Org-scoped event ticketing on existing `Event` records: inline config, per-org and public allocations, ticket issue/void/mark-paid, guest self-claim, guest list, QR credentials, host-org check-in scanning, and Stripe Connect charge-readiness gates for paid sales (Checkout is out of scope this phase).

## Requirements

### Requirement: Ticket allocations are org-scoped or public per event

The system MUST persist ticket allocations with: required `eventId` foreign key, nullable `organizationId` foreign key (null = public/guest pool), required `quantity` (positive integer), optional `priceCents` (integer ≥ 0), required `status` enum `active` | `closed`, and timestamps. For non-null `organizationId`, there MUST be at most one allocation per `(eventId, organizationId)`. For null `organizationId`, there MUST be at most one public allocation per event (partial unique). Every issued ticket MUST belong to exactly one allocation. Sum of allocation quantities for an event MUST NOT exceed the event's `ticketCapacity` when ticketing is enabled. Over-allocation MUST return a client error (4xx).

#### Scenario: Host creates org allocation

- **WHEN** an authorized actor creates an allocation for event E with organizationId O, quantity Q, and status active
- **THEN** the allocation is persisted and returned with eventId E, organizationId O, and quantity Q

#### Scenario: Host creates public allocation

- **WHEN** an authorized actor creates an allocation for event E with organizationId null and quantity Q
- **THEN** the allocation is persisted as the public pool for event E

#### Scenario: Duplicate org allocation rejected

- **WHEN** an authorized actor attempts a second allocation for the same eventId and non-null organizationId
- **THEN** the system returns a client error and does not create a duplicate row

#### Scenario: Duplicate public allocation rejected

- **WHEN** an authorized actor attempts a second allocation with organizationId null for the same event
- **THEN** the system returns a client error

#### Scenario: Over-allocation rejected

- **WHEN** the sum of allocation quantities would exceed the event's ticketCapacity
- **THEN** the system returns a client error and does not persist the change

### Requirement: Allocation management is authorized by role and org

Creating, updating, or closing allocations MUST require platform ADMIN, or an ACTIVE member with `tickets.manage` for the event's host organization (`event.organizationId`). Invited-org members with `tickets.manage` MUST NOT create or edit allocations (issue/list/void/mark-paid within their allocation only). "Select all orgs" MUST create explicit per-organization allocation rows for every `Organization` in the system (no university filter). Public pool MUST be a separate optional allocation with `organizationId = null` and MUST NOT be auto-created by "all orgs". Request shapes MUST be validated with shared Zod schemas.

#### Scenario: Host with tickets.manage creates allocations

- **WHEN** an ACTIVE member with `tickets.manage` for the host org creates org and public allocations for a hosted event
- **THEN** both allocations are persisted

#### Scenario: Invited-org manager cannot edit allocations

- **WHEN** a member with `tickets.manage` for org B (not the host) attempts to create or update an allocation on a host-org event
- **THEN** the system returns 403 Forbidden

#### Scenario: All-orgs creates row per organization

- **WHEN** an authorized actor chooses "all orgs" for an event
- **THEN** the system creates one allocation row per existing Organization with distinct organizationIds

### Requirement: Allocation edits respect sale status and issued counts

While event `ticketSaleStatus` is `draft`, allocation quantity and status MAY be edited freely subject to capacity rules. While `on_sale`, allocation quantity MUST NOT be set below the count of non-void tickets already issued against that allocation. Closing an allocation MUST set status to `closed` without deleting issued tickets.

#### Scenario: Draft allocation quantity reduced

- **WHEN** event sale status is draft and an authorized actor reduces an allocation quantity above zero
- **THEN** the new quantity is persisted if capacity rules pass

#### Scenario: On-sale quantity below issued count rejected

- **WHEN** event sale status is on_sale and an authorized actor sets allocation quantity below the count of non-void issued tickets
- **THEN** the system returns a client error

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

### Requirement: Ticket operations are scoped by org and permission

Platform ADMIN MUST bypass all org ticket checks. Host-org member with `tickets.manage` MUST manage config, all allocations (including public), and issue/list/void/mark-paid for any allocation on hosted events. Invited-org member with `tickets.manage` MUST issue/list/void/mark-paid only within their organization's allocation on that event; they MUST NOT access public allocation or other org allocations. Org A MUST NOT issue against Org B's allocation. Missing `tickets.manage` (and non-ADMIN) MUST receive 403 on protected ticket endpoints. Listing tickets MUST support filters by event, allocation, organization, and status.

#### Scenario: Invited-org manager issues within own allocation

- **WHEN** a member with `tickets.manage` for org B issues a ticket on an event where org B has an allocation
- **THEN** the ticket is created under org B's allocation

#### Scenario: Invited-org manager cannot issue on public allocation

- **WHEN** a member with `tickets.manage` for org B attempts to issue on the public allocation
- **THEN** the system returns 403 Forbidden

#### Scenario: Invited-org manager cannot issue on another org allocation

- **WHEN** a member with `tickets.manage` for org B attempts to issue on org C's allocation
- **THEN** the system returns 403 Forbidden

#### Scenario: Member without tickets.manage denied

- **WHEN** a member without `tickets.manage` attempts to issue or void a ticket
- **THEN** the system returns 403 Forbidden

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

### Requirement: ACTIVE users may self-claim from public allocation

An ACTIVE authenticated user MAY claim one ticket from the public allocation when: event `ticketingEnabled` is true, `ticketSaleStatus` is `on_sale`, public allocation exists with status `active`, and capacity remains. Claim MUST create an unpaid ticket with `holderUserId` set to the caller. Self-claim MUST NOT require `tickets.manage`. The system MAY enforce at most one active non-void ticket per user per event for simplicity. Org members MAY use self-claim for public pool tickets (same rule as guests).

#### Scenario: Active user claims public ticket

- **WHEN** an ACTIVE user claims from an on_sale event with an active public allocation and remaining capacity
- **THEN** an unpaid ticket is created with holderUserId equal to the caller

#### Scenario: Claim rejected when not on sale

- **WHEN** an ACTIVE user attempts to claim while ticketSaleStatus is draft or closed
- **THEN** the system returns a client error

#### Scenario: Claim rejected when public allocation closed

- **WHEN** an ACTIVE user attempts to claim and the public allocation status is closed
- **THEN** the system returns a client error

### Requirement: Users may mark paid their own unpaid tickets

An ACTIVE user MUST be allowed to mark paid an unpaid ticket where `holderUserId` equals the caller, without holding `tickets.manage`. Users MUST NOT mark paid tickets they do not hold. Users without `tickets.manage` MUST NOT void tickets or access officer ticket management UI.

#### Scenario: Holder marks own ticket paid

- **WHEN** an ACTIVE user calls mark-paid on their own unpaid ticket
- **THEN** the ticket becomes paid

#### Scenario: User cannot mark paid another holder's ticket

- **WHEN** a user attempts to mark paid a ticket held by another user
- **THEN** the system returns 403 Forbidden

### Requirement: Paid allocations require host org Stripe charges enabled

Creating or updating a ticket allocation with `priceCents` greater than zero MUST require the event host organization's `stripeChargesEnabled` to be true. The gate MUST apply to the event's host organization (`event.organizationId`), not invited allocation orgs. Allocations with `priceCents` zero or null MUST NOT be blocked by this gate. Violations MUST return a client error (4xx) with a clear message that Connect onboarding is required. Platform ADMIN MUST NOT bypass this gate (flags are Stripe-sourced only).

#### Scenario: Paid allocation blocked when charges disabled

- **WHEN** an authorized actor creates or updates an allocation with `priceCents` > 0 for a hosted event whose host org has `stripeChargesEnabled` false
- **THEN** the system returns a client error and does not persist the paid price

#### Scenario: Free allocation allowed when charges disabled

- **WHEN** an authorized actor creates or updates an allocation with `priceCents` 0 or null while host org charges are disabled
- **THEN** the allocation is persisted if other rules pass

#### Scenario: Paid allocation allowed when charges enabled

- **WHEN** an authorized actor sets `priceCents` > 0 and host org `stripeChargesEnabled` is true
- **THEN** the allocation is persisted if other rules pass

#### Scenario: Admin cannot bypass paid allocation gate

- **WHEN** platform ADMIN attempts a paid allocation while host org `stripeChargesEnabled` is false
- **THEN** the system returns a client error

### Requirement: on_sale transition requires charges when any paid allocation exists

Transitioning an event's `ticketSaleStatus` to `on_sale` MUST be rejected with a client error (4xx) when any allocation for that event has `priceCents` greater than zero and the host organization's `stripeChargesEnabled` is false. Events with only free allocations (`priceCents` zero or null for all allocations) MUST NOT be blocked by this gate.

#### Scenario: on_sale blocked with paid allocation and charges disabled

- **WHEN** an authorized actor sets `ticketSaleStatus` to `on_sale` and at least one allocation has `priceCents` > 0 while host org charges are disabled
- **THEN** the system returns a client error and sale status remains unchanged

#### Scenario: on_sale allowed with only free allocations

- **WHEN** an authorized actor sets `ticketSaleStatus` to `on_sale` and every allocation has `priceCents` zero or null
- **THEN** the transition succeeds if other rules pass regardless of Stripe status

#### Scenario: on_sale allowed when charges enabled

- **WHEN** an authorized actor sets `ticketSaleStatus` to `on_sale`, a paid allocation exists, and host org `stripeChargesEnabled` is true
- **THEN** the transition succeeds if other rules pass

### Requirement: Ticket UI shows Stripe readiness banners for paid sales

The web app MUST show a blocking banner on paid allocation forms and on the on_sale transition control when the host org is not charge-ready per `stripe-connect`. The banner MUST explain that Connect onboarding is required and MUST include a CTA to org payments settings for users with `payments.manage` on the host org. Users without `payments.manage` MUST see copy to ask an officer with payments access and MUST NOT see the Connect CTA. Free-only ticketing surfaces MUST NOT show the paid-sale banner.

#### Scenario: Host manager sees banner on paid allocation form

- **WHEN** a member with `tickets.manage` and `payments.manage` edits allocations and host org is not charge-ready
- **THEN** a blocking banner with Connect CTA is shown on paid price inputs

#### Scenario: Ticket manager without payments.manage sees ask-officer banner

- **WHEN** a member with `tickets.manage` but not `payments.manage` opens paid allocation controls while host org is not charge-ready
- **THEN** a banner explains Connect is required and directs them to an officer with payments access without a Connect CTA

#### Scenario: No banner for free-only event

- **WHEN** all allocations are free and host org is not charge-ready
- **THEN** no Stripe readiness banner is shown on ticketing forms

### Requirement: Member ticket UI is permission-gated

The web app MUST provide ticket management for hosted events at `/app/events/$eventId/tickets` (sub-routes as needed) for ACTIVE users with `tickets.manage` on the host org: config, allocations (select orgs, all orgs, public toggle), issue/list/void/mark-paid, guest list. Invited-org members with `tickets.manage` MUST see issue/list/void/mark-paid only for their org's allocation. Users without `tickets.manage` MUST NOT see officer ticket controls; redirect or 403 without UI leak. ACTIVE users with `tickets.scan` on the host org MUST be able to view and list host-org events and open the scanner sub-route on `/app/events/$eventId/tickets` without holding `tickets.manage` or `events.manage`. ACTIVE users with `tickets.scan` on the host org MUST have a scanner surface on the host event ticketing page (tab or dedicated sub-route) supporting camera scan and manual credential paste. Scanner UI MUST show distinct states for success, already checked in, unpaid, void, invalid token, event at capacity, and forbidden (wrong org or missing permission). Users with `tickets.manage` but not `tickets.scan` MUST NOT see scanner controls. Guest list UI MUST show allocation org label, status, and read-only `checkedIn` / `checkedInAt` with no undo check-in control. ACTIVE users MUST have a minimal surface at `/app/tickets` (or equivalent) to view own tickets, claim from on_sale public events, and display a QR code for each paid ticket derived from `credentialToken`. Unpaid and void tickets MUST NOT show a scannable QR on the holder surface. Paid allocation and on_sale controls MUST show Stripe readiness banners per the paid-sale banner requirement when the host org is not charge-ready.

#### Scenario: Host manager opens ticket config

- **WHEN** an ACTIVE member with `tickets.manage` for the host org navigates to `/app/events/$eventId/tickets`
- **THEN** ticketing config and allocation controls load

#### Scenario: Invited-org manager sees scoped ticket UI

- **WHEN** an ACTIVE member with `tickets.manage` for an invited org opens ticket UI for a multi-org event
- **THEN** only their allocation's issue/list/void/mark-paid controls are shown

#### Scenario: User without tickets.manage redirected from officer ticket UI

- **WHEN** a member without `tickets.manage` or `tickets.scan` navigates to `/app/events/$eventId/tickets`
- **THEN** the app redirects away without exposing officer ticket controls

#### Scenario: Active user views own tickets and claim

- **WHEN** an ACTIVE user navigates to `/app/tickets`
- **THEN** they see their held tickets, may claim from eligible on_sale public events, and see QR for paid tickets

#### Scenario: Scan-only member lists host events and opens scanner

- **WHEN** an ACTIVE member with `tickets.scan` but not `tickets.manage` or `events.manage` for the host org navigates to hosted events and opens `/app/events/$eventId/tickets` scanner
- **THEN** the event list and scanner surface load without officer ticket management controls

#### Scenario: Host scanner with tickets.scan opens scanner

- **WHEN** an ACTIVE member with `tickets.scan` for the host org opens the event ticketing scanner
- **THEN** camera and paste inputs are available

#### Scenario: Manage-only user cannot open scanner

- **WHEN** an ACTIVE member with `tickets.manage` but not `tickets.scan` opens event ticketing
- **THEN** scanner controls are not shown

#### Scenario: Paid holder sees QR unpaid does not

- **WHEN** an ACTIVE user views their paid ticket on `/app/tickets`
- **THEN** a QR encoding the credentialToken is displayed; unpaid and void tickets show no valid QR

#### Scenario: Stripe banner on paid controls when not ready

- **WHEN** a member with `tickets.manage` opens allocation or on_sale controls and host org is not charge-ready
- **THEN** the Stripe readiness banner is visible on those controls

### Requirement: Ticketing API routes are authenticated with server-side org checks

All ticket-related API routes MUST require authentication. Org and allocation authorization MUST be enforced server-side (not UI-only). Admin ticket routes MUST require platform ADMIN. Check-in MUST require platform ADMIN or `tickets.scan` on the event's host organization only. Shared Zod schemas in `packages/contracts` MUST validate request bodies, query params, and parsed responses at HTTP boundaries.

#### Scenario: Unauthenticated ticket request rejected

- **WHEN** an unauthenticated client calls a ticket endpoint
- **THEN** the system returns 401 Unauthorized

#### Scenario: Admin bypasses org ticket checks

- **WHEN** platform ADMIN performs any ticket operation on any event
- **THEN** the operation succeeds if business rules pass

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
