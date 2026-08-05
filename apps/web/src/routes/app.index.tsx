import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import type { ClaimableEvent, MyTicket } from '@greekgeek/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/auth';
import { listClaimableEvents, listMyTickets } from '@/lib/ticketing-api';

export const Route = createFileRoute('/app/')({
  component: UpcomingPage,
});

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMoney(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
}

function byStartsAt(a: ClaimableEvent, b: ClaimableEvent): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

function UpcomingPage() {
  const { data: user } = useSuspenseQuery(meQueryOptions);
  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => listMyTickets(),
  });
  const claimableQuery = useQuery({
    queryKey: ['events', 'claimable'],
    queryFn: () => listClaimableEvents(),
  });

  if (!user) {
    return null;
  }

  const myTickets = ticketsQuery.data ?? [];
  const claimable = [...(claimableQuery.data ?? [])].sort(byStartsAt);
  const startsAtByEventId = new Map(claimable.map((e) => [e.id, e.startsAt]));

  const liveTickets = myTickets
    .filter((t) => t.status !== 'void')
    .sort((a, b) => {
      const aAt = startsAtByEventId.get(a.eventId) ?? a.createdAt;
      const bAt = startsAtByEventId.get(b.eventId) ?? b.createdAt;
      return Date.parse(aAt) - Date.parse(bAt);
    });

  const heldEventIds = new Set(liveTickets.map((t) => t.eventId));
  const onSale = claimable.filter((e) => !heldEventIds.has(e.id));
  const hero: ClaimableEvent | MyTicket | null = onSale[0] ?? liveTickets[0] ?? null;
  const heroIsTicket = hero != null && 'credentialToken' in hero;

  const loading = ticketsQuery.isLoading || claimableQuery.isLoading;
  const empty = !loading && liveTickets.length === 0 && onSale.length === 0;

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="rl-eyebrow">Coming up</p>
        {empty ? (
          <>
            <h1 className="display-lg font-display leading-[1.02]">
              Nothing open
              <br />
              to you yet.
            </h1>
            <p className="max-w-md text-sm text-ink-500">
              GreekGeek only shows events you can claim or tickets you already hold. When something
              opens, it lands here.
            </p>
          </>
        ) : (
          <h1 className="display-lg font-display leading-[1.02]">Upcoming</h1>
        )}
      </header>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-ink-500">Loading upcoming…</CardContent>
        </Card>
      ) : null}

      {!loading && hero && !heroIsTicket ? (
        <UpcomingHeroEvent event={hero as ClaimableEvent} />
      ) : null}

      {!loading && hero && heroIsTicket ? (
        <UpcomingHeroTicket ticket={hero as MyTicket} />
      ) : null}

      {!loading && liveTickets.length > 0 ? (
        <section className="space-y-3">
          <p className="rl-eyebrow">Your tickets</p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border-subtle">
              {liveTickets.slice(0, 5).map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to="/app/tickets"
                    search={{ highlight: ticket.id }}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-100">{ticket.eventName}</p>
                      <p className="text-xs text-ink-500">
                        {startsAtByEventId.has(ticket.eventId)
                          ? formatWhen(startsAtByEventId.get(ticket.eventId)!)
                          : ticket.allocationLabel}
                      </p>
                    </div>
                    <Badge
                      variant={
                        ticket.status === 'paid'
                          ? 'default'
                          : ticket.status === 'unpaid'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {ticket.status === 'paid' ? 'Your ticket' : ticket.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {liveTickets.length > 5 ? (
            <Button asChild variant="quiet" className="w-full">
              <Link to="/app/tickets">See all tickets</Link>
            </Button>
          ) : null}
        </section>
      ) : null}

      {!loading && onSale.length > (hero && !heroIsTicket ? 1 : 0) ? (
        <section className="space-y-3">
          <p className="rl-eyebrow">Also on sale</p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border-subtle">
              {onSale.slice(hero && !heroIsTicket ? 1 : 0).map((event) => (
                <li key={event.id}>
                  <Link
                    to="/app/tickets/buy/$allocationId"
                    params={{ allocationId: event.allocationId }}
                    search={{ eventId: event.id, eventName: event.name }}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-100">{event.name}</p>
                      <p className="text-xs text-ink-500">{formatWhen(event.startsAt)}</p>
                    </div>
                    <span className="num shrink-0 text-sm text-ink-300">
                      {formatMoney(event.priceCents) ?? 'Open'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {empty ? (
        <Button asChild variant="primary" className="w-full sm:w-auto">
          <Link to="/app/tickets">Check tickets</Link>
        </Button>
      ) : null}
    </div>
  );
}

function UpcomingHeroEvent({ event }: { event: ClaimableEvent }) {
  const price = formatMoney(event.priceCents);
  return (
    <Link
      to="/app/tickets/buy/$allocationId"
      params={{ allocationId: event.allocationId }}
      search={{ eventId: event.id, eventName: event.name }}
      className="group block"
    >
      <article className="surface-glass-panel overflow-hidden rounded-[26px] p-5 md:p-6">
        <div className="mb-8 flex items-start justify-between gap-3">
          <Badge variant="pending">{event.type}</Badge>
          {price ? <span className="num text-sm font-semibold text-ink-100">{price}</span> : null}
        </div>
        <h2
          className="font-display leading-[0.98] text-ink-100"
          style={{ fontSize: 'clamp(32px, 6vw, 48px)', letterSpacing: '-0.028em' }}
        >
          {event.name}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-300">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} aria-hidden />
            <span className="num">{formatWhen(event.startsAt)}</span>
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} aria-hidden />
              {event.location}
            </span>
          ) : null}
        </div>
        <div
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: 'rgba(255,255,255,0.16)',
            background: 'rgba(10,13,18,0.55)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
          }}
        >
          <span className="text-[13.5px] font-semibold text-ink-100">
            {(event.priceCents ?? 0) > 0 ? 'Get tickets' : 'Claim your spot'}
          </span>
          <ArrowRight
            size={17}
            className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden
          />
        </div>
      </article>
    </Link>
  );
}

function UpcomingHeroTicket({ ticket }: { ticket: MyTicket }) {
  return (
    <Link to="/app/tickets" search={{ highlight: ticket.id }} className="group block">
      <article className="surface-glass-panel overflow-hidden rounded-[26px] p-5 md:p-6">
        <div className="mb-8">
          <Badge variant={ticket.status === 'paid' ? 'paid' : 'pending'}>
            {ticket.status === 'paid' ? 'Your ticket' : ticket.status}
          </Badge>
        </div>
        <h2
          className="font-display leading-[0.98] text-ink-100"
          style={{ fontSize: 'clamp(32px, 6vw, 48px)', letterSpacing: '-0.028em' }}
        >
          {ticket.eventName}
        </h2>
        <p className="mt-3 text-sm text-ink-300">{ticket.allocationLabel}</p>
        <div
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: 'rgba(255,255,255,0.16)',
            background: 'rgba(10,13,18,0.55)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
          }}
        >
          <span className="text-[13.5px] font-semibold text-ink-100">
            {ticket.status === 'paid' ? 'Open your ticket' : 'Finish payment'}
          </span>
          <ArrowRight
            size={17}
            className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden
          />
        </div>
      </article>
    </Link>
  );
}
