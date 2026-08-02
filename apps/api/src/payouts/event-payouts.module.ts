import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import {
  AdminEventPayoutsController,
  AdminPayoutQueueController,
  EventPayoutsController,
} from './event-payouts.controller';
import { EventPayoutsService } from './event-payouts.service';

@Module({
  imports: [PrismaModule, StripeModule],
  controllers: [EventPayoutsController, AdminEventPayoutsController, AdminPayoutQueueController],
  providers: [EventPayoutsService],
  exports: [EventPayoutsService],
})
export class EventPayoutsModule {}
