import {
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const email = `demo+events-${stamp}@greekgeek.local`;
const name = `Events Member ${stamp}`;
const eventName = `Member Party ${stamp}`;
const eventNameUpdated = `${eventName} Updated`;
const out = `member-events-${stamp}.webm`;

await setupActiveMember({ name, email, grantEventPerms: true });

const { browser, context, page } = await launchDemo();
try {
  await login(page, email, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${name}`) }).waitFor();
  await pause(page, 800);

  const eventsLink = page.getByRole('link', { name: 'Events' });
  await eventsLink.waitFor({ timeout: 10000 });
  await pause(page, 800);
  await eventsLink.click();
  await page.waitForURL(/\/app\/events/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Events' }).waitFor();
  await pause(page, 1000);

  await page.getByLabel('Event name').fill(eventName);
  await page.getByLabel('Event type').fill('Date Party');
  await page.getByLabel('Max headcount').fill('40');
  await page.getByLabel('Location (optional)').fill('Chapter House');
  await pause(page, 600);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  const row = page.locator('li').filter({ hasText: eventName });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#edit-event-name').fill(eventNameUpdated);
  await pause(page, 600);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText(eventNameUpdated).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  const updatedRow = page.locator('li').filter({ hasText: eventNameUpdated });
  await updatedRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(eventNameUpdated).waitFor({ state: 'detached', timeout: 15000 });
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
