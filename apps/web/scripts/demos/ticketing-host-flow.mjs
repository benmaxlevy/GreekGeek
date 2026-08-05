import {
  DEMO_PASSWORD,
  finalizeVideo,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  pause,
  setupActiveMember,
  createOrgViaAdmin,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const hostEmail = `demo+ticket-host-${stamp}@greekgeek.local`;
const hostName = `Ticket Host ${stamp}`;
const orgBName = `Org B Demo ${stamp}`;
const eventName = `Ticketing Formal ${stamp}`;
const out = `ticketing-host-flow-${stamp}.webm`;

await setupActiveMember({ name: hostName, email: hostEmail });
await grantTicketPermissionsByEmail(hostEmail);
await createOrgViaAdmin({ name: orgBName });

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
  await page.getByRole('button', { name: 'Setup', exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('Ticket setup').waitFor();
  await pause(page, 1000);

  // Step 1 — Enable
  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('20');
  await pause(page, 600);
  await page.getByRole('button', { name: 'Next' }).click();
  await pause(page, 800);

  // Step 2 — Allocate (Alpha + Org B + public, even split)
  await page.locator('label').filter({ hasText: 'Alpha Demo Fraternity' }).locator('input').check();
  await page.locator('label').filter({ hasText: orgBName }).locator('input').check();
  await page.getByLabel('Include public pool').check();
  await pause(page, 500);
  await page.getByRole('button', { name: 'Even split capacity' }).click();
  await pause(page, 800);
  await page.getByRole('button', { name: 'Next' }).click();
  await pause(page, 800);

  // Step 3 — Price (free)
  await page.getByRole('button', { name: 'Next' }).click();
  await pause(page, 800);

  // Step 4 — Verify + enable sales
  await page.getByRole('button', { name: 'Enable sales' }).click();
  await page.getByRole('button', { name: 'Ticket pools', exact: true }).waitFor({ timeout: 15000 });
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Alpha Demo Fraternity' })
    .waitFor({ timeout: 15000 });
  await page.getByRole('listitem').filter({ hasText: orgBName }).waitFor({ timeout: 15000 });
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Public' })
    .waitFor({ timeout: 15000 });
  await pause(page, 1000);

  // Members buy — host does not Issue ticket anymore
  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await pause(page, 1000);
  await page
    .locator('li')
    .filter({ hasText: eventName })
    .getByRole('button', { name: 'Buy ticket' })
    .click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 1000);
  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByText('paid').waitFor({ timeout: 15000 });
  await pause(page, 1200);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.locator('li').filter({ hasText: eventName }).getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await pause(page, 800);

  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 800);
  await page.getByText(/Members buy their own tickets/i).waitFor({ timeout: 15000 });
  await page.getByText('paid').first().waitFor({ timeout: 15000 });
  if ((await page.getByRole('button', { name: 'Issue ticket' }).count()) > 0) {
    throw new Error('Issue ticket button should not appear');
  }
  await pause(page, 1200);

  await page.getByRole('button', { name: 'Guest list', exact: true }).click();
  await pause(page, 800);
  await page.getByText('paid').first().waitFor({ timeout: 15000 });
  await pause(page, 1200);

  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await pause(page, 800);
  await page.getByRole('button', { name: 'Void' }).first().click();
  await page.getByText('void').waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
