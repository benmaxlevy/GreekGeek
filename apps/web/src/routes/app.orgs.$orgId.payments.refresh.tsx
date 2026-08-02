import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { meQueryOptions } from '@/lib/auth';
import { canManageOrgPayments, destinationForUser, isAdminUser } from '@/lib/auth-routing';
import { refreshConnectLink } from '@/lib/stripe-connect-api';

export const Route = createFileRoute('/app/orgs/$orgId/payments/refresh')({
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
    if (!canManageOrgPayments(user, params.orgId)) {
      throw redirect({
        to: '/app/orgs/$orgId/payments',
        params: { orgId: params.orgId },
      });
    }
    return { user };
  },
  component: OrgPaymentsRefreshBridge,
});

function OrgPaymentsRefreshBridge() {
  const { orgId } = Route.useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { url } = await refreshConnectLink(orgId);
        if (cancelled) return;
        window.location.href = url;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to refresh Stripe onboarding link');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <div className="w-full">
      <div className="surface-glass-panel space-y-3 rounded-[var(--radius-lg)] p-6">
        <p className="rl-eyebrow">Chapter finance</p>
        <h1 className="display-sm font-display">Continue setup</h1>
        {error ? (
          <p className="text-sm text-[color:var(--error)]">{error}</p>
        ) : (
          <p className="text-sm text-ink-500">Opening payout account setup…</p>
        )}
      </div>
    </div>
  );
}
