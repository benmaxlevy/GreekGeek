import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { StripeModule } from '../stripe/stripe.module';
import { EventTicketingController } from './event-ticketing.controller';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule, StripeModule],
  controllers: [
    EventTicketingController,
    TicketsController,
    PurchasesController,
  ],
  providers: [TicketsService, PurchasesService],
  exports: [TicketsService, PurchasesService],
})
export class TicketsModule {}
