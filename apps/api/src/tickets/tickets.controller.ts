import { Controller, Get, Param, Post } from '@nestjs/common';
import { EventListSchema, type EventList } from '@rally/contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { toEventDto } from '../events/types/events.dto';
import { TicketsService } from './tickets.service';
import {
  MyTicketListSchema,
  TicketSchema,
  type MyTicketList,
  type Ticket,
} from './types/ticketing.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('mine')
  async listMine(@CurrentUser() caller: PublicUser): Promise<MyTicketList> {
    return MyTicketListSchema.parse(
      await this.ticketsService.listMine(caller),
    );
  }

  @Get('claimable')
  async listClaimable(@CurrentUser() caller: PublicUser): Promise<EventList> {
    const rows = await this.ticketsService.listClaimableEvents(caller);
    return EventListSchema.parse(rows.map(toEventDto));
  }

  @Post(':id/mark-paid')
  async markPaid(
    @Param('id') id: string,
    @CurrentUser() caller: PublicUser,
  ): Promise<Ticket> {
    return TicketSchema.parse(
      await this.ticketsService.markPaid(id, caller),
    );
  }

  @Post(':id/void')
  async voidTicket(
    @Param('id') id: string,
    @CurrentUser() caller: PublicUser,
  ): Promise<Ticket> {
    return TicketSchema.parse(
      await this.ticketsService.voidTicket(id, caller),
    );
  }
}
