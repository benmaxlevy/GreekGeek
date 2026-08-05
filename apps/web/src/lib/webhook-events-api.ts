import {
  ListWebhookEventsQuerySchema,
  RequeueWebhookEventResponseSchema,
  WebhookEventListSchema,
  type ListWebhookEventsQuery,
  type RequeueWebhookEventResponse,
  type WebhookEventList,
} from '@greekgeek/contracts';
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

export async function listWebhookEvents(
  query: ListWebhookEventsQuery = { status: 'all' },
): Promise<WebhookEventList> {
  const parsed = ListWebhookEventsQuerySchema.parse(query);
  const res = await apiFetch(
    `/api/admin/webhook-events${toQuery({ status: parsed.status })}`,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list webhook events'));
  }
  return WebhookEventListSchema.parse(await res.json());
}

export async function requeueWebhookEvent(
  id: string,
): Promise<RequeueWebhookEventResponse> {
  const res = await apiFetch(`/api/admin/webhook-events/${id}/requeue`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to requeue webhook event'));
  }
  return RequeueWebhookEventResponseSchema.parse(await res.json());
}
