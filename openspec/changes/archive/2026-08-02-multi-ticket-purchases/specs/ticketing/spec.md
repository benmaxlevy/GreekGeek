## ADDED Requirements

### Requirement: Per-user ticket cap is enforced server-side

The system MUST enforce `MAX_TICKETS_PER_USER_PER_EVENT` (env, default **2**) as the maximum number of non-void tickets (`unpaid` or `paid`) a single user may hold for a given event. The cap MUST apply to buyer purchase checkout, public self-claim, and officer issue when a `holderUserId` is set. Exceeding the cap MUST return a client error (4xx). There MUST be no `MAX_TICKETS_PER_PURCHASE` environment variable; purchase quantity is bounded by `min(allocation remaining, event capacity remaining, per-user headroom under MAX_TICKETS_PER_USER_PER_EVENT)`.

#### Scenario: Purchase within per-user headroom succeeds

- **WHEN** a buyer with zero tickets for the event purchases quantity equal to `MAX_TICKETS_PER_USER_PER_EVENT` and capacity allows
- **THEN** N unpaid tickets are reserved with `holderUserId` equal to the buyer

#### Scenario: Purchase exceeding per-user cap rejected

- **WHEN** a buyer already holds `MAX_TICKETS_PER_USER_PER_EVENT` non-void tickets for the event and requests another purchase
- **THEN** the system returns a client error and creates no tickets

#### Scenario: Claim rejected at per-user cap

- **WHEN** an ACTIVE user at the per-user cap attempts public self-claim
- **THEN** the system returns a client error

### Requirement: Guest list groups tickets by purchase and buyer

The guest list for an event MUST include only tickets with status `paid`. Entries MUST be groupable by Purchase (when `purchaseId` is set) and by buyer/holder identity. Each entry MUST still show holder identity (when `holderUserId` is set), allocation organization label (organization name for org allocations, or "Public" for null organizationId), ticket status, `checkedIn`, and `checkedInAt` when set. Unpaid tickets MUST NOT appear on the guest list. Officer UI MUST present tickets grouped by purchase/buyer.

#### Scenario: Paid purchase tickets grouped together

- **WHEN** an authorized actor requests the guest list for an event where a buyer has two paid tickets from one Purchase
- **THEN** both tickets appear under the same purchase/buyer group

#### Scenario: Officer-issued paid ticket without purchase still listed

- **WHEN** an officer-issued paid ticket has `purchaseId` null
- **THEN** the ticket appears on the guest list under the holder (or unassigned) without a purchase group id

## MODIFIED Requirements

### Requirement: Tickets are issued, voided, and marked paid under allocation limits

The system MUST persist tickets with: required `allocationId`, required `status` enum `unpaid` | `paid` | `void`, required unique opaque `credentialToken`, optional `holderUserId` foreign key to User, optional nullable `purchaseId` foreign key to Purchase (null for officer-issued and free tickets; indexed), required `checkedIn` boolean defaulting to false, optional `checkedInAt` datetime, and timestamps (`paidAt`, `voidedAt` as applicable). Issuing a ticket MUST increment the non-void issued count for that allocation and MUST NOT exceed allocation quantity. When allocation `priceCents` is zero, issued tickets MUST be created with `status` `paid` and `paidAt` set (no Stripe, `purchaseId` null). When allocation `priceCents` is greater than zero, officer-issued tickets MUST be created with `status` `unpaid` and `purchaseId` null. Buyer purchase checkout MUST create N unpaid tickets with `purchaseId` set per ticket-payments. Voiding a ticket MUST set status to `void`, record `voidedAt`, cancel any open PaymentIntent per ticket-payments void/purchase rules when applicable, and free the allocation slot for re-issue. Void of an individual paid ticket MUST NOT alter Purchase totals. Marking paid MUST transition `unpaid` → `paid` and set `paidAt`; mark-paid MUST be restricted to platform ADMIN only (support escape hatch). Once `checkedIn` is true, `checkedIn` and `checkedInAt` MUST NOT be cleared or updated by any API or UI. Concurrent issue and purchase reservation MUST NOT oversell: interactive transaction with row lock on the allocation (`SELECT FOR UPDATE` or equivalent), respecting both allocation remaining and event capacity. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Issue ticket within allocation

