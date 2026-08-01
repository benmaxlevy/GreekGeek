import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin@rally.local';
const ADMIN_PASSWORD = 'RallyAdmin123!';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

async function signupPending(page: Page, email: string, password: string, name: string) {
  await page.goto('/signup');
  await expect(page.locator('body')).toHaveClass(/rally-theme/);
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  // CardTitle is a div, not a heading role.
  await expect(page.getByText('Awaiting approval', { exact: true })).toBeVisible();
  await expect(page.getByText(/awaits admin approval|pending admin review|must approve/i)).toBeVisible();
  await expect(page).not.toHaveURL(/\/app\/?$/);
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function adminLogin(page: Page) {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/app\/?$/);
}

async function loginApi(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

test.describe('auth status flows', () => {
  test('register shows pending message; no authenticated home access', async ({ page }) => {
    const email = uniqueEmail('e2e-pending');
    const password = 'Password123!';
    await signupPending(page, email, password, 'Pending User');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login\/?$/);
  });

  test('pending login lands on awaiting-approval; cannot reach app', async ({ page }) => {
    const email = uniqueEmail('e2e-await');
    const password = 'Password123!';
    const name = 'Await User';
    await signupPending(page, email, password, name);

    await page.getByRole('link', { name: 'Go to log in' }).click();
    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/awaiting-approval\/?$/);
    await expect(page.getByText('Awaiting approval', { exact: true })).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    await page.goto('/app');
    await expect(page).toHaveURL(/\/awaiting-approval\/?$/);
  });

  test('admin hard refresh and signed-out redirect still work for ACTIVE', async ({ page }) => {
    await adminLogin(page);
    await page.reload();
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: /Hello,/ })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login\/?$/);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/login\/?$/);
  });
});

test.describe('admin approval and org flows', () => {
  test('admin fill activates pending user to app', async ({ page, request }) => {
    const email = uniqueEmail('e2e-fill');
    const password = 'Password123!';
    const name = 'Fill User';
    await signupPending(page, email, password, name);

    await adminLogin(page);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await page.getByRole('button', { name: 'PENDING' }).click();
    await expect(page.getByText(email)).toBeVisible();

    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Fill' }).click();
    await page.locator('#organizationId').selectOption({ label: 'Alpha Demo Fraternity (FRATERNITY)' });
    await page.getByRole('button', { name: 'Activate with org' }).click();
    await expect(page.getByText(email)).toHaveCount(0);

    await page.getByRole('button', { name: 'Log out' }).click();
    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();

    const token = await loginApi(request, email, password);
    const me = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status()).toBe(200);
    expect((await me.json()).status).toBe('ACTIVE');
  });

  test('admin kill then inactive blocked; reactivate restores access', async ({ page }) => {
    const email = uniqueEmail('e2e-kill');
    const password = 'Password123!';
    const name = 'Kill User';
    await signupPending(page, email, password, name);

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();
    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Kill' }).click();
    await expect(page.getByText(email)).toHaveCount(0);

    await page.getByRole('button', { name: 'Log out' }).click();
    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/blocked\/?$/);
    await expect(page.getByText('Account inactive', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'INACTIVE' }).click();
    const inactiveRow = page.locator('li').filter({ hasText: email });
    await inactiveRow.getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText(email)).toHaveCount(0);

    await page.getByRole('button', { name: 'Log out' }).click();
    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
  });

  test('admin university and organization create smoke', async ({ page }) => {
    const uniName = `E2E Uni ${Date.now()}`;
    const orgName = `E2E Org ${Date.now()}`;

    await adminLogin(page);
    await page.goto('/admin/universities');
    await page.getByLabel('Name').fill(uniName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(uniName)).toBeVisible();

    await page.goto('/admin/organizations');
    await page.locator('#org-name').fill(orgName);
    await page.locator('#org-type').selectOption('SORORITY');
    await page.locator('#org-uni').selectOption({ label: uniName });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(orgName)).toBeVisible();
  });

  test('membership assign and duplicate rejected; permission grant', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('e2e-member');
    const password = 'Password123!';
    const name = 'Member User';
    await signupPending(page, email, password, name);

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();
    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Fill' }).click();
    await page.locator('#organizationId').selectOption({ label: 'Alpha Demo Fraternity (FRATERNITY)' });
    await page.getByRole('button', { name: 'Activate with org' }).click();

    await page.goto('/admin/memberships');
    await expect(page.getByText(email)).toBeVisible();

    const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const orgs = await request.get('/api/organizations', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const orgList = (await orgs.json()) as Array<{ id: string; name: string }>;
    const org = orgList.find((o) => o.name === 'Alpha Demo Fraternity');
    expect(org).toBeTruthy();

    const users = await request.get('/api/admin/users?status=ACTIVE', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userList = (await users.json()) as Array<{ id: string; email: string }>;
    const user = userList.find((u) => u.email === email);
    expect(user).toBeTruthy();

    const dup = await request.post('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { userId: user!.id, organizationId: org!.id },
    });
    expect(dup.status()).toBeGreaterThanOrEqual(400);

    const memberships = await request.get('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const membershipList = (await memberships.json()) as Array<{
      id: string;
      userId: string;
    }>;
    const membership = membershipList.find((m) => m.userId === user!.id);
    expect(membership).toBeTruthy();

    await page.goto('/admin/permissions');
    await expect(page.getByText('members.manage_permissions')).toBeVisible();
    await page.locator('#perm-membership').selectOption({ label: new RegExp(name) });
    await page.locator('#perm-key').selectOption('events.create');
    await page.getByRole('button', { name: 'Grant' }).click();
    await expect(page.getByText('events.create').first()).toBeVisible();

    const grants = await request.get(`/api/memberships/${membership!.id}/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const grantList = (await grants.json()) as Array<{ permissionKey: string }>;
    expect(grantList.some((g) => g.permissionKey === 'events.create')).toBeTruthy();
  });

  test('non-admin university CRUD forbidden', async ({ page, request }) => {
    const email = uniqueEmail('e2e-nonadmin');
    const password = 'Password123!';
    await signupPending(page, email, password, 'Non Admin');

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();
    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Fill' }).click();
    await page.locator('#organizationId').selectOption({ label: 'Alpha Demo Fraternity (FRATERNITY)' });
    await page.getByRole('button', { name: 'Activate with org' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();

    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/app\/?$/);

    const token = await loginApi(request, email, password);
    const res = await request.post('/api/universities', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Should Fail Uni' },
    });
    expect(res.status()).toBe(403);
  });
});
