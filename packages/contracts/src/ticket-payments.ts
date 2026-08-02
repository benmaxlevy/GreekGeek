import { z } from 'zod';
import { PayoutExcludedReasonSchema } from './event-payouts';

export const PurchaseStatusSchema = z.enum(['requires_payment', 'succeeded', 'failed', 'canceled']);
export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;

export const PurchasePayoutFieldsSchema = z.object({
  eventPayoutId: z.string().nullable(),
  payoutExcludedReason: PayoutExcludedReasonSchema.nullable(),
});
export type PurchasePayoutFields = z.infer<typeof PurchasePayoutFieldsSchema>;

/** @deprecated Use PurchaseStatusSchema */
export const TicketPaymentStatusSchema = PurchaseStatusSchema;
/** @deprecated Use PurchaseStatus */
export type TicketPaymentStatus = PurchaseStatus;

/**
 * Fee on purchase subtotal with half-up rounding for positive amounts.
 * feeCents = round(subtotalCents * feePercent / 100)
 * amountCents = subtotalCents + feeCents
 * netCents = subtotalCents
 */
export function computePurchaseAmounts(
  quantity: number,
  unitPriceCents: number,
  feePercent: number,
): {
  subtotalCents: number;
  feeCents: number;
  amountCents: number;
  netCents: number;
} {
  const subtotalCents = quantity * unitPriceCents;
  const feeCents = Math.round((subtotalCents * feePercent) / 100);
  return {
    subtotalCents,
    feeCents,
    amountCents: subtotalCents + feeCents,
    netCents: subtotalCents,
  };
}

/** Half-up fee on a single price (quantity 1). Prefer computePurchaseAmounts for multi-qty. */
export function computeRallyFee(
  priceCents: number,
  feePercent: number,
): {
  feeCents: number;
  amountCents: number;
  netCents: number;
} {
  const { feeCents, amountCents, netCents } = computePurchaseAmounts(1, priceCents, feePercent);
  return { feeCents, amountCents, netCents };
}

export const PurchaseCheckoutRequestSchema = z.object({
  allocationId: z.string().min(1),
  quantity: z.number().int().positive(),
});
export type PurchaseCheckoutRequest = z.infer<typeof PurchaseCheckoutRequestSchema>;

export const PurchaseCheckoutResponseSchema = z.object({
  purchaseId: z.string().min(1),
  clientSecret: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  subtotalCents: z.number().int().positive(),
  feeCents: z.number().int().nonnegative(),
  amountCents: z.number().int().positive(),
  currency: z.literal('usd'),
  ticketIds: z.array(z.string().min(1)).min(1),
});
export type PurchaseCheckoutResponse = z.infer<typeof PurchaseCheckoutResponseSchema>;

/** @deprecated Use PurchaseCheckoutRequestSchema */
export const TicketCheckoutRequestSchema = z.object({}).strict();
/** @deprecated */
export type TicketCheckoutRequest = z.infer<typeof TicketCheckoutRequestSchema>;

/** @deprecated ticket-scoped checkout removed */
export const TicketCheckoutParamsSchema = z.object({
  ticketId: z.string().min(1),
});
/** @deprecated */
export type TicketCheckoutParams = z.infer<typeof TicketCheckoutParamsSchema>;

/** @deprecated Use PurchaseCheckoutResponseSchema */
export const TicketCheckoutResponseSchema = z.object({
  clientSecret: z.string().min(1),
  priceCents: z.number().int().positive(),
  feeCents: z.number().int().nonnegative(),
  amountCents: z.number().int().positive(),
  currency: z.literal('usd'),
});
/** @deprecated */
export type TicketCheckoutResponse = z.infer<typeof TicketCheckoutResponseSchema>;
