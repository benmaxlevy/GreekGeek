import { useEffect, useMemo, useRef, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { computePurchaseAmounts } from '@greekgeek/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { TicketPayForm } from '@/components/ticketing/TicketPayForm';
import { TicketQrCode } from '@/components/ticketing/TicketQrCode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { meQueryOptions } from '@/lib/auth';
import { destinationForUser } from '@/lib/auth-routing';
import { getStripe } from '@/lib/stripe';
import { checkoutPurchase, listAllocations, listMyTickets } from '@/lib/ticketing-api';
import {
  DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT,
  DEFAULT_RALLY_FEE_PERCENT,
  formatUsd,
  PurchaseCheckoutError,
} from '@/lib/ticketing/types/purchase';

const PAID_POLL_INTERVAL_MS = 1500;
const PAID_POLL_MAX_MS = 30_000;

export const Route = createFileRoute('/app/tickets_/buy/$allocationId')({
  validateSearch: (search: Record<string, unknown>): { eventId?: string; eventName?: string } => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
    eventName: typeof search.eventName === 'string' ? search.eventName : undefined,
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
  component: TicketBuyPage,
});

function TicketBuyPage() {
  const { allocationId } = Route.useParams();
  const { eventId: searchEventId, eventName: searchEventName } = Route.useSearch();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(1);
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const [phase, setPhase] = useState<'select' | 'pay' | 'confirming' | 'success'>('select');
  const [ticketIds, setTicketIds] = useState<string[]>([]);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollStartedAt = useRef<number | null>(null);

  const mineQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
  });

  const existingForAlloc = useMemo(
    () =>
      (mineQuery.data ?? []).filter((t) => t.allocationId === allocationId && t.status !== 'void'),
    [mineQuery.data, allocationId],
  );

  const eventId = searchEventId ?? existingForAlloc[0]?.eventId ?? undefined;
  const eventName = searchEventName ?? existingForAlloc[0]?.eventName ?? 'Event';

  // Open purchase unpaid holds are replaced on re-checkout — exclude from headroom.
  const heldForEvent = useMemo(() => {
    return (mineQuery.data ?? []).filter((t) => {
      if (t.status === 'void') return false;
      if (eventId ? t.eventId !== eventId : t.allocationId !== allocationId) {
        return false;
      }
      if (t.status === 'unpaid' && t.purchaseId != null && t.allocationId === allocationId) {
        return false;
      }
      return true;
    }).length;
  }, [mineQuery.data, eventId, allocationId]);

  const allocationsQuery = useQuery({
    queryKey: ['ticketing', 'allocations', eventId],
    queryFn: () => listAllocations(eventId!),
    enabled: Boolean(eventId),
    retry: false,
  });

  const allocation = allocationsQuery.data?.find((a) => a.id === allocationId);

  const userHeadroom = Math.max(0, DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT - heldForEvent);

  const allocationRemaining =
    allocation != null ? Math.max(0, allocation.quantity - allocation.issuedCount) : null;

  const maxQuantity = Math.max(
    0,
    Math.min(
      userHeadroom,
      allocationRemaining ?? DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT,
      serverRemaining ?? DEFAULT_MAX_TICKETS_PER_USER_PER_EVENT,
    ),
  );

  useEffect(() => {
    if (maxQuantity < 1) return;
    if (quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
    if (quantity < 1) {
      setQuantity(1);
    }
  }, [maxQuantity, quantity]);

  const unitPriceCents = allocation?.priceCents ?? null;

  const preview =
    unitPriceCents != null && unitPriceCents > 0
      ? computePurchaseAmounts(quantity, unitPriceCents, DEFAULT_RALLY_FEE_PERCENT)
      : null;

  const checkoutMutation = useMutation({
    mutationFn: () => checkoutPurchase({ allocationId, quantity }),
    onSuccess: (data) => {
      setServerRemaining(null);
      setTicketIds(data.ticketIds);
      setPhase('pay');
    },
    onError: (err: Error) => {
      if (err instanceof PurchaseCheckoutError && err.remaining != null) {
        setServerRemaining(err.remaining);
      }
    },
  });

  const checkout = checkoutMutation.data;

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
    enabled: phase === 'confirming' || phase === 'success',
    refetchInterval: (query) => {
      if (phase !== 'confirming') return false;
      if (pollTimedOut) return false;
      const paidCount =
        query.state.data?.filter((t) => ticketIds.includes(t.id) && t.status === 'paid').length ??
        0;
      if (ticketIds.length > 0 && paidCount >= ticketIds.length) return false;
      return PAID_POLL_INTERVAL_MS;
    },
  });

  const paidTickets = (ticketsQuery.data ?? []).filter(
    (t) => ticketIds.includes(t.id) && t.status === 'paid',
  );
  const allPaid = ticketIds.length > 0 && paidTickets.length >= ticketIds.length;

  useEffect(() => {
    if (phase !== 'confirming') return;
    if (pollStartedAt.current == null) {
      pollStartedAt.current = Date.now();
    }
    if (allPaid) {
      setPhase('success');
      return;
    }
    const started = pollStartedAt.current;
    const timer = window.setTimeout(
      () => {
        if (Date.now() - started >= PAID_POLL_MAX_MS) {
          setPollTimedOut(true);
        }
      },
      PAID_POLL_MAX_MS - (Date.now() - started),
    );
    return () => window.clearTimeout(timer);
  }, [phase, allPaid]);

  useEffect(() => {
    if (phase !== 'success' || !allPaid) return;
    const highlight = paidTickets[0]?.id;
    const timer = window.setTimeout(() => {
      void navigate({
        to: '/app/tickets',
        search: highlight ? { highlight } : {},
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [phase, allPaid, navigate, paidTickets]);

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-ink-500">
          <Link to="/app/tickets" className="hover:text-ink-100">
            ← My tickets
          </Link>
        </p>
        <p className="rl-eyebrow">Checkout</p>
        <h1 className="display-md font-display">Buy tickets</h1>
        <p className="max-w-2xl text-sm text-ink-500">
          {eventName}. Choose quantity, then pay. QR codes unlock after payment confirms.
        </p>
      </div>

      {maxQuantity < 1 && phase === 'select' ? (
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <p className="display-sm font-display">Tickets unavailable.</p>
              <p className="text-sm text-[color:var(--error)]">
                You may already be at the per-user limit, or the pool is sold out.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/tickets">Back to My tickets</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(phase === 'select' || phase === 'pay') && maxQuantity >= 1 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle px-6 py-4">
            <p className="rl-eyebrow">Reserve your entry</p>
            <p className="display-sm font-display mt-1">{eventName}</p>
          </div>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <Label htmlFor="ticket-qty">Quantity</Label>
              <Input
                id="ticket-qty"
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                disabled={phase === 'pay' && checkoutMutation.isPending}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setQuantity(Math.min(maxQuantity, Math.max(1, Math.floor(next))));
                  if (phase === 'pay') {
                    setPhase('select');
                    checkoutMutation.reset();
                  }
                }}
                className="min-h-11 w-28"
              />
              <p className="text-xs text-ink-500">
                Up to <span className="num">{maxQuantity}</span> for this event
                {allocationRemaining != null ? (
                  <>
                    {' · '}
                    <span className="num">{allocationRemaining}</span> left in pool
                  </>
                ) : null}
              </p>
            </div>

            {checkout ? (
              <ItemizedSummary
                quantity={checkout.quantity}
                unitPriceCents={checkout.unitPriceCents}
                subtotalCents={checkout.subtotalCents}
                feeCents={checkout.feeCents}
                amountCents={checkout.amountCents}
              />
            ) : preview ? (
              <ItemizedSummary
                quantity={quantity}
                unitPriceCents={unitPriceCents!}
                subtotalCents={preview.subtotalCents}
                feeCents={preview.feeCents}
                amountCents={preview.amountCents}
                preview
              />
            ) : (
              <p className="text-sm text-ink-500">Price confirmed at checkout.</p>
            )}

            {checkoutMutation.isError ? (
              <p className="text-sm text-[color:var(--error)]">
                {checkoutMutation.error instanceof Error
                  ? checkoutMutation.error.message
                  : 'Checkout failed'}
              </p>
            ) : null}

            {phase === 'select' ? (
              <Button
                type="button"
                className="w-full"
                disabled={checkoutMutation.isPending || maxQuantity < 1}
                isLoading={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
              >
                Continue to payment
              </Button>
            ) : null}

            {phase === 'pay' && checkout ? (
              <Elements
                key={checkout.clientSecret}
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
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {phase === 'confirming' ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle px-6 py-4">
            <p className="rl-eyebrow">Payment status</p>
            <p className="display-sm font-display mt-1">Payment received</p>
          </div>
          <CardContent className="space-y-3 p-6">
            {pollTimedOut ? (
              <>
                <p className="text-sm text-ink-500">
                  Payment is still processing. Your QR codes will appear on My tickets once
                  confirmed — usually within a minute.
                </p>
                <Button asChild variant="outline">
                  <Link to="/app/tickets">Back to My tickets</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-500">
                Confirming {ticketIds.length} ticket
                {ticketIds.length === 1 ? '' : 's'}… this can take a few seconds.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {phase === 'success' && allPaid ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle px-6 py-4">
            <p className="rl-eyebrow">Confirmed</p>
            <p className="display-sm font-display mt-1">
              {paidTickets.length === 1 ? 'Ticket paid' : `${paidTickets.length} tickets paid`}
            </p>
          </div>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-ink-500">
              Show these QR codes at the door. Redirecting to My tickets…
            </p>
            <ul className="space-y-4">
              {paidTickets.map((ticket, index) => (
                <li key={ticket.id} className="space-y-2">
                  <p className="text-xs text-ink-500">
                    Ticket {index + 1} of {paidTickets.length}
                  </p>
                  <TicketQrCode credentialToken={ticket.credentialToken} />
                </li>
              ))}
            </ul>
            <Button asChild variant="outline">
              <Link to="/app/tickets" search={{ highlight: paidTickets[0]?.id }}>
                View in My tickets
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ItemizedSummary({
  quantity,
  unitPriceCents,
  subtotalCents,
  feeCents,
  amountCents,
  preview = false,
}: {
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  feeCents: number;
  amountCents: number;
  preview?: boolean;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="num font-medium text-ink-100">
        {quantity} × {formatUsd(unitPriceCents)} = {formatUsd(subtotalCents)}
      </p>
      <p className="num text-ink-300">
        GreekGeek fee {formatUsd(feeCents)}
        {preview ? ' (estimate)' : ''}
      </p>
      <p className="num font-medium text-ink-100">Total {formatUsd(amountCents)}</p>
      <p className="text-ink-500">Includes platform fee · USD</p>
    </div>
  );
}
