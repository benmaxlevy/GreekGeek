import { z } from 'zod';

/** Stripe PaymentIntent lifecycle events for ticket checkout. */
export const STRIPE_PAYMENT_INTENT_WEBHOOK_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
] as const;

export type StripePaymentIntentWebhookType =
  (typeof STRIPE_PAYMENT_INTENT_WEBHOOK_TYPES)[number];

const PaymentIntentObjectSchema = z
  .object({
    id: z.string().min(1),
    object: z.literal('payment_intent').optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    latest_charge: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .optional()
      .nullable(),
  })
  .passthrough();

/** Loose PI webhook payload for id + optional metadata. */
export const StripePaymentIntentWebhookPayloadSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    data: z
      .object({
        object: PaymentIntentObjectSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type StripePaymentIntentWebhookPayload = z.infer<
  typeof StripePaymentIntentWebhookPayloadSchema
>;

export function extractPaymentIntentId(payload: unknown): string | null {
  const parsed = StripePaymentIntentWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  const id = parsed.data.data?.object?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function extractStripeChargeId(payload: unknown): string | null {
  const parsed = StripePaymentIntentWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  const latest = parsed.data.data?.object?.latest_charge;
  if (typeof latest === 'string' && latest.length > 0) {
    return latest;
  }
  if (
    latest &&
    typeof latest === 'object' &&
    'id' in latest &&
    typeof (latest as { id: unknown }).id === 'string'
  ) {
    return (latest as { id: string }).id;
  }
  return null;
}
