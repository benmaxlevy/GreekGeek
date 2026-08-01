## ADDED Requirements

### Requirement: Admin manages events from dashboard

The admin dashboard MUST provide an events view at `/admin/events` where platform ADMIN can list events (optional organization filter), create events with an organization picker, edit, and delete. The admin nav MUST include an Events link. Styling MUST match existing obsidian-glass admin pages.

#### Scenario: Admin opens events page

- **WHEN** an ACTIVE platform ADMIN navigates to `/admin/events`
- **THEN** the events management UI loads with list and create controls including organization selection

#### Scenario: Admin creates event for chosen organization

- **WHEN** a platform ADMIN submits a valid event form with an organization selected
- **THEN** the event appears in the admin events list for that organization
