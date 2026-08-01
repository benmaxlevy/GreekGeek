import {
  CreateTicketAllocationSchema,
  EventListSchema,
  EventTicketingSchema,
  GuestListSchema,
  IssueTicketSchema,
  ListTicketsQuerySchema,
  MyTicketListSchema,
  PatchEventTicketingSchema,
  PublicClaimResponseSchema,
  TicketAllocationListSchema,
  TicketAllocationSchema,
  TicketListSchema,
  TicketSchema,
  UpdateTicketAllocationSchema,
  type CreateTicketAllocation,
  type EventList,
  type EventTicketing,
  type GuestList,
  type IssueTicket,
  type ListTicketsQuery,
  type MyTicketList,
  type PatchEventTicketing,
  type PublicClaimResponse,
  type Ticket,
  type TicketAllocation,
  type TicketAllocationList,
  type TicketList,
  type UpdateTicketAllocation,
} from '@rally/contracts';
import { apiFetch, readError } from './api';

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function patchEventTicketing(
  eventId: string,
  body: PatchEventTicketing,
): Promise<EventTicketing> {
  const payload = PatchEventTicketingSchema.parse(body);
  const res = await apiFetch(`/api/events/${eventId}/ticketing`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update ticketing'));
  }
  return EventTicketingSchema.parse(await res.json());
}

export async function listAllocations(eventId: string): Promise<TicketAllocationList> {
  const res = await apiFetch(`/api/events/${eventId}/allocations`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list allocations'));
  }
  return TicketAllocationListSchema.parse(await res.json());
}

export async function createAllocation(
  eventId: string,
  body: CreateTicketAllocation,
): Promise<TicketAllocation | TicketAllocationList> {
  const payload = CreateTicketAllocationSchema.parse(body);
  const res = await apiFetch(`/api/events/${eventId}/allocations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to create allocation'));
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return TicketAllocationListSchema.parse(data);
  }
  return TicketAllocationSchema.parse(data);
}

export async function updateAllocation(
  eventId: string,
  allocationId: string,
  body: UpdateTicketAllocation,
): Promise<TicketAllocation> {
  const payload = UpdateTicketAllocationSchema.parse(body);
  const res = await apiFetch(
    `/api/events/${eventId}/allocations/${allocationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update allocation'));
  }
  return TicketAllocationSchema.parse(await res.json());
}

export async function issueTicket(
  eventId: string,
  allocationId: string,
  body: IssueTicket = {},
): Promise<Ticket> {
  const payload = IssueTicketSchema.parse(body);
  const res = await apiFetch(
    `/api/events/${eventId}/allocations/${allocationId}/tickets`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to issue ticket'));
  }
  return TicketSchema.parse(await res.json());
}

export async function listTickets(
  eventId: string,
  query: ListTicketsQuery = {},
): Promise<TicketList> {
  ListTicketsQuerySchema.parse(query);
  const res = await apiFetch(
    `/api/events/${eventId}/tickets${toQuery({
      allocationId: query.allocationId,
      organizationId: query.organizationId,
      status: query.status,
    })}`,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list tickets'));
  }
  return TicketListSchema.parse(await res.json());
}

export async function guestList(eventId: string): Promise<GuestList> {
  const res = await apiFetch(`/api/events/${eventId}/guest-list`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load guest list'));
  }
  return GuestListSchema.parse(await res.json());
}

export async function publicClaim(eventId: string): Promise<PublicClaimResponse> {
  const res = await apiFetch(`/api/events/${eventId}/public-claim`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to buy ticket'));
  }
  return PublicClaimResponseSchema.parse(await res.json());
}

export async function listMyTickets(): Promise<MyTicketList> {
  const res = await apiFetch('/api/tickets/mine');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load your tickets'));
  }
  return MyTicketListSchema.parse(await res.json());
}

export async function listClaimableEvents(): Promise<EventList> {
  const res = await apiFetch('/api/tickets/claimable');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load events available to buy'));
  }
  return EventListSchema.parse(await res.json());
}

export async function markTicketPaid(ticketId: string): Promise<Ticket> {
  const res = await apiFetch(`/api/tickets/${ticketId}/mark-paid`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to mark ticket paid'));
  }
  return TicketSchema.parse(await res.json());
}

export async function voidTicket(ticketId: string): Promise<Ticket> {
  const res = await apiFetch(`/api/tickets/${ticketId}/void`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to void ticket'));
  }
  return TicketSchema.parse(await res.json());
}
