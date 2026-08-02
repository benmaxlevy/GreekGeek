import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  ListWebhookEventsQuerySchema,
  RequeueWebhookEventResponseSchema,
  WebhookEventListSchema,
  type ListWebhookEventsQuery,
  type RequeueWebhookEventResponse,
  type WebhookEventList,
} from './types/webhook-events.dto';
import { WebhookEventsService } from './webhook-events.service';

@Controller('admin/webhook-events')
@Roles('ADMIN')
export class AdminWebhookEventsController {
  constructor(private readonly webhookEvents: WebhookEventsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListWebhookEventsQuerySchema))
    query: ListWebhookEventsQuery,
  ): Promise<WebhookEventList> {
    const events = await this.webhookEvents.list(query);
    return WebhookEventListSchema.parse(events);
  }

  @Post(':id/requeue')
  async requeue(
    @Param('id') id: string,
  ): Promise<RequeueWebhookEventResponse> {
    const result = await this.webhookEvents.requeue(id);
    return RequeueWebhookEventResponseSchema.parse(result);
  }
}