- **WHEN** an authorized actor issues a ticket against an active allocation with remaining capacity and `priceCents` greater than zero
- **THEN** an unpaid ticket is created with a unique credentialToken, checkedIn false, optional holderUserId, and purchaseId null

#### Scenario: Issue free ticket is paid immediately

- **WHEN** an authorized actor issues a ticket against an allocation with `priceCents` zero
- **THEN** a paid ticket is created with `paidAt` set and purchaseId null

#### Scenario: Issue exceeds allocation quantity rejected

- **WHEN** issuing would bring non-void tickets for the allocation above its quantity
- **THEN** the system returns a client error and does not create a ticket

#### Scenario: Void frees slot and cancels payment

- **WHEN** an authorized actor voids a non-void ticket linked to an open `requires_payment` Purchase
- **THEN** the ticket status becomes void, the PaymentIntent is canceled when no remaining unpaid tickets hold the purchase open (or per purchase void rules), and a new issue may succeed up to allocation quantity

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

### Requirement: Void blocks checkout and cancels open PaymentIntent

Voiding any unpaid ticket linked to an open Purchase (`status` `requires_payment`) MUST cancel the Stripe PaymentIntent, set Purchase to `canceled` when cancellation succeeds, and DELETE (or otherwise release) all remaining unpaid reserved tickets for that purchase so allocation slots are freed. Checkout MUST reject ineligible allocation or sale-state requests with a client error (4xx). Void of an individual **paid** ticket MUST NOT alter Purchase totals (see ticket-payments).

#### Scenario: Void reserved unpaid ticket cancels whole open Purchase

- **WHEN** an authorized actor voids an unpaid ticket on a `requires_payment` Purchase with quantity greater than one
- **THEN** the Stripe PaymentIntent is canceled, Purchase becomes `canceled`, and all unpaid reserved tickets for that purchase are released

#### Scenario: Checkout rejected when not eligible

- **WHEN** a buyer attempts checkout while the allocation is closed or the event is not on_sale
- **THEN** the system returns a client error

### Requirement: Guest list shows paid tickets only

The guest list for an event MUST include only tickets with status `paid`. Each entry MUST show holder identity (when holderUserId is set), allocation organization label (organization name for org allocations, or "Public" for null organizationId), ticket status, `checkedIn`, and `checkedInAt` when set. Unpaid tickets MUST NOT appear on the guest list. Officer guest list UI MUST group tickets by purchase/buyer when `purchaseId` is present.

#### Scenario: Paid ticket appears on guest list

- **WHEN** an authorized actor requests the guest list for an event with paid tickets
- **THEN** only paid tickets are returned with allocation org label or "Public", checkedIn, and checkedInAt

#### Scenario: Unpaid ticket excluded from guest list

- **WHEN** an event has unpaid and paid tickets
- **THEN** the guest list includes only paid tickets

#### Scenario: Guest list shows check-in state

- **WHEN** a paid ticket has been checked in
- **THEN** the guest list entry shows checkedIn true and the checkedInAt timestamp

#### Scenario: Guest list groups by purchase

- **WHEN** two paid tickets share the same purchaseId
- **THEN** the officer guest list presents them grouped by that purchase/buyer

### Requirement: ACTIVE users may self-claim from public allocation

An ACTIVE authenticated user MAY claim one ticket from the public allocation when: event `ticketingEnabled` is true, `ticketSaleStatus` is `on_sale`, public allocation exists with status `active`, capacity remains, and the caller is under `MAX_TICKETS_PER_USER_PER_EVENT` for that event. Claim MUST create a ticket with `holderUserId` set to the caller. When public allocation `priceCents` is zero, claim MUST create a `paid` ticket with `paidAt` set and `purchaseId` null. When `priceCents` is greater than zero, claim MUST create an `unpaid` ticket with `purchaseId` null (holder then uses purchase checkout for multi-quantity buys on paid allocations). Self-claim MUST NOT require `tickets.manage`. The prior informal one-active-ticket-per-user-per-event limit is replaced by the server-enforced `MAX_TICKETS_PER_USER_PER_EVENT` cap. Org members MAY use self-claim for public pool tickets (same rule as guests).

#### Scenario: Active user claims public ticket unpaid when paid price

