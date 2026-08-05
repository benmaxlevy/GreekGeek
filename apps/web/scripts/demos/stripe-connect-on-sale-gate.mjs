import {
  DEMO_PASSWORD,
  apiJson,
  finalizeVideo,
  grantTicketAndPaymentsPermissionsByEmail,
  launchDemo,
  login,
  pause,
  seedOrgId,
  setupActiveMember,
  setupTicketingEvent,
  ts,
} from './demo-helpers.mjs';
import {
  resetOrgStripeConnect,
  setOrgStripeChargesEnabled,
  setOrgStripeReady,
} from './stripe-demo-fixtures.mjs';

const stamp = ts();
const officerEmail = `demo+stripe-onsale-${stamp}@greekgeek.local`;
const officerName = `Stripe On Sale ${stamp}`;
const eventName = `Stripe On Sale Gate ${stamp}`;
const out = `stripe-connect-on-sale-gate-${stamp}.webm`;

const organizationId = await seedOrgId();
resetOrgStripeConnect(organizationId);

await setupActiveMember({ name: officerName, email: officerEmail });
await grantTicketAndPaymentsPermissionsByEmail(officerEmail);

setOrgStripeReady(organizationId, { accountId: `acct_demo_onsale_${stamp}` });
const { eventId, token } = await setupTicketingEvent({
  hostEmail: officerEmail,
  eventName,
  organizationId,
});
await apiJson(`/api/events/${eventId}/allocations`, {
  method: 'POST',
  token,
  body: { organizationId, quantity: 5, priceCents: 2000 },
});
setOrgStripeChargesEnabled(organizationId, false);

const { browser, context, page } = await launchDemo();
try {
  await login(page, officerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.locator('li').filter({ hasText: eventName }).getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await pause(page, 800);

  await page.getByRole('button', { name: 'Config', exact: true }).click();
  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('20');
  await page.locator('#sale-status').waitFor({ timeout: 15000 });
  await page.locator('#sale-status').selectOption('on_sale');
  await pause(page, 1000);
  await page.getByText('Connect payout account required').waitFor({ timeout: 15000 });
  await pause(page, 1200);
  await page.getByRole('button', { name: 'Save config' }).click();
  await page
    .getByText(/Connect onboarding is required before putting paid tickets on sale/i)
    .waitFor({ timeout: 15000 });
  await pause(page, 2000);

  setOrgStripeChargesEnabled(organizationId, true);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Config', exact: true }).click();
  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('20');
  await page.locator('#sale-status').waitFor({ timeout: 15000 });
  await page.locator('#sale-status').selectOption('on_sale');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 1500);
  await page.locator('#sale-status').waitFor();
  const saleStatus = await page.locator('#sale-status').inputValue();
  if (saleStatus !== 'on_sale') {
    throw new Error(`Expected on_sale after charges enabled, got ${saleStatus}`);
  }
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
