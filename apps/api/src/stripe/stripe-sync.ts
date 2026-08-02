import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import type { PrismaService } from '../prisma/prisma.service';

type CapabilityStatus = 'active' | 'pending' | 'restricted' | 'unsupported';

function isActive(status: CapabilityStatus | undefined): boolean {
  return status === 'active';
}

/** Map Stripe Accounts v2 shape → org Connect flags (refetch is source of truth). */
export function mapStripeAccountToOrgFlags(account: Stripe.V2.Core.Account): {
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeRequirementsDue: Prisma.InputJsonValue | typeof Prisma.DbNull;
} {
  const merchant = account.configuration?.merchant;
  const recipient = account.configuration?.recipient;

  const stripeChargesEnabled = isActive(
    merchant?.capabilities?.card_payments?.status,
  );
  const stripePayoutsEnabled =
    isActive(merchant?.capabilities?.stripe_balance?.payouts?.status) ||
    isActive(recipient?.capabilities?.stripe_balance?.payouts?.status);

  const entries = account.requirements?.entries ?? [];
  const hasBlockingUserRequirements = entries.some(
    (entry) =>
      entry.awaiting_action_from === 'user' &&
      (entry.minimum_deadline.status === 'currently_due' ||
        entry.minimum_deadline.status === 'past_due'),
  );
  // Fresh accounts have currently_due entries; cleared (or only eventually_due) ⇒ submitted.
  const stripeDetailsSubmitted = !hasBlockingUserRequirements;

  const stripeRequirementsDue =
    entries.length > 0
      ? (JSON.parse(JSON.stringify(account.requirements)) as Prisma.InputJsonValue)
      : Prisma.DbNull;

  return {
    stripeChargesEnabled,
    stripePayoutsEnabled,
    stripeDetailsSubmitted,
    stripeRequirementsDue,
  };
}

export type SyncOrgFromStripeOptions = {
  /**
   * Event/account timestamp for out-of-order detection.
   * When omitted (e.g. return-URL refetch), apply account as authoritative now.
   */
  eventTimestamp?: Date;
  /**
   * Called when existing `stripeAccountUpdatedAt` is newer than `eventTimestamp`.
   * Refetched account is applied; never regresses charges when refetch shows enabled.
   */
  refetchAccount?: () => Promise<Stripe.V2.Core.Account>;
};

/**
 * Persist Stripe-derived Connect flags on the organization.
 * Out-of-order: if org timestamp is newer than the event, refetch (when provided)
 * and apply refetched state — never set charges false if refetch shows true.
 */
export async function syncOrgFromStripeAccount(
  prisma: PrismaService,
  orgId: string,
  account: Stripe.V2.Core.Account,
  options?: SyncOrgFromStripeOptions,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { stripeAccountUpdatedAt: true },
  });
  if (!org) {
    return;
  }

  let accountToApply = account;
  let appliedAt = options?.eventTimestamp ?? new Date();

  const isStale =
    options?.eventTimestamp != null &&
    org.stripeAccountUpdatedAt != null &&
    org.stripeAccountUpdatedAt.getTime() > options.eventTimestamp.getTime();

  if (isStale) {
    if (!options?.refetchAccount) {
      // Avoid regressing newer state without a live refetch.
      return;
    }
    accountToApply = await options.refetchAccount();
    appliedAt = new Date();
  }

  const flags = mapStripeAccountToOrgFlags(accountToApply);

  // After stale→refetch, flags come from live Stripe. If refetch shows charges
  // enabled, we keep true (never regress from a stale false snapshot). If refetch
  // shows disabled, trust Stripe. Without refetch, stale path already returned.
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      stripeChargesEnabled: flags.stripeChargesEnabled,
      stripePayoutsEnabled: flags.stripePayoutsEnabled,
      stripeDetailsSubmitted: flags.stripeDetailsSubmitted,
      stripeRequirementsDue: flags.stripeRequirementsDue,
      stripeAccountUpdatedAt: appliedAt,
    },
  });
}
