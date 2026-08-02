import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { StripeModule } from '../stripe/stripe.module';
import { EventTicketingController } from './event-ticketing.controller';
import { TicketPaymentsService } from './ticket-payments.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule, StripeModule],
  controllers: [EventTicketingController, TicketsController],
  providers: [TicketsService, TicketPaymentsService],
  exports: [TicketsService, TicketPaymentsService],
})
export class TicketsModule {}
