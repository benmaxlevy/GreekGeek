import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@greekgeek.local';
const ADMIN_PASSWORD = 'GreekGeekAdmin123!';

test('admin payout queue shows financial state and requires audited reason', async ({ page }) => {
  const now = new Date().toISOString();
  const eventId = 'event-payout-ui';
  const payoutId = 'payout-ui';
  const queueItem = {
    eventId,
    grossAmountCents: 10_000,
    feeCents: 1_000,
    netCents: 9_000,
    releasedCents: 0,
    pendingCents: 9_000,
    excludedCents: 0,
    excludedCount: 0,
    excludedByReason: { disputed: 0, refunded: 0, voided: 0 },
    expectedPayoutDate: '2030-06-07T18:00:00.000Z',
    heldAt: null,
    heldByUserId: null,
    blockedReason: null,
    readiness: {
      stripeAccountId: 'acct_ui',
      stripePayoutsEnabled: true,
      stripeTransfersEnabled: true,
      ready: true,
      blockedReason: null,
    },
    postReleaseExposure: false,
    payouts: [
      {
        id: payoutId,
        eventId,
        batchSeq: 1,
        amountCents: 9_000,
        status: 'pending',
        releasedAt: null,
        releaseMode: null,
        releasedByUserId: null,
        stripeTransferId: null,
        attempts: 0,
        lastError: null,
        postReleaseExposure: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    audits: [],
    eligibleNow: true,
  };

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);

  await page.route('**/api/admin/event-payouts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([queueItem]),
    });
  });
  await page.route(`**/api/admin/event-payouts/${eventId}/release`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        payout: { ...queueItem.payouts[0], status: 'released', releasedAt: now },
        audit: {
          id: 'audit-ui',
          eventId,
          eventPayoutId: payoutId,
          actorUserId: 'admin-ui',
          action: 'release',
          reason: 'manual review complete',
          createdAt: now,
        },
      }),
    });
  });

  await page.goto('/admin/event-payouts');
  await expect(page.getByRole('heading', { name: 'Event payouts' })).toBeVisible();
  await expect(page.getByText('Eligible now')).toBeVisible();
  await expect(page.getByText('$100.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$10.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$90.00', { exact: true }).first()).toBeVisible();

  const reason = page.getByLabel('Reason required for every admin action');
  const release = page.getByRole('button', { name: 'Release' });
  await expect(release).toBeDisabled();
  await reason.fill('manual review complete');
  await expect(release).toBeEnabled();
  await release.click();
  await expect(page.getByText(/Release audit recorded: manual review complete/)).toBeVisible();
});
