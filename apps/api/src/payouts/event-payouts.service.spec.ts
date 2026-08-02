import { ConfigService } from '@nestjs/config';
import { EventPayoutsService } from './event-payouts.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StripeService } from '../stripe/stripe.service';

describe('EventPayoutsService readiness', () => {
  function makeService(organization: {
    stripeAccountId: string | null;
    stripePayoutsEnabled: boolean;
    stripeTransfersEnabled: boolean;
  }) {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(organization),
      },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue(5),
    } as unknown as ConfigService;
    return new EventPayoutsService(prisma, {} as StripeService, config as never);
  }

  it('requires account, payouts, and transfers readiness', async () => {
    await expect(
      makeService({
        stripeAccountId: null,
        stripePayoutsEnabled: true,
        stripeTransfersEnabled: true,
      }).evaluateReadiness('org_1'),
    ).resolves.toMatchObject({
      ready: false,
      blockedReason: 'missing_stripe_account',
    });

    await expect(
      makeService({
        stripeAccountId: 'acct_1',
        stripePayoutsEnabled: false,
        stripeTransfersEnabled: true,
      }).evaluateReadiness('org_1'),
    ).resolves.toMatchObject({
      ready: false,
      blockedReason: 'payouts_disabled',
    });

    await expect(
      makeService({
        stripeAccountId: 'acct_1',
        stripePayoutsEnabled: true,
        stripeTransfersEnabled: false,
      }).evaluateReadiness('org_1'),
    ).resolves.toMatchObject({
      ready: false,
      blockedReason: 'transfers_disabled',
    });

    await expect(
      makeService({
        stripeAccountId: 'acct_1',
        stripePayoutsEnabled: true,
        stripeTransfersEnabled: true,
      }).evaluateReadiness('org_1'),
    ).resolves.toMatchObject({
      ready: true,
      blockedReason: null,
    });
  });
});

describe('EventPayoutsService release', () => {
  it('transfers eligible net proceeds to host with stable metadata', async () => {
    const audit = {
      id: 'audit_1',
      eventId: 'event_1',
      eventPayoutId: 'payout_1',
      actorUserId: 'admin_1',
      action: 'release',
      reason: 'release now',
      createdAt: new Date(),
    };
    const created = {
      id: 'payout_1',
      eventId: 'event_1',
      batchSeq: 1,
      amountCents: 0,
      status: 'pending',
      releasedAt: null,
      releaseMode: null,
      releasedByUserId: null,
      stripeTransferId: null,
      attempts: 0,
      lastError: null,
      postReleaseExposure: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const released = {
      ...created,
      amountCents: 3000,
      status: 'released',
      releasedAt: new Date(),
      releaseMode: 'manual',
      releasedByUserId: 'admin_1',
      stripeTransferId: 'tr_1',
      attempts: 1,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'event_1',
          organizationId: 'org_1',
          startsAt: new Date('2026-07-01T18:00:00.000Z'),
          endsAt: null,
          heldAt: null,
          heldByUserId: null,
          stripeAccountId: 'acct_host',
          stripePayoutsEnabled: true,
          stripeTransfersEnabled: true,
        },
      ]),
      purchase: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'purchase_1', netCents: 2000 },
          { id: 'purchase_2', netCents: 1000 },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      eventPayout: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _max: { batchSeq: null } }),
        create: jest.fn().mockResolvedValue(created),
        update: jest
          .fn()
          .mockResolvedValueOnce({ ...created, amountCents: 3000, attempts: 1 })
          .mockResolvedValueOnce(released),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
      eventPayoutAudit: { create: jest.fn().mockResolvedValue(audit) },
    } as unknown as PrismaService;
    const stripe = {
      createTransfer: jest.fn().mockResolvedValue({ id: 'tr_1' }),
    } as unknown as StripeService;
    const config = {
      get: jest.fn().mockReturnValue(5),
    } as unknown as ConfigService;
    const service = new EventPayoutsService(prisma, stripe, config as never);

    const result = await service.release(
      'event_1',
      { eventId: 'event_1', mode: 'manual', reason: 'release now' },
      {
        id: 'admin_1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        requestedOrganizationId: null,
        membership: null,
        permissions: [],
      },
    );

    expect(stripe.createTransfer).toHaveBeenCalledWith({
      amountCents: 3000,
      currency: 'usd',
      destinationAccountId: 'acct_host',
      metadata: { eventId: 'event_1', batchSeq: '1', payoutId: 'payout_1' },
      idempotencyKey: 'event-payout-payout_1',
    });
    expect(tx.purchase.updateMany).toHaveBeenCalled();
    expect(result.payout?.amountCents).toBe(3000);
  });
});
