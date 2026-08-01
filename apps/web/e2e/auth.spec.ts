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
  await page.locator('#universityId').selectOption({ label: 'Demo State University' });
  await expect(
    page.locator('#organizationId option', { hasText: 'Alpha Demo Fraternity' }),
  ).toHaveCount(1, { timeout: 15_000 });
  await page.locator('#organizationId').selectOption({ label: 'Alpha Demo Fraternity (FRATERNITY)' });
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText(/awaits admin approval|pending admin review|must approve/i)).toBeVisible();
  await expect(page).not.toHaveURL(/\/app\/?$/);
}

async function signupWithoutOrg(page: Page, email: string, password: string, name: string) {
  await page.goto('/signup');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText(/ready to sign in|sign in now/i)).toBeVisible();
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).not.toHaveURL(/\/login\/?$/);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
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
  test('register with uni/org shows pending; no authenticated home access', async ({ page }) => {
    const email = uniqueEmail('e2e-pending');
    const password = 'Password123!';
    await signupPending(page, email, password, 'Pending User');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login\/?$/);
  });

  test('public university and organization lists work without auth', async ({ request }) => {
    const unis = await request.get('/api/universities');
    expect(unis.status()).toBe(200);
    const uniList = (await unis.json()) as Array<{ id: string; name: string }>;
    const demoUni = uniList.find((u) => u.name === 'Demo State University');
    expect(demoUni).toBeTruthy();

    const orgs = await request.get(`/api/organizations?universityId=${demoUni!.id}`);
    expect(orgs.status()).toBe(200);
    const orgList = (await orgs.json()) as Array<{ id: string; name: string }>;
    expect(orgList.some((o) => o.name === 'Alpha Demo Fraternity')).toBeTruthy();
  });

  test('org-less signup login reaches app as active without membership', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('e2e-orgless');
    const password = 'Password123!';
    const name = 'Orgless User';
    await signupWithoutOrg(page, email, password, name);
    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();

    const token = await loginApi(request, email, password);
    const me = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status()).toBe(200);
    const body = (await me.json()) as { status: string; membership: unknown };
    expect(body.status).toBe('ACTIVE');
    expect(body.membership).toBeNull();
  });

  test('pending login lands on awaiting-approval; cannot reach app', async ({ page }) => {
    const email = uniqueEmail('e2e-await');
    const password = 'Password123!';
    const name = 'Await User';
    await signupPending(page, email, password, name);

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
  test('admin approve activates pending user to app', async ({ page, request }) => {
    const email = uniqueEmail('e2e-approve');
    const password = 'Password123!';
    const name = 'Approve User';
    await signupPending(page, email, password, name);

    await adminLogin(page);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await page.getByRole('button', { name: 'PENDING' }).click();
    await expect(page.getByText(email)).toBeVisible();

    const row = page.locator('li').filter({ hasText: email });
    await expect(row.getByText(/Requested:.*Alpha Demo Fraternity/)).toBeVisible();
    await row.getByRole('button', { name: 'Approve' }).click();
    // Prefills requested org — confirm without override.
    await expect(page.locator('#organizationId')).toHaveValue(/.+/);
    await expect(page.locator('form').getByText(/Requested:.*Alpha Demo Fraternity/)).toBeVisible();
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

  test('admin deny then inactive blocked; reactivate restores access', async ({ page }) => {
    const email = uniqueEmail('e2e-deny');
    const password = 'Password123!';
    const name = 'Deny User';
    await signupPending(page, email, password, name);

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();
    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Deny' }).click();
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
    await row.getByRole('button', { name: 'Approve' }).click();
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

    // Re-assign same user: API atomically replaces; still one membership per user.
    const reassign = await request.post('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { userId: user!.id, organizationId: org!.id },
    });
    expect(reassign.ok()).toBeTruthy();

    const memberships = await request.get('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const membershipList = (await memberships.json()) as Array<{
      id: string;
      userId: string;
    }>;
    const forUser = membershipList.filter((m) => m.userId === user!.id);
    expect(forUser).toHaveLength(1);
    const membership = forUser[0];

    await page.goto('/admin/permissions');
    await expect(page.getByText('members.manage_permissions')).toBeVisible();
    await page.locator('#perm-membership').selectOption({ label: `${name} · Alpha Demo Fraternity` });
    await page.locator('#perm-key').selectOption('events.create');
    await page.getByRole('button', { name: 'Grant' }).click();
    await expect(
      page.locator('li').filter({ hasText: 'events.create' }).getByRole('button', { name: 'Revoke' }),
    ).toBeVisible();

    const grants = await request.get(`/api/memberships/${membership.id}/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const grantList = (await grants.json()) as Array<{ permissionKey: string }>;
    expect(grantList.some((g) => g.permissionKey === 'events.create')).toBeTruthy();
  });

  test('non-admin university CRUD forbidden; member without manage perm grant 403', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('e2e-nonadmin');
    const password = 'Password123!';
    const name = 'Non Admin';
    await signupPending(page, email, password, name);

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();
    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Approve' }).click();
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

    const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const users = await request.get('/api/admin/users?status=ACTIVE', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userList = (await users.json()) as Array<{ id: string; email: string }>;
    const user = userList.find((u) => u.email === email);
    expect(user).toBeTruthy();

    const memberships = await request.get('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const membershipList = (await memberships.json()) as Array<{
      id: string;
      userId: string;
    }>;
    const membership = membershipList.find((m) => m.userId === user!.id);
    expect(membership).toBeTruthy();

    const grantDenied = await request.post(`/api/memberships/${membership!.id}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { permissionKey: 'events.create' },
    });
    expect(grantDenied.status()).toBe(403);
  });

  test('delegated members.manage_permissions grants in own org', async ({ page, request }) => {
    const managerEmail = uniqueEmail('e2e-mgr');
    const targetEmail = uniqueEmail('e2e-tgt');
    const password = 'Password123!';
    const managerName = 'Delegated Manager';
    const targetName = 'Grant Target';

    await signupPending(page, managerEmail, password, managerName);
    await signupPending(page, targetEmail, password, targetName);

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();

    for (const email of [managerEmail, targetEmail]) {
      const row = page.locator('li').filter({ hasText: email });
      await row.getByRole('button', { name: 'Approve' }).click();
      await page.getByRole('button', { name: 'Activate with org' }).click();
      await expect(page.getByText(email)).toHaveCount(0);
    }

    const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const users = await request.get('/api/admin/users?status=ACTIVE', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userList = (await users.json()) as Array<{ id: string; email: string }>;
    const managerUser = userList.find((u) => u.email === managerEmail);
    const targetUser = userList.find((u) => u.email === targetEmail);
    expect(managerUser).toBeTruthy();
    expect(targetUser).toBeTruthy();

    const memberships = await request.get('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const membershipList = (await memberships.json()) as Array<{
      id: string;
      userId: string;
    }>;
    const managerMembership = membershipList.find((m) => m.userId === managerUser!.id);
    const targetMembership = membershipList.find((m) => m.userId === targetUser!.id);
    expect(managerMembership).toBeTruthy();
    expect(targetMembership).toBeTruthy();

    const adminGrant = await request.post(
      `/api/memberships/${managerMembership!.id}/permissions`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { permissionKey: 'members.manage_permissions' },
      },
    );
    expect(adminGrant.ok()).toBeTruthy();

    const managerToken = await loginApi(request, managerEmail, password);
    const delegatedGrant = await request.post(
      `/api/memberships/${targetMembership!.id}/permissions`,
      {
        headers: { Authorization: `Bearer ${managerToken}` },
        data: { permissionKey: 'events.create' },
      },
    );
    expect(delegatedGrant.ok()).toBeTruthy();

    const grants = await request.get(`/api/memberships/${targetMembership!.id}/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const grantList = (await grants.json()) as Array<{ permissionKey: string }>;
    expect(grantList.some((g) => g.permissionKey === 'events.create')).toBeTruthy();
  });

  test('university and organization delete with dependents returns 409', async ({
    page,
    request,
  }) => {
    const uniName = `E2E 409 Uni ${Date.now()}`;
    const orgName = `E2E 409 Org ${Date.now()}`;
    const email = uniqueEmail('e2e-409');
    const password = 'Password123!';

    await adminLogin(page);
    await page.goto('/admin/universities');
    await page.getByLabel('Name').fill(uniName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(uniName)).toBeVisible();

    await page.goto('/admin/organizations');
    await page.locator('#org-name').fill(orgName);
    await page.locator('#org-type').selectOption('FRATERNITY');
    await page.locator('#org-uni').selectOption({ label: uniName });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(orgName)).toBeVisible();

    const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const unis = await request.get('/api/universities', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const uniList = (await unis.json()) as Array<{ id: string; name: string }>;
    const uni = uniList.find((u) => u.name === uniName);
    expect(uni).toBeTruthy();

    const uniDelete = await request.delete(`/api/universities/${uni!.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(uniDelete.status()).toBe(409);

    const orgs = await request.get(`/api/organizations?universityId=${uni!.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const orgList = (await orgs.json()) as Array<{ id: string; name: string }>;
    const org = orgList.find((o) => o.name === orgName);
    expect(org).toBeTruthy();

    await page.goto('/signup');
    await page.getByLabel('Name').fill('Conflict User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.locator('#universityId').selectOption({ label: uniName });
    await expect(page.locator('#organizationId option', { hasText: orgName })).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator('#organizationId').selectOption({ label: `${orgName} (FRATERNITY)` });
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.getByText(/awaits admin approval|pending admin review|must approve/i)).toBeVisible();

    await adminLogin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'PENDING' }).click();
    const row = page.locator('li').filter({ hasText: email });
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('button', { name: 'Activate with org' }).click();
    await expect(page.getByText(email)).toHaveCount(0);

    const orgDelete = await request.delete(`/api/organizations/${org!.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(orgDelete.status()).toBe(409);
  });
});

async function adminApprovePendingByEmail(page: Page, email: string) {
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'PENDING' }).click();
  const row = page.locator('li').filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Activate with org' }).click();
  await expect(page.getByText(email)).toHaveCount(0);
}

async function grantManagePermissions(
  request: APIRequestContext,
  userEmail: string,
) {
  const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const users = await request.get('/api/admin/users?status=ACTIVE', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const userList = (await users.json()) as Array<{ id: string; email: string }>;
  const user = userList.find((u) => u.email === userEmail);
  expect(user).toBeTruthy();

  const memberships = await request.get('/api/memberships', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const membershipList = (await memberships.json()) as Array<{
    id: string;
    userId: string;
  }>;
  const membership = membershipList.find((m) => m.userId === user!.id);
  expect(membership).toBeTruthy();

  const grant = await request.post(`/api/memberships/${membership!.id}/permissions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { permissionKey: 'members.manage_permissions' },
  });
  expect(grant.ok()).toBeTruthy();
}

test.describe('officer pending approvals at /users', () => {
  test('officer approves applicant via /users; applicant reaches app', async ({
    page,
    request,
  }) => {
    const officerEmail = uniqueEmail('e2e-off-appr');
    const applicantEmail = uniqueEmail('e2e-off-appl');
    const password = 'Password123!';
    const officerName = 'Officer Approver';
    const applicantName = 'Officer Applicant';

    await signupPending(page, officerEmail, password, officerName);
    await signupPending(page, applicantEmail, password, applicantName);

    await adminLogin(page);
    await adminApprovePendingByEmail(page, officerEmail);
    await grantManagePermissions(request, officerEmail);
    await logout(page);

    await loginAs(page, officerEmail, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('link', { name: 'Pending approvals' })).toBeVisible();
    await page.getByRole('link', { name: 'Pending approvals' }).click();
    await expect(page).toHaveURL(/\/users\/?$/);
    await expect(page.getByRole('heading', { name: 'Pending approvals' })).toBeVisible();
    await expect(page.getByText(applicantEmail)).toBeVisible();

    const row = page.locator('li').filter({ hasText: applicantEmail });
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(applicantEmail)).toHaveCount(0);

    await logout(page);
    await loginAs(page, applicantEmail, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: `Hello, ${applicantName}` })).toBeVisible();
  });

  test('officer denies applicant via /users; applicant blocked', async ({ page, request }) => {
    const officerEmail = uniqueEmail('e2e-off-deny');
    const applicantEmail = uniqueEmail('e2e-off-denyd');
    const password = 'Password123!';

    await signupPending(page, officerEmail, password, 'Officer Denier');
    await signupPending(page, applicantEmail, password, 'Denied Applicant');

    await adminLogin(page);
    await adminApprovePendingByEmail(page, officerEmail);
    await grantManagePermissions(request, officerEmail);
    await logout(page);

    await loginAs(page, officerEmail, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Pending approvals' })).toBeVisible();
    await expect(page.getByText(applicantEmail)).toBeVisible();
    const row = page.locator('li').filter({ hasText: applicantEmail });
    await row.getByRole('button', { name: 'Deny' }).click();
    await expect(page.getByText(applicantEmail)).toHaveCount(0);

    await logout(page);
    await loginAs(page, applicantEmail, password);
    await expect(page).toHaveURL(/\/blocked\/?$/);
  });

  test('member without permission redirected from /users; no nav link', async ({
    page,
    request,
  }) => {
    const memberEmail = uniqueEmail('e2e-off-noperm');
    const password = 'Password123!';

    await signupPending(page, memberEmail, password, 'No Perm Member');
    await adminLogin(page);
    await adminApprovePendingByEmail(page, memberEmail);
    await logout(page);

    await loginAs(page, memberEmail, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('link', { name: 'Pending approvals' })).toHaveCount(0);

    await page.goto('/users');
    await expect(page).toHaveURL(/\/app\/?$/);

    const token = await loginApi(request, memberEmail, password);
    const me = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await me.json()) as { permissions: string[] };
    expect(body.permissions.includes('members.manage_permissions')).toBeFalsy();
  });

  test('admin /admin/users still works; non-admin cannot access admin users', async ({
    page,
    request,
  }) => {
    const officerEmail = uniqueEmail('e2e-off-adminreg');
    const password = 'Password123!';

    await signupPending(page, officerEmail, password, 'Officer Admin Reg');
    await adminLogin(page);
    await adminApprovePendingByEmail(page, officerEmail);
    await grantManagePermissions(request, officerEmail);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await logout(page);

    await loginAs(page, officerEmail, password);
    await expect(page).toHaveURL(/\/app\/?$/);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/app\/?$/);
  });
});

test.describe('events crud', () => {
  test('admin creates event; member with create+manage manages own org events', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('e2e-events');
    const password = 'Password123!';
    const name = 'Events Member';
    const eventName = `E2E Formal ${Date.now()}`;

    await signupPending(page, email, password, name);
    await adminLogin(page);
    await adminApprovePendingByEmail(page, email);

    const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const orgs = await request.get('/api/organizations', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const orgList = (await orgs.json()) as Array<{ id: string; name: string }>;
    const org = orgList.find((o) => o.name === 'Alpha Demo Fraternity');
    expect(org).toBeTruthy();

    await page.goto('/admin/events');
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await page.locator('#admin-event-org').selectOption({ label: 'Alpha Demo Fraternity (FRATERNITY)' });
    await page.locator('#admin-event-name').fill(`Admin ${eventName}`);
    await page.locator('#admin-event-type').fill('Fraternity Formal');
    await page.locator('#admin-event-headcount').fill('100');
    await page.locator('#admin-event-location').fill('Nashville');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(`Admin ${eventName}`)).toBeVisible();

    const users = await request.get('/api/admin/users?status=ACTIVE', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userList = (await users.json()) as Array<{ id: string; email: string }>;
    const user = userList.find((u) => u.email === email);
    expect(user).toBeTruthy();
    const memberships = await request.get('/api/memberships', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const membershipList = (await memberships.json()) as Array<{
      id: string;
      userId: string;
    }>;
    const membership = membershipList.find((m) => m.userId === user!.id);
    expect(membership).toBeTruthy();
    for (const key of ['events.create', 'events.manage'] as const) {
      const grant = await request.post(`/api/memberships/${membership!.id}/permissions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { permissionKey: key },
      });
      expect(grant.ok()).toBeTruthy();
    }

    await logout(page);
    await loginAs(page, email, password);
    await page.goto('/app/events');
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await page.locator('#event-name').fill(eventName);
    await page.locator('#event-type').fill('Date Party');
    await page.locator('#event-headcount').fill('40');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(eventName)).toBeVisible();
    const row = page.locator('li').filter({ hasText: eventName });
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#edit-event-name').fill(`${eventName} Updated`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(`${eventName} Updated`)).toBeVisible();
  });

  test('member without event perms redirected from /app/events', async ({ page }) => {
    const email = uniqueEmail('e2e-noevt');
    const password = 'Password123!';
    await signupPending(page, email, password, 'No Events');
    await adminLogin(page);
    await adminApprovePendingByEmail(page, email);
    await logout(page);
    await loginAs(page, email, password);
    await page.goto('/app/events');
    await expect(page).toHaveURL(/\/app\/?$/);
  });
});
