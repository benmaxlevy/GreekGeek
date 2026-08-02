import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { EventTicketsPanel } from '@/components/ticketing/EventTicketsPanel';
import { getEvent } from '@/lib/events-api';

export const Route = createFileRoute('/admin/events/$eventId/tickets')({
  component: AdminEventTicketsPage,
});

function AdminEventTicketsPage() {
  const { eventId } = Route.useParams();
  const { user } = Route.useRouteContext();

  const eventQuery = useQuery({
    queryKey: ['admin', 'events', eventId],
    queryFn: () => getEvent(eventId),
  });

  const event = eventQuery.data;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">
          <Link to="/admin/ticketed-events" className="transition-colors hover:text-ink-100">
            ← Ticketed events
          </Link>
        </p>
        <h1 className="display-sm">{event?.name ?? 'Event tickets'}</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-500">
          Set up tickets, ticket pools, and the guest list for this event.
        </p>
      </div>

      {eventQuery.isError ? (
        <p className="rounded-lg border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--error)]">
          Failed to load event. Ticket controls may still work below.
        </p>
      ) : null}

      <EventTicketsPanel
        eventId={eventId}
        event={event}
        mode="admin"
        user={user}
        canManage
        canScan
      />
    </div>
  );
}
