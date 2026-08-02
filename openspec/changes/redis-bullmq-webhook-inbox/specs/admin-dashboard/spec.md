## ADDED Requirements

### Requirement: Admin manages webhook events inbox from dashboard

The admin dashboard MUST provide a webhook events view at `/admin/webhook-events` for ACTIVE platform ADMIN users. The UI MUST list webhook events with service, type, externalId, receivedAt, processedAt, attempts, and truncated lastError. The UI MUST support filtering by unprocessed, failed, and all. For failed events, ADMIN MUST be able to trigger re-enqueue from the UI. The admin nav MUST include a link to webhook events when the user is ACTIVE platform ADMIN. Styling MUST match existing obsidian-glass admin pages. Non-admin users MUST be blocked from the route.

#### Scenario: Admin opens webhook events inbox

- **WHEN** an ACTIVE platform ADMIN navigates to `/admin/webhook-events`
- **THEN** webhook events are listed with filter controls for unprocessed, failed, and all

#### Scenario: Admin re-enqueues failed event from UI

- **WHEN** an ACTIVE platform ADMIN clicks re-enqueue on a failed webhook event row
- **THEN** the UI calls the re-enqueue API and refreshes the list to reflect updated state

#### Scenario: Non-admin blocked from webhook events route

- **WHEN** a non-ADMIN user navigates to `/admin/webhook-events`
- **THEN** the app redirects away without exposing webhook admin controls
