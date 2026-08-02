import {
  BASE_URL,
  DEMO_PASSWORD,
  adminApproveUserByEmail,
  adminToken,
  apiJson,
  apiSignup,
  createOrgViaAdmin,
  finalizeVideo,
  grantPermissionsByEmail,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  loginToken,
  logout,
  pause,
  seedOrgId,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const hostManagerEmail = `demo+qr-host-mgr-${stamp}@rally.local`;
const hostScannerEmail = `demo+qr-host-scan-${stamp}@rally.local`;
const manageOnlyEmail = `demo+qr-manage-only-${stamp}@rally.local`;
const invitedScannerEmail = `demo+qr-invited-scan-${stamp}@rally.local`;
const hostManagerName = `QR Host Manager ${stamp}`;
const hostScannerName = `QR Host Scanner ${stamp}`;
const manageOnlyName = `QR Manage Only ${stamp}`;
const invitedScannerName = `QR Invited Scanner ${stamp}`;
const orgBName = `Org B QR Demo ${stamp}`;
const hostEventName = `QR Check-in Formal ${stamp}`;
const orgBEventName = `Org B Scanner Stub ${stamp}`;
const out = `ticketing-qr-scan-${stamp}.webm`;

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
  await pause(page, 600);
  await page.getByRole('button', { name: 'Check in' }).click();
}

async function goToEventTickets(page, eventId) {
  await page.goto(`${BASE_URL}/app/events/${eventId}/tickets`, {
    waitUntil: 'networkidle',
  });
  await page.locator('#credential-paste').or(page.getByRole('button', { name: 'Config', exact: true })).first().waitFor({
    timeout: 15000,
  });
  await pause(page, 1000);
}

// --- API fixture ---
await setupActiveMember({ name: hostManagerName, email: hostManagerEmail });
await grantTicketPermissionsByEmail(hostManagerEmail);

await setupActiveMember({ name: hostScannerName, email: hostScannerEmail });
await grantPermissionsByEmail(hostScannerEmail, ['tickets.scan', 'events.manage']);

await setupActiveMember({ name: manageOnlyName, email: manageOnlyEmail });
await grantPermissionsByEmail(manageOnlyEmail, [
  'events.create',
  'events.manage',
  'tickets.manage',
]);

const orgB = await createOrgViaAdmin({ name: orgBName });
await apiSignup({
  name: invitedScannerName,
  email: invitedScannerEmail,
  password: DEMO_PASSWORD,
  organizationId: orgB.id,
});
await adminApproveUserByEmail(invitedScannerEmail);
await grantPermissionsByEmail(invitedScannerEmail, [
  'tickets.scan',
  'events.create',
  'events.manage',
]);

const hostToken = await loginToken(hostManagerEmail, DEMO_PASSWORD);
const organizationId = await seedOrgId();

const hostEvent = await apiJson('/api/events', {
  method: 'POST',
  token: hostToken,
  body: {
    organizationId,
    name: hostEventName,
    type: 'Formal',
    maxHeadcount: 50,
    location: 'Chapter House',
  },
});

await apiJson(`/api/events/${hostEvent.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: {
    ticketingEnabled: true,
    ticketCapacity: 2,
    ticketSaleStatus: 'draft',
  },
});

const hostAlloc = await apiJson(`/api/events/${hostEvent.id}/allocations`, {
  method: 'POST',
  token: hostToken,
  body: { organizationId, quantity: 2 },
});
const hostAllocId = Array.isArray(hostAlloc) ? hostAlloc[0].id : hostAlloc.id;

await apiJson(`/api/events/${hostEvent.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: { ticketSaleStatus: 'on_sale' },
});

const [credential1, credential2] = await issuePaidTickets(
  hostToken,
  hostEvent.id,
  hostAllocId,
  2,
);

const invitedToken = await loginToken(invitedScannerEmail, DEMO_PASSWORD);
const adminTok = await adminToken();
const orgBEvent = await apiJson('/api/events', {
  method: 'POST',
  token: invitedToken,
  body: {
    organizationId: orgB.id,
    name: orgBEventName,
    type: 'Stub',
    maxHeadcount: 20,
    location: 'Org B Hall',
  },
});
await apiJson(`/api/events/${orgBEvent.id}/ticketing`, {
  method: 'PATCH',
  token: adminTok,
  body: {
    ticketingEnabled: true,
    ticketCapacity: 10,
    ticketSaleStatus: 'draft',
  },
});

// --- UI recording ---
const { browser, context, page } = await launchDemo();
try {
  // 1. Host scanner checks in paid credential (paste)
  await login(page, hostScannerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page
    .getByRole('heading', { name: new RegExp(`Hello, ${hostScannerName}`) })
    .waitFor();
  await pause(page, 1000);

  await goToEventTickets(page, hostEvent.id);
  await page.getByRole('button', { name: 'Scanner', exact: true }).waitFor({
    timeout: 15000,
  });
  await pause(page, 800);

  await pasteAndCheckIn(page, credential1);
  await page.getByText('Checked in', { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  // 2. Guest list shows checkedIn + checkedInAt (host manager)
  await logout(page);
  await login(page, hostManagerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await goToEventTickets(page, hostEvent.id);
  await page.getByRole('button', { name: 'Guest list', exact: true }).click();
  await pause(page, 800);
  await page.getByText('Checked in', { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  // 3. Second scan same token → already checked in
  await logout(page);
  await login(page, hostScannerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await goToEventTickets(page, hostEvent.id);
  await pasteAndCheckIn(page, credential1);
  await page.getByText('Already checked in', { exact: true }).waitFor({
    timeout: 15000,
  });
  await pause(page, 2500);

  // 4. Invited-org scanner → forbidden on host event credential
  await logout(page);
  await login(page, invitedScannerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await goToEventTickets(page, orgBEvent.id);
  await pasteAndCheckIn(page, credential2);
  await page.getByText('Not allowed to scan', { exact: true }).waitFor({
    timeout: 15000,
  });
  await pause(page, 2500);

  // 5. At-capacity reject (shrink capacity to 1 after first check-in)
  await apiJson(`/api/events/${hostEvent.id}/ticketing`, {
    method: 'PATCH',
    token: hostToken,
    body: { ticketCapacity: 1 },
  });

  await logout(page);
  await login(page, hostScannerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await goToEventTickets(page, hostEvent.id);
  await pasteAndCheckIn(page, credential2);
  await page.getByText('Event at capacity', { exact: true }).waitFor({
    timeout: 15000,
  });
  await pause(page, 2500);

  // 6. Manage-only member — no Scanner tab
  await logout(page);
  await login(page, manageOnlyEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await goToEventTickets(page, hostEvent.id);
  await page.getByRole('button', { name: 'Config', exact: true }).waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Guest list', exact: true }).waitFor({
    timeout: 15000,
  });
  const scannerTabCount = await page
    .getByRole('button', { name: 'Scanner', exact: true })
    .count();
  if (scannerTabCount > 0) {
    throw new Error('Manage-only user should not see Scanner tab');
  }
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
