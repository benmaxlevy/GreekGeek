import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { StripeModule } from '../stripe/stripe.module';
import { EventTicketingController } from './event-ticketing.controller';
import { PurchasesController } from './purchases.controller';
import { PurchasesModule } from './purchases.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule, StripeModule, PurchasesModule],
  controllers: [
    EventTicketingController,
    TicketsController,
    PurchasesController,
  ],
  providers: [TicketsService],
  exports: [TicketsService, PurchasesModule],
})
export class TicketsModule {}
