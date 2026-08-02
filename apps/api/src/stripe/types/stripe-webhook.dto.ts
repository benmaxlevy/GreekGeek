import { z } from 'zod';

/** Stripe Connect account / capability event types handled by the inbox worker. */
export const STRIPE_CONNECT_WEBHOOK_TYPES = [
  'account.updated',
  'capability.updated',
  'v2.core.account.updated',
  'v2.core.account.created',
  'v2.core.account[configuration.merchant].updated',
  'v2.core.account[configuration.merchant].capability_status_updated',
  'v2.core.account[configuration.recipient].updated',
  'v2.core.account[configuration.recipient].capability_status_updated',
  'v2.core.account[requirements].updated',
  'v2.core.account[identity].updated',
] as const;

export type StripeConnectWebhookType =
  (typeof STRIPE_CONNECT_WEBHOOK_TYPES)[number];

const RelatedObjectSchema = z.object({
  id: z.string().min(1),
});

const DataObjectSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    account: z.string().optional(),
  })
  .passthrough();

/** Loose payload shape for extracting Connect account id + event time. */
export const StripeConnectWebhookPayloadSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    created: z.union([z.number(), z.string()]).optional(),
    account: z.string().optional(),
    related_object: RelatedObjectSchema.optional(),
    data: z
      .object({
        object: DataObjectSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type StripeConnectWebhookPayload = z.infer<
  typeof StripeConnectWebhookPayloadSchema
>;
