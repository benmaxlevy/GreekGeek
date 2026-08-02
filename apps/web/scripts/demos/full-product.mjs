/**
 * Full product walkthrough — one continuous .webm covering all current flows.
 * Pace: DEMO_SLOW_MO (default 900) + long settled pauses.
 *
 * Run: DEMO_SLOW_MO=900 node scripts/demos/full-product.mjs
 */
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  DEMO_PASSWORD,
  ORG_LABEL,
  UNI_NAME,
  adminToken,
  apiJson,
  apiSignup,
  createOrgViaAdmin,
  finalizeVideo,
  findUserRow,
  grantPermissionsByEmail,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  loginToken,
  logout,
  pause,
  seedOrgId,
  setupActiveMember,
  setupOfficerAndApplicant,
  setupOnSalePublicEvent,
  showFlowTitle,
  signupCascade,
  signupWithoutOrg,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const out = `full-product-${stamp}.webm`;

const pendingEmail = `demo+full-pend-${stamp}@rally.local`;
const pendingName = `Full Pending ${stamp}`;
const approveEmail = `demo+full-appr-${stamp}@rally.local`;
const approveName = `Full Approve ${stamp}`;
const denyEmail = `demo+full-deny-${stamp}@rally.local`;
const denyName = `Full Deny ${stamp}`;
const reactivateEmail = `demo+full-reac-${stamp}@rally.local`;
const reactivateName = `Full Reactivate ${stamp}`;
const permsEmail = `demo+full-perm-${stamp}@rally.local`;
const permsName = `Full Perms ${stamp}`;
const uniName = `Full Demo Uni ${stamp}`;
const orgName = `Full Beta Org ${stamp}`;
const orgMemberEmail = `demo+full-orgm-${stamp}@rally.local`;
const adminEventName = `Full Admin Formal ${stamp}`;
const adminEventUpdated = `${adminEventName} Updated`;
const officerEmail = `demo+full-off-${stamp}@rally.local`;
const officerName = `Full Officer ${stamp}`;
const offApplEmail = `demo+full-offa-${stamp}@rally.local`;
const offApplName = `Full Off Applicant ${stamp}`;
const offDenyEmail = `demo+full-offd-${stamp}@rally.local`;
const offDenyName = `Full Off Denied ${stamp}`;
const offDenyOfficerEmail = `demo+full-offdo-${stamp}@rally.local`;
const offDenyOfficerName = `Full Off Denier ${stamp}`;
const noPermEmail = `demo+full-nop-${stamp}@rally.local`;
const noPermName = `Full No Perm ${stamp}`;
const eventsEmail = `demo+full-evt-${stamp}@rally.local`;
const eventsName = `Full Events Member ${stamp}`;
const memberEventName = `Full Member Party ${stamp}`;
const memberEventUpdated = `${memberEventName} Updated`;
const noEvtEmail = `demo+full-noevt-${stamp}@rally.local`;
const noEvtName = `Full No Events ${stamp}`;

// Section 14 — optional org signup
const optOrglessEmail = `demo+full-optless-${stamp}@rally.local`;
const optOrglessName = `Full Orgless ${stamp}`;
const optPendingEmail = `demo+full-optpend-${stamp}@rally.local`;
const optPendingName = `Full Opt Pending ${stamp}`;

// Section 15 — ticketing host
const ticketHostEmail = `demo+full-thost-${stamp}@rally.local`;
const ticketHostName = `Full Ticket Host ${stamp}`;
const ticketOrgBName = `Full Org B ${stamp}`;
const ticketEventName = `Full Ticketing Formal ${stamp}`;

// Section 16 — guest claim
const ticketFixtureHostEmail = `demo+full-tfix-${stamp}@rally.local`;
const ticketGuestEmail = `demo+full-tguest-${stamp}@rally.local`;
const ticketGuestName = `Full Ticket Guest ${stamp}`;
const publicEventName = `Full Public Gala ${stamp}`;

// Section 17 — org member buy
const orgBuyHostEmail = `demo+full-obuy-h-${stamp}@rally.local`;
const orgBuyBuyerEmail = `demo+full-obuy-m-${stamp}@rally.local`;
const orgBuyHostName = `Full Org Buy Host ${stamp}`;
const orgBuyBuyerName = `Full Org Buyer ${stamp}`;
const orgBuyEventName = `Full Org Gala ${stamp}`;

