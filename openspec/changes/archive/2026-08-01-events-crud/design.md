## Context

Phase 3 shipped universities, organizations, 1:1 memberships, permission catalog (`events.create` / `events.manage` already seeded), `OrgPermissionGuard` with ADMIN bypass, and glass admin/app shells. `/me` now returns `membership` + `permissions[]`. See proposal.md for motivation. No Event model exists yet.

## Goals / Non-Goals

**Goals:**
- Lean Event entity + Nest CRUD + contracts
- Reuse OrgPermissionGuard patterns; ADMIN bypass
- Member UI `/app/events`; admin UI `/admin/events`
- Org delete 409 when events remain

**Non-Goals:**
- Vendor/ticketing/payments/contracts
- event_type_config registry or locations table
- Soft delete, RSVP, headcount lock
- Member UI for users lacking create/manage

## Decisions

### 1. Permission split
- `events.create` → POST only
- `events.manage` → PATCH/DELETE
- List/GET → ADMIN, or member with create **or** manage in that org
- Rationale: matches seeded keys; create-only chairs vs full managers
- Alt: single `events.manage` for all — rejected (catalog already split)

### 2. Location as free text
- Optional `String?` on Event — not FK
- Alt: locations table like oldGreekGeek — deferred

### 3. Type as free string
- No enum / registry this phase
- Alt: seed event_type_config — deferred

### 4. API shape
- `GET/POST /api/events` (list query `organizationId?`; create body includes `organizationId`)
- `GET/PATCH/DELETE /api/events/:id`
- Member create: body `organizationId` must match membership (guard/service enforce)
- ADMIN: any org
- For update/delete: resolve event → org → check `events.manage` (extend guard or service-level check after load)

### 5. Guard strategy
- Create: `@RequireOrgPermission('events.create', { organizationIdParam from body })`
- Update/delete: load event, then check ADMIN or membership+`events.manage` in service (or custom decorator resolving org from event id) — prefer service helper `assertCanManageEvent` to avoid new guard complexity
- List: service filters by role/perms

### 6. FE
- Glass forms mirroring oldGreekGeek field set (name, type, headcount, optional location) — not oldGreekGeek visual system
- Gate `/app/events` via `/me.permissions`
- Admin page mirrors `admin.organizations` list+form pattern

### 7. Delete
- Hard delete; org.remove checks `event` count → 409 like memberships

## Risks / Trade-offs

- [Free-form type sprawl] → Accept for v1; registry later
- [create without manage leaves orphans editable only by ADMIN] → Documented; officers grant both when needed
- [List with only create shows events they cannot edit] → OK; UI hides edit/delete without manage

## Migration Plan

1. Prisma migrate Event
2. Deploy API + contracts
3. Deploy FE routes
4. Rollback: drop Event table / revert migration (no production data assumed)

## Open Questions

None — defaults locked from explore plan.
