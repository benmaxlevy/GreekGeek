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
      ticketingEnabled: query.ticketingEnabled === true ? 'true' : undefined,
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

export function toIsoDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function formatEventError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: unknown }).issues;
    if (Array.isArray(issues)) {
      const messages = issues
        .map((issue) => {
          if (!issue || typeof issue !== 'object') {
            return null;
          }
          const path = Array.isArray((issue as { path?: unknown }).path)
            ? (issue as { path: unknown[] }).path.join('.')
            : '';
          const message = (issue as { message?: unknown }).message;
          return typeof message === 'string' ? `${path ? `${path}: ` : ''}${message}` : null;
        })
        .filter((message): message is string => message !== null);
      if (messages.length > 0) {
        return messages.join('; ');
      }
    }
  }
  return error instanceof Error ? error.message : 'Event request failed';
}
