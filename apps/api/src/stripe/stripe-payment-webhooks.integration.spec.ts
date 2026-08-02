import { PrismaClient } from '@prisma/client';
import type { Job } from 'bullmq';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import { WebhookProcessProcessor } from '../webhooks/webhook-process.processor';
import type { WebhookProcessJob } from '../webhooks/types/webhook-process-job.dto';
import { StripePaymentWebhookHandlers } from './stripe-payment-webhook.handlers';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)(
  'Stripe PaymentIntent webhook handlers integration',
  () => {
    const prisma = new PrismaClient();
    const suffix = `pi-wh-${Date.now()}`;
    let universityId = '';
    let orgId = '';
    let eventId = '';
    let allocationId = '';
    let buyerId = '';
    let purchaseId = '';
    let voidPurchaseId = '';
    let unpaidTicketIds: string[] = [];

    function makeProcessor() {
      const registry = new WebhookHandlerRegistry();
      const handlers = new StripePaymentWebhookHandlers(
        registry,
        prisma as never,
      );
      handlers.onModuleInit();
      return new WebhookProcessProcessor(prisma as never, registry);
    }

    async function enqueueAndProcess(
      processor: WebhookProcessProcessor,
      type: string,
      paymentIntentId: string,
      externalId: string,
      extraPiFields: Record<string, unknown> = {},
    ) {
      const row = await prisma.webhookEvent.create({
        data: {
          service: 'stripe',
          externalId,
          type,
          payload: {
            id: externalId,
            type,
            data: {
              object: {
                id: paymentIntentId,
                object: 'payment_intent',
                metadata: { purchaseId },
                ...extraPiFields,
              },
            },
          },
        },
      });
      await processor.process({
        id: `job-${externalId}`,
        data: { webhookEventId: row.id },
      } as Job<WebhookProcessJob>);
      return row.id;
    }

    beforeAll(async () => {
      await prisma.$connect();
      const uni = await prisma.university.create({
        data: { name: `PI WH Uni ${suffix}` },
      });
      universityId = uni.id;
      const org = await prisma.organization.create({
        data: {
          name: `PI WH Org ${suffix}`,
          type: 'FRATERNITY',
          universityId,
          stripeChargesEnabled: true,
        },
      });
      orgId = org.id;
      const buyer = await prisma.user.create({
        data: {
          email: `pi-wh-buyer-${suffix}@example.com`,
          name: 'Buyer',
          passwordHash: 'x',
          status: 'ACTIVE',
        },
      });
      buyerId = buyer.id;
      const event = await prisma.event.create({
        data: {
          organizationId: orgId,
          name: `PI WH Event ${suffix}`,
          type: 'Social',
          maxHeadcount: 20,
          ticketingEnabled: true,
          ticketCapacity: 10,
          ticketSaleStatus: 'on_sale',
        },
      });
      eventId = event.id;
      const allocation = await prisma.ticketAllocation.create({
        data: {
          eventId,
          organizationId: orgId,
          quantity: 10,
          priceCents: 1000,
          status: 'active',
        },
      });
      allocationId = allocation.id;

      const purchase = await prisma.purchase.create({
        data: {
          buyerUserId: buyerId,
          eventId,
          allocationId,
          quantity: 2,
          subtotalCents: 2000,
          feeCents: 200,
          amountCents: 2200,
          netCents: 2000,
          currency: 'usd',
          status: 'requires_payment',
          stripePaymentIntentId: `pi_unpaid_${suffix}`,
        },
      });
      purchaseId = purchase.id;
      const t1 = await prisma.ticket.create({
        data: {
          allocationId,
          status: 'unpaid',
          credentialToken: `unpaid-1-${suffix}`,
          holderUserId: buyerId,
          purchaseId,
        },
      });
      const t2 = await prisma.ticket.create({
        data: {
          allocationId,
          status: 'unpaid',
          credentialToken: `unpaid-2-${suffix}`,
          holderUserId: buyerId,
          purchaseId,
        },
      });
      unpaidTicketIds = [t1.id, t2.id];

      const voidPurchase = await prisma.purchase.create({
        data: {
          buyerUserId: buyerId,
          eventId,
          allocationId,
          quantity: 1,
          subtotalCents: 1000,
          feeCents: 100,
          amountCents: 1100,
          netCents: 1000,
          currency: 'usd',
          status: 'requires_payment',
          stripePaymentIntentId: `pi_void_${suffix}`,
        },
      });
      voidPurchaseId = voidPurchase.id;
      await prisma.ticket.create({
        data: {
          allocationId,
          status: 'void',
          credentialToken: `void-${suffix}`,
          voidedAt: new Date(),
          holderUserId: buyerId,
          purchaseId: voidPurchaseId,
        },
      });
    });

    afterAll(async () => {
      await prisma.webhookEvent.deleteMany({
        where: { externalId: { startsWith: `evt_${suffix}` } },
      });
      await prisma.ticket.deleteMany({ where: { allocationId } });
      await prisma.purchase.deleteMany({ where: { allocationId } });
      await prisma.ticketAllocation.deleteMany({ where: { id: allocationId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.user.deleteMany({ where: { id: buyerId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.university.deleteMany({ where: { id: universityId } });
      await prisma.$disconnect();
    });

    it('payment_intent.succeeded marks all unpaid tickets paid; replay is idempotent', async () => {
      const processor = makeProcessor();
      const piId = `pi_unpaid_${suffix}`;

      await enqueueAndProcess(
        processor,
        'payment_intent.succeeded',
        piId,
        `evt_${suffix}_succeeded_1`,
        { latest_charge: `ch_${suffix}` },
      );

      const tickets = await prisma.ticket.findMany({
        where: { id: { in: unpaidTicketIds } },
      });
      expect(tickets).toHaveLength(2);
      for (const ticket of tickets) {
        expect(ticket.status).toBe('paid');
        expect(ticket.paidAt).not.toBeNull();
      }
      const purchase = await prisma.purchase.findUnique({
        where: { id: purchaseId },
      });
      expect(purchase?.status).toBe('succeeded');
      expect(purchase?.stripeChargeId).toBe(`ch_${suffix}`);
      expect(purchase?.statusMismatch).toBe(false);

      const paidAts = tickets.map((t) => t.paidAt?.getTime());
      await enqueueAndProcess(
        processor,
        'payment_intent.succeeded',
        piId,
        `evt_${suffix}_succeeded_2`,
      );

      const replay = await prisma.ticket.findMany({
        where: { id: { in: unpaidTicketIds } },
      });
      expect(replay.map((t) => t.paidAt?.getTime())).toEqual(paidAts);
    });

    it('payment_intent.payment_failed deletes reserved unpaid tickets', async () => {
      const failedPurchase = await prisma.purchase.create({
        data: {
          buyerUserId: buyerId,
          eventId,
          allocationId,
          quantity: 2,
          subtotalCents: 2000,
          feeCents: 200,
          amountCents: 2200,
          netCents: 2000,
          currency: 'usd',
          status: 'requires_payment',
          stripePaymentIntentId: `pi_failed_${suffix}`,
        },
      });
      await prisma.ticket.create({
        data: {
          allocationId,
          status: 'unpaid',
          credentialToken: `failed-1-${suffix}`,
          holderUserId: buyerId,
          purchaseId: failedPurchase.id,
        },
      });
      await prisma.ticket.create({
        data: {
          allocationId,
          status: 'unpaid',
          credentialToken: `failed-2-${suffix}`,
          holderUserId: buyerId,
          purchaseId: failedPurchase.id,
        },
      });

      const processor = makeProcessor();
      await enqueueAndProcess(
        processor,
        'payment_intent.payment_failed',
        `pi_failed_${suffix}`,
        `evt_${suffix}_failed`,
      );

      expect(
        await prisma.ticket.count({ where: { purchaseId: failedPurchase.id } }),
      ).toBe(0);
      const purchase = await prisma.purchase.findUnique({
        where: { id: failedPurchase.id },
      });
      expect(purchase?.status).toBe('failed');
    });

    it('payment_intent.succeeded on void ticket sets mismatch and keeps void', async () => {
      const processor = makeProcessor();
      await enqueueAndProcess(
        processor,
        'payment_intent.succeeded',
        `pi_void_${suffix}`,
        `evt_${suffix}_void_mismatch`,
      );

      const ticket = await prisma.ticket.findFirst({
        where: { purchaseId: voidPurchaseId },
      });
      expect(ticket?.status).toBe('void');
      const purchase = await prisma.purchase.findUnique({
        where: { id: voidPurchaseId },
      });
      expect(purchase?.status).toBe('succeeded');
      expect(purchase?.statusMismatch).toBe(true);
    });

    it('unknown PaymentIntent completes without error', async () => {
      const processor = makeProcessor();
      await expect(
        enqueueAndProcess(
          processor,
          'payment_intent.succeeded',
          `pi_unknown_${suffix}`,
          `evt_${suffix}_unknown`,
        ),
      ).resolves.toBeDefined();
    });
  },
);
