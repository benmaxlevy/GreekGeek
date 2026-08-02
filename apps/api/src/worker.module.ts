import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StripeModule } from './stripe/stripe.module';
import { WebhookProcessProcessor } from './webhooks/webhook-process.processor';

/**
 * Worker process root — queue processors only (no HTTP server).
 * StripeModule registers Connect webhook handlers and exports the handler registry.
 */
@Module({
  imports: [AppConfigModule, PrismaModule, QueueModule, StripeModule],
  providers: [WebhookProcessProcessor],
})
export class WorkerModule {}
