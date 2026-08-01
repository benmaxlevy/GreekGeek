import { useState, type FormEvent } from 'react';
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Event } from '@rally/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  canCreateOrgEvents,
  canManageOrgEvents,
  canManageTickets,
} from '@/lib/auth-routing';
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from '@/lib/events-api';

const appEventsRouteApi = getRouteApi('/app/events');

export const Route = createFileRoute('/app/events/')({
  component: AppEventsPage,
});

function AppEventsPage() {
  const { user } = appEventsRouteApi.useRouteContext();
  const queryClient = useQueryClient();
  const organizationId = user.membership!.organizationId;
  const canCreate = canCreateOrgEvents(user);
  const canManage = canManageOrgEvents(user);
  const canTickets = canManageTickets(user);

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [maxHeadcount, setMaxHeadcount] = useState('50');
  const [location, setLocation] = useState('');
  const [editing, setEditing] = useState<Event | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editMaxHeadcount, setEditMaxHeadcount] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => listEvents({ organizationId }),
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
        location: location.trim() ? location.trim() : null,
      }),
    onSuccess: async () => {
      setName('');
      setType('');
      setMaxHeadcount('50');
      setLocation('');
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No event selected');
      return updateEvent(editing.id, {
        name: editName,
        type: editType,
        maxHeadcount: Number(editMaxHeadcount),
        location: editLocation.trim() ? editLocation.trim() : null,
      });
    },
    onSuccess: async () => {
      setEditing(null);
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const events = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Events</h1>
        <p className="mt-1 text-sm text-ink-500">
          {user.membership?.organizationName
            ? `Events for ${user.membership.organizationName}.`
            : 'Organization events.'}
        </p>
      </div>

      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create event</CardTitle>
          </CardHeader>
          <CardContent>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit event</CardTitle>
          </CardHeader>
          <CardContent>
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

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No events yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-100">{event.name}</p>
                      <Badge variant="outline">{event.type}</Badge>
                    </div>
                    <p className="text-sm text-ink-500">
                      Max {event.maxHeadcount}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                  {canManage || canTickets ? (
                    <div className="flex flex-wrap gap-2">
                      {canTickets ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link
                            to="/app/events/$eventId/tickets"
                            params={{ eventId: event.id }}
                          >
                            Tickets
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
