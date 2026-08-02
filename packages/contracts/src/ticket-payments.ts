import { z } from 'zod';

export const TicketPaymentStatusSchema = z.enum([
  'requires_payment',
  'succeeded',
  'failed',
  'canceled',
]);
export type TicketPaymentStatus = z.infer<typeof TicketPaymentStatusSchema>;

/** Half-up fee on positive integer cents: feeCents = round(priceCents * pct / 100). */
export function computeRallyFee(
  priceCents: number,
  feePercent: number,
): {
  feeCents: number;
  amountCents: number;
  netCents: number;
} {
  const feeCents = Math.round((priceCents * feePercent) / 100);
  return {
    feeCents,
    amountCents: priceCents + feeCents,
    netCents: priceCents,
  };
}

/** Path param only; body empty. ticketId comes from route. */
export const TicketCheckoutParamsSchema = z.object({
  ticketId: z.string().min(1),
});
export type TicketCheckoutParams = z.infer<typeof TicketCheckoutParamsSchema>;

export const TicketCheckoutRequestSchema = z.object({}).strict();
export type TicketCheckoutRequest = z.infer<typeof TicketCheckoutRequestSchema>;

export const TicketCheckoutResponseSchema = z.object({
  clientSecret: z.string().min(1),
  priceCents: z.number().int().positive(),
  feeCents: z.number().int().nonnegative(),
  amountCents: z.number().int().positive(),
  currency: z.literal('usd'),
});
export type TicketCheckoutResponse = z.infer<typeof TicketCheckoutResponseSchema>;
