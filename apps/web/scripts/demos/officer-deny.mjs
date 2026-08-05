import {
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  findUserRow,
  launchDemo,
  login,
  logout,
  pause,
  setupOfficerAndApplicant,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const officerEmail = `demo+off-deny-${stamp}@greekgeek.local`;
const applicantEmail = `demo+off-denyd-${stamp}@greekgeek.local`;
const officerName = `Officer Denier ${stamp}`;
const applicantName = `Denied Applicant ${stamp}`;
const out = `officer-deny-${stamp}.webm`;

await setupOfficerAndApplicant({
  officerEmail,
  officerName,
  applicantEmail,
  applicantName,
});

const { browser, context, page } = await launchDemo();
try {
  await login(page, officerEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 600);

  await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Pending approvals' }).waitFor();
  await page.getByText(applicantEmail).waitFor();
  await pause(page, 1000);

  const row = await findUserRow(page, applicantEmail);
  await row.getByRole('button', { name: 'Deny' }).click();
  await page.getByText(applicantEmail).waitFor({ state: 'detached', timeout: 15000 });
  await pause(page, 1000);

  await logout(page);

  await login(page, applicantEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/blocked/, { timeout: 15000 });
  await page.getByText('Account inactive', { exact: true }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
