import type { OrgStripeFields } from '@greekgeek/contracts';

export type StripeConnectUiState =
  | 'not_started'
  | 'requirements_due'
  | 'ready'
  | 'restricted';

export function hasOutstandingRequirements(requirementsDue: unknown): boolean {
  if (requirementsDue == null || typeof requirementsDue !== 'object') {
    return false;
  }
  const entries = (requirementsDue as { entries?: unknown }).entries;
  return Array.isArray(entries) && entries.length > 0;
}

/** Derive payments settings display state from Stripe-sourced org fields. */
export function deriveConnectUiState(status: OrgStripeFields): StripeConnectUiState {
  if (!status.stripeAccountId) {
    return 'not_started';
  }
  if (status.stripeChargesEnabled) {
    return 'ready';
  }
  const outstanding = hasOutstandingRequirements(status.stripeRequirementsDue);
  if (status.stripeDetailsSubmitted && outstanding) {
    return 'restricted';
  }
  return 'requirements_due';
}
