import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import {
  canManageOrgPayments,
  destinationForUser,
  isAdminUser,
} from '@/lib/auth-routing';
import { startConnect, getConnectStatus } from '@/lib/stripe-connect-api';
import {
  deriveConnectUiState,
  hasOutstandingRequirements,
  type StripeConnectUiState,
} from '@/lib/stripe-connect/types/connect-ui';

export const Route = createFileRoute('/app/orgs/$orgId/payments')({
  beforeLoad: async ({ context, params }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    const isMember = user.membership?.organizationId === params.orgId;
    if (!isAdminUser(user) && !isMember) {
      throw redirect({ to: '/app' });
    }
    return { user };
  },
  component: OrgPaymentsSettingsPage,
});

const STATE_COPY: Record<
  StripeConnectUiState,
  { title: string; body: string; badge: string }
> = {
  not_started: {
    title: 'Payout account not connected',
    body: 'Connect a Stripe payout account before selling paid tickets for this chapter.',
    badge: 'Not started',
  },
  requirements_due: {
    title: 'Finish Stripe onboarding',
    body: 'Stripe still needs information before this chapter can accept charges.',
    badge: 'Requirements due',
  },
  ready: {
    title: 'Ready for paid tickets',
    body: 'Charges are enabled. Paid allocations and on-sale events can proceed.',
    badge: 'Ready',
  },
  restricted: {
    title: 'Account restricted',
    body: 'Charges are disabled until outstanding Stripe requirements are resolved.',
    badge: 'Restricted',
  },
};

function OrgPaymentsSettingsPage() {
  const { orgId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageOrgPayments(user, orgId);

  const statusQuery = useQuery({
    queryKey: ['stripe-connect', 'status', orgId],
    queryFn: () => getConnectStatus(orgId),
    enabled: canManage,
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: () => startConnect(orgId),
    onSuccess: (data) => {
      setError(null);
      window.location.href = data.url;
    },
    onError: (err: Error) => setError(err.message),
  });

  const status = statusQuery.data;
  const uiState = status ? deriveConnectUiState(status) : null;
  const copy = uiState ? STATE_COPY[uiState] : null;
  const showConnectCta =
    canManage && uiState != null && uiState !== 'ready';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-ink-500">
          Stripe Connect status for this organization. Flags sync from Stripe only.
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      {!canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ask an officer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-300">
              You need an officer with payments access to connect or update the
              payout account for this chapter.
            </p>
          </CardContent>
        </Card>
      ) : statusQuery.isLoading ? (
        <p className="text-sm text-ink-500">Loading Connect status…</p>
      ) : statusQuery.isError ? (
        <p className="text-sm text-[color:var(--error)]">
          {(statusQuery.error as Error).message}
        </p>
      ) : status && copy ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-lg">{copy.title}</CardTitle>
            <Badge
              variant={uiState === 'ready' ? 'default' : 'secondary'}
            >
              {copy.badge}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-300">{copy.body}</p>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-500">Stripe account</dt>
                <dd className="mt-1 font-mono text-ink-100">
                  {status.stripeAccountId ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Last updated</dt>
                <dd className="mt-1 text-ink-100">
                  {status.stripeAccountUpdatedAt
                    ? new Date(status.stripeAccountUpdatedAt).toLocaleString()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Charges</dt>
                <dd className="mt-1 text-ink-100">
                  {status.stripeChargesEnabled ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Payouts</dt>
                <dd className="mt-1 text-ink-100">
                  {status.stripePayoutsEnabled ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Details submitted</dt>
                <dd className="mt-1 text-ink-100">
                  {status.stripeDetailsSubmitted ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Requirements due</dt>
                <dd className="mt-1 text-ink-100">
                  {hasOutstandingRequirements(status.stripeRequirementsDue)
                    ? 'Yes'
                    : 'None'}
                </dd>
              </div>
            </dl>

            {showConnectCta ? (
              <Button
                type="button"
                isLoading={connectMutation.isPending}
                onClick={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ['stripe-connect', 'status', orgId],
                  });
                  connectMutation.mutate();
                }}
              >
                Connect payout account
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
