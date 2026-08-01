import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  DEMO_PASSWORD,
  ORG_LABEL,
  finalizeVideo,
  findUserRow,
  launchDemo,
  login,
  pause,
  signupCascade,
  ts,
} from './phase3-helpers.mjs';

const stamp = ts();
const email = `demo+perms-${stamp}@rally.local`;
const name = `Perms Demo ${stamp}`;
const out = `memberships-permissions-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  // Pending → deny → reactivate (ACTIVE, no membership) → assign → grant → revoke
  await signupCascade(page, { name, email, password: DEMO_PASSWORD });
  await pause(page, 600);

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PENDING', exact: true }).click();

  let row = await findUserRow(page, email);
  await row.getByRole('button', { name: 'Deny' }).click();
  await pause(page, 800);
  await page.getByRole('button', { name: 'INACTIVE', exact: true }).click();
  row = await findUserRow(page, email);
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await pause(page, 1000);

  await page.goto(`${BASE_URL}/admin/memberships`, { waitUntil: 'networkidle' });
  await pause(page, 800);
  await page.getByLabel('User').selectOption({ label: `${name} (${email})` });
  // Organization option text: "Alpha Demo Fraternity · Demo State University"
  const orgSelect = page.getByLabel('Organization');
  const orgValue = await orgSelect.evaluate((sel) => {
    const opt = [...sel.options].find((o) => o.text.includes('Alpha Demo Fraternity'));
    return opt?.value ?? '';
  });
  if (!orgValue) throw new Error('Alpha org option missing');
  await orgSelect.selectOption(orgValue);
  await page.getByRole('button', { name: 'Assign' }).click();
  await page.getByText(email).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  await page.goto(`${BASE_URL}/admin/permissions`, { waitUntil: 'networkidle' });
  await pause(page, 800);
  const memSelect = page.getByLabel('ACTIVE membership');
  const memValue = await memSelect.evaluate((sel, n) => {
    const opt = [...sel.options].find((o) => o.text.includes(n));
    return opt?.value ?? '';
  }, name);
  if (!memValue) throw new Error('Membership option missing');
  await memSelect.selectOption(memValue);
  await pause(page, 600);
  await page.getByLabel('Grant permission').selectOption('events.create');
  await page.getByRole('button', { name: 'Grant' }).click();
  const grantRow = page
    .locator('ul li')
    .filter({ has: page.getByRole('button', { name: 'Revoke' }) })
    .filter({ hasText: 'events.create' });
  await grantRow.first().waitFor({ timeout: 15000 });
  await pause(page, 1200);

  await grantRow.first().getByRole('button', { name: 'Revoke' }).click();
  await pause(page, 1500);
  await page.getByText('No grants on this membership.').waitFor({ timeout: 15000 });
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
