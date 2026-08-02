import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { meQueryOptions } from '@/lib/auth';
import {
  canAccessEventTicketing,
  canAccessOrgEvents,
  destinationForUser,
  isAdminUser,
} from '@/lib/auth-routing';

export const Route = createFileRoute('/app/events')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    // Chapter events list needs an org membership. Platform admins without one
    // use /admin/events; ticketing access alone is not enough to list org events.
    if (!user.membership) {
      if (isAdminUser(user)) {
        throw redirect({ to: '/admin/events' });
      }
      throw redirect({ to: '/app' });
    }
    if (!canAccessOrgEvents(user) && !canAccessEventTicketing(user)) {
      throw redirect({ to: '/app' });
    }
    return { user };
  },
  component: AppEventsLayout,
});

function AppEventsLayout() {
  return (
    <div className="w-full">
      <Outlet />
    </div>
  );
}
