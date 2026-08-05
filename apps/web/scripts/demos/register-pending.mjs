import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_PASSWORD,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  signupCascade,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const email = `demo+pending-${stamp}@greekgeek.local`;
const name = `Pending Demo ${stamp}`;
const out = `register-pending-${stamp}.webm`;

const { browser, context, page } = await launchDemo();
try {
  await signupCascade(page, { name, email, password: DEMO_PASSWORD });
  await pause(page, 1500);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/awaiting-approval/, { timeout: 15000 });
  await page.getByText('Awaiting approval', { exact: true }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
