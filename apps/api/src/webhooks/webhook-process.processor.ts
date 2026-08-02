import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { WebhookProcessJob } from './types/webhook-process-job.dto';
import { WebhookHandlerRegistry } from './webhook-handler.registry';

@Processor(QUEUE_NAMES.webhookProcess)
export class WebhookProcessProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly handlers: WebhookHandlerRegistry,
  ) {
    super();
  }

  async process(job: Job<WebhookProcessJob>): Promise<void> {
    const { webhookEventId } = job.data;

    try {
      const event = await this.prisma.webhookEvent.findUnique({
        where: { id: webhookEventId },
      });

      if (!event) {
        this.logger.warn(
          `Webhook process skipped missing id=${webhookEventId} job=${job.id}`,
        );
        return;
      }

      if (event.processedAt) {
        return;
      }

      const handler = this.handlers.get(event.type);
      if (handler) {
        await handler({
          type: event.type,
          payload: event.payload,
          webhookEventId: event.id,
        });
      }

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processedAt: new Date(),
          lastError: null,
        },
      });

      this.logger.log(
        `Webhook processed id=${event.id} service=${event.service} type=${event.type} job=${job.id}`,
      );
    } catch (error) {
      const payloadKeys = Object.keys(job.data ?? {});
      this.logger.error(
        `Webhook process failed id=${job.id} keys=${payloadKeys.join(',')}`,
      );

      const message =
        error instanceof Error ? error.message : String(error);

      try {
        await this.prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            attempts: { increment: 1 },
            lastError: message.slice(0, 2000),
          },
        });
      } catch (updateError) {
        this.logger.error(
          `Webhook failure bookkeeping failed id=${job.id} keys=${payloadKeys.join(',')}`,
        );
        void updateError;
      }

      throw error;
    }
  }
}
