import { z } from 'zod';

export const STRIPE_PAYOUT_WEBHOOK_TYPES = [
  'charge.dispute.created',
  'charge.refunded',
  'charge.refund.updated',
  'transfer.created',
  'transfer.failed',
  'payout.failed',
  'payout.canceled',
] as const;

export type StripePayoutWebhookType = (typeof STRIPE_PAYOUT_WEBHOOK_TYPES)[number];

const PaymentReferenceSchema = z.union([
  z.string(),
  z.object({ id: z.string().min(1) }).passthrough(),
]);

const StripeObjectSchema = z
  .object({
    id: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    payment_intent: PaymentReferenceSchema.optional().nullable(),
    charge: PaymentReferenceSchema.optional().nullable(),
    failure_message: z.string().optional().nullable(),
  })
  .passthrough();

export const StripePayoutWebhookPayloadSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    data: z.object({ object: StripeObjectSchema.optional() }).passthrough().optional(),
  })
  .passthrough();

export type StripePayoutWebhookPayload = z.infer<typeof StripePayoutWebhookPayloadSchema>;

export function extractWebhookObject(payload: unknown): z.infer<typeof StripeObjectSchema> | null {
  return StripePayoutWebhookPayloadSchema.safeParse(payload).data?.data?.object ?? null;
}

export function extractReferenceId(reference: unknown): string | null {
  if (typeof reference === 'string' && reference.length > 0) {
    return reference;
  }
  if (
    reference &&
    typeof reference === 'object' &&
    'id' in reference &&
    typeof reference.id === 'string' &&
    reference.id.length > 0
  ) {
    return reference.id;
  }
  return null;
}
