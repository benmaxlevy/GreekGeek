## Context

`EventTicketsPanel` (`apps/web/src/components/ticketing/EventTicketsPanel.tsx`) is the host ticketing surface: tabs Settings (`config`), Ticket pools (`allocations`), Tickets, Guests, Scanner. Initial setup splits enable/capacity/sale status (Settings) from one-at-a-time pool creation (Ticket pools). APIs are stable: `patchEventTicketing` and `createAllocation` in `ticketing-api.ts`; org list via `listOrganizations`. Contracts: `PatchEventTicketing`, `CreateTicketAllocation` in `@greekgeek/contracts/ticketing`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Single linear wizard for **first-time** host ticket setup (4 steps).
- Reuse existing mutations and validation helpers (`toLocalDatetime`, `fromLocalDatetime`, Stripe banners).
- Clear wizard vs management routing based on allocation query + event ticketing flags.
- Local wizard state until Step 4 finalize (no new APIs).

**Non-Goals:**

- Backend or contract changes; post-create price edit; member purchase UI; scanner/guest redesign; event-create ticketing; changing invited/scan-only modes.

## Decisions

### 1. Wizard shell location: sibling components under `ticketing/`

**Choice:** New folder `components/ticketing/setup-wizard/` with `TicketSetupWizard.tsx` (shell + step routing) and step components (`EnableStep`, `AllocateStep`, `PriceStep`, `VerifyStep`). `EventTicketsPanel` gates wizard vs tabs.

**Alternatives:** Keep all logic inside `EventTicketsPanel` — rejected; file already ~800 lines.

**Rationale:** Isolated state machine, easier testing and step iteration.

### 2. “Not configured” detection

**Choice:** Show wizard when `canManage && isHost && allocations.length === 0` after allocations query settles. If `event.ticketingEnabled` is true but pools empty (edge), still show wizard to complete pool setup.

**Alternatives:** Also require `!ticketingEnabled` — rejected; enabled-with-no-pools still needs setup.

**Rationale:** Matches product rule “pools exist OR already enabled with allocations → management UI.”

### 3. Wizard state: React `useState` in wizard root

**Choice:** One `WizardState` object (enabled, capacity, sales window, pools array `{ orgId | 'public', orgName, quantity, priceUsd }`, step index). No URL query params for step.

**Alternatives:** Zustand/context — unnecessary for single-panel scope.

### 4. Allocate step: per-org rows, not `allOrgs: true`

**Choice:** Step 2 builds explicit per-org selections; finalize calls `createAllocation` once per row (`organizationId` or `null` for public).

**Alternatives:** Single `createAllocation({ allOrgs: true, quantity })` — rejected; wizard needs per-org quantities and per-pool prices on Step 3.

**Rationale:** Aligns with multi-quantity UI; existing API supports individual creates.

### 5. Even-split algorithm

**Choice:** `base = Math.floor(capacity / n)`, remainder `capacity % n` distributed one ticket at a time to first pools in stable sort order (org name). Host can edit after split.

**Alternatives:** Round up last pool — rejected; can exceed capacity silently.

### 6. Finalize sequence

**Choice:** `await patchEventTicketing(...)` then `for (pool of pools) await createAllocation(...)`. On allocation failure after patch, show error; host may retry creates (pools may partially exist — same as today if user double-submits).

**Alternatives:** Parallel `createAllocation` — acceptable optimization in implementation if error handling per pool is clear.

### 7. Post-wizard landing tab

**Choice:** Set parent tab to `allocations` (Ticket pools) on success.

**Alternatives:** Tickets tab — pools tab better confirms setup result.

### 8. Settings tab after wizard

**Choice:** Keep Settings tab in management UI for post-setup edits (sale status, capacity, sales window). Wizard replaces Settings **only** during initial unconfigured flow.

## Risks / Trade-offs

- **[Partial finalize]** Patch succeeds, one `createAllocation` fails → event enabled but incomplete pools. **Mitigation:** Show error with which step failed; invalidate queries; host uses Ticket pools tab to add missing pools or retry.
- **[Capacity vs sum]** Sum &lt; capacity leaves unallocated tickets. **Mitigation:** Verify step shows remainder explicitly; product accepts (same as manual tab flow).
- **[Stripe on_sale]** Enable sales with paid pools may fail server-side if Connect not ready. **Mitigation:** Reuse `StripeConnectBanner` and existing API errors on submit.
- **[Large org lists]** Many orgs on Step 2. **Mitigation:** Scrollable list + search if org count high (optional polish in tasks).

## Migration Plan

Frontend-only deploy. No data migration. Rollback: revert FE bundle; wizard hidden, Settings + Ticket pools restored.

## Open Questions

None — product decisions locked in proposal.
