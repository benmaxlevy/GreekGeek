import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleUser, Compass, Ticket } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import {
  canAccessEventTicketing,
  canAccessOrgEvents,
  destinationForUser,
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

  const showEvents =
    Boolean(user.membership) &&
    (canAccessOrgEvents(user) || canAccessEventTicketing(user));

  const navItems = [
    { label: 'Upcoming', to: '/app', exact: true, icon: Compass },
    { label: 'Tickets', to: '/app/tickets', icon: Ticket },
    ...(showEvents ? [{ label: 'Events', to: '/app/events', icon: CalendarDays }] : []),
    { label: 'You', to: '/app/you', icon: CircleUser },
  ];

  return (
    <AppShell
      portal="member"
      navigation="bottom"
      navItems={navItems}
      footer={
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[160px] truncate text-xs text-ink-500 sm:inline">
            {user.email}
          </span>
          <Button type="button" variant="quiet" size="sm" onClick={() => void onLogout()}>
            Log out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
