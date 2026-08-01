import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  findUserRow,
  launchDemo,
  login,
  pause,
  signupCascade,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const email = `demo+deny-${stamp}@rally.local`;
const name = `Deny Demo ${stamp}`;
const out = `admin-deny-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  await signupCascade(page, { name, email, password: DEMO_PASSWORD });
  await pause(page, 800);

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();
  await pause(page, 800);

  const row = await findUserRow(page, email);
  await row.getByRole('button', { name: 'Deny' }).click();
  await pause(page, 1200);

  await page.getByRole('button', { name: 'INACTIVE', exact: true }).click();
  await findUserRow(page, email);
  await pause(page, 1000);

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });

  await login(page, email, DEMO_PASSWORD);
  await page.waitForURL(/\/blocked/, { timeout: 15000 });
  await page.getByText('Account inactive', { exact: true }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
