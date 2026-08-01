# events Specification

## Purpose

Organization-scoped event records that members with `events.create` / `events.manage` (and platform ADMIN) can create and manage — name, type, max headcount, optional location, and optional inline ticketing config. Vendor outreach remains out of scope for this capability.

## Requirements

### Requirement: Event records belong to an organization

The system MUST persist events with a string id, required `organizationId` foreign key, required `name` (non-empty string), required `type` (non-empty free-form string — not an enum registry), required `maxHeadcount` (positive integer), optional `location` (nullable string), optional inline ticketing fields (`ticketingEnabled` boolean default false, `ticketCapacity` nullable integer, `ticketSaleStatus` nullable enum `draft` | `on_sale` | `closed`, `ticketSalesOpenAt` nullable datetime, `ticketSalesCloseAt` nullable datetime), and timestamps. Events MUST NOT require vendor, budget, or location-FK fields. Ticketing config MUST live inline on Event — not a separate config table. When `ticketingEnabled` is true, `ticketCapacity` MUST be required and MUST be ≤ `maxHeadcount`.

#### Scenario: Event requires organization and core fields

- **WHEN** a client creates an event with organizationId, name, type, and maxHeadcount
- **THEN** the event is persisted and returned with those fields and timestamps

#### Scenario: Location is optional

- **WHEN** a client creates an event without a location
- **THEN** the event is persisted with a null or omitted location

#### Scenario: Invalid maxHeadcount rejected

- **WHEN** a client submits maxHeadcount less than 1
- **THEN** the system returns a client validation error

#### Scenario: Ticketing disabled by default

- **WHEN** a client creates an event without ticketing fields
- **THEN** ticketingEnabled is false and ticket sale fields are null or default

#### Scenario: Enabled ticketing requires capacity within maxHeadcount

- **WHEN** an authorized actor enables ticketing with ticketCapacity greater than maxHeadcount
- **THEN** the system returns a client validation error

### Requirement: Create requires events.create or ADMIN

Creating an event MUST require platform ADMIN, or an ACTIVE member who holds `events.create` for the target organization. Non-admin members MUST create only for their membership organization. ADMIN MUST supply `organizationId` on create. Request and response shapes MUST be validated with shared Zod schemas.

#### Scenario: Member with events.create creates for own org

- **WHEN** an ACTIVE member with `events.create` creates an event for their organization
- **THEN** the event is persisted under that organization

#### Scenario: Member cannot create for another org

- **WHEN** a member attempts to create an event for an organization other than their membership
- **THEN** the system returns 403 Forbidden

#### Scenario: Member without events.create cannot create

- **WHEN** a member without `events.create` attempts to create an event
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin creates event for any organization

- **WHEN** a platform ADMIN creates an event with a valid organizationId
- **THEN** the event is persisted under that organization

### Requirement: Manage requires events.manage or ADMIN

Updating or deleting an event MUST require platform ADMIN, or an ACTIVE member who holds `events.manage` for the event's organization. Hard delete MUST be used (no soft-delete). Members without `events.manage` MUST receive 403 on update/delete even if they hold `events.create`.

#### Scenario: Member with events.manage updates event

- **WHEN** an ACTIVE member with `events.manage` updates an event in their organization
- **THEN** the event fields are updated and returned

#### Scenario: Member with only events.create cannot update or delete

- **WHEN** a member who holds `events.create` but not `events.manage` attempts to update or delete an event
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin deletes any event

- **WHEN** a platform ADMIN deletes an event
- **THEN** the event is removed and subsequent get returns not found

### Requirement: List and get are scoped by permission

Listing events MUST return: for platform ADMIN, all events (optional filter by organizationId); for members, only events in their organization if they hold `events.create` or `events.manage`; otherwise 403. Getting a single event MUST follow the same org/permission rules (ADMIN any; member own-org with create or manage).

#### Scenario: Admin lists events filtered by organization

- **WHEN** a platform ADMIN lists events with an organizationId filter
- **THEN** only events for that organization are returned

#### Scenario: Member lists own-org events with create or manage

- **WHEN** an ACTIVE member with `events.create` or `events.manage` lists events
- **THEN** only events for their organization are returned

#### Scenario: Member without event permissions cannot list

- **WHEN** a member without `events.create` and without `events.manage` lists events
- **THEN** the system returns 403 Forbidden

### Requirement: Member and admin event UI

The web app MUST provide member event management under `/app/events` for ACTIVE users who hold `events.create` or `events.manage`, using obsidian-glass AppShell patterns. Platform ADMIN MUST manage events under `/admin/events` with an organization picker on create and list filter. UI MUST support create, list, edit, and delete for authorized actors. Nav MUST link to these surfaces when the user is allowed.

#### Scenario: Permitted member opens events page

- **WHEN** an ACTIVE member with `events.create` or `events.manage` navigates to `/app/events`
- **THEN** the events list/create UI loads inside AppShell

#### Scenario: Member without event permissions redirected from /app/events

- **WHEN** a member without `events.create` and without `events.manage` navigates to `/app/events`
- **THEN** the app redirects away without exposing event management controls

#### Scenario: Admin manages events with org picker

- **WHEN** a platform ADMIN opens `/admin/events`
- **THEN** they can list events (optionally by org) and create an event specifying organizationId

### Requirement: Ticketing config is managed on the host event

Enabling or updating inline ticketing fields MUST require platform ADMIN, or an ACTIVE member with `tickets.manage` for the event's host organization. The system MUST NOT transition `ticketSaleStatus` to `on_sale` unless at least one allocation exists for the event. Request shapes MUST be validated with shared Zod schemas at the API boundary.

#### Scenario: Host enables ticketing with valid capacity

- **WHEN** a member with `tickets.manage` for the host org enables ticketing with ticketCapacity ≤ maxHeadcount
- **THEN** ticketingEnabled becomes true and capacity is persisted

#### Scenario: On sale without allocations rejected

- **WHEN** an authorized actor sets ticketSaleStatus to on_sale with zero allocations
- **THEN** the system returns a client error

#### Scenario: Invited-org member cannot update ticketing config

- **WHEN** a member with `tickets.manage` for a non-host org attempts to update ticketing config
- **THEN** the system returns 403 Forbidden
