import { BASE_URL, apiJson, loginToken, pause } from './demo-helpers.mjs';
import { setOrgStripeReady } from './stripe-demo-fixtures.mjs';

export function isStripeHostedUrl(url) {
  return /stripe\.com/i.test(url);
}

/** Wait until browser navigates to Stripe hosted Connect onboarding. */
export async function waitForStripeHostedPage(page, timeout = 45000) {
  await page.waitForURL(/stripe\.com/i, { timeout });
}

/**
 * Land on Stripe hosted onboarding, optionally click test shortcuts, hold for video.
 * Returns true when Stripe page was shown.
 */
export async function recordStripeHostedOnboarding(page, holdMs = 3500) {
  await waitForStripeHostedPage(page);
  const testPhone = page.getByRole('button', { name: 'Use test phone number' });
  if (await testPhone.isVisible().catch(() => false)) {
    await testPhone.click();
    await pause(page, 1500);
  }
  await pause(page, holdMs);
  return true;
}

/** FE return bridge → sync Connect status from Stripe. */
export async function returnToOrgPayments(page, organizationId) {
  await page.goto(`${BASE_URL}/app/orgs/${organizationId}/payments/return`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForURL(new RegExp(`/app/orgs/${organizationId}/payments`), {
    timeout: 30000,
  });
  await pause(page, 1500);
}

export async function getConnectStatus(organizationId, userEmail, password) {
  const token = await loginToken(userEmail, password);
  return apiJson(`/api/organizations/${organizationId}/stripe/status`, { token });
}

/**
 * After recording real Stripe redirect: sync return, wait briefly for ready UI.
 * If still not charge-ready, DB fixture fallback (documented in stderr).
 */
export async function ensureOrgChargeReadyAfterStripe({
  page,
  organizationId,
  userEmail,
  password,
  stamp,
  readyTimeoutMs = 12000,
}) {
  await returnToOrgPayments(page, organizationId);

  const readyLocator = page.getByText('Ready for paid tickets');
  if (await readyLocator.isVisible().catch(() => false)) {
    return { usedDbFallback: false, showedStripe: true };
  }

  try {
    await readyLocator.waitFor({ timeout: readyTimeoutMs });
    return { usedDbFallback: false, showedStripe: true };
  } catch {
    const status = await getConnectStatus(organizationId, userEmail, password);
    if (status.stripeChargesEnabled) {
      await page.reload({ waitUntil: 'networkidle' });
      await readyLocator.waitFor({ timeout: 15000 });
      return { usedDbFallback: false, showedStripe: true };
    }

    console.error(
      'NOTE: Stripe hosted onboarding shown but charges not enabled (hCaptcha blocks headless submit). Using DB fixture after real Stripe redirect.',
    );
    setOrgStripeReady(organizationId, { accountId: `acct_demo_${stamp}` });
    await page.reload({ waitUntil: 'networkidle' });
    await readyLocator.waitFor({ timeout: 20000 });
    return { usedDbFallback: true, showedStripe: true };
  }
}
