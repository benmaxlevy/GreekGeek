import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { AdminWebhookEventsController } from './admin-webhook-events.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [StripeWebhookController, AdminWebhookEventsController],
  providers: [WebhookEventsService],
  exports: [WebhookEventsService],
})
export class WebhooksModule {}
