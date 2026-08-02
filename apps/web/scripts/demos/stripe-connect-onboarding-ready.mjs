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
import {
  ensureOrgChargeReadyAfterStripe,
  isStripeHostedUrl,
  recordStripeHostedOnboarding,
} from './stripe-connect-helpers.mjs';

const stamp = ts();
const officerEmail = `demo+stripe-onboard-${stamp}@rally.local`;
const officerName = `Stripe Onboard ${stamp}`;
const eventName = `Stripe Ready Event ${stamp}`;
const out = `stripe-connect-onboarding-ready-${stamp}.webm`;

const organizationId = await seedOrgId();
resetOrgStripeConnect(organizationId);

await setupActiveMember({ name: officerName, email: officerEmail });
await grantTicketAndPaymentsPermissionsByEmail(officerEmail);

const { browser, context, page } = await launchDemo();
let usedDbFallback = false;
let showedStripe = false;
try {
  await login(page, officerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 800);

  await page.goto(`${BASE_URL}/app/orgs/${organizationId}/payments`, {
    waitUntil: 'networkidle',
  });
  await page.getByText('Payout account not connected').waitFor({ timeout: 15000 });
  await page.getByText('Not started').waitFor();
  await pause(page, 1500);

  await Promise.all([
    page.waitForURL(/stripe\.com/i, { timeout: 45000 }),
    page.getByRole('button', { name: 'Connect payout account' }).click(),
  ]);

  if (isStripeHostedUrl(page.url())) {
    showedStripe = await recordStripeHostedOnboarding(page, 3500);
    const result = await ensureOrgChargeReadyAfterStripe({
      page,
      organizationId,
      userEmail: officerEmail,
      password: DEMO_PASSWORD,
      stamp,
    });
    usedDbFallback = result.usedDbFallback;
    showedStripe = result.showedStripe;
  } else {
    const connectError = await page
      .getByText(/error|failed|Connect/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (connectError) {
      throw new Error('Connect CTA failed without Stripe redirect');
    }
    throw new Error(`Expected Stripe redirect after Connect CTA, got ${page.url()}`);
  }

  await page.getByText('Ready for paid tickets').waitFor({ timeout: 20000 });
  await page.getByText('Ready', { exact: true }).waitFor();
  await pause(page, 1500);

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.getByLabel('Event name').fill(eventName);
  await page.getByLabel('Event type').fill('Mixer');
  await page.getByLabel('Max headcount').fill('40');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 800);

  await page.locator('li').filter({ hasText: eventName }).getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(/\/app\/events\/.*\/tickets/, { timeout: 15000 });
  await page.getByLabel('Enable ticketing').check();
  await page.getByLabel(/Ticket capacity/).fill('15');
  await page.getByRole('button', { name: 'Save config' }).click();
  await pause(page, 1000);

  await page.getByRole('button', { name: 'Allocations', exact: true }).click();
  await page.locator('#alloc-org').selectOption({ label: 'Alpha Demo Fraternity' });
  await page.locator('#alloc-qty').fill('5');
  await page.getByLabel('Price (USD, optional)').fill('12');
  await pause(page, 800);
  await page.getByRole('button', { name: 'Create allocation' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Alpha Demo Fraternity' })
    .filter({ hasText: '$12.00' })
    .waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}

console.error(
  JSON.stringify({
    demo: 'onboarding-ready',
    showedStripe,
    usedDbFallback,
    realStripeWorked: showedStripe && !usedDbFallback,
  }),
);
