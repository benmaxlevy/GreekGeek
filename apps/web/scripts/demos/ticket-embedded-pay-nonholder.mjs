import {
  BASE_URL,
  DEMO_PASSWORD,
  apiJson,
  finalizeVideo,
  grantTicketAndPaymentsPermissionsByEmail,
  launchDemo,
  login,
  loginToken,
  pause,
  seedOrgId,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';
import { setOrgStripeReady } from './stripe-demo-fixtures.mjs';

const stamp = ts();
const holderEmail = `demo+embed-pay-holder-${stamp}@rally.local`;
const intruderEmail = `demo+embed-pay-intruder-${stamp}@rally.local`;
const hostEmail = `demo+embed-pay-host-nh-${stamp}@rally.local`;
const holderName = `Embed Pay Holder ${stamp}`;
const intruderName = `Embed Pay Intruder ${stamp}`;
const hostName = `Embed Pay Host NH ${stamp}`;
const eventName = `Non-holder Pay Block ${stamp}`;
const out = `ticket-embedded-pay-nonholder-${stamp}.webm`;

const organizationId = await seedOrgId();
setOrgStripeReady(organizationId);

await setupActiveMember({ name: holderName, email: holderEmail });
await setupActiveMember({ name: intruderName, email: intruderEmail });
await setupActiveMember({ name: hostName, email: hostEmail });
await grantTicketAndPaymentsPermissionsByEmail(hostEmail);

const hostToken = await loginToken(hostEmail, DEMO_PASSWORD);
const holderToken = await loginToken(holderEmail, DEMO_PASSWORD);

const event = await apiJson('/api/events', {
  method: 'POST',
  token: hostToken,
  body: {
    organizationId,
    name: eventName,
    type: 'Formal',
    maxHeadcount: 50,
    location: 'Campus Lawn',
  },
});

await apiJson(`/api/events/${event.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: {
    ticketingEnabled: true,
    ticketCapacity: 10,
    ticketSaleStatus: 'draft',
  },
});

const alloc = await apiJson(`/api/events/${event.id}/allocations`, {
  method: 'POST',
  token: hostToken,
  body: { organizationId, quantity: 5, priceCents: 1000 },
});
const allocId = Array.isArray(alloc) ? alloc[0].id : alloc.id;

await apiJson(`/api/events/${event.id}/ticketing`, {
  method: 'PATCH',
  token: hostToken,
  body: { ticketSaleStatus: 'on_sale' },
});

const holderUser = await apiJson('/api/auth/me', { token: holderToken });
const issued = await apiJson(
  `/api/events/${event.id}/allocations/${allocId}/tickets`,
  {
    method: 'POST',
    token: hostToken,
    body: { holderUserId: holderUser.id },
  },
);
const ticketId = issued.id;

const { browser, context, page } = await launchDemo();
try {
  await login(page, intruderEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await page.goto(`${BASE_URL}/app/tickets/${ticketId}/pay`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('heading', { name: 'Pay for ticket' }).waitFor({
    timeout: 15000,
  });
  await pause(page, 2000);

  await page
    .getByText(/Only the ticket holder can checkout/i)
    .waitFor({ timeout: 20000 });
  await pause(page, 2500);

  const paymentFrameCount = await page
    .locator('iframe[name^="__privateStripeFrame"]')
    .count();
  if (paymentFrameCount > 0) {
    throw new Error('Payment Element should not render for non-holder');
  }
} finally {
  await finalizeVideo(page, context, browser, out);
}
