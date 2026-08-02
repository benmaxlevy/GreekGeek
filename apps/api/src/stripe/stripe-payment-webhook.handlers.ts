import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import type { WebhookHandlerContext } from '../webhooks/types/webhook-handler.dto';
import {
  STRIPE_PAYMENT_INTENT_WEBHOOK_TYPES,
  extractPaymentIntentId,
  extractStripeChargeId,
} from './types/stripe-payment-webhook.dto';

/**
 * Registers payment_intent.* handlers on the webhook inbox registry.
 * Unknown PaymentIntents log and complete (no throw → no retry storm).
 */
@Injectable()
export class StripePaymentWebhookHandlers implements OnModuleInit {
  private readonly logger = new Logger(StripePaymentWebhookHandlers.name);

  constructor(
    private readonly registry: WebhookHandlerRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const type of STRIPE_PAYMENT_INTENT_WEBHOOK_TYPES) {
      this.registry.register(type, (ctx) => this.dispatch(type, ctx));
    }
  }

  private dispatch(
    type: (typeof STRIPE_PAYMENT_INTENT_WEBHOOK_TYPES)[number],
    ctx: WebhookHandlerContext,
  ): Promise<void> {
    if (type === 'payment_intent.succeeded') {
      return this.handleSucceeded(ctx);
    }
    if (type === 'payment_intent.payment_failed') {
      return this.handleFailed(ctx);
    }
    return this.handleCanceled(ctx);
  }

  async handleSucceeded(ctx: WebhookHandlerContext): Promise<void> {
    const purchase = await this.findPurchase(ctx);
    if (!purchase) {
      return;
    }

    const chargeId = extractStripeChargeId(ctx.payload);

    await this.prisma.$transaction(async (tx) => {
      const lockedPurchase = await tx.$queryRaw<
        { id: string; status: string }[]
      >`
        SELECT id, status FROM "Purchase" WHERE id = ${purchase.id} FOR UPDATE
      `;
      const row = lockedPurchase[0];
      if (!row) {
        return;
      }

      const tickets = await tx.ticket.findMany({
        where: { purchaseId: purchase.id },
        select: { id: true, status: true },
      });

      // Lock ticket rows
      for (const t of tickets) {
        await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${t.id} FOR UPDATE`;
      }

      const refreshed = await tx.ticket.findMany({
        where: { purchaseId: purchase.id },
        select: { id: true, status: true },
      });

      let statusMismatch = false;
      const now = new Date();

      for (const ticket of refreshed) {
        if (ticket.status === 'unpaid') {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: 'paid', paidAt: now },
          });
        } else if (ticket.status === 'void') {
          statusMismatch = true;
        }
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: 'succeeded',
          statusMismatch,
          ...(chargeId ? { stripeChargeId: chargeId } : {}),
        },
      });

      if (statusMismatch) {
        this.logger.warn(
          `payment_intent.succeeded with void ticket(s) purchaseId=${purchase.id} statusMismatch=true webhookEventId=${ctx.webhookEventId}`,
        );
      }
    });
  }

  async handleFailed(ctx: WebhookHandlerContext): Promise<void> {
    const purchase = await this.findPurchase(ctx);
    if (!purchase) {
      return;
    }
    await this.releasePurchaseTickets(purchase.id, 'failed');
  }

  async handleCanceled(ctx: WebhookHandlerContext): Promise<void> {
    const purchase = await this.findPurchase(ctx);
    if (!purchase) {
      return;
    }
    await this.releasePurchaseTickets(purchase.id, 'canceled');
  }

  private async releasePurchaseTickets(
    purchaseId: string,
    status: 'failed' | 'canceled',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.purchase.findUnique({ where: { id: purchaseId } });
      if (!locked || locked.status !== 'requires_payment') {
        return;
      }
      await tx.ticket.deleteMany({
        where: { purchaseId, status: 'unpaid' },
      });
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status },
      });
    });
  }

  private async findPurchase(ctx: WebhookHandlerContext): Promise<{
    id: string;
  } | null> {
    const piId = extractPaymentIntentId(ctx.payload);
    if (!piId) {
      this.logger.warn(
        `PaymentIntent webhook missing pi id type=${ctx.type} webhookEventId=${ctx.webhookEventId}`,
      );
      return null;
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { stripePaymentIntentId: piId },
      select: { id: true },
    });

    if (!purchase) {
      this.logger.log(
        `PaymentIntent webhook unknown pi=${piId} type=${ctx.type} webhookEventId=${ctx.webhookEventId}`,
      );
      return null;
    }

    return purchase;
  }
}
