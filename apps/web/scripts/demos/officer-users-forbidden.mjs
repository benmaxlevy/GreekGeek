import {
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  setupOfficerAndApplicant,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const memberEmail = `demo+off-noperm-${stamp}@greekgeek.local`;
const memberName = `No Perm Member ${stamp}`;
const out = `officer-users-forbidden-${stamp}.webm`;

await setupOfficerAndApplicant({
  officerEmail: memberEmail,
  officerName: memberName,
  grantOfficerPermission: false,
});

const { browser, context, page } = await launchDemo();
try {
  await login(page, memberEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${memberName}`) }).waitFor();
  await pause(page, 800);

  // No nav link when lacking manage_permissions
  const pendingLink = page.getByRole('link', { name: 'Pending approvals' });
  await pendingLink.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  if ((await pendingLink.count()) > 0) {
    throw new Error('Pending approvals link should be hidden without permission');
  }
  await pause(page, 800);

  await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/app\/?$/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${memberName}`) }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
