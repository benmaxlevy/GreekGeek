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
    body: 'Connect a payout account before selling paid tickets for this chapter.',
    badge: 'Not started',
  },
  requirements_due: {
    title: 'Finish setup',
    body: 'More information is needed before this chapter can accept payments.',
    badge: 'Action needed',
  },
  ready: {
    title: 'Ready for paid tickets',
    body: 'This chapter can accept payments and sell paid tickets.',
    badge: 'Ready',
  },
  restricted: {
    title: 'Account restricted',
    body: 'Payments are paused until account issues are resolved in Stripe.',
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
          Connect a payout account so your chapter can sell paid tickets.
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
        <p className="text-sm text-ink-500">Loading payment status…</p>
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
                <dt className="text-ink-500">Account</dt>
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
                <dt className="text-ink-500">Profile complete</dt>
                <dd className="mt-1 text-ink-100">
                  {status.stripeDetailsSubmitted ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Action needed</dt>
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
