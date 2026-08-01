## MODIFIED Requirements

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

## ADDED Requirements

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
