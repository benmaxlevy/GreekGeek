import {
  DEMO_PASSWORD,
  finalizeVideo,
  grantTicketPermissionsByEmail,
  launchDemo,
  login,
  pause,
  setupActiveMember,
  setupOnSalePublicEvent,
  signupWithoutOrg,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const fixtureHostEmail = `demo+ticket-fixture-${stamp}@rally.local`;
const guestEmail = `demo+ticket-guest-${stamp}@rally.local`;
const guestName = `Ticket Guest ${stamp}`;
const eventName = `Public Gala ${stamp}`;
const out = `ticketing-guest-claim-${stamp}.webm`;

await setupActiveMember({
  name: `Fixture Host ${stamp}`,
  email: fixtureHostEmail,
});
await grantTicketPermissionsByEmail(fixtureHostEmail);
await setupOnSalePublicEvent({
  hostEmail: fixtureHostEmail,
  eventName,
  publicQty: 10,
});

const { browser, context, page } = await launchDemo();
try {
  await signupWithoutOrg(page, {
    name: guestName,
    email: guestEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 1000);

  await login(page, guestEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${guestName}`) }).waitFor();
  await pause(page, 800);

  await page.getByRole('link', { name: 'My tickets' }).click();
  await page.waitForURL(/\/app\/tickets/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'My tickets' }).waitFor();
  await pause(page, 1000);

  const claimRow = page.locator('li').filter({ hasText: eventName });
  await claimRow.getByRole('button', { name: 'Claim ticket' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByText('paid').waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
