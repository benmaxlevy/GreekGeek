import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  seedOrgId,
  ts,
} from './demo-helpers.mjs';
import { resetOrgStripeConnect } from './stripe-demo-fixtures.mjs';
import { isStripeHostedUrl, recordStripeHostedOnboarding } from './stripe-connect-helpers.mjs';

const stamp = ts();
const out = `stripe-connect-admin-${stamp}.webm`;

const organizationId = await seedOrgId();
resetOrgStripeConnect(organizationId);

const { browser, context, page } = await launchDemo();
let showedStripe = false;
try {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/organizations`, { waitUntil: 'networkidle' });
  await pause(page, 1000);

  const alphaRow = page.locator('li').filter({ hasText: 'Alpha Demo Fraternity' }).first();
  await alphaRow.waitFor({ timeout: 15000 });
  await alphaRow.getByText(/Stripe: Not started/i).waitFor();
  await alphaRow.getByText(/Charges:/i).waitFor();
  await alphaRow.getByText(/Payouts:/i).waitFor();
  await alphaRow.getByText(/Details:/i).waitFor();
  await pause(page, 2000);

  await Promise.all([
    page.waitForURL(/stripe\.com/i, { timeout: 45000 }),
    alphaRow.getByRole('button', { name: 'Generate onboarding link' }).click(),
  ]);

  if (isStripeHostedUrl(page.url())) {
    showedStripe = await recordStripeHostedOnboarding(page, 3000);
    await page.goto(`${BASE_URL}/admin/organizations`, { waitUntil: 'networkidle' });
    await pause(page, 1500);
  } else {
    const errorVisible = await page
      .getByText(/error|failed|Connect/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!errorVisible) {
      throw new Error('Expected Stripe redirect or visible Connect error after generate link');
    }
    await pause(page, 1500);
  }

  await alphaRow.getByText(/Charges:\s*off/i).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}

console.error(
  JSON.stringify({
    demo: 'admin',
    showedStripe,
    realStripeWorked: showedStripe,
  }),
);
