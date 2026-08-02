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

/**
 * Persist Stripe-derived Connect flags on the organization.
 * Slice 2: apply refetch state directly. Slice 3 adds webhook out-of-order guards.
 */
export async function syncOrgFromStripeAccount(
  prisma: PrismaService,
  orgId: string,
  account: Stripe.V2.Core.Account,
): Promise<void> {
  const flags = mapStripeAccountToOrgFlags(account);
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      stripeChargesEnabled: flags.stripeChargesEnabled,
      stripePayoutsEnabled: flags.stripePayoutsEnabled,
      stripeDetailsSubmitted: flags.stripeDetailsSubmitted,
      stripeRequirementsDue: flags.stripeRequirementsDue,
      stripeAccountUpdatedAt: new Date(),
    },
  });
}
