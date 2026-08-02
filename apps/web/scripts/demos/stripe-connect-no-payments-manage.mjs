import {
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  pause,
  seedOrgId,
  setupActiveMember,
  setupTicketingEvent,
  ts,
} from './demo-helpers.mjs';
import { resetOrgStripeConnect } from './stripe-demo-fixtures.mjs';

const stamp = ts();
const officerEmail = `demo+stripe-no-pay-${stamp}@rally.local`;
const officerName = `Stripe No Pay Perm ${stamp}`;
const eventName = `Stripe Ask Officer ${stamp}`;
const out = `stripe-connect-no-payments-manage-${stamp}.webm`;

const organizationId = await seedOrgId();
resetOrgStripeConnect(organizationId);

await setupActiveMember({ name: officerName, email: officerEmail });
await grantTicketPermissionsByEmail(officerEmail);
await setupTicketingEvent({ hostEmail: officerEmail, eventName, organizationId });

const { browser, context, page } = await launchDemo();
try {
  await login(page, officerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await page.goto(`${BASE_URL}/app/orgs/${organizationId}/payments`, {
    waitUntil: 'networkidle',
  });
  await page.getByText('Ask an officer', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText(/officer with payments access/i).waitFor();
  if ((await page.getByRole('button', { name: 'Connect payout account' }).count()) > 0) {
    throw new Error('Connect CTA should not appear without payments.manage');
  }
  await pause(page, 2000);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.locator('li').filter({ hasText: eventName }).getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Allocations', exact: true }).click();
  await page.getByLabel('Price (USD, optional)').fill('10');
  await pause(page, 1200);
  await page.getByText('Connect payout account required').waitFor({ timeout: 15000 });
  await page.getByText(/Ask an officer with payments access/i).waitFor();
  if ((await page.getByRole('link', { name: 'Open payments settings' }).count()) > 0) {
    throw new Error('Payments settings CTA should not appear without payments.manage');
  }
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
