/**
 * Event payouts end-to-end demo — host/invited/public sales, hold, release,
 * exclusions, late batch, post-release exposure, sweep idempotency.
 *
 * Run: DEMO_SLOW_MO=900 node scripts/demos/event-payouts.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  DEMO_PASSWORD,
  adminToken,
  apiJson,
  finalizeVideo,
  launchDemo,
  login,
  logout,
  pause,
  showFlowTitle,
  ts,
} from './demo-helpers.mjs';

const stamp = ts();
const out = `event-payouts-${stamp}.webm`;
const API_DIR = '/root/greekgeek/greekgeek/apps/api';
const NODE_BIN = '/root/.nvm/versions/node/v22.21.1/bin';

function runApiScript(cmd) {
  return execSync(cmd, {
    cwd: API_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${NODE_BIN}:${process.env.PATH ?? ''}`,
    },
  });
}

function runApiJson(cmd) {
  const stdout = runApiScript(cmd);
  const line = stdout.trim().split('\n').pop();
  return JSON.parse(line);
}

// --- API fixtures ---
runApiScript('node scripts/demo-payout-fund-platform.mjs 150000');
const fixture = runApiJson('pnpm exec tsx scripts/demo-event-payouts-fixture.ts init');

const {
  eventId,
  eventName,
  hostEmail,
  expectedBatch1NetDisplay,
  purchaseIds,
} = fixture;

const adminTok = await adminToken();

async function getSummary(token) {
  return apiJson(`/api/events/${eventId}/payout`, { token });
}

/** Proxy sweep idempotency: admin release when nothing pending must not create batches. */
async function probeSweepIdempotent(reason) {
  const before = await getSummary(adminTok);
  const result = await apiJson(`/api/admin/event-payouts/${eventId}/release`, {
    method: 'POST',
    token: adminTok,
    body: { reason },
  });
  const after = await getSummary(adminTok);
  return {
    released: result.payout?.status === 'released' ? 1 : 0,
    payoutCountBefore: before.payouts.length,
    payoutCountAfter: after.payouts.length,
  };
}

