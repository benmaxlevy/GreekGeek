import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { StripeModule } from '../stripe/stripe.module';
import { EventTicketingController } from './event-ticketing.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule, StripeModule],
  controllers: [EventTicketingController, TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
