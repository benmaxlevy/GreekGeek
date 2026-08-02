import { useEffect, useRef, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { TicketPayForm } from '@/components/ticketing/TicketPayForm';
import { TicketQrCode } from '@/components/ticketing/TicketQrCode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';
import { getStripe } from '@/lib/stripe';
import { checkoutTicket, listMyTickets } from '@/lib/ticketing-api';

const PAID_POLL_INTERVAL_MS = 1500;
const PAID_POLL_MAX_MS = 30_000;

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
  component: TicketPayPage,
});

function TicketPayPage() {
  const { id: ticketId } = Route.useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'checkout' | 'confirming' | 'success'>(
    'checkout',
  );
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollStartedAt = useRef<number | null>(null);

  const checkoutQuery = useQuery({
    queryKey: ['tickets', 'checkout', ticketId],
    queryFn: () => checkoutTicket(ticketId),
    retry: false,
    enabled: phase === 'checkout',
  });

  const ticketQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
    enabled: phase === 'confirming' || phase === 'success',
    refetchInterval: (query) => {
      if (phase !== 'confirming') return false;
      const ticket = query.state.data?.find((t) => t.id === ticketId);
      if (ticket?.status === 'paid') return false;
      if (pollTimedOut) return false;
      return PAID_POLL_INTERVAL_MS;
    },
  });

  const paidTicket = ticketQuery.data?.find(
    (t) => t.id === ticketId && t.status === 'paid',
  );

  useEffect(() => {
    if (phase !== 'confirming') return;
    if (pollStartedAt.current == null) {
      pollStartedAt.current = Date.now();
    }
    if (paidTicket) {
      setPhase('success');
      return;
    }
    const started = pollStartedAt.current;
    const timer = window.setTimeout(() => {
      if (Date.now() - started >= PAID_POLL_MAX_MS) {
        setPollTimedOut(true);
      }
    }, PAID_POLL_MAX_MS - (Date.now() - started));
    return () => window.clearTimeout(timer);
  }, [phase, paidTicket]);

  useEffect(() => {
    if (phase !== 'success' || !paidTicket) return;
    const timer = window.setTimeout(() => {
      void navigate({
        to: '/app/tickets',
        search: { highlight: ticketId },
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [phase, paidTicket, navigate, ticketId]);

  const checkout = checkoutQuery.data;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link to="/app/tickets" className="hover:text-ink-100">
            ← My tickets
          </Link>
        </p>
        <h1 className="mt-2 text-[28px] font-medium tracking-tight">
          Pay for ticket
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Pay for your ticket. Your QR unlocks after payment confirms.
        </p>
      </div>

      {phase === 'checkout' && checkoutQuery.isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-ink-500">Preparing checkout…</p>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'checkout' && checkoutQuery.isError ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-[color:var(--error)]">
              {checkoutQuery.error instanceof Error
                ? checkoutQuery.error.message
                : 'Checkout failed'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void checkoutQuery.refetch()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'checkout' && checkout ? (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-1 text-sm">
              <p className="font-medium text-ink-100">
                {`$${(checkout.priceCents / 100).toFixed(2)} + $${(checkout.feeCents / 100).toFixed(2)} Rally fee = $${(checkout.amountCents / 100).toFixed(2)}`}
              </p>
              <p className="text-ink-500">Includes platform fee · USD</p>
            </div>
            <Elements
              stripe={getStripe()}
              options={{
                clientSecret: checkout.clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#ffffff',
                    colorBackground: '#1a1f2e',
                    colorText: '#ffffff',
                    colorDanger: '#e5544b',
                    borderRadius: '6px',
                  },
                },
              }}
            >
              <TicketPayForm
                amountCents={checkout.amountCents}
                onSuccess={() => {
                  pollStartedAt.current = Date.now();
                  setPollTimedOut(false);
                  setPhase('confirming');
                }}
              />
            </Elements>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'confirming' ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-medium text-ink-100">Payment received</p>
            {pollTimedOut ? (
              <>
                <p className="text-sm text-ink-500">
                  Payment is still processing. Your QR will appear on My tickets
                  once confirmed — usually within a minute.
                </p>
                <Button asChild variant="outline">
                  <Link to="/app/tickets">Back to My tickets</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-500">
                Confirming ticket… this can take a few seconds.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {phase === 'success' && paidTicket ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="font-medium text-ink-100">Ticket paid</p>
            <p className="text-sm text-ink-500">
              Show this QR at the door. Redirecting to My tickets…
            </p>
            <TicketQrCode credentialToken={paidTicket.credentialToken} />
            <Button asChild variant="outline">
              <Link to="/app/tickets" search={{ highlight: ticketId }}>
                View in My tickets
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
