# ticketing Specification

## Purpose

Org-scoped event ticketing on existing `Event` records: inline config, per-org and public allocations, ticket issue/void/mark-paid, guest self-claim, and guest list — without payment processors or scan/check-in.

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

The system MUST persist tickets with: required `allocationId`, required `status` enum `unpaid` | `paid` | `void`, required unique opaque `credentialToken`, optional `holderUserId` foreign key to User, and timestamps (`paidAt`, `voidedAt` as applicable). Issuing a ticket MUST increment the non-void issued count for that allocation and MUST NOT exceed allocation quantity. Voiding a ticket MUST set status to `void`, record `voidedAt`, and free the allocation slot for re-issue. Marking paid MUST transition `unpaid` → `paid` and set `paidAt`. Concurrent issue MUST NOT oversell: interactive transaction with row lock on the allocation (`SELECT FOR UPDATE` or equivalent). Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Issue ticket within allocation

- **WHEN** an authorized actor issues a ticket against an active allocation with remaining capacity
- **THEN** an unpaid ticket is created with a unique credentialToken and optional holderUserId

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

The guest list for an event MUST include only tickets with status `paid`. Each entry MUST show holder identity (when holderUserId is set), allocation organization label (organization name for org allocations, or "Public" for null organizationId), and ticket status. Unpaid tickets MUST NOT appear on the guest list.

#### Scenario: Paid ticket appears on guest list

- **WHEN** an authorized actor requests the guest list for an event with paid tickets
- **THEN** only paid tickets are returned with allocation org label or "Public"

#### Scenario: Unpaid ticket excluded from guest list

- **WHEN** an event has unpaid and paid tickets
- **THEN** the guest list includes only paid tickets

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

### Requirement: Member ticket UI is permission-gated

The web app MUST provide ticket management for hosted events at `/app/events/$eventId/tickets` (sub-routes as needed) for ACTIVE users with `tickets.manage` on the host org: config, allocations (select orgs, all orgs, public toggle), issue/list/void/mark-paid, guest list. Invited-org members with `tickets.manage` MUST see issue/list/void/mark-paid only for their org's allocation. Users without `tickets.manage` MUST NOT see officer ticket controls; redirect or 403 without UI leak. ACTIVE users MUST have a minimal surface at `/app/tickets` (or equivalent) to view own tickets and claim from on_sale public events. Guest list UI MUST show allocation org label and status.

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
- **THEN** they see their held tickets and may claim from eligible on_sale public events

### Requirement: Ticketing API routes are authenticated with server-side org checks

All ticket-related API routes MUST require authentication. Org and allocation authorization MUST be enforced server-side (not UI-only). Admin ticket routes MUST require platform ADMIN. Shared Zod schemas in `packages/contracts` MUST validate request bodies, query params, and parsed responses at HTTP boundaries.

#### Scenario: Unauthenticated ticket request rejected

- **WHEN** an unauthenticated client calls a ticket endpoint
- **THEN** the system returns 401 Unauthorized

#### Scenario: Admin bypasses org ticket checks

- **WHEN** platform ADMIN performs any ticket operation on any event
- **THEN** the operation succeeds if business rules pass
