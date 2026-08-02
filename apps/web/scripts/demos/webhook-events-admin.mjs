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
const out = `webhook-events-admin-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await pause(page, 800);

  await page.goto(`${BASE_URL}/admin/webhook-events`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Webhook events' }).waitFor();
  await pause(page, 2000);

  await page.getByRole('button', { name: 'unprocessed' }).click();
  await pause(page, 2500);

  await page.getByRole('button', { name: 'failed' }).click();
  await pause(page, 2500);

  const reenqueue = page.getByRole('button', { name: 'Re-enqueue' }).first();
  if (await reenqueue.isVisible().catch(() => false)) {
    await reenqueue.click();
    await pause(page, 2000);
  }

  await page.getByRole('button', { name: 'all' }).click();
  await page.locator('table').waitFor({ timeout: 10000 }).catch(() => {});
  await pause(page, 3000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
