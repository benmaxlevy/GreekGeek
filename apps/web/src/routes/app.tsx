import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import {
  canAccessEventTicketing,
  canAccessOrgEvents,
  canManageOrgPendingApprovals,
  destinationForUser,
  isAdminUser,
} from '@/lib/auth-routing';

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();

  async function onLogout() {
    await logoutRequest();
    queryClient.setQueryData(meQueryKey, null);
    await queryClient.invalidateQueries({ queryKey: meQueryKey });
    await navigate({ to: '/login' });
  }

  const navItems = [
    { label: 'Home', to: '/app' },
    { label: 'My tickets', to: '/app/tickets' },
    ...(canAccessOrgEvents(user) || canAccessEventTicketing(user)
      ? [{ label: 'Events', to: '/app/events' }]
      : []),
    ...(canManageOrgPendingApprovals(user)
      ? [{ label: 'Pending approvals', to: '/users' }]
      : []),
    ...(isAdminUser(user) ? [{ label: 'Admin', to: '/admin' }] : []),
  ];

  return (
    <AppShell
      navItems={navItems}
      footer={
        <div className="space-y-2">
          <p className="truncate px-1 text-xs text-ink-500">{user.email}</p>
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
