import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Event,
  PublicUser,
  Ticket,
  TicketAllocation,
  TicketSaleStatus,
} from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listOrganizations } from '@/lib/admin-api';
import {
  createAllocation,
  guestList,
  listAllocations,
  listTickets,
  markTicketPaid,
  patchEventTicketing,
  updateAllocation,
  voidTicket,
} from '@/lib/ticketing-api';

type Tab = 'config' | 'allocations' | 'tickets' | 'guests';

export type TicketPageMode = 'host' | 'invited' | 'admin';

type Props = {
  eventId: string;
  event?: Event | null;
  mode: TicketPageMode;
  user?: PublicUser;
  invitedAllocationId?: string;
};

function formatCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'paid' || status === 'on_sale' || status === 'active') {
    return 'default';
  }
  if (status === 'void' || status === 'closed') {
    return 'destructive';
  }
  return 'secondary';
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetime(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

function allocationLabel(alloc: TicketAllocation): string {
  return alloc.organizationName ?? (alloc.organizationId ? 'Organization' : 'Public');
}

export function EventTicketsPanel({
  eventId,
  event,
  mode,
  user,
  invitedAllocationId,
}: Props) {
  const queryClient = useQueryClient();
  const isHost = mode === 'host' || mode === 'admin';
  const [tab, setTab] = useState<Tab>(isHost ? 'config' : 'tickets');
  const [error, setError] = useState<string | null>(null);

  const [ticketingEnabled, setTicketingEnabled] = useState(
    event?.ticketingEnabled ?? false,
  );
  const [ticketCapacity, setTicketCapacity] = useState(
    event?.ticketCapacity != null ? String(event.ticketCapacity) : '',
  );
  const [ticketSaleStatus, setTicketSaleStatus] = useState<TicketSaleStatus | ''>(
    event?.ticketSaleStatus ?? 'draft',
  );
  const [salesOpenAt, setSalesOpenAt] = useState(
    toLocalDatetime(event?.ticketSalesOpenAt ?? null),
  );
  const [salesCloseAt, setSalesCloseAt] = useState(
    toLocalDatetime(event?.ticketSalesCloseAt ?? null),
  );

  const [allocOrgId, setAllocOrgId] = useState('');
  const [allocAllOrgs, setAllocAllOrgs] = useState(false);
  const [allocPublic, setAllocPublic] = useState(false);
  const [allocQty, setAllocQty] = useState('10');
  const [allocPrice, setAllocPrice] = useState('');

  const allocationsQuery = useQuery({
    queryKey: ['ticketing', 'allocations', eventId],
    queryFn: () => listAllocations(eventId),
    enabled: isHost,
  });

  const ticketsQuery = useQuery({
    queryKey: ['ticketing', 'tickets', eventId, invitedAllocationId],
    queryFn: () =>
      listTickets(
        eventId,
        invitedAllocationId ? { allocationId: invitedAllocationId } : {},
      ),
  });

  const guestsQuery = useQuery({
    queryKey: ['ticketing', 'guests', eventId],
    queryFn: () => guestList(eventId),
    enabled: isHost && tab === 'guests',
  });

  const orgsQuery = useQuery({
    queryKey: ['organizations'],
    queryFn: () => listOrganizations({}),
    enabled: isHost && tab === 'allocations',
  });

  const allocations = allocationsQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const resolvedInvitedAllocId =
    invitedAllocationId ?? tickets.find((t) => t.allocationId)?.allocationId;

  const visibleAllocations = isHost
    ? allocations
    : allocations.filter((a) => a.id === resolvedInvitedAllocId);

  function invalidateTicketing() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticketing', 'allocations', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['ticketing', 'tickets', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['ticketing', 'guests', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
  }

  const configMutation = useMutation({
    mutationFn: () =>
      patchEventTicketing(eventId, {
        ticketingEnabled,
        ticketCapacity: ticketingEnabled
          ? Number(ticketCapacity)
          : null,
        ticketSaleStatus: ticketingEnabled ? ticketSaleStatus || 'draft' : null,
        ticketSalesOpenAt: ticketingEnabled ? fromLocalDatetime(salesOpenAt) : null,
        ticketSalesCloseAt: ticketingEnabled ? fromLocalDatetime(salesCloseAt) : null,
      }),
    onSuccess: async () => {
      setError(null);
      await invalidateTicketing();
    },
    onError: (err: Error) => setError(err.message),
  });

  const createAllocMutation = useMutation({
    mutationFn: () => {
      const quantity = Number(allocQty);
      const priceCents = allocPrice.trim()
        ? Math.round(Number(allocPrice) * 100)
        : undefined;
      if (allocAllOrgs) {
        return createAllocation(eventId, { allOrgs: true, quantity, priceCents });
      }
      if (allocPublic) {
        return createAllocation(eventId, { organizationId: null, quantity, priceCents });
      }
      return createAllocation(eventId, {
        organizationId: allocOrgId,
        quantity,
        priceCents,
      });
    },
    onSuccess: async () => {
      setAllocOrgId('');
      setAllocAllOrgs(false);
      setAllocPublic(false);
      setAllocQty('10');
      setAllocPrice('');
      setError(null);
      await invalidateTicketing();
    },
    onError: (err: Error) => setError(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: (ticketId: string) => markTicketPaid(ticketId),
    onSuccess: async () => {
      setError(null);
      await invalidateTicketing();
    },
    onError: (err: Error) => setError(err.message),
  });

  const voidMutation = useMutation({
    mutationFn: (ticketId: string) => voidTicket(ticketId),
    onSuccess: async () => {
      setError(null);
      await invalidateTicketing();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateAllocMutation = useMutation({
    mutationFn: ({
      allocationId,
      quantity,
      status,
    }: {
      allocationId: string;
      quantity?: number;
      status?: 'active' | 'closed';
    }) => updateAllocation(eventId, allocationId, { quantity, status }),
    onSuccess: async () => {
      setError(null);
      await invalidateTicketing();
    },
    onError: (err: Error) => setError(err.message),
  });

  const tabs: { id: Tab; label: string }[] = isHost
    ? [
        { id: 'config', label: 'Config' },
        { id: 'allocations', label: 'Allocations' },
        { id: 'tickets', label: 'Tickets' },
        { id: 'guests', label: 'Guest list' },
      ]
    : [{ id: 'tickets', label: 'Tickets' }];

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? 'default' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'config' && isHost ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ticketing config</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                configMutation.mutate();
              }}
            >
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="ticketing-enabled"
                  type="checkbox"
                  checked={ticketingEnabled}
                  onChange={(e) => setTicketingEnabled(e.target.checked)}
                  className="size-4"
                />
                <Label htmlFor="ticketing-enabled">Enable ticketing</Label>
              </div>
              {ticketingEnabled ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ticket-capacity">
                      Ticket capacity
                      {event?.maxHeadcount
                        ? ` (max headcount ${event.maxHeadcount})`
                        : ''}
                    </Label>
                    <Input
                      id="ticket-capacity"
                      type="number"
                      min={1}
                      max={event?.maxHeadcount}
                      required
                      value={ticketCapacity}
                      onChange={(e) => setTicketCapacity(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale-status">Sale status</Label>
                    <select
                      id="sale-status"
                      value={ticketSaleStatus}
                      onChange={(e) =>
                        setTicketSaleStatus(e.target.value as TicketSaleStatus)
                      }
                      className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
                    >
                      <option value="draft">Draft</option>
                      <option value="on_sale">On sale</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sales-open">Sales open (optional)</Label>
                    <Input
                      id="sales-open"
                      type="datetime-local"
                      value={salesOpenAt}
                      onChange={(e) => setSalesOpenAt(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sales-close">Sales close (optional)</Label>
                    <Input
                      id="sales-close"
                      type="datetime-local"
                      value={salesCloseAt}
                      onChange={(e) => setSalesCloseAt(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                </>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" isLoading={configMutation.isPending}>
                  Save config
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'allocations' && isHost ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  createAllocMutation.mutate();
                }}
              >
                <div className="flex flex-wrap gap-4 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    <input
                      type="checkbox"
                      checked={allocAllOrgs}
                      onChange={(e) => {
                        setAllocAllOrgs(e.target.checked);
                        if (e.target.checked) setAllocPublic(false);
                      }}
                    />
                    All organizations
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    <input
                      type="checkbox"
                      checked={allocPublic}
                      onChange={(e) => {
                        setAllocPublic(e.target.checked);
                        if (e.target.checked) setAllocAllOrgs(false);
                      }}
                    />
                    Public pool
                  </label>
                </div>
                {!allocAllOrgs && !allocPublic ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="alloc-org">Organization</Label>
                    <select
                      id="alloc-org"
                      required
                      value={allocOrgId}
                      onChange={(e) => setAllocOrgId(e.target.value)}
                      className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
                    >
                      <option value="">Select…</option>
                      {(orgsQuery.data ?? []).map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="alloc-qty">Quantity</Label>
                  <Input
                    id="alloc-qty"
                    type="number"
                    min={1}
                    required
                    value={allocQty}
                    onChange={(e) => setAllocQty(e.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alloc-price">Price (USD, optional)</Label>
                  <Input
                    id="alloc-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={allocPrice}
                    onChange={(e) => setAllocPrice(e.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" isLoading={createAllocMutation.isPending}>
                    Create allocation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {allocationsQuery.isLoading ? (
                <p className="p-6 text-sm text-ink-500">Loading…</p>
              ) : allocations.length === 0 ? (
                <p className="p-6 text-sm text-ink-500">No allocations yet.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {allocations.map((alloc) => (
                    <AllocationRow
                      key={alloc.id}
                      alloc={alloc}
                      onUpdate={(body) =>
                        updateAllocMutation.mutate({ allocationId: alloc.id, ...body })
                      }
                      updatePending={updateAllocMutation.isPending}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'tickets' ? (
        <div className="space-y-6">
          <p className="text-sm text-ink-500">
            Members buy their own tickets from My tickets. Here you can void or mark
            paid tickets that have been purchased.
          </p>

          {isHost
            ? visibleAllocations.map((alloc) => (
                <AllocationTicketsSection
                  key={alloc.id}
                  alloc={alloc}
                  tickets={tickets.filter((t) => t.allocationId === alloc.id)}
                  loading={ticketsQuery.isLoading}
                  onMarkPaid={(id) => markPaidMutation.mutate(id)}
                  onVoid={(id) => voidMutation.mutate(id)}
                  actionPending={markPaidMutation.isPending || voidMutation.isPending}
                />
              ))
            : resolvedInvitedAllocId
              ? (
                  <AllocationTicketsSection
                    alloc={
                      visibleAllocations[0] ?? {
                        id: resolvedInvitedAllocId,
                        eventId,
                        organizationId: user?.membership?.organizationId ?? null,
                        organizationName: user?.membership?.organizationName ?? null,
                        quantity: 0,
                        priceCents: null,
                        status: 'active',
                        issuedCount: tickets.filter((t) => t.status !== 'void').length,
                        createdAt: '',
                        updatedAt: '',
                      }
                    }
                    tickets={tickets}
                    loading={ticketsQuery.isLoading}
                    onMarkPaid={(id) => markPaidMutation.mutate(id)}
                    onVoid={(id) => voidMutation.mutate(id)}
                    actionPending={markPaidMutation.isPending || voidMutation.isPending}
                  />
                )
              : (
                  <p className="text-sm text-ink-500">
                    No allocation for your organization on this event yet.
                  </p>
                )}
        </div>
      ) : null}

      {tab === 'guests' && isHost ? (
        <Card>
          <CardContent className="p-0">
            {guestsQuery.isLoading ? (
              <p className="p-6 text-sm text-ink-500">Loading…</p>
            ) : (guestsQuery.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-ink-500">No paid guests yet.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {(guestsQuery.data ?? []).map((guest) => (
                  <li
                    key={guest.id}
                    className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-ink-100">
                        {guest.holderName ?? guest.holderUserId ?? 'Guest'}
                      </p>
                      <p className="text-sm text-ink-500">{guest.allocationLabel}</p>
                    </div>
                    <Badge variant="default">{guest.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AllocationRow({
  alloc,
  onUpdate,
  updatePending,
}: {
  alloc: TicketAllocation;
  onUpdate: (body: { quantity?: number; status?: 'active' | 'closed' }) => void;
  updatePending: boolean;
}) {
  const [qty, setQty] = useState(String(alloc.quantity));

  return (
    <li className="flex flex-col gap-3 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-ink-100">{allocationLabel(alloc)}</p>
          <p className="text-sm text-ink-500">
            {alloc.issuedCount} / {alloc.quantity} sold · {formatCents(alloc.priceCents)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(alloc.status)}>{alloc.status}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`qty-${alloc.id}`} className="text-xs">
            Quantity
          </Label>
          <Input
            id={`qty-${alloc.id}`}
            type="number"
            min={alloc.issuedCount || 1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="min-h-9 w-24"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updatePending}
          onClick={() => onUpdate({ quantity: Number(qty) })}
        >
          Update qty
        </Button>
        {alloc.status === 'active' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updatePending}
            onClick={() => onUpdate({ status: 'closed' })}
          >
            Close
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updatePending}
            onClick={() => onUpdate({ status: 'active' })}
          >
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

function AllocationTicketsSection({
  alloc,
  tickets,
  loading,
  onMarkPaid,
  onVoid,
  actionPending,
}: {
  alloc: TicketAllocation;
  tickets: Ticket[];
  loading: boolean;
  onMarkPaid: (id: string) => void;
  onVoid: (id: string) => void;
  actionPending: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">{allocationLabel(alloc)}</CardTitle>
        <p className="text-sm text-ink-500">
          {alloc.issuedCount} / {alloc.quantity} sold
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No tickets purchased yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-mono text-sm text-ink-300">
                    {ticket.credentialToken.slice(0, 12)}…
                  </p>
                  <p className="text-xs text-ink-500">
                    {ticket.holderUserId ? `Holder: ${ticket.holderUserId}` : 'No holder'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(ticket.status)}>
                    {ticket.status}
                  </Badge>
                  {ticket.status === 'unpaid' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actionPending}
                      onClick={() => onMarkPaid(ticket.id)}
                    >
                      Mark paid
                    </Button>
                  ) : null}
                  {ticket.status !== 'void' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={actionPending}
                      onClick={() => onVoid(ticket.id)}
                    >
                      Void
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
