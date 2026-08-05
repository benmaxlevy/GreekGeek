import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import {
  ClaimableEventListSchema,
  type ClaimableEventList,
} from '@greekgeek/contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TicketsService } from './tickets.service';
import {
  CheckInTicketSchema,
  CheckInTicketResponseSchema,
  MyTicketListSchema,
  TicketSchema,
  type CheckInTicket,
  type CheckInTicketResponse,
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
  async listClaimable(
    @CurrentUser() caller: PublicUser,
  ): Promise<ClaimableEventList> {
    return ClaimableEventListSchema.parse(
      await this.ticketsService.listClaimableEvents(caller),
    );
  }

  @Post('check-in')
  async checkIn(
    @Body(new ZodValidationPipe(CheckInTicketSchema)) body: CheckInTicket,
    @CurrentUser() caller: PublicUser,
  ): Promise<CheckInTicketResponse> {
    return CheckInTicketResponseSchema.parse(
      await this.ticketsService.checkIn(body, caller),
    );
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
