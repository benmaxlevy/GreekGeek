import {
  EventPayoutActionResponseSchema,
  EventPayoutQueueSchema,
  EventPayoutSummarySchema,
  EventSchema,
  PayoutReasonSchema,
  type EventPayoutActionResponse,
  type EventPayoutQueue,
  type EventPayoutSummary,
  type PayoutReason,
} from '@rally/contracts';
import { apiFetch, readError } from './api';

export async function getEventPayoutSummary(eventId: string): Promise<EventPayoutSummary> {
  const res = await apiFetch(`/api/events/${eventId}/payout`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load payout summary'));
  }
  return EventPayoutSummarySchema.parse(await res.json());
}

export async function listEventPayoutQueue(): Promise<EventPayoutQueue> {
  const res = await apiFetch('/api/admin/event-payouts');
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load payout queue'));
  }
  return EventPayoutQueueSchema.parse(await res.json());
}

export async function releaseEventPayout(
  eventId: string,
  body: PayoutReason,
): Promise<EventPayoutActionResponse> {
  const payload = PayoutReasonSchema.parse(body);
  const res = await apiFetch(`/api/admin/event-payouts/${eventId}/release`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to release payout'));
  }
  return EventPayoutActionResponseSchema.parse(await res.json());
}

export async function retryEventPayout(
  eventId: string,
  payoutId: string,
  body: PayoutReason,
): Promise<EventPayoutActionResponse> {
  const payload = PayoutReasonSchema.parse(body);
  const res = await apiFetch(`/api/admin/event-payouts/${eventId}/payouts/${payoutId}/retry`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to retry payout'));
  }
  return EventPayoutActionResponseSchema.parse(await res.json());
}

export async function holdEvent(eventId: string, body: PayoutReason) {
  const payload = PayoutReasonSchema.parse(body);
  const res = await apiFetch(`/api/events/${eventId}/hold`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to hold event'));
  }
  return EventSchema.parse(await res.json());
}

export async function clearEventHold(eventId: string, body: PayoutReason) {
  const payload = PayoutReasonSchema.parse(body);
  const res = await apiFetch(`/api/events/${eventId}/clear-hold`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to clear event hold'));
  }
  return EventSchema.parse(await res.json());
}
