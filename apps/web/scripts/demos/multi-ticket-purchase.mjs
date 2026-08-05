import { execSync } from 'node:child_process';
import path from 'node:path';
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
  showFlowTitle,
  ts,
} from './demo-helpers.mjs';
import { setOrgStripeReady } from './stripe-demo-fixtures.mjs';

const stamp = ts();
const hostEmail = `demo+multi-tix-host-${stamp}@greekgeek.local`;
const buyerAEmail = `demo+multi-tix-buyer-a-${stamp}@greekgeek.local`;
const buyerBEmail = `demo+multi-tix-buyer-b-${stamp}@greekgeek.local`;
const buyerCEmail = `demo+multi-tix-buyer-c-${stamp}@greekgeek.local`;
const hostName = `Multi Tix Host ${stamp}`;
const buyerAName = `Multi Tix Buyer A ${stamp}`;
const buyerBName = `Multi Tix Buyer B ${stamp}`;
const buyerCName = `Multi Tix Buyer C ${stamp}`;
const eventName = `Multi Ticket Formal ${stamp}`;
const out = `multi-ticket-purchase-${stamp}.webm`;
const POOL_SIZE = 4;
const UNIT_PRICE_CENTS = 1000;
const TOTAL_FOR_TWO_CENTS = 2200; // 2 × $10 + 10% fee

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

async function goToEventScanner(page, eventId, eventNameLabel) {
  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await pause(page, 800);
  const eventRow = page.locator('li').filter({ hasText: eventNameLabel });
  await eventRow.getByRole('link', { name: 'Tickets' }).click();
  await page.waitForURL(new RegExp(`/app/events/${eventId}/tickets`), {
    timeout: 20000,
  });
  await page
    .getByRole('button', { name: 'Scanner', exact: true })
    .waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Scanner', exact: true }).click();
  await page.locator('#credential-paste').waitFor({ timeout: 15000 });
  await pause(page, 800);
}

