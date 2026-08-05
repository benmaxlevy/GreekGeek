import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Event } from '@greekgeek/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listOrganizations } from '@/lib/admin-api';
import {
  createEvent,
  deleteEvent,
  formatEventError,
  listEvents,
  toDateTimeLocal,
  toIsoDateTime,
  updateEvent,
} from '@/lib/events-api';

export const Route = createFileRoute('/admin/events')({
  component: AdminEventsPage,
});

function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [orgFilter, setOrgFilter] = useState('');
  const [organizationId, setOrganizationId] = useState('');
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

  const orgsQuery = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => listOrganizations({}),
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'events', orgFilter],
    queryFn: () => listEvents(orgFilter ? { organizationId: orgFilter } : {}),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
  }

  const orgName = new Map((orgsQuery.data ?? []).map((o) => [o.id, o.name]));

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

  const events = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">Admin / operations</p>
        <h1 className="display-sm">Events</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-500">
          Create and manage events across organizations.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--error)]">
          {error}
        </p>
      ) : null}

      <div className="space-y-2 rounded-lg border border-border-subtle bg-white/[0.02] p-4">
        <Label htmlFor="event-org-filter">Filter by organization</Label>
        <select
          id="event-org-filter"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="min-h-11 w-full max-w-md rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
        >
          <option value="">All organizations</option>
          {(orgsQuery.data ?? []).map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <p className="rl-eyebrow">Event setup</p>
          <CardTitle className="display-sm">Create event</CardTitle>
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
              <Label htmlFor="admin-event-org">Organization</Label>
              <select
                id="admin-event-org"
                required
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-input px-3 text-sm text-ink-100"
              >
                <option value="">Select…</option>
                {(orgsQuery.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-event-name">Event name</Label>
              <Input
                id="admin-event-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-type">Event type</Label>
              <Input
                id="admin-event-type"
                required
                placeholder="e.g. Fraternity Formal"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-headcount">Max headcount</Label>
              <Input
                id="admin-event-headcount"
                type="number"
                min={1}
                required
                value={maxHeadcount}
                onChange={(e) => setMaxHeadcount(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-starts-at">Starts</Label>
              <Input
                id="admin-event-starts-at"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-ends-at">Ends (optional)</Label>
              <Input
                id="admin-event-ends-at"
                type="datetime-local"
                min={startsAt}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-event-location">Location (optional)</Label>
              <Input
                id="admin-event-location"
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

      {editing ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="rl-eyebrow">Event setup</p>
            <CardTitle className="display-sm">Edit event</CardTitle>
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
                <Label htmlFor="admin-edit-event-name">Event name</Label>
                <Input
                  id="admin-edit-event-name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-edit-event-type">Event type</Label>
                <Input
                  id="admin-edit-event-type"
                  required
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-edit-event-headcount">Max headcount</Label>
                <Input
                  id="admin-edit-event-headcount"
                  type="number"
                  min={1}
                  required
                  value={editMaxHeadcount}
                  onChange={(e) => setEditMaxHeadcount(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-edit-event-starts-at">Starts</Label>
                <Input
                  id="admin-edit-event-starts-at"
                  type="datetime-local"
                  required
                  value={editStartsAt}
                  onChange={(e) => setEditStartsAt(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-edit-event-ends-at">Ends (optional)</Label>
                <Input
                  id="admin-edit-event-ends-at"
                  type="datetime-local"
                  min={editStartsAt}
                  value={editEndsAt}
                  onChange={(e) => setEditEndsAt(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="admin-edit-event-location">Location (optional)</Label>
                <Input
                  id="admin-edit-event-location"
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
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No events yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-100">{event.name}</p>
                      <Badge variant="outline">{event.type}</Badge>
                      {event.heldAt ? <Badge variant="destructive">On hold</Badge> : null}
                    </div>
                    <p className="text-sm text-ink-500">
                      {orgName.get(event.organizationId) ?? event.organizationId}
                      {' · '}
                      {new Date(event.startsAt).toLocaleString()}
                      {event.endsAt ? ` – ${new Date(event.endsAt).toLocaleString()}` : ''}
                      {' · '}Max {event.maxHeadcount}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
