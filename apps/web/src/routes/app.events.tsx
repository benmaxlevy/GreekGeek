import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { meQueryOptions } from '@/lib/auth';
import {
  canAccessEventTicketing,
  canAccessOrgEvents,
  destinationForUser,
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
