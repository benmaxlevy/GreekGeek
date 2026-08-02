import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { WebhookProcessProcessor } from './webhooks/webhook-process.processor';

/**
 * Worker process root — queue processors only (no HTTP controllers).
 */
@Module({
  imports: [AppConfigModule, PrismaModule, QueueModule],
  providers: [WebhookProcessProcessor],
})
export class WorkerModule {}
