import { PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import { WebhookProcessProcessor } from '../webhooks/webhook-process.processor';
import type { WebhookProcessJob } from '../webhooks/types/webhook-process-job.dto';
import type { Job } from 'bullmq';
import { StripeWebhookHandlers } from './stripe-webhook.handlers';
import {
  mapStripeAccountToOrgFlags,
  syncOrgFromStripeAccount,
} from './stripe-sync';
import type { StripeService } from './stripe.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function mockV2Account(
  id: string,
  opts: {
    chargesActive?: boolean;
    payoutsActive?: boolean;
    requirementsEntries?: unknown[];
  } = {},
): Stripe.V2.Core.Account {
  const chargesStatus = opts.chargesActive ? 'active' : 'pending';
  const payoutsStatus = opts.payoutsActive ? 'active' : 'pending';
  return {
    id,
    object: 'v2.core.account',
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { status: chargesStatus },
          stripe_balance: {
            payouts: { status: payoutsStatus },
          },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            payouts: { status: payoutsStatus },
          },
        },
      },
    },
    requirements: {
      entries: opts.requirementsEntries ?? [],
    },
  } as unknown as Stripe.V2.Core.Account;
}

(hasDatabase ? describe : describe.skip)(
  'Stripe Connect webhook handlers integration',
  () => {
    const prisma = new PrismaClient();
    const suffix = `stripe-wh-${Date.now()}`;
    let universityId = '';
    let orgId = '';
    const stripeAccountId = `acct_test_${suffix}`;

    beforeAll(async () => {
      await prisma.$connect();
      const uni = await prisma.university.create({
        data: { name: `Stripe WH Uni ${suffix}` },
      });
      universityId = uni.id;
      const org = await prisma.organization.create({
        data: {
          name: `Stripe WH Org ${suffix}`,
          type: 'FRATERNITY',
          universityId,
          stripeAccountId,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
        },
      });
      orgId = org.id;
    });

    afterAll(async () => {
      await prisma.webhookEvent.deleteMany({
        where: { externalId: { startsWith: `evt_${suffix}` } },
      });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.university.deleteMany({ where: { id: universityId } });
      await prisma.$disconnect();
    });

    function makeProcessor(retrieveImpl: (id: string) => Promise<Stripe.V2.Core.Account>) {
      const stripe = {
        retrieveAccount: jest.fn((id: string) => retrieveImpl(id)),
      } as unknown as StripeService;
      const registry = new WebhookHandlerRegistry();
      const handlers = new StripeWebhookHandlers(
        registry,
        prisma as never,
        stripe,
      );
      handlers.onModuleInit();
      return {
        processor: new WebhookProcessProcessor(prisma as never, registry),
        stripe,
      };
    }

    it('account.updated webhook flips charges enabled', async () => {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          stripeAccountUpdatedAt: null,
        },
      });

      const ready = mockV2Account(stripeAccountId, {
        chargesActive: true,
        payoutsActive: true,
      });
      const { processor, stripe } = makeProcessor(async () => ready);

      const externalId = `evt_${suffix}_ready`;
      const created = Math.floor(Date.now() / 1000);
      const row = await prisma.webhookEvent.create({
        data: {
          service: 'stripe',
          externalId,
          type: 'account.updated',
          payload: {
            id: externalId,
            type: 'account.updated',
            created,
            data: {
              object: {
                id: stripeAccountId,
                object: 'account',
                charges_enabled: true,
              },
            },
          },
        },
      });

      await processor.process({
        id: 'job-ready',
        data: { webhookEventId: row.id },
      } as Job<WebhookProcessJob>);

      expect(stripe.retrieveAccount).toHaveBeenCalledWith(stripeAccountId);

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
      });
      expect(org.stripeChargesEnabled).toBe(true);
      expect(org.stripePayoutsEnabled).toBe(true);
      expect(org.stripeAccountUpdatedAt).not.toBeNull();

      const event = await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(event.processedAt).not.toBeNull();
      expect(event.lastError).toBeNull();
    });

    it('stale event does not regress charges enabled', async () => {
      const newerAt = new Date('2026-08-01T12:00:00.000Z');
      const olderCreated = Math.floor(
        new Date('2026-08-01T10:00:00.000Z').getTime() / 1000,
      );

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          stripeDetailsSubmitted: true,
          stripeAccountUpdatedAt: newerAt,
        },
      });

      const liveReady = mockV2Account(stripeAccountId, {
        chargesActive: true,
        payoutsActive: true,
      });
      const staleDisabled = mockV2Account(stripeAccountId, {
        chargesActive: false,
        payoutsActive: false,
      });

      // First retrieve (handler) returns stale-looking false; sync detects stale
      // and refetch returns charges still enabled.
      let retrieveCount = 0;
      const { processor } = makeProcessor(async () => {
        retrieveCount += 1;
        return retrieveCount === 1 ? staleDisabled : liveReady;
      });

      const externalId = `evt_${suffix}_stale`;
      const row = await prisma.webhookEvent.create({
        data: {
          service: 'stripe',
          externalId,
          type: 'account.updated',
          payload: {
            id: externalId,
            type: 'account.updated',
            created: olderCreated,
            data: {
              object: {
                id: stripeAccountId,
                object: 'account',
                charges_enabled: false,
              },
            },
          },
        },
      });

      await processor.process({
        id: 'job-stale',
        data: { webhookEventId: row.id },
      } as Job<WebhookProcessJob>);

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
      });
      expect(org.stripeChargesEnabled).toBe(true);
      expect(retrieveCount).toBeGreaterThanOrEqual(2);

      const event = await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(event.processedAt).not.toBeNull();
    });

    it('unknown stripeAccountId completes without mutating orgs', async () => {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeChargesEnabled: true,
          stripeAccountUpdatedAt: new Date(),
        },
      });
      const before = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
      });

      const retrieve = jest.fn();
      const { processor } = makeProcessor(async (id) => {
        retrieve(id);
        return mockV2Account(id, { chargesActive: false });
      });

      const unknownAcct = `acct_unknown_${suffix}`;
      const externalId = `evt_${suffix}_unknown`;
      const row = await prisma.webhookEvent.create({
        data: {
          service: 'stripe',
          externalId,
          type: 'v2.core.account[configuration.merchant].capability_status_updated',
          payload: {
            id: externalId,
            type: 'v2.core.account[configuration.merchant].capability_status_updated',
            created: new Date().toISOString(),
            related_object: { id: unknownAcct, type: 'v2.core.account' },
          },
        },
      });

      await processor.process({
        id: 'job-unknown',
        data: { webhookEventId: row.id },
      } as Job<WebhookProcessJob>);

      expect(retrieve).not.toHaveBeenCalled();

      const after = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
      });
      expect(after.stripeChargesEnabled).toBe(before.stripeChargesEnabled);
      expect(after.stripeAccountUpdatedAt?.toISOString()).toBe(
        before.stripeAccountUpdatedAt?.toISOString(),
      );

      const event = await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(event.processedAt).not.toBeNull();
      expect(event.attempts).toBe(0);
      expect(event.lastError).toBeNull();
    });

    it('syncOrgFromStripeAccount skips write when stale and no refetch', async () => {
      const newerAt = new Date('2026-08-01T18:00:00.000Z');
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeChargesEnabled: true,
          stripeAccountUpdatedAt: newerAt,
        },
      });

      await syncOrgFromStripeAccount(
        prisma as never,
        orgId,
        mockV2Account(stripeAccountId, { chargesActive: false }),
        {
          eventTimestamp: new Date('2026-08-01T08:00:00.000Z'),
        },
      );

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
      });
      expect(org.stripeChargesEnabled).toBe(true);
      expect(org.stripeAccountUpdatedAt?.toISOString()).toBe(
        newerAt.toISOString(),
      );
    });

    it('mapStripeAccountToOrgFlags reads v2 capability statuses', () => {
      const flags = mapStripeAccountToOrgFlags(
        mockV2Account('acct_x', {
          chargesActive: true,
          payoutsActive: false,
        }),
      );
      expect(flags.stripeChargesEnabled).toBe(true);
      expect(flags.stripePayoutsEnabled).toBe(false);
    });
  },
);
