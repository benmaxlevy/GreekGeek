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
} from './phase3-helpers.mjs';

const stamp = ts();
const email = `demo+reactivate-${stamp}@rally.local`;
const name = `Reactivate Demo ${stamp}`;
const out = `reactivate-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  // Signup → approve → deactivate → blocked → reactivate → app
  await signupCascade(page, { name, email, password: DEMO_PASSWORD });
  await pause(page, 600);

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();

  let row = await findUserRow(page, email);
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Activate with org' }).click();
  await pause(page, 1000);

  await page.getByRole('button', { name: 'ACTIVE', exact: true }).click();
  row = await findUserRow(page, email);
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await pause(page, 1000);

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });

  await login(page, email, DEMO_PASSWORD);
  await page.waitForURL(/\/blocked/, { timeout: 15000 });
  await page.getByText('Account inactive', { exact: true }).waitFor();
  await pause(page, 1200);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'INACTIVE', exact: true }).click();
  row = await findUserRow(page, email);
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await pause(page, 1200);

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });

  await login(page, email, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${name}`) }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
