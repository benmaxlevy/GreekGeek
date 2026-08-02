import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { HostEventPayoutSummary } from '@/components/event-payouts/HostEventPayoutSummary';
import { EventTicketsPanel } from '@/components/ticketing/EventTicketsPanel';
import { meQueryOptions } from '@/lib/auth';
import {
  canAccessEventTicketing,
  canManageTickets,
  canManageOrgPayments,
  canScanTickets,
  destinationForUser,
  isAdminUser,
} from '@/lib/auth-routing';
import { getEvent } from '@/lib/events-api';
import { listAllocations } from '@/lib/ticketing-api';

export const Route = createFileRoute('/app/events/$eventId/tickets')({
  beforeLoad: async ({ context, params }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (user.status !== 'ACTIVE') {
      throw redirect({ to: destinationForUser(user) });
    }
    if (!canAccessEventTicketing(user)) {
      throw redirect({ to: '/app' });
    }

    const { eventId } = params;
    let mode: 'host' | 'invited' = 'invited';
    let invitedAllocationId: string | undefined;
    let canManage = false;
    let canScan = false;

    try {
      const event = await getEvent(eventId);
      const isHost = user.membership?.organizationId === event.organizationId;

      if (isHost) {
        canManage = canManageTickets(user);
        canScan = canScanTickets(user) || isAdminUser(user);
        if (!canManage && !canScan) {
          throw redirect({ to: '/app' });
        }
        mode = 'host';
      } else {
        if (!canManageTickets(user)) {
          throw redirect({ to: '/app' });
        }
        canManage = true;
        mode = 'invited';
        const allocations = await listAllocations(eventId);
        invitedAllocationId = allocations[0]?.id;
        if (!invitedAllocationId) {
          throw redirect({ to: '/app' });
        }
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'to' in err) {
        throw err;
      }
      throw redirect({ to: '/app' });
    }

    return { user, mode, invitedAllocationId, canManage, canScan };
  },
  component: MemberEventTicketsPage,
});

function MemberEventTicketsPage() {
  const { eventId } = Route.useParams();
  const { user, mode, invitedAllocationId, canManage, canScan } = Route.useRouteContext();

  const eventQuery = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => getEvent(eventId),
    retry: false,
  });

  const event = eventQuery.data;
  const scanOnly = canScan && !canManage;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-ink-500">
          <Link to="/app/events" className="hover:text-ink-100">
            ← Events
          </Link>
        </p>
        <p className="rl-eyebrow">Ticket operations</p>
        <h1 className="display-md font-display">{event?.name ?? 'Event tickets'}</h1>
        <p className="max-w-2xl text-sm text-ink-500">
          {scanOnly
            ? 'Scan tickets at the door for this event.'
            : mode === 'host'
              ? 'Manage tickets, ticket pools, and the guest list.'
              : `Manage tickets for ${user.membership?.organizationName ?? 'your organization'}.`}
        </p>
      </div>

      <EventTicketsPanel
        eventId={eventId}
        event={event}
        mode={mode}
        user={user}
        invitedAllocationId={invitedAllocationId}
        canManage={canManage}
        canScan={canScan}
      />
      {event && canManageOrgPayments(user, event.organizationId) ? (
        <HostEventPayoutSummary eventId={eventId} />
      ) : null}
    </div>
  );
}
