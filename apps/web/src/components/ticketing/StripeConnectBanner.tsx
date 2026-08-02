import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  organizationId: string;
  canManagePayments: boolean;
};

/** Blocking banner when paid ticketing needs host org Stripe charges enabled. */
export function StripeConnectBanner({
  organizationId,
  canManagePayments,
}: Props) {
  return (
    <Card className="border-[color:var(--error)]/40">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium text-ink-100">
          Connect payout account required
        </p>
        <p className="text-sm text-ink-300">
          Paid tickets need the host organization&apos;s Stripe Connect account
          with charges enabled.
        </p>
        {canManagePayments ? (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/app/orgs/$orgId/payments"
              params={{ orgId: organizationId }}
            >
              Open payments settings
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-ink-500">
            Ask an officer with payments access to connect the payout account.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
