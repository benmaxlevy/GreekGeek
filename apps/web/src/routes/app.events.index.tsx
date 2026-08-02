import { useState, type FormEvent } from 'react';
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Event } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HostEventPayoutSummary } from '@/components/event-payouts/HostEventPayoutSummary';
import {
  canCreateOrgEvents,
  canManageOrgEvents,
  canManageOrgPayments,
  canManageTickets,
  canScanTickets,
} from '@/lib/auth-routing';
import {
  createEvent,
  deleteEvent,
  formatEventError,
  listEvents,
  toDateTimeLocal,
  toIsoDateTime,
  updateEvent,
} from '@/lib/events-api';

const appEventsRouteApi = getRouteApi('/app/events');

export const Route = createFileRoute('/app/events/')({
  component: AppEventsPage,
});

function AppEventsPage() {
  const { user } = appEventsRouteApi.useRouteContext();
  const queryClient = useQueryClient();
  const organizationId = user.membership?.organizationId ?? '';
  const canCreate = canCreateOrgEvents(user);
  const canManage = canManageOrgEvents(user);
  const canTickets = canManageTickets(user);
  const canScan = canScanTickets(user);
  const canEventTickets = canTickets || canScan;

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [maxHeadcount, setMaxHeadcount] = useState('50');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [editing, setEditing] = useState<Event | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editMaxHeadcount, setEditMaxHeadcount] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => listEvents({ organizationId }),
    enabled: Boolean(organizationId),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['events'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createEvent({
        organizationId,
        name,
        type,
        maxHeadcount: Number(maxHeadcount),
        startsAt: toIsoDateTime(startsAt),
        endsAt: endsAt ? toIsoDateTime(endsAt) : null,
        location: location.trim() ? location.trim() : null,
      }),
    onSuccess: async () => {
      setName('');
      setType('');
      setMaxHeadcount('50');
      setStartsAt('');
      setEndsAt('');
      setLocation('');
      setError(null);
      await invalidate();
    },
    onError: (err: unknown) => setError(formatEventError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No event selected');
      return updateEvent(editing.id, {
        name: editName,
        type: editType,
        maxHeadcount: Number(editMaxHeadcount),
        startsAt: toIsoDateTime(editStartsAt),
        endsAt: editEndsAt ? toIsoDateTime(editEndsAt) : null,
        location: editLocation.trim() ? editLocation.trim() : null,
      });
    },
    onSuccess: async () => {
      setEditing(null);
      setError(null);
      await invalidate();
    },
    onError: (err: unknown) => setError(formatEventError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: unknown) => setError(formatEventError(err)),
  });

  if (!organizationId) {
    return (
      <div className="space-y-2">
        <p className="rl-eyebrow">Chapter calendar</p>
        <h1 className="display-md font-display">Events</h1>
        <p className="text-sm text-ink-500">Join an organization to see chapter events.</p>
      </div>
    );
  }

  const events = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">Chapter calendar</p>
        <h1 className="display-md font-display">Events</h1>
        <p className="max-w-2xl text-sm text-ink-500">
          {user.membership?.organizationName
            ? `Events for ${user.membership.organizationName}.`
            : 'Browse and manage your organization events.'}
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      {canCreate ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-subtle pb-5">
            <p className="rl-eyebrow">New listing</p>
            <CardTitle className="display-sm font-display mt-2">Create event</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="event-name">Event name</Label>
                <Input
                  id="event-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-type">Event type</Label>
                <Input
                  id="event-type"
                  required
                  placeholder="e.g. Fraternity Formal"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-headcount">Max headcount</Label>
                <Input
                  id="event-headcount"
                  type="number"
                  min={1}
                  required
                  value={maxHeadcount}
                  onChange={(e) => setMaxHeadcount(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-starts-at">Starts</Label>
                <Input
                  id="event-starts-at"
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-ends-at">Ends (optional)</Label>
                <Input
                  id="event-ends-at"
                  type="datetime-local"
                  min={startsAt}
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="event-location">Location (optional)</Label>
                <Input
                  id="event-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" isLoading={createMutation.isPending}>
                  Create
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {editing && canManage ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-subtle pb-5">
            <p className="rl-eyebrow">Event details</p>
            <CardTitle className="display-sm font-display mt-2">Edit event</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-event-name">Event name</Label>
                <Input
                  id="edit-event-name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-event-type">Event type</Label>
                <Input
                  id="edit-event-type"
                  required
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-event-headcount">Max headcount</Label>
                <Input
                  id="edit-event-headcount"
                  type="number"
                  min={1}
                  required
                  value={editMaxHeadcount}
                  onChange={(e) => setEditMaxHeadcount(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-event-starts-at">Starts</Label>
                <Input
                  id="edit-event-starts-at"
                  type="datetime-local"
                  required
                  value={editStartsAt}
                  onChange={(e) => setEditStartsAt(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-event-ends-at">Ends (optional)</Label>
                <Input
                  id="edit-event-ends-at"
                  type="datetime-local"
                  min={editStartsAt}
                  value={editEndsAt}
                  onChange={(e) => setEditEndsAt(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-event-location">Location (optional)</Label>
                <Input
                  id="edit-event-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" isLoading={updateMutation.isPending}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading events…</p>
          ) : events.length === 0 ? (
            <div className="space-y-4 p-6">
              <div>
                <p className="display-sm font-display">Your calendar is clear.</p>
                <p className="mt-1 text-sm text-ink-500">
                  Create your first event to start selling and managing tickets.
                </p>
              </div>
              {canCreate ? (
                <Button
                  type="button"
                  onClick={() => document.getElementById('event-name')?.focus()}
                >
                  Create your first event
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {events.map((event) => (
                <li key={event.id} className="flex flex-col gap-4 px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink-100">{event.name}</p>
                        <Badge variant="outline">{event.type}</Badge>
                        {event.heldAt ? <Badge variant="destructive">On hold</Badge> : null}
                      </div>
                      <p className="text-sm text-ink-500">
                        {new Date(event.startsAt).toLocaleString()}
                        {event.endsAt ? ` – ${new Date(event.endsAt).toLocaleString()}` : ''}
                        {' · '}
                        Max <span className="num">{event.maxHeadcount}</span>
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                    {canManage || canEventTickets ? (
                      <div className="flex flex-wrap gap-2">
                        {canEventTickets ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link to="/app/events/$eventId/tickets" params={{ eventId: event.id }}>
                              {canTickets ? 'Tickets' : 'Scan'}
                            </Link>
                          </Button>
                        ) : null}
                        {canManage ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditing(event);
                                setEditName(event.name);
                                setEditType(event.type);
                                setEditMaxHeadcount(String(event.maxHeadcount));
                                setEditStartsAt(toDateTimeLocal(event.startsAt));
                                setEditEndsAt(event.endsAt ? toDateTimeLocal(event.endsAt) : '');
                                setEditLocation(event.location ?? '');
                                setError(null);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(event.id)}
                            >
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {canManageOrgPayments(user, event.organizationId) ? (
                    <HostEventPayoutSummary eventId={event.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
