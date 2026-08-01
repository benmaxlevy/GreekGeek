import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { EventTicketingController } from './event-ticketing.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule],
  controllers: [EventTicketingController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
