import { expect, test, type Page } from '@playwright/test';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

async function signup(page: Page, email: string, password: string, name: string) {
  await page.goto('/signup');
  await expect(page.locator('body')).toHaveClass(/rally-theme/);
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
}

test.describe('auth flows', () => {
  test('signup reaches protected page; logout then login round-trip', async ({ page }) => {
    const email = uniqueEmail('e2e-signup');
    const password = 'Password123!';
    const name = 'E2E User';

    await signup(page, email, password, name);

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login\/?$/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
  });

  test('hard refresh keeps session; signed-out protected route redirects', async ({ page }) => {
    const email = uniqueEmail('e2e-refresh');
    const password = 'Password123!';
    const name = 'Refresh User';

    await signup(page, email, password, name);
    await page.reload();
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login\/?$/);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/login\/?$/);

    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(401);
  });
});
