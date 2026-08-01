## Why

Phase 3 delivered orgs, memberships, and a permission catalog that already seeds `events.create` / `events.manage`, but no event entity or UI exists yet. Chapters need basic org-scoped event CRUD so officers (and platform ADMIN) can create and manage events before vendor/ticketing work.

## What Changes

- Add `Event` model tied to an `Organization`: name, type (free string), max headcount, optional location (free text), timestamps
- Nest CRUD API with Zod contracts; org-scoped ACL via existing `OrgPermissionGuard` + ADMIN bypass
- Permission gates: `events.create` for create; `events.manage` for update/delete; list for holders of either (own org) or ADMIN (all orgs, filterable)
- Member FE under `/app/events` (glass AppShell); admin FE under `/admin/events` with organization picker
- Hard delete (no dependents yet); org delete with events → 409 (extend organizations rule)
- Progressive commits + Playwright demos of member and admin flows

## Capabilities

### New Capabilities

- `events`: Organization-scoped event entity; create/list/get/update/delete with `events.create` / `events.manage` and ADMIN bypass; shared Zod contracts; member + admin UI

### Modified Capabilities

- `organizations`: Deleting an organization that still has events MUST return 409
- `org-permissions`: Document that seeded `events.create` / `events.manage` now gate the events feature (catalog keys already exist)
- `admin-dashboard`: Admin events list/create/manage with org picker; nav link

## Impact

- **apps/api**: Prisma `Event`, migration, events module, org delete dependent check
- **packages/contracts**: Event Zod schemas
- **apps/web**: `/app/events*`, `/admin/events*`, nav, API client
- **Non-goals**: vendor outreach, ticketing, payments, contracts, event_type_config registry, locations FK table, budget/optimizer, RSVP, soft delete, read-only browse without create/manage
