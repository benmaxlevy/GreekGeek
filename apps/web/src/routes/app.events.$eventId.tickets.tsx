import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { EventTicketsPanel } from '@/components/ticketing/EventTicketsPanel';
import { meQueryOptions } from '@/lib/auth';
import { canManageTickets, destinationForUser } from '@/lib/auth-routing';
import { getEvent } from '@/lib/events-api';
import { listAllocations, listTickets } from '@/lib/ticketing-api';

export const Route = createFileRoute('/app/events/$eventId/tickets')({
  beforeLoad: async ({ context, params }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    if (!canManageTickets(user)) {
      throw redirect({ to: '/app' });
    }

    const { eventId } = params;
    let mode: 'host' | 'invited' = 'invited';
    let invitedAllocationId: string | undefined;

    try {
      await listAllocations(eventId);
      mode = 'host';
    } catch {
      try {
        const tickets = await listTickets(eventId);
        invitedAllocationId = tickets.find((t) => t.allocationId)?.allocationId;
        mode = 'invited';
      } catch {
        throw redirect({ to: '/app' });
      }
    }

    return { user, mode, invitedAllocationId };
  },
  component: MemberEventTicketsPage,
});

function MemberEventTicketsPage() {
  const { eventId } = Route.useParams();
  const { user, mode, invitedAllocationId } = Route.useRouteContext();

  const eventQuery = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => getEvent(eventId),
    retry: false,
  });

  const event = eventQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link to="/app/events" className="hover:text-ink-100">
            ← Events
          </Link>
        </p>
        <h1 className="mt-2 text-[28px] font-medium tracking-tight">
          {event?.name ?? 'Event tickets'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {mode === 'host'
            ? 'Manage ticketing, allocations, and guest list.'
            : `Ticket management for ${user.membership?.organizationName ?? 'your organization'}.`}
        </p>
      </div>

      <EventTicketsPanel
        eventId={eventId}
        event={event}
        mode={mode}
        user={user}
        invitedAllocationId={invitedAllocationId}
      />
    </div>
  );
}
