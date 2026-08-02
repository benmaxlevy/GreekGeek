import {
  DEMO_PASSWORD,
  finalizeVideo,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  logout,
  pause,
  setupActiveMember,
  loginToken,
  apiJson,
  seedOrgId,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const hostEmail = `demo+org-buy-host-${stamp}@rally.local`;
const buyerEmail = `demo+org-buy-member-${stamp}@rally.local`;
const hostName = `Org Buy Host ${stamp}`;
const buyerName = `Org Buyer ${stamp}`;
const eventName = `Org Allocation Gala ${stamp}`;
const out = `ticketing-org-member-buy-${stamp}.webm`;

await setupActiveMember({ name: hostName, email: hostEmail });
await grantTicketPermissionsByEmail(hostEmail);
await setupActiveMember({ name: buyerName, email: buyerEmail });

const hostToken = await loginToken(hostEmail, DEMO_PASSWORD);
const organizationId = await seedOrgId();

const event = await apiJson('/api/events', {
  method: 'POST',
  token: hostToken,
  body: {
    organizationId,
    name: eventName,
    type: 'Formal',
    maxHeadcount: 50,
    location: 'Chapter House',
  },
});

await apiJson(`/api/events/${event.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: {
    ticketingEnabled: true,
    ticketCapacity: 20,
    ticketSaleStatus: 'draft',
  },
});

await apiJson(`/api/events/${event.id}/allocations`, {
  method: 'POST',
  token: hostToken,
  body: { organizationId, quantity: 5 },
});

await apiJson(`/api/events/${event.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: { ticketSaleStatus: 'on_sale' },
});

const { browser, context, page } = await launchDemo();
try {
  await login(page, buyerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${buyerName}`) }).waitFor();
  await pause(page, 1000);

  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'My tickets' }).waitFor();
  await pause(page, 2000);

  const buyRow = page.locator('li').filter({ hasText: eventName });
  await buyRow.getByRole('button', { name: 'Buy ticket' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByText('paid').waitFor({ timeout: 15000 });
  await pause(page, 2500);

  await logout(page);
  await login(page, hostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await pause(page, 1000);

  const eventRow = page.locator('li').filter({ hasText: eventName });
  await eventRow.getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await pause(page, 1000);

  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 1000);
  await page.getByText('paid').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Issue ticket' }).count().then((n) => {
    if (n > 0) throw new Error('Issue ticket button should not appear');
  });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
