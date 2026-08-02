import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type {
  ListWebhookEventsQuery,
  RequeueWebhookEventResponse,
  WebhookEvent,
  WebhookEventList,
} from './types/webhook-events.dto';
import type { WebhookProcessJob } from './types/webhook-process-job.dto';

function toWebhookEventDto(row: {
  id: string;
  service: string;
  externalId: string;
  type: string;
  payload: Prisma.JsonValue;
  receivedAt: Date;
  processedAt: Date | null;
  attempts: number;
  lastError: string | null;
}): WebhookEvent {
  return {
    id: row.id,
    service: row.service,
    externalId: row.externalId,
    type: row.type,
    payload: row.payload,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
    attempts: row.attempts,
    lastError: row.lastError,
  };
}

@Injectable()
export class WebhookEventsService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUE_NAMES.webhookProcess)
    private readonly webhookProcessQueue: Queue<WebhookProcessJob>,
  ) {
    // API key unused for signature verify; constructEvent only needs webhook secret.
    this.stripe = new Stripe('sk_test_unused_webhook_only');
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
  }

  /**
   * Verify Stripe signature, insert inbox row, enqueue process job.
   * Duplicate (service, externalId) → no enqueue. Bad signature → 400.
   */
  async ingestStripeWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ duplicate: boolean; webhookEventId?: string }> {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    try {
      const row = await this.prisma.webhookEvent.create({
        data: {
          service: 'stripe',
          externalId: event.id,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });

      await this.webhookProcessQueue.add(QUEUE_NAMES.webhookProcess, {
        webhookEventId: row.id,
      });

      return { duplicate: false, webhookEventId: row.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { duplicate: true };
      }
      throw error;
    }
  }

  async list(query: ListWebhookEventsQuery): Promise<WebhookEventList> {
    const where =
      query.status === 'unprocessed'
        ? { processedAt: null }
        : query.status === 'failed'
          ? { processedAt: null, lastError: { not: null } }
          : {};

    const rows = await this.prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
    });

    return rows.map(toWebhookEventDto);
  }

  async requeue(id: string): Promise<RequeueWebhookEventResponse> {
    const row = await this.prisma.webhookEvent.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Webhook event not found');
    }
    if (row.processedAt) {
      throw new BadRequestException(
        'Webhook event already processed; cannot requeue',
      );
    }

    const job = await this.webhookProcessQueue.add(
      QUEUE_NAMES.webhookProcess,
      { webhookEventId: row.id },
    );

    return {
      jobId: String(job.id),
      webhookEventId: row.id,
    };
  }
}
