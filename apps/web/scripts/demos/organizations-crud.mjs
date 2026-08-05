import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  DEMO_PASSWORD,
  UNI_NAME,
  adminToken,
  apiJson,
  apiSignup,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const orgName = `Beta Demo Org ${stamp}`;
const memberEmail = `demo+orgcrud-${stamp}@greekgeek.local`;
const out = `organizations-crud-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/organizations`, { waitUntil: 'networkidle' });
  await pause(page, 800);

  await page.getByLabel('Name', { exact: true }).fill(orgName);
  await page.getByLabel('Type').selectOption('FRATERNITY');
  await page.locator('#org-uni').selectOption({ label: UNI_NAME });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(orgName, { exact: true }).waitFor({ timeout: 15000 });
  await pause(page, 1200);

  // Off-camera: create membership on this org so delete returns 409
  const token = await adminToken();
  const orgs = await apiJson('/api/organizations?universityId=seed-university-demo', { token });
  const created = orgs.find((o) => o.name === orgName);
  if (!created) throw new Error('Created org not found via API');
  await apiSignup({
    name: `Org CRUD Member ${stamp}`,
    email: memberEmail,
    password: DEMO_PASSWORD,
    organizationId: created.id,
  });
  const users = await apiJson('/api/admin/users?status=PENDING', { token });
  const pending = users.find((u) => u.email === memberEmail);
  if (!pending) throw new Error('Pending member missing');
  await apiJson(`/api/admin/users/${pending.id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'ACTIVE', organizationId: created.id },
  });

  // Visible 409 on delete
  const row = page.locator('li').filter({ hasText: orgName }).first();
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(/Conflict \(409\)/i).waitFor({ timeout: 15000 });
  await pause(page, 2500);
} finally {
  await finalizeVideo(page, context, browser, out);
}
