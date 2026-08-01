import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const eventName = `Admin Formal ${stamp}`;
const eventNameUpdated = `${eventName} Updated`;
const out = `admin-events-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await pause(page, 800);

  await page.goto(`${BASE_URL}/admin/events`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Events' }).waitFor();
  await pause(page, 1000);

  await page.getByLabel('Organization', { exact: true }).selectOption({
    label: 'Alpha Demo Fraternity (FRATERNITY)',
  });
  await page.getByLabel('Event name').fill(eventName);
  await page.getByLabel('Event type').fill('Fraternity Formal');
  await page.getByLabel('Max headcount').fill('100');
  await page.getByLabel('Location (optional)').fill('Nashville');
  await pause(page, 600);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  const row = page.locator('li').filter({ hasText: eventName });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#admin-edit-event-name').fill(eventNameUpdated);
  await pause(page, 600);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText(eventNameUpdated).waitFor({ timeout: 15000 });
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
