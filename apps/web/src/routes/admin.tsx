import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { destinationForUser, isAdminUser } from '@/lib/auth-routing';

const ADMIN_NAV = [
  { label: 'Users', to: '/admin/users' },
  { label: 'Universities', to: '/admin/universities' },
  { label: 'Organizations', to: '/admin/organizations' },
  { label: 'Events', to: '/admin/events' },
  { label: 'Memberships', to: '/admin/memberships' },
  { label: 'Permissions', to: '/admin/permissions' },
  { label: 'App home', to: '/app' },
];

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    if (!isAdminUser(user)) {
      throw redirect({ to: '/app' });
    }
    return { user };
  },
  component: AdminLayout,
});

function AdminLayout() {
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
      navItems={ADMIN_NAV}
      footer={
        <div className="space-y-2">
          <p className="truncate px-1 text-xs text-ink-500">{user.email}</p>
          <p className="px-1 text-xs text-ink-500">Admin</p>
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
