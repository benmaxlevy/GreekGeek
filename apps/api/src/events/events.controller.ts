import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequireOrgPermission } from '../permissions/decorators/require-org-permission.decorator';
import { OrgPermissionGuard } from '../permissions/guards/org-permission.guard';
import { EventsService } from './events.service';
import {
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  HoldEventSchema,
  ListEventsQuerySchema,
  UpdateEventSchema,
  type CreateEvent,
  type Event,
  type EventList,
  type HoldEvent,
  type ListEventsQuery,
  type UpdateEvent,
} from './types/events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListEventsQuerySchema))
    query: ListEventsQuery,
    @CurrentUser() caller: PublicUser,
  ): Promise<EventList> {
    return EventListSchema.parse(await this.eventsService.list(query, caller));
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() caller: PublicUser): Promise<Event> {
    return EventSchema.parse(await this.eventsService.get(id, caller));
  }

  @Post()
  @UseGuards(OrgPermissionGuard)
  @RequireOrgPermission('events.create')
  async create(
    @Body(new ZodValidationPipe(CreateEventSchema)) body: CreateEvent,
    @CurrentUser() caller: PublicUser,
  ): Promise<Event> {
    return EventSchema.parse(await this.eventsService.create(body, caller));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEventSchema)) body: UpdateEvent,
    @CurrentUser() caller: PublicUser,
  ): Promise<Event> {
    return EventSchema.parse(await this.eventsService.update(id, body, caller));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() caller: PublicUser): Promise<void> {
    await this.eventsService.remove(id, caller);
  }

  @Post(':id/hold')
  async hold(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HoldEventSchema)) body: HoldEvent,
    @CurrentUser() caller: PublicUser,
  ): Promise<Event> {
    return EventSchema.parse(await this.eventsService.hold(id, body.reason, caller));
  }

  @Post(':id/clear-hold')
  async clearHold(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HoldEventSchema)) body: HoldEvent,
    @CurrentUser() caller: PublicUser,
  ): Promise<Event> {
    return EventSchema.parse(await this.eventsService.clearHold(id, body.reason, caller));
  }
}
