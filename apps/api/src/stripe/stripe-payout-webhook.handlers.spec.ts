import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import type { PrismaService } from '../prisma/prisma.service';
import { StripePayoutWebhookHandlers } from './stripe-payout-webhook.handlers';

describe('StripePayoutWebhookHandlers', () => {
  it('completes unknown charge events without mutation', async () => {
    const prisma = {
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const registry = new WebhookHandlerRegistry();
    const handlers = new StripePayoutWebhookHandlers(registry, prisma);
    handlers.onModuleInit();

    await registry.get('charge.refunded')?.({
      type: 'charge.refunded',
      webhookEventId: 'wh_1',
      payload: {
        type: 'charge.refunded',
        data: { object: { id: 'ch_unknown', payment_intent: 'pi_unknown' } },
      },
    });

    expect(prisma.purchase.findFirst).toHaveBeenCalled();
  });

  it('flags post-release exposure while preserving payout amount', async () => {
    const updatePurchase = jest.fn().mockResolvedValue(undefined);
    const updatePayout = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      purchase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'purchase_1', eventPayoutId: 'payout_1' }),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          purchase: { update: updatePurchase },
          eventPayout: { update: updatePayout },
        }),
      ),
    } as unknown as PrismaService;
    const registry = new WebhookHandlerRegistry();
    const handlers = new StripePayoutWebhookHandlers(registry, prisma);
    handlers.onModuleInit();

    await registry.get('charge.dispute.created')?.({
      type: 'charge.dispute.created',
      webhookEventId: 'wh_2',
      payload: {
        type: 'charge.dispute.created',
        data: { object: { id: 'ch_1' } },
      },
    });

    expect(updatePurchase).toHaveBeenCalledWith({
      where: { id: 'purchase_1' },
      data: { payoutExcludedReason: 'disputed' },
    });
    expect(updatePayout).toHaveBeenCalledWith({
      where: { id: 'payout_1' },
      data: { postReleaseExposure: true },
    });
  });
});
