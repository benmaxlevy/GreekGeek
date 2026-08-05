import {
  PurchaseCheckoutRequestSchema,
  PurchaseCheckoutResponseSchema,
  PurchaseStatusSchema,
  computePurchaseAmounts,
  computeGreekGeekFee,
  type PurchaseCheckoutRequest,
  type PurchaseCheckoutResponse,
  type PurchaseStatus,
} from '@greekgeek/contracts';

export {
  PurchaseCheckoutRequestSchema,
  PurchaseCheckoutResponseSchema,
  PurchaseStatusSchema,
  computePurchaseAmounts,
  computeGreekGeekFee,
};

export type {
  PurchaseCheckoutRequest,
  PurchaseCheckoutResponse,
  PurchaseStatus,
};

/** Enforces write invariant: amount = subtotal + fee, net = subtotal. */
export function assertPurchaseAmountInvariant(input: {
  subtotalCents: number;
  feeCents: number;
  amountCents: number;
  netCents: number;
}): void {
  if (input.amountCents !== input.subtotalCents + input.feeCents) {
    throw new Error(
      `Purchase amount invariant violated: amountCents ${input.amountCents} != subtotal ${input.subtotalCents} + fee ${input.feeCents}`,
    );
  }
  if (input.netCents !== input.subtotalCents) {
    throw new Error(
      `Purchase net invariant violated: netCents ${input.netCents} != subtotal ${input.subtotalCents}`,
    );
  }
}
