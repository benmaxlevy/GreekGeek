/** Client default matching API MAX_TICKETS_PER_USER_PER_EVENT. */
export const DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT = 2;

/** Client default matching API RALLY_FEE_PERCENT (preview only; server is source of truth). */
export const DEFAULT_RALLY_FEE_PERCENT = 10;

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export class PurchaseCheckoutError extends Error {
  readonly remaining?: number;

  constructor(message: string, remaining?: number) {
    super(message);
    this.name = 'PurchaseCheckoutError';
    this.remaining = remaining;
  }
}