// Section 18 — QR check-in
const qrHostManagerEmail = `demo+full-qr-mgr-${stamp}@rally.local`;
const qrHostScannerEmail = `demo+full-qr-scan-${stamp}@rally.local`;
const qrHostManagerName = `Full QR Manager ${stamp}`;
const qrHostScannerName = `Full QR Scanner ${stamp}`;
const qrEventName = `Full QR Formal ${stamp}`;

async function flowTitle(page, label) {
  console.log(`▶ ${label}`);
  await showFlowTitle(page, label);
  await pause(page, 1500);
}

async function issuePaidTickets(hostToken, eventId, allocationId, count) {
  const credentials = [];
  for (let i = 0; i < count; i += 1) {
    const issued = await apiJson(
      `/api/events/${eventId}/allocations/${allocationId}/tickets`,
      { method: 'POST', token: hostToken, body: {} },
    );
    const paid = await apiJson(`/api/tickets/${issued.id}/mark-paid`, {
      method: 'POST',
      token: hostToken,
    });
    credentials.push(paid.credentialToken);
  }
  return credentials;
}

async function pasteAndCheckIn(page, token) {
  await page.locator('#credential-paste').fill(token);
  await pause(page, 800);
  await page.getByRole('button', { name: 'Check in' }).click();
}

async function goToEventTickets(page, eventId) {
  await page.goto(`${BASE_URL}/app/events/${eventId}/tickets`, {
    waitUntil: 'networkidle',
  });
  await page
    .locator('#credential-paste')
    .or(page.getByRole('button', { name: 'Config', exact: true }))
    .first()
    .waitFor({ timeout: 15000 });
  await pause(page, 1500);
}

