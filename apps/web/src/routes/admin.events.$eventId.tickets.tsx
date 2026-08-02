import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { EventTicketsPanel } from '@/components/ticketing/EventTicketsPanel';
import { getEvent } from '@/lib/events-api';

export const Route = createFileRoute('/admin/events/$eventId/tickets')({
  component: AdminEventTicketsPage,
});

function AdminEventTicketsPage() {
  const { eventId } = Route.useParams();

  const eventQuery = useQuery({
    queryKey: ['admin', 'events', eventId],
    queryFn: () => getEvent(eventId),
  });

  const event = eventQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link to="/admin/ticketed-events" className="hover:text-ink-100">
            ← Ticketed events
          </Link>
        </p>
        <h1 className="mt-2 text-[28px] font-medium tracking-tight">
          {event?.name ?? 'Event tickets'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Admin ticketing config, allocations, and guest list.
        </p>
      </div>

      {eventQuery.isError ? (
        <p className="text-sm text-[color:var(--error)]">
          Failed to load event. Ticket controls may still work below.
        </p>
      ) : null}

      <EventTicketsPanel
        eventId={eventId}
        event={event}
        mode="admin"
        canManage
        canScan
      />
    </div>
  );
}
