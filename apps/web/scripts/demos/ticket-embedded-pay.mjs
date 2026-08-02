import {
  BASE_URL,
  DEMO_PASSWORD,
  apiJson,
  finalizeVideo,
  grantPermissionsByEmail,
  grantTicketAndPaymentsPermissionsByEmail,
  launchDemo,
  login,
  loginToken,
  logout,
  pause,
  seedOrgId,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';
import { setOrgStripeReady } from './stripe-demo-fixtures.mjs';

const stamp = ts();
const hostEmail = `demo+embed-pay-host-${stamp}@rally.local`;
const buyerEmail = `demo+embed-pay-buyer-${stamp}@rally.local`;
const hostName = `Embed Pay Host ${stamp}`;
const buyerName = `Embed Pay Buyer ${stamp}`;
const eventName = `Embedded Pay Formal ${stamp}`;
const out = `ticket-embedded-pay-${stamp}.webm`;

/** Fill Stripe Payment Element (nested iframes). Retries once on flake. */
async function fillStripePaymentElement(page) {
  const tryFill = async () => {
    const stripeFrame = page
      .frameLocator('iframe[name^="__privateStripeFrame"]')
      .first();
    const cardNumber = stripeFrame.locator(
      'input[name="number"], input[data-elements-stable-field-name="cardNumber"], [placeholder*="Card number"]',
    );
    await cardNumber.waitFor({ state: 'visible', timeout: 45000 });
    await cardNumber.fill('4242424242424242');
    const expiry = stripeFrame.locator(
      'input[name="expiry"], input[data-elements-stable-field-name="cardExpiry"], [placeholder*="MM"]',
    );
    if ((await expiry.count()) > 0) {
      await expiry.fill('12/34');
    }
    const cvc = stripeFrame.locator(
      'input[name="cvc"], input[data-elements-stable-field-name="cardCvc"], [placeholder*="CVC"]',
    );
    if ((await cvc.count()) > 0) {
      await cvc.fill('123');
    }
    const zip = stripeFrame.locator(
      'input[name="postalCode"], input[data-elements-stable-field-name="postalCode"], [placeholder*="ZIP"]',
    );
    if ((await zip.count()) > 0) {
      await zip.fill('12345');
    }
  };
  try {
    await tryFill();
  } catch {
    await pause(page, 2000);
    await tryFill();
  }
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
  await page
    .locator('#credential-paste')
    .or(page.getByRole('button', { name: 'Config', exact: true }))
    .first()
    .waitFor({ timeout: 15000 });
  await pause(page, 1000);
}

// --- API fixture ---
const organizationId = await seedOrgId();
setOrgStripeReady(organizationId);

await setupActiveMember({ name: hostName, email: hostEmail });
await grantTicketAndPaymentsPermissionsByEmail(hostEmail);
await grantPermissionsByEmail(hostEmail, ['tickets.scan']);

await setupActiveMember({ name: buyerName, email: buyerEmail });

const hostToken = await loginToken(hostEmail, DEMO_PASSWORD);
const buyerToken = await loginToken(buyerEmail, DEMO_PASSWORD);

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

const hostAlloc = await apiJson(`/api/events/${event.id}/allocations`, {
  method: 'POST',
  token: hostToken,
  body: { organizationId, quantity: 5, priceCents: 1000 },
});
const hostAllocId = Array.isArray(hostAlloc) ? hostAlloc[0].id : hostAlloc.id;

await apiJson(`/api/events/${event.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: { ticketSaleStatus: 'on_sale' },
});

const claimed = await apiJson(`/api/events/${event.id}/public-claim`, {
  method: 'POST',
  token: buyerToken,
});
const ticketId = claimed.id;

// --- UI recording ---
const { browser, context, page } = await launchDemo();
try {
  await login(page, buyerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page
    .getByRole('heading', { name: new RegExp(`Hello, ${buyerName}`) })
    .waitFor();
  await pause(page, 1000);

  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'My tickets' }).waitFor();
  await pause(page, 2000);

  const ticketRow = page.locator('li').filter({ hasText: eventName });
  await ticketRow.getByRole('link', { name: 'Pay' }).click();
  await page.waitForURL(new RegExp(`/app/tickets/${ticketId}/pay`), {
    timeout: 15000,
  });
  await page.getByRole('heading', { name: 'Pay for ticket' }).waitFor();
  await pause(page, 2000);

  await page.getByText('$10.00 + $1.00 Rally fee = $11.00').waitFor({
    timeout: 30000,
  });
  await pause(page, 2000);

  await fillStripePaymentElement(page);
  await pause(page, 1500);
  await page.getByRole('button', { name: 'Pay $11.00' }).click();

  await page.getByText('Payment received').waitFor({ timeout: 30000 });
  await pause(page, 2000);

  await page.getByText('Ticket paid').waitFor({ timeout: 45000 });
  await page.getByText('Show this QR at the door').waitFor({ timeout: 15000 });
  await pause(page, 2500);

  let credentialToken = null;
  for (let i = 0; i < 30; i += 1) {
    const mine = await apiJson('/api/tickets/mine', { token: buyerToken });
    const row = mine.find((t) => t.id === ticketId);
    if (row?.status === 'paid' && row.credentialToken) {
      credentialToken = row.credentialToken;
      break;
    }
    await pause(page, 1500);
  }
  if (!credentialToken) {
    throw new Error('Ticket did not flip to paid within poll window');
  }

  await logout(page);
  await login(page, hostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await goToEventTickets(page, event.id);
  await page.getByRole('button', { name: 'Scanner', exact: true }).waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Scanner', exact: true }).click();
  await page.locator('#credential-paste').waitFor({ timeout: 15000 });
  await pause(page, 800);

  await pasteAndCheckIn(page, credentialToken);
  await page.getByText('Checked in', { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
