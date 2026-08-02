## Why

Host ticket setup today splits across Settings and Ticket pools tabs—enable capacity and sale status in one place, create pools one-at-a-time in another. That tab hopping slows first-time setup and makes it easy to misconfigure capacity vs pool totals. A linear wizard keeps initial setup in one flow while leaving day-two ops on the existing tabs.

## What Changes

- Add a **4-step setup wizard** (Enable → Allocate → Price → Verify) shown when a host opens ticketing for an event that has **not** yet been configured (no pools and not already enabled with allocations).
- **Step 1 — Enable:** Toggle ticketing on; set total ticket capacity capped by `event.maxHeadcount`; optional sales open/close datetime window.
- **Step 2 — Allocate:** Multi-select participating orgs plus optional public pool; set quantity per pool; helpers for even-split across selected orgs and independent per-org edits; live allocated sum vs capacity with remainder; block advancing when sum exceeds capacity (sum ≤ capacity allowed).
- **Step 3 — Price:** Set USD price per pool at create time (blank = free). No post-create price edit (existing limitation unchanged).
- **Step 4 — Verify:** Read-only summary; user chooses **Save as draft** (`ticketSaleStatus: draft`) or **Enable sales** (`on_sale`); persist via existing `patchEventTicketing` then `createAllocation` per pool.
- After successful setup, land on existing ops tabs (Ticket pools / Tickets / Guests / Scanner). Settings and Ticket pools tabs remain for events already configured or for post-setup edits.
- **Skip wizard** when event already has ticketing configured: allocations exist, or ticketing is enabled with existing allocation state—show management UI only.
- **UI-only:** No API, contract, or Prisma changes.

## Capabilities

### New Capabilities

- `host-ticket-setup-wizard`: Linear host-facing wizard for first-time event ticket configuration, wizard visibility rules, allocation validation, and finalize actions using existing ticketing APIs.

### Modified Capabilities

<!-- No existing openspec/specs capabilities; behavior change is new host setup UX only. -->

## Impact

- **Frontend:** `rally/apps/web/src/components/ticketing/EventTicketsPanel.tsx` and new wizard subcomponents under `components/ticketing/` (or `components/ticketing/setup-wizard/`).
- **APIs used (unchanged):** `patchEventTicketing`, `createAllocation`, `listAllocations`, `listOrganizations` via `ticketing-api.ts` and `admin-api.ts`.
- **Out of scope:** Backend changes, price edit after create, member purchase UI, scanner/guest redesign, ticketing on event-create form, invited/scan-only modes.
