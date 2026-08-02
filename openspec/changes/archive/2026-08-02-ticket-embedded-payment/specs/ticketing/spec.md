## ADDED Requirements

### Requirement: Void blocks checkout and cancels open PaymentIntent

Voiding a ticket MUST cancel any open Stripe PaymentIntent linked via TicketPayment with `status` `requires_payment`, and update TicketPayment to `canceled` when cancellation succeeds. Checkout endpoint MUST reject void tickets with a client error (4xx).

#### Scenario: Void cancels open PaymentIntent

- **WHEN** an authorized actor voids a ticket with an open `requires_payment` TicketPayment
- **THEN** the Stripe PaymentIntent is canceled and TicketPayment becomes `canceled`

#### Scenario: Checkout rejected for void ticket

- **WHEN** a holder attempts checkout on a void ticket
- **THEN** the system returns a client error

## MODIFIED Requirements

### Requirement: Ticket operations are scoped by org and permission

Platform ADMIN MUST bypass all org ticket checks and MUST be the only non-Stripe actor allowed to mark tickets paid. Host-org member with `tickets.manage` MUST manage config, all allocations (including public), and issue/list/void for any allocation on hosted events; they MUST NOT mark tickets paid. Invited-org member with `tickets.manage` MUST issue/list/void only within their organization's allocation on that event; they MUST NOT access public allocation or other org allocations and MUST NOT mark tickets paid. Org A MUST NOT issue against Org B's allocation. Missing `tickets.manage` (and non-ADMIN) MUST receive 403 on protected ticket endpoints. Listing tickets MUST support filters by event, allocation, organization, and status. Holder checkout is authorized by `holderUserId`, not `tickets.manage`.

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

#### Scenario: tickets.manage cannot mark paid

- **WHEN** a member with `tickets.manage` but not platform ADMIN calls mark-paid
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin mark paid allowed

- **WHEN** platform ADMIN calls mark-paid on an unpaid ticket
- **THEN** the ticket becomes paid if business rules pass

### Requirement: Tickets are issued, voided, and marked paid under allocation limits

The system MUST persist tickets with: required `allocationId`, required `status` enum `unpaid` | `paid` | `void`, required unique opaque `credentialToken`, optional `holderUserId` foreign key to User, required `checkedIn` boolean defaulting to false, optional `checkedInAt` datetime, and timestamps (`paidAt`, `voidedAt` as applicable). Issuing a ticket MUST increment the non-void issued count for that allocation and MUST NOT exceed allocation quantity. When allocation `priceCents` is zero, issued tickets MUST be created with `status` `paid` and `paidAt` set (no Stripe). When allocation `priceCents` is greater than zero, issued tickets MUST be created with `status` `unpaid`. Voiding a ticket MUST set status to `void`, record `voidedAt`, cancel any open PaymentIntent per ticket-payments void rule, and free the allocation slot for re-issue. Marking paid MUST transition `unpaid` → `paid` and set `paidAt`; mark-paid MUST be restricted to platform ADMIN only (support escape hatch). Once `checkedIn` is true, `checkedIn` and `checkedInAt` MUST NOT be cleared or updated by any API or UI. Concurrent issue MUST NOT oversell: interactive transaction with row lock on the allocation (`SELECT FOR UPDATE` or equivalent). Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Issue ticket within allocation

- **WHEN** an authorized actor issues a ticket against an active allocation with remaining capacity and `priceCents` greater than zero
- **THEN** an unpaid ticket is created with a unique credentialToken, checkedIn false, and optional holderUserId

#### Scenario: Issue free ticket is paid immediately

- **WHEN** an authorized actor issues a ticket against an allocation with `priceCents` zero
- **THEN** a paid ticket is created with `paidAt` set

#### Scenario: Issue exceeds allocation quantity rejected

- **WHEN** issuing would bring non-void tickets for the allocation above its quantity
- **THEN** the system returns a client error and does not create a ticket

#### Scenario: Void frees slot and cancels payment

- **WHEN** an authorized actor voids a non-void ticket with an open checkout PaymentIntent
- **THEN** the ticket status becomes void, the PaymentIntent is canceled, and a new issue may succeed up to allocation quantity

#### Scenario: Admin mark paid transitions unpaid to paid

- **WHEN** platform ADMIN marks an unpaid ticket paid
- **THEN** the ticket status becomes paid and paidAt is set

#### Scenario: Non-admin mark paid forbidden

- **WHEN** a non-ADMIN user including the ticket holder calls mark-paid
- **THEN** the system returns 403 Forbidden

#### Scenario: Concurrent issue does not oversell

- **WHEN** two concurrent issue requests would exceed allocation quantity if both succeeded
- **THEN** at most one succeeds and the other receives a client error

#### Scenario: New ticket is not checked in

- **WHEN** a ticket is issued or marked paid
- **THEN** checkedIn is false and checkedInAt is null

### Requirement: ACTIVE users may self-claim from public allocation

