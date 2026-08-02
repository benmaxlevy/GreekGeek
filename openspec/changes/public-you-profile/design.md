## Context

See `proposal.md` for motivation. The current identity contract is `GET /api/auth/me`, backed by `AuthService.toPublicUser`, and already includes the stored user role, status, organization name, and direct permission keys. The existing `/app/you` route uses that contract plus existing authorization predicates and logout behavior. Owned tickets are available through authenticated ticket queries, while event start time and location live on existing `Event` records.

Global JWT and active-user guards already protect non-public API routes. The `User`, `Membership`, `MemberPermission`, `Ticket`, `TicketAllocation`, and `Event` models contain all data needed for this change. No verification model or database migration is required.

## Goals / Non-Goals

**Goals:**

- Add one authenticated auth-domain endpoint for display-name updates and one authenticated summary endpoint.
- Keep response and request parsing at HTTP boundaries through shared contracts.
- Return summary data limited to the caller's non-void tickets and future events.
- Make `/app/you` a resilient profile surface while retaining existing AppShell navigation and authorization predicates.
- Keep display-name writes independent from token rotation.

**Non-Goals:**

- New profile, verification, privacy, social, photo, password, or attendance data models.
- Anonymous public profiles or lookup by user id.
- Changes to ticket ownership, ticket state transitions, event authorization, organization membership, or permission grants.

## Decisions

### Keep profile endpoints in the auth controller

Add `PATCH /api/auth/me` and `GET /api/auth/me/summary` beside the existing `GET /api/auth/me`. The current-user identity and session boundary already lives there, so this avoids a second profile identity contract or a new module. A separate profile module was considered but would duplicate current-user authorization and DTO plumbing without adding a new persistence boundary.

### Use strict, display-name-only input

Define a shared Zod request schema containing only `name`, trimmed to a non-empty bounded string. Parse it in the controller and parse the returned `PublicUser` response after persistence. A strict object rejects attempts to smuggle email, role, status, membership, permissions, password, verification, or session fields through the update route. The existing `User.name` column remains the display-name source; no alias or migration is introduced.

### Reuse existing relational data for summary

Define a shared summary response schema with `ticketCount`, `upcomingEventCount`, and nullable `nextEvent` containing only `eventId`, `eventName`, `startsAt`, `location`, and caller `ticketCount`. `AuthService.getProfileSummary` queries tickets through the caller's `holderUserId`, excludes `void`, counts distinct future events, and selects the earliest future event. It never returns ticket credentials or another user's data. An auth-owned summary query was chosen over composing multiple browser requests because it gives the profile page one stable boundary and keeps ownership filtering server-side.

### Keep web identity and summary queries separate

The page continues to use the existing `me` query for route guarding and identity, then loads the summary query for ticket context. Display-name save calls the update helper, updates the `me` query with the validated response, and invalidates summary only if needed. Separate queries preserve existing session restore behavior and let identity render even when summary data fails.

### Present stored values, not invented roles

The UI displays the stored `ADMIN`/`USER` role and exact permission keys, or capability wording already supported by existing authorization predicates. It does not infer officer titles from arbitrary permission combinations. Existing Payments, Pending approvals, Admin, and logout controls remain driven by the same predicates and session flow already used by `/app/you`.

### Test boundary and authorization behavior directly

API coverage will exercise active success, strict payload validation, blank and over-limit names, non-active denial, updated me response, summary ownership filtering, void exclusion, future-event ordering, empty summary, and credential omission. Web coverage will exercise profile rendering, edit success/error, read-only identity display, authorization-gated links, logout, and summary failure/empty states. No snapshot-only coverage or verification tests will be added.

## Risks / Trade-offs

- [Summary query adds auth read load] → Use indexed existing ownership/event relations, select only fields needed by the contract, and keep summary query separate from ticket mutation paths.
- [Profile data can become stale after another session edits the name] → Update the current-user query from the server response and retain normal query refetch behavior; no token rotation is needed because JWT contains user id/email, not name.
- [Permission keys are technical labels] → Show exact stored keys or only already-supported capability wording; do not manufacture role taxonomy.
- [Concurrent name edits use last-write-wins semantics] → Keep update atomic and return the saved profile; conflict resolution is outside approved scope.
- [Summary can fail independently of identity] → Render an explicit recoverable summary error and never substitute fabricated counts.

## Migration Plan

1. Ship shared contracts and API endpoints; no database migration or backfill runs.
2. Add focused API tests, then wire web API helpers and replace the minimal profile route.
3. Run contract, API, typecheck, lint, and relevant web tests before release.
4. Roll back the web route first if needed; additive API endpoints can remain deployed or be removed without data migration because display-name updates use the existing `User.name` field.
