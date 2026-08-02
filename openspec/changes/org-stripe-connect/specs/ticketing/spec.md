## ADDED Requirements

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

## MODIFIED Requirements

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
