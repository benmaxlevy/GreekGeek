import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StripeModule } from './stripe/stripe.module';
import { PurchasesModule } from './tickets/purchases.module';
import { PurchaseTtlSweepProcessor } from './tickets/purchase-ttl-sweep.processor';
import { WebhookProcessProcessor } from './webhooks/webhook-process.processor';

/**
 * Worker process root — queue processors only (no HTTP server).
 * StripeModule registers Connect webhook handlers and exports the handler registry.
 * PurchasesModule provides PurchasesService for TTL sweep (no ticket HTTP controllers).
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueueModule,
    StripeModule,
    PurchasesModule,
  ],
  providers: [WebhookProcessProcessor, PurchaseTtlSweepProcessor],
})
export class WorkerModule {}
