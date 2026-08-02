import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { meQueryOptions } from '@/lib/auth';
import { canManageOrgPayments, destinationForUser, isAdminUser } from '@/lib/auth-routing';
import { syncConnectReturn } from '@/lib/stripe-connect-api';

export const Route = createFileRoute('/app/orgs/$orgId/payments/return')({
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
  component: OrgPaymentsReturnBridge,
});

function OrgPaymentsReturnBridge() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await syncConnectReturn(orgId);
        if (cancelled) return;
        await navigate({
          to: '/app/orgs/$orgId/payments',
          params: { orgId },
          replace: true,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to sync Stripe return');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, navigate]);

  return (
    <div className="space-y-3">
      <h1 className="text-[28px] font-medium tracking-tight">Returning from Stripe</h1>
      {error ? (
        <p className="text-sm text-[color:var(--error)]">{error}</p>
      ) : (
        <p className="text-sm text-ink-500">Syncing account status…</p>
      )}
    </div>
  );
}
