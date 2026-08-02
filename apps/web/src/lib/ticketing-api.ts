import {
  CheckInTicketResponseSchema,
  CheckInTicketSchema,
  ClaimableEventListSchema,
  CreateTicketAllocationSchema,
  EventTicketingSchema,
  GuestListSchema,
  IssueTicketSchema,
  ListTicketsQuerySchema,
  MyTicketListSchema,
  PatchEventTicketingSchema,
  PublicClaimResponseSchema,
  PurchaseCheckoutRequestSchema,
  PurchaseCheckoutResponseSchema,
  TicketAllocationListSchema,
  TicketAllocationSchema,
  TicketCheckInErrorCodeSchema,
  TicketListSchema,
  TicketSchema,
  UpdateTicketAllocationSchema,
  type CheckInTicketResponse,
  type ClaimableEventList,
  type CreateTicketAllocation,
  type EventTicketing,
  type GuestList,
  type IssueTicket,
  type ListTicketsQuery,
  type MyTicketList,
  type PatchEventTicketing,
  type PublicClaimResponse,
  type PurchaseCheckoutRequest,
  type PurchaseCheckoutResponse,
  type Ticket,
  type TicketAllocation,
  type TicketAllocationList,
  type TicketList,
  type UpdateTicketAllocation,
} from '@rally/contracts';
import { apiFetch, readError } from './api';
import { TicketCheckInError } from './ticketing/types/check-in';
import { PurchaseCheckoutError } from './ticketing/types/purchase';

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

export async function listClaimableEvents(): Promise<ClaimableEventList> {
  const res = await apiFetch('/api/tickets/claimable');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load events available to buy'));
  }
  return ClaimableEventListSchema.parse(await res.json());
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

export async function checkoutPurchase(
  body: PurchaseCheckoutRequest,
): Promise<PurchaseCheckoutResponse> {
  const payload = PurchaseCheckoutRequestSchema.parse(body);
  const res = await apiFetch('/api/ticket-purchases/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let remaining: number | undefined;
    let message = `Failed to start checkout (${res.status})`;
    try {
      const data = (await res.json()) as {
        message?: string | string[];
        remaining?: number;
      };
      if (typeof data.remaining === 'number') {
        remaining = data.remaining;
      }
      if (typeof data.message === 'string') {
        message = data.message;
      } else if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      }
    } catch {
      message = await readError(res, 'Failed to start checkout');
    }
    throw new PurchaseCheckoutError(message, remaining);
  }
  return PurchaseCheckoutResponseSchema.parse(await res.json());
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

export async function checkInTicket(
  credentialToken: string,
): Promise<CheckInTicketResponse> {
  const payload = CheckInTicketSchema.parse({ credentialToken });
  const res = await apiFetch('/api/tickets/check-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json()) as { code?: string; message?: string };
    const parsed = TicketCheckInErrorCodeSchema.safeParse(data.code);
    if (parsed.success) {
      throw new TicketCheckInError(
        parsed.data,
        typeof data.message === 'string' ? data.message : 'Check-in failed',
      );
    }
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : `Check-in failed (${res.status})`,
    );
  }
  return CheckInTicketResponseSchema.parse(await res.json());
}
