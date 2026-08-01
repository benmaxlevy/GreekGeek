import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { EventTicketingController } from './event-ticketing.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule],
  controllers: [EventTicketingController, TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
