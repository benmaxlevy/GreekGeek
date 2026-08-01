import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TicketsService } from './tickets.service';
import {
  CreateTicketAllocationSchema,
  EventTicketingSchema,
  GuestListSchema,
  IssueTicketSchema,
  ListTicketsQuerySchema,
  PatchEventTicketingSchema,
  TicketAllocationListSchema,
  TicketAllocationSchema,
  TicketListSchema,
  TicketSchema,
  UpdateTicketAllocationSchema,
  type CreateTicketAllocation,
  type EventTicketing,
  type GuestList,
  type IssueTicket,
  type ListTicketsQuery,
  type PatchEventTicketing,
  type Ticket,
  type TicketAllocation,
  type TicketAllocationList,
  type TicketList,
  type UpdateTicketAllocation,
} from './types/ticketing.dto';

@Controller('events')
export class EventTicketingController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Patch(':id/ticketing')
  async patchTicketing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PatchEventTicketingSchema))
    body: PatchEventTicketing,
    @CurrentUser() caller: PublicUser,
  ): Promise<EventTicketing> {
    return EventTicketingSchema.parse(
      await this.ticketsService.patchTicketing(id, body, caller),
    );
  }

  @Get(':eventId/allocations')
  async listAllocations(
    @Param('eventId') eventId: string,
    @CurrentUser() caller: PublicUser,
  ): Promise<TicketAllocationList> {
    return TicketAllocationListSchema.parse(
      await this.ticketsService.listAllocations(eventId, caller),
    );
  }

  @Post(':eventId/allocations')
  async createAllocation(
    @Param('eventId') eventId: string,
    @Body(new ZodValidationPipe(CreateTicketAllocationSchema))
    body: CreateTicketAllocation,
    @CurrentUser() caller: PublicUser,
  ): Promise<TicketAllocation | TicketAllocationList> {
    const result = await this.ticketsService.createAllocation(
      eventId,
      body,
      caller,
    );
    if (Array.isArray(result)) {
      return TicketAllocationListSchema.parse(result);
    }
    return TicketAllocationSchema.parse(result);
  }

  @Patch(':eventId/allocations/:allocationId')
  async updateAllocation(
    @Param('eventId') eventId: string,
    @Param('allocationId') allocationId: string,
    @Body(new ZodValidationPipe(UpdateTicketAllocationSchema))
    body: UpdateTicketAllocation,
    @CurrentUser() caller: PublicUser,
  ): Promise<TicketAllocation> {
    return TicketAllocationSchema.parse(
      await this.ticketsService.updateAllocation(
        eventId,
        allocationId,
        body,
        caller,
      ),
    );
  }

  @Post(':eventId/allocations/:allocationId/tickets')
  async issueTicket(
    @Param('eventId') eventId: string,
    @Param('allocationId') allocationId: string,
    @Body(new ZodValidationPipe(IssueTicketSchema)) body: IssueTicket,
    @CurrentUser() caller: PublicUser,
  ): Promise<Ticket> {
    return TicketSchema.parse(
      await this.ticketsService.issueTicket(
        eventId,
        allocationId,
        body,
        caller,
      ),
    );
  }

  @Get(':eventId/tickets')
  async listTickets(
    @Param('eventId') eventId: string,
    @Query(new ZodValidationPipe(ListTicketsQuerySchema))
    query: ListTicketsQuery,
    @CurrentUser() caller: PublicUser,
  ): Promise<TicketList> {
    return TicketListSchema.parse(
      await this.ticketsService.listTickets(eventId, query, caller),
    );
  }

  @Get(':eventId/guest-list')
  async guestList(
    @Param('eventId') eventId: string,
    @CurrentUser() caller: PublicUser,
  ): Promise<GuestList> {
    return GuestListSchema.parse(
      await this.ticketsService.guestList(eventId, caller),
    );
  }

  @Post(':eventId/public-claim')
  async publicClaim(
    @Param('eventId') eventId: string,
    @CurrentUser() caller: PublicUser,
  ): Promise<Ticket> {
    return TicketSchema.parse(
      await this.ticketsService.publicClaim(eventId, caller),
    );
  }
}
