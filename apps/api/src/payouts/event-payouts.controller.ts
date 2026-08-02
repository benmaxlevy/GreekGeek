import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { PublicUser } from '../auth/types/auth.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  EventPayoutActionResponseSchema,
  EventPayoutIdParamsSchema,
  EventPayoutParamsSchema,
  EventPayoutQueueSchema,
  EventPayoutSummarySchema,
  PayoutReasonSchema,
  type EventPayoutActionResponse,
  type EventPayoutIdParams,
  type EventPayoutParams,
  type EventPayoutQueue,
  type EventPayoutSummary,
  type PayoutReason,
} from './types/event-payout.dto';
import { EventPayoutsService } from './event-payouts.service';

@Controller('events/:eventId/payout')
export class EventPayoutsController {
  constructor(private readonly payouts: EventPayoutsService) {}

  @Get()
  async summary(
    @Param(new ZodValidationPipe(EventPayoutParamsSchema))
    params: EventPayoutParams,
    @CurrentUser() caller: PublicUser,
  ): Promise<EventPayoutSummary> {
    return EventPayoutSummarySchema.parse(await this.payouts.getSummary(params.eventId, caller));
  }
}

@Controller('admin/event-payouts')
export class AdminEventPayoutsController {
  constructor(private readonly payouts: EventPayoutsService) {}

  @Get()
  async queue(@CurrentUser() caller: PublicUser): Promise<EventPayoutQueue> {
    return EventPayoutQueueSchema.parse(await this.payouts.listQueue(caller));
  }

  @Post(':eventId/release')
  async release(
    @Param(new ZodValidationPipe(EventPayoutParamsSchema))
    params: EventPayoutParams,
    @Body(new ZodValidationPipe(PayoutReasonSchema)) body: PayoutReason,
    @CurrentUser() caller: PublicUser,
  ): Promise<EventPayoutActionResponse> {
    return EventPayoutActionResponseSchema.parse(
      await this.payouts.release(
        params.eventId,
        {
          eventId: params.eventId,
          mode: 'manual',
          reason: body.reason,
        },
        caller,
      ),
    );
  }

  @Post(':eventId/payouts/:payoutId/retry')
  async retry(
    @Param(new ZodValidationPipe(EventPayoutIdParamsSchema))
    params: EventPayoutIdParams,
    @Body(new ZodValidationPipe(PayoutReasonSchema)) body: PayoutReason,
    @CurrentUser() caller: PublicUser,
  ): Promise<EventPayoutActionResponse> {
    return EventPayoutActionResponseSchema.parse(
      await this.payouts.retry(params.eventId, params.payoutId, body.reason, caller),
    );
  }
}

@Controller('admin/payouts')
export class AdminPayoutQueueController {
  constructor(private readonly payouts: EventPayoutsService) {}

  @Get()
  async queue(@CurrentUser() caller: PublicUser): Promise<EventPayoutQueue> {
    return EventPayoutQueueSchema.parse(await this.payouts.listQueue(caller));
  }
}
