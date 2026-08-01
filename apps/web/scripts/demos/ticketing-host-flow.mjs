import {
  BASE_URL,
  DEMO_PASSWORD,
  createOrgViaAdmin,
  finalizeVideo,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  pause,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const hostEmail = `demo+ticket-host-${stamp}@rally.local`;
const hostName = `Ticket Host ${stamp}`;
const orgBName = `Org B Demo ${stamp}`;
const eventName = `Ticketing Formal ${stamp}`;
const out = `ticketing-host-flow-${stamp}.webm`;

await setupActiveMember({ name: hostName, email: hostEmail });
await grantTicketPermissionsByEmail(hostEmail);
const orgB = await createOrgViaAdmin({ name: orgBName });

const { browser, context, page } = await launchDemo();
try {
  await login(page, hostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${hostName}`) }).waitFor();
  await pause(page, 800);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Events' }).waitFor();
  await pause(page, 800);

  await page.getByLabel('Event name').fill(eventName);
  await page.getByLabel('Event type').fill('Formal');
  await page.getByLabel('Max headcount').fill('30');
  await page.getByLabel('Location (optional)').fill('Chapter House');
  await pause(page, 600);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 1000);

  const row = page.locator('li').filter({ hasText: eventName });
  await row.getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Config', exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 1000);

  // Config: enable ticketing + capacity (draft)
  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('20');
  await pause(page, 600);
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 1200);

  // Allocations: host org, Org B, public pool
  await page.getByRole('button', { name: 'Allocations', exact: true }).click();
  await pause(page, 800);

  await page.locator('#alloc-org').selectOption({ label: 'Alpha Demo Fraternity' });
  await page.locator('#alloc-qty').fill('5');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Alpha Demo Fraternity' })
    .waitFor({ timeout: 15000 });
  await pause(page, 1000);

  await page.locator('#alloc-org').selectOption({ label: orgBName });
  await page.locator('#alloc-qty').fill('1');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page.getByRole('listitem').filter({ hasText: orgBName }).waitFor({ timeout: 15000 });
  await pause(page, 1000);

  await page.getByLabel('Public pool').check();
  await page.locator('#alloc-qty').fill('3');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Public' })
    .filter({ hasText: '/ 3 issued' })
    .waitFor({ timeout: 15000 });
  await pause(page, 1000);

  // On sale
  await page.getByRole('button', { name: 'Config', exact: true }).click();
  await pause(page, 600);
  await page.locator('#sale-status').selectOption('on_sale');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 1200);

  // Issue + mark paid on host allocation
  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 800);

  const hostCard = page.locator('.surface-glass-panel').filter({ hasText: 'Alpha Demo Fraternity' });
  await hostCard.getByRole('button', { name: 'Issue ticket' }).click();
  await hostCard.getByText('unpaid').waitFor({ timeout: 15000 });
  await pause(page, 800);
  await hostCard.getByRole('button', { name: 'Mark paid' }).first().click();
  await hostCard.getByText('paid').first().waitFor({ timeout: 15000 });
  await pause(page, 1200);

  // Guest list (paid only)
  await page.getByRole('button', { name: 'Guest list', exact: true }).click();
  await pause(page, 800);
  await page.getByText('paid').first().waitFor({ timeout: 15000 });
  await pause(page, 1500);

  // Void + oversell on Org B (qty 1)
  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 800);

  const orgBCard = page.locator('.surface-glass-panel').filter({ hasText: orgBName });
  await orgBCard.getByRole('button', { name: 'Issue ticket' }).click();
  await orgBCard.getByText('unpaid').waitFor({ timeout: 15000 });
  await pause(page, 800);

  await orgBCard.getByRole('button', { name: 'Void' }).click();
  await orgBCard.getByText('void').waitFor({ timeout: 15000 });
  await pause(page, 1000);

  await orgBCard.getByRole('button', { name: 'Issue ticket' }).click();
  await orgBCard.getByText('unpaid').waitFor({ timeout: 15000 });
  await pause(page, 800);

  await orgBCard.getByRole('button', { name: 'Issue ticket' }).click();
  await page.getByText(/Allocation is sold out/i).waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
