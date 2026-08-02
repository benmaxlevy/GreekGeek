import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { listOrganizations } from '@/lib/admin-api';
import { listEvents } from '@/lib/events-api';

export const Route = createFileRoute('/admin/ticketed-events')({
  component: AdminTicketedEventsPage,
});

function AdminTicketedEventsPage() {
  const [orgFilter, setOrgFilter] = useState('');

  const orgsQuery = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => listOrganizations({}),
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'ticketed-events', orgFilter],
    queryFn: () =>
      listEvents({
        ticketingEnabled: true,
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      }),
  });

  const orgName = new Map((orgsQuery.data ?? []).map((o) => [o.id, o.name]));
  const events = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight">Ticketed events</h1>
        <p className="mt-1 text-sm text-ink-500">
          Browse events with ticketing and manage their tickets.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticketed-org-filter">Filter by organization</Label>
        <select
          id="ticketed-org-filter"
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

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No ticketed events.</p>
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
                      {event.ticketSaleStatus ? (
                        <Badge variant="secondary">{event.ticketSaleStatus}</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-ink-500">
                      {orgName.get(event.organizationId) ?? event.organizationId}
                      {event.ticketCapacity != null
                        ? ` · Capacity ${event.ticketCapacity}`
                        : ''}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link
                      to="/admin/events/$eventId/tickets"
                      params={{ eventId: event.id }}
                    >
                      Manage tickets
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