async function goToBuyPage(page, eventId, eventNameLabel, allocId) {
  const qs = new URLSearchParams({
    eventId,
    eventName: eventNameLabel,
  });
  await page.goto(`${BASE_URL}/app/tickets/buy/${allocId}?${qs.toString()}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/\/app\/tickets\/buy\//, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Buy tickets' }).waitFor();
  await pause(page, 1500);
}

async function setQuantityAndContinue(page, qty) {
  await page.locator('#ticket-qty').fill(String(qty));
  await pause(page, 800);
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page
    .getByRole('button', { name: new RegExp(`Pay \\$${(TOTAL_FOR_TWO_CENTS / 100).toFixed(2)}`) })
    .or(page.getByRole('button', { name: /Pay \$[\d.]+/ }))
    .first()
    .waitFor({ timeout: 30000 });
  await pause(page, 2000);
}

async function pollPaidCredentialTokens(buyerToken, ticketIds) {
  const tokens = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mine = await apiJson('/api/tickets/mine', { token: buyerToken });
    const paid = mine.filter(
      (t) => ticketIds.includes(t.id) && t.status === 'paid' && t.credentialToken,
    );
    if (paid.length >= ticketIds.length) {
      return paid.map((t) => t.credentialToken);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Tickets did not flip to paid within poll window');
}

async function findOpenPurchaseId(buyerToken) {
  const mine = await apiJson('/api/tickets/mine', { token: buyerToken });
  const held = mine.filter((t) => t.status === 'unpaid' && t.purchaseId);
  if (!held.length) throw new Error('No open purchase hold found for buyer');
  return held[0].purchaseId;
}

function expirePurchaseAndSweep(purchaseId) {
  const script = path.resolve(
    '/root/greekgeek/greekgeek/apps/api/scripts/demo-ttl-sweep-once.mjs',
  );
  execSync(`node ${script} ${purchaseId}`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `/root/.nvm/versions/node/v22.21.1/bin:${process.env.PATH ?? ''}`,
    },
  });
}

// --- API fixture ---
const organizationId = await seedOrgId();
setOrgStripeReady(organizationId);

await setupActiveMember({ name: hostName, email: hostEmail });
await grantTicketAndPaymentsPermissionsByEmail(hostEmail);
await grantPermissionsByEmail(hostEmail, ['tickets.scan']);

await setupActiveMember({ name: buyerAName, email: buyerAEmail });
await setupActiveMember({ name: buyerBName, email: buyerBEmail });
await setupActiveMember({ name: buyerCName, email: buyerCEmail });

const hostToken = await loginToken(hostEmail, DEMO_PASSWORD);
const buyerAToken = await loginToken(buyerAEmail, DEMO_PASSWORD);
const buyerBToken = await loginToken(buyerBEmail, DEMO_PASSWORD);
const buyerCToken = await loginToken(buyerCEmail, DEMO_PASSWORD);

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
    ticketCapacity: POOL_SIZE,
    ticketSaleStatus: 'draft',
  },
});

const publicAlloc = await apiJson(`/api/events/${event.id}/allocations`, {
  method: 'POST',
  token: hostToken,
  body: {
    organizationId: null,
    quantity: POOL_SIZE,
    priceCents: UNIT_PRICE_CENTS,
  },
});
const allocationId = Array.isArray(publicAlloc)
  ? publicAlloc[0].id
  : publicAlloc.id;

await apiJson(`/api/events/${event.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: { ticketSaleStatus: 'on_sale' },
});

// --- UI recording ---
const { browser, context, page } = await launchDemo();
let ticketIds = [];
try {
  await showFlowTitle(page, 'Buy 2 + scan');

  // Buyer A: purchase 2 tickets in one checkout
  await login(page, buyerAEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page
    .getByRole('heading', { name: new RegExp(`Hello, ${buyerAName}`) })
    .waitFor();
  await pause(page, 1000);

  await goToBuyPage(page, event.id, eventName, allocationId);
  await setQuantityAndContinue(page, 2);

  await page.getByText('2 × $10.00 = $20.00').waitFor({ timeout: 15000 });
  await pause(page, 1500);

  await fillStripePaymentElement(page);
  await pause(page, 1500);
  await page
    .getByRole('button', { name: `Pay $${(TOTAL_FOR_TWO_CENTS / 100).toFixed(2)}` })
    .click();

  await page.getByText('Payment received').waitFor({ timeout: 30000 });
  await pause(page, 1500);

  // Webhook settle — UI success or API poll fallback
  const paidUi = page.getByText('2 tickets paid');
  const pollTimeout = page.getByText('Payment is still processing');
  await Promise.race([
    paidUi.waitFor({ timeout: 60000 }),
    pollTimeout.waitFor({ timeout: 60000 }),
  ]).catch(() => {});

  let ticketIdsFromApi = [];
  for (let i = 0; i < 40; i += 1) {
    const mine = await apiJson('/api/tickets/mine', { token: buyerAToken });
    const paid = mine.filter((t) => t.eventId === event.id && t.status === 'paid');
    if (paid.length >= 2) {
      ticketIdsFromApi = paid.map((t) => t.id);
      break;
    }
    await pause(page, 1500);
  }
  if (ticketIdsFromApi.length < 2) {
    throw new Error('Expected 2 paid tickets after payment');
  }
  ticketIds = ticketIdsFromApi;

  if ((await paidUi.count()) > 0 && (await paidUi.isVisible())) {
    await page.getByText('Ticket 1 of 2').waitFor({ timeout: 10000 });
    await page.getByText('Ticket 2 of 2').waitFor({ timeout: 10000 });
    await pause(page, 2500);
  } else {
    await page.goto(`${BASE_URL}/app/tickets`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'My tickets' }).waitFor();
    const rows = page.locator('li').filter({ hasText: eventName });
    await rows.first().click();
    await pause(page, 2000);
  }

  const credentialTokens = await pollPaidCredentialTokens(buyerAToken, ticketIds);

  // Host scans both QRs
  await logout(page);
  await login(page, hostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await goToEventScanner(page, event.id, eventName);

  for (const token of credentialTokens) {
    await pasteAndCheckIn(page, token);
    await page.getByText('Checked in', { exact: true }).waitFor({ timeout: 15000 });
    await pause(page, 2000);
  }

  // --- Abandon + release segment ---
  await showFlowTitle(page, 'Abandon + release');

  await logout(page);
  await login(page, buyerBEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await goToBuyPage(page, event.id, eventName, allocationId);
  await setQuantityAndContinue(page, 2);
  await page.getByText('2 × $10.00 = $20.00').waitFor({ timeout: 15000 });
  await pause(page, 1500);

  // Abandon: leave payment screen without paying
  await page.getByRole('link', { name: '← My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await pause(page, 2000);

  const openPurchaseId = await findOpenPurchaseId(buyerBToken);
  const bHeld = await apiJson('/api/tickets/mine', { token: buyerBToken });
  const bUnpaid = bHeld.filter((t) => t.status === 'unpaid' && t.eventId === event.id);
  if (bUnpaid.length < 2) {
    throw new Error(`Buyer B should hold 2 unpaid tickets, got ${bUnpaid.length}`);
  }

  // Buyer C blocked while seats held
  await logout(page);
  await login(page, buyerCEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await goToBuyPage(page, event.id, eventName, allocationId);
  await pause(page, 2500);

  const noAvail = page.getByText('No tickets available to buy');
  const zeroLeft = page.getByText('0 left in pool');
  if ((await noAvail.count()) > 0 && (await noAvail.isVisible())) {
    await noAvail.waitFor({ timeout: 10000 });
  } else if ((await zeroLeft.count()) > 0 && (await zeroLeft.isVisible())) {
    await zeroLeft.waitFor({ timeout: 10000 });
  } else {
    await page.locator('#ticket-qty').fill('2');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page
      .getByText(
        /Failed to start checkout|remaining capacity|exceeds remaining|No tickets available/i,
      )
      .first()
      .waitFor({ timeout: 20000 });
  }
  await pause(page, 2500);

  // TTL sweep: backdate purchase + run worker sweep once (not 5 min wait)
  await showFlowTitle(page, 'TTL sweep');
  expirePurchaseAndSweep(openPurchaseId);

  // Seats freed — buyer C can buy again
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Buy tickets' }).waitFor({ timeout: 15000 });
  await page.getByText(/2 left in pool|Up to 2 for this event/).waitFor({
    timeout: 15000,
  });
  await pause(page, 2000);

  await page.locator('#ticket-qty').fill('1');
  await pause(page, 800);
  await page
    .getByText(/1 × \$10\.00|Continue to payment/)
    .first()
    .waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Continue to payment' }).waitFor({
    timeout: 10000,
  });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}

console.log('Accounts:', {
  host: hostEmail,
  buyerA: buyerAEmail,
  buyerB: buyerBEmail,
  buyerC: buyerCEmail,
  event: eventName,
  allocationId,
});
