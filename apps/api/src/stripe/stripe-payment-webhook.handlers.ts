import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import type { WebhookHandlerContext } from '../webhooks/types/webhook-handler.dto';
import {
  STRIPE_PAYMENT_INTENT_WEBHOOK_TYPES,
  extractPaymentIntentId,
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
    const payment = await this.findTicketPayment(ctx);
    if (!payment) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM "Ticket" WHERE id = ${payment.ticketId} FOR UPDATE
      `;
      const ticket = locked[0];
      if (!ticket) {
        this.logger.warn(
          `payment_intent.succeeded ticket missing ticketId=${payment.ticketId} webhookEventId=${ctx.webhookEventId}`,
        );
        return;
      }

      if (ticket.status === 'unpaid') {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'paid', paidAt: new Date() },
        });
        await tx.ticketPayment.update({
          where: { id: payment.id },
          data: { status: 'succeeded', statusMismatch: false },
        });
        return;
      }

      if (ticket.status === 'void') {
        await tx.ticketPayment.update({
          where: { id: payment.id },
          data: { status: 'succeeded', statusMismatch: true },
        });
        this.logger.warn(
          `payment_intent.succeeded on void ticket ticketId=${ticket.id} statusMismatch=true webhookEventId=${ctx.webhookEventId}`,
        );
        return;
      }

      // already paid (or other): mark payment succeeded, leave ticket
      await tx.ticketPayment.update({
        where: { id: payment.id },
        data: { status: 'succeeded' },
      });
    });
  }

  async handleFailed(ctx: WebhookHandlerContext): Promise<void> {
    const payment = await this.findTicketPayment(ctx);
    if (!payment) {
      return;
    }
    await this.prisma.ticketPayment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
  }

  async handleCanceled(ctx: WebhookHandlerContext): Promise<void> {
    const payment = await this.findTicketPayment(ctx);
    if (!payment) {
      return;
    }
    await this.prisma.ticketPayment.update({
      where: { id: payment.id },
      data: { status: 'canceled' },
    });
  }

  private async findTicketPayment(ctx: WebhookHandlerContext): Promise<{
    id: string;
    ticketId: string;
  } | null> {
    const piId = extractPaymentIntentId(ctx.payload);
    if (!piId) {
      this.logger.warn(
        `PaymentIntent webhook missing pi id type=${ctx.type} webhookEventId=${ctx.webhookEventId}`,
      );
      return null;
    }

    const payment = await this.prisma.ticketPayment.findUnique({
      where: { stripePaymentIntentId: piId },
      select: { id: true, ticketId: true },
    });

    if (!payment) {
      this.logger.log(
        `PaymentIntent webhook unknown pi=${piId} type=${ctx.type} webhookEventId=${ctx.webhookEventId}`,
      );
      return null;
    }

    return payment;
  }
}
