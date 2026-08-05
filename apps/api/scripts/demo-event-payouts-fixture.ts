/**
 * Seed / mutate event-payout demo data.
 *
 * Usage:
 *   pnpm exec tsx scripts/demo-event-payouts-fixture.ts init
 *   pnpm exec tsx scripts/demo-event-payouts-fixture.ts late-sale <eventId>
 *   pnpm exec tsx scripts/demo-event-payouts-fixture.ts post-release-dispute <eventId> <purchaseId>
 */
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { computePurchaseAmounts } from '@greekgeek/contracts';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const phase = process.argv[2];
const UNIT_PRICE_CENTS = 1000;
const FEE_PERCENT = 10;
const STRIPE_ACCOUNT_ID = 'acct_1U01uA83O4zqFuzP';

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

function piId(label: string) {
  return `pi_demo_${label}_${randomBytes(6).toString('hex')}`;
}

async function ensurePermission(key: string) {
  await prisma.permission.upsert({
    where: { key },
    update: {},
    create: { key, description: key },
  });
}

async function grantPermissions(membershipId: string, keys: string[]) {
  for (const key of keys) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
    await prisma.memberPermission.upsert({
      where: { membershipId_permissionId: { membershipId, permissionId: permission.id } },
      update: {},
      create: { membershipId, permissionId: permission.id },
    });
  }
}

async function createActiveUser(name: string, email: string, organizationId: string) {
  const passwordHash = await argon2.hash('GreekGeekDemo123!');
  const user = await prisma.user.create({
    data: { name, email, passwordHash, status: 'ACTIVE' },
  });
  const membership = await prisma.membership.create({
    data: { userId: user.id, organizationId },
  });
  return { user, membership };
}

async function createSucceededPurchase(input: {
  buyerUserId: string;
  eventId: string;
  allocationId: string;
  quantity: number;
  label: string;
  payoutExcludedReason?: 'disputed' | 'refunded' | 'voided' | null;
  eventPayoutId?: string | null;
}) {
  const amounts = computePurchaseAmounts(input.quantity, UNIT_PRICE_CENTS, FEE_PERCENT);
  const purchase = await prisma.purchase.create({
    data: {
      buyerUserId: input.buyerUserId,
      eventId: input.eventId,
      allocationId: input.allocationId,
      quantity: input.quantity,
      subtotalCents: amounts.subtotalCents,
      feeCents: amounts.feeCents,
      amountCents: amounts.amountCents,
      netCents: amounts.netCents,
      status: 'succeeded',
      stripePaymentIntentId: piId(input.label),
      stripeChargeId: `ch_demo_${input.label}`,
      payoutExcludedReason: input.payoutExcludedReason ?? null,
      eventPayoutId: input.eventPayoutId ?? null,
    },
  });
  for (let i = 0; i < input.quantity; i += 1) {
    await prisma.ticket.create({
      data: {
        allocationId: input.allocationId,
        holderUserId: input.buyerUserId,
        purchaseId: purchase.id,
        status: 'paid',
        paidAt: new Date(),
        credentialToken: createHash('sha256')
          .update(`${purchase.id}-${i}-${randomBytes(8).toString('hex')}`)
          .digest('hex')
          .slice(0, 32),
      },
    });
  }
  return purchase;
}

