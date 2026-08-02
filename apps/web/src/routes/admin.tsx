import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  AppWindow,
  Building2,
  CalendarDays,
  CreditCard,
  KeyRound,
  Landmark,
  Link2,
  Users,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { destinationForUser, isAdminUser } from '@/lib/auth-routing';

const ADMIN_NAV: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Schools', to: '/admin/universities', icon: Landmark },
  { label: 'Orgs', to: '/admin/organizations', icon: Building2 },
  { label: 'Events', to: '/admin/events', icon: CalendarDays },
  { label: 'Payouts', to: '/admin/event-payouts', icon: CreditCard },
  { label: 'Ticketing', to: '/admin/ticketed-events', icon: Link2 },
  { label: 'Members', to: '/admin/memberships', icon: Users },
  { label: 'Permissions', to: '/admin/permissions', icon: KeyRound },
  { label: 'Webhooks', to: '/admin/webhook-events', icon: Webhook },
  { label: 'App', to: '/app', icon: AppWindow },
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
      portal="exec"
      navigation="bottom"
      navigationLabel="Admin navigation"
      navItems={ADMIN_NAV}
      footer={
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[180px] truncate text-xs text-ink-500 sm:inline">
            Admin · {user.email}
          </span>
          <Button
            type="button"
            variant="quiet"
            size="sm"
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
