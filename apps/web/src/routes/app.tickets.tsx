import { useEffect, useState } from 'react';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Event, MyTicket } from '@rally/contracts';
import { TicketQrCode } from '@/components/ticketing/TicketQrCode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';
import {
  listAllocations,
  listClaimableEvents,
  listMyTickets,
  publicClaim,
} from '@/lib/ticketing-api';
import { DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT } from '@/lib/ticketing/types/purchase';

export const Route = createFileRoute('/app/tickets')({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight:
      typeof search.highlight === 'string' ? search.highlight : undefined,
  }),
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
  component: MyTicketsPage,
});

function MyTicketsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { highlight } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [buyingEventId, setBuyingEventId] = useState<string | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(
    highlight ?? null,
  );

  useEffect(() => {
    if (highlight) {
      setExpandedTicketId(highlight);
    }
  }, [highlight]);

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
  });

  const claimableQuery = useQuery({
    queryKey: ['events', 'claimable'],
    queryFn: () => listClaimableEvents(),
  });

  const claimMutation = useMutation({
    mutationFn: (eventId: string) => publicClaim(eventId),
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['events', 'claimable'] }),
      ]);
    },
    onError: (err: Error) => setError(err.message),
  });

  const myTickets = ticketsQuery.data ?? [];
  const heldCountByEvent = new Map<string, number>();
  for (const ticket of myTickets) {
    if (ticket.status === 'void') continue;
    heldCountByEvent.set(
      ticket.eventId,
      (heldCountByEvent.get(ticket.eventId) ?? 0) + 1,
    );
  }

  const claimable = (claimableQuery.data ?? []).filter(
    (e) =>
      (heldCountByEvent.get(e.id) ?? 0) < DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT,
  );

  async function startBuy(event: Event) {
    setError(null);
    setBuyingEventId(event.id);

    const existing = myTickets.find(
      (t) => t.eventId === event.id && t.status !== 'void',
    );
    if (existing) {
      setBuyingEventId(null);
      void navigate({
        to: '/app/tickets/buy/$allocationId',
        params: { allocationId: existing.allocationId },
        search: { eventId: event.id, eventName: event.name },
      });
      return;
    }

    try {
      const allocations = await listAllocations(event.id);
      const paid = allocations.find(
        (a) => a.status === 'active' && (a.priceCents ?? 0) > 0,
      );
      if (paid) {
        setBuyingEventId(null);
        void navigate({
          to: '/app/tickets/buy/$allocationId',
          params: { allocationId: paid.id },
          search: { eventId: event.id, eventName: event.name },
        });
        return;
      }
      const free = allocations.find(
        (a) => a.status === 'active' && (a.priceCents ?? 0) === 0,
      );
      if (free) {
        await claimMutation.mutateAsync(event.id);
        setBuyingEventId(null);
        return;
      }
    } catch {
      // Guests cannot list allocations — fall through to claim discovery.
    }

    try {
      const claimed = await claimMutation.mutateAsync(event.id);
      if (claimed.status === 'paid') {
        setBuyingEventId(null);
        return;
      }
      setBuyingEventId(null);
      void navigate({
        to: '/app/tickets/buy/$allocationId',
        params: { allocationId: claimed.allocationId },
        search: { eventId: event.id, eventName: event.name },
      });
    } catch {
      setBuyingEventId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">My tickets</h1>
        <p className="mt-1 text-sm text-ink-500">
          View your tickets and buy from events that are on sale.
          Tap a paid ticket to show its QR at the door.
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      {claimable.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <p className="border-b border-border-subtle px-6 py-3 text-sm font-medium text-ink-300">
              Buy a ticket
            </p>
            <ul className="divide-y divide-border-subtle">
              {claimable.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink-100">{event.name}</p>
                    <p className="text-sm text-ink-500">{event.type}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      buyingEventId === event.id || claimMutation.isPending
                    }
                    isLoading={buyingEventId === event.id}
                    onClick={() => void startBuy(event)}
                  >
                    Buy ticket
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : claimableQuery.isSuccess ? (
        <p className="text-sm text-ink-500">No on-sale events available to buy.</p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {ticketsQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : myTickets.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">You have no tickets yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {myTickets.map((ticket) => (
                <MyTicketRow
                  key={ticket.id}
                  ticket={ticket}
                  expanded={expandedTicketId === ticket.id}
                  onToggle={() =>
                    setExpandedTicketId(
                      expandedTicketId === ticket.id ? null : ticket.id,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MyTicketRow({
  ticket,
  expanded,
  onToggle,
}: {
  ticket: MyTicket;
  expanded: boolean;
  onToggle: () => void;
}) {
  const canRevealQr = ticket.status === 'paid';
  const needsPayment = ticket.status === 'unpaid';

  return (
    <li>
      <div
        className={`flex w-full flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between ${
          canRevealQr
            ? 'cursor-pointer transition-colors hover:bg-white/[0.03]'
            : ''
        }`}
        role={canRevealQr ? 'button' : undefined}
        tabIndex={canRevealQr ? 0 : undefined}
        aria-expanded={canRevealQr ? expanded : undefined}
        onClick={() => {
          if (!canRevealQr) return;
          onToggle();
        }}
        onKeyDown={(e) => {
          if (!canRevealQr) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="space-y-1">
          <p className="font-medium text-ink-100">{ticket.eventName}</p>
          <p className="text-sm text-ink-500">{ticket.allocationLabel}</p>
          {ticket.status === 'paid' ? (
            <p className="text-xs text-ink-500">
              {expanded ? 'Hide QR' : 'Tap to show QR'}
            </p>
          ) : (
            <p className="text-sm text-ink-500">
              {ticket.status === 'unpaid'
                ? 'QR available after payment.'
                : 'Ticket void — no entry QR.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              ticket.status === 'paid'
                ? 'default'
                : ticket.status === 'void'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {ticket.status}
          </Badge>
          {needsPayment ? (
            <Button asChild size="sm">
              <Link
                to="/app/tickets/buy/$allocationId"
                params={{ allocationId: ticket.allocationId }}
                search={{
                  eventId: ticket.eventId,
                  eventName: ticket.eventName,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                Pay
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      {canRevealQr && expanded ? (
        <div className="border-t border-border-subtle px-6 pb-4 pt-3">
          <p className="mb-2 text-xs text-ink-500">Show this QR at the door</p>
          <TicketQrCode credentialToken={ticket.credentialToken} />
        </div>
      ) : null}
    </li>
  );
}
