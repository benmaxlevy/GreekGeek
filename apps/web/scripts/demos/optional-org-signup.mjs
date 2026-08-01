import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  findUserRow,
  launchDemo,
  login,
  logout,
  pause,
  signupCascade,
  signupWithoutOrg,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const orglessEmail = `demo+orgless-${stamp}@rally.local`;
const orglessName = `Orgless Demo ${stamp}`;
const pendingEmail = `demo+pending-${stamp}@rally.local`;
const pendingName = `Pending Demo ${stamp}`;
const out = `optional-org-signup-${stamp}.webm`;

async function assertReachable() {
  const web = await fetch(BASE_URL);
  if (!web.ok) throw new Error(`Web unreachable: ${BASE_URL} → ${web.status}`);
  const api = await fetch(`${process.env.DEMO_API_URL ?? 'http://localhost:3001'}/api/health`).catch(
    () => fetch(`${process.env.DEMO_API_URL ?? 'http://localhost:3001'}/api/universities`),
  );
  if (!api.ok) throw new Error(`API unreachable → ${api.status}`);
}

await assertReachable();

const { browser, context, page } = await launchDemo();
try {
  // 1. Org-less signup → /login ready banner
  await signupWithoutOrg(page, {
    name: orglessName,
    email: orglessEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 1200);

  // 2. Login as org-less user → /app Hello heading
  await login(page, orglessEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${orglessName}`) }).waitFor();
  await pause(page, 1200);

  // 3. Logout
  await logout(page);
  await pause(page, 600);

  // 4. With-org signup → /login pending banner
  await signupCascade(page, {
    name: pendingName,
    email: pendingEmail,
    password: DEMO_PASSWORD,
  });
  await pause(page, 1200);

  // 5. Login as pending user → /awaiting-approval
  await login(page, pendingEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/awaiting-approval/, { timeout: 15000 });
  await page.getByText('Awaiting approval', { exact: true }).waitFor();
  await pause(page, 1200);

  // 6. Logout
  await logout(page);
  await pause(page, 600);

  // 7. Admin → /admin/users → ACTIVE filter → org-less row shows Membership: None
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ACTIVE', exact: true }).click();
  await pause(page, 800);

  const row = await findUserRow(page, orglessEmail);
  await row.getByText('Membership: None').waitFor({ timeout: 15000 });
  await row.scrollIntoViewIfNeeded();

  // 8. Pause so viewer can read
  await pause(page, 3000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
