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
    let unpaidTicketId = '';
    let voidTicketId = '';

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
                metadata: { ticketId: unpaidTicketId },
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

      const unpaid = await prisma.ticket.create({
        data: {
          allocationId,
          status: 'unpaid',
          credentialToken: `unpaid-${suffix}`,
        },
      });
      unpaidTicketId = unpaid.id;
      await prisma.ticketPayment.create({
        data: {
          ticketId: unpaid.id,
          stripePaymentIntentId: `pi_unpaid_${suffix}`,
          amountCents: 1100,
          feeCents: 100,
          netCents: 1000,
          currency: 'usd',
          status: 'requires_payment',
        },
      });

      const voided = await prisma.ticket.create({
        data: {
          allocationId,
          status: 'void',
          credentialToken: `void-${suffix}`,
          voidedAt: new Date(),
        },
      });
      voidTicketId = voided.id;
      await prisma.ticketPayment.create({
        data: {
          ticketId: voided.id,
          stripePaymentIntentId: `pi_void_${suffix}`,
          amountCents: 1100,
          feeCents: 100,
          netCents: 1000,
          currency: 'usd',
          status: 'requires_payment',
        },
      });
    });

    afterAll(async () => {
      await prisma.webhookEvent.deleteMany({
        where: { externalId: { startsWith: `evt_${suffix}` } },
      });
      await prisma.ticketPayment.deleteMany({
        where: { ticket: { allocationId } },
      });
      await prisma.ticket.deleteMany({ where: { allocationId } });
      await prisma.ticketAllocation.deleteMany({ where: { id: allocationId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.university.deleteMany({ where: { id: universityId } });
      await prisma.$disconnect();
    });

    it('payment_intent.succeeded marks unpaid ticket paid; replay is idempotent', async () => {
      const processor = makeProcessor();
      const piId = `pi_unpaid_${suffix}`;

      await enqueueAndProcess(
        processor,
        'payment_intent.succeeded',
        piId,
        `evt_${suffix}_succeeded_1`,
      );

      const ticket = await prisma.ticket.findUnique({
        where: { id: unpaidTicketId },
      });
      expect(ticket?.status).toBe('paid');
      expect(ticket?.paidAt).not.toBeNull();
      const payment = await prisma.ticketPayment.findUnique({
        where: { ticketId: unpaidTicketId },
      });
      expect(payment?.status).toBe('succeeded');
      expect(payment?.statusMismatch).toBe(false);

      const paidAt = ticket?.paidAt;
      await enqueueAndProcess(
        processor,
        'payment_intent.succeeded',
        piId,
        `evt_${suffix}_succeeded_2`,
      );

      const replay = await prisma.ticket.findUnique({
        where: { id: unpaidTicketId },
      });
      expect(replay?.status).toBe('paid');
      expect(replay?.paidAt?.getTime()).toBe(paidAt?.getTime());
    });

    it('payment_intent.payment_failed leaves ticket unpaid', async () => {
      const failedTicket = await prisma.ticket.create({
        data: {
          allocationId,
          status: 'unpaid',
          credentialToken: `failed-${suffix}`,
        },
      });
      await prisma.ticketPayment.create({
        data: {
          ticketId: failedTicket.id,
          stripePaymentIntentId: `pi_failed_${suffix}`,
          amountCents: 1100,
          feeCents: 100,
          netCents: 1000,
          currency: 'usd',
          status: 'requires_payment',
        },
      });

      const processor = makeProcessor();
      await enqueueAndProcess(
        processor,
        'payment_intent.payment_failed',
        `pi_failed_${suffix}`,
        `evt_${suffix}_failed`,
      );

      const ticket = await prisma.ticket.findUnique({
        where: { id: failedTicket.id },
      });
      expect(ticket?.status).toBe('unpaid');
      const payment = await prisma.ticketPayment.findUnique({
        where: { ticketId: failedTicket.id },
      });
      expect(payment?.status).toBe('failed');
    });

    it('payment_intent.succeeded on void ticket sets mismatch and keeps void', async () => {
      const processor = makeProcessor();
      await enqueueAndProcess(
        processor,
        'payment_intent.succeeded',
        `pi_void_${suffix}`,
        `evt_${suffix}_void_mismatch`,
      );

      const ticket = await prisma.ticket.findUnique({
        where: { id: voidTicketId },
      });
      expect(ticket?.status).toBe('void');
      const payment = await prisma.ticketPayment.findUnique({
        where: { ticketId: voidTicketId },
      });
      expect(payment?.status).toBe('succeeded');
      expect(payment?.statusMismatch).toBe(true);
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