async function initFixture() {
  const stamp = Date.now().toString();
  for (const key of [
    'events.create',
    'events.manage',
    'tickets.manage',
    'payments.manage',
  ] as const) {
    await ensurePermission(key);
  }

  const hostOrg = await prisma.organization.findFirstOrThrow({
    where: { name: 'Alpha Demo Fraternity' },
  });
  await prisma.organization.updateMany({
    where: {
      stripeAccountId: STRIPE_ACCOUNT_ID,
      id: { not: hostOrg.id },
    },
    data: {
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeTransfersEnabled: false,
      stripeDetailsSubmitted: false,
    },
  });
  await prisma.organization.update({
    where: { id: hostOrg.id },
    data: {
      stripeAccountId: STRIPE_ACCOUNT_ID,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeTransfersEnabled: true,
      stripeDetailsSubmitted: true,
      stripeRequirementsDue: null,
      stripeAccountUpdatedAt: new Date(),
    },
  });

  const invitedOrg = await prisma.organization.create({
    data: {
      name: `Payout Invited ${stamp}`,
      type: 'SORORITY',
      universityId: hostOrg.universityId,
    },
  });

  const hostHost = await createActiveUser(`Payout Host ${stamp}`, `demo+payout-host-${stamp}@greekgeek.local`, hostOrg.id);
  await grantPermissions(hostHost.membership.id, [
    'events.create',
    'events.manage',
    'tickets.manage',
    'payments.manage',
  ]);

  const hostBuyer = await createActiveUser(`Payout Host Buyer ${stamp}`, `demo+payout-host-buyer-${stamp}@greekgeek.local`, hostOrg.id);
  const invitedBuyer = await createActiveUser(`Payout Invited Buyer ${stamp}`, `demo+payout-invited-${stamp}@greekgeek.local`, invitedOrg.id);
  const publicBuyer = await createActiveUser(`Payout Public Buyer ${stamp}`, `demo+payout-public-${stamp}@greekgeek.local`, hostOrg.id);
  const disputedBuyer = await createActiveUser(`Payout Disputed Buyer ${stamp}`, `demo+payout-disputed-${stamp}@greekgeek.local`, hostOrg.id);

  const event = await prisma.event.create({
    data: {
      organizationId: hostOrg.id,
      name: `Payout Demo Formal ${stamp}`,
      type: 'Formal',
      maxHeadcount: 80,
      location: 'Campus Ballroom',
      startsAt: daysAgo(20),
      endsAt: daysAgo(10),
      ticketingEnabled: true,
      ticketCapacity: 30,
      ticketSaleStatus: 'on_sale',
    },
  });

  const hostAlloc = await prisma.ticketAllocation.create({
    data: { eventId: event.id, organizationId: hostOrg.id, quantity: 5, priceCents: UNIT_PRICE_CENTS, status: 'active' },
  });
  const invitedAlloc = await prisma.ticketAllocation.create({
    data: { eventId: event.id, organizationId: invitedOrg.id, quantity: 5, priceCents: UNIT_PRICE_CENTS, status: 'active' },
  });
  const publicAlloc = await prisma.ticketAllocation.create({
    data: { eventId: event.id, organizationId: null, quantity: 10, priceCents: UNIT_PRICE_CENTS, status: 'active' },
  });

  const hostPurchase = await createSucceededPurchase({
    buyerUserId: hostBuyer.user.id,
    eventId: event.id,
    allocationId: hostAlloc.id,
    quantity: 1,
    label: 'host',
  });
  const invitedPurchase = await createSucceededPurchase({
    buyerUserId: invitedBuyer.user.id,
    eventId: event.id,
    allocationId: invitedAlloc.id,
    quantity: 1,
    label: 'invited',
  });
  const publicPurchase = await createSucceededPurchase({
    buyerUserId: publicBuyer.user.id,
    eventId: event.id,
    allocationId: publicAlloc.id,
    quantity: 2,
    label: 'public-multi',
  });
  const disputedPurchase = await createSucceededPurchase({
    buyerUserId: disputedBuyer.user.id,
    eventId: event.id,
    allocationId: publicAlloc.id,
    quantity: 1,
    label: 'disputed-pre',
    payoutExcludedReason: 'disputed',
  });

  const batch1Net =
    hostPurchase.netCents + invitedPurchase.netCents + publicPurchase.netCents;

  console.log(
    JSON.stringify({
      stamp,
      eventId: event.id,
      eventName: event.name,
      hostOrgId: hostOrg.id,
      invitedOrgId: invitedOrg.id,
      hostEmail: hostHost.user.email,
      hostBuyerEmail: hostBuyer.user.email,
      invitedBuyerEmail: invitedBuyer.user.email,
      publicBuyerEmail: publicBuyer.user.email,
      disputedBuyerEmail: disputedBuyer.user.email,
      allocationIds: {
        host: hostAlloc.id,
        invited: invitedAlloc.id,
        public: publicAlloc.id,
      },
      purchaseIds: {
        host: hostPurchase.id,
        invited: invitedPurchase.id,
        publicMulti: publicPurchase.id,
        disputedPre: disputedPurchase.id,
      },
      expectedBatch1NetCents: batch1Net,
      expectedBatch1NetDisplay: `$${(batch1Net / 100).toFixed(2)}`,
      stripeAccountId: STRIPE_ACCOUNT_ID,
    }),
  );
}

async function lateSale(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const publicAlloc = await prisma.ticketAllocation.findFirstOrThrow({
    where: { eventId, organizationId: null, status: 'active' },
  });
  const stamp = Date.now().toString();
  const lateBuyer = await createActiveUser(
    `Payout Late Buyer ${stamp}`,
    `demo+payout-late-${stamp}@greekgeek.local`,
    event.organizationId,
  );
  const purchase = await createSucceededPurchase({
    buyerUserId: lateBuyer.user.id,
    eventId,
    allocationId: publicAlloc.id,
    quantity: 1,
    label: `late-${stamp}`,
  });
  console.log(
    JSON.stringify({
      eventId,
      lateBuyerEmail: lateBuyer.user.email,
      latePurchaseId: purchase.id,
      lateNetCents: purchase.netCents,
    }),
  );
}

async function postReleaseDispute(eventId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findFirstOrThrow({
    where: { id: purchaseId, eventId },
    select: { id: true, eventPayoutId: true, netCents: true },
  });
  if (!purchase.eventPayoutId) {
    throw new Error('Purchase must be attached to a released payout batch');
  }
  const payoutBefore = await prisma.eventPayout.findUniqueOrThrow({
    where: { id: purchase.eventPayoutId },
  });
  await prisma.$transaction([
    prisma.purchase.update({
      where: { id: purchase.id },
      data: { payoutExcludedReason: 'disputed' },
    }),
    prisma.eventPayout.update({
      where: { id: purchase.eventPayoutId },
      data: { postReleaseExposure: true },
    }),
  ]);
  const payoutAfter = await prisma.eventPayout.findUniqueOrThrow({
    where: { id: purchase.eventPayoutId },
  });
  console.log(
    JSON.stringify({
      eventId,
      purchaseId,
      payoutId: purchase.eventPayoutId,
      releasedAmountUnchanged: payoutBefore.amountCents === payoutAfter.amountCents,
      amountCents: payoutAfter.amountCents,
      postReleaseExposure: payoutAfter.postReleaseExposure,
    }),
  );
}

async function main() {
  if (phase === 'init') {
    await initFixture();
    return;
  }
  if (phase === 'late-sale') {
    const eventId = process.argv[3];
    if (!eventId) throw new Error('usage: late-sale <eventId>');
    await lateSale(eventId);
    return;
  }
  if (phase === 'post-release-dispute') {
    const eventId = process.argv[3];
    const purchaseId = process.argv[4];
    if (!eventId || !purchaseId) {
      throw new Error('usage: post-release-dispute <eventId> <purchaseId>');
    }
    await postReleaseDispute(eventId, purchaseId);
    return;
  }
  throw new Error('usage: init | late-sale <eventId> | post-release-dispute <eventId> <purchaseId>');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
