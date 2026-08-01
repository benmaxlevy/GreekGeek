## ADDED Requirements

### Requirement: Admin manages event ticketing from dashboard

The admin dashboard MUST provide a ticketed-events view listing events with ticketing enabled (optional organization filter). Platform ADMIN MUST manage per-event ticketing at `/admin/events/$eventId/tickets`: edit inline ticketing config, set allocations (including public pool), issue/list/void/mark-paid tickets, force sale status closed, and adjust capacity subject to validation rules. The admin nav MUST include a link to ticketed events or ticket management when the user is ACTIVE platform ADMIN. Styling MUST match existing obsidian-glass admin pages. Non-admin users MUST be blocked from admin ticket routes.

#### Scenario: Admin opens ticketed events list

- **WHEN** an ACTIVE platform ADMIN navigates to the ticketed-events admin view
- **THEN** events with ticketing enabled are listed with optional org filter

#### Scenario: Admin manages event tickets

- **WHEN** an ACTIVE platform ADMIN opens `/admin/events/$eventId/tickets`
- **THEN** they can edit ticketing config, allocations, issue/void/mark-paid, and view guest list

#### Scenario: Admin force-closes ticket sales

- **WHEN** an ACTIVE platform ADMIN sets ticketSaleStatus to closed for an event
- **THEN** the sale status updates and new claims/issues respect closed state per API rules

#### Scenario: Non-admin blocked from admin ticket routes

- **WHEN** a non-ADMIN user navigates to `/admin/events/$eventId/tickets`
- **THEN** the app redirects away without exposing admin ticket controls
