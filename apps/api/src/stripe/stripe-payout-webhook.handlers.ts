import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import type { WebhookHandlerContext } from '../webhooks/types/webhook-handler.dto';
import {
  extractReferenceId,
  extractWebhookObject,
  STRIPE_PAYOUT_WEBHOOK_TYPES,
} from './types/stripe-payout-webhook.dto';

@Injectable()
export class StripePayoutWebhookHandlers implements OnModuleInit {
  constructor(
    private readonly registry: WebhookHandlerRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const type of STRIPE_PAYOUT_WEBHOOK_TYPES) {
      this.registry.register(type, (ctx) => this.dispatch(ctx));
    }
  }

  private async dispatch(ctx: WebhookHandlerContext): Promise<void> {
    if (
      ctx.type === 'charge.dispute.created' ||
      ctx.type === 'charge.refunded' ||
      ctx.type === 'charge.refund.updated'
    ) {
      await this.handleChargeRisk(ctx, this.reasonForChargeType(ctx.type));
      return;
    }
    if (ctx.type === 'transfer.created') {
      await this.handleTransferCreated(ctx);
      return;
    }
    await this.handleTransferFailed(ctx);
  }

  private async handleChargeRisk(
    ctx: WebhookHandlerContext,
    reason: 'disputed' | 'refunded',
  ): Promise<void> {
    const object = extractWebhookObject(ctx.payload);
    const chargeId = extractReferenceId(object?.charge) ?? object?.id;
    const paymentIntentId = extractReferenceId(object?.payment_intent);
    if (!chargeId && !paymentIntentId) {
      return;
    }
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        OR: [
          ...(chargeId ? [{ stripeChargeId: chargeId }] : []),
          ...(paymentIntentId ? [{ stripePaymentIntentId: paymentIntentId }] : []),
        ],
      },
      select: { id: true, eventPayoutId: true },
    });
    if (!purchase) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { payoutExcludedReason: reason },
      });
      if (purchase.eventPayoutId) {
        await tx.eventPayout.update({
          where: { id: purchase.eventPayoutId },
          data: { postReleaseExposure: true },
        });
      }
    });
  }

  private async handleTransferCreated(ctx: WebhookHandlerContext): Promise<void> {
    const object = extractWebhookObject(ctx.payload);
    const transferId = object?.id;
    if (!transferId) {
      return;
    }
    const payout = await this.findPayout(transferId, object?.metadata);
    if (!payout) {
      return;
    }
    await this.prisma.eventPayout.update({
      where: { id: payout.id },
      data: {
        stripeTransferId: payout.stripeTransferId ?? transferId,
        ...(payout.status === 'pending' ? { status: 'released', releasedAt: new Date() } : {}),
        lastError: null,
      },
    });
  }

  private async handleTransferFailed(ctx: WebhookHandlerContext): Promise<void> {
    const object = extractWebhookObject(ctx.payload);
    const transferId = object?.id;
    const payout = await this.findPayout(transferId, object?.metadata);
    if (!payout || payout.status === 'released') {
      return;
    }
    const error = object?.failure_message ?? `Stripe event ${ctx.type}`;
    await this.prisma.eventPayout.update({
      where: { id: payout.id },
      data: {
        stripeTransferId: payout.stripeTransferId ?? transferId,
        status: 'failed',
        lastError: error.replace(/\s+/g, ' ').slice(0, 240),
      },
    });
  }

  private async findPayout(
    transferId: string | undefined,
    metadata: Record<string, string> | undefined,
  ) {
    if (transferId) {
      const byTransfer = await this.prisma.eventPayout.findUnique({
        where: { stripeTransferId: transferId },
      });
      if (byTransfer) {
        return byTransfer;
      }
    }
    const payoutId = metadata?.payoutId;
    if (payoutId) {
      return this.prisma.eventPayout.findUnique({ where: { id: payoutId } });
    }
    const eventId = metadata?.eventId;
    const batchSeq = Number(metadata?.batchSeq);
    if (eventId && Number.isInteger(batchSeq)) {
      return this.prisma.eventPayout.findUnique({
        where: { eventId_batchSeq: { eventId, batchSeq } },
      });
    }
    return null;
  }

  private reasonForChargeType(
    type: 'charge.dispute.created' | 'charge.refunded' | 'charge.refund.updated',
  ): 'disputed' | 'refunded' {
    return type === 'charge.dispute.created' ? 'disputed' : 'refunded';
  }
}
