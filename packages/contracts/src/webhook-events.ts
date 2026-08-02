import { z } from 'zod';

export const WebhookEventStatusFilterSchema = z.enum([
  'unprocessed',
  'failed',
  'all',
]);
export type WebhookEventStatusFilter = z.infer<
  typeof WebhookEventStatusFilterSchema
>;

export const WebhookEventSchema = z.object({
  id: z.string(),
  service: z.string(),
  externalId: z.string(),
  type: z.string(),
  payload: z.unknown(),
  receivedAt: z.string().datetime(),
  processedAt: z.string().datetime().nullable(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
});
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const ListWebhookEventsQuerySchema = z.object({
  status: WebhookEventStatusFilterSchema.default('all'),
});
export type ListWebhookEventsQuery = z.infer<
  typeof ListWebhookEventsQuerySchema
>;

export const WebhookEventListSchema = z.array(WebhookEventSchema);
export type WebhookEventList = z.infer<typeof WebhookEventListSchema>;

export const RequeueWebhookEventResponseSchema = z.object({
  jobId: z.string(),
  webhookEventId: z.string(),
});
export type RequeueWebhookEventResponse = z.infer<
  typeof RequeueWebhookEventResponseSchema
>;
