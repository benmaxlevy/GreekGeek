## 1. Data model

- [x] 1.1 Add Prisma `Event` model (organizationId, name, type, maxHeadcount, location?, timestamps) + Organization relation
- [x] 1.2 Generate and apply migration; extend org delete to 409 when events exist
- [x] 1.3 Commit: `add event prisma model and migration`

## 2. Contracts + API

- [x] 2.1 Add `@greekgeek/contracts` Event Zod schemas (create/update/list query/response)
- [x] 2.2 Nest events module: create (`events.create`), list/get (create|manage|ADMIN), update/delete (`events.manage`), ADMIN bypass
- [x] 2.3 Wire module into AppModule; parse responses with Zod
- [x] 2.4 Commit: `add events api and contracts`

## 3. Tests

- [x] 3.1 Integration tests: create/manage gates, org isolation, ADMIN cross-org, org delete 409 with events
- [x] 3.2 Commit: `add events api integration tests`

## 4. Frontend

- [x] 4.1 Member `/app/events` list/create/edit/delete; gate on create|manage via `/me`
- [x] 4.2 Admin `/admin/events` with org picker/filter; nav link
- [x] 4.3 Events API client + AppShell nav when permitted
- [x] 4.4 Commit: `add member and admin events ui`

## 5. Verification + demos

- [x] 5.1 E2e or smoke for member create + admin create-with-org
- [x] 5.2 Mark tasks complete; Playwright demos (member + admin flows) — `demo-videos/admin-events-1785598358651.webm`, `member-events-1785598406744.webm`, `member-events-forbidden-1785598422378.webm`
- [x] 5.3 Commit task ticks if needed
