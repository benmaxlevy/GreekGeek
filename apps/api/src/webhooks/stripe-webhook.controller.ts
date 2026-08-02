import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WebhookEventsService } from './webhook-events.service';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(private readonly webhookEvents: WebhookEventsService) {}

  @Post('stripe')
  @Public()
  @HttpCode(200)
  async handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body unavailable for Stripe webhook verification',
      );
    }

    await this.webhookEvents.ingestStripeWebhook(rawBody, signature);
    return { received: true };
  }
}
