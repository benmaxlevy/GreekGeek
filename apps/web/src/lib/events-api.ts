import {
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  UpdateEventSchema,
  type CreateEvent,
  type Event,
  type EventList,
  type UpdateEvent,
} from '@rally/contracts';
import { apiFetch, readError } from './api';

type ListEventsParams = {
  organizationId?: string;
  ticketingEnabled?: boolean;
};

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

export async function listEvents(query: ListEventsParams = {}): Promise<EventList> {
  const res = await apiFetch(
    `/api/events${toQuery({
      organizationId: query.organizationId,
      ticketingEnabled:
        query.ticketingEnabled === true ? 'true' : undefined,
    })}`,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list events'));
  }
  return EventListSchema.parse(await res.json());
}

export async function getEvent(id: string): Promise<Event> {
  const res = await apiFetch(`/api/events/${id}`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load event'));
  }
  return EventSchema.parse(await res.json());
}

export async function createEvent(body: CreateEvent): Promise<Event> {
  const payload = CreateEventSchema.parse(body);
  const res = await apiFetch('/api/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to create event'));
  }
  return EventSchema.parse(await res.json());
}

export async function updateEvent(id: string, body: UpdateEvent): Promise<Event> {
  const payload = UpdateEventSchema.parse(body);
  const res = await apiFetch(`/api/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update event'));
  }
  return EventSchema.parse(await res.json());
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to delete event'));
  }
}
