import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';
import { listMyTickets } from '@/lib/ticketing-api';

export const Route = createFileRoute('/app/tickets_/$id/pay')({
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
  component: TicketPayRedirectPage,
});

/** Legacy ticket pay URL → allocation buy flow. */
function TicketPayRedirectPage() {
  const { id: ticketId } = Route.useParams();
  const navigate = useNavigate();

  const ticketQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
  });

  const ticket = ticketQuery.data?.find((t) => t.id === ticketId);

  useEffect(() => {
    if (!ticket) return;
    void navigate({
      to: '/app/tickets/buy/$allocationId',
      params: { allocationId: ticket.allocationId },
      search: {
        eventId: ticket.eventId,
        eventName: ticket.eventName,
      },
      replace: true,
    });
  }, [ticket, navigate]);

  if (ticketQuery.isError) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-[color:var(--error)]">
              {ticketQuery.error instanceof Error
                ? ticketQuery.error.message
                : 'Could not load ticket'}
            </p>
            <Button asChild variant="outline">
              <Link to="/app/tickets">Back to My tickets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (ticketQuery.isSuccess && !ticket) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-ink-500">Ticket not found.</p>
            <Button asChild variant="outline">
              <Link to="/app/tickets">Back to My tickets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-ink-500">Redirecting to checkout…</p>
        </CardContent>
      </Card>
    </div>
  );
}