const { browser, context, page } = await launchDemo();
try {
  // ── 1. Signup → awaiting approval ─────────────────────────────────────
  await flowTitle(page, 'SIGNUP PENDING');
  await signupCascade(page, {
    name: pendingName,
    email: pendingEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 2500);
  await page.getByLabel('Email').fill(pendingEmail);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/awaiting-approval/, { timeout: 15000 });
  await page.getByText('Awaiting approval', { exact: true }).waitFor();
  await pause(page, 3000);

  // ── 2. Admin universities CRUD + seed delete 409 ──────────────────────
  await flowTitle(page, 'UNIVERSITIES CRUD');
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/universities`, { waitUntil: 'networkidle' });
  await pause(page, 2000);
  await page.getByLabel('Name').fill(uniName);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(uniName, { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);
  const seedUniRow = page.locator('li').filter({ hasText: UNI_NAME }).first();
  await seedUniRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(/Conflict \(409\)/i).waitFor({ timeout: 15000 });
  await pause(page, 3000);

  // ── 3. Admin organizations CRUD + delete 409 ──────────────────────────
  await flowTitle(page, 'ORGANIZATIONS CRUD');
  await page.goto(`${BASE_URL}/admin/organizations`, { waitUntil: 'networkidle' });
  await pause(page, 2000);
  await page.getByLabel('Name', { exact: true }).fill(orgName);
  await page.getByLabel('Type').selectOption('FRATERNITY');
  await page.locator('#org-uni').selectOption({ label: UNI_NAME });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(orgName, { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  {
    const token = await adminToken();
    const orgs = await apiJson('/api/organizations?universityId=seed-university-demo', {
      token,
    });
    const created = orgs.find((o) => o.name === orgName);
    if (!created) throw new Error('Created org not found via API');
    await apiSignup({
      name: `Full Org Member ${stamp}`,
      email: orgMemberEmail,
      password: DEMO_PASSWORD,
      organizationId: created.id,
    });
    const users = await apiJson('/api/admin/users?status=PENDING', { token });
    const pending = users.find((u) => u.email === orgMemberEmail);
    if (!pending) throw new Error('Pending org member missing');
    await apiJson(`/api/admin/users/${pending.id}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'ACTIVE', organizationId: created.id },
    });
  }

  const orgRow = page.locator('li').filter({ hasText: orgName }).first();
  await orgRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(/Conflict \(409\)/i).waitFor({ timeout: 15000 });
  await pause(page, 3000);

  // ── 4. Admin approve → member home ────────────────────────────────────
  await flowTitle(page, 'ADMIN APPROVE');
  await signupCascade(page, {
    name: approveName,
    email: approveEmail,
    password: DEMO_PASSWORD,
  });
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();
  await pause(page, 2000);
  let row = await findUserRow(page, approveEmail);
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByText('Approve & activate').waitFor();
  await pause(page, 2500);
  await page.getByRole('button', { name: 'Activate with org' }).click();
  await pause(page, 2500);
  await logout(page);
  await login(page, approveEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${approveName}`) }).waitFor();
  await pause(page, 3000);
  await logout(page);

  // ── 5. Admin deny → blocked ───────────────────────────────────────────
  await flowTitle(page, 'ADMIN DENY');
  await signupCascade(page, {
    name: denyName,
    email: denyEmail,
    password: DEMO_PASSWORD,
  });
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();
  await pause(page, 2000);
  row = await findUserRow(page, denyEmail);
  await row.getByRole('button', { name: 'Deny' }).click();
  await pause(page, 2500);
  await page.getByRole('button', { name: 'INACTIVE', exact: true }).click();
  await findUserRow(page, denyEmail);
  await pause(page, 2500);
  await logout(page);
  await login(page, denyEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/blocked/, { timeout: 15000 });
  await page.getByText('Account inactive', { exact: true }).waitFor();
  await pause(page, 3000);
  await logout(page);

  // ── 6. Approve → deactivate → blocked → reactivate → app ──────────────
  await flowTitle(page, 'DEACTIVATE / REACTIVATE');
  await signupCascade(page, {
    name: reactivateName,
    email: reactivateEmail,
    password: DEMO_PASSWORD,
  });
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();
  row = await findUserRow(page, reactivateEmail);
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Activate with org' }).click();
  await pause(page, 2000);
  await page.getByRole('button', { name: 'ACTIVE', exact: true }).click();
  row = await findUserRow(page, reactivateEmail);
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await pause(page, 2500);
  await logout(page);
  await login(page, reactivateEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/blocked/, { timeout: 15000 });
  await page.getByText('Account inactive', { exact: true }).waitFor();
  await pause(page, 2500);
  await logout(page);
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'INACTIVE', exact: true }).click();
  row = await findUserRow(page, reactivateEmail);
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await pause(page, 2500);
  await logout(page);
  await login(page, reactivateEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${reactivateName}`) }).waitFor();
  await pause(page, 3000);
  await logout(page);

  // ── 7. Memberships + permissions grant/revoke ─────────────────────────
  await flowTitle(page, 'MEMBERSHIPS + PERMISSIONS');
  await signupCascade(page, {
    name: permsName,
    email: permsEmail,
    password: DEMO_PASSWORD,
  });
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();
  row = await findUserRow(page, permsEmail);
  await row.getByRole('button', { name: 'Deny' }).click();
  await pause(page, 2000);
  await page.getByRole('button', { name: 'INACTIVE', exact: true }).click();
  row = await findUserRow(page, permsEmail);
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await pause(page, 2000);

  await page.goto(`${BASE_URL}/admin/memberships`, { waitUntil: 'networkidle' });
  await pause(page, 2000);
  await page.getByLabel('User').selectOption({ label: `${permsName} (${permsEmail})` });
  const orgSelect = page.getByLabel('Organization');
  const orgValue = await orgSelect.evaluate((sel) => {
    const opt = [...sel.options].find((o) => o.text.includes('Alpha Demo Fraternity'));
    return opt?.value ?? '';
  });
  if (!orgValue) throw new Error('Alpha org option missing');
  await orgSelect.selectOption(orgValue);
  await page.getByRole('button', { name: 'Assign' }).click();
  await page.getByText(permsEmail).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  await page.goto(`${BASE_URL}/admin/permissions`, { waitUntil: 'networkidle' });
  await pause(page, 2000);
  const memSelect = page.getByLabel('ACTIVE membership');
  const memValue = await memSelect.evaluate((sel, n) => {
    const opt = [...sel.options].find((o) => o.text.includes(n));
    return opt?.value ?? '';
  }, permsName);
  if (!memValue) throw new Error('Membership option missing');
  await memSelect.selectOption(memValue);
  await pause(page, 1500);
  await page.getByLabel('Grant permission').selectOption('events.create');
  await page.getByRole('button', { name: 'Grant' }).click();
  const grantRow = page
    .locator('ul li')
    .filter({ has: page.getByRole('button', { name: 'Revoke' }) })
    .filter({ hasText: 'events.create' });
  await grantRow.first().waitFor({ timeout: 15000 });
  await pause(page, 2500);
  await grantRow.first().getByRole('button', { name: 'Revoke' }).click();
  await page.getByText('No grants on this membership.').waitFor({ timeout: 15000 });
  await pause(page, 3000);

  // ── 8. Admin events create + edit ─────────────────────────────────────
  await flowTitle(page, 'ADMIN EVENTS');
  await page.goto(`${BASE_URL}/admin/events`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Events' }).waitFor();
  await pause(page, 2000);
  await page.getByLabel('Organization', { exact: true }).selectOption({
    label: ORG_LABEL,
  });
  await page.getByLabel('Event name').fill(adminEventName);
  await page.getByLabel('Event type').fill('Fraternity Formal');
  await page.getByLabel('Max headcount').fill('100');
  await page.getByLabel('Location (optional)').fill('Nashville');
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(adminEventName).waitFor({ timeout: 15000 });
  await pause(page, 2500);
  const adminEvtRow = page.locator('li').filter({ hasText: adminEventName });
  await adminEvtRow.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#admin-edit-event-name').fill(adminEventUpdated);
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText(adminEventUpdated).waitFor({ timeout: 15000 });
  await pause(page, 3000);
  await logout(page);

  // ── 9. Officer approve applicant ──────────────────────────────────────
  await flowTitle(page, 'OFFICER APPROVE');
  await setupOfficerAndApplicant({
    officerEmail,
    officerName,
    applicantEmail: offApplEmail,
    applicantName: offApplName,
  });
  await login(page, officerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${officerName}`) }).waitFor();
  await pause(page, 2000);
  await page.getByRole('link', { name: 'Pending approvals' }).click();
  await page.waitForURL(/\/users\/?$/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Pending approvals' }).waitFor();
  await page.getByText(offApplEmail).waitFor();
  await pause(page, 2500);
  row = await findUserRow(page, offApplEmail);
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByText(offApplEmail).waitFor({ state: 'detached', timeout: 15000 });
  await pause(page, 2500);
  await logout(page);
  await login(page, offApplEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${offApplName}`) }).waitFor();
  await pause(page, 3000);
  await logout(page);

  // ── 10. Officer deny applicant ────────────────────────────────────────
  await flowTitle(page, 'OFFICER DENY');
  await setupOfficerAndApplicant({
    officerEmail: offDenyOfficerEmail,
    officerName: offDenyOfficerName,
    applicantEmail: offDenyEmail,
    applicantName: offDenyName,
  });
  await login(page, offDenyOfficerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1500);
  await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Pending approvals' }).waitFor();
  await page.getByText(offDenyEmail).waitFor();
  await pause(page, 2500);
  row = await findUserRow(page, offDenyEmail);
  await row.getByRole('button', { name: 'Deny' }).click();
  await page.getByText(offDenyEmail).waitFor({ state: 'detached', timeout: 15000 });
  await pause(page, 2500);
  await logout(page);
  await login(page, offDenyEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/blocked/, { timeout: 15000 });
  await page.getByText('Account inactive', { exact: true }).waitFor();
  await pause(page, 3000);
  await logout(page);

  // ── 11. Member without manage_permissions → /users forbidden ──────────
  await flowTitle(page, 'USERS FORBIDDEN');
  await setupOfficerAndApplicant({
    officerEmail: noPermEmail,
    officerName: noPermName,
    grantOfficerPermission: false,
  });
  await login(page, noPermEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${noPermName}`) }).waitFor();
  await pause(page, 2000);
  const pendingLink = page.getByRole('link', { name: 'Pending approvals' });
  await pendingLink.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  if ((await pendingLink.count()) > 0) {
    throw new Error('Pending approvals link should be hidden without permission');
  }
  await pause(page, 2000);
  await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/app\/?$/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${noPermName}`) }).waitFor();
  await pause(page, 3000);
  await logout(page);

  // ── 12. Member events CRUD (with perms) ───────────────────────────────
  await flowTitle(page, 'MEMBER EVENTS');
  await setupActiveMember({ name: eventsName, email: eventsEmail, grantEventPerms: true });
  await login(page, eventsEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${eventsName}`) }).waitFor();
  await pause(page, 2000);
  const eventsLink = page.getByRole('link', { name: 'Events' });
  await eventsLink.waitFor({ timeout: 10000 });
  await pause(page, 1500);
  await eventsLink.click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Events' }).waitFor();
  await pause(page, 2500);
  await page.getByLabel('Event name').fill(memberEventName);
  await page.getByLabel('Event type').fill('Date Party');
  await page.getByLabel('Max headcount').fill('40');
  await page.getByLabel('Location (optional)').fill('Chapter House');
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(memberEventName).waitFor({ timeout: 15000 });
  await pause(page, 2500);
  const memEvtRow = page.locator('li').filter({ hasText: memberEventName });
  await memEvtRow.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#edit-event-name').fill(memberEventUpdated);
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText(memberEventUpdated).waitFor({ timeout: 15000 });
  await pause(page, 2500);
  const updatedMemEvt = page.locator('li').filter({ hasText: memberEventUpdated });
  await updatedMemEvt.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(memberEventUpdated).waitFor({ state: 'detached', timeout: 15000 });
  await pause(page, 3000);
  await logout(page);

  // ── 13. Member without event perms → /app/events forbidden ────────────
  await flowTitle(page, 'EVENTS FORBIDDEN');
  await setupActiveMember({ name: noEvtName, email: noEvtEmail, grantEventPerms: false });
  await login(page, noEvtEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${noEvtName}`) }).waitFor();
  await pause(page, 2000);
  const hiddenEvents = page.getByRole('link', { name: 'Events' });
  await hiddenEvents.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  if ((await hiddenEvents.count()) > 0) {
    throw new Error('Events nav link should be hidden without event permissions');
  }
  await pause(page, 2000);
  await page.goto(`${BASE_URL}/app/events`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/app\/?$/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${noEvtName}`) }).waitFor();
  await pause(page, 2500);
  await logout(page);

  // ── 14. Optional org signup ───────────────────────────────────────────
  await flowTitle(page, 'OPTIONAL ORG SIGNUP');
  await signupWithoutOrg(page, {
    name: optOrglessName,
    email: optOrglessEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 2000);
  await login(page, optOrglessEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${optOrglessName}`) }).waitFor();
  await pause(page, 2500);
  await logout(page);

  await signupCascade(page, {
    name: optPendingName,
    email: optPendingEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 2000);
  await login(page, optPendingEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/awaiting-approval/, { timeout: 15000 });
  await page.getByText('Awaiting approval', { exact: true }).waitFor();
  await pause(page, 2500);
  await logout(page);

  // ── 15. Ticketing host flow (API fixture + UI) ────────────────────────
  await setupActiveMember({ name: ticketHostName, email: ticketHostEmail });
  await grantTicketPermissionsByEmail(ticketHostEmail);
  const ticketOrgB = await createOrgViaAdmin({ name: ticketOrgBName });

  await flowTitle(page, 'TICKETING HOST');
  await login(page, ticketHostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${ticketHostName}`) }).waitFor();
  await pause(page, 2000);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Events' }).waitFor();
  await pause(page, 2000);

  await page.getByLabel('Event name').fill(ticketEventName);
  await page.getByLabel('Event type').fill('Formal');
  await page.getByLabel('Max headcount').fill('30');
  await page.getByLabel('Location (optional)').fill('Chapter House');
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(ticketEventName).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  const ticketRow = page.locator('li').filter({ hasText: ticketEventName });
  await ticketRow.getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Config', exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('20');
  await pause(page, 1000);
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 2000);

  await page.getByRole('button', { name: 'Allocations', exact: true }).click();
  await pause(page, 1500);

  await page.locator('#alloc-org').selectOption({ label: 'Alpha Demo Fraternity' });
  await page.locator('#alloc-qty').fill('5');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Alpha Demo Fraternity' })
    .waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.locator('#alloc-org').selectOption({ label: ticketOrgBName });
  await page.locator('#alloc-qty').fill('1');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page.getByRole('listitem').filter({ hasText: ticketOrgBName }).waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByLabel('Public pool').check();
  await page.locator('#alloc-qty').fill('3');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Public' })
    .filter({ hasText: '/ 3 sold' })
    .waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByRole('button', { name: 'Config', exact: true }).click();
  await pause(page, 1000);
  await page.locator('#sale-status').selectOption('on_sale');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 2000);

  // Members buy from My tickets — host issues no longer exist in UI
  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'My tickets' }).waitFor();
  await pause(page, 2000);

  const hostBuyRow = page.locator('li').filter({ hasText: ticketEventName });
  await hostBuyRow.getByRole('button', { name: 'Buy ticket' }).click();
  await page.getByText(ticketEventName).waitFor({ timeout: 15000 });
  await pause(page, 2000);
  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByText('paid').waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await pause(page, 1500);
  const hostEvtRow = page.locator('li').filter({ hasText: ticketEventName });
  await hostEvtRow.getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await pause(page, 1500);

  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 1500);
  await page.getByText(/Members buy their own tickets/i).waitFor({ timeout: 15000 });
  await page.getByText('paid').first().waitFor({ timeout: 15000 });
  if ((await page.getByRole('button', { name: 'Issue ticket' }).count()) > 0) {
    throw new Error('Issue ticket button should not appear');
  }
  await pause(page, 2000);

  await page.getByRole('button', { name: 'Guest list', exact: true }).click();
  await pause(page, 1500);
  await page.getByText('paid').first().waitFor({ timeout: 15000 });
  await pause(page, 2500);

  // Void from host Tickets tab (Issue ticket no longer in UI)
  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Void' }).first().click();
  await page.getByText('void').waitFor({ timeout: 15000 });
  await pause(page, 2500);
  await logout(page);

  // ── 16. Guest claim ticket ────────────────────────────────────────────
  await setupActiveMember({
    name: `Fixture Host ${stamp}`,
    email: ticketFixtureHostEmail,
  });
  await grantTicketPermissionsByEmail(ticketFixtureHostEmail);
  await setupOnSalePublicEvent({
    hostEmail: ticketFixtureHostEmail,
    eventName: publicEventName,
    publicQty: 10,
  });

  await flowTitle(page, 'GUEST CLAIM TICKET');
  await signupWithoutOrg(page, {
    name: ticketGuestName,
    email: ticketGuestEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 2000);

  await login(page, ticketGuestEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${ticketGuestName}`) }).waitFor();
  await pause(page, 2000);

  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'My tickets' }).waitFor();
  await pause(page, 2000);

  const claimRow = page.locator('li').filter({ hasText: publicEventName });
  await claimRow.getByRole('button', { name: 'Buy ticket' }).click();
  await page.getByText(publicEventName).waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByText('paid').waitFor({ timeout: 15000 });
  await pause(page, 2500);
  await logout(page);

  // ── 17. Org member buy ────────────────────────────────────────────────
  await setupActiveMember({ name: orgBuyHostName, email: orgBuyHostEmail });
  await grantTicketPermissionsByEmail(orgBuyHostEmail);
  await setupActiveMember({ name: orgBuyBuyerName, email: orgBuyBuyerEmail });

  const orgBuyHostToken = await loginToken(orgBuyHostEmail, DEMO_PASSWORD);
  const orgBuyOrgId = await seedOrgId();

  const orgBuyEvent = await apiJson('/api/events', {
    method: 'POST',
    token: orgBuyHostToken,
    body: {
      organizationId: orgBuyOrgId,
      name: orgBuyEventName,
      type: 'Formal',
      maxHeadcount: 50,
      location: 'Chapter House',
    },
  });

  await apiJson(`/api/events/${orgBuyEvent.id}/ticketing`, {
    method: 'PATCH',
    token: orgBuyHostToken,
    body: {
      ticketingEnabled: true,
      ticketCapacity: 20,
      ticketSaleStatus: 'draft',
    },
  });

  await apiJson(`/api/events/${orgBuyEvent.id}/allocations`, {
    method: 'POST',
    token: orgBuyHostToken,
    body: { organizationId: orgBuyOrgId, quantity: 5 },
  });

  await apiJson(`/api/events/${orgBuyEvent.id}/ticketing`, {
    method: 'PATCH',
    token: orgBuyHostToken,
    body: { ticketSaleStatus: 'on_sale' },
  });

  await flowTitle(page, 'ORG MEMBER BUY');
  await login(page, orgBuyBuyerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${orgBuyBuyerName}`) }).waitFor();
  await pause(page, 2000);

  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'My tickets' }).waitFor();
  await pause(page, 2000);

  const buyRow = page.locator('li').filter({ hasText: orgBuyEventName });
  await buyRow.getByRole('button', { name: 'Buy ticket' }).click();
  await page.getByText(orgBuyEventName).waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByText('paid').waitFor({ timeout: 15000 });
  await pause(page, 2500);
  await logout(page);

  // ── 18. QR check-in (condensed) ───────────────────────────────────────
  await setupActiveMember({ name: qrHostManagerName, email: qrHostManagerEmail });
  await grantTicketPermissionsByEmail(qrHostManagerEmail);
  await setupActiveMember({ name: qrHostScannerName, email: qrHostScannerEmail });
  await grantPermissionsByEmail(qrHostScannerEmail, ['tickets.scan', 'events.manage']);

  const qrHostToken = await loginToken(qrHostManagerEmail, DEMO_PASSWORD);
  const qrOrgId = await seedOrgId();

  const qrEvent = await apiJson('/api/events', {
    method: 'POST',
    token: qrHostToken,
    body: {
      organizationId: qrOrgId,
      name: qrEventName,
      type: 'Formal',
      maxHeadcount: 50,
      location: 'Chapter House',
    },
  });

  await apiJson(`/api/events/${qrEvent.id}/ticketing`, {
    method: 'PATCH',
    token: qrHostToken,
    body: {
      ticketingEnabled: true,
      ticketCapacity: 2,
      ticketSaleStatus: 'draft',
    },
  });

  const qrAlloc = await apiJson(`/api/events/${qrEvent.id}/allocations`, {
    method: 'POST',
    token: qrHostToken,
    body: { organizationId: qrOrgId, quantity: 2 },
  });
  const qrAllocId = Array.isArray(qrAlloc) ? qrAlloc[0].id : qrAlloc.id;

  await apiJson(`/api/events/${qrEvent.id}/ticketing`, {
    method: 'PATCH',
    token: qrHostToken,
    body: { ticketSaleStatus: 'on_sale' },
  });

  const [qrCredential1] = await issuePaidTickets(qrHostToken, qrEvent.id, qrAllocId, 1);

  await flowTitle(page, 'QR CHECK-IN');
  await login(page, qrHostScannerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page
    .getByRole('heading', { name: new RegExp(`Hello, ${qrHostScannerName}`) })
    .waitFor();
  await pause(page, 2000);

  await goToEventTickets(page, qrEvent.id);
  await page.getByRole('button', { name: 'Scanner', exact: true }).waitFor({
    timeout: 15000,
  });
  await pause(page, 1500);

  await pasteAndCheckIn(page, qrCredential1);
  await page.getByText('Checked in', { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  await logout(page);
  await login(page, qrHostManagerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1500);

  await goToEventTickets(page, qrEvent.id);
  await page.getByRole('button', { name: 'Guest list', exact: true }).click();
  await pause(page, 1500);
  await page.getByText('Checked in', { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  await logout(page);
  await login(page, qrHostScannerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1500);

  await goToEventTickets(page, qrEvent.id);
  await pasteAndCheckIn(page, qrCredential1);
  await page.getByText('Already checked in', { exact: true }).waitFor({
    timeout: 15000,
  });
  await pause(page, 3000);

  console.log('✓ all sections done');
} finally {
  await finalizeVideo(page, context, browser, out);
}
