import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import type { WebhookHandlerContext } from '../webhooks/types/webhook-handler.dto';
import { StripeService } from './stripe.service';
import { syncOrgFromStripeAccount } from './stripe-sync';
import {
  STRIPE_CONNECT_WEBHOOK_TYPES,
  StripeConnectWebhookPayloadSchema,
} from './types/stripe-webhook.dto';

function parseEventTimestamp(created: number | string | undefined): Date {
  if (typeof created === 'number') {
    // v1 Events use unix seconds
    return new Date(created * 1000);
  }
  if (typeof created === 'string' && created.length > 0) {
    const parsed = new Date(created);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/** Extract Connect account id from v1 snapshot or v2 thin event payloads. */
export function extractStripeAccountId(payload: unknown): string | null {
  const parsed = StripeConnectWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  const body = parsed.data;

  if (body.related_object?.id) {
    return body.related_object.id;
  }

  const obj = body.data?.object;
  if (obj) {
    if (typeof obj.account === 'string' && obj.account.length > 0) {
      return obj.account;
    }
    if (
      typeof obj.id === 'string' &&
      (obj.object === 'account' || obj.id.startsWith('acct_'))
    ) {
      return obj.id;
    }
  }

  if (typeof body.account === 'string' && body.account.length > 0) {
    return body.account;
  }

  return null;
}

/**
 * Registers Stripe Connect account/capability handlers on the webhook inbox registry.
 * Handler: resolve org by stripeAccountId → refetch account → sync flags.
 * Unknown account ids log and complete (no throw → no retry storm).
 */
@Injectable()
export class StripeWebhookHandlers implements OnModuleInit {
  private readonly logger = new Logger(StripeWebhookHandlers.name);

  constructor(
    private readonly registry: WebhookHandlerRegistry,
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  onModuleInit(): void {
    const handler = (ctx: WebhookHandlerContext) => this.handleConnectEvent(ctx);
    for (const type of STRIPE_CONNECT_WEBHOOK_TYPES) {
      this.registry.register(type, handler);
    }
  }

  async handleConnectEvent(ctx: WebhookHandlerContext): Promise<void> {
    const parsed = StripeConnectWebhookPayloadSchema.safeParse(ctx.payload);
    const accountId = extractStripeAccountId(ctx.payload);

    if (!accountId) {
      this.logger.warn(
        `Stripe Connect webhook missing account id type=${ctx.type} webhookEventId=${ctx.webhookEventId}`,
      );
      return;
    }

    const org = await this.prisma.organization.findUnique({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });

    if (!org) {
      this.logger.log(
        `Stripe Connect webhook unknown stripeAccountId=${accountId} type=${ctx.type} webhookEventId=${ctx.webhookEventId}`,
      );
      return;
    }

    const eventTimestamp = parseEventTimestamp(parsed.success ? parsed.data.created : undefined);

    const account = await this.stripe.retrieveAccount(accountId);
    await syncOrgFromStripeAccount(this.prisma, org.id, account, {
      eventTimestamp,
      refetchAccount: () => this.stripe.retrieveAccount(accountId),
    });
  }
}
