## Purpose

Guides hosts through first-time event ticket configuration in a single linear flow instead of hopping between Settings and Ticket pools tabs.

## ADDED Requirements

### Requirement: Wizard visibility for unconfigured events

The host ticketing UI SHALL show the setup wizard when the host can manage ticketing and the event has not yet been configured. An event is **not configured** when there are zero ticket allocations and ticketing is not already enabled with meaningful setup (no pools exist). The UI SHALL show the existing tabbed management UI (Ticket pools, Tickets, Guests, Scanner, and Settings where applicable) when at least one allocation exists or when ticketing was previously enabled with allocations.

#### Scenario: First-time host opens ticketing

- **WHEN** a host with manage permission opens event ticketing and `listAllocations` returns an empty list and ticketing is not enabled with existing pools
- **THEN** the setup wizard is displayed instead of the Settings and Ticket pools tabs for initial setup

#### Scenario: Returning host with existing pools

- **WHEN** a host opens event ticketing and at least one ticket allocation exists
- **THEN** the setup wizard is not shown and the existing management tabs are shown

#### Scenario: Wizard completes and management UI appears

- **WHEN** the host successfully completes the wizard finalize action
- **THEN** the wizard is dismissed and the host lands on the Ticket pools tab (or equivalent default ops tab) with pools visible

### Requirement: Step 1 — Enable ticketing and capacity

The wizard Step 1 SHALL allow the host to enable ticketing, set total ticket capacity as a positive integer capped by `event.maxHeadcount` when present, and optionally set sales open and sales close datetimes. Step 1 SHALL require ticketing enabled and a valid capacity before the host can advance.

#### Scenario: Capacity capped by event max headcount

- **WHEN** the event has `maxHeadcount` set and the host enters a capacity greater than that value
- **THEN** the UI prevents advancing until capacity is within the allowed maximum

#### Scenario: Optional sales window on enable step

- **WHEN** the host leaves sales open and close fields empty on Step 1
- **THEN** the wizard allows advancing and finalize will send null open/close times to `patchEventTicketing`

### Requirement: Step 2 — Allocate pools across orgs and public

Step 2 SHALL let the host select one or more organizations from the org directory and optionally include a public pool (`organizationId: null`). For each selected org and for public when enabled, the host SHALL set a positive integer quantity. The UI SHALL offer an even-split helper that distributes capacity evenly across currently selected orgs (and public if selected), rounding as needed while respecting total capacity. The host SHALL be able to edit each pool quantity independently after using even-split.

#### Scenario: Even-split across selected orgs

- **WHEN** the host selects multiple organizations and activates even-split with a defined total capacity on Step 1
- **THEN** each selected org receives an equal share of capacity (integer quantities) and the UI shows the per-pool breakdown for manual adjustment

#### Scenario: Public pool optional

- **WHEN** the host enables a public pool on Step 2
- **THEN** a public allocation row appears with its own quantity field and is included in allocation totals and finalize `createAllocation` calls with `organizationId: null`

#### Scenario: Live sum and remainder

- **WHEN** the host edits pool quantities on Step 2
- **THEN** the UI displays allocated sum, total capacity, and remainder (capacity minus sum)

#### Scenario: Block advance when sum exceeds capacity

- **WHEN** the sum of pool quantities is greater than total ticket capacity
- **THEN** the Next control on Step 2 is disabled or blocked and the host cannot advance until sum is less than or equal to capacity

#### Scenario: Allow advance when sum is under capacity

- **WHEN** the sum of pool quantities is less than or equal to total ticket capacity and at least one pool is configured with positive quantity
- **THEN** the host can advance to Step 3

### Requirement: Step 3 — Price per pool at creation

Step 3 SHALL display each pool from Step 2 and allow setting a USD price per pool. A blank price SHALL mean free (no `priceCents` or zero). Prices SHALL be captured only at pool creation; the wizard SHALL not offer post-create price editing (existing product limitation).

#### Scenario: Free pool when price blank

- **WHEN** the host leaves a pool price field empty on Step 3
- **THEN** finalize creates that pool without a paid price (free allocation)

#### Scenario: Paid pool price in cents

- **WHEN** the host enters a USD price for a pool on Step 3
- **THEN** finalize sends `priceCents` as the rounded cent value on the corresponding `createAllocation` request

### Requirement: Step 4 — Verify and finalize

Step 4 SHALL show a read-only summary of enable settings, each pool (org or public label, quantity, price), allocated sum vs capacity, and the chosen sale outcome. The host SHALL choose exactly one finalize action: **Save as draft** (`ticketSaleStatus: draft`) or **Enable sales** (`ticketSaleStatus: on_sale`). On submit, the UI SHALL call `patchEventTicketing` with ticketing enabled, capacity, sale status, and optional sales window, then call `createAllocation` once per configured pool in sequence or parallel using existing API shapes.

#### Scenario: Save as draft

- **WHEN** the host chooses Save as draft on Step 4 and submits
- **THEN** `patchEventTicketing` is called with `ticketSaleStatus: draft` and each pool is created via `createAllocation` with the configured org, quantity, and price

#### Scenario: Enable sales

- **WHEN** the host chooses Enable sales on Step 4 and submits
- **THEN** `patchEventTicketing` is called with `ticketSaleStatus: on_sale` and each pool is created via `createAllocation`

#### Scenario: Finalize failure surfaces error

- **WHEN** `patchEventTicketing` or any `createAllocation` call fails
- **THEN** the wizard shows the error message and does not dismiss until the host retries or cancels; partial success behavior follows existing mutation error handling

### Requirement: Stripe Connect awareness preserved

When any pool has a paid price or the host chooses Enable sales with paid pools, the wizard SHALL show the existing Stripe Connect banner behavior consistent with `EventTicketsPanel` (host org charges not enabled) without changing API contracts.

#### Scenario: Paid pool with Connect not ready

- **WHEN** the host sets a positive price on Step 3 and the host organization is not Stripe charge-ready
- **THEN** the wizard displays the Stripe Connect banner on relevant steps, matching current Settings/Ticket pools UX

### Requirement: Invited and scan-only modes unchanged

The setup wizard SHALL not appear for invited or scan-only ticket page modes; those flows remain unchanged.

#### Scenario: Invited mode

- **WHEN** `EventTicketsPanel` is rendered with `mode: invited`
- **THEN** the setup wizard is not shown regardless of allocation state