// --- UI recording ---
const { browser, context, page } = await launchDemo();
try {
  // 1. Host sales + payout summary (host / invited / public gross breakdown)
  await showFlowTitle(page, 'Host + sales');
  await login(page, hostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await pause(page, 1000);

  await page.goto(`${BASE_URL}/app/events/${eventId}/tickets`, { waitUntil: 'networkidle' });
  await page.getByText(eventName).waitFor({ timeout: 15000 });
  await pause(page, 1500);

  await page.getByText('Payout summary').waitFor({ timeout: 15000 });
  await page.getByText('Gross sales').waitFor();
  await page.getByText('GreekGeek fee').waitFor();
  await page.getByText('Net proceeds').waitFor();
  await page.getByText('Excluded purchases').waitFor();
  await pause(page, 2500);

  // 2. Admin hold → clear hold
  await showFlowTitle(page, 'Admin hold');
  await logout(page);
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(/\/(admin|app)/, { timeout: 15000 });
  await pause(page, 800);

  await page.goto(`${BASE_URL}/admin/event-payouts`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Event payouts' }).waitFor({ timeout: 15000 });
  const reasonInput = page.locator(`#payout-reason-${eventId}`);
  await reasonInput.scrollIntoViewIfNeeded();
  await reasonInput.waitFor({ timeout: 15000 });
  const eventCard = reasonInput.locator('xpath=ancestor::div[contains(@class,"surface-glass-panel")]');
  await eventCard.getByText('Eligible now').first().waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await reasonInput.fill('Fraud review hold for payout demo');
  await eventCard.getByRole('button', { name: 'Hold' }).click();
  await page.getByText(/Hold request recorded/i).waitFor({ timeout: 15000 });
  await pause(page, 2000);
  await eventCard.getByText('Held', { exact: true }).first().waitFor({ timeout: 15000 });
  await pause(page, 2000);

  await reasonInput.fill('Review complete — clear hold for release');
  await eventCard.getByRole('button', { name: 'Clear hold' }).click();
  await page.getByText(/Clear-hold request recorded/i).waitFor({ timeout: 15000 });
  await pause(page, 2000);
  await eventCard.getByText('Eligible now').first().waitFor({ timeout: 15000 });
  await pause(page, 2000);

  // 3. Early release batch 1 — net only (disputed purchase excluded)
  await showFlowTitle(page, 'Release batch 1');
  await reasonInput.fill('Early release after event end — batch 1 net to host');
  await eventCard.getByRole('button', { name: 'Release' }).click();
  await page.getByText(/Release audit recorded/i).waitFor({ timeout: 30000 });
  await pause(page, 2000);

  await eventCard.getByText(expectedBatch1NetDisplay).first().waitFor({ timeout: 15000 });
  await eventCard.getByText(`Batch 1 · ${expectedBatch1NetDisplay}`).waitFor({ timeout: 15000 });
  await eventCard.getByText('released', { exact: false }).first().waitFor();
  await eventCard.getByText('Excluded purchases').waitFor();
  await pause(page, 3000);

  const summaryAfterBatch1 = await getSummary(adminTok);
  if (summaryAfterBatch1.releasedCents !== summaryAfterBatch1.payouts[0]?.amountCents) {
    throw new Error('Batch 1 released cents mismatch');
  }
  if (summaryAfterBatch1.excludedCount < 1) {
    throw new Error('Expected at least one excluded purchase');
  }

  // 4. Late sale → batch 2
  await showFlowTitle(page, 'Late sale');
  const late = runApiJson(`pnpm exec tsx scripts/demo-event-payouts-fixture.ts late-sale ${eventId}`);
  await page.reload({ waitUntil: 'networkidle' });
  await pause(page, 1500);
  await reasonInput.scrollIntoViewIfNeeded();
  await eventCard.getByText('Eligible now').first().waitFor({ timeout: 15000 });
  await pause(page, 1500);

  await reasonInput.fill('Release late sale proceeds — batch 2');
  await eventCard.getByRole('button', { name: 'Release' }).click();
  await page.getByText(/Release audit recorded/i).waitFor({ timeout: 30000 });
  await pause(page, 2000);
  await eventCard.getByText(/Batch 2 ·/).waitFor({ timeout: 15000 });
  await pause(page, 2500);

  // 5. Post-release dispute exposure (historical amount unchanged)
  await showFlowTitle(page, 'Post-release dispute');
  const exposure = runApiJson(
    `pnpm exec tsx scripts/demo-event-payouts-fixture.ts post-release-dispute ${eventId} ${purchaseIds.host}`,
  );
  if (!exposure.releasedAmountUnchanged) {
    throw new Error('Post-release dispute changed released batch amount');
  }
  await page.reload({ waitUntil: 'networkidle' });
  await pause(page, 1500);
  await eventCard.getByText('Post-release dispute exposure').waitFor({ timeout: 15000 });
  await eventCard.getByText('Batch 1').waitFor();
  await pause(page, 2500);

  // 6. Sweep rerun — no duplicate transfers / batches
  await showFlowTitle(page, 'Sweep idempotent');
  const payoutCountBefore = (await getSummary(adminTok)).payouts.length;
  const sweep1 = await probeSweepIdempotent('Sweep rerun 1 — expect no new payout');
  const sweep2 = await probeSweepIdempotent('Sweep rerun 2 — expect no new payout');
  const summaryFinal = await getSummary(adminTok);
  if (summaryFinal.payouts.length !== payoutCountBefore) {
    throw new Error(
      `Expected ${payoutCountBefore} payout batches after sweeps, got ${summaryFinal.payouts.length}`,
    );
  }
  if (sweep1.released !== 0 || sweep2.released !== 0) {
    throw new Error('Sweep probe created unexpected releases', { sweep1, sweep2 });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await pause(page, 1500);
  await eventCard.getByText('Batch 2').waitFor();
  await pause(page, 2500);

  // Host view — released history unchanged
  await logout(page);
  await login(page, hostEmail, DEMO_PASSWORD);
  await page.waitForURL(/\/app/, { timeout: 15000 });
  await page.goto(`${BASE_URL}/app/events/${eventId}/tickets`, { waitUntil: 'networkidle' });
  await page.getByText('Post-release dispute exposure').waitFor({ timeout: 15000 });
  await page.getByText('Released history').waitFor();
  await page.getByText(`Batch 1 · ${expectedBatch1NetDisplay}`).waitFor();
  await page.getByText(/Batch 2 ·/).waitFor();
  await pause(page, 3000);
} finally {
  await finalizeVideo(page, context, browser, out);
}

console.log(
  JSON.stringify({
    video: path.join('/root/greekgeek/greekgeek/demo-videos', out),
    accounts: {
      admin: ADMIN_EMAIL,
      host: hostEmail,
      hostBuyer: fixture.hostBuyerEmail,
      invitedBuyer: fixture.invitedBuyerEmail,
      publicBuyer: fixture.publicBuyerEmail,
      disputedBuyer: fixture.disputedBuyerEmail,
      lateBuyer: 'created at late-sale phase',
    },
    fixture,
  }),
);
