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
const officerEmail = `demo+off-appr-${stamp}@rally.local`;
const applicantEmail = `demo+off-appl-${stamp}@rally.local`;
const officerName = `Officer Approver ${stamp}`;
const applicantName = `Officer Applicant ${stamp}`;
const out = `officer-approve-${stamp}.webm`;

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
  await page.getByRole('heading', { name: new RegExp(`Hello, ${officerName}`) }).waitFor();
  await pause(page, 800);

  await page.getByRole('link', { name: 'Pending approvals' }).click();
  await page.waitForURL(/\/users\/?$/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Pending approvals' }).waitFor();
  await page.getByText(applicantEmail).waitFor();
  await pause(page, 1000);

  const row = await findUserRow(page, applicantEmail);
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByText(applicantEmail).waitFor({ state: 'detached', timeout: 15000 });
  await pause(page, 1000);

  await logout(page);

  await login(page, applicantEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${applicantName}`) }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
