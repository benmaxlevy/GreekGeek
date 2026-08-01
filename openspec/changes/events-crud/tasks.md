## 1. Data model

- [ ] 1.1 Add Prisma `Event` model (organizationId, name, type, maxHeadcount, location?, timestamps) + Organization relation
- [ ] 1.2 Generate and apply migration; extend org delete to 409 when events exist
- [ ] 1.3 Commit: `add event prisma model and migration`

## 2. Contracts + API

- [ ] 2.1 Add `@rally/contracts` Event Zod schemas (create/update/list query/response)
- [ ] 2.2 Nest events module: create (`events.create`), list/get (create|manage|ADMIN), update/delete (`events.manage`), ADMIN bypass
- [ ] 2.3 Wire module into AppModule; parse responses with Zod
- [ ] 2.4 Commit: `add events api and contracts`

## 3. Tests

- [ ] 3.1 Integration tests: create/manage gates, org isolation, ADMIN cross-org, org delete 409 with events
- [ ] 3.2 Commit: `add events api integration tests`

## 4. Frontend

- [ ] 4.1 Member `/app/events` list/create/edit/delete; gate on create|manage via `/me`
- [ ] 4.2 Admin `/admin/events` with org picker/filter; nav link
- [ ] 4.3 Events API client + AppShell nav when permitted
- [ ] 4.4 Commit: `add member and admin events ui`

## 5. Verification + demos

- [ ] 5.1 E2e or smoke for member create + admin create-with-org
- [ ] 5.2 Mark tasks complete; Playwright demos (member + admin flows)
- [ ] 5.3 Commit task ticks if needed