An ACTIVE authenticated user MAY claim one ticket from the public allocation when: event `ticketingEnabled` is true, `ticketSaleStatus` is `on_sale`, public allocation exists with status `active`, and capacity remains. Claim MUST create a ticket with `holderUserId` set to the caller. When public allocation `priceCents` is zero, claim MUST create a `paid` ticket with `paidAt` set. When `priceCents` is greater than zero, claim MUST create an `unpaid` ticket. Self-claim MUST NOT require `tickets.manage`. The system MAY enforce at most one active non-void ticket per user per event for simplicity. Org members MAY use self-claim for public pool tickets (same rule as guests).

#### Scenario: Active user claims public ticket unpaid when paid price

- **WHEN** an ACTIVE user claims from an on_sale event with an active public allocation, remaining capacity, and `priceCents` greater than zero
- **THEN** an unpaid ticket is created with holderUserId equal to the caller

#### Scenario: Active user claims free public ticket as paid

- **WHEN** an ACTIVE user claims from a public allocation with `priceCents` zero
- **THEN** a paid ticket is created with holderUserId equal to the caller and `paidAt` set

#### Scenario: Claim rejected when not on sale

- **WHEN** an ACTIVE user attempts to claim while ticketSaleStatus is draft or closed
- **THEN** the system returns a client error

#### Scenario: Claim rejected when public allocation closed

- **WHEN** an ACTIVE user attempts to claim and the public allocation status is closed
- **THEN** the system returns a client error

### Requirement: Member ticket UI is permission-gated

The web app MUST provide ticket management for hosted events at `/app/events/$eventId/tickets` (sub-routes as needed) for ACTIVE users with `tickets.manage` on the host org: config, allocations (select orgs, all orgs, public toggle), issue/list/void, guest list. Mark-paid controls MUST appear only for platform ADMIN. Invited-org members with `tickets.manage` MUST see issue/list/void only for their org's allocation. Users without `tickets.manage` MUST NOT see officer ticket controls; redirect or 403 without UI leak. ACTIVE users with `tickets.scan` on the host org MUST be able to view and list host-org events and open the scanner sub-route on `/app/events/$eventId/tickets` without holding `tickets.manage` or `events.manage`. ACTIVE users with `tickets.scan` on the host org MUST have a scanner surface on the host event ticketing page (tab or dedicated sub-route) supporting camera scan and manual credential paste. Scanner UI MUST show distinct states for success, already checked in, unpaid, void, invalid token, event at capacity, and forbidden (wrong org or missing permission). Users with `tickets.manage` but not `tickets.scan` MUST NOT see scanner controls. Guest list UI MUST show allocation org label, status, and read-only `checkedIn` / `checkedInAt` with no undo check-in control. ACTIVE users MUST have a minimal surface at `/app/tickets` (or equivalent) to view own tickets, claim from on_sale public events, navigate to `/app/tickets/$id/pay` for unpaid tickets on paid allocations, and display a QR code for each paid ticket derived from `credentialToken`. Unpaid and void tickets MUST NOT show a scannable QR on the holder surface. Holder self mark-paid controls MUST NOT be shown. Paid allocation and on_sale controls MUST show Stripe readiness banners per the paid-sale banner requirement when the host org is not charge-ready.

#### Scenario: Host manager opens ticket config

- **WHEN** an ACTIVE member with `tickets.manage` for the host org navigates to `/app/events/$eventId/tickets`
- **THEN** ticketing config and allocation controls load

#### Scenario: Invited-org manager sees scoped ticket UI

- **WHEN** an ACTIVE member with `tickets.manage` for an invited org opens ticket UI for a multi-org event
- **THEN** only their allocation's issue/list/void/mark-paid controls are shown

#### Scenario: User without tickets.manage redirected from officer ticket UI

- **WHEN** a member without `tickets.manage` or `tickets.scan` navigates to `/app/events/$eventId/tickets`
- **THEN** the app redirects away without exposing officer ticket controls

#### Scenario: Active user views own tickets claim and pay CTA

- **WHEN** an ACTIVE user navigates to `/app/tickets` with an unpaid ticket on a paid allocation
- **THEN** they see their held tickets, may claim from eligible on_sale public events, see a pay CTA linking to `/app/tickets/$id/pay`, and see QR for paid tickets only

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

#### Scenario: Holder has no self mark-paid control

- **WHEN** an ACTIVE holder views their unpaid ticket on `/app/tickets`
- **THEN** no mark-paid control is shown; pay CTA is shown instead for paid allocations

#### Scenario: Stripe banner on paid controls when not ready

- **WHEN** a member with `tickets.manage` opens allocation or on_sale controls and host org is not charge-ready
- **THEN** the Stripe readiness banner is visible on those controls

## REMOVED Requirements

### Requirement: Users may mark paid their own unpaid tickets

**Reason**: Replaced by embedded Stripe checkout for paid tickets and immediate paid status for free tickets; mark-paid retained as ADMIN-only support escape hatch.

**Migration**: Holders pay via `/app/tickets/$id/pay`. Support staff use ADMIN mark-paid endpoint.
