import { z } from 'zod';

export const WebhookProcessJobSchema = z.object({
  webhookEventId: z.string().min(1),
});
export type WebhookProcessJob = z.infer<typeof WebhookProcessJobSchema>;
