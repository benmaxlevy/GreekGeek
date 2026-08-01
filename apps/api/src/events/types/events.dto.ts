import {
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  ListEventsQuerySchema,
  UpdateEventSchema,
  type CreateEvent,
  type Event,
  type EventList,
  type ListEventsQuery,
  type UpdateEvent,
} from '@rally/contracts';

export {
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  ListEventsQuerySchema,
  UpdateEventSchema,
};

export type {
  CreateEvent,
  Event,
  EventList,
  ListEventsQuery,
  UpdateEvent,
};

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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
