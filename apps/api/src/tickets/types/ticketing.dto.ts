import {
  EventTicketingSchema,
  GuestListEntrySchema,
  MyTicketSchema,
  PatchEventTicketingSchema,
  TicketAllocationListSchema,
  TicketAllocationSchema,
  TicketListSchema,
  TicketSchema,
  type EventTicketing,
  type GuestListEntry,
  type MyTicket,
  type PatchEventTicketing,
  type Ticket,
  type TicketAllocation,
} from '@rally/contracts';
import type {
  AllocationStatus,
  Event,
  TicketAllocation as TicketAllocationRow,
  Ticket as TicketRow,
  TicketSaleStatus,
  TicketStatus,
} from '@prisma/client';

export {
  EventTicketingSchema,
  PatchEventTicketingSchema,
  TicketAllocationSchema,
  TicketAllocationListSchema,
  CreateTicketAllocationSchema,
  UpdateTicketAllocationSchema,
  TicketSchema,
  TicketListSchema,
  IssueTicketSchema,
  ListTicketsQuerySchema,
  GuestListEntrySchema,
  GuestListSchema,
  MyTicketSchema,
  MyTicketListSchema,
  PublicClaimResponseSchema,
} from '@rally/contracts';

export type {
  EventTicketing,
  PatchEventTicketing,
  TicketAllocation,
  TicketAllocationList,
  CreateTicketAllocation,
  UpdateTicketAllocation,
  Ticket,
  TicketList,
  IssueTicket,
  ListTicketsQuery,
  GuestListEntry,
  GuestList,
  MyTicket,
  MyTicketList,
  PublicClaimResponse,
} from '@rally/contracts';

export function toEventTicketingDto(
  event: Pick<
    Event,
    | 'id'
    | 'ticketingEnabled'
    | 'ticketCapacity'
    | 'ticketSaleStatus'
    | 'ticketSalesOpenAt'
    | 'ticketSalesCloseAt'
  >,
): EventTicketing {
  return EventTicketingSchema.parse({
    eventId: event.id,
    ticketingEnabled: event.ticketingEnabled,
    ticketCapacity: event.ticketCapacity,
    ticketSaleStatus: event.ticketSaleStatus,
    ticketSalesOpenAt: event.ticketSalesOpenAt?.toISOString() ?? null,
    ticketSalesCloseAt: event.ticketSalesCloseAt?.toISOString() ?? null,
  });
}

export function toTicketAllocationDto(
  row: TicketAllocationRow & {
    organization?: { name: string } | null;
    _count?: { tickets: number };
    issuedCount?: number;
  },
): TicketAllocation {
  return TicketAllocationSchema.parse({
    id: row.id,
    eventId: row.eventId,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    quantity: row.quantity,
    priceCents: row.priceCents,
    status: row.status,
    issuedCount: row.issuedCount ?? row._count?.tickets ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toTicketDto(
  row: TicketRow & {
    allocation: TicketAllocationRow;
  },
): Ticket {
  return TicketSchema.parse({
    id: row.id,
    eventId: row.allocation.eventId,
    allocationId: row.allocationId,
    organizationId: row.allocation.organizationId,
    status: row.status,
    credentialToken: row.credentialToken,
    holderUserId: row.holderUserId,
    paidAt: row.paidAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toGuestListEntryDto(input: {
  id: string;
  holderUserId: string | null;
  holderName: string | null;
  allocationLabel: string;
  paidAt: Date;
}): GuestListEntry {
  return GuestListEntrySchema.parse({
    id: input.id,
    holderUserId: input.holderUserId,
    holderName: input.holderName,
    allocationLabel: input.allocationLabel,
    status: 'paid',
    paidAt: input.paidAt.toISOString(),
  });
}

export function toMyTicketDto(input: {
  ticket: TicketRow;
  event: Pick<Event, 'id' | 'name'>;
  allocation: TicketAllocationRow & { organization?: { name: string } | null };
}): MyTicket {
  return MyTicketSchema.parse({
    id: input.ticket.id,
    eventId: input.event.id,
    eventName: input.event.name,
    allocationId: input.allocation.id,
    organizationId: input.allocation.organizationId,
    allocationLabel: input.allocation.organizationId
      ? (input.allocation.organization?.name ?? 'Organization')
      : 'Public',
    status: input.ticket.status,
    credentialToken: input.ticket.credentialToken,
    paidAt: input.ticket.paidAt?.toISOString() ?? null,
    createdAt: input.ticket.createdAt.toISOString(),
  });
}

export type TicketAccessAction =
  | 'config'
  | 'allocation'
  | 'issue'
  | 'void'
  | 'mark_paid'
  | 'list'
  | 'guest_list'
  | 'claim';

export type { TicketSaleStatus, TicketStatus, AllocationStatus };
