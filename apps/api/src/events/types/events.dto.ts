import {
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  ListEventsQuerySchema,
  PayoutReasonSchema,
  UpdateEventSchema,
  type CreateEvent,
  type Event,
  type EventList,
  type ListEventsQuery,
  type PayoutReason,
  type UpdateEvent,
} from '@greekgeek/contracts';

export {
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  ListEventsQuerySchema,
  PayoutReasonSchema,
  UpdateEventSchema,
};

export type { CreateEvent, Event, EventList, ListEventsQuery, PayoutReason, UpdateEvent };

export const HoldEventSchema = PayoutReasonSchema;
export type HoldEvent = PayoutReason;

export function toEventDto(row: {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  maxHeadcount: number;
  location: string | null;
  ticketingEnabled: boolean;
  ticketCapacity: number | null;
  ticketSaleStatus: 'draft' | 'on_sale' | 'closed' | null;
  ticketSalesOpenAt: Date | null;
  ticketSalesCloseAt: Date | null;
  startsAt: Date;
  endsAt: Date | null;
  heldAt: Date | null;
  heldByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Event {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    type: row.type,
    maxHeadcount: row.maxHeadcount,
    location: row.location,
    ticketingEnabled: row.ticketingEnabled,
    ticketCapacity: row.ticketCapacity,
    ticketSaleStatus: row.ticketSaleStatus,
    ticketSalesOpenAt: row.ticketSalesOpenAt?.toISOString() ?? null,
    ticketSalesCloseAt: row.ticketSalesCloseAt?.toISOString() ?? null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    heldAt: row.heldAt?.toISOString() ?? null,
    heldByUserId: row.heldByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
