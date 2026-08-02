## 1. Wizard scaffolding

- [x] 1.1 Add `components/ticketing/setup-wizard/types.ts` with `WizardState`, pool row type, and step enum
- [x] 1.2 Add `TicketSetupWizard.tsx` shell: step indicator, Back/Next navigation, error display
- [x] 1.3 Wire wizard visibility gate in `EventTicketsPanel` (allocations query + host/canManage checks)

## 2. Step 1 — Enable

- [x] 2.1 Implement `EnableStep.tsx`: enable checkbox, capacity input with `event.maxHeadcount` cap, optional sales open/close datetime-local fields
- [x] 2.2 Validate Step 1 before Next (enabled + positive capacity within max)

## 3. Step 2 — Allocate

- [x] 3.1 Implement `AllocateStep.tsx`: org multi-select from `listOrganizations`, optional public pool toggle
- [x] 3.2 Add per-pool quantity inputs and even-split action (floor + remainder distribution)
- [x] 3.3 Show live sum, capacity, remainder; disable Next when sum > capacity or no pools selected

## 4. Step 3 — Price

- [x] 4.1 Implement `PriceStep.tsx`: list pools from Step 2 with USD price inputs (blank = free)
- [x] 4.2 Show `StripeConnectBanner` when any entered price > 0 and host org not charge-ready

## 5. Step 4 — Verify and finalize

- [x] 5.1 Implement `VerifyStep.tsx`: read-only summary (capacity, window, pools, prices, sum vs capacity)
- [x] 5.2 Add Save as draft and Enable sales actions calling `patchEventTicketing` then sequential `createAllocation` per pool
- [x] 5.3 On success: invalidate ticketing queries, dismiss wizard, set parent tab to Ticket pools (`allocations`)

## 6. Management UI integration

- [x] 6.1 Ensure Settings and Ticket pools tabs remain available after wizard completion for post-setup edits
- [x] 6.2 Confirm invited and scan-only modes never render the wizard

## 7. Manual verification

- [ ] 7.1 Walkthrough: new event → wizard → Save as draft → pools visible on Ticket pools tab
- [ ] 7.2 Walkthrough: wizard → Enable sales with free pools → sale status on_sale
- [ ] 7.3 Walkthrough: event with existing pools → wizard skipped, tabs only
- [ ] 7.4 Verify sum > capacity blocks Step 2 Next; sum ≤ capacity with remainder allowed
