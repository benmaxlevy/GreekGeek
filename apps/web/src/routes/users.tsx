import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import {
  canManageOrgPendingApprovals,
  destinationForUser,
} from '@/lib/auth-routing';

const USERS_NAV = [
  { label: 'Pending approvals', to: '/users' },
  { label: 'App home', to: '/app' },
];

export const Route = createFileRoute('/users')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    if (!canManageOrgPendingApprovals(user)) {
      throw redirect({ to: '/app' });
    }
    return { user };
  },
  component: UsersLayout,
});

function UsersLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();

  async function onLogout() {
    await logoutRequest();
    queryClient.setQueryData(meQueryKey, null);
    await queryClient.invalidateQueries({ queryKey: meQueryKey });
    await navigate({ to: '/login' });
  }

  return (
    <AppShell
      navItems={USERS_NAV}
      footer={
        <div className="space-y-2">
          <p className="truncate px-1 text-xs text-ink-500">{user.email}</p>
          {user.membership?.organizationName ? (
            <p className="truncate px-1 text-xs text-ink-500">
              {user.membership.organizationName}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => void onLogout()}
          >
            Log out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
