import {
  BASE_URL,
  DEMO_PASSWORD,
  finalizeVideo,
  launchDemo,
  login,
  pause,
  setupActiveMember,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const email = `demo+noevt-${stamp}@rally.local`;
const name = `No Events Member ${stamp}`;
const out = `member-events-forbidden-${stamp}.webm`;

await setupActiveMember({ name, email, grantEventPerms: false });

const { browser, context, page } = await launchDemo();
try {
  await login(page, email, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${name}`) }).waitFor();
  await pause(page, 800);

  const eventsLink = page.getByRole('link', { name: 'Events' });
  await eventsLink.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  if ((await eventsLink.count()) > 0) {
    throw new Error('Events nav link should be hidden without event permissions');
  }
  await pause(page, 800);

  await page.goto(`${BASE_URL}/app/events`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/app\/?$/, { timeout: 15000 });
  await page.getByRole('heading', { name: new RegExp(`Hello, ${name}`) }).waitFor();
  await pause(page, 2000);
} finally {
  await finalizeVideo(page, context, browser, out);
}
