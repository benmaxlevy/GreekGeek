import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WebhookEvent, WebhookEventStatusFilter } from '@greekgeek/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listWebhookEvents, requeueWebhookEvent } from '@/lib/webhook-events-api';

export const Route = createFileRoute('/admin/webhook-events')({
  component: AdminWebhookEventsPage,
});

const STATUS_FILTERS: WebhookEventStatusFilter[] = ['unprocessed', 'failed', 'all'];

const ERROR_TRUNCATE = 80;

function isFailed(event: WebhookEvent): boolean {
  return event.processedAt === null && event.lastError !== null;
}

function truncateError(value: string | null): string {
  if (!value) return '—';
  if (value.length <= ERROR_TRUNCATE) return value;
  return `${value.slice(0, ERROR_TRUNCATE)}…`;
}

function formatTs(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function AdminWebhookEventsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<WebhookEventStatusFilter>('all');
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin', 'webhook-events', statusFilter],
    queryFn: () => listWebhookEvents({ status: statusFilter }),
  });

  const requeueMutation = useMutation({
    mutationFn: (id: string) => requeueWebhookEvent(id),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'webhook-events'],
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const events = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="rl-eyebrow">Admin / integrations</p>
        <h1 className="display-sm">Payment events</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-500">
          Review payment events from Stripe and retry ones that failed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--error)]">
          {error}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-500">Loading events…</p>
          ) : events.length === 0 ? (
            <p className="p-6 text-sm text-ink-500">No events for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-white/[0.02]">
                  <tr className="border-b border-border-subtle text-ink-500">
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">Service</th>
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">Type</th>
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">External ID</th>
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">Received</th>
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">Processed</th>
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">Attempts</th>
                    <th className="rl-eyebrow px-4 py-3 text-left font-medium">Last error</th>
                    <th className="px-4 py-3 font-medium"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {events.map((event) => (
                    <tr key={event.id} className="align-top text-ink-100">
                      <td className="px-4 py-3">
                        <Badge variant="outline">{event.service}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{event.type}</td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-ink-300">
                        {event.externalId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                        {formatTs(event.receivedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                        {formatTs(event.processedAt)}
                      </td>
                      <td className="num px-4 py-3">{event.attempts}</td>
                      <td
                        className="max-w-[220px] px-4 py-3 text-ink-500"
                        title={event.lastError ?? undefined}
                      >
                        {truncateError(event.lastError)}
                      </td>
                      <td className="px-4 py-3">
                        {isFailed(event) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={requeueMutation.isPending}
                            isLoading={
                              requeueMutation.isPending && requeueMutation.variables === event.id
                            }
                            onClick={() => requeueMutation.mutate(event.id)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