- **WHEN** an ACTIVE user under the per-user cap claims from an on_sale event with an active public allocation, remaining capacity, and `priceCents` greater than zero
- **THEN** an unpaid ticket is created with holderUserId equal to the caller and purchaseId null

#### Scenario: Active user claims free public ticket as paid

- **WHEN** an ACTIVE user claims from a public allocation with `priceCents` zero
- **THEN** a paid ticket is created with holderUserId equal to the caller, paidAt set, and purchaseId null

#### Scenario: Claim rejected when not on sale

- **WHEN** an ACTIVE user attempts to claim while ticketSaleStatus is draft or closed
- **THEN** the system returns a client error

#### Scenario: Claim rejected when public allocation closed

- **WHEN** an ACTIVE user attempts to claim and the public allocation status is closed
- **THEN** the system returns a client error

#### Scenario: Claim rejected at per-user cap

- **WHEN** an ACTIVE user already holds MAX_TICKETS_PER_USER_PER_EVENT non-void tickets for the event and attempts claim
- **THEN** the system returns a client error

### Requirement: Member ticket UI is permission-gated

The web app MUST provide ticket management for hosted events at `/app/events/$eventId/tickets` (sub-routes as needed) for ACTIVE users with `tickets.manage` on the host org: config, allocations (select orgs, all orgs, public toggle), issue/list/void, guest list. Mark-paid controls MUST appear only for platform ADMIN. Invited-org members with `tickets.manage` MUST see issue/list/void only for their org's allocation. Users without `tickets.manage` MUST NOT see officer ticket controls; redirect or 403 without UI leak. ACTIVE users with `tickets.scan` on the host org MUST be able to view and list host-org events and open the scanner sub-route on `/app/events/$eventId/tickets` without holding `tickets.manage` or `events.manage`. ACTIVE users with `tickets.scan` on the host org MUST have a scanner surface on the host event ticketing page (tab or dedicated sub-route) supporting camera scan and manual credential paste. Scanner UI MUST show distinct states for success, already checked in, unpaid, void, invalid token, event at capacity, and forbidden (wrong org or missing permission). Users with `tickets.manage` but not `tickets.scan` MUST NOT see scanner controls. Guest list UI MUST show allocation org label, status, and read-only `checkedIn` / `checkedInAt` with no undo check-in control, and MUST group tickets by purchase/buyer. ACTIVE users MUST have a minimal surface at `/app/tickets` (or equivalent) to view own tickets, claim from on_sale public events, buy multiple tickets for eligible paid allocations via a quantity selector bounded by remaining allocation and per-user cap, navigate to embedded pay for unpaid purchase checkout, and display a QR code for each paid ticket derived from `credentialToken`. After a successful multi-ticket purchase, the holder surface MUST show all N tickets with QR codes. Unpaid and void tickets MUST NOT show a scannable QR on the holder surface. Holder self mark-paid controls MUST NOT be shown. Paid allocation and on_sale controls MUST show Stripe readiness banners per the paid-sale banner requirement when the host org is not charge-ready.

#### Scenario: Host manager opens ticket config

- **WHEN** an ACTIVE member with `tickets.manage` for the host org navigates to `/app/events/$eventId/tickets`
- **THEN** ticketing config and allocation controls load

#### Scenario: Invited-org manager sees scoped ticket UI

- **WHEN** an ACTIVE member with `tickets.manage` for an invited org opens ticket UI for a multi-org event
- **THEN** only their allocation's issue/list/void controls are shown (no mark-paid)

#### Scenario: User without tickets.manage redirected from officer ticket UI

- **WHEN** a member without `tickets.manage` or `tickets.scan` navigates to `/app/events/$eventId/tickets`
- **THEN** the app redirects away without exposing officer ticket controls

#### Scenario: Active user buys with quantity selector

- **WHEN** an ACTIVE user navigates to buy tickets for an eligible paid allocation
- **THEN** they see a quantity selector bounded by remaining allocation and per-user headroom, and may proceed to embedded pay

#### Scenario: Success shows multiple QRs

- **WHEN** an ACTIVE buyer completes a purchase of 2 tickets and both are paid
- **THEN** `/app/tickets` shows both tickets with QR codes

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

#### Scenario: Officer guest list grouped by purchase

- **WHEN** an officer opens the guest list with multi-ticket purchases
- **THEN** tickets are grouped by purchase/buyer
