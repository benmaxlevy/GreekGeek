import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  UNI_NAME,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const uniName = `Demo Uni CRUD ${stamp}`;
const out = `universities-crud-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/universities`, { waitUntil: 'networkidle' });
  await pause(page, 800);

  await page.getByLabel('Name').fill(uniName);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(uniName, { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  // Attempt delete of seed uni that has orgs → 409
  const seedRow = page.locator('li').filter({ hasText: UNI_NAME }).first();
  await seedRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(/Conflict \(409\)/i).waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
