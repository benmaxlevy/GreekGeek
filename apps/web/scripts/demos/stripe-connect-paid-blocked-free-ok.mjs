import {
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  grantTicketAndPaymentsPermissionsByEmail,
  launchDemo,
  login,
  pause,
  seedOrgId,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';
import { resetOrgStripeConnect } from './stripe-demo-fixtures.mjs';

const stamp = ts();
const officerEmail = `demo+stripe-paid-block-${stamp}@greekgeek.local`;
const officerName = `Stripe Paid Block ${stamp}`;
const eventName = `Stripe Gate Event ${stamp}`;
const out = `stripe-connect-paid-blocked-free-ok-${stamp}.webm`;

const organizationId = await seedOrgId();
resetOrgStripeConnect(organizationId);

await setupActiveMember({ name: officerName, email: officerEmail });
await grantTicketAndPaymentsPermissionsByEmail(officerEmail);

const { browser, context, page } = await launchDemo();
try {
  await login(page, officerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.getByLabel('Event name').fill(eventName);
  await page.getByLabel('Event type').fill('Formal');
  await page.getByLabel('Max headcount').fill('30');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 800);

  await page.locator('li').filter({ hasText: eventName }).getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('20');
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 1000);

  await page.getByRole('button', { name: 'Allocations', exact: true }).click();
  await pause(page, 800);

  await page.locator('#alloc-org').selectOption({ label: 'Alpha Demo Fraternity' });
  await page.locator('#alloc-qty').fill('5');
  await page.getByLabel('Price (USD, optional)').fill('15');
  await pause(page, 1200);
  await page.getByText('Connect payout account required').waitFor({ timeout: 15000 });
  await pause(page, 1500);

  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByText(/Stripe Connect onboarding is required before setting paid ticket prices/i)
    .waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await page.getByLabel('Price (USD, optional)').fill('0');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Alpha Demo Fraternity' })
    .waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
