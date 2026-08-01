import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';
import { listClaimableEvents, listMyTickets, markTicketPaid, publicClaim } from '@/lib/ticketing-api';

export const Route = createFileRoute('/app/tickets')({
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
  const [error, setError] = useState<string | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
  });

  const claimableQuery = useQuery({
    queryKey: ['events', 'claimable'],
    queryFn: () => listClaimableEvents(),
  });

  const markPaidMutation = useMutation({
    mutationFn: (ticketId: string) => markTicketPaid(ticketId),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['tickets', 'mine'] });
    },
    onError: (err: Error) => setError(err.message),
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
  const heldEventIds = new Set(
    myTickets.filter((t) => t.status !== 'void').map((t) => t.eventId),
  );
  const claimable = (claimableQuery.data ?? []).filter(
    (e) => !heldEventIds.has(e.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">My tickets</h1>
        <p className="mt-1 text-sm text-ink-500">
          View your tickets and buy from public on-sale events.
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
                    disabled={claimMutation.isPending}
                    onClick={() => claimMutation.mutate(event.id)}
                  >
                    Buy ticket
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : claimableQuery.isSuccess ? (
        <p className="text-sm text-ink-500">No public on-sale events available to buy.</p>
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
                <li
                  key={ticket.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-ink-100">{ticket.eventName}</p>
                    <p className="text-sm text-ink-500">{ticket.allocationLabel}</p>
                    <p className="font-mono text-xs text-ink-500">
                      {ticket.credentialToken.slice(0, 16)}…
                    </p>
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
                    {ticket.status === 'unpaid' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={markPaidMutation.isPending}
                        onClick={() => markPaidMutation.mutate(ticket.id)}
                      >
                        Mark paid
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
